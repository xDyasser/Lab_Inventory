import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeResult } from "html5-qrcode";

// Props for the main scanner component
interface BarcodeScannerInlineProps {
  onScan: (code: string) => void;
  onError?: (err: string) => void;
  onClose?: () => void;
}

// ---------- ERROR BOUNDARY ----------
interface ScannerErrorBoundaryProps {
  children: React.ReactNode;
}

interface ScannerErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ScannerErrorBoundary extends React.Component<
  ScannerErrorBoundaryProps,
  ScannerErrorBoundaryState
> {
  state: ScannerErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(
    error: any
  ): Partial<ScannerErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error("Scanner error boundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-700 bg-red-100 p-2 rounded">
          Scanner error: {String(this.state.error)}
        </div>
      );
    }
    return this.props.children;
  }
}

// Filter out noisy scanner messages
export const shouldShowError = (err: string): boolean => {
  if (!err) return false;
  const ignoredMessages = [
    "IndexSizeError",
    "NotFoundException",
    "NotAllowedError",
    "NotReadableError",
    "OverconstrainedError",
    "StreamApiNotSupportedError",
    "Invalid-State",
    "parse error",
    "QR code parse error",
    "found no usable camera",
    "unable to query supported devices",
  ];
  return !ignoredMessages.some((msg) => err.includes(msg));
};

// ---------- SCANNER COMPONENT (PWA Optimized) ----------
const BarcodeScannerInline: React.FC<BarcodeScannerInlineProps> = ({
  onScan,
  onError,
  onClose,
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const hasScannedRef = useRef(false); // Prevent duplicate scans

  // Store callbacks in a ref to prevent useEffect re-runs
  const callbacksRef = useRef({ onScan, onError, onClose });
  callbacksRef.current = { onScan, onError, onClose };

  const cleanupTouchListenerRef = useRef<() => void>(() => {});
  const qrCodeRegionId = "barcode-scanner-inline";

  useEffect(() => {
    const container = document.getElementById(qrCodeRegionId);
    if (!container) {
      console.error("Scanner container element not found.");
      setIsInitializing(false);
      return;
    }

    let isCleanedUp = false;

    const startScanner = async () => {
      try {
        // Create new instance only if needed
        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode(qrCodeRegionId);
        }
        const html5QrCode = scannerRef.current;

        // Don't start if already scanning
        if (html5QrCode.isScanning) {
          setIsInitializing(false);
          return;
        }

        // iOS-friendly camera constraints
        const cameraConfig = { facingMode: "environment" };
        
        await html5QrCode.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              // Larger scan area for iOS
              return { width: minEdge * 0.85, height: minEdge * 0.85 };
            },
            aspectRatio: 1.0,
          },
          // Success callback
          (decodedText: string, result: Html5QrcodeResult) => {
            if (!hasScannedRef.current && !isCleanedUp) {
              hasScannedRef.current = true;
              
              // Haptic feedback for PWA (if available)
              if ('vibrate' in navigator) {
                navigator.vibrate(200);
              }
              
              callbacksRef.current.onScan(decodedText);
            }
          },
          // Error callback (continuous scanning noise)
          (errorMessage: string) => {
            if (isCleanedUp) return;
            const msg = errorMessage || "An unknown error occurred.";
            if (shouldShowError(msg)) {
              callbacksRef.current.onError?.(msg);
            }
          }
        );

        setIsInitializing(false);

        // --- PWA/Mobile optimizations ---
        const videoElement = container.querySelector("video");
        if (videoElement) {
          // Critical iOS compatibility attributes
          videoElement.setAttribute("playsinline", "true");
          videoElement.setAttribute("webkit-playsinline", "true");
          videoElement.setAttribute("x5-playsinline", "true");
          videoElement.setAttribute("autoplay", "true");
          videoElement.setAttribute("muted", "true");
          
          // Prevent input focus
          videoElement.setAttribute("readonly", "true");
          videoElement.style.pointerEvents = "none";
          
          // iOS Safari needs explicit dimensions
          videoElement.style.width = "100%";
          videoElement.style.height = "100%";
          videoElement.style.objectFit = "cover";
          videoElement.style.position = "absolute";
          videoElement.style.top = "0";
          videoElement.style.left = "0";
          
          // Force hardware acceleration on iOS
          videoElement.style.transform = "translateZ(0)";
          videoElement.style.webkitTransform = "translateZ(0)";

          // Prevent container focus
          container.removeAttribute("tabindex");
          container.style.outline = "none";
          // TypeScript-safe way to set webkit property
          (container.style as any).webkitTapHighlightColor = "transparent";

          // Prevent touch interference
          const preventDefaultTouch = (e: TouchEvent) => {
            e.preventDefault();
          };
          container.addEventListener("touchstart", preventDefaultTouch, {
            passive: false,
          });
          
          // iOS-specific: prevent double-tap zoom
          let lastTap = 0;
          const preventDoubleTap = (e: TouchEvent) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 500 && tapLength > 0) {
              e.preventDefault();
            }
            lastTap = currentTime;
          };
          container.addEventListener("touchend", preventDoubleTap, {
            passive: false,
          });
          
          cleanupTouchListenerRef.current = () => {
            container.removeEventListener("touchstart", preventDefaultTouch);
            container.removeEventListener("touchend", preventDoubleTap);
          };
        }
      } catch (err: any) {
        if (isCleanedUp) return;
        
        setIsInitializing(false);
        let msg = `Failed to start scanner: ${String(err)}`;
        
        if (String(err).includes("NotAllowedError")) {
          msg =
            "Camera permission denied. Please enable camera access in your device settings.";
        } else if (String(err).includes("NotReadableError")) {
          msg =
            "Camera is in use by another app. Please close other camera apps and try again.";
        } else if (String(err).includes("NotFoundError")) {
          msg = "No camera found on this device.";
        }
        
        setLocalError(msg);
        callbacksRef.current.onError?.(msg);
      }
    };

    startScanner();

    // Cleanup on unmount
    return () => {
      isCleanedUp = true;
      hasScannedRef.current = false;
      cleanupTouchListenerRef.current();

      const html5QrCode = scannerRef.current;
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode
            .stop()
            .then(() => {
              // Clear the scanner instance
              scannerRef.current = null;
            })
            .catch((err) => {
              console.error("Failed to stop scanner:", err);
            });
        }
      }
    };
  }, []); // Run only once

  return (
    <ScannerErrorBoundary>
      <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
        <div className="bg-white p-4 rounded-lg shadow-lg flex flex-col items-center max-w-sm w-full mx-4">
          {/* Scanner Container */}
          <div
            id={qrCodeRegionId}
            style={{
              width: "100%",
              maxWidth: 320,
              height: 320,
              overflow: "hidden",
              position: "relative",
              borderRadius: "8px",
              backgroundColor: "#000",
              // iOS performance boost
              WebkitTransform: "translateZ(0)",
              transform: "translateZ(0)",
            }}
          />

          {/* Loading State */}
          {isInitializing && (
            <div className="mt-2 text-sm text-gray-600">
              Initializing camera...
            </div>
          )}

          {/* Error Display */}
          {localError && (
            <div className="mt-2 text-sm text-red-600 text-center">
              {localError}
            </div>
          )}

          {/* Instructions */}
          {!localError && !isInitializing && (
            <div className="mt-2 text-sm text-gray-600 text-center">
              Position the barcode in the center
            </div>
          )}

          {/* Close Button */}
          <button
            type="button"
            className="mt-4 px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 active:bg-gray-400 text-sm font-medium transition-colors"
            onClick={callbacksRef.current.onClose}
          >
            Close Scanner
          </button>
        </div>
      </div>
    </ScannerErrorBoundary>
  );
};

export default BarcodeScannerInline;