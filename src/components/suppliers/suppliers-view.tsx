'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, formatDate } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Archive } from 'lucide-react';
import { toast } from 'sonner';

export function SuppliersView() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    let url = `/api/suppliers?page=${page}&limit=20`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const res = await apiFetch(url);
    if (res.data) { const d = res.data as any; setSuppliers(d.data || []); setTotal(d.total || 0); }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const openCreate = () => { setEditItem(null); setName(''); setContactPerson(''); setPhone(''); setAddress(''); setNotes(''); setFormOpen(true); };
  const openEdit = (s: any) => { setEditItem(s); setName(s.name); setContactPerson(s.contactPerson || ''); setPhone(s.phone || ''); setAddress(s.address || ''); setNotes(s.notes || ''); setFormOpen(true); };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    const body = { name: name.trim(), contactPerson: contactPerson.trim() || null, phone: phone.trim() || null, address: address.trim() || null, notes: notes.trim() || null };
    const res = editItem
      ? await apiFetch(`/api/suppliers/${editItem.id}`, { method: 'PUT', body: JSON.stringify(body) })
      : await apiFetch('/api/suppliers', { method: 'POST', body: JSON.stringify(body) });
    setSubmitting(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(editItem ? 'Supplier updated.' : 'Supplier created.');
    setFormOpen(false); fetchSuppliers();
  };

  const handleArchive = async (s: any) => {
    const res = await apiFetch(`/api/suppliers/${s.id}`, { method: 'DELETE' });
    if (res.error) { toast.error(res.error); return; }
    toast.success('Supplier archived.'); fetchSuppliers();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">Suppliers</h2>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Supplier</Button>
      </div>

      <div className="relative"><Input placeholder="Search suppliers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>

      {loading ? <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="hidden sm:table-cell">Contact</TableHead><TableHead className="hidden md:table-cell">Phone</TableHead><TableHead>Status</TableHead><TableHead className="hidden md:table-cell">Created</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {suppliers.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No suppliers found.</TableCell></TableRow> : suppliers.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">{s.contactPerson || '-'}</TableCell>
                  <TableCell className="hidden md:table-cell">{s.phone || '-'}</TableCell>
                  <TableCell><Badge variant={s.status === 'ACTIVE' ? 'secondary' : 'destructive'}>{s.status}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                      {s.status === 'ACTIVE' && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleArchive(s)}><Archive className="h-3.5 w-3.5" /></Button>}
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
        <DialogContent><DialogHeader><DialogTitle>{editItem ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Contact Person</Label><Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} /></div>
          <div className="space-y-1"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="space-y-1"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div className="space-y-1"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}