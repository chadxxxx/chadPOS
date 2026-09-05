'use client';

import { useEffect, useState } from 'react';

export function LoadingScreen() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
        <p className="text-sm text-muted-foreground">
          {slow ? 'Taking longer than expected…' : 'Loading...'}
        </p>
        {slow && (
          <p className="text-xs text-muted-foreground/70 text-center max-w-xs">
            If this persists, try refreshing the page or clearing your browser cache.
          </p>
        )}
      </div>
    </div>
  );
}
