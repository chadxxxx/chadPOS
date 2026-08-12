'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, RotateCcw, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsView() {
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeContact, setStoreContact] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [newMethod, setNewMethod] = useState('');

  // Recovery
  const [recoveryInfo, setRecoveryInfo] = useState<any>(null);
  const [codesDialog, setCodesDialog] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/api/settings');
    if (res.data) {
      const s = res.data as any;
      setSettings(s);
      setStoreName(s.storeName || '');
      setStoreAddress(s.storeAddress || '');
      setStoreContact(s.storeContact || '');
      setReceiptFooter(s.receiptFooter || '');
    }
    setLoading(false);
  }, []);

  const fetchPaymentMethods = useCallback(async () => {
    const res = await apiFetch('/api/settings?section=paymentMethods');
    if (res.data) setPaymentMethods(Array.isArray(res.data) ? res.data : []);
  }, []);

  const fetchRecoveryInfo = useCallback(async () => {
    const res = await apiFetch('/api/recovery');
    if (res.data) setRecoveryInfo(res.data);
  }, []);

  useEffect(() => { fetchSettings(); fetchPaymentMethods(); fetchRecoveryInfo(); }, [fetchSettings, fetchPaymentMethods, fetchRecoveryInfo]);

  const handleSaveGeneral = async () => {
    setSubmitting(true);
    const newSettings = [
      { key: 'storeName', value: storeName },
      { key: 'storeAddress', value: storeAddress },
      { key: 'storeContact', value: storeContact },
      { key: 'receiptFooter', value: receiptFooter },
    ];
    const res = await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ settings: newSettings }) });
    setSubmitting(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Settings saved.');
  };

  const handleAddPayment = async () => {
    if (!newMethod.trim()) return;
    const res = await apiFetch('/api/settings?section=paymentMethods', { method: 'POST', body: JSON.stringify({ name: newMethod.trim() }) });
    if (res.error) { toast.error(res.error); return; }
    setNewMethod(''); fetchPaymentMethods(); toast.success('Payment method added.');
  };

  const handleTogglePayment = async (pm: any) => {
    const res = await apiFetch('/api/settings?section=paymentMethods', { method: 'PUT', body: JSON.stringify({ id: pm.id, isActive: !pm.isActive }) });
    if (res.error) { toast.error(res.error); return; }
    fetchPaymentMethods();
  };

  const handleGenerateCodes = async () => {
    const res = await apiFetch('/api/recovery', { method: 'POST' });
    if (res.error) { toast.error(res.error); return; }
    setRecoveryCodes((res.data as any).codes || []);
    setCodesDialog(true);
  };

  const downloadExport = (type: string) => { window.open(`/api/reports/export?type=${type}`, '_blank'); };

  if (loading) return <div className='space-y-2'><Skeleton className='h-10 w-full' /><Skeleton className='h-10 w-full' /></div>;

  return (
    <div className='space-y-4'>
      <h2 className='text-lg font-semibold'>Settings</h2>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value='general'>General</TabsTrigger><TabsTrigger value='payments'>Payment Methods</TabsTrigger><TabsTrigger value='recovery'>Account Recovery</TabsTrigger><TabsTrigger value='data'>Data Export</TabsTrigger></TabsList>

        <TabsContent value='general' className='space-y-4 mt-3'>
          <div className='max-w-lg space-y-3'>
            <div className='space-y-1'><Label>Store Name</Label><Input value={storeName} onChange={(e) => setStoreName(e.target.value)} /></div>
            <div className='space-y-1'><Label>Address</Label><Input value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} /></div>
            <div className='space-y-1'><Label>Contact</Label><Input value={storeContact} onChange={(e) => setStoreContact(e.target.value)} /></div>
            <div className='space-y-1'><Label>Receipt Footer</Label><Input value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} /></div>
            <Button onClick={handleSaveGeneral} disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </TabsContent>

        <TabsContent value='payments' className='space-y-4 mt-3'>
          <div className='max-w-lg space-y-3'>
            <div className='flex gap-2'><Input placeholder='New payment method name' value={newMethod} onChange={(e) => setNewMethod(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddPayment()} /><Button onClick={handleAddPayment}><Plus className='h-4 w-4 mr-1' /> Add</Button></div>
            <div className='border rounded-md'>
              <Table>
                <TableHeader><TableRow><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead>Toggle</TableHead></TableRow></TableHeader>
                <TableBody>
                  {paymentMethods.map((pm: any) => (
                    <TableRow key={pm.id}><TableCell className='font-medium'>{pm.name}</TableCell><TableCell><Badge variant={pm.isActive ? 'secondary' : 'outline'}>{pm.isActive ? 'Active' : 'Inactive'}</Badge></TableCell><TableCell><Switch checked={pm.isActive} onCheckedChange={() => handleTogglePayment(pm)} /></TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value='recovery' className='space-y-4 mt-3'>
          <div className='max-w-lg space-y-4'>
            <Card><CardContent className='p-4 space-y-2'><h3 className='font-medium'>Recovery Email</h3><p className='text-sm text-muted-foreground'>{recoveryInfo?.hasRecoveryEmail ? `Configured: ${recoveryInfo.emailMasked}` : 'No recovery email configured.'}</p></CardContent></Card>
            <Card className='border-yellow-500/40'><CardContent className='p-4 space-y-3'><div className='flex items-start gap-2'><AlertTriangle className='h-5 w-5 text-yellow-600 mt-0.5' /><div><h3 className='font-medium'>Recovery Codes</h3><p className='text-sm text-muted-foreground'>Generate one-time recovery codes to regain access if you forget your password. Store these codes securely - each code can only be used once.</p></div></div><Button onClick={handleGenerateCodes}><RotateCcw className='h-4 w-4 mr-1' /> Generate New Recovery Codes</Button></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value='data' className='space-y-4 mt-3'>
          <div className='max-w-lg'><p className='text-sm text-muted-foreground mb-3'>Export your business data for record-keeping or backup. Files are in CSV format.</p><div className='grid grid-cols-2 gap-3'>{['sales', 'products', 'inventory', 'expenses'].map((type) => (<Button key={type} variant='outline' className='h-auto py-3' onClick={() => downloadExport(type)}><Download className='h-4 w-4 mr-2' />{type.charAt(0).toUpperCase() + type.slice(1)}</Button>))}</div></div>
        </TabsContent>
      </Tabs>

      <Dialog open={codesDialog} onOpenChange={setCodesDialog}>
        <DialogContent><DialogHeader><DialogTitle>Recovery Codes</DialogTitle></DialogHeader><div className='space-y-3'><AlertTriangle className='h-5 w-5 text-yellow-600' /><p className='text-sm'>Save these codes in a secure location. Each code can only be used once. These codes will not be shown again.</p><div className='bg-muted p-3 rounded font-mono text-sm space-y-1'>{recoveryCodes.map((code) => <div key={code}>{code}</div>)}</div></div><DialogFooter><Button onClick={() => setCodesDialog(false)}>I Have Saved These Codes</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}