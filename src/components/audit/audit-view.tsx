'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, formatDate } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export function AuditView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let url = `/api/audit?page=${page}&limit=25`;
    if (actionFilter) url += `&action=${actionFilter}`;
    if (dateFrom) url += `&dateFrom=${dateFrom}`;
    if (dateTo) url += `&dateTo=${dateTo}`;
    const res = await apiFetch(url);
    if (res.data) { const d = res.data as any; setLogs(d.data || []); setTotal(d.total || 0); }
    setLoading(false);
  }, [page, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let url = `/api/audit?page=${page}&limit=25`;
      if (actionFilter) url += `&action=${actionFilter}`;
      if (dateFrom) url += `&dateFrom=${dateFrom}`;
      if (dateTo) url += `&dateTo=${dateTo}`;
      const res = await apiFetch(url);
      if (cancelled) return;
      if (res.data) { const d = res.data as any; setLogs(d.data || []); setTotal(d.total || 0); }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [page, actionFilter, dateFrom, dateTo]);

  const ACTIONS = ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'OWNER_SETUP', 'USER_CREATED', 'PASSWORD_RESET', 'ROLE_CHANGED', 'USER_DISABLED', 'USER_ENABLED', 'SALE_COMPLETED', 'TRANSACTION_VOIDED', 'RETURN_PROCESSED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_ARCHIVED', 'PRICE_CHANGED', 'INVENTORY_ADJUSTED', 'STOCK_COUNT', 'SETTINGS_CHANGED', 'RECOVERY_CODES_GENERATED', 'RECOVERY_CODE_USED'];

  return (
    <div className='space-y-4'>
      <h2 className='text-lg font-semibold'>Audit Log</h2>
      <div className='flex flex-col sm:flex-row gap-2'>
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === 'all' ? '' : v); setPage(1); }}><SelectTrigger className='w-full sm:w-56'><SelectValue placeholder='All Actions' /></SelectTrigger><SelectContent><SelectItem value='all'>All Actions</SelectItem>{ACTIONS.map((a) => <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select>
        <Input type='date' value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className='w-full sm:w-auto' />
        <Input type='date' value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className='w-full sm:w-auto' />
      </div>
      {loading ? <div className='space-y-2'><Skeleton className='h-10 w-full' /><Skeleton className='h-10 w-full' /><Skeleton className='h-10 w-full' /></div> : (
        <div className='border rounded-md overflow-x-auto'>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead className='hidden md:table-cell'>Record</TableHead><TableHead className='hidden lg:table-cell'>Details</TableHead></TableRow></TableHeader>
            <TableBody>
              {logs.length === 0 ? <TableRow><TableCell colSpan={5} className='text-center py-8 text-muted-foreground'>No audit logs found.</TableCell></TableRow> : logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className='text-xs whitespace-nowrap'>{formatDate(log.createdAt)}</TableCell>
                  <TableCell className='text-sm'>{log.username || '-'}</TableCell>
                  <TableCell><span className='text-xs bg-muted px-2 py-0.5 rounded font-mono'>{log.action}</span></TableCell>
                  <TableCell className='hidden md:table-cell text-xs text-muted-foreground'>{log.recordType ? `${log.recordType}${log.recordId ? ': ' + log.recordId.slice(0, 8) + '...' : ''}` : '-'}</TableCell>
                  <TableCell className='hidden lg:table-cell text-xs text-muted-foreground max-w-48 truncate'>{log.newValue || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <div className='flex justify-between items-center text-sm text-muted-foreground'>
        <span>Page {page} of {Math.max(1, Math.ceil(total / 25))}</span>
        <div className='flex gap-2'>
          <Button size='sm' variant='outline' disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button size='sm' variant='outline' disabled={page >= Math.ceil(total / 25)} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}