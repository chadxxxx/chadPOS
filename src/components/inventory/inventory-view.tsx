'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, formatCurrency, formatDate } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, PackageX, Package, RotateCcw, Search, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';

const MOVEMENT_TYPES = ['SALE', 'RESTOCK', 'RETURN', 'DAMAGED', 'EXPIRED', 'MANUAL_ADJUSTMENT', 'STOCK_COUNT'];

export function InventoryView() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const [tab, setTab] = useState('overview');
  const [products, setProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [movementPage, setMovementPage] = useState(1);
  const [movementTotal, setMovementTotal] = useState(0);
  const [stockFilter, setStockFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [movementFilter, setMovementFilter] = useState('');
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [stockCountDialog, setStockCountDialog] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);

  // Adjust form
  const [adjProductId, setAdjProductId] = useState('');
  const [adjQty, setAdjQty] = useState('');
  const [adjType, setAdjType] = useState('RESTOCK');
  const [adjReason, setAdjReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Stock count form
  const [scProductId, setScProductId] = useState('');
  const [scPhysical, setScPhysical] = useState('');
  const [scReason, setScReason] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let url = `/api/products?limit=100`;
    if (stockFilter === 'low') url += '&stockStatus=low';
    else if (stockFilter === 'out') url += '&stockStatus=out';
    if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
    const res = await apiFetch(url);
    if (res.data) setProducts((res.data as any).data || []);
    setLoading(false);
  }, [stockFilter, searchTerm]);

  const fetchMovements = useCallback(async () => {
    let url = `/api/inventory/movements?page=${movementPage}&limit=20`;
    if (movementFilter) url += `&type=${movementFilter}`;
    const res = await apiFetch(url);
    if (res.data) {
      const d = res.data as any;
      setMovements(d.data || []);
      setMovementTotal(d.total || 0);
    }
  }, [movementPage, movementFilter]);

  const fetchAllProducts = useCallback(async () => {
    const res = await apiFetch('/api/products?limit=500&status=ACTIVE');
    if (res.data) setAllProducts((res.data as any).data || []);
  }, []);

  useEffect(() => { let c = false; fetchProducts().then(() => { if (!c) return; }); return () => { c = true; }; }, [fetchProducts]);
  useEffect(() => { fetchMovements(); }, [fetchMovements]);
  useEffect(() => { if (isAdmin) fetchAllProducts(); }, [isAdmin, fetchAllProducts]);

  const handleAdjust = async () => {
    if (!adjProductId || !adjQty) return;
    setSubmitting(true);
    const qty = parseInt(adjQty);
    const res = await apiFetch('/api/inventory/movements', {
      method: 'POST',
      body: JSON.stringify({ productId: adjProductId, quantityChanged: adjType === 'RESTOCK' || adjType === 'RETURN' ? Math.abs(qty) : -Math.abs(qty), type: adjType, reason: adjReason }),
    });
    setSubmitting(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Inventory adjusted successfully');
    setAdjustDialog(false);
    setAdjProductId(''); setAdjQty(''); setAdjReason('');
    fetchProducts(); fetchMovements();
  };

  const handleStockCount = async () => {
    if (!scProductId || !scPhysical) return;
    setSubmitting(true);
    const res = await apiFetch('/api/inventory/stock-count', {
      method: 'POST',
      body: JSON.stringify({ productId: scProductId, physicalQuantity: parseInt(scPhysical), reason: scReason }),
    });
    setSubmitting(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success('Stock count recorded');
    setStockCountDialog(false);
    setScProductId(''); setScPhysical(''); setScReason('');
    fetchProducts(); fetchMovements();
  };

  const lowCount = products.filter((p) => p.currentQuantity > 0 && p.currentQuantity <= p.minStockLevel).length;
  const outCount = products.filter((p) => p.currentQuantity === 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">Inventory</h2>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setAdjustDialog(true)}><Plus className="h-4 w-4 mr-1" /> Adjust Stock</Button>
            <Button size="sm" variant="outline" onClick={() => setStockCountDialog(true)}><RotateCcw className="h-4 w-4 mr-1" /> Stock Count</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Products</p><p className="text-2xl font-semibold">{products.length}</p></CardContent></Card>
        <Card className="border-yellow-500/40"><CardContent className="p-4"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-600" /><p className="text-sm text-muted-foreground">Low Stock</p></div><p className="text-2xl font-semibold text-yellow-700">{lowCount}</p></CardContent></Card>
        <Card className="border-red-500/40"><CardContent className="p-4"><div className="flex items-center gap-2"><PackageX className="h-4 w-4 text-red-600" /><p className="text-sm text-muted-foreground">Out of Stock</p></div><p className="text-2xl font-semibold text-red-700">{outCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2"><Package className="h-4 w-4" /><p className="text-sm text-muted-foreground">In Stock</p></div><p className="text-2xl font-semibold">{products.length - outCount}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="overview">Stock Overview</TabsTrigger><TabsTrigger value="movements">Movements</TabsTrigger></TabsList>

        <TabsContent value="overview" className="space-y-3 mt-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" /></div>
            <div className="flex gap-1">
              {['all', 'low', 'out'].map((f) => (
                <Button key={f} size="sm" variant={stockFilter === f ? 'default' : 'outline'} onClick={() => setStockFilter(f)}>
                  {f === 'all' ? 'All' : f === 'low' ? 'Low Stock' : 'Out of Stock'}
                </Button>
              ))}
            </div>
          </div>

          {loading ? <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : (
            <div className="border rounded-md">
              <Table>
                <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right hidden sm:table-cell">Min Stock</TableHead><TableHead className="text-right hidden md:table-cell">Value</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {products.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No products found.</TableCell></TableRow> : products.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.barcode || p.sku || '-'}</div></TableCell>
                      <TableCell className="text-right font-mono">{p.currentQuantity} {p.unit}</TableCell>
                      <TableCell className="text-right font-mono hidden sm:table-cell">{p.minStockLevel}</TableCell>
                      <TableCell className="text-right hidden md:table-cell">{formatCurrency(p.currentQuantity * p.costPrice)}</TableCell>
                      <TableCell>{p.currentQuantity === 0 ? <Badge variant="destructive">Out of Stock</Badge> : p.currentQuantity <= p.minStockLevel ? <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Low Stock</Badge> : <Badge variant="secondary">In Stock</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="movements" className="space-y-3 mt-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={movementFilter} onValueChange={(v) => { setMovementFilter(v === 'all' ? '' : v); setMovementPage(1); }}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Types</SelectItem>{MOVEMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="border rounded-md">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Change</TableHead><TableHead className="text-right">New Qty</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
              <TableBody>
                {movements.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No movements found.</TableCell></TableRow> : movements.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(m.createdAt)}</TableCell>
                    <TableCell className="font-medium">{m.product?.name || '-'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{m.type.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className={`text-right font-mono ${m.quantityChanged > 0 ? 'text-green-700' : 'text-red-700'}`}>{m.quantityChanged > 0 ? '+' : ''}{m.quantityChanged}</TableCell>
                    <TableCell className="text-right font-mono">{m.newQty}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.user?.displayName || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>Page {movementPage} of {Math.max(1, Math.ceil(movementTotal / 20))}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={movementPage <= 1} onClick={() => setMovementPage(movementPage - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={movementPage >= Math.ceil(movementTotal / 20)} onClick={() => setMovementPage(movementPage + 1)}>Next</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent><DialogHeader><DialogTitle>Adjust Stock</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Product</Label><Select value={adjProductId} onValueChange={setAdjProductId}><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent>{allProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} (Stock: {p.currentQuantity})</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Type</Label><Select value={adjType} onValueChange={setAdjType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MOVEMENT_TYPES.filter(t => t !== 'SALE' && t !== 'STOCK_COUNT').map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Quantity</Label><Input type="number" min="1" value={adjQty} onChange={(e) => setAdjQty(e.target.value)} placeholder="Enter quantity" /></div>
          <div className="space-y-1"><Label>Reason (optional)</Label><Textarea value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Reason for adjustment" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setAdjustDialog(false)}>Cancel</Button><Button onClick={handleAdjust} disabled={submitting || !adjProductId || !adjQty}>{submitting ? 'Saving...' : 'Save Adjustment'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Count Dialog */}
      <Dialog open={stockCountDialog} onOpenChange={setStockCountDialog}>
        <DialogContent><DialogHeader><DialogTitle>Physical Stock Count</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Product</Label><Select value={scProductId} onValueChange={(v) => { setScProductId(v); const p = allProducts.find(x => x.id === v); if (p) setScPhysical(String(p.currentQuantity)); }}><SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger><SelectContent>{allProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} (System: {p.currentQuantity})</SelectItem>)}</SelectContent></Select></div>
          {scProductId && <p className="text-sm text-muted-foreground">System quantity: {allProducts.find((p) => p.id === scProductId)?.currentQuantity || 0}</p>}
          <div className="space-y-1"><Label>Physical Count</Label><Input type="number" min="0" value={scPhysical} onChange={(e) => setScPhysical(e.target.value)} /></div>
          {scProductId && scPhysical && (() => { const sys = allProducts.find((p) => p.id === scProductId)?.currentQuantity || 0; const diff = parseInt(scPhysical) - sys; return diff !== 0 ? <p className={`text-sm ${diff > 0 ? 'text-green-700' : 'text-red-700'}`}>Difference: {diff > 0 ? '+' : ''}{diff}</p> : null; })()}
          <div className="space-y-1"><Label>Reason</Label><Input value={scReason} onChange={(e) => setScReason(e.target.value)} placeholder="e.g. Damaged, Missing, Counting error" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setStockCountDialog(false)}>Cancel</Button><Button onClick={handleStockCount} disabled={submitting || !scProductId || !scPhysical || !scReason}>{submitting ? 'Saving...' : 'Record Count'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}