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
import { Search, Banknote, Users, CheckCircle2 } from 'lucide-react';
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
                      {sale.status === 'CREDIT' && canPay ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-300 hover:bg-green-50"
                          onClick={() => handlePayClick(sale)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Mark Paid
                        </Button>
                      ) : sale.status === 'COMPLETED' && sale.utangPaidAt ? (
                        <span className="text-xs text-muted-foreground">
                          Paid by {sale.utangPaidByUser?.displayName || 'Unknown'}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
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
    </div>
  );
}
