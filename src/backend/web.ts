/**
 * Web backend for the Android/Capacitor build. Implements the same VaultApi as
 * the Tauri backend but entirely in TypeScript: Web Crypto for encryption,
 * Capacitor Filesystem for storage. The decrypted entries and the account
 * number live in memory only while unlocked.
 */
import type { Entry, ImportResult, NewEntry, PasswordOptions, VaultApi } from "../types";
import { encryptVault, decryptVault, generateAccountNumber, toBase64 } from "../utils/crypto";
import { generatePassword, estimateStrength } from "../utils/generator";
import { readVaultRaw, writeVaultRaw, vaultExistsFs, readSettings, writeSettings, writeDocument } from "../utils/storage";
import { parseImport } from "../utils/importer";

interface Session {
  token: string;
  path: string;
  number: string; // normalized 16 digits, kept to re-encrypt on mutation
  entries: Entry[];
}

let session: Session | null = null;

function normalize(s: string): string {
  const d = s.replace(/\D/g, "");
  if (d.length !== 16) throw new Error("Ungültige Kontonummer");
  return d;
}

function nowSecs() {
  return Math.floor(Date.now() / 1000);
}

function requireSession(token: string): Session {
  if (!session || session.token !== token) throw new Error("Vault ist gesperrt");
  return session;
}

async function persist(s: Session) {
  const blob = await encryptVault({ entries: s.entries }, s.number);
  await writeVaultRaw(s.path, blob);
}

// --- persistent brute-force lock (settings._locks) --------------------------

async function lockCheck(path: string) {
  const settings = await readSettings();
  const locks = (settings._locks as Record<string, { attempts?: number; locked_until?: number }>) || {};
  const until = locks[path]?.locked_until;
  if (until && until > nowSecs()) throw new Error(`Gesperrt noch ${until - nowSecs()}s`);
}

async function lockRegisterFailure(path: string): Promise<number> {
  const settings = await readSettings();
  const locks = (settings._locks as Record<string, { attempts?: number; locked_until?: number }>) || {};
  const attempts = (locks[path]?.attempts ?? 0) + 1;
  let applied = 0;
  const entry: { attempts: number; locked_until?: number } = { attempts };
  if (attempts >= 5) {
    const extra = Math.min(attempts - 5, 10);
    const secs = Math.min(30 * 2 ** extra, 3600);
    entry.locked_until = nowSecs() + secs;
    applied = secs;
  }
  locks[path] = entry;
  settings._locks = locks;
  await writeSettings(settings);
  return applied;
}

async function lockClear(path: string) {
  const settings = await readSettings();
  const locks = (settings._locks as Record<string, unknown>) || {};
  delete locks[path];
  settings._locks = locks;
  await writeSettings(settings);
}

export const webApi: VaultApi = {
  defaultVaultPath: async () => "vault.sp3vault",
  vaultExists: (path) => vaultExistsFs(path),
  isUnlocked: async () => !!session,

  async createVault(path, accountNumber) {
    const number = normalize(accountNumber);
    if (await vaultExistsFs(path)) throw new Error("Es existiert bereits ein Vault");
    const entries: Entry[] = [];
    session = { token: crypto.randomUUID(), path, number, entries };
    await persist(session);
    await lockClear(path);
    return { session_token: session.token, path, entry_count: 0 };
  },

  async openVault(path, accountNumber) {
    await lockCheck(path);
    const number = normalize(accountNumber);
    const raw = await readVaultRaw(path);
    if (!raw) throw new Error("Kein Vault gefunden");
    try {
      const data = await decryptVault<{ entries: Entry[] }>(raw, number);
      session = { token: crypto.randomUUID(), path, number, entries: data.entries ?? [] };
      await lockClear(path);
      return { session_token: session.token, path, entry_count: session.entries.length };
    } catch {
      const locked = await lockRegisterFailure(path);
      throw new Error(locked > 0 ? `Falsche Kontonummer — gesperrt für ${locked}s` : "Falsche Kontonummer");
    }
  },

  lockVault: async () => {
    session = null;
  },

  getEntries: async (token) => requireSession(token).entries.slice(),

  async createEntry(token, e: NewEntry) {
    const s = requireSession(token);
    const ts = Date.now();
    const entry: Entry = { id: crypto.randomUUID(), ...e, created_at: ts, updated_at: ts };
    s.entries.push(entry);
    await persist(s);
    return entry;
  },

  async updateEntry(token, e: Entry) {
    const s = requireSession(token);
    const slot = s.entries.find((x) => x.id === e.id);
    if (!slot) throw new Error("Eintrag nicht gefunden");
    Object.assign(slot, { ...e, created_at: slot.created_at, updated_at: Date.now() });
    await persist(s);
  },

  async deleteEntry(token, id) {
    const s = requireSession(token);
    const before = s.entries.length;
    s.entries = s.entries.filter((x) => x.id !== id);
    if (s.entries.length === before) throw new Error("Eintrag nicht gefunden");
    await persist(s);
  },

  generatePassword: async (options: PasswordOptions) => generatePassword(options),
  generateAccountNumber: async () => generateAccountNumber(),
  estimateStrength: async (password) => estimateStrength(password),

  // On Android the `source` arg carries the decoded file *content* (the native
  // picker has no usable path); the desktop backend instead receives a path.
  previewImport: async (format, source): Promise<ImportResult> => {
    const entries = parseImport(format, source);
    return { imported: entries.length, skipped: 0, entries };
  },
  async importFromFile(token, format, source): Promise<ImportResult> {
    const s = requireSession(token);
    const parsed = parseImport(format, source);
    const ts = Date.now();
    for (const ne of parsed) {
      s.entries.push({ id: crypto.randomUUID(), ...ne, created_at: ts, updated_at: ts });
    }
    await persist(s);
    return { imported: parsed.length, skipped: 0, entries: [] };
  },

  async exportVault(token, format, _path) {
    const s = requireSession(token);
    if (format === "sp3vault") {
      const blob = await encryptVault({ entries: s.entries }, s.number);
      await writeDocument("verity-export.sp3vault", toBase64(blob));
    } else if (format === "csv") {
      const head = "title,username,password,url,notes,category\n";
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const body = s.entries
        .map((e) => [e.title, e.username, e.password, e.url, e.notes, e.category].map(esc).join(","))
        .join("\n");
      await writeDocument("verity-export.csv", head + body);
    } else {
      await writeDocument("verity-export.json", JSON.stringify({ entries: s.entries }, null, 2));
    }
  },

  async backupVault(token, _destPath) {
    const s = requireSession(token);
    const blob = await encryptVault({ entries: s.entries }, s.number);
    await writeDocument("vault-backup.sp3vault", toBase64(blob));
  },

  async changeMasterPassword(token, oldPw, newPw) {
    const s = requireSession(token);
    if (normalize(oldPw) !== s.number) throw new Error("Aktuelle Kontonummer ist falsch");
    s.number = normalize(newPw);
    await persist(s);
  },

  loadSettings: async () => readSettings(),
  async saveSettings(settings) {
    const existing = await readSettings();
    await writeSettings({ ...existing, ...settings });
  },
};
