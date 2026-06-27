/**
 * Platform abstraction: the same React UI runs under Tauri (desktop) and
 * Capacitor (Android). Detection is runtime; plugin modules are dynamically
 * imported so the desktop bundle never executes Capacitor code and vice versa.
 */

import { importLock } from "../store/importLock";

interface Win {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
}
const w = window as unknown as Win;

const isTauri = typeof w.__TAURI_INTERNALS__ !== "undefined" || typeof w.__TAURI__ !== "undefined";
const cap = w.Capacitor;
const isCapacitor = !!cap && (cap.isNativePlatform?.() ?? true);
const isAndroid = cap?.getPlatform?.() === "android";

export const platform = {
  isTauri,
  isCapacitor,
  isAndroid,
  isDesktop: isTauri,
  isMobile: isCapacitor,
};

/** Tag <html> so mobile.css can target Android styling. */
export function applyPlatformClass() {
  if (isCapacitor || isAndroid) document.documentElement.classList.add("android");
}

/**
 * Mobile-only init: green Mullvad status bar + lock the vault the instant the
 * app is backgrounded (security). No-op on desktop. Safe if plugins missing.
 */
export async function initMobile(onBackground: () => void) {
  if (!isCapacitor) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#2db85a" });
  } catch {
    /* status-bar plugin unavailable */
  }
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("appStateChange", ({ isActive }) => {
      // Don't lock when the file picker backgrounded us — we'll be right back.
      if (!isActive && !importLock.isActive()) onBackground();
    });
  } catch {
    /* app plugin unavailable */
  }
}

// --- Clipboard --------------------------------------------------------------

export async function copyText(text: string) {
  if (isTauri) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
  } else if (isCapacitor) {
    const { Clipboard } = await import("@capacitor/clipboard");
    await Clipboard.write({ string: text });
  } else {
    await navigator.clipboard.writeText(text);
  }
}

export async function clearClipboard() {
  if (isTauri) {
    const { clear } = await import("@tauri-apps/plugin-clipboard-manager");
    await clear();
  } else if (isCapacitor) {
    const { Clipboard } = await import("@capacitor/clipboard");
    await Clipboard.write({ string: "" });
  } else {
    try {
      await navigator.clipboard.writeText("");
    } catch {
      /* ignore */
    }
  }
}

// --- Confirm dialog ---------------------------------------------------------

export async function confirmDialog(message: string, title = "Bestätigen"): Promise<boolean> {
  if (isTauri) {
    const { confirm } = await import("@tauri-apps/plugin-dialog");
    return confirm(message, { title, kind: "warning" });
  }
  return window.confirm(message);
}

// --- File pickers (desktop only; mobile uses fixed storage paths) -----------

export async function pickVaultToOpen(): Promise<string | null> {
  if (!isTauri) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const sel = await open({ multiple: false, filters: [{ name: "Verity Vault", extensions: ["sp3vault"] }] });
  return typeof sel === "string" ? sel : null;
}

export async function pickVaultToCreate(): Promise<string | null> {
  if (!isTauri) return "vault.sp3vault"; // mobile: fixed name in app storage
  const { save } = await import("@tauri-apps/plugin-dialog");
  const sel = await save({ defaultPath: "vault.sp3vault", filters: [{ name: "Verity Vault", extensions: ["sp3vault"] }] });
  return typeof sel === "string" ? sel : null;
}

export async function pickImportFile(name: string, exts: string[]): Promise<string | null> {
  if (!isTauri) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const sel = await open({ multiple: false, filters: [{ name, extensions: exts }] });
  return typeof sel === "string" ? sel : null;
}

export async function pickExportDest(defaultName: string, ext: string): Promise<string | null> {
  if (!isTauri) return defaultName; // mobile: written to Documents by the web backend
  const { save } = await import("@tauri-apps/plugin-dialog");
  const sel = await save({ defaultPath: defaultName, filters: [{ name: ext, extensions: [ext] }] });
  return typeof sel === "string" ? sel : null;
}

/**
 * Unified import picker. Returns a *path* on desktop (Rust reads the file) and
 * the decoded file *content* on Android (the web backend parses it directly).
 */
export async function pickImportContent(
  name: string,
  exts: string[],
  mimes: string[],
): Promise<string | null> {
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const sel = await open({ multiple: false, filters: [{ name, extensions: exts }] });
    return typeof sel === "string" ? sel : null;
  }
  if (isCapacitor) {
    const { FilePicker } = await import("@capawesome/capacitor-file-picker");
    try {
      importLock.acquire(); // suppress auto-lock while the picker is foregrounded
      const res = await FilePicker.pickFiles({ types: mimes, readData: true });
      const f = res.files?.[0];
      if (!f?.data) return null;
      const { fromBase64 } = await import("./crypto");
      return new TextDecoder("utf-8").decode(fromBase64(f.data));
    } finally {
      // Delay release slightly so the appStateChange(active) fires first.
      setTimeout(() => importLock.release(), 800);
    }
  }
  return null;
}

// --- Screenshot protection (Android FLAG_SECURE via tiny native plugin) ------

export async function setScreenshotProtection(enabled: boolean) {
  if (!isCapacitor) return;
  try {
    const { registerPlugin } = await import("@capacitor/core");
    const ScreenshotProtect = registerPlugin<{ setEnabled(o: { enabled: boolean }): Promise<void> }>(
      "ScreenshotProtect",
    );
    await ScreenshotProtect.setEnabled({ enabled });
  } catch {
    /* plugin unavailable */
  }
}
