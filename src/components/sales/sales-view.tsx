'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, formatCurrency, formatDate } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Eye } from 'lucide-react';
import { TransactionDetailDialog } from './transaction-detail-dialog';

export function SalesView() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const [sales, setSales] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    let url = `/api/sales?page=${page}&limit=20`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (statusFilter) url += `&status=${statusFilter}`;
    if (paymentFilter) url += `&paymentMethod=${paymentFilter}`;
    if (dateFrom) url += `&dateFrom=${dateFrom}`;
    if (dateTo) url += `&dateTo=${dateTo}`;
    const res = await apiFetch(url);
    if (res.data) {
      const d = res.data as any;
      setSales(d.data || []);
      setTotal(d.total || 0);
    }
    setLoading(false);
  }, [page, search, statusFilter, paymentFilter, dateFrom, dateTo]);

  useEffect(() => { let cancelled = false; (async () => { setLoading(true); let url = `/api/sales?page=${page}&limit=20`; if (search) url += `&search=${encodeURIComponent(search)}`; if (statusFilter) url += `&status=${statusFilter}`; if (paymentFilter) url += `&paymentMethod=${paymentFilter}`; if (dateFrom) url += `&dateFrom=${dateFrom}`; if (dateTo) url += `&dateTo=${dateTo}`; const res = await apiFetch(url); if (cancelled) return; if (res.data) { const d = res.data as any; setSales(d.data || []); setTotal(d.total || 0); } setLoading(false); })(); return () => { cancelled = true; }; }, [page, search, statusFilter, paymentFilter, dateFrom, dateTo]);

  const handleViewDetail = (sale: any) => {
    setSelectedSale(sale);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Sales History</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Transactions</p><p className="text-2xl font-semibold">{total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Page Total</p><p className="text-2xl font-semibold">{formatCurrency(sales.reduce((s: number, x: any) => s + (x.status === 'COMPLETED' ? x.total : 0), 0))}</p></CardContent></Card>
        <Card className="col-span-2 md:col-span-1"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Voided</p><p className="text-2xl font-semibold">{sales.filter((s: any) => s.status === 'VOIDED').length}</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search transaction #..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" /></div>
        <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-full sm:w-auto" />
        <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-full sm:w-auto" />
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}><SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem><SelectItem value="VOIDED">Voided</SelectItem></SelectContent></Select>
        <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v === 'all' ? '' : v); setPage(1); }}><SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Payment" /></SelectTrigger><SelectContent><SelectItem value="all">All Methods</SelectItem><SelectItem value="CASH">Cash</SelectItem><SelectItem value="GCash">GCash</SelectItem></SelectContent></Select>
      </div>

      {loading ? <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Transaction #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Payment</TableHead><TableHead>Cashier</TableHead><TableHead>Status</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
            <TableBody>
              {sales.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No transactions found.</TableCell></TableRow> : sales.map((s: any) => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewDetail(s)}>
                  <TableCell className="font-mono text-sm">{s.transactionNumber}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatDate(s.date)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(s.total)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{s.paymentMethod}</Badge></TableCell>
                  <TableCell className="text-sm">{s.cashier?.displayName || '-'}</TableCell>
                  <TableCell><Badge variant={s.status === 'COMPLETED' ? 'secondary' : 'destructive'}>{s.status}</Badge></TableCell>
                  <TableCell><Button size="icon" variant="ghost" className="h-8 w-8"><Eye className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>Page {page} of {Math.max(1, Math.ceil(total / 20))}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>

      <TransactionDetailDialog sale={selectedSale} open={detailOpen} onClose={() => { setDetailOpen(false); setSelectedSale(null); fetchSales(); }} isAdmin={isAdmin} />
    </div>
  );
}