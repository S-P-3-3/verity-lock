import { Copy } from "lucide-react";
import type { AvatarStyle, Entry } from "../types";
import { estimateStrength } from "../utils/generator";
import { Avatar } from "./Avatar";

interface Props {
  entry: Entry;
  avatarStyle: AvatarStyle;
  onOpen: (entry: Entry) => void;
  onCopyPassword: (entry: Entry) => void;
}

const DOT_COLORS = ["#e8404a", "#e8804a", "#fbbf24", "#44d975", "#2db85a"];

export function EntryRow({ entry, avatarStyle, onOpen, onCopyPassword }: Props) {
  const score = entry.password ? estimateStrength(entry.password).score : 0;
  const dot = DOT_COLORS[score] ?? DOT_COLORS[0];

  return (
    <div className="entry-row" onClick={() => onOpen(entry)}>
      <Avatar title={entry.title} category={entry.category} style={avatarStyle} />
      <div className="entry-info">
        <div className="entry-name">{entry.title}</div>
        <div className="entry-sub">{entry.username || "kein Benutzername"}</div>
      </div>
      {entry.password && (
        <span
          className="strength-dot"
          title="Passwortstärke"
          style={{ background: dot, boxShadow: `0 0 8px ${dot}` }}
        />
      )}
      <span className="entry-badge">{entry.category}</span>
      <button
        className="row-copy"
        title="Passwort kopieren"
        onClick={(e) => {
          e.stopPropagation();
          onCopyPassword(entry);
        }}
      >
        <Copy size={15} />
      </button>
    </div>
  );
}
