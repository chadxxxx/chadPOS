'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, formatCurrency } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Download } from 'lucide-react';

export function ReportsView() {
  const [period, setPeriod] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    let url = `/api/reports?type=${period}`;
    if (period === 'custom' && customFrom && customTo) {
      url = `/api/reports?dateFrom=${customFrom}&dateTo=${customTo}`;
    }
    const res = await apiFetch(url);
    if (res.data) setReport(res.data);
    setLoading(false);
  }, [period, customFrom, customTo]);

  useEffect(() => { let c = false; fetchReport().then(() => { if (!c) return; }); return () => { c = true; }; }, [fetchReport]);

  const downloadExport = (type: string) => {
    let url = `/api/reports/export?type=${type}`;
    if (period === 'custom' && customFrom && customTo) url += `&dateFrom=${customFrom}&dateTo=${customTo}`;
    else if (report?.period?.start) url += `&dateFrom=${report.period.start.split('T')[0]}&dateTo=${report.period.end.split('T')[0]}`;
    window.open(url, '_blank');
  };

  return (
    <div className='space-y-4'>
      <h2 className='text-lg font-semibold'>Reports</h2>

      <div className='flex flex-col sm:flex-row gap-2'>
        <div className='flex gap-1 flex-wrap'>
          {['today', 'yesterday', 'week', 'month'].map((p) => (
            <Button key={p} size='sm' variant={period === p ? 'default' : 'outline'} onClick={() => setPeriod(p)}>
              {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'week' ? 'This Week' : 'This Month'}
            </Button>
          ))}
          <Button size='sm' variant={period === 'custom' ? 'default' : 'outline'} onClick={() => setPeriod('custom')}>Custom</Button>
        </div>
      </div>

      {period === 'custom' && (
        <div className='flex gap-2'>
          <div className='space-y-1'><Label>From</Label><Input type='date' value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></div>
          <div className='space-y-1'><Label>To</Label><Input type='date' value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></div>
          <div className='flex items-end'><Button onClick={fetchReport} disabled={!customFrom || !customTo}>Apply</Button></div>
        </div>
      )}

      {loading ? <div className='grid grid-cols-2 md:grid-cols-3 gap-3'><Skeleton className='h-24' /><Skeleton className='h-24' /><Skeleton className='h-24' /></div> : report && (
        <>
          <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
            <Card><CardContent className='p-4'><p className='text-sm text-muted-foreground'>Total Revenue</p><p className='text-2xl font-semibold'>{formatCurrency(report.summary?.totalRevenue || 0)}</p></CardContent></Card>
            <Card><CardContent className='p-4'><p className='text-sm text-muted-foreground'>Cost of Goods</p><p className='text-2xl font-semibold'>{formatCurrency(report.summary?.totalCost || 0)}</p></CardContent></Card>
            <Card className='col-span-2 md:col-span-1'><CardContent className='p-4'><p className='text-sm text-muted-foreground'>Gross Profit</p><p className={`text-2xl font-semibold ${(report.summary?.totalProfit || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(report.summary?.totalProfit || 0)}</p></CardContent></Card>
            <Card><CardContent className='p-4'><p className='text-sm text-muted-foreground'>Profit Margin</p><p className='text-2xl font-semibold'>{(report.summary?.profitMargin || 0).toFixed(1)}%</p></CardContent></Card>
            <Card><CardContent className='p-4'><p className='text-sm text-muted-foreground'>Transactions</p><p className='text-2xl font-semibold'>{report.summary?.totalTransactions || 0}</p></CardContent></Card>
            <Card><CardContent className='p-4'><p className='text-sm text-muted-foreground'>Avg Transaction</p><p className='text-2xl font-semibold'>{formatCurrency(report.summary?.avgTransaction || 0)}</p></CardContent></Card>
          </div>

          <Tabs defaultValue='products'>
            <TabsList><TabsTrigger value='products'>Product Sales</TabsTrigger><TabsTrigger value='payments'>Payment Methods</TabsTrigger><TabsTrigger value='export'>Export Data</TabsTrigger></TabsList>

            <TabsContent value='products' className='mt-3'>
              <div className='border rounded-md overflow-x-auto'>
                <Table>
                  <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className='text-right'>Qty Sold</TableHead><TableHead className='text-right'>Revenue</TableHead><TableHead className='text-right'>Cost</TableHead><TableHead className='text-right'>Profit</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(!report.productSales || report.productSales.length === 0) ? <TableRow><TableCell colSpan={5} className='text-center py-8 text-muted-foreground'>No sales data.</TableCell></TableRow> : report.productSales.map((p: any, i: number) => (
                      <TableRow key={i}><TableCell className='font-medium'>{p.name}</TableCell><TableCell className='text-right font-mono'>{p.quantitySold}</TableCell><TableCell className='text-right font-mono'>{formatCurrency(p.revenue)}</TableCell><TableCell className='text-right font-mono'>{formatCurrency(p.cost)}</TableCell><TableCell className={`text-right font-mono ${p.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(p.profit)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value='payments' className='mt-3'>
              <div className='border rounded-md'>
                <Table>
                  <TableHeader><TableRow><TableHead>Method</TableHead><TableHead className='text-right'>Count</TableHead><TableHead className='text-right'>Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(report.paymentMethods || []).map((pm: any, i: number) => (
                      <TableRow key={i}><TableCell>{pm.method}</TableCell><TableCell className='text-right font-mono'>{pm.count}</TableCell><TableCell className='text-right font-mono'>{formatCurrency(pm.amount)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value='export' className='mt-3'>
              <div className='grid grid-cols-2 gap-3'>
                {['sales', 'products', 'inventory', 'expenses'].map((type) => (
                  <Button key={type} variant='outline' className='h-auto py-4 flex flex-col gap-1' onClick={() => downloadExport(type)}>
                    <Download className='h-5 w-5' />
                    <span className='text-sm font-medium capitalize'>{type} Export</span>
                    <span className='text-xs text-muted-foreground'>CSV format</span>
                  </Button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}