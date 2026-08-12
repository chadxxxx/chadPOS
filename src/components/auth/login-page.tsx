'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const { checkSetup, isSetupComplete, isLoading, loginError, setup, login, clearError } = useAuthStore();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSubmitting(true);
    const ok = await login(username.trim(), password);
    setSubmitting(false);
    if (!ok) {
      setTimeout(clearError, 5000);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !displayName.trim() || !password || password !== confirmPassword) return;
    if (password.length < 6) return;
    setSubmitting(true);
    const ok = await setup(username.trim(), displayName.trim(), password, recoveryEmail.trim() || undefined);
    setSubmitting(false);
    if (!ok) {
      setTimeout(clearError, 5000);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
      </div>
    );
  }

  const setupError = !isSetupComplete
    ? password !== confirmPassword
      ? 'Passwords do not match.'
      : password.length > 0 && password.length < 6
        ? 'Password must be at least 6 characters.'
        : ''
    : '';

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold tracking-tight">
            {isSetupComplete ? 'Sign In' : 'Store Setup'}
          </CardTitle>
          <CardDescription>
            {isSetupComplete
              ? 'Enter your credentials to access the POS system.'
              : 'Create your owner account to get started.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSetupComplete ? (
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setup-username">Username</Label>
                <Input
                  id="setup-username"
                  placeholder="e.g. owner"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-displayname">Display Name</Label>
                <Input
                  id="setup-displayname"
                  placeholder="e.g. Juan Dela Cruz"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-password">Password</Label>
                <div className="relative">
                  <Input
                    id="setup-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-confirm">Confirm Password</Label>
                <Input
                  id="setup-confirm"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-email">Recovery Email (optional)</Label>
                <Input
                  id="setup-email"
                  type="email"
                  placeholder="your@email.com"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              {(loginError || setupError) && (
                <p className="text-sm text-destructive">{loginError || setupError}</p>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Creating Account...' : 'Create Account & Sign In'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-username">Username</Label>
                <Input
                  id="login-username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {loginError && (
                <p className="text-sm text-destructive">{loginError}</p>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Signing In...' : 'Sign In'}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
