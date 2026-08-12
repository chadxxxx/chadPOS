'use client';

import { useNavStore, type ViewId } from '@/store/nav-store';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  Receipt,
  BarChart3,
  Wallet,
  Truck,
  Users,
  Settings,
  FileText,
  LogOut,
} from 'lucide-react';

interface NavItem {
  id: ViewId;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['OWNER', 'ADMIN'] },
  { id: 'pos', label: 'Point of Sale', icon: ShoppingCart, roles: ['OWNER', 'ADMIN', 'CASHIER'] },
  { id: 'products', label: 'Products', icon: Package, roles: ['OWNER', 'ADMIN'] },
  { id: 'inventory', label: 'Inventory', icon: Warehouse, roles: ['OWNER', 'ADMIN'] },
  { id: 'sales', label: 'Sales History', icon: Receipt, roles: ['OWNER', 'ADMIN'] },
  { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['OWNER', 'ADMIN'] },
  { id: 'expenses', label: 'Expenses', icon: Wallet, roles: ['OWNER', 'ADMIN'] },
  { id: 'suppliers', label: 'Suppliers', icon: Truck, roles: ['OWNER', 'ADMIN'] },
  { id: 'users', label: 'Users & Roles', icon: Users, roles: ['OWNER', 'ADMIN'] },
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['OWNER', 'ADMIN'] },
  { id: 'audit', label: 'Audit Log', icon: FileText, roles: ['OWNER'] },
];

export function Sidebar() {
  const { currentView, sidebarOpen, setView, setSidebarOpen } = useNavStore();
  const { user, logout } = useAuthStore();

  const role = user?.role || '';
  const visibleItems = navItems.filter((item) => item.roles.includes(role));
  const isCashier = role === 'CASHIER';

  const handleNavClick = (viewId: ViewId) => {
    setView(viewId);
    setSidebarOpen(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4 border-b border-border">
        <h1 className="text-sm font-semibold text-foreground truncate">
          {isCashier ? 'POS Terminal' : 'My Sari-Sari Store'}
        </h1>
      </div>
      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-1 px-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>
      <Separator />
      <div className="p-3 space-y-2">
        <div className="px-3 py-1">
          <p className="text-sm font-medium text-foreground truncate">{user?.displayName || 'User'}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive min-h-[44px]"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm">Sign Out</span>
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col border-r border-border bg-card">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-card shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
