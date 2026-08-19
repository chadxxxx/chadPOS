'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import {
  Camera,
  CameraOff,
  Keyboard,
  SwitchCamera,
  Flashlight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Bug,
  Plus,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BarcodeScannerProps {
  mode: 'pos' | 'product';
  onBarcodeDetected: (barcode: string) => void;  // raw barcode string
  onClose: () => void;
}

interface Diagnostics {
  permissionStatus: string;
  selectedCamera: string;
  scannerState: string;
  lastBarcode: string;
  lastFormat: string;
  errors: string[];
  scanCount: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COOLDOWN_MS = 1500;
const SUPPORTED_FORMATS = [
  'EAN_13',
  'EAN_8',
  'UPC_A',
  'UPC_E',
  'CODE_128',
  'CODE_39',
  'CODE_93',
  'ITF',
  'QR_CODE',
  'DATA_MATRIX',
  'CODABAR',
];

/* ------------------------------------------------------------------ */
/*  Beep utility (Web Audio API)                                       */
/* ------------------------------------------------------------------ */

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1200;
    osc.type = 'sine';
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    /* audio not available */
  }
}

function vibrate() {
  try {
    if (navigator.vibrate) navigator.vibrate(100);
  } catch {
    /* vibration not available */
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function BarcodeScanner({ mode, onBarcodeDetected, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cooldownRef = useRef(false);
  const mountedRef = useRef(true);

  // UI state
  const [scannerState, setScannerState] = useState<
    'idle' | 'starting' | 'scanning' | 'detected' | 'error'
  >('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [detectedBarcode, setDetectedBarcode] = useState('');
  const [detectedFormat, setDetectedFormat] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraList, setCameraList] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const [diagErrors, setDiagErrors] = useState<string[]>([]);
  const [permissionStatus, setPermissionStatus] = useState('checking...');

  // Keep latest callback in ref
  const onBarcodeDetectedRef = useRef(onBarcodeDetected);
  useEffect(() => { onBarcodeDetectedRef.current = onBarcodeDetected; }, [onBarcodeDetected]);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  /* ---- add a diagnostic error ---- */
  const addError = useCallback((msg: string) => {
    setDiagErrors((prev) => [msg.slice(0, 120), ...prev].slice(0, 10));
  }, []);

  /* ---- check camera permission status ---- */
  const checkPermission = useCallback(async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' as any });
        setPermissionStatus(result.state);
        result.onchange = () => {
          if (mountedRef.current) setPermissionStatus(result.state);
        };
      } else {
        setPermissionStatus('unknown (API unavailable)');
      }
    } catch {
      setPermissionStatus('unknown');
    }
  }, []);

  /* ---- enumerate cameras ---- */
  const enumerateCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({ id: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 8)}` }));
      setCameraList(cams);
      return cams;
    } catch (err: any) {
      addError('enumerateDevices failed: ' + (err.message || err));
      return [];
    }
  }, [addError]);

  /* ---- start scanner ---- */
  const startScanner = useCallback(
    async (cameraId?: string) => {
      if (!containerRef.current) return;
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch { /* ignore */ }
      }

      setScannerState('starting');
      setErrorMsg('');

      try {
        // Dynamic import to avoid SSR issues
        const { Html5Qrcode } = await import('html5-qrcode');

        const scanner = new Html5Qrcode('barcode-scanner-region');
        scannerRef.current = scanner;

        const config: any = {
          formatsToSupport: SUPPORTED_FORMATS,
          fps: 15,
          qrbox: function(viewfinderWidth: number, viewfinderHeight: number) {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.floor(minEdge * 0.75);
            return { width: Math.max(qrboxSize, 150), height: Math.max(Math.floor(qrboxSize * 0.5), 100) };
          },
          aspectRatio: 1.5,
        };

        // Prefer rear camera by default
        let camId = cameraId || '';
        if (!camId) {
          const cams = await enumerateCameras();
          const rear = cams.find(
            (c) =>
              /back|rear|environment/i.test(c.label)
          );
          if (rear) camId = rear.id;
        }

        await scanner.start(
          camId || undefined,
          {
            facingMode: camId ? undefined : 'environment',
          },
          { width: 1280, height: 720 },
          onScanSuccess,
          onScanFailure,
        );

        if (!mountedRef.current) {
          await scanner.stop();
          return;
        }

        setScannerState('scanning');
        setSelectedCameraId(camId);
        checkPermission();

        // Re-enumerate to get labels after permission grant
        enumerateCameras();
      } catch (err: any) {
        if (!mountedRef.current) return;
        const msg = err?.message || String(err);
        addError('Start failed: ' + msg);

        if (/permission|denied|NotAllowedError/i.test(msg)) {
          setErrorMsg(
            'Camera permission was denied. Please allow camera access in your browser settings and try again.'
          );
          setPermissionStatus('denied');
        } else if (/not.*found|NotFoundError/i.test(msg)) {
          setErrorMsg('No camera was found on this device. Please enter the barcode manually.');
        } else if (/secure context|https/i.test(msg)) {
          setErrorMsg(
            'Camera access requires HTTPS. Your app must be served over a secure connection to use the camera.'
          );
        } else if (/Requested device not found/i.test(msg)) {
          setErrorMsg(
            'Could not access the selected camera. Try switching to a different camera or enter the barcode manually.'
          );
        } else {
          setErrorMsg('Could not start the scanner: ' + msg + '. Enter the barcode manually below.');
        }
        setScannerState('error');
        setManualMode(true);
      }
    },
    [addError, checkPermission, enumerateCameras]
  );

  /* ---- scan success callback ---- */
  const onScanSuccess = useCallback(
    (decodedText: string, decodedResult: any) => {
      if (cooldownRef.current || !mountedRef.current) return;

      // Cooldown to prevent duplicate scans
      cooldownRef.current = true;
      setTimeout(() => {
        cooldownRef.current = false;
      }, COOLDOWN_MS);

      const format = decodedResult?.result?.format?.formatName || decodedResult?.formatName || 'Unknown';

      // Feedback
      playBeep();
      vibrate();

      setDetectedBarcode(decodedText);
      setDetectedFormat(format);
      setScannerState('detected');
      setScanCount((c) => c + 1);

      // Fire the callback — the parent handles product lookup / not-found
      onBarcodeDetectedRef.current(decodedText);

      // After showing detected state, go back to scanning
      setTimeout(() => {
        if (mountedRef.current) setScannerState('scanning');
      }, 1500);
    },
    []
  );

  /* ---- scan failure callback (called on every non-detection frame) ---- */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const onScanFailure = useCallback(() => {
    // This is called continuously when no barcode is found — do nothing
  }, []);

  /* ---- switch camera ---- */
  const switchCamera = useCallback(async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
      scannerRef.current = null;
    } catch { /* ignore */ }

    const cams = cameraList.length > 0 ? cameraList : await enumerateCameras();
    const currentIdx = cams.findIndex((c) => c.id === selectedCameraId);
    const nextIdx = (currentIdx + 1) % cams.length;
    if (cams.length > 0) {
      startScanner(cams[nextIdx].id);
    }
  }, [cameraList, selectedCameraId, enumerateCameras, startScanner]);

  /* ---- toggle torch/flashlight ---- */
  const toggleTorch = useCallback(async () => {
    try {
      const track = scannerRef.current?.getRunningTrackCameraCapabilities?.();
      if (track?.torchFeature && track.torchFeature().isSupported()) {
        const newState = !torchOn;
        await track.torchFeature().apply(newState);
        setTorchOn(newState);
        return;
      }
      // Fallback: try to find the video track directly
      const stream = containerRef.current?.querySelector('video')?.srcObject as MediaStream | null;
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        const caps = videoTrack?.getCapabilities?.();
        if (caps?.torch) {
          const newState = !torchOn;
          await videoTrack.applyConstraints({ advanced: [{ torch: newState }] as any });
          setTorchOn(newState);
          return;
        }
      }
      toast.error('Flashlight is not supported on this device/camera.');
    } catch (err: any) {
      addError('Torch error: ' + (err.message || err));
      toast.error('Could not toggle flashlight.');
    }
  }, [torchOn, addError]);

  /* ---- manual barcode submit ---- */
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bc = manualBarcode.trim();
    if (!bc) return;
    setManualSubmitting(true);
    playBeep();
    vibrate();
    onBarcodeDetectedRef.current(bc);
    setDetectedBarcode(bc);
    setDetectedFormat('manual');
    setTimeout(() => {
      if (mountedRef.current) setManualSubmitting(false);
    }, 800);
  };

  /* ---- mount / unmount ---- */
  useEffect(() => {
    mountedRef.current = true;
    if (!manualMode) {
      startScanner();
    }
    return () => {
      mountedRef.current = false;
      cooldownRef.current = false;
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          })
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- restart when exiting manual mode ---- */
  useEffect(() => {
    if (!manualMode && scannerState === 'error') {
      startScanner();
    }
  }, [manualMode, scannerState, startScanner]);

  /* ---- diagnostics object ---- */
  const diagnostics: Diagnostics = {
    permissionStatus,
    selectedCamera: selectedCameraId
      ? cameraList.find((c) => c.id === selectedCameraId)?.label || selectedCameraId.slice(0, 12)
      : 'none',
    scannerState,
    lastBarcode: detectedBarcode || 'none',
    lastFormat: detectedFormat || 'none',
    errors: diagErrors,
    scanCount,
  };

  /* ================================================================== */
  /*  RENDER                                                             */
  /* ================================================================== */

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCloseRef.current(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Scan Barcode
          </DialogTitle>
          <DialogDescription className="text-xs">
            Point the camera at a barcode. Supports EAN-13, EAN-8, UPC-A, Code 128, QR Code and more.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* ---------- Camera view ---------- */}
          {!manualMode && (
            <>
              {/* Success flash overlay */}
              {scannerState === 'detected' && (
                <div className="rounded-md bg-emerald-500/15 border border-emerald-500/40 p-3 text-center animate-in fade-in duration-200">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                    ✓ {detectedBarcode}
                  </p>
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
                    {detectedFormat} • Looking up product…
                  </p>
                </div>
              )}

              {/* Error banner */}
              {errorMsg && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{errorMsg}</p>
                </div>
              )}

              {/* Video container — html5-qrcode renders here */}
              <div
                id="barcode-scanner-region"
                ref={containerRef}
                className="w-full rounded-md overflow-hidden bg-black relative"
                style={{ minHeight: manualMode ? 0 : 220 }}
              />

              {/* Status indicator */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      scannerState === 'scanning'
                        ? 'bg-emerald-500 animate-pulse'
                        : scannerState === 'detected'
                        ? 'bg-emerald-500'
                        : scannerState === 'starting'
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-red-500'
                    }`}
                  />
                  {scannerState === 'scanning' && 'Scanning…'}
                  {scannerState === 'starting' && 'Starting camera…'}
                  {scannerState === 'detected' && 'Barcode detected!'}
                  {scannerState === 'error' && 'Scanner error'}
                  {scannerState === 'idle' && 'Idle'}
                </div>
                {scanCount > 0 && <span>{scanCount} scan{scanCount !== 1 ? 's' : ''}</span>}
              </div>

              {/* Camera controls */}
              <div className="flex gap-2">
                {cameraList.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9 text-xs"
                    onClick={switchCamera}
                  >
                    <SwitchCamera className="h-3.5 w-3.5 mr-1.5" />
                    Switch Camera
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 text-xs"
                  onClick={toggleTorch}
                >
                  <Flashlight className={`h-3.5 w-3.5 mr-1.5 ${torchOn ? 'text-amber-500' : ''}`} />
                  {torchOn ? 'Torch ON' : 'Torch'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 text-xs"
                  onClick={() => setManualMode(true)}
                >
                  <Keyboard className="h-3.5 w-3.5 mr-1.5" />
                  Manual
                </Button>
              </div>
            </>
          )}

          {/* ---------- Manual mode ---------- */}
          {manualMode && (
            <div className="space-y-3">
              {errorMsg && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{errorMsg}</p>
                </div>
              )}
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="manual-barcode">Barcode Number</Label>
                  <Input
                    id="manual-barcode"
                    placeholder="Enter or paste barcode number"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Type the barcode number manually. A physical USB/Bluetooth barcode scanner will also work here.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="flex-1 h-10"
                    disabled={manualSubmitting || !manualBarcode.trim()}
                  >
                    {manualSubmitting ? 'Looking up…' : 'Look Up Barcode'}
                  </Button>
                  {!errorMsg && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10"
                      onClick={() => setManualMode(false)}
                    >
                      <Camera className="h-3.5 w-3.5 mr-1.5" />
                      Camera
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    onClick={() => onCloseRef.current()}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          <Separator />

          {/* ---------- Debug / Diagnostics toggle ---------- */}
          <div>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowDebug((v) => !v)}
            >
              <Bug className="h-3 w-3" />
              {showDebug ? 'Hide' : 'Show'} Diagnostics
            </button>

            {showDebug && (
              <div className="mt-2 rounded-md bg-muted/60 border p-3 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Permission:</span>
                  <Badge
                    variant={
                      permissionStatus === 'granted'
                        ? 'secondary'
                        : permissionStatus === 'denied'
                        ? 'destructive'
                        : 'outline'
                    }
                    className="text-[10px] px-1.5"
                  >
                    {diagnostics.permissionStatus}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scanner:</span>
                  <span>{diagnostics.scannerState}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Camera:</span>
                  <span className="truncate max-w-[180px]" title={diagnostics.selectedCamera}>
                    {diagnostics.selectedCamera}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Barcode:</span>
                  <span className="font-semibold">{diagnostics.lastBarcode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format:</span>
                  <span>{diagnostics.lastFormat}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Scans:</span>
                  <span>{diagnostics.scanCount}</span>
                </div>
                {diagnostics.errors.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t">
                    <p className="text-muted-foreground mb-1">Errors:</p>
                    {diagnostics.errors.map((e, i) => (
                      <p key={i} className="text-destructive/80 break-all">• {e}</p>
                    ))}
                  </div>
                )}
                {cameraList.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t">
                    <p className="text-muted-foreground mb-1">Available Cameras ({cameraList.length}):</p>
                    {cameraList.map((c) => (
                      <p key={c.id} className={c.id === selectedCameraId ? 'text-emerald-600' : ''}>
                        {c.id === selectedCameraId ? '► ' : '  '}{c.label}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
