import { useEffect, useState } from "react";
import { FileUp, Upload, Check, ArrowLeft, Loader2 } from "lucide-react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { platform, pickImportContent } from "../utils/platform";

const PENDING_CONTENT = "verity_pending_import";
const PENDING_FORMAT = "verity_pending_format";

interface Props {
  onImport: (format: string, source: string) => Promise<number>;
  onDone: () => void;
}

const FORMATS = [
  { id: "bitwarden", label: "Bitwarden", ext: ["json"] },
  { id: "keepass", label: "KeePass (XML)", ext: ["xml"] },
  { id: "1password", label: "1Password", ext: ["csv"] },
  { id: "lastpass", label: "LastPass", ext: ["csv"] },
  { id: "chrome", label: "Chrome / Edge", ext: ["csv"] },
  { id: "firefox", label: "Firefox", ext: ["csv"] },
  { id: "csv", label: "Generisch (CSV)", ext: ["csv"] },
];

// Broad MIME sets — Android file managers report CSV inconsistently.
const MIME: Record<string, string[]> = {
  bitwarden: ["application/json", "text/plain"],
  keepass: ["application/xml", "text/xml", "application/octet-stream", "text/plain"],
  "1password": ["text/csv", "application/octet-stream", "text/plain"],
  lastpass: ["text/csv", "text/plain"],
  chrome: ["text/csv", "text/plain"],
  firefox: ["text/csv", "text/plain"],
  csv: ["text/csv", "text/plain", "application/octet-stream"],
};

export function ImportView({ onImport, onDone }: Props) {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [format, setFormat] = useState("");
  const [source, setSource] = useState(""); // desktop: path · mobile: file content
  const [label, setLabel] = useState("");
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const fmt = FORMATS.find((f) => f.id === format);

  // Run the preview for a given format + source (path on desktop, content on mobile).
  const proceed = async (fmt2: string, src: string) => {
    setFormat(fmt2);
    setSource(src);
    setLabel(platform.isDesktop ? src : "Datei geladen");
    try {
      setBusy(true);
      const res = await api.previewImport(fmt2, src);
      setCount(res.imported);
      setStep(3);
    } catch (e) {
      toast.push(String(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async () => {
    const sel = await pickImportContent(fmt?.label ?? "Datei", fmt?.ext ?? ["csv", "json", "xml"], MIME[format] ?? ["text/plain"]);
    if (!sel) return;
    // Fallback: if Android still locks during a long browse, the read content
    // survives in sessionStorage and the import resumes after re-unlock.
    if (platform.isMobile) {
      sessionStorage.setItem(PENDING_CONTENT, sel);
      sessionStorage.setItem(PENDING_FORMAT, format);
    }
    await proceed(format, sel);
  };

  // Resume a pending import after a re-unlock (component remounts).
  useEffect(() => {
    const content = sessionStorage.getItem(PENDING_CONTENT);
    const fmt2 = sessionStorage.getItem(PENDING_FORMAT);
    if (content && fmt2) {
      sessionStorage.removeItem(PENDING_CONTENT);
      sessionStorage.removeItem(PENDING_FORMAT);
      proceed(fmt2, content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = async () => {
    try {
      setBusy(true);
      const n = await onImport(format, source);
      sessionStorage.removeItem(PENDING_CONTENT);
      sessionStorage.removeItem(PENDING_FORMAT);
      toast.push(`${n} Einträge importiert`, "success");
      onDone();
      setStep(1);
      setFormat("");
      setSource("");
      setLabel("");
      setCount(0);
    } catch (e) {
      toast.push(String(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="steps">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`step-dot ${step >= s ? "done" : ""}`} />
        ))}
      </div>

      {step === 1 && (
        <>
          <span className="section-label">Schritt 1 · Format wählen</span>
          <div className="format-grid">
            {FORMATS.map((f) => (
              <button key={f.id} className={`format-card ${format === f.id ? "active" : ""}`} onClick={() => setFormat(f.id)}>
                <FileUp size={18} /> {f.label}
              </button>
            ))}
          </div>
          <button className="btn-green btn-block" disabled={!format} onClick={() => setStep(2)}>
            Weiter
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <span className="section-label">Schritt 2 · Datei laden</span>
          {platform.isMobile ? (
            <div className="android-pick-area" onClick={() => !busy && pickFile()}>
              <div className="pick-icon">{busy ? <Loader2 className="spin" size={40} /> : "📂"}</div>
              <div className="pick-title">{busy ? "Lese Datei…" : "Datei auswählen"}</div>
              <div className="pick-sub">Tippe, um den Datei-Manager zu öffnen</div>
            </div>
          ) : (
            <button className="dropzone" onClick={pickFile} disabled={busy}>
              {busy ? <Loader2 className="spin" size={28} /> : <Upload size={28} />}
              <div style={{ marginTop: 10 }}>{busy ? "Lese Datei…" : `${fmt?.label}-Datei wählen (${fmt?.ext.join("/")})`}</div>
            </button>
          )}
          <button className="btn-ghost btn-block" onClick={() => setStep(1)}>
            <ArrowLeft size={16} /> Zurück
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <span className="section-label">Schritt 3 · Bestätigen</span>
          <div className="preview-count">
            <Check size={36} color="var(--green)" />
            <div>
              <span className="big">{count}</span>
              <div className="muted">Einträge gefunden</div>
            </div>
            <div className="muted" style={{ wordBreak: "break-all", userSelect: "text" }}>{label}</div>
          </div>
          <button className="btn-green btn-block" disabled={busy || count === 0} onClick={commit}>
            <Check size={16} /> {count} Einträge importieren
          </button>
          <button className="btn-ghost btn-block" onClick={() => setStep(2)}>
            <ArrowLeft size={16} /> Zurück
          </button>
        </>
      )}
    </>
  );
}
