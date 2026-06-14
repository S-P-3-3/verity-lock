/**
 * Capacitor Filesystem storage for the Android build. The vault lives in the
 * app-private data directory (`Directory.Data` → /data/data/dev.sp3.lock/files),
 * which is inaccessible to other apps without root. Exports go to Documents.
 */
import { toBase64, fromBase64 } from "./crypto";

function base(path: string): string {
  return path.split(/[\\/]/).pop() || "vault.sp3vault";
}

async function fs() {
  const mod = await import("@capacitor/filesystem");
  return mod;
}

export async function readVaultRaw(path: string): Promise<Uint8Array | null> {
  try {
    const { Filesystem, Directory, Encoding } = await fs();
    const file = await Filesystem.readFile({ path: base(path), directory: Directory.Data, encoding: Encoding.UTF8 });
    return fromBase64(file.data as string);
  } catch {
    return null;
  }
}

export async function writeVaultRaw(path: string, bytes: Uint8Array): Promise<void> {
  const { Filesystem, Directory, Encoding } = await fs();
  await Filesystem.writeFile({
    path: base(path),
    data: toBase64(bytes),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
  });
}

export async function vaultExistsFs(path: string): Promise<boolean> {
  try {
    const { Filesystem, Directory } = await fs();
    await Filesystem.stat({ path: base(path), directory: Directory.Data });
    return true;
  } catch {
    return false;
  }
}

/** Write an export/backup file to the shared Documents directory. */
export async function writeDocument(name: string, data: string): Promise<string> {
  const { Filesystem, Directory, Encoding } = await fs();
  await Filesystem.writeFile({ path: name, data, directory: Directory.Documents, encoding: Encoding.UTF8 });
  return `Documents/${name}`;
}

// --- settings.json (Directory.Data) ----------------------------------------

export async function readSettings(): Promise<Record<string, unknown>> {
  try {
    const { Filesystem, Directory, Encoding } = await fs();
    const file = await Filesystem.readFile({ path: "settings.json", directory: Directory.Data, encoding: Encoding.UTF8 });
    return JSON.parse(file.data as string);
  } catch {
    return {};
  }
}

export async function writeSettings(obj: Record<string, unknown>): Promise<void> {
  const { Filesystem, Directory, Encoding } = await fs();
  await Filesystem.writeFile({
    path: "settings.json",
    data: JSON.stringify(obj),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
  });
}
