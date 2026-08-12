'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './sidebar';
import { useNavStore } from '@/store/nav-store';
import { apiFetch } from '@/lib/api';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { PosView } from '@/components/pos/pos-view';
import { ProductListView } from '@/components/products/product-list-view';
import { InventoryView } from '@/components/inventory/inventory-view';
import { SalesView } from '@/components/sales/sales-view';
import { ReportsView } from '@/components/reports/reports-view';
import { ExpensesView } from '@/components/expenses/expenses-view';
import { SuppliersView } from '@/components/suppliers/suppliers-view';
import { UsersView } from '@/components/users/users-view';
import { SettingsView } from '@/components/settings/settings-view';
import { AuditView } from '@/components/audit/audit-view';

export function AppShell() {
  const { currentView, toggleSidebar } = useNavStore();
  const [storeName, setStoreName] = useState('My Sari-Sari Store');

  useEffect(() => {
    apiFetch<Record<string, string>>('/api/settings').then((res) => {
      if (res.data?.storeName) {
        setStoreName(res.data.storeName);
      }
    });
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'pos':
        return <PosView />;
      case 'products':
        return <ProductListView />;
      case 'inventory':
        return <InventoryView />;
      case 'sales':
        return <SalesView />;
      case 'reports':
        return <ReportsView />;
      case 'expenses':
        return <ExpensesView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'users':
        return <UsersView />;
      case 'settings':
        return <SettingsView />;
      case 'audit':
        return <AuditView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-sm font-semibold truncate">{storeName}</h1>
      </header>

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="p-4 md:p-6">{renderView()}</div>
      </main>
    </div>
  );
}
