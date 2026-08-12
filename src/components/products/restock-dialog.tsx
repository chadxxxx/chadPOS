'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

interface RestockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  onSaved?: () => void;
}

export function RestockDialog({ open, onOpenChange, product, onSaved }: RestockDialogProps) {
  const [saving, setSaving] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [reason, setReason] = useState('');
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && suppliers.length === 0) {
      apiFetch<{ data: { id: string; name: string }[] }>('/api/suppliers?limit=100').then((r) => {
        if (r.data) setSuppliers(r.data.data);
      });
    }
    if (!isOpen) {
      setQuantity('');
      setCostPrice('');
      setSupplierId('');
      setReason('');
    }
  };

  const handleSave = async () => {
    const qty = parseInt(quantity);
    if (!qty || qty <= 0) { toast.error('Enter a valid quantity.'); return; }

    setSaving(true);
    try {
      const res = await apiFetch('/api/inventory/movements', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          type: 'RESTOCK',
          quantityChanged: qty,
          newCostPrice: costPrice ? parseFloat(costPrice) : undefined,
          supplierId: supplierId || undefined,
          reason: reason.trim() || undefined,
        }),
      });

      if (res.error) { toast.error(res.error); return; }
      toast.success('Stock restocked successfully.');
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error('Failed to restock.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Restock: {product?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Current stock: </span>
            <span className="font-medium">{product?.currentQuantity || 0} {product?.unit || 'pc'}</span>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="restock-qty">Quantity to Add *</Label>
            <Input
              id="restock-qty"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="restock-cost">New Cost Price (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
              <Input
                id="restock-cost"
                type="number"
                min="0"
                step="0.01"
                className="pl-7"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="Leave blank to keep current"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="restock-supplier">Supplier (optional)</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger id="restock-supplier"><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="restock-reason">Reason (optional)</Label>
            <Textarea
              id="restock-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Restocked from Mang Juan Trading"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !quantity}>{saving ? 'Saving...' : 'Add Stock'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
