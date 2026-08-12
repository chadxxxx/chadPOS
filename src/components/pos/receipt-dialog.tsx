'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDate } from '@/lib/api';

interface SaleItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Sale {
  transactionNumber: string;
  date: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentAmount: number;
  changeAmount: number;
  cashier: { displayName: string } | null;
  items: SaleItem[];
}

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  storeName?: string;
}

export function ReceiptDialog({ open, onOpenChange, sale, storeName = 'My Sari-Sari Store' }: ReceiptDialogProps) {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm print:max-w-none print:p-0 print:border-0 print:shadow-none print:bg-white">
        <DialogHeader>
          <DialogTitle className="text-center text-base">Transaction Complete</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm print:space-y-2">
          {/* Store header */}
          <div className="text-center space-y-1">
            <p className="font-semibold text-base">{storeName}</p>
            <p className="text-xs text-muted-foreground print:text-black">{sale.transactionNumber}</p>
            <p className="text-xs text-muted-foreground print:text-black">{formatDate(sale.date)}</p>
            <p className="text-xs text-muted-foreground print:text-black">Cashier: {sale.cashier?.displayName || '-'}</p>
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-1">
            {sale.items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <div className="flex-1">
                  <p>{item.productName}</p>
                  <p className="text-muted-foreground print:text-gray-600">
                    {item.quantity} x {formatCurrency(item.unitPrice)}
                  </p>
                </div>
                <p className="font-medium">{formatCurrency(item.totalPrice)}</p>
              </div>
            ))}
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground print:text-black">Subtotal</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground print:text-black">Discount</span>
                <span>-{formatCurrency(sale.discount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold text-sm">
              <span>Total</span>
              <span>{formatCurrency(sale.total)}</span>
            </div>
          </div>

          <Separator />

          {/* Payment */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground print:text-black">Payment ({sale.paymentMethod})</span>
              <span>{formatCurrency(sale.paymentAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground print:text-black">Change</span>
              <span>{formatCurrency(sale.changeAmount)}</span>
            </div>
          </div>

          <Separator />

          <p className="text-center text-xs text-muted-foreground print:text-black">Thank you for your purchase!</p>
        </div>

        <div className="flex gap-2 print:hidden mt-2">
          <Button variant="outline" className="flex-1" onClick={handlePrint}>
            Print Receipt
          </Button>
          <Button className="flex-1" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
