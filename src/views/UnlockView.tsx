import { useCallback, useEffect, useState } from "react";
import { Loader2, LogIn, Plus, FolderOpen, Copy, AlertTriangle, RefreshCw, Check, Lock } from "lucide-react";
import { Topbar } from "../components/Topbar";
import { Statusbar } from "../components/Statusbar";
import { useToast } from "../components/Toast";
import { useAccountInput } from "../hooks/useAccountInput";
import { api } from "../api";
import { platform, pickVaultToOpen, pickVaultToCreate, copyText } from "../utils/platform";

interface Props {
  onOpen: (path: string, accountNumber: string) => Promise<void>;
  onCreate: (path: string, accountNumber: string) => Promise<void>;
}

type Mode = "login" | "setup";

function group(d: string) {
  return d.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function UnlockView({ onOpen, onCreate }: Props) {
  const toast = useToast();
  const acct = useAccountInput();
  const [mode, setMode] = useState<Mode>("login");
  const [path, setPath] = useState("");
  const [generated, setGenerated] = useState("");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const newNumberFor = useCallback(async (p: string) => {
    const n = await api.generateAccountNumber();
    setGenerated(n.replace(/\D/g, ""));
    setPath(p);
    setMode("setup");
    setError("");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const def = await api.defaultVaultPath();
        const exists = await api.vaultExists(def);
        setPath(def);
        if (exists) setMode("login");
        else await newNumberFor(def);
      } catch {
        setMode("login");
      } finally {
        setReady(true);
      }
    })();
  }, [newNumberFor]);

  const login = async () => {
    if (!acct.isComplete) return;
    setBusy(true);
    setError("");
    try {
      await onOpen(path, acct.raw);
    } catch (e) {
      setError(String(e));
      setAttempts((a) => a + 1);
      acct.reset();
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async () => {
    setBusy(true);
    setError("");
    try {
      await onCreate(path, generated);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const copyNumber = async () => {
    await copyText(generated);
    toast.push("Kontonummer kopiert", "success");
  };

  const createElsewhere = async () => {
    const p = await pickVaultToCreate();
    if (p) await newNumberFor(p);
  };

  const openOther = async () => {
    const p = await pickVaultToOpen();
    if (p) {
      setPath(p);
      setMode("login");
      acct.reset();
      setError("");
      setAttempts(0);
    }
  };

  const remaining = Math.max(0, 5 - attempts);
  const pct = (acct.count / 16) * 100;

  return (
    <div className="app">
      <Topbar />
      <div className="scroll">
        {!ready ? (
          <div className="unlock-wrap">
            <Loader2 className="spin" size={28} />
          </div>
        ) : mode === "setup" ? (
          <div className="unlock-wrap">
            <div className="unlock-lock">
              <Lock size={30} />
            </div>
            <div className="unlock-title">Deine neue Kontonummer</div>
            <div className="account-display">{group(generated)}</div>

            <div className="warn-box">
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>
                Schreib diese Nummer auf und bewahre sie sicher auf. Sie ist der
                <strong> einzige Schlüssel</strong> zu deinem Vault und kann
                <strong> nicht wiederhergestellt</strong> werden.
              </span>
            </div>

            <div className="unlock-form">
              <div className="action-row">
                <button className="btn-ghost grow" onClick={copyNumber}>
                  <Copy size={16} /> Kopieren
                </button>
                <button className="btn-ghost grow" onClick={() => newNumberFor(path)} disabled={busy}>
                  <RefreshCw size={16} /> Neu
                </button>
              </div>
              <button className="btn-green btn-block" onClick={confirmSetup} disabled={busy}>
                {busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />} Verstanden — Vault erstellen
              </button>
            </div>

            <div className={`attempts ${error ? "error" : ""}`}>
              {error ? <><span className="dot" />{error}</> : ""}
            </div>
          </div>
        ) : (
          <div className="unlock-wrap">
            <div className="unlock-lock">
              <Lock size={30} />
            </div>
            <div className="unlock-title">Kontonummer eingeben</div>
            <div className="unlock-file">16 Ziffern — kein Passwort</div>

            <div className="unlock-form">
              <input
                className="account-input"
                inputMode="numeric"
                autoFocus
                placeholder="0000 0000 0000 0000"
                value={acct.display}
                onChange={(e) => acct.handleChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && login()}
              />

              <div className="account-progress">
                <div className="track">
                  <div className="fill" style={{ width: `${pct}%` }} />
                </div>
                <span>{acct.count} / 16</span>
              </div>

              <button className="btn-green btn-block" disabled={busy || !acct.isComplete} onClick={login}>
                {busy ? <Loader2 className="spin" size={16} /> : <LogIn size={16} />} Einloggen
              </button>

              <button className="btn-ghost btn-block" onClick={createElsewhere}>
                <Plus size={16} /> Neue Kontonummer generieren
              </button>
              {platform.isDesktop && (
                <button className="btn-ghost btn-block" onClick={openOther}>
                  <FolderOpen size={16} /> Andere Vault öffnen…
                </button>
              )}
            </div>

            <div className={`attempts ${error ? "error" : ""}`}>
              {(error || attempts > 0) && <span className="dot" />}
              {error ? error : attempts > 0 ? `${remaining} Versuche verbleibend` : ""}
            </div>
          </div>
        )}
      </div>
      <Statusbar unlocked={false} clipboardRemaining={0} />
    </div>
  );
}
