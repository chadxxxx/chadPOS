'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  mode: 'pos' | 'product' | 'inventory';
  onProductFound: (product: any) => void;
  onClose: () => void;
}

export function BarcodeScanner({ mode, onProductFound, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [scanning, setScanning] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const zxingRef = useRef<any>(null);

  const handleBarcodeResult = useCallback(async (barcode: string) => {
    if (scanning) return;
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
  }, [scanning, onProductFound, onClose]);

  useEffect(() => {
    if (manualMode) return;

    let cancelled = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Try native BarcodeDetector first (Chrome/Edge)
        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf'],
          });
          const detect = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                handleBarcodeResult(barcodes[0].rawValue);
                return;
              }
            } catch { /* continue scanning */ }
            if (!cancelled) animFrameRef.current = requestAnimationFrame(detect);
          };
          detect();
        } else {
          // Fallback: use ZXing library for Firefox/Safari
          try {
            const ZXing = await import('@zxing/library');
            const reader = new ZXing.BrowserMultiFormatReader();
            zxingRef.current = reader;

            const scan = () => {
              if (cancelled || !videoRef.current || !canvasRef.current) return;
              try {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx && videoRef.current.readyState >= 2) {
                  canvas.width = videoRef.current.videoWidth;
                  canvas.height = videoRef.current.videoHeight;
                  ctx.drawImage(videoRef.current, 0, 0);
                  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  const result = reader.decodeFromImageData(imgData);
                  if (result) {
                    handleBarcodeResult(result.getText());
                    return;
                  }
                }
              } catch { /* no barcode found, continue */ }
              if (!cancelled) animFrameRef.current = requestAnimationFrame(scan);
            };
            scan();
          } catch (err) {
            if (!cancelled) {
              setCameraError('Barcode scanning library failed to load. Please enter barcode manually.');
              setManualMode(true);
            }
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err.name === 'NotAllowedError') {
            setCameraError('Camera permission denied. Please allow camera access or enter the barcode manually.');
          } else if (err.name === 'NotFoundError') {
            setCameraError('No camera found. Please enter the barcode manually.');
          } else {
            setCameraError('Could not access camera. Please enter the barcode manually.');
          }
          setManualMode(true);
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [manualMode, handleBarcodeResult]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;
    handleBarcodeResult(manualBarcode.trim());
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Scan Barcode
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {manualMode || cameraError ? (
            <div className="space-y-3">
              {cameraError && (
                <div className="rounded-md bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">{cameraError}</p>
                </div>
              )}
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="manual-barcode">Barcode Number</Label>
                  <Input
                    id="manual-barcode"
                    placeholder="Enter or scan barcode with physical scanner"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    autoFocus
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    You can also use a physical barcode scanner with a keyboard wedge
                  </p>
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
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                {/* Scanning overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/2 left-4 right-4 h-0.5 -translate-y-1/2 bg-red-500/70 animate-pulse rounded" />
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Point camera at a barcode to scan automatically
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setManualMode(true)}>
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
