import { useCallback, useEffect, useState } from "react";
import { Copy, RefreshCw, FilePlus } from "lucide-react";
import { StrengthBar } from "../components/StrengthBar";
import { api } from "../api";
import type { AppSettings, PasswordOptions } from "../types";

interface Props {
  settings: AppSettings;
  onCopy: (label: string, value: string) => void;
  onUseNew: (pw: string) => void;
}

export function GeneratorView({ settings, onCopy, onUseNew }: Props) {
  const [opts, setOpts] = useState<PasswordOptions>({
    length: settings.generatorLength,
    uppercase: settings.genUppercase,
    lowercase: settings.genLowercase,
    digits: settings.genNumbers,
    symbols: settings.genSymbols,
    passphrase: settings.genPassphrase,
    word_count: 4,
    separator: "-",
  });
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");

  const regenerate = useCallback(async () => {
    try {
      setErr("");
      setValue(await api.generatePassword(opts));
    } catch (e) {
      setErr(String(e));
    }
  }, [opts]);

  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const set = <K extends keyof PasswordOptions>(k: K, v: PasswordOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  return (
    <>
      <span className="section-label">Generiertes Passwort</span>
      <div className="gen-box">
        <span style={{ flex: 1 }}>{value || (err ? "—" : "…")}</span>
        <button className="val-icon" onClick={() => value && onCopy("Passwort", value)} title="Kopieren">
          <Copy size={15} />
        </button>
      </div>
      {!opts.passphrase && <StrengthBar password={value} />}
      {err && <span className="muted" style={{ color: "var(--red)" }}>{err}</span>}

      <div className="seg">
        <button className={!opts.passphrase ? "active" : ""} onClick={() => set("passphrase", false)}>
          Zeichen
        </button>
        <button className={opts.passphrase ? "active" : ""} onClick={() => set("passphrase", true)}>
          Passphrase
        </button>
      </div>

      {!opts.passphrase ? (
        <>
          <div className="gen-row">
            <span>Länge</span>
            <strong style={{ color: "var(--green)" }}>{opts.length}</strong>
          </div>
          <input className="slider" type="range" min={8} max={128} value={opts.length} onChange={(e) => set("length", Number(e.target.value))} />

          <label className="check">
            <input type="checkbox" checked={opts.uppercase} onChange={(e) => set("uppercase", e.target.checked)} /> Großbuchstaben (A–Z)
          </label>
          <label className="check">
            <input type="checkbox" checked={opts.lowercase} onChange={(e) => set("lowercase", e.target.checked)} /> Kleinbuchstaben (a–z)
          </label>
          <label className="check">
            <input type="checkbox" checked={opts.digits} onChange={(e) => set("digits", e.target.checked)} /> Zahlen (0–9)
          </label>
          <label className="check">
            <input type="checkbox" checked={opts.symbols} onChange={(e) => set("symbols", e.target.checked)} /> Sonderzeichen (!@#)
          </label>
        </>
      ) : (
        <>
          <div className="gen-row">
            <span>Anzahl Wörter</span>
            <strong style={{ color: "var(--green)" }}>{opts.word_count}</strong>
          </div>
          <input className="slider" type="range" min={3} max={10} value={opts.word_count} onChange={(e) => set("word_count", Number(e.target.value))} />
          <div className="field">
            <span className="section-label">Trennzeichen</span>
            <input className="input" maxLength={3} value={opts.separator} onChange={(e) => set("separator", e.target.value)} />
          </div>
        </>
      )}

      <button className="btn-ghost btn-block" onClick={regenerate}>
        <RefreshCw size={16} /> Regenerieren
      </button>
      <div className="action-row">
        <button className="btn-green grow" onClick={() => value && onCopy("Passwort", value)}>
          <Copy size={16} /> Kopieren
        </button>
        <button className="btn-ghost grow" onClick={() => value && onUseNew(value)}>
          <FilePlus size={16} /> Neuer Eintrag
        </button>
      </div>
    </>
  );
}
