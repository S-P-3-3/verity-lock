import { useCallback, useEffect, useState } from "react";
import { confirmDialog, applyPlatformClass, initMobile, setScreenshotProtection } from "./utils/platform";
import { applyTheme } from "./utils/theme";
import { Topbar } from "./components/Topbar";
import { BottomNav, type Tab } from "./components/BottomNav";
import { Statusbar } from "./components/Statusbar";
import { ToastProvider, useToast } from "./components/Toast";
import { UnlockView } from "./views/UnlockView";
import { VaultView } from "./views/VaultView";
import { DetailView } from "./views/DetailView";
import { GeneratorView } from "./views/GeneratorView";
import { ImportView } from "./views/ImportView";
import { SettingsView } from "./views/SettingsView";
import { useVault } from "./hooks/useVault";
import { useClipboard } from "./hooks/useClipboard";
import { useAutoLock } from "./hooks/useAutoLock";
import { api } from "./api";
import type { AppSettings, Entry, NewEntry } from "./types";
import { DEFAULT_SETTINGS } from "./types";

function Root() {
  const toast = useToast();
  const vault = useVault();
  const { copy, remaining } = useClipboard();

  const [settings, setSettingsState] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<Tab>("vault");
  const [detail, setDetail] = useState<Entry | "new" | null>(null);
  const [genPassword, setGenPassword] = useState<string | undefined>(undefined);

  // Tag platform for mobile styling, then load persisted settings once.
  useEffect(() => {
    applyPlatformClass();
    api
      .loadSettings()
      .then((s) => setSettingsState({ ...DEFAULT_SETTINGS, ...(s as Partial<AppSettings>) }))
      .catch(() => {});
  }, []);

  const setSettings = (s: AppSettings) => {
    setSettingsState(s);
    api.saveSettings(s as unknown as Record<string, unknown>).catch(() => {});
  };

  // Apply theme (accent, font, density, animations) live on every change.
  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  // Mobile screenshot protection follows the setting.
  useEffect(() => {
    setScreenshotProtection(settings.screenshotProtect);
  }, [settings.screenshotProtect]);

  // Auto-lock while a vault is open (0 minutes = never).
  useAutoLock(vault.lock, settings.autoLockMinutes, !!vault.meta && settings.autoLockMinutes > 0);

  // Mobile: status bar + lock instantly when the app is backgrounded.
  useEffect(() => {
    initMobile(() => vault.lock());
  }, [vault.lock]);

  const copyField = useCallback(
    async (label: string, value: string) => {
      if (!value) return;
      await copy(value, settings.clipboardClearSeconds);
      toast.push(`${label} kopiert · ${settings.clipboardClearSeconds}s`, "success");
    },
    [copy, settings.clipboardClearSeconds, toast],
  );

  const saveEntry = async (data: NewEntry, id?: string) => {
    try {
      if (id) {
        const existing = vault.entries.find((e) => e.id === id);
        const merged: Entry = {
          id,
          ...data,
          created_at: existing?.created_at ?? Date.now(),
          updated_at: Date.now(),
        };
        await vault.updateEntry(merged);
        toast.push("Eintrag gespeichert", "success");
      } else {
        await vault.createEntry(data);
        toast.push("Eintrag erstellt", "success");
      }
    } catch (e) {
      toast.push(String(e), "error");
      throw e;
    }
  };

  const deleteEntry = async (id: string) => {
    if (!(await confirmDialog("Diesen Eintrag wirklich löschen?", "Löschen"))) return;
    try {
      await vault.deleteEntry(id);
      toast.push("Eintrag gelöscht", "success");
      setDetail(null);
    } catch (e) {
      toast.push(String(e), "error");
    }
  };

  const openNew = (password?: string) => {
    setGenPassword(password);
    setDetail("new");
  };

  // --- Locked: unlock screen -------------------------------------------------
  if (!vault.meta) {
    return <UnlockView onOpen={vault.open} onCreate={vault.create} />;
  }
  const meta = vault.meta;

  // --- Detail overlay (full screen) -----------------------------------------
  if (detail !== null) {
    return (
      <DetailView
        entry={detail === "new" ? null : detail}
        initialPassword={detail === "new" ? genPassword : undefined}
        defaultCategory={settings.defaultCategory}
        showPasswordPreview={settings.showPasswordPreview}
        avatarStyle={settings.avatarStyle}
        onClose={() => {
          setDetail(null);
          setGenPassword(undefined);
        }}
        onSave={saveEntry}
        onDelete={deleteEntry}
        onCopy={copyField}
      />
    );
  }

  // --- Main shell with tabs --------------------------------------------------
  return (
    <div className="app">
      <Topbar
        onSettings={() => setTab("settings")}
        onUser={() => toast.push(meta.path.split(/[\\/]/).pop() ?? "Vault", "info")}
      />
      <div className="scroll" key={tab}>
        {tab === "vault" && (
          <VaultView
            meta={meta}
            entries={vault.entries}
            sortOrder={settings.sortOrder}
            avatarStyle={settings.avatarStyle}
            onOpenEntry={(e) => setDetail(e)}
            onNewEntry={() => openNew()}
            onGotoImport={() => setTab("import")}
            onLock={vault.lock}
            onCopyPassword={(e) => copyField("Passwort", e.password)}
          />
        )}
        {tab === "generator" && <GeneratorView settings={settings} onCopy={copyField} onUseNew={(pw) => openNew(pw)} />}
        {tab === "import" && (
          <ImportView onImport={vault.importFile} onDone={() => setTab("vault")} />
        )}
        {tab === "settings" && (
          <SettingsView sessionToken={vault.token} settings={settings} onChange={setSettings} />
        )}
      </div>
      <BottomNav active={tab} onSelect={setTab} />
      <Statusbar unlocked clipboardRemaining={remaining} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Root />
    </ToastProvider>
  );
}
