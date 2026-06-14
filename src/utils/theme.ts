import type { AccentColor, AppSettings } from "../types";

export const ACCENTS: Record<AccentColor, { accent: string; topbar: string; glow: string }> = {
  green: { accent: "#44d975", topbar: "#2db85a", glow: "rgba(68,217,117,0.18)" },
  cyan: { accent: "#38bdf8", topbar: "#0284c7", glow: "rgba(56,189,248,0.18)" },
  purple: { accent: "#a78bfa", topbar: "#7c3aed", glow: "rgba(167,139,250,0.18)" },
  orange: { accent: "#fb923c", topbar: "#ea580c", glow: "rgba(251,146,60,0.18)" },
  red: { accent: "#f87171", topbar: "#dc2626", glow: "rgba(248,113,113,0.18)" },
  white: { accent: "#ffffff", topbar: "#374151", glow: "rgba(255,255,255,0.10)" },
};

const FONT_SCALE: Record<AppSettings["fontSize"], string> = {
  small: "13px",
  normal: "14px",
  large: "16px",
};

/** Apply theme settings live to CSS custom properties on :root. */
export function applyTheme(s: AppSettings) {
  const root = document.documentElement;
  const colors = ACCENTS[s.accentColor] ?? ACCENTS.green;

  root.style.setProperty("--green", colors.accent);
  root.style.setProperty("--green-glow", colors.glow);
  root.style.setProperty("--green-dim", colors.glow);

  const topbar =
    s.topbarColor === "dark" ? "#1b2535" : s.topbarColor === "black" ? "#000000" : colors.topbar;
  root.style.setProperty("--green-dark", topbar);

  root.style.setProperty("--font-base", FONT_SCALE[s.fontSize]);
  root.style.setProperty("--row-height", s.compactMode ? "52px" : "64px");
  root.style.setProperty("--row-pad", s.compactMode ? "9px 12px" : "12px 14px");

  root.classList.toggle("no-anim", !s.animations);
}
