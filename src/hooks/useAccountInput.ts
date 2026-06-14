import { useState } from "react";

/**
 * Bug-free account-number input: keeps a raw digit string (max 16) and a
 * display string grouped into 4s ("1234 5678 9012 3456"). All formatting is
 * derived synchronously from the typed value, so there is no caret jump or lag.
 */
export function useAccountInput(initial = "") {
  const [raw, setRaw] = useState(initial.replace(/\D/g, "").slice(0, 16));

  const handleChange = (value: string) => {
    setRaw(value.replace(/\D/g, "").slice(0, 16));
  };

  const reset = () => setRaw("");

  const display = raw.replace(/(\d{4})(?=\d)/g, "$1 ");

  return {
    raw,
    display,
    handleChange,
    reset,
    isComplete: raw.length === 16,
    isEmpty: raw.length === 0,
    count: raw.length,
  };
}
