'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCartStore } from '@/store/cart-store';
import { useAuthStore } from '@/store/auth-store';
import { apiFetch, formatCurrency } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, ScanBarcode, Minus, Plus, Trash2, PackagePlus, AlertTriangle } from 'lucide-react';
import { ReceiptDialog } from './receipt-dialog';
import { BarcodeScanner } from './barcode-scanner';

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  sellingPrice: number;
  costPrice: number;
  currentQuantity: number;
  unit: string;
  status: string;
  sku?: string | null;
}

interface PaymentMethod {
  id: string;
  name: string;
  isActive: boolean;
}

interface CompletedSale {
  transactionNumber: string;
  date: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentAmount: number;
  changeAmount: number;
  customerName: string | null;
  status: string;
  cashier: { displayName: string } | null;
  items: {
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
}

/* ------------------------------------------------------------------ */

export function PosView() {
  const {
    items,
    discount,
    paymentMethod,
    addItem,
    removeItem,
    updateQuantity,
    setDiscount,
    setPaymentMethod,
    clearCart,
    getSubtotal,
    getTotal,
  } = useCartStore();

  const user = useAuthStore((s) => s.user);
  const role = user?.role || '';
  const canDiscount = role === 'OWNER' || role === 'ADMIN';

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [searching, setSearching] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [storeName, setStoreName] = useState('My Sari-Sari Store');
  const [scannerBusy, setScannerBusy] = useState(false);

  // "Product not found" dialog state
  const [notFoundBarcode, setNotFoundBarcode] = useState('');
  const [showNotFoundDialog, setShowNotFoundDialog] = useState(false);

  // Quick-add product dialog state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddBarcode, setQuickAddBarcode] = useState('');
  const [quickAddForm, setQuickAddForm] = useState({
    name: '',
    costPrice: '',
    sellingPrice: '',
    unit: 'pc',
  });
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scannerBufferRef = useRef<string>('');
  const scannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch payment methods & store name
  useEffect(() => {
    apiFetch('/api/settings?section=paymentMethods').then((res) => {
      if (res.data) {
        const methods = (res.data as any[]).filter((m: any) => m.isActive);
        setPaymentMethods(methods);
        if (methods.length === 0) {
          setPaymentMethods([
            { id: 'default-cash', name: 'Cash', isActive: true },
            { id: 'default-gcash', name: 'GCash', isActive: true },
            { id: 'default-utang', name: 'Utang', isActive: true },
          ]);
        }
      }
    });
    apiFetch<Record<string, string>>('/api/settings').then((res) => {
      if (res.data?.storeName) setStoreName(res.data.storeName);
    });
  }, []);

  // Physical barcode scanner (keyboard wedge) support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Enter' && scannerBufferRef.current.length >= 3) {
        e.preventDefault();
        const barcode = scannerBufferRef.current;
        scannerBufferRef.current = '';
        if (scannerTimeoutRef.current) clearTimeout(scannerTimeoutRef.current);
        handleBarcodeLookup(barcode);
        return;
      }

      if (e.key.length === 1) {
        scannerBufferRef.current += e.key;
        if (scannerTimeoutRef.current) clearTimeout(scannerTimeoutRef.current);
        scannerTimeoutRef.current = setTimeout(() => {
          scannerBufferRef.current = '';
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (scannerTimeoutRef.current) clearTimeout(scannerTimeoutRef.current);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchProducts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    try {
      const res = await apiFetch('/api/products?search=' + encodeURIComponent(query) + '&status=ACTIVE&limit=20');
      if (res.data) {
        const d = res.data as any;
        const products: Product[] = d.data || d;
        setSearchResults(products);
        setShowResults(true);
      }
    } catch {
      // silent
    } finally {
      setSearching(false);
    }
  }, []);

  const browseProducts = useCallback(async () => {
    setBrowsing(true);
    setSearching(true);
    try {
      const res = await apiFetch('/api/products?status=ACTIVE&limit=50');
      if (res.data) {
        const d = res.data as any;
        const products: Product[] = d.data || d;
        setSearchResults(products);
        setShowResults(true);
      }
    } catch {
      // silent
    } finally {
      setSearching(false);
      setBrowsing(false);
    }
  }, []);

  let searchTimeout: ReturnType<typeof setTimeout>;
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    clearTimeout(searchTimeout);
    if (value.trim().length >= 1) {
      searchTimeout = setTimeout(() => searchProducts(value), 200);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    if (product.currentQuantity <= 0) {
      toast.error('Product is out of stock: ' + product.name);
      return;
    }
    addItem({
      productId: product.id,
      name: product.name,
      barcode: product.barcode,
      price: product.sellingPrice,
      costPrice: product.costPrice,
      maxQty: product.currentQuantity,
    });
    setShowResults(false);
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  /* ---- Barcode lookup (from scanner or physical wedge) ---- */
  const handleBarcodeLookup = async (barcode: string) => {
    if (scannerBusy) return;
    setScannerBusy(true);
    try {
      const res = await apiFetch('/api/barcode/lookup?barcode=' + encodeURIComponent(barcode.trim()));
      if (res.data && (res.data as any).found) {
        const product = (res.data as any).product as Product;
        if (product.currentQuantity <= 0) {
          toast.error('Product is out of stock: ' + product.name);
        } else {
          addItem({
            productId: product.id,
            name: product.name,
            barcode: product.barcode,
            price: product.sellingPrice,
            costPrice: product.costPrice,
            maxQty: product.currentQuantity,
          });
          toast.success('Added: ' + product.name);
        }
      } else {
        // Product not found — show dialog with option to create
        setNotFoundBarcode(barcode.trim());
        setShowNotFoundDialog(true);
      }
    } catch {
      toast.error('Barcode lookup failed.');
    } finally {
      setTimeout(() => setScannerBusy(false), 1000);
    }
  };

  /* ---- Quick-add product from not-found dialog ---- */
  const openQuickAdd = () => {
    setQuickAddBarcode(notFoundBarcode);
    setQuickAddForm({ name: '', costPrice: '', sellingPrice: '', unit: 'pc' });
    setShowNotFoundDialog(false);
    setShowQuickAdd(true);
  };

  const handleQuickAddSave = async () => {
    if (!quickAddForm.name.trim()) { toast.error('Product name is required.'); return; }
    if (!quickAddForm.costPrice || isNaN(parseFloat(quickAddForm.costPrice))) { toast.error('Valid cost price is required.'); return; }
    if (!quickAddForm.sellingPrice || isNaN(parseFloat(quickAddForm.sellingPrice))) { toast.error('Valid selling price is required.'); return; }

    setQuickAddSaving(true);
    try {
      const res = await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          name: quickAddForm.name.trim(),
          barcode: quickAddBarcode || null,
          sku: quickAddBarcode || null,
          costPrice: parseFloat(quickAddForm.costPrice),
          sellingPrice: parseFloat(quickAddForm.sellingPrice),
          currentQuantity: 0,
          unit: quickAddForm.unit,
        }),
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success('Product created! You can now scan it.');
      setShowQuickAdd(false);
      // Look it up again to add to cart
      if (quickAddBarcode) {
        await handleBarcodeLookup(quickAddBarcode);
      }
    } catch {
      toast.error('Failed to create product.');
    } finally {
      setQuickAddSaving(false);
    }
  };

  const subtotal = getSubtotal();
  const total = getTotal();
  const change = Math.max(0, parseFloat(paymentAmount || '0') - total);
  const isUtang = paymentMethod === 'UTANG';
  const isCash = paymentMethod === 'Cash';

  const handleCheckout = async () => {
    if (items.length === 0) return;
    if (isUtang && !customerName.trim()) {
      toast.error('Customer name is required for Utang.');
      return;
    }
    if (!isUtang && parseFloat(paymentAmount || '0') < total) {
      toast.error('Insufficient payment amount.');
      return;
    }

    setCheckingOut(true);
    try {
      const payAmount = isUtang ? 0 : parseFloat(paymentAmount);
      const res = await apiFetch<CompletedSale>('/api/pos/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            barcode: i.barcode,
            price: i.price,
            costPrice: i.costPrice,
            quantity: i.quantity,
          })),
          discount,
          paymentMethod: isUtang ? 'UTANG' : paymentMethod,
          paymentAmount: payAmount,
          customerName: isUtang ? customerName.trim() : undefined,
        }),
      });

      if (res.error) { toast.error(res.error); return; }

      if (res.data) {
        setCompletedSale(res.data);
        setShowReceipt(true);
        clearCart();
        setPaymentAmount('');
        setCustomerName('');
      }
    } catch {
      toast.error('Checkout failed. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Left: Search + Cart */}
        <div className="space-y-4">
          {/* Search bar with manual barcode input */}
          <div className="relative" ref={searchRef}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search products…"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
                  className="pl-9 h-11"
                  autoFocus
                />
              </div>
              <Button
                variant="outline"
                className="h-11 px-3 shrink-0 text-xs"
                onClick={browseProducts}
                disabled={browsing}
                title="Browse all products"
              >
                {browsing ? '...' : 'Browse'}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={() => setShowScanner(true)}
                title="Camera Barcode Scanner"
              >
                <ScanBarcode className="h-4 w-4" />
              </Button>
            </div>
            {/* Manual barcode input below search */}
            <div className="mt-1.5">
              <div className="flex gap-2">
                <Input
                  placeholder="Type barcode number and press Enter…"
                  className="h-9 text-xs"
                  value={scannerBusy ? '' : undefined}
                  disabled={scannerBusy}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val.length >= 3) {
                        e.preventDefault();
                        (e.target as HTMLInputElement).value = '';
                        handleBarcodeLookup(val);
                      }
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2 text-xs text-muted-foreground shrink-0"
                  disabled={scannerBusy}
                  onClick={() => {
                    const input = searchRef.current?.querySelector('input[type=text]:not([placeholder*=Search])') as HTMLInputElement;
                    const val = input?.value?.trim();
                    if (val && val.length >= 3) {
                      input.value = '';
                      handleBarcodeLookup(val);
                    }
                  }}
                >
                  Look Up
                </Button>
              </div>
            </div>

            {/* Search results dropdown */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-64 overflow-y-auto scrollbar-thin">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-sm hover:bg-accent transition-colors min-h-[44px] ${p.currentQuantity <= 0 ? 'opacity-50' : ''}`}
                  >
                    <div className="text-left">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.barcode || p.sku || '-'}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-medium">{formatCurrency(p.sellingPrice)}</p>
                      <p className={`text-xs ${p.currentQuantity <= 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        {p.currentQuantity <= 0 ? 'Out of Stock' : `Stock: ${p.currentQuantity}`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showResults && searching && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-md p-3">
                <Skeleton className="h-8 w-full" />
              </div>
            )}
          </div>

          {/* Cart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Cart ({items.length} item{items.length !== 1 ? 's' : ''})</CardTitle>
                {items.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive h-8" onClick={clearCart}>
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Cart is empty. Search, browse, or scan products to add.<br />
                  <span className="text-xs">Physical barcode scanner also supported.</span>
                </div>
              ) : (
                <ScrollArea className="max-h-[40vh] lg:max-h-[50vh]">
                  <div className="px-4 pb-2 space-y-1">
                    {items.map((item) => (
                      <div key={item.productId} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} each</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.productId, item.quantity + 1)} disabled={item.quantity >= item.maxQty}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-right shrink-0 w-20">
                          <p className="text-sm font-medium">{formatCurrency(item.price * item.quantity)}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeItem(item.productId)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {items.length > 0 && (
                <div className="border-t border-border p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {canDiscount && (
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="pos-discount" className="text-sm text-muted-foreground shrink-0">Discount</Label>
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
                        <Input id="pos-discount" type="number" min="0" step="0.01" value={discount || ''} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="pl-7 h-8 text-sm" placeholder="0.00" />
                      </div>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Payment section */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Payment Method</Label>
                <Select value={isUtang ? 'UTANG' : paymentMethod} onValueChange={(v) => { setPaymentMethod(v); setPaymentAmount(''); }}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((m) => (
                      <SelectItem key={m.id} value={m.name === 'Utang' ? 'UTANG' : m.name}>{m.name === 'Utang' ? '☕ Utang (Credit)' : m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isUtang && items.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="customer-name" className="text-sm">Customer Name *</Label>
                  <Input
                    id="customer-name"
                    placeholder="Enter customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-11"
                  />
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    This sale will be recorded as credit (utang). The customer will pay later. Utang is NOT counted as gross sales.
                  </p>
                </div>
              )}

              {isCash && items.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="payment-amount" className="text-sm">Amount Tendered</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
                    <Input id="payment-amount" type="number" min="0" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="pl-7 h-11" placeholder="0.00" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, 500, 1000]
                      .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
                      .slice(0, 4)
                      .map((amt) => (
                        <Button key={amt} variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPaymentAmount(amt.toFixed(2))}>
                          {formatCurrency(amt)}
                        </Button>
                      ))}
                  </div>
                  {parseFloat(paymentAmount || '0') >= total && parseFloat(paymentAmount || '0') > 0 && (
                    <div className="flex justify-between text-sm bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-2 -mx-1">
                      <span className="text-muted-foreground">Change</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(change)}</span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'GCash' && items.length > 0 && (
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 -mx-1">
                  <p className="text-sm text-muted-foreground">GCash Payment</p>
                  <p className="text-lg font-semibold">{formatCurrency(total)}</p>
                </div>
              )}

              <Button
                className="w-full h-12 text-base font-semibold"
                disabled={items.length === 0 || checkingOut || (!isUtang && isCash && parseFloat(paymentAmount || '0') < total) || (isUtang && !customerName.trim())}
                onClick={handleCheckout}
              >
                {checkingOut ? 'Processing...' : isUtang ? `Record Utang - ${formatCurrency(total)}` : `Complete Sale - ${formatCurrency(total)}`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Receipt dialog */}
      <ReceiptDialog open={showReceipt} onOpenChange={setShowReceipt} sale={completedSale} storeName={storeName} />

      {/* Camera barcode scanner */}
      {showScanner && (
        <BarcodeScanner
          mode="pos"
          onBarcodeDetected={handleBarcodeLookup}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Product Not Found dialog */}
      <Dialog open={showNotFoundDialog} onOpenChange={setShowNotFoundDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Product Not Found
            </DialogTitle>
            <DialogDescription>
              No product matches barcode <strong className="font-mono">{notFoundBarcode}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted p-3 text-center">
              <p className="font-mono text-lg font-semibold tracking-wider">{notFoundBarcode}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowNotFoundDialog(false)}>
                Dismiss
              </Button>
              <Button className="flex-1" onClick={openQuickAdd}>
                <PackagePlus className="h-4 w-4 mr-1.5" />
                Create Product
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick-Add Product dialog */}
      <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5" />
              Register New Product
            </DialogTitle>
            <DialogDescription>
              Barcode <strong className="font-mono">{quickAddBarcode}</strong> will be assigned automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="qa-name">Product Name *</Label>
              <Input
                id="qa-name"
                placeholder="e.g. Lucky Me Pancit Canton"
                value={quickAddForm.name}
                onChange={(e) => setQuickAddForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qa-cost">Cost Price *</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                  <Input
                    id="qa-cost"
                    type="number" min="0" step="0.01" className="pl-6 h-10 text-sm"
                    placeholder="0.00"
                    value={quickAddForm.costPrice}
                    onChange={(e) => setQuickAddForm((f) => ({ ...f, costPrice: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qa-selling">Selling Price *</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                  <Input
                    id="qa-selling"
                    type="number" min="0" step="0.01" className="pl-6 h-10 text-sm"
                    placeholder="0.00"
                    value={quickAddForm.sellingPrice}
                    onChange={(e) => setQuickAddForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowQuickAdd(false)}>Cancel</Button>
              <Button onClick={handleQuickAddSave} disabled={quickAddSaving}>
                {quickAddSaving ? 'Creating…' : 'Create & Add to Cart'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
