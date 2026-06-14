import { useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Pencil,
  Trash2,
  Wand2,
  Check,
} from "lucide-react";
import { Topbar } from "../components/Topbar";
import { StrengthBar } from "../components/StrengthBar";
import { Avatar } from "../components/Avatar";
import { api } from "../api";
import type { AvatarStyle, Entry, NewEntry } from "../types";
import { CATEGORIES } from "../types";

interface Props {
  entry: Entry | null; // null = neuer Eintrag
  initialPassword?: string;
  defaultCategory: string;
  showPasswordPreview: boolean;
  avatarStyle: AvatarStyle;
  onClose: () => void;
  onSave: (data: NewEntry, id?: string) => Promise<void>;
  onDelete: (id: string) => void;
  onCopy: (label: string, value: string) => void;
}

export function DetailView({
  entry,
  initialPassword,
  defaultCategory,
  showPasswordPreview,
  avatarStyle,
  onClose,
  onSave,
  onDelete,
  onCopy,
}: Props) {
  const [editing, setEditing] = useState(entry === null);
  const [showPw, setShowPw] = useState(showPasswordPreview);
  const [form, setForm] = useState<NewEntry>(() =>
    entry
      ? {
          title: entry.title,
          username: entry.username,
          password: entry.password,
          url: entry.url,
          notes: entry.notes,
          category: entry.category,
        }
      : { title: "", username: "", password: initialPassword ?? "", url: "", notes: "", category: defaultCategory },
  );
  const [busy, setBusy] = useState(false);

  const set = (k: keyof NewEntry, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const quickGenerate = async () => {
    try {
      const pw = await api.generatePassword({
        length: 20,
        uppercase: true,
        lowercase: true,
        digits: true,
        symbols: true,
        passphrase: false,
        word_count: 4,
        separator: "-",
      });
      set("password", pw);
      setShowPw(true);
    } catch {
      /* ignore */
    }
  };

  const save = async () => {
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      await onSave(form, entry?.id);
      if (entry) setEditing(false);
      else onClose();
    } catch {
      /* error already surfaced via toast; keep the editor open */
    } finally {
      setBusy(false);
    }
  };

  const title = entry ? "EINTRAG" : "NEUER EINTRAG";

  return (
    <div className="app fade">
      <Topbar
        onBack={onClose}
        title={title}
        rightIcon={entry && !editing ? <Pencil size={18} /> : undefined}
        onRight={() => setEditing(true)}
      />

      <div className="scroll">
        {/* Header */}
        <div className="detail-head">
          <Avatar title={form.title || "?"} category={form.category} style={avatarStyle} size={52} />
          <div style={{ minWidth: 0 }}>
            <div className="detail-title">{form.title || "Neuer Eintrag"}</div>
            {form.url && <div className="detail-sub">{form.url}</div>}
          </div>
        </div>

        {editing ? (
          <>
            <div className="field">
              <span className="section-label">Name / Titel</span>
              <input className="input" autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="z. B. Google" />
            </div>
            <div className="field">
              <span className="section-label">Benutzername / E-Mail</span>
              <input className="input" value={form.username} onChange={(e) => set("username", e.target.value)} placeholder="name@example.com" />
            </div>
            <div className="field">
              <span className="section-label">Passwort</span>
              <div className="input-row">
                <input
                  className="input mono"
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  placeholder="••••••••"
                />
                <button className="mini-icon" onClick={() => setShowPw((s) => !s)} title="Anzeigen">
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
                <button className="mini-icon" onClick={quickGenerate} title="Generieren">
                  <Wand2 size={17} />
                </button>
              </div>
              <StrengthBar password={form.password} />
            </div>
            <div className="field">
              <span className="section-label">URL / Website</span>
              <input className="input" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" />
            </div>
            <div className="field">
              <span className="section-label">Kategorie</span>
              <select className="select" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <span className="section-label">Notizen</span>
              <textarea className="textarea" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optionale Notizen…" />
            </div>

            <div className="action-row">
              <button className="btn-ghost grow" onClick={entry ? () => setEditing(false) : onClose}>
                Abbrechen
              </button>
              <button className="btn-green grow" disabled={busy || !form.title.trim()} onClick={save}>
                <Check size={16} /> Speichern
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="detail-field">
              <span className="section-label">Benutzername</span>
              <div className="detail-value">
                <span className="val">{form.username || <span className="muted">—</span>}</span>
                {form.username && (
                  <button className="val-icon" onClick={() => onCopy("Benutzername", form.username)}>
                    <Copy size={15} />
                  </button>
                )}
              </div>
            </div>

            <div className="detail-field">
              <span className="section-label">Passwort</span>
              <div className="detail-value">
                <span className="val mono">{showPw ? form.password : "•".repeat(Math.min(form.password.length, 18)) || "—"}</span>
                <button className="val-icon" onClick={() => setShowPw((s) => !s)}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                {form.password && (
                  <button className="val-icon" onClick={() => onCopy("Passwort", form.password)}>
                    <Copy size={15} />
                  </button>
                )}
              </div>
              <StrengthBar password={form.password} />
            </div>

            <div className="detail-field">
              <span className="section-label">URL</span>
              <div className="detail-value">
                <span className="val">{form.url || <span className="muted">—</span>}</span>
                {form.url && (
                  <button className="val-icon" onClick={() => onCopy("URL", form.url)}>
                    <ExternalLink size={15} />
                  </button>
                )}
              </div>
            </div>

            {form.notes && (
              <div className="detail-field">
                <span className="section-label">Notizen</span>
                <div className="detail-value">
                  <span className="val" style={{ whiteSpace: "pre-wrap" }}>{form.notes}</span>
                </div>
              </div>
            )}

            {entry && (
              <p className="muted" style={{ textAlign: "center" }}>
                Geändert: {new Date(entry.updated_at).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            )}

            <button className="btn-green btn-block" onClick={() => setEditing(true)}>
              <Pencil size={16} /> Bearbeiten
            </button>
            {entry && (
              <button className="btn-red btn-block" onClick={() => onDelete(entry.id)}>
                <Trash2 size={16} /> Löschen
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
