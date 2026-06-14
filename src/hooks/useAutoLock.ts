import { useEffect, useRef } from "react";
import { importLock } from "../store/importLock";

/**
 * Locks the vault after `minutes` of user inactivity. Activity = mouse/keyboard
 * interaction. The check runs every 5s; `onLock` should be idempotent.
 */
export function useAutoLock(onLock: () => void, minutes: number, active: boolean) {
  const last = useRef(Date.now());

  useEffect(() => {
    if (!active) return;
    const bump = () => (last.current = Date.now());
    const events = ["mousemove", "keydown", "mousedown", "wheel", "touchstart"];
    events.forEach((e) => window.addEventListener(e, bump));
    const timer = setInterval(() => {
      if (importLock.isActive()) return; // file picker open — don't lock
      if (Date.now() - last.current > minutes * 60_000) onLock();
    }, 5000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(timer);
    };
  }, [onLock, minutes, active]);
}
