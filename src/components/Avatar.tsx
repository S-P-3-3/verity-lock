import { KeyRound } from "lucide-react";
import type { AvatarStyle } from "../types";

const EMOJI: Record<string, string> = {
  Login: "🔐",
  "E-Mail": "✉️",
  Bank: "🏦",
  Gaming: "🎮",
  Social: "💬",
  Sonstiges: "📦",
};

const BLOCK_COLORS = ["#44d975", "#38bdf8", "#a78bfa", "#fb923c", "#f87171", "#fbbf24"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({
  title,
  category,
  style,
  size = 40,
}: {
  title: string;
  category: string;
  style: AvatarStyle;
  size?: number;
}) {
  const letter = (title[0] || "?").toUpperCase();
  const dim = { width: size, height: size, borderRadius: size > 44 ? 14 : 10 };
  const fontSize = size > 44 ? 21 : 16;

  if (style === "colorblock") {
    const c = BLOCK_COLORS[hash(title) % BLOCK_COLORS.length];
    return (
      <div className="avatar" style={{ ...dim, background: c, color: "#0e1520", border: "none", fontSize }}>
        {letter}
      </div>
    );
  }
  if (style === "emoji") {
    return (
      <div className="avatar" style={{ ...dim, fontSize: size > 44 ? 26 : 20 }}>
        {EMOJI[category] ?? "🔑"}
      </div>
    );
  }
  if (style === "icon") {
    return (
      <div className="avatar" style={dim}>
        <KeyRound size={size > 44 ? 24 : 18} />
      </div>
    );
  }
  return (
    <div className="avatar" style={{ ...dim, fontSize }}>
      {letter}
    </div>
  );
}
