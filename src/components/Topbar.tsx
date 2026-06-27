import { ArrowLeft, Settings, User } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  /** When set, renders the sub-screen back bar instead of the brand bar. */
  onBack?: () => void;
  title?: string;
  rightIcon?: ReactNode;
  onRight?: () => void;
  onSettings?: () => void;
  onUser?: () => void;
}

export function Topbar({ onBack, title, rightIcon, onRight, onSettings, onUser }: Props) {
  if (onBack) {
    return (
      <header className="topbar">
        <button className="back" onClick={onBack}>
          <ArrowLeft size={18} /> zurück
        </button>
        <div className="spacer" />
        <span className="app-name">{title}</span>
        <div className="spacer" />
        {rightIcon ? (
          <button className="top-icon" onClick={onRight}>
            {rightIcon}
          </button>
        ) : (
          <span style={{ width: 34 }} />
        )}
      </header>
    );
  }

  return (
    <header className="topbar">
      <div className="logo-badge">V</div>
      <span className="app-name">Verity Lock</span>
      <div className="spacer" />
      {onUser && (
        <button className="top-icon" onClick={onUser} title="Konto">
          <User size={18} />
        </button>
      )}
      {onSettings && (
        <button className="top-icon" onClick={onSettings} title="Einstellungen">
          <Settings size={18} />
        </button>
      )}
    </header>
  );
}
