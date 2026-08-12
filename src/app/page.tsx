'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useNavStore } from '@/store/nav-store';
import { LoadingScreen } from '@/components/auth/loading-screen';
import { LoginPage } from '@/components/auth/login-page';
import { AppShell } from '@/components/layout/app-shell';

export default function Page() {
  const { isAuthenticated, isLoading, checkSession } = useAuthStore();
  const setView = useNavStore((s) => s.setView);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (isAuthenticated) {
      setView('dashboard');
    }
  }, [isAuthenticated, setView]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AppShell />;
}
