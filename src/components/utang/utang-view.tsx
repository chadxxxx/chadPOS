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

interface CustomerInvoiceTransaction {
  id: string;
  transactionNumber: string;
  date: string;
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    date: string;
  }[];
  utangPaidAt: string | null;
  utangPaidByUser: { id: string; displayName: string } | null;
}

interface CustomerInvoiceData {
  customerName: string;
  transactions: CustomerInvoiceTransaction[];
  grandTotal: number;
  totalItems: number;
  transactionCount: number;
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

  // Customer invoice state
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<CustomerInvoiceData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceCustomer, setInvoiceCustomer] = useState('');

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

  const handleCustomerInvoice = async (customerName: string) => {
    setInvoiceCustomer(customerName);
    setInvoiceLoading(true);
    setInvoiceOpen(true);
    setInvoiceData(null);
    const res = await apiFetch(`/api/utang/customer-invoice?customerName=${encodeURIComponent(customerName)}&status=pending`);
    setInvoiceLoading(false);
    if (res.error) { toast.error(res.error); setInvoiceOpen(false); return; }
    setInvoiceData(res.data as CustomerInvoiceData);
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
                          onClick={() => sale.customerName && handleCustomerInvoice(sale.customerName)}
                          disabled={!sale.customerName}
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

      {/* Customer Invoice Dialog */}
      <Dialog open={invoiceOpen} onOpenChange={(open) => { if (!open) { setInvoiceOpen(false); setInvoiceData(null); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
          {invoiceLoading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : invoiceData ? (
            <div id="utang-invoice" className="bg-white text-black">
              {/* Invoice Header */}
              <div className="bg-gray-900 text-white p-4 text-center">
                <h3 className="text-lg font-bold">{invoiceData.storeInfo.storeName || 'Sari-Sari Store'}</h3>
                {invoiceData.storeInfo.storeAddress && <p className="text-xs opacity-90">{invoiceData.storeInfo.storeAddress}</p>}
                {invoiceData.storeInfo.storeContact && <p className="text-xs opacity-90">{invoiceData.storeInfo.storeContact}</p>}
              </div>

              <div className="p-4 space-y-3">
                {/* Title */}
                <div className="text-center">
                  <h4 className="text-base font-bold uppercase tracking-wide">Utang Invoice</h4>
                  <p className="text-xs text-gray-500">Statement of Account</p>
                </div>

                <Separator />

                {/* Customer Info */}
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-gray-500">Customer Name: </span>
                    <span className="font-bold text-sm">{invoiceData.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Transactions: </span>
                    <span className="font-medium">{invoiceData.transactionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Items: </span>
                    <span className="font-medium">{invoiceData.totalItems}</span>
                  </div>
                </div>

                <Separator />

                {/* Transactions with Items */}
                <div className="space-y-3">
                  {invoiceData.transactions.map((txn, txnIdx) => (
                    <div key={txn.id} className="border border-gray-200 rounded overflow-hidden">
                      {/* Transaction header */}
                      <div className="bg-gray-50 px-2.5 py-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-medium text-gray-600">#{txnIdx + 1}</span>
                          <span className="font-mono text-[10px] text-gray-500">{txn.transactionNumber}</span>
                        </div>
                        <span className="text-[10px] text-gray-500">{formatDate(txn.date)}</span>
                      </div>

                      {/* Items */}
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left px-2.5 py-1 font-semibold text-gray-600">Item</th>
                            <th className="text-center px-1 py-1 font-semibold text-gray-600 w-9">Qty</th>
                            <th className="text-right px-1 py-1 font-semibold text-gray-600 w-14">Price</th>
                            <th className="text-right px-2.5 py-1 font-semibold text-gray-600 w-14">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {txn.items.map((item, i) => (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="px-2.5 py-1">
                                <div>{item.productName}</div>
                                <div className="text-[9px] text-gray-400">{formatDate(item.date)}</div>
                              </td>
                              <td className="text-center px-1 py-1">{item.quantity}</td>
                              <td className="text-right px-1 py-1">{formatCurrency(item.unitPrice)}</td>
                              <td className="text-right px-2.5 py-1 font-medium">{formatCurrency(item.totalPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Transaction subtotal */}
                      <div className="px-2.5 py-1.5 bg-gray-50 flex justify-between text-xs font-medium">
                        <span className="text-gray-500">Transaction Total</span>
                        <span className={txn.status === 'CREDIT' ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(txn.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Grand Total */}
                <div className="bg-red-50 border border-red-200 rounded p-3 space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Grand Total ({invoiceData.transactionCount} transaction{invoiceData.transactionCount > 1 ? 's' : ''})</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold">Total Amount Due</span>
                    <span className="text-lg font-bold text-red-600">{formatCurrency(invoiceData.grandTotal)}</span>
                  </div>
                  <p className="text-[10px] text-red-500 text-center pt-0.5">
                    Please settle this amount at your earliest convenience.
                  </p>
                </div>

                <p className="text-center text-[9px] text-gray-400">
                  Generated on {formatDate(new Date().toISOString())}
                </p>
              </div>
            </div>
          ) : null}
          <div className="border-t p-3 flex justify-end gap-2 bg-white">
            <Button variant="outline" size="sm" onClick={() => { setInvoiceOpen(false); setInvoiceData(null); }}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
