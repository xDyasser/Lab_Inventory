import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeResult } from "html5-qrcode";

// Props for the main scanner component
interface BarcodeScannerInlineProps {
  onScan: (code: string) => void;
  onError?: (err: string) => void;
  onClose?: () => void;
}

// ---------- ERROR BOUNDARY (No changes needed) ----------
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
    // You can log error details to a service here
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

// Function to filter out noisy, non-critical scanner messages
// Moved to module scope so it can be exported.
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
    "parse error", // Common between scans
    "QR code parse error",
    "found no usable camera",
    "unable to query supported devices",
  ];
  return !ignoredMessages.some(msg => err.includes(msg));
};

// ---------- SCANNER COMPONENT (Corrected for stability) ----------
const BarcodeScannerInline: React.FC<BarcodeScannerInlineProps> = ({
  onScan,
  onError,
  onClose,
}) => {
  // Use a ref to hold the scanner instance.
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Store callbacks in a ref to prevent the useEffect from re-running
  const callbacksRef = useRef({ onScan, onError, onClose });
  callbacksRef.current = { onScan, onError, onClose };

  useEffect(() => {
    const qrCodeRegionId = "barcode-scanner-inline";
    
    // Ensure the container element exists
    const container = document.getElementById(qrCodeRegionId);
    if (!container) {
      console.error("Scanner container element not found.");
      return;
    }

    // Only create a new instance if it doesn't already exist.
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(qrCodeRegionId);
    }
    const html5QrCode = scannerRef.current;
    
    // Guard to prevent multiple start attempts
    let isScannerStarted = false;

    const startScanner = async () => {
      if (isScannerStarted || html5QrCode.isScanning) {
        return;
      }

      try {
        await html5QrCode.start(
          { facingMode: "environment" }, // Prefer rear camera
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
          },
          // Success callback
          (decodedText: string, result: Html5QrcodeResult) => {
            if (isScannerStarted) {
                isScannerStarted = false; // Prevent multiple triggers
                callbacksRef.current.onScan(decodedText);
            }
          },
          // Error callback (for continuous scanning messages)
          (errorMessage: string) => {
            const msg = errorMessage || "An unknown error occurred.";
            callbacksRef.current.onError?.(msg);
            if (shouldShowError(msg)) {
              // setLocalError(msg); // Suppress UI error
            }
          }
        );
        isScannerStarted = true;

        // --- FIX: Prevent keyboard on tap-to-focus on mobile ---
        // Find the video element created by the library and add 'readOnly'
        const videoElement = container.querySelector("video");
        if (videoElement) {
          videoElement.setAttribute("readOnly", "true");
          // The 'playsInline' attribute is also good practice for iOS.
          videoElement.setAttribute("playsInline", "true");

          // --- FIX: Prevent keyboard on tap of the container ---
          // The library can add a tabindex to the container, making it focusable.
          container.removeAttribute("tabindex");

          // --- ROBUST FIX: Prevent default browser action on touch ---
          // This stops the browser from focusing and showing the keyboard.
          const preventDefaultTouch = (e: TouchEvent) => {
            e.preventDefault();
          };
          container.addEventListener("touchstart", preventDefaultTouch);
        }
      } catch (err: any) {
        let msg = `Failed to start scanner: ${String(err)}`;
        if (String(err).includes("NotAllowedError")) {
          msg = "Camera permission was denied. Please grant permission in your browser settings.";
        } else if (String(err).includes("NotReadableError")) {
          msg = "The camera is already in use. Please ensure no other application or browser tab is using it and try again.";
        }
        callbacksRef.current.onError?.(msg);
        // setLocalError(msg); // Suppress UI error
      }
    };

    startScanner();

    // --- Cleanup function on component unmount ---
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch((err) => {
          console.error("Failed to stop the scanner on cleanup.", err);
        });
      }
    };
  }, []); // <-- CRITICAL: Empty dependency array ensures this runs only ONCE.

  return (
    <ScannerErrorBoundary>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-4 rounded-lg shadow-lg flex flex-col items-center">
          <div id="barcode-scanner-inline" style={{ width: 260, height: 220, overflow: 'hidden' }} />
          <button
            type="button"
            className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
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