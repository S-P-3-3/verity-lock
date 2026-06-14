import { KeyRound, Wand2, Upload, Settings } from "lucide-react";

export type Tab = "vault" | "generator" | "import" | "settings";

const TABS: { id: Tab; label: string; icon: typeof KeyRound }[] = [
  { id: "vault", label: "Vault", icon: KeyRound },
  { id: "generator", label: "Generator", icon: Wand2 },
  { id: "import", label: "Import", icon: Upload },
  { id: "settings", label: "Einstellungen", icon: Settings },
];

export function BottomNav({ active, onSelect }: { active: Tab; onSelect: (t: Tab) => void }) {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`nav-tab ${active === id ? "active" : ""}`}
          onClick={() => onSelect(id)}
        >
          <Icon size={20} />
          {label}
        </button>
      ))}
    </nav>
  );
}
