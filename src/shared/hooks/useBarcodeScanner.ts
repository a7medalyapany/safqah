import { useEffect, useRef } from "react";

const SCANNER_GAP_MS = 100;
const MIN_BARCODE_LENGTH = 4;

type ScanSnapshot = {
  buffer: string;
  startedAt: number | null;
  endedAt: number;
};

export function isPrintableKey(key: string) {
  return key.length === 1;
}

export function shouldAcceptBarcodeScan({
  buffer,
  startedAt,
  endedAt,
}: ScanSnapshot) {
  if (!startedAt || buffer.length < MIN_BARCODE_LENGTH) {
    return false;
  }

  return endedAt - startedAt < SCANNER_GAP_MS;
}

export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  enabled: boolean = true,
): void {
  const bufferRef = useRef("");
  const startedAtRef = useRef<number | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const clearBuffer = () => {
      bufferRef.current = "";
      startedAtRef.current = null;

      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
    };

    if (!enabled) {
      clearBuffer();
      return;
    }

    const scheduleBufferReset = () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }

      clearTimerRef.current = window.setTimeout(() => {
        clearBuffer();
      }, SCANNER_GAP_MS);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        const barcode = bufferRef.current;
        const shouldScan = shouldAcceptBarcodeScan({
          buffer: barcode,
          startedAt: startedAtRef.current,
          endedAt: event.timeStamp,
        });

        clearBuffer();

        if (shouldScan) {
          onScanRef.current(barcode);
        }

        return;
      }

      if (!isPrintableKey(event.key) || event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      if (!startedAtRef.current) {
        startedAtRef.current = event.timeStamp;
      }

      bufferRef.current += event.key;
      scheduleBufferReset();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearBuffer();
    };
  }, [enabled]);
}
