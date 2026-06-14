import { useEffect, useState } from "react";
import { api } from "../api";
import type { StrengthResult } from "../types";

const COLORS = ["#e8404a", "#e8804a", "#e8c84a", "#44d975", "#2db85a"];

export function StrengthBar({ password }: { password: string }) {
  const [res, setRes] = useState<StrengthResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!password) {
      setRes(null);
      return;
    }
    api
      .estimateStrength(password)
      .then((r) => !cancelled && setRes(r))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [password]);

  const score = res?.score ?? 0;
  const pct = password ? ((score + 1) / 5) * 100 : 0;
  const color = COLORS[score] ?? COLORS[0];

  return (
    <div className="strength">
      <div className="strength-track">
        <div
          className="strength-fill"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}` }}
        />
      </div>
      <div className="strength-row">
        <span style={{ color, textTransform: "capitalize" }}>{res?.label ?? "—"}</span>
        {res ? <span className="muted">{Math.round(res.entropy_bits)} bit</span> : null}
      </div>
    </div>
  );
}
