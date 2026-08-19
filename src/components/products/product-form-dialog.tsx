'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { ScanBarcode } from 'lucide-react';
import { BarcodeScanner } from '@/components/pos/barcode-scanner';

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
  onSaved?: () => void;
}

export function ProductFormDialog({ open, onOpenChange, product, onSaved }: ProductFormDialogProps) {
  const isEdit = !!product;
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showScanner, setShowScanner] = useState(false);

  const [form, setForm] = useState({
    name: '',
    barcode: '',
    sku: '',
    brand: '',
    categoryId: '',
    supplierId: '',
    costPrice: '',
    sellingPrice: '',
    currentQuantity: '0',
    minStockLevel: '5',
    unit: 'pc',
  });

  useEffect(() => {
    if (open) {
      apiFetch<Category[]>('/api/products/categories').then((r) => {
        if (r.data) setCategories(r.data);
      });
      apiFetch<{ data: Supplier[] }>('/api/suppliers?limit=100').then((r) => {
        if (r.data) setSuppliers(r.data.data);
      });

      if (product) {
        setForm({
          name: product.name || '',
          barcode: product.barcode || '',
          sku: product.barcode || product.sku || '',
          brand: product.brand || '',
          categoryId: product.categoryId || '',
          supplierId: product.supplierId || '',
          costPrice: String(product.costPrice || ''),
          sellingPrice: String(product.sellingPrice || ''),
          currentQuantity: String(product.currentQuantity || 0),
          minStockLevel: String(product.minStockLevel || 5),
          unit: product.unit || 'pc',
        });
      } else {
        setForm({
          name: '',
          barcode: '',
          sku: '',
          brand: '',
          categoryId: '',
          supplierId: '',
          costPrice: '',
          sellingPrice: '',
          currentQuantity: '0',
          minStockLevel: '5',
          unit: 'pc',
        });
      }
    }
  }, [open, product]);

  const updateField = (key: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'barcode') {
        next.sku = value.trim();
      }
      return next;
    });
  };

  const validate = () => {
    if (!form.name.trim()) { toast.error('Product name is required.'); return false; }
    if (!form.costPrice || isNaN(parseFloat(form.costPrice))) { toast.error('Valid cost price is required.'); return false; }
    if (!form.sellingPrice || isNaN(parseFloat(form.sellingPrice))) { toast.error('Valid selling price is required.'); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        sku: form.barcode.trim() || null,
        brand: form.brand.trim() || null,
        categoryId: form.categoryId || null,
        supplierId: form.supplierId || null,
        costPrice: parseFloat(form.costPrice),
        sellingPrice: parseFloat(form.sellingPrice),
        currentQuantity: isEdit ? undefined : parseInt(form.currentQuantity) || 0,
        minStockLevel: parseInt(form.minStockLevel) || 5,
        unit: form.unit || 'pc',
      };

      const url = isEdit ? `/api/products/${product.id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await apiFetch(url, { method, body: JSON.stringify(body) });

      if (res.error) { toast.error(res.error); return; }
      toast.success(isEdit ? 'Product updated.' : 'Product created.');
      onOpenChange(false);
      onSaved?.();
    } catch {
      toast.error('Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleBarcodeScanned = (barcode: string) => {
    updateField('barcode', barcode);
    setShowScanner(false);
    toast.success('Barcode scanned: ' + barcode);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="text-base">{isEdit ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pf-name">Product Name *</Label>
                <Input id="pf-name" value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="e.g. Lucky Me Pancit Canton" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pf-barcode">Barcode / Item Number (also used as SKU)</Label>
                <div className="flex gap-2">
                  <Input id="pf-barcode" className="flex-1" value={form.barcode} onChange={(e) => updateField('barcode', e.target.value)} placeholder="e.g. 4806540212345 or scan" />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 h-10 px-3"
                    onClick={() => setShowScanner(true)}
                    title="Scan barcode with camera"
                  >
                    <ScanBarcode className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">This serves as both the barcode and SKU for the product.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-brand">Brand</Label>
                <Input id="pf-brand" value={form.brand} onChange={(e) => updateField('brand', e.target.value)} placeholder="e.g. Lucky Me" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-category">Category</Label>
                <Select value={form.categoryId} onValueChange={(v) => updateField('categoryId', v)}>
                  <SelectTrigger id="pf-category"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-supplier">Supplier</Label>
                <Select value={form.supplierId} onValueChange={(v) => updateField('supplierId', v)}>
                  <SelectTrigger id="pf-supplier"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-cost">Cost Price *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
                  <Input id="pf-cost" type="number" min="0" step="0.01" className="pl-7" value={form.costPrice} onChange={(e) => updateField('costPrice', e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-selling">Selling Price *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
                  <Input id="pf-selling" type="number" min="0" step="0.01" className="pl-7" value={form.sellingPrice} onChange={(e) => updateField('sellingPrice', e.target.value)} placeholder="0.00" />
                </div>
              </div>
              {!isEdit && (
                <div className="space-y-1.5">
                  <Label htmlFor="pf-qty">Initial Quantity</Label>
                  <Input id="pf-qty" type="number" min="0" value={form.currentQuantity} onChange={(e) => updateField('currentQuantity', e.target.value)} placeholder="0" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="pf-minstock">Min Stock Level</Label>
                <Input id="pf-minstock" type="number" min="0" value={form.minStockLevel} onChange={(e) => updateField('minStockLevel', e.target.value)} placeholder="5" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-unit">Unit</Label>
                <Select value={form.unit} onValueChange={(v) => updateField('unit', v)}>
                  <SelectTrigger id="pf-unit"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['pc', 'pack', 'box', 'dozen', 'bundle', 'kg', 'g', 'l', 'ml', 'can', 'bottle'].map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Barcode scanner for product form */}
      {showScanner && (
        <BarcodeScanner
          mode="product"
          onBarcodeDetected={handleBarcodeScanned}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}
