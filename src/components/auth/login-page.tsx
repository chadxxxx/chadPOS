'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Eye, EyeOff, ArrowLeft, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';

type RecoveryStep = 'username' | 'code' | 'success';
type AuthView = 'login' | 'create';

export function LoginPage() {
  const { isSetupComplete, loginError, setup, login, clearError } = useAuthStore();

  // Default to login if setup done, create if not
  const [view, setView] = useState<AuthView>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('username');
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);

  // Set default view based on setup status once it's known
  useEffect(() => {
    if (isSetupComplete) {
      setView('login');
    }
  }, [isSetupComplete]);

  const switchView = (target: AuthView) => {
    // Clear errors and form when switching
    clearError();
    setPassword('');
    setConfirmPassword('');
    setView(target);
  };

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
    if (password.length < 8) return;
    setSubmitting(true);
    const ok = await setup(username.trim(), displayName.trim(), password, recoveryEmail.trim() || undefined);
    setSubmitting(false);
    if (!ok) {
      setTimeout(clearError, 5000);
    }
  };

  const openForgotPassword = () => {
    setRecoveryUsername('');
    setRecoveryCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setRecoveryError('');
    setRecoveryStep('username');
    setShowForgot(true);
  };

  const closeForgotPassword = () => {
    setShowForgot(false);
    setRecoveryError('');
  };

  const handleRecoveryUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryUsername.trim()) return;
    setRecoveryError('');
    setRecoveryStep('code');
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim()) {
      setRecoveryError('Please enter a recovery code.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setRecoveryError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setRecoveryError('Passwords do not match.');
      return;
    }

    setRecoverySubmitting(true);
    setRecoveryError('');

    try {
      const res = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: recoveryUsername.trim(),
          code: recoveryCode.trim(),
          newPassword,
        }),
      });

      const json = await res.json();

      if (json.error) {
        setRecoveryError(json.error);
        setRecoverySubmitting(false);
        return;
      }

      setRecoveryStep('success');
    } catch {
      setRecoveryError('Network error. Please try again.');
    } finally {
      setRecoverySubmitting(false);
    }
  };

  const handleRecoverySuccess = () => {
    setShowForgot(false);
    setRecoveryStep('username');
    setUsername(recoveryUsername.trim());
    setPassword('');
  };

  const setupFormError = password !== confirmPassword
    ? 'Passwords do not match.'
    : password.length > 0 && password.length < 8
      ? 'Password must be at least 8 characters.'
      : '';

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-semibold tracking-tight">
            Sari-Sari Store POS
          </CardTitle>
          <CardDescription>
            {view === 'login'
              ? 'Enter your credentials to access the system.'
              : isSetupComplete
                ? 'The store is already set up. Ask the owner for your account.'
                : 'Create your owner account to get started.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tab switcher */}
          <div className="flex rounded-lg bg-muted p-1 mb-5">
            <button
              type="button"
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                view === 'login'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => switchView('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                view === 'create'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => switchView('create')}
            >
              Create Account
            </button>
          </div>

          {/* LOGIN FORM */}
          {view === 'login' && (
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
                  className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
                  onClick={openForgotPassword}
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          )}

          {/* CREATE ACCOUNT FORM */}
          {view === 'create' && (
            <>
              {isSetupComplete ? (
                <div className="text-center space-y-4 py-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    The store has already been set up. Please ask the store owner to create an account for you.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => switchView('login')}>
                    Back to Sign In
                  </Button>
                </div>
              ) : (
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
                      autoFocus
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
                        placeholder="At least 8 characters"
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
                  {(loginError || setupFormError) && (
                    <p className="text-sm text-destructive">{loginError || setupFormError}</p>
                  )}
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? 'Creating Account...' : 'Create Account & Sign In'}
                  </Button>
                </form>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgot} onOpenChange={(open) => { if (!open) closeForgotPassword(); }}>
        <DialogContent className="sm:max-w-md">
          {recoveryStep === 'username' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  Forgot Password
                </DialogTitle>
                <DialogDescription>
                  Enter your username to start the recovery process. You will need a recovery code that was generated from the Account Recovery settings.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRecoveryUsername} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="recovery-username">Username</Label>
                  <Input
                    id="recovery-username"
                    placeholder="Enter your username"
                    value={recoveryUsername}
                    onChange={(e) => setRecoveryUsername(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {recoveryError && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {recoveryError}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={closeForgotPassword}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    Continue
                  </Button>
                </div>
              </form>
            </>
          )}

          {recoveryStep === 'code' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  Enter Recovery Code
                </DialogTitle>
                <DialogDescription>
                  Enter one of your recovery codes and choose a new password for <strong>{recoveryUsername}</strong>.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRecoverySubmit} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="recovery-code">Recovery Code</Label>
                  <Input
                    id="recovery-code"
                    placeholder="e.g. A1B2-C3D4-E5F6"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                    required
                    autoFocus
                    className="font-mono tracking-wider"
                  />
                  <p className="text-xs text-muted-foreground">
                    Recovery codes were generated in Settings &gt; Account Recovery.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                  <Input
                    id="confirm-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Re-enter your new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
                {recoveryError && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> {recoveryError}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setRecoveryError(''); setRecoveryStep('username'); }}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={recoverySubmitting}>
                    {recoverySubmitting ? 'Resetting...' : 'Reset Password'}
                  </Button>
                </div>
              </form>
            </>
          )}

          {recoveryStep === 'success' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Password Reset Successful
                </DialogTitle>
                <DialogDescription>
                  Your password has been changed. You can now sign in with your new password.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <Button className="w-full" onClick={handleRecoverySuccess}>
                  Back to Sign In
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
