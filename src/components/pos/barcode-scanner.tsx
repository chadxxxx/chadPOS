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
import { toast } from 'sonner';
import {
  Camera,
  CameraOff,
  Keyboard,
  SwitchCamera,
  Flashlight,
  AlertTriangle,
  Bug,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BarcodeScannerProps {
  mode: 'pos' | 'product';
  onBarcodeDetected: (barcode: string) => void;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<any>(null);
  const cooldownRef = useRef(false);
  const mountedRef = useRef(true);
  const scanRafRef = useRef<number>(0); // requestAnimationFrame id for our decode loop

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

  // Keep latest callback in ref to avoid re-starting scanner on callback change
  const onBarcodeDetectedRef = useRef(onBarcodeDetected);
  useEffect(() => { onBarcodeDetectedRef.current = onBarcodeDetected; }, [onBarcodeDetected]);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  /* ---- add a diagnostic error ---- */
  const addError = useCallback((msg: string) => {
    setDiagErrors((prev) => [msg.slice(0, 200), ...prev].slice(0, 15));
  }, []);

  /* ---- enumerate cameras ---- */
  const enumerateCameras = useCallback(async (): Promise<{ id: string; label: string }[]> => {
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

  /* ---- stop camera stream ---- */
  const stopStream = useCallback(() => {
    // Cancel our decode animation frame loop
    if (scanRafRef.current) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = 0;
    }
    // Tear down ZXing reader internals (canvas refs etc.)
    if (readerRef.current) {
      try { readerRef.current.reset(); } catch { /* ignore */ }
      readerRef.current = null;
    }
    // Stop media stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  /* ---- handle successful barcode detection ---- */
  const handleDetection = useCallback((result: any) => {
    if (cooldownRef.current || !mountedRef.current) return;

    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, COOLDOWN_MS);

    const format = String(result?.getBarcodeFormat?.() || 'Unknown');
    const text = result?.getText?.() || String(result);

    playBeep();
    vibrate();

    setDetectedBarcode(text);
    setDetectedFormat(format);
    setScannerState('detected');
    setScanCount((c) => c + 1);

    onBarcodeDetectedRef.current(text);

    setTimeout(() => {
      if (mountedRef.current) setScannerState('scanning');
    }, 1500);
  }, []);

  /* ---- start scanner with direct getUserMedia ---- */
  const startScanner = useCallback(
    async (cameraId?: string) => {
      if (!mountedRef.current) return;

      // Stop any existing stream first
      stopStream();

      setScannerState('starting');
      setErrorMsg('');

      try {
        // Step 1: Import ZXing dynamically (client-only)
        const { BrowserMultiFormatReader } = await import('@zxing/library');
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        addError('ZXing library loaded');

        // Step 2: Enumerate cameras first (may have empty labels before permission)
        const cams = await enumerateCameras();
        addError(`Found ${cams.length} video device(s)`);

        // Step 3: Determine which camera to use
        let targetDeviceId = cameraId || '';
        if (!targetDeviceId && cams.length > 0) {
          const rear = cams.find((c) => /back|rear|environment|camera 0/i.test(c.label));
          targetDeviceId = rear ? rear.id : cams[0].id;
        }

        // Step 4: Request camera access via getUserMedia - THIS triggers the permission dialog
        addError('Requesting camera access...');
        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 15 },
            ...(targetDeviceId ? { deviceId: { exact: targetDeviceId } } : { facingMode: 'environment' }),
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (!mountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        addError('Camera stream acquired: ' + stream.getVideoTracks().length + ' track(s)');
        setPermissionStatus('granted');

        // Step 5: Attach stream to video and play it ourselves.
        // We deliberately avoid ZXing's decodeFromStream / decodeFromVideoElementContinuously
        // because those methods call reset() internally which clears srcObject,
        // and their decodeContinuously loop can silently die when instanceof
        // checks fail across webpack ESM chunk boundaries. Instead we run our
        // own requestAnimationFrame loop and call reader.decode() directly.
        const video = videoRef.current;
        if (!video) {
          throw new Error('Video element not found in DOM');
        }

        video.srcObject = stream;
        addError('Stream attached to video element');

        // Wait for video metadata + first frame so videoWidth/videoHeight > 0
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => {
            video.removeEventListener('loadeddata', onLoaded);
            video.removeEventListener('error', onError);
            resolve();
          };
          const onError = () => {
            video.removeEventListener('loadeddata', onLoaded);
            video.removeEventListener('error', onError);
            reject(new Error('Video element failed to load camera stream'));
          };
          if (video.readyState >= 2) { // HAVE_CURRENT_DATA or better
            resolve();
          } else {
            video.addEventListener('loadeddata', onLoaded);
            video.addEventListener('error', onError);
          }
        });

        await video.play();
        addError('Video playing (' + video.videoWidth + 'x' + video.videoHeight + ')');

        // Step 6: Re-enumerate to get labels now that we have permission
        const updatedCams = await enumerateCameras();
        const activeTrack = stream.getVideoTracks()[0];
        const activeDeviceId = activeTrack?.getSettings()?.deviceId;
        setSelectedCameraId(activeDeviceId || targetDeviceId);

        // Step 7: Start OUR requestAnimationFrame decode loop.
        // We call reader.decode(video) on every frame ourselves, which only
        // does the core barcode decode (draw frame → binarize → decode bitmap)
        // without touching video management or internal event listeners.
        setScannerState('scanning');
        addError('Decode loop started - waiting for barcode');

        const scanLoop = () => {
          if (!mountedRef.current) return;
          try {
            const result = reader.decode(video);
            // Successful decode — result is a ZXing Result object
            handleDetection(result);
          } catch (e: any) {
            // NotFoundException is expected on every frame without a barcode.
            // Check by name/class instead of instanceof to avoid issues with
            // webpack ESM chunk splitting breaking class identity.
            const name = e?.constructor?.name || '';
            if (
              name === 'NotFoundException' ||
              name === 'ChecksumException' ||
              name === 'FormatException'
            ) {
              // Normal — no barcode in this frame, keep scanning
            } else {
              // Unexpected decode error — log but don't stop the loop
              addError('Decode err: ' + (e?.message || name).slice(0, 80));
            }
          }
          scanRafRef.current = requestAnimationFrame(scanLoop);
        };
        scanRafRef.current = requestAnimationFrame(scanLoop);

      } catch (err: any) {
        if (!mountedRef.current) return;
        const msg = err?.message || String(err);
        addError('Start failed: ' + msg);

        if (/permission|denied|NotAllowedError/i.test(msg)) {
          setErrorMsg('Camera permission was denied. Please allow camera access in your browser settings and try again.');
          setPermissionStatus('denied');
        } else if (/not.*found|NotFoundError/i.test(msg)) {
          setErrorMsg('No camera was found on this device. Please enter the barcode manually.');
        } else if (/secure context|https/i.test(msg)) {
          setErrorMsg('Camera access requires HTTPS. Your app must be served over a secure connection.');
        } else if (/Requested device not found/i.test(msg)) {
          setErrorMsg('Could not access the selected camera. Try switching cameras or enter the barcode manually.');
        } else {
          setErrorMsg('Could not start the scanner: ' + msg + '. Enter the barcode manually below.');
        }
        setScannerState('error');
        setManualMode(true);
      }
    },
    [stopStream, enumerateCameras, addError, handleDetection]
  );

  /* ---- switch camera ---- */
  const switchCamera = useCallback(async () => {
    const cams = cameraList.length > 0 ? cameraList : await enumerateCameras();
    if (cams.length < 2) {
      toast.error('Only one camera available.');
      return;
    }
    const currentIdx = cams.findIndex((c) => c.id === selectedCameraId);
    const nextIdx = (currentIdx + 1) % cams.length;
    startScanner(cams[nextIdx].id);
  }, [cameraList, selectedCameraId, enumerateCameras, startScanner]);

  /* ---- toggle torch/flashlight ---- */
  const toggleTorch = useCallback(async () => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) {
        toast.error('No active camera track.');
        return;
      }
      const caps = track.getCapabilities?.();
      if (!caps?.torch) {
        toast.error('Flashlight is not supported on this device/camera.');
        return;
      }
      const newState = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: newState }] as any });
      setTorchOn(newState);
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
    // Small delay to ensure DOM is painted before requesting camera
    const timer = setTimeout(() => {
      if (mountedRef.current && !manualMode) {
        startScanner();
      }
    }, 100);

    return () => {
      mountedRef.current = false;
      cooldownRef.current = false;
      clearTimeout(timer);
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- restart when exiting manual mode ---- */
  useEffect(() => {
    if (!manualMode && scannerState === 'error') {
      setErrorMsg('');
      startScanner();
    }
  }, [manualMode, scannerState, startScanner]);

  /* ---- check permission status on mount ---- */
  useEffect(() => {
    const check = async () => {
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
    };
    check();
  }, []);

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

              {/* Video element - direct camera feed */}
              <div className="relative w-full rounded-md overflow-hidden bg-black" style={{ minHeight: 240 }}>
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="w-full h-auto block"
                  style={{
                    minHeight: 240,
                    objectFit: 'cover',
                  }}
                />
                {/* Scanning overlay */}
                {scannerState === 'scanning' && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-3/4 h-2/5 border-2 border-white/70 rounded-lg relative">
                      {/* Scanning line animation */}
                      <div className="absolute left-0 right-0 h-0.5 bg-red-500/80 animate-bounce" style={{ top: '50%' }} />
                    </div>
                  </div>
                )}
                {/* Starting overlay */}
                {scannerState === 'starting' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="text-white text-sm flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      Starting camera…
                    </div>
                  </div>
                )}
              </div>

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
                    Switch
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
                  onClick={() => {
                    stopStream();
                    setManualMode(true);
                    setScannerState('idle');
                  }}
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
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    onClick={() => {
                      setManualMode(false);
                      setErrorMsg('');
                    }}
                  >
                    <Camera className="h-3.5 w-3.5 mr-1.5" />
                    Camera
                  </Button>
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
                    <p className="text-muted-foreground mb-1">Log:</p>
                    {diagnostics.errors.map((e, i) => (
                      <p key={i} className="text-foreground/80 break-all">• {e}</p>
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
