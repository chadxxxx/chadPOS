'use client';

import { useState } from 'react';
import { formatCurrency, formatDate, apiFetch } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface Props {
  sale: any;
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}

export function TransactionDetailDialog({ sale, open, onClose, isAdmin }: Props) {
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [returnReason, setReturnReason] = useState('');

  if (!sale) return null;

  const handleVoid = async () => {
    if (!voidReason) return;
    setSubmitting(true);
    const res = await apiFetch(`/api/sales/${sale.id}/void`, { method: 'POST', body: JSON.stringify({ reason: voidReason }) });
    setSubmitting(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Transaction voided');
    setVoidOpen(false); setVoidReason('');
    onClose();
  };

  const handleReturn = async () => {
    const itemsToReturn = returnItems.filter((i) => i.returnQty > 0);
    if (!itemsToReturn.length || !returnReason) return;
    setSubmitting(true);
    const res = await apiFetch(`/api/sales/${sale.id}/return`, {
      method: 'POST',
      body: JSON.stringify({ items: itemsToReturn.map((i) => ({ saleItemId: i.id, quantity: i.returnQty })), reason: returnReason }),
    });
    setSubmitting(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Return processed');
    setReturnOpen(false); setReturnReason(''); setReturnItems([]);
    onClose();
  };

  const openReturnDialog = () => {
    setReturnItems((sale.items || []).map((i: any) => ({ ...i, returnQty: 0 })));
    setReturnReason('');
    setReturnOpen(true);
  };

  return (
    <>
      <Dialog open={open && !voidOpen && !returnOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Transaction {sale.transactionNumber}
              <Badge variant={sale.status === 'COMPLETED' ? 'secondary' : 'destructive'}>{sale.status}</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><p className="text-muted-foreground">Date</p><p>{formatDate(sale.date)}</p></div>
              <div><p className="text-muted-foreground">Cashier</p><p>{sale.cashier?.displayName || '-'}</p></div>
              <div><p className="text-muted-foreground">Payment Method</p><p>{sale.paymentMethod}</p></div>
              <div><p className="text-muted-foreground">Payment</p><p className="font-mono">{formatCurrency(sale.paymentAmount)}</p></div>
            </div>
            {sale.voidedAt && <div><p className="text-muted-foreground">Voided: {formatDate(sale.voidedAt)}</p><p>Reason: {sale.voidReason}</p></div>}
            <Separator />
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {sale.items?.map((item: any) => (
                  <TableRow key={item.id}><TableCell>{item.productName}</TableCell><TableCell className="text-right font-mono">{item.quantity}</TableCell><TableCell className="text-right font-mono">{formatCurrency(item.unitPrice)}</TableCell><TableCell className="text-right font-mono">{formatCurrency(item.totalPrice)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <Separator />
            <div className="space-y-1 text-right">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatCurrency(sale.subtotal)}</span></div>
              {sale.discount > 0 && <div className="flex justify-between"><span>Discount</span><span className="font-mono">-{formatCurrency(sale.discount)}</span></div>}
              <div className="flex justify-between font-semibold"><span>Total</span><span className="font-mono">{formatCurrency(sale.total)}</span></div>
              <div className="flex justify-between"><span>Amount Tendered</span><span className="font-mono">{formatCurrency(sale.paymentAmount)}</span></div>
              <div className="flex justify-between"><span>Change</span><span className="font-mono">{formatCurrency(sale.changeAmount)}</span></div>
            </div>
            {sale.returns?.length > 0 && <><Separator /><div><p className="font-medium mb-1">Returns</p>{sale.returns.map((r: any) => <p key={r.id} className="text-xs text-muted-foreground">{r.productName} x{r.quantity} - {formatCurrency(r.amount)} ({r.reason})</p>)}</div></>}
          </div>
          {isAdmin && sale.status === 'COMPLETED' && (
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={openReturnDialog}>Process Return</Button>
              <Button variant="destructive" onClick={() => setVoidOpen(true)}>Void Transaction</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Dialog */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void Transaction</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will void transaction {sale.transactionNumber} and return all items to inventory. This action cannot be undone.</p>
          <div className="space-y-2"><Label>Reason</Label><Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason for voiding" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setVoidOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleVoid} disabled={submitting || !voidReason}>{submitting ? 'Voiding...' : 'Confirm Void'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Process Return</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {returnItems.map((item: any, idx: number) => (
              <div key={item.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm">{item.productName} (sold: {item.quantity})</span>
                <Input type="number" min="0" max={item.quantity} value={item.returnQty} onChange={(e) => { const n = [...returnItems]; n[idx] = { ...n[idx], returnQty: parseInt(e.target.value) || 0 }; setReturnItems(n); }} className="w-20" />
              </div>
            ))}
            <div className="space-y-1"><Label>Reason</Label><Input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="Reason for return" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button><Button onClick={handleReturn} disabled={submitting || !returnReason}>{submitting ? 'Processing...' : 'Confirm Return'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}