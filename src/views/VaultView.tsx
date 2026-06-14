import { useMemo, useState } from "react";
import { Plus, Upload, Lock, Search, KeyRound } from "lucide-react";
import { EntryRow } from "../components/EntryRow";
import { FilterPills } from "../components/FilterPills";
import type { AvatarStyle, Entry, SortOrder, VaultMeta } from "../types";
import { CATEGORIES } from "../types";

interface Props {
  meta: VaultMeta;
  entries: Entry[];
  sortOrder: SortOrder;
  avatarStyle: AvatarStyle;
  onOpenEntry: (e: Entry) => void;
  onNewEntry: () => void;
  onGotoImport: () => void;
  onLock: () => void;
  onCopyPassword: (e: Entry) => void;
}

export function VaultView({ meta, entries, sortOrder, avatarStyle, onOpenEntry, onNewEntry, onGotoImport, onLock, onCopyPassword }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Alle");

  const counts = useMemo(() => {
    const c: Record<string, number> = { Alle: entries.length };
    for (const cat of CATEGORIES) c[cat] = entries.filter((e) => e.category === cat).length;
    return c;
  }, [entries]);

  const pillOptions = useMemo(
    () => [
      { label: "Alle", value: "Alle", count: counts.Alle },
      ...CATEGORIES.filter((c) => counts[c] > 0).map((c) => ({ label: c, value: c, count: counts[c] })),
    ],
    [counts],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = entries
      .filter((e) => filter === "Alle" || e.category === filter)
      .filter((e) => !q || e.title.toLowerCase().includes(q) || e.username.toLowerCase().includes(q) || e.url.toLowerCase().includes(q));
    const sorted = [...list];
    switch (sortOrder) {
      case "name":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "modified":
        sorted.sort((a, b) => b.updated_at - a.updated_at);
        break;
      case "category":
        sorted.sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
        break;
      case "manual":
        break; // keep stored order
    }
    return sorted;
  }, [entries, query, filter, sortOrder]);

  const fileName = meta.path.split(/[\\/]/).pop();

  return (
    <>
      {/* Status banner */}
      <div className="banner unlocked">
        <span className="status-label">
          <span className="dot" /> Vault entsperrt
        </span>
        <div className="status-title">{entries.length} Passwörter</div>
        <div className="status-sub">gesichert · {fileName} · AES-256-GCM</div>
        <div className="tag-pills">
          <span className="tag-pill">Offline</span>
          <span className="tag-pill">Portabel</span>
          <span className="tag-pill">Argon2id</span>
        </div>
      </div>

      {/* Actions */}
      <div className="action-row">
        <button className="btn-green grow" onClick={onNewEntry}>
          <Plus size={16} /> Neuer Eintrag
        </button>
        <button className="btn-ghost" onClick={onGotoImport} title="Import">
          <Upload size={16} />
        </button>
        <button className="btn-red" onClick={onLock} title="Sperren">
          <Lock size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="search">
        <Search size={17} />
        <input className="input" placeholder="Suchen…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {/* Filter */}
      {pillOptions.length > 1 && <FilterPills options={pillOptions} active={filter} onSelect={setFilter} />}

      {/* Entries */}
      <span className="section-label">{query || filter !== "Alle" ? "Treffer" : "Einträge"}</span>
      {filtered.length === 0 ? (
        <div className="empty">
          <KeyRound size={38} />
          <div>{entries.length === 0 ? "Noch keine Einträge" : "Keine Treffer"}</div>
          {entries.length === 0 && (
            <button className="btn-green" onClick={onNewEntry}>
              <Plus size={16} /> Ersten Eintrag anlegen
            </button>
          )}
        </div>
      ) : (
        <div className="rows">
          {filtered.map((e) => (
            <EntryRow key={e.id} entry={e} avatarStyle={avatarStyle} onOpen={onOpenEntry} onCopyPassword={onCopyPassword} />
          ))}
        </div>
      )}
    </>
  );
}
