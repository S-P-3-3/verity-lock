import { useCallback, useEffect, useRef, useState } from "react";
import { copyText, clearClipboard } from "../utils/platform";

/**
 * Clipboard copy with an automatic clear after `clearSeconds` and a live
 * countdown (for the status bar). Works on both desktop (Tauri) and Android
 * (Capacitor) via the platform clipboard helpers.
 */
export function useClipboard() {
  const [remaining, setRemaining] = useState(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (tick.current) {
      clearInterval(tick.current);
      tick.current = null;
    }
    setRemaining(0);
  }, []);

  const copy = useCallback(async (text: string, clearSeconds: number) => {
    await copyText(text);
    if (tick.current) clearInterval(tick.current);
    if (clearSeconds <= 0) return;
    setRemaining(clearSeconds);
    tick.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (tick.current) clearInterval(tick.current);
          tick.current = null;
          clearClipboard().catch(() => {});
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { copy, remaining };
}
