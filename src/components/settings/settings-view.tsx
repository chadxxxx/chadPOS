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
import { Plus, Trash2, RotateCcw, Download, AlertTriangle, Sheet, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
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

  // Google Sheets Integration
  const [googleSheetId, setGoogleSheetId] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [googleKeyVisible, setGoogleKeyVisible] = useState(false);
  const [googleSaving, setGoogleSaving] = useState(false);
  const [googleTesting, setGoogleTesting] = useState(false);
  const [googleTestResult, setGoogleTestResult] = useState<{ success: boolean; message: string } | null>(null);

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
      setGoogleSheetId(s.googleSheetId || '');
      setGoogleEmail(s.googleServiceAccountEmail || '');
      setGoogleKey(s.googlePrivateKey || '');
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

  const handleSaveGoogleSheets = async () => {
    setGoogleSaving(true);
    setGoogleTestResult(null);
    const newSettings = [
      { key: 'googleSheetId', value: googleSheetId.trim() },
      { key: 'googleServiceAccountEmail', value: googleEmail.trim() },
      { key: 'googlePrivateKey', value: googleKey.trim() },
    ];
    const res = await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ settings: newSettings }) });
    setGoogleSaving(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Google Sheets credentials saved.');
  };

  const handleTestGoogleSheets = async () => {
    setGoogleTesting(true);
    setGoogleTestResult(null);
    const res = await apiFetch('/api/settings/test-google-sheets', { method: 'POST' });
    setGoogleTesting(false);
    if (res.error) { setGoogleTestResult({ success: false, message: res.error }); return; }
    const data = res.data as any;
    setGoogleTestResult({ success: data.success, message: data.message });
  };

  const googleIsConfigured = !!(googleSheetId.trim() && googleEmail.trim() && googleKey.trim());

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

  const [exporting, setExporting] = useState<string | null>(null);

  const downloadExport = async (type: string) => {
    setExporting(type);
    try {
      const token = sessionStorage.getItem('session_token');
      const res = await fetch(`/api/reports/export?type=${type}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      });
      if (!res.ok) { toast.error('Export failed. Please try again.'); setExporting(null); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_export.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully.`);
    } catch {
      toast.error('Export failed. Check your connection.');
    } finally {
      setExporting(null);
    }
  };

  if (loading) return <div className='space-y-2'><Skeleton className='h-10 w-full' /><Skeleton className='h-10 w-full' /></div>;

  return (
    <div className='space-y-4'>
      <h2 className='text-lg font-semibold'>Settings</h2>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value='general'>General</TabsTrigger><TabsTrigger value='payments'>Payment Methods</TabsTrigger><TabsTrigger value='integrations'>Integrations</TabsTrigger><TabsTrigger value='recovery'>Account Recovery</TabsTrigger><TabsTrigger value='data'>Data Export</TabsTrigger></TabsList>

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

        <TabsContent value='integrations' className='space-y-4 mt-3'>
          <div className='max-w-lg space-y-4'>
            {/* Status banner */}
            <div className={`flex items-center gap-2 p-3 rounded-md border ${googleIsConfigured ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
              {googleIsConfigured
                ? <><CheckCircle2 className='h-4 w-4 text-emerald-600 shrink-0' /><span className='text-sm text-emerald-700 dark:text-emerald-400'>Google Sheets sync is configured</span></>
                : <><AlertTriangle className='h-4 w-4 text-amber-600 shrink-0' /><span className='text-sm text-amber-700 dark:text-amber-400'>Google Sheets sync is not configured — sales will not be backed up</span></>
              }
            </div>

            {/* Test result banner */}
            {googleTestResult && (
              <div className={`flex items-start gap-2 p-3 rounded-md border ${googleTestResult.success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                {googleTestResult.success
                  ? <CheckCircle2 className='h-4 w-4 text-emerald-600 shrink-0 mt-0.5' />
                  : <XCircle className='h-4 w-4 text-red-600 shrink-0 mt-0.5' />
                }
                <span className={`text-sm ${googleTestResult.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{googleTestResult.message}</span>
              </div>
            )}

            <Card><CardContent className='p-4 space-y-4'>
              <div className='flex items-center gap-2 mb-1'>
                <Sheet className='h-5 w-5 text-green-600' />
                <h3 className='font-medium'>Google Sheets Backup</h3>
              </div>
              <p className='text-sm text-muted-foreground'>Every sale and utang payment will be automatically added as a row in your Google Sheet as a real-time backup. If the sync fails, your POS still works normally.</p>

              <Separator />

              <div className='space-y-1'>
                <Label>Google Sheet ID</Label>
                <Input placeholder='e.g. 1ABC123XYZ...' value={googleSheetId} onChange={(e) => setGoogleSheetId(e.target.value)} />
                <p className='text-xs text-muted-foreground'>Found in your Google Sheet URL: docs.google.com/spreadsheets/d/<span className='font-mono'>THIS_PART</span>/edit</p>
              </div>

              <div className='space-y-1'>
                <Label>Service Account Email</Label>
                <Input placeholder='e.g. pos-sync@your-project.iam.gserviceaccount.com' value={googleEmail} onChange={(e) => setGoogleEmail(e.target.value)} />
              </div>

              <div className='space-y-1'>
                <Label>Private Key</Label>
                <div className='relative'>
                  <textarea
                    className='flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono text-xs'
                    placeholder={'-----BEGIN PRIVATE KEY-----\nMIIEvA...\n-----END PRIVATE KEY-----'}
                    value={googleKeyVisible ? googleKey : (googleKey ? '••••••••••••••••••••••••••••••••' : '')}
                    onChange={(e) => setGoogleKey(e.target.value)}
                    onFocus={() => setGoogleKeyVisible(true)}
                    onBlur={() => setGoogleKeyVisible(false)}
                  />
                </div>
                <p className='text-xs text-muted-foreground'>From the JSON key file. The full PEM block including BEGIN/END lines. Click to reveal.</p>
              </div>

              <div className='flex gap-2 pt-1'>
                <Button onClick={handleSaveGoogleSheets} disabled={googleSaving}>
                  {googleSaving ? 'Saving...' : 'Save Credentials'}
                </Button>
                <Button variant='outline' onClick={handleTestGoogleSheets} disabled={googleTesting || !googleIsConfigured}>
                  {googleTesting ? <><Loader2 className='h-4 w-4 mr-1 animate-spin' /> Testing...</> : 'Test Connection'}
                </Button>
              </div>
            </CardContent></Card>

            <Card className='border-blue-500/30'><CardContent className='p-4 space-y-2'>
              <h3 className='font-medium text-sm'>How to set up Google Sheets sync</h3>
              <ol className='text-sm text-muted-foreground space-y-1 list-decimal list-inside'>
                <li>Go to <a href='https://console.cloud.google.com' target='_blank' rel='noreferrer' className='text-blue-600 underline'>Google Cloud Console</a> and create a project</li>
                <li>Enable the <b>Google Sheets API</b> in APIs &amp; Services → Library</li>
                <li>Create a <b>Service Account</b> in Credentials → download the JSON key file</li>
                <li><b>Share</b> your Google Sheet with the service account email (Editor access)</li>
                <li>Copy the <b>Sheet ID</b> from your Google Sheet URL, the <b>client_email</b> and <b>private_key</b> from the JSON file, and paste them above</li>
              </ol>
            </CardContent></Card>
          </div>
        </TabsContent>
        <TabsContent value='recovery' className='space-y-4 mt-3'>
          <div className='max-w-lg space-y-4'>
            <Card><CardContent className='p-4 space-y-2'><h3 className='font-medium'>Recovery Email</h3><p className='text-sm text-muted-foreground'>{recoveryInfo?.hasRecoveryEmail ? `Configured: ${recoveryInfo.emailMasked}` : 'No recovery email configured.'}</p></CardContent></Card>
            <Card className='border-yellow-500/40'><CardContent className='p-4 space-y-3'><div className='flex items-start gap-2'><AlertTriangle className='h-5 w-5 text-yellow-600 mt-0.5' /><div><h3 className='font-medium'>Recovery Codes</h3><p className='text-sm text-muted-foreground'>Generate one-time recovery codes to regain access if you forget your password. Store these codes securely - each code can only be used once.</p></div></div><Button onClick={handleGenerateCodes}><RotateCcw className='h-4 w-4 mr-1' /> Generate New Recovery Codes</Button></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value='data' className='space-y-4 mt-3'>
          <div className='max-w-lg'><p className='text-sm text-muted-foreground mb-3'>Export your business data for record-keeping or backup. Files are in CSV format.</p><div className='grid grid-cols-2 gap-3'>{['sales', 'products', 'inventory', 'expenses'].map((type) => (<Button key={type} variant='outline' className='h-auto py-3' disabled={exporting === type} onClick={() => downloadExport(type)}><Download className='h-4 w-4 mr-2' />{exporting === type ? 'Exporting...' : type.charAt(0).toUpperCase() + type.slice(1)}</Button>))}</div></div>
        </TabsContent>
      </Tabs>

      <Dialog open={codesDialog} onOpenChange={setCodesDialog}>
        <DialogContent><DialogHeader><DialogTitle>Recovery Codes</DialogTitle></DialogHeader><div className='space-y-3'><AlertTriangle className='h-5 w-5 text-yellow-600' /><p className='text-sm'>Save these codes in a secure location. Each code can only be used once. These codes will not be shown again.</p><div className='bg-muted p-3 rounded font-mono text-sm space-y-1'>{recoveryCodes.map((code) => <div key={code}>{code}</div>)}</div></div><DialogFooter><Button onClick={() => setCodesDialog(false)}>I Have Saved These Codes</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}