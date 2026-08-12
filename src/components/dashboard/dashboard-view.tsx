'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { formatCurrency, formatDateShort } from '@/lib/api';
import { useNavStore } from '@/store/nav-store';
import { useAuthStore } from '@/store/auth-store';
import { TrendingUp, DollarSign, AlertTriangle, XCircle, HandCoins } from 'lucide-react';

interface TodayReport {
  summary: {
    totalRevenue: number;
    totalProfit: number;
    totalTransactions: number;
    avgTransaction: number;
    totalCost: number;
  };
  productSales: { name: string; quantitySold: number; revenue: number }[];
}

interface Transaction {
  id: string;
  transactionNumber: string;
  date: string;
  total: number;
  status: string;
  paymentMethod: string;
  cashier: { displayName: string } | null;
}

interface UtangSummary {
  pendingTotal: number;
  collectedToday: number;
  uniquePendingCustomers: number;
}

export function DashboardView() {
  const [report, setReport] = useState<TodayReport | null>(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outStockCount, setOutStockCount] = useState(0);
  const [recentSales, setRecentSales] = useState<Transaction[]>([]);
  const [utangSummary, setUtangSummary] = useState<UtangSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const setView = useNavStore((s) => s.setView);
  const user = useAuthStore((s) => s.user);
  const canViewUtang = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const promises: Promise<any>[] = [
        apiFetch<TodayReport>('/api/reports?type=today'),
        apiFetch<{ total: number }>('/api/products?stockStatus=low&limit=0'),
        apiFetch<{ total: number }>('/api/products?stockStatus=out&limit=0'),
        apiFetch<{ data: Transaction[] }>('/api/sales?limit=5'),
      ];
      if (canViewUtang) {
        promises.push(apiFetch<UtangSummary>('/api/utang?limit=0'));
      }
      const results = await Promise.all(promises);

      if (results[0].data) setReport(results[0].data);
      if (results[1].data) setLowStockCount(results[1].data.total);
      if (results[2].data) setOutStockCount(results[2].data.total);
      if (results[3].data) setRecentSales(results[3].data.data);
      if (results[4]?.data) {
        const d = results[4].data as any;
        setUtangSummary(d.summary || null);
      }
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [canViewUtang]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-4">
            <Skeleton className="h-4 w-40 mb-4" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full mb-2" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-destructive mb-3">{error}</p>
            <button
              onClick={fetchData}
              className="text-sm text-primary hover:underline"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const topProducts = (report?.productSales || []).slice(0, 5);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Dashboard</h2>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Today&apos;s Sales</p>
                <p className="text-lg font-semibold">{formatCurrency(report?.summary.totalRevenue || 0)}</p>
                <p className="text-xs text-muted-foreground">{report?.summary.totalTransactions || 0} transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estimated Profit</p>
                <p className="text-lg font-semibold">{formatCurrency(report?.summary.totalProfit || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:ring-2 hover:ring-amber-400 transition-shadow"
          onClick={() => setView('products')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Low Stock Items</p>
                <p className="text-lg font-semibold">{lowStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:ring-2 hover:ring-red-400 transition-shadow"
          onClick={() => setView('products')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/30">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Out of Stock</p>
                <p className="text-lg font-semibold">{outStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Utang summary row - only for admin/owner */}
      {canViewUtang && utangSummary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card
            className="cursor-pointer hover:ring-2 hover:ring-red-400 transition-shadow"
            onClick={() => setView('utang')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/30">
                  <HandCoins className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending Utang</p>
                  <p className="text-lg font-semibold text-red-600">{formatCurrency(utangSummary.pendingTotal)}</p>
                  <p className="text-xs text-muted-foreground">{utangSummary.uniquePendingCustomers} customer{utangSummary.uniquePendingCustomers !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:ring-2 hover:ring-green-400 transition-shadow"
            onClick={() => setView('utang')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950/30">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Utang Collected Today</p>
                  <p className="text-lg font-semibold text-green-600">{formatCurrency(utangSummary.collectedToday)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-dashed">
            <CardContent className="p-4 flex items-center justify-center">
              <button
                onClick={() => setView('utang')}
                className="text-sm text-primary hover:underline flex items-center gap-1.5"
              >
                <HandCoins className="h-4 w-4" />
                View All Utang Transactions
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Transactions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentSales.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No transactions today.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Txn #</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="text-xs">Cashier</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="text-xs font-mono">{txn.transactionNumber}</TableCell>
                      <TableCell className="text-xs">{formatDateShort(txn.date)}</TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(txn.total)}</TableCell>
                      <TableCell className="text-xs">{txn.cashier?.displayName || '-'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={txn.paymentMethod === 'UTANG' ? 'destructive' : txn.status === 'COMPLETED' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {txn.paymentMethod === 'UTANG' ? '☕ Utang' : txn.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top Selling Products */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Top Selling Products Today</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topProducts.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No sales data yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Product</TableHead>
                    <TableHead className="text-xs text-right">Qty</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{p.name}</TableCell>
                      <TableCell className="text-xs text-right">{p.quantitySold}</TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(p.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
