'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Camera, Keyboard } from 'lucide-react';

interface BarcodeScannerProps {
  mode: 'pos' | 'product';
  onProductFound: (product: any) => void;
  onClose: () => void;
}

export function BarcodeScanner({ mode, onProductFound, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [scanning, setScanning] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const handleBarcodeResult = async (barcode: string) => {
    setScanning(true);
    try {
      const res = await apiFetch('/api/barcode/lookup?barcode=' + encodeURIComponent(barcode));
      if (res.data && (res.data as any).found) {
        onProductFound((res.data as any).product);
        onClose();
      } else {
        toast.error('Product not found for barcode: ' + barcode);
      }
    } catch {
      toast.error('Failed to look up barcode.');
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (manualMode) return;

    let cancelled = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Check BarcodeDetector support
        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] });
          const detect = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                handleBarcodeResult(barcodes[0].rawValue);
                return;
              }
            } catch {
              // detection failed, continue scanning
            }
            if (!cancelled) requestAnimationFrame(detect);
          };
          detect();
        }
      } catch (err: any) {
        if (!cancelled) {
          setCameraError(err.name === 'NotAllowedError' ? 'Camera permission denied.' : 'Could not access camera.');
          setManualMode(true);
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [manualMode]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;
    handleBarcodeResult(manualBarcode.trim());
  };

  const barcodeDetectorSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Scan Barcode</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {manualMode || cameraError || !barcodeDetectorSupported ? (
            <div className="space-y-3">
              {cameraError && !manualMode && (
                <p className="text-sm text-destructive">{cameraError}</p>
              )}
              {!barcodeDetectorSupported && !manualMode && (
                <p className="text-sm text-muted-foreground">
                  Barcode scanning is not supported in this browser. Enter the barcode manually.
                </p>
              )}
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="manual-barcode">Barcode</Label>
                  <Input
                    id="manual-barcode"
                    placeholder="Enter barcode number"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={scanning || !manualBarcode.trim()}>
                    {scanning ? 'Looking up...' : 'Look Up'}
                  </Button>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative aspect-video rounded-md overflow-hidden bg-black">
                <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
              </div>
              <p className="text-xs text-center text-muted-foreground">Point camera at a barcode to scan</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setManualMode(true)}
                >
                  <Keyboard className="h-4 w-4 mr-2" />
                  Enter Manually
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
