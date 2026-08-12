'use client';

import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDate } from '@/lib/api';
import { Printer, X } from 'lucide-react';

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
  customerName: string | null;
  status: string;
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
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!sale) return null;

  const handlePrint = () => {
    if (!receiptRef.current) return;

    const printWindow = window.open('', '_blank', 'width=320,height=600');
    if (!printWindow) {
      // Fallback: use window.print with print stylesheet
      window.print();
      return;
    }

    const receiptHTML = receiptRef.current.innerHTML;
    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Receipt - ${sale.transactionNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: 80mm;
      max-width: 80mm;
      padding: 2mm;
      color: #000;
      background: #fff;
    }
    .receipt-center { text-align: center; }
    .receipt-bold { font-weight: bold; }
    .receipt-sm { font-size: 10px; }
    .receipt-xs { font-size: 9px; color: #555; }
    .receipt-line { border-top: 1px dashed #000; margin: 4px 0; }
    .receipt-item { display: flex; justify-content: space-between; line-height: 1.4; }
    .receipt-item-name { flex: 1; word-break: break-word; padding-right: 4px; }
    .receipt-item-total { text-align: right; white-space: nowrap; font-weight: bold; }
    .receipt-total-row { display: flex; justify-content: space-between; line-height: 1.6; }
    .receipt-grand { font-size: 14px; font-weight: bold; }
    .receipt-footer { text-align: center; margin-top: 6px; font-size: 10px; }
    @media print {
      body { width: 80mm; margin: 0; padding: 2mm; }
      @page { size: 80mm auto; margin: 0; }
    }
  </style>
</head>
<body>
  ${receiptHTML}
  <script>window.onload = function() { window.print(); window.close(); }</script>
</body>
</html>`);
    printWindow.document.close();
  };

  // Receipt content for printing (thermal printer friendly)
  const receiptContent = (
    <div ref={receiptRef} className="receipt-content">
      {/* Store header */}
      <div className="receipt-center">
        <div className="receipt-bold" style={{ fontSize: '14px' }}>{storeName}</div>
        <div className="receipt-xs">{sale.transactionNumber}</div>
        <div className="receipt-xs">{formatDate(sale.date)}</div>
        <div className="receipt-xs">Cashier: {sale.cashier?.displayName || '-'}</div>
      </div>

      <div className="receipt-line" />

      {/* Items */}
      {sale.items.map((item, i) => (
        <div key={i} style={{ marginBottom: '2px' }}>
          <div className="receipt-item">
            <span className="receipt-item-name">{item.productName}</span>
            <span className="receipt-item-total">{formatCurrency(item.totalPrice)}</span>
          </div>
          <div className="receipt-xs" style={{ paddingLeft: '4px' }}>
            {item.quantity} x {formatCurrency(item.unitPrice)}
          </div>
        </div>
      ))}

      <div className="receipt-line" />

      {/* Totals */}
      <div className="receipt-total-row">
        <span>Subtotal</span>
        <span>{formatCurrency(sale.subtotal)}</span>
      </div>
      {sale.discount > 0 && (
        <div className="receipt-total-row">
          <span>Discount</span>
          <span>-{formatCurrency(sale.discount)}</span>
        </div>
      )}
      <div className="receipt-line" />
      <div className="receipt-total-row receipt-grand">
        <span>TOTAL</span>
        <span>{formatCurrency(sale.total)}</span>
      </div>

      <div className="receipt-line" />

      {/* Payment */}
      <div className="receipt-total-row">
        <span>Payment ({sale.paymentMethod})</span>
        <span>{formatCurrency(sale.paymentAmount)}</span>
      </div>
      <div className="receipt-total-row">
        <span>Change</span>
        <span>{formatCurrency(sale.changeAmount)}</span>
      </div>

      <div className="receipt-line" />

      <div className="receipt-footer">
        Thank you for your purchase!
      </div>
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center text-base">Transaction Complete</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {/* Store header */}
            <div className="text-center space-y-1">
              <p className="font-semibold text-base">{storeName}</p>
              <p className="text-xs text-muted-foreground">{sale.transactionNumber}</p>
              <p className="text-xs text-muted-foreground">{formatDate(sale.date)}</p>
              <p className="text-xs text-muted-foreground">Cashier: {sale.cashier?.displayName || '-'}</p>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-1">
              {sale.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <div className="flex-1">
                    <p>{item.productName}</p>
                    <p className="text-muted-foreground">
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
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
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
                <span className="text-muted-foreground">Payment ({sale.paymentMethod})</span>
                <span>{formatCurrency(sale.paymentAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Change</span>
                <span>{formatCurrency(sale.changeAmount)}</span>
              </div>
            </div>

            <Separator />

            <p className="text-center text-xs text-muted-foreground">Thank you for your purchase!</p>
          </div>

          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print Receipt
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              New Sale
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden printable receipt (only visible when printing) */}
      <div className="hidden" aria-hidden="true">
        <div id="thermal-receipt" className="print-receipt-only">
          {receiptContent}
        </div>
      </div>

      {/* Print stylesheet for thermal printers */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-receipt,
          #thermal-receipt * {
            visibility: visible;
          }
          #thermal-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>
    </>
  );
}
