'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useNavStore } from '@/store/nav-store';
import { apiFetch, formatCurrency } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { ProductFormDialog } from './product-form-dialog';
import { RestockDialog } from './restock-dialog';

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  brand: string | null;
  sellingPrice: number;
  costPrice: number;
  currentQuantity: number;
  minStockLevel: number;
  unit: string;
  status: string;
  category: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

export function ProductListView() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role || '';
  const canEdit = role === 'OWNER' || role === 'ADMIN';
  const setView = useNavStore((s) => s.setView);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);

  const fetchCategories = useCallback(async () => {
    const res = await apiFetch<Category[]>('/api/products/categories');
    if (res.data) setCategories(res.data);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (categoryFilter) params.set('categoryId', categoryFilter);
      if (stockFilter === 'low') params.set('stockStatus', 'low');
      if (stockFilter === 'out') params.set('stockStatus', 'out');

      const res = await apiFetch<{ data: Product[]; total: number; totalPages: number }>('/api/products?' + params);
      if (res.data) {
        setProducts(res.data.data);
        setTotal(res.data.total);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, search, stockFilter, categoryFilter]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const getStockStatus = (p: Product) => {
    if (p.currentQuantity <= 0) return 'out';
    if (p.currentQuantity <= p.minStockLevel) return 'low';
    return 'normal';
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg font-semibold">Products</h2>
        {canEdit && (
          <Button size="sm" onClick={() => { setEditProduct(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Product
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={stockFilter} onValueChange={(v) => { setStockFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v === '_all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-x-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No products found.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs hidden sm:table-cell">Barcode</TableHead>
                <TableHead className="text-xs hidden md:table-cell">Brand</TableHead>
                <TableHead className="text-xs hidden lg:table-cell">Category</TableHead>
                <TableHead className="text-xs text-right">Cost</TableHead>
                <TableHead className="text-xs text-right">Price</TableHead>
                <TableHead className="text-xs text-right">Stock</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                {canEdit && <TableHead className="text-xs">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const status = getStockStatus(p);
                return (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => { if (canEdit) { setEditProduct(p); setShowForm(true); } }}
                  >
                    <TableCell className="text-xs font-medium">{p.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden sm:table-cell font-mono">{p.barcode || '-'}</TableCell>
                    <TableCell className="text-xs hidden md:table-cell">{p.brand || '-'}</TableCell>
                    <TableCell className="text-xs hidden lg:table-cell">{p.category?.name || '-'}</TableCell>
                    <TableCell className="text-xs text-right">{formatCurrency(p.costPrice)}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{formatCurrency(p.sellingPrice)}</TableCell>
                    <TableCell className="text-xs text-right">{p.currentQuantity} {p.unit}</TableCell>
                    <TableCell>
                      <Badge
                        variant={status === 'out' ? 'destructive' : status === 'low' ? 'secondary' : 'default'}
                        className="text-xs"
                      >
                        {status === 'out' ? 'Out' : status === 'low' ? 'Low' : 'OK'}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={(e) => { e.stopPropagation(); setRestockProduct(p); }}
                        >
                          <PackagePlus className="h-3.5 w-3.5 mr-1" />
                          Add Stock
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{total} products</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}

      <ProductFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        product={editProduct}
        onSaved={fetchProducts}
      />

      <RestockDialog
        open={!!restockProduct}
        onOpenChange={(open) => { if (!open) setRestockProduct(null); }}
        product={restockProduct}
        onSaved={fetchProducts}
      />
    </div>
  );
}
