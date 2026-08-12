'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, formatDate } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, KeyRound, Ban, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export function UsersView() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdUserId, setPwdUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [formUsername, setFormUsername] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('CASHIER');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/api/users');
    if (res.data) setUsers((res.data as any).data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => {
    setEditUser(null);
    setFormUsername(''); setFormDisplayName(''); setFormPassword(''); setFormRole('CASHIER');
    setFormOpen(true);
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setFormUsername(u.username); setFormDisplayName(u.displayName); setFormPassword(''); setFormRole(u.role);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formUsername.trim() || !formDisplayName.trim()) return;
    if (!editUser && !formPassword) { toast.error('Password is required for new users.'); return; }
    setSubmitting(true);
    let res;
    if (editUser) {
      res = await apiFetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ username: formUsername.trim(), displayName: formDisplayName.trim(), role: formRole }),
      });
    } else {
      res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ username: formUsername.trim(), displayName: formDisplayName.trim(), password: formPassword, role: formRole }),
      });
    }
    setSubmitting(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(editUser ? 'User updated.' : 'User created.');
    setFormOpen(false); fetchUsers();
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    setSubmitting(true);
    const res = await apiFetch(`/api/users/${pwdUserId}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) });
    setSubmitting(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Password reset.');
    setPwdOpen(false); setNewPassword('');
  };

  const handleToggleStatus = async (u: any) => {
    setSubmitting(true);
    const res = await apiFetch(`/api/users/${u.id}/toggle-status`, { method: 'POST' });
    setSubmitting(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(`User ${u.status === 'ACTIVE' ? 'disabled' : 'activated'}.`);
    fetchUsers();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Users & Permissions</h2>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Create User</Button>
      </div>

      {loading ? <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : (
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Username</TableHead><TableHead>Display Name</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="hidden sm:table-cell">Last Login</TableHead><TableHead className="hidden md:table-cell">Created</TableHead><TableHead className="w-40">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {users.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No users found.</TableCell></TableRow> : users.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell>{u.displayName}</TableCell>
                  <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                  <TableCell><Badge variant={u.status === 'ACTIVE' ? 'secondary' : 'destructive'}>{u.status}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{u.lastLogin ? formatDate(u.lastLogin) : 'Never'}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(u)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setPwdUserId(u.id); setNewPassword(''); setPwdOpen(true); }} title="Reset Password"><KeyRound className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleToggleStatus(u)} title={u.status === 'ACTIVE' ? 'Disable' : 'Enable'}>
                        {u.status === 'ACTIVE' ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit User Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editUser ? 'Edit User' : 'Create User'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Username</Label><Input value={formUsername} onChange={(e) => setFormUsername(e.target.value)} /></div>
          <div className="space-y-1"><Label>Display Name</Label><Input value={formDisplayName} onChange={(e) => setFormDisplayName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Password{editUser ? ' (leave blank to keep current)' : ''}</Label><Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder={editUser ? 'Leave blank to keep current' : 'Min 8 characters'} /></div>
          <div className="space-y-1"><Label>Role</Label><Select value={formRole} onValueChange={setFormRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OWNER">Owner</SelectItem><SelectItem value="ADMIN">Admin</SelectItem><SelectItem value="CASHIER">Cashier</SelectItem></SelectContent></Select></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent><DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
        <div className="space-y-3"><div className="space-y-1"><Label>New Password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" /></div></div>
        <DialogFooter><Button variant="outline" onClick={() => setPwdOpen(false)}>Cancel</Button><Button onClick={handleResetPassword} disabled={submitting || newPassword.length < 8}>{submitting ? 'Resetting...' : 'Reset Password'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}