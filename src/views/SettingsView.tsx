import { useState } from "react";
import { AlertTriangle, Copy, Check } from "lucide-react";
import { api } from "../api";
import type { AppSettings } from "../types";
import { CATEGORIES } from "../types";
import { useToast } from "../components/Toast";
import { confirmDialog, pickExportDest, copyText, platform, setScreenshotProtection } from "../utils/platform";
import { SettingsSection, SettingsRow, Toggle, ColorPicker, SegmentedControl, Dropdown } from "../components/SettingsControls";

interface Props {
  sessionToken: string;
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
}

function group(d: string) {
  return d.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function SettingsView({ sessionToken, settings, onChange }: Props) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onChange({ ...settings, [key]: value });
    if (key === "screenshotProtect") setScreenshotProtection(value as boolean);
  };

  const changeNumber = async () => {
    const cur = current.replace(/\D/g, "");
    if (cur.length !== 16) return toast.push("Aktuelle Kontonummer: 16 Ziffern", "error");
    try {
      setBusy(true);
      const next = await api.generateAccountNumber();
      await api.changeMasterPassword(sessionToken, cur, next);
      setNewNumber(next);
      setCurrent("");
      toast.push("Neue Kontonummer aktiv", "success");
    } catch (e) {
      toast.push(String(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const backup = async () => {
    const dest = await pickExportDest("vault-backup.sp3vault", "sp3vault");
    if (!dest) return;
    try {
      await api.backupVault(sessionToken, dest);
      toast.push("Backup gespeichert", "success");
    } catch (e) {
      toast.push(String(e), "error");
    }
  };

  const exportAs = async (format: "sp3vault" | "csv" | "json") => {
    if (format !== "sp3vault") {
      const ok = await confirmDialog(
        `${format.toUpperCase()}-Export ist UNVERSCHLÜSSELT — alle Passwörter im Klartext. Fortfahren?`,
        "Warnung",
      );
      if (!ok) return;
    }
    const dest = await pickExportDest(`sp3-export.${format}`, format);
    if (!dest) return;
    try {
      await api.exportVault(sessionToken, format, dest);
      toast.push("Export gespeichert", "success");
    } catch (e) {
      toast.push(String(e), "error");
    }
  };

  const copyLink = (url: string) => copyText(url).then(() => toast.push("Link kopiert", "success"));

  return (
    <div className="settings-list">
      {/* Erscheinungsbild */}
      <SettingsSection title="Erscheinungsbild" icon="🎨">
        <SettingsRow label="Akzentfarbe">
          <ColorPicker value={settings.accentColor} onChange={(v) => set("accentColor", v)} />
        </SettingsRow>
        <SettingsRow label="Topbar-Farbe">
          <SegmentedControl
            options={[
              { value: "green", label: "Standard" },
              { value: "dark", label: "Dunkel" },
              { value: "black", label: "Schwarz" },
            ]}
            value={settings.topbarColor}
            onChange={(v) => set("topbarColor", v)}
          />
        </SettingsRow>
        <SettingsRow label="Schriftgröße">
          <SegmentedControl
            options={[
              { value: "small", label: "Klein" },
              { value: "normal", label: "Normal" },
              { value: "large", label: "Groß" },
            ]}
            value={settings.fontSize}
            onChange={(v) => set("fontSize", v)}
          />
        </SettingsRow>
        <SettingsRow label="Avatar-Stil">
          <SegmentedControl
            options={[
              { value: "letter", label: "Abc" },
              { value: "colorblock", label: "Block" },
              { value: "icon", label: "Icon" },
              { value: "emoji", label: "Emoji" },
            ]}
            value={settings.avatarStyle}
            onChange={(v) => set("avatarStyle", v)}
          />
        </SettingsRow>
        <SettingsRow label="Kompakter Modus" description="Kleinere Eintrags-Zeilen">
          <Toggle value={settings.compactMode} onChange={(v) => set("compactMode", v)} />
        </SettingsRow>
        <SettingsRow label="Animationen" description="Ausschalten für Barrierefreiheit">
          <Toggle value={settings.animations} onChange={(v) => set("animations", v)} />
        </SettingsRow>
      </SettingsSection>

      {/* Sicherheit */}
      <SettingsSection title="Sicherheit" icon="🔒">
        <SettingsRow label="Auto-Lock">
          <Dropdown
            options={[
              { value: 0, label: "Nie" },
              { value: 1, label: "1 Min" },
              { value: 2, label: "2 Min" },
              { value: 5, label: "5 Min" },
              { value: 10, label: "10 Min" },
              { value: 30, label: "30 Min" },
            ]}
            value={settings.autoLockMinutes}
            onChange={(v) => set("autoLockMinutes", v)}
          />
        </SettingsRow>
        <SettingsRow label="Clipboard leeren nach">
          <Dropdown
            options={[
              { value: 10, label: "10 Sek" },
              { value: 30, label: "30 Sek" },
              { value: 60, label: "60 Sek" },
              { value: 0, label: "Nie" },
            ]}
            value={settings.clipboardClearSeconds}
            onChange={(v) => set("clipboardClearSeconds", v)}
          />
        </SettingsRow>
        {platform.isMobile && (
          <SettingsRow label="Screenshot-Schutz" description="Verhindert App-Vorschau im Switcher">
            <Toggle value={settings.screenshotProtect} onChange={(v) => set("screenshotProtect", v)} />
          </SettingsRow>
        )}
      </SettingsSection>

      {/* Kontonummer ändern */}
      <SettingsSection title="Kontonummer" icon="🔑">
        {newNumber ? (
          <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
            <div className="account-display">{group(newNumber)}</div>
            <div className="warn-box">
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Deine <strong>neue</strong> Kontonummer — notieren! Die alte ist ungültig.
              </span>
            </div>
            <div className="action-row">
              <button className="btn-ghost grow" onClick={() => copyText(newNumber).then(() => toast.push("Kopiert", "success"))}>
                <Copy size={16} /> Kopieren
              </button>
              <button className="btn-green grow" onClick={() => setNewNumber("")}>
                <Check size={16} /> Fertig
              </button>
            </div>
          </div>
        ) : (
          <div className="settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <input
              className="account-input"
              inputMode="numeric"
              placeholder="Aktuelle Kontonummer"
              value={group(current)}
              onChange={(e) => setCurrent(e.target.value.replace(/\D/g, "").slice(0, 16))}
            />
            <button className="btn-ghost btn-block" disabled={busy || current.replace(/\D/g, "").length !== 16} onClick={changeNumber}>
              Neue Nummer generieren &amp; wechseln
            </button>
          </div>
        )}
      </SettingsSection>

      {/* Einträge */}
      <SettingsSection title="Einträge" icon="📋">
        <SettingsRow label="Standard-Kategorie">
          <Dropdown
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            value={settings.defaultCategory}
            onChange={(v) => set("defaultCategory", v)}
          />
        </SettingsRow>
        <SettingsRow label="Sortierung">
          <Dropdown
            options={[
              { value: "name", label: "Name A–Z" },
              { value: "modified", label: "Zuletzt geändert" },
              { value: "category", label: "Kategorie" },
              { value: "manual", label: "Manuell" },
            ]}
            value={settings.sortOrder}
            onChange={(v) => set("sortOrder", v)}
          />
        </SettingsRow>
        <SettingsRow label="Passwort im Detail anzeigen" description="Standardmäßig sichtbar">
          <Toggle value={settings.showPasswordPreview} onChange={(v) => set("showPasswordPreview", v)} />
        </SettingsRow>
      </SettingsSection>

      {/* Generator-Defaults */}
      <SettingsSection title="Passwort-Generator" icon="🔑">
        <SettingsRow label={`Standard-Länge: ${settings.generatorLength}`}>
          <input
            type="range"
            min={8}
            max={128}
            value={settings.generatorLength}
            onChange={(e) => set("generatorLength", +e.target.value)}
            className="settings-slider"
          />
        </SettingsRow>
        <SettingsRow label="Großbuchstaben">
          <Toggle value={settings.genUppercase} onChange={(v) => set("genUppercase", v)} />
        </SettingsRow>
        <SettingsRow label="Kleinbuchstaben">
          <Toggle value={settings.genLowercase} onChange={(v) => set("genLowercase", v)} />
        </SettingsRow>
        <SettingsRow label="Zahlen">
          <Toggle value={settings.genNumbers} onChange={(v) => set("genNumbers", v)} />
        </SettingsRow>
        <SettingsRow label="Sonderzeichen">
          <Toggle value={settings.genSymbols} onChange={(v) => set("genSymbols", v)} />
        </SettingsRow>
        <SettingsRow label="Passphrase-Modus" description="Wörter statt Zeichen">
          <Toggle value={settings.genPassphrase} onChange={(v) => set("genPassphrase", v)} />
        </SettingsRow>
      </SettingsSection>

      {/* Sichern & Exportieren */}
      <SettingsSection title="Sichern & Exportieren" icon="💾">
        <SettingsRow label="Vault-Backup (verschlüsselt)" chevron onClick={backup} />
        <SettingsRow label="Export .sp3vault" chevron onClick={() => exportAs("sp3vault")} />
        <SettingsRow label="Export CSV (unverschlüsselt)" chevron onClick={() => exportAs("csv")} />
        <SettingsRow label="Export JSON (unverschlüsselt)" chevron onClick={() => exportAs("json")} />
      </SettingsSection>

      {/* Über */}
      <SettingsSection title="Über" icon="ℹ️">
        <SettingsRow label="Version" value="1.0.0" />
        <SettingsRow label="Lizenz" value="GPL-3.0" />
        <SettingsRow label="GitHub" chevron onClick={() => copyLink("https://github.com/sp3dev/sp3-lock")} />
        <SettingsRow label="Discord" chevron onClick={() => copyLink("https://discord.gg/sp3")} />
        <SettingsRow label="Verschlüsselung" value={platform.isDesktop ? "Argon2id" : "PBKDF2"} />
      </SettingsSection>
    </div>
  );
}
