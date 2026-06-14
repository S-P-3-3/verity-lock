import { ShieldCheck, WifiOff } from "lucide-react";

interface Props {
  unlocked: boolean;
  clipboardRemaining: number;
}

export function Statusbar({ unlocked, clipboardRemaining }: Props) {
  return (
    <footer className="statusbar">
      <span className={`chip ${unlocked ? "" : "off"}`}>
        <span className="dot" />
        {unlocked ? "Vault offen" : "Gesperrt"}
      </span>
      <span className="chip">
        <ShieldCheck size={12} /> AES-256
      </span>
      <span className="chip">
        <WifiOff size={12} /> Offline
      </span>
      <span className="spacer" />
      {clipboardRemaining > 0 && <span className="clip">Clipboard {clipboardRemaining}s</span>}
    </footer>
  );
}
