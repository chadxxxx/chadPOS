'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, formatCurrency, formatDate } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['Electricity', 'Water', 'Rent', 'Transportation', 'Supplies', 'Miscellaneous', 'Other'];

export function ExpensesView() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    let url = `/api/expenses?page=${page}&limit=20`;
    if (catFilter) url += `&category=${catFilter}`;
    if (dateFrom) url += `&dateFrom=${dateFrom}`;
    if (dateTo) url += `&dateTo=${dateTo}`;
    const res = await apiFetch(url);
    if (res.data) { const d = res.data as any; setExpenses(d.data || []); setTotal(d.total || 0); }
    setLoading(false);
  }, [page, catFilter, dateFrom, dateTo]);

  useEffect(() => { let c = false; fetchExpenses().then(() => { if (!c) return; }); return () => { c = true; }; }, [fetchExpenses]);

  const openCreate = () => {
    setEditItem(null); setDesc(''); setCategory(''); setAmount(''); setDate(new Date().toISOString().split('T')[0]); setNotes('');
    setFormOpen(true);
  };

  const openEdit = (e: any) => {
    setEditItem(e); setDesc(e.description); setCategory(e.category); setAmount(String(e.amount)); setDate(e.date.split('T')[0]); setNotes(e.notes || '');
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!desc.trim() || !category || !amount) return;
    setSubmitting(true);
    const body = { description: desc.trim(), category, amount: parseFloat(amount), date: new Date(date).toISOString(), notes: notes.trim() || null };
    const res = editItem
      ? await apiFetch(`/api/expenses/${editItem.id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await apiFetch('/api/expenses', { method: 'POST', body: JSON.stringify(body) });
    setSubmitting(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(editItem ? 'Expense updated.' : 'Expense recorded.');
    setFormOpen(false); fetchExpenses();
  };

  const handleDelete = async (e: any) => {
    if (!confirm('Delete this expense?')) return;
    const res = await apiFetch(`/api/expenses/${e.id}`, { method: 'DELETE' });
    if (res.error) { toast.error(res.error); return; }
    toast.success('Expense deleted.'); fetchExpenses();
  };

  const totalAmount = expenses.reduce((s: number, e: any) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Expenses</h2>
          <p className="text-sm text-muted-foreground">Page total: {formatCurrency(totalAmount)}</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Record Expense</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={catFilter} onValueChange={(v) => { setCatFilter(v === 'all' ? '' : v); setPage(1); }}><SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-full sm:w-auto" />
        <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-full sm:w-auto" />
      </div>

      {loading ? <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="hidden sm:table-cell">Recorded By</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {expenses.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No expenses found.</TableCell></TableRow> : expenses.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm whitespace-nowrap">{formatDate(e.date)}</TableCell>
                  <TableCell className="font-medium">{e.description}</TableCell>
                  <TableCell><span className="text-xs bg-muted px-2 py-0.5 rounded">{e.category}</span></TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(e.amount)}</TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{e.user?.displayName || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(e)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editItem ? 'Edit Expense' : 'Record Expense'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div className="space-y-1"><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Amount</Label><Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}