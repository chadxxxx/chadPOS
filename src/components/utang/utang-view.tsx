'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, formatCurrency, formatDate } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Search, Banknote, Users, CheckCircle2, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface UtangSale {
  id: string;
  transactionNumber: string;
  date: string;
  customerName: string | null;
  total: number;
  status: string;
  items: { id: string }[];
  utangPaidAt: string | null;
  utangPaidByUser: { id: string; displayName: string } | null;
}

interface UtangSummary {
  pendingTotal: number;
  collectedToday: number;
  uniquePendingCustomers: number;
}

interface InvoiceItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface InvoiceData {
  sale: {
    id: string;
    transactionNumber: string;
    date: string;
    customerName: string | null;
    total: number;
    subtotal: number;
    discount: number;
    status: string;
    items: InvoiceItem[];
    utangPaidAt: string | null;
    utangPaidByUser: { id: string; displayName: string } | null;
    cashier: { displayName: string } | null;
  };
  storeInfo: {
    storeName?: string;
    storeAddress?: string;
    storeContact?: string;
  };
}

type FilterTab = 'all' | 'pending' | 'paid';

export function UtangView() {
  const { user } = useAuthStore();
  const canPay = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [sales, setSales] = useState<UtangSale[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<UtangSummary>({ pendingTotal: 0, collectedToday: 0, uniquePendingCustomers: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const limit = 20;

  // Invoice state
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const fetchUtang = useCallback(async () => {
    setLoading(true);
    let url = `/api/utang?page=${page}&limit=${limit}&filter=${filter}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const res = await apiFetch(url);
    if (res.data) {
      const d = res.data as any;
      setSales(d.data || []);
      setTotal(d.total || 0);
      setSummary(d.summary || { pendingTotal: 0, collectedToday: 0, uniquePendingCustomers: 0 });
    }
    setLoading(false);
  }, [page, filter, search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let url = `/api/utang?page=${page}&limit=${limit}&filter=${filter}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await apiFetch(url);
      if (cancelled) return;
      if (res.data) {
        const d = res.data as any;
        setSales(d.data || []);
        setTotal(d.total || 0);
        setSummary(d.summary || { pendingTotal: 0, collectedToday: 0, uniquePendingCustomers: 0 });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [page, filter, search]);

  const handlePayClick = (sale: UtangSale) => {
    setPayingId(sale.id);
    setConfirmOpen(true);
  };

  const handleInvoiceClick = async (saleId: string) => {
    setInvoiceLoading(true);
    setInvoiceOpen(true);
    const res = await apiFetch(`/api/utang/${saleId}`);
    setInvoiceLoading(false);
    if (res.error) { toast.error(res.error); setInvoiceOpen(false); return; }
    setInvoiceData(res.data as InvoiceData);
  };

  const handleConfirmPay = async () => {
    if (!payingId) return;
    setPaying(true);
    const res = await apiFetch(`/api/utang/${payingId}/pay`, { method: 'POST' });
    setPaying(false);
    setConfirmOpen(false);
    setPayingId(null);

    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Utang marked as paid successfully.');
    fetchUtang();
  };

  const handleFilterChange = (value: string) => {
    setFilter(value as FilterTab);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const selectedSale = sales.find((s) => s.id === payingId);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Utang Management</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Pending Utang</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.pendingTotal)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Collected Today</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.collectedToday)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Customers with Utang</p>
              <p className="text-2xl font-bold text-blue-600">{summary.uniquePendingCustomers}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={handleFilterChange} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Transaction #</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No utang transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-sm whitespace-nowrap">{formatDate(sale.date)}</TableCell>
                    <TableCell className="font-mono text-sm">{sale.transactionNumber}</TableCell>
                    <TableCell className="text-sm">{sale.customerName || '-'}</TableCell>
                    <TableCell className="text-sm text-center">{sale.items.length}</TableCell>
                    <TableCell className="text-right font-mono font-medium">{formatCurrency(sale.total)}</TableCell>
                    <TableCell>
                      {sale.status === 'CREDIT' ? (
                        <Badge variant="destructive">Pending</Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleInvoiceClick(sale.id)}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          Invoice
                        </Button>
                        {sale.status === 'CREDIT' && canPay ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-green-600 border-green-300 hover:bg-green-50 text-xs"
                            onClick={() => handlePayClick(sale)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Pay
                          </Button>
                        ) : sale.status === 'COMPLETED' && sale.utangPaidAt ? (
                          <span className="text-xs text-muted-foreground">
                            Paid by {sale.utangPaidByUser?.displayName || 'Unknown'}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!open) { setConfirmOpen(false); setPayingId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Utang as Paid</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this utang as paid?
            </DialogDescription>
          </DialogHeader>
          {selectedSale && (
            <div className="py-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{selectedSale.customerName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction</span>
                <span className="font-mono text-xs">{selectedSale.transactionNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-lg">{formatCurrency(selectedSale.total)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setPayingId(null); }} disabled={paying}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPay} disabled={paying} className="bg-green-600 hover:bg-green-700">
              {paying ? 'Processing...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Invoice Dialog */}
      <Dialog open={invoiceOpen} onOpenChange={(open) => { if (!open) { setInvoiceOpen(false); setInvoiceData(null); } }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          {invoiceLoading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : invoiceData ? (
            <div id="utang-invoice" className="bg-white text-black">
              {/* Invoice Header */}
              <div className="bg-primary text-primary-foreground p-4 text-center">
                <h3 className="text-lg font-bold">{invoiceData.storeInfo.storeName || 'Sari-Sari Store'}</h3>
                {invoiceData.storeInfo.storeAddress && <p className="text-xs opacity-90">{invoiceData.storeInfo.storeAddress}</p>}
                {invoiceData.storeInfo.storeContact && <p className="text-xs opacity-90">{invoiceData.storeInfo.storeContact}</p>}
              </div>

              <div className="p-4 space-y-3">
                {/* Title */}
                <div className="text-center">
                  <h4 className="text-base font-bold uppercase tracking-wide">Utang Invoice</h4>
                  <p className="text-xs text-gray-500">Credit Statement of Account</p>
                </div>

                <Separator />

                {/* Customer & Date Info */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Customer</p>
                    <p className="font-semibold text-sm">{invoiceData.sale.customerName || 'Walk-in'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500">Date</p>
                    <p className="font-medium">{formatDate(invoiceData.sale.date)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Invoice #</p>
                    <p className="font-mono font-medium text-xs">{invoiceData.sale.transactionNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500">Status</p>
                    <Badge variant={invoiceData.sale.status === 'CREDIT' ? 'destructive' : 'secondary'} className="text-xs">
                      {invoiceData.sale.status === 'CREDIT' ? 'PENDING' : 'PAID'}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Items Table */}
                <div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-300">
                        <th className="text-left py-1.5 font-semibold">Item</th>
                        <th className="text-center py-1.5 font-semibold w-10">Qty</th>
                        <th className="text-right py-1.5 font-semibold w-16">Price</th>
                        <th className="text-right py-1.5 font-semibold w-16">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceData.sale.items.map((item, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-1.5">{item.productName}</td>
                          <td className="text-center py-1.5">{item.quantity}</td>
                          <td className="text-right py-1.5">{formatCurrency(item.unitPrice)}</td>
                          <td className="text-right py-1.5 font-medium">{formatCurrency(item.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span>{formatCurrency(invoiceData.sale.subtotal)}</span>
                  </div>
                  {invoiceData.sale.discount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(invoiceData.sale.discount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>Total Amount Due</span>
                    <span className={invoiceData.sale.status === 'CREDIT' ? 'text-red-600' : 'text-green-600'}>
                      {formatCurrency(invoiceData.sale.total)}
                    </span>
                  </div>
                </div>

                {invoiceData.sale.status === 'CREDIT' && (
                  <div className="bg-red-50 border border-red-200 rounded p-2 text-center">
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Status: Unpaid</p>
                    <p className="text-xs text-red-500 mt-0.5">Please settle this amount at your earliest convenience.</p>
                  </div>
                )}

                {invoiceData.sale.status === 'COMPLETED' && invoiceData.sale.utangPaidAt && (
                  <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wider">Paid in Full</p>
                    <p className="text-xs text-green-500 mt-0.5">
                      Paid by {invoiceData.sale.utangPaidByUser?.displayName || 'Unknown'} on {formatDate(invoiceData.sale.utangPaidAt)}
                    </p>
                  </div>
                )}

                <p className="text-center text-[10px] text-gray-400 pt-1">
                  Cashier: {invoiceData.sale.cashier?.displayName || 'Unknown'}
                </p>
              </div>
            </div>
          ) : null}
          <div className="border-t p-3 flex justify-end gap-2 bg-background">
            <Button variant="outline" size="sm" onClick={() => { setInvoiceOpen(false); setInvoiceData(null); }}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
