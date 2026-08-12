'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './sidebar';
import { useNavStore } from '@/store/nav-store';
import { useAuthStore } from '@/store/auth-store';
import { apiFetch } from '@/lib/api';
import { Menu, LogOut } from 'lucide-react';
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
import { UtangView } from '@/components/utang/utang-view';
import { SettingsView } from '@/components/settings/settings-view';
import { AuditView } from '@/components/audit/audit-view';

export function AppShell() {
  const { currentView, toggleSidebar } = useNavStore();
  const { user, logout } = useAuthStore();
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
      case 'utang':
        return <UtangView />;
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
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-card px-4 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={toggleSidebar}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-sm font-semibold truncate flex-1">
          {user?.role === 'CASHIER' ? 'POS Terminal' : storeName}
        </h1>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={logout}
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="p-4 md:p-6">{renderView()}</div>
      </main>
    </div>
  );
}
