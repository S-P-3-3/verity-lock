export interface Entry {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  category: string;
  created_at: number;
  updated_at: number;
}

export interface NewEntry {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  category: string;
}

export interface VaultMeta {
  session_token: string;
  path: string;
  entry_count: number;
}

export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  passphrase: boolean;
  word_count: number;
  separator: string;
}

export interface StrengthResult {
  score: number;
  entropy_bits: number;
  label: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  entries: NewEntry[];
}

export const CATEGORIES = [
  "Login",
  "E-Mail",
  "Bank",
  "Gaming",
  "Social",
  "Sonstiges",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type AccentColor = "green" | "cyan" | "purple" | "orange" | "red" | "white";
export type TopbarColor = "green" | "dark" | "black";
export type FontSize = "small" | "normal" | "large";
export type AvatarStyle = "letter" | "emoji" | "icon" | "colorblock";
export type SortOrder = "name" | "modified" | "category" | "manual";

export interface AppSettings {
  // Erscheinungsbild
  accentColor: AccentColor;
  topbarColor: TopbarColor;
  fontSize: FontSize;
  compactMode: boolean;
  avatarStyle: AvatarStyle;
  animations: boolean;

  // Sicherheit
  autoLockMinutes: number; // 0 = nie
  clipboardClearSeconds: number; // 0 = nie
  screenshotProtect: boolean;

  // Einträge
  defaultCategory: string;
  sortOrder: SortOrder;
  showPasswordPreview: boolean;

  // Generator-Defaults
  generatorLength: number;
  genUppercase: boolean;
  genLowercase: boolean;
  genNumbers: boolean;
  genSymbols: boolean;
  genPassphrase: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  accentColor: "green",
  topbarColor: "green",
  fontSize: "normal",
  compactMode: false,
  avatarStyle: "letter",
  animations: true,

  autoLockMinutes: 5,
  clipboardClearSeconds: 30,
  screenshotProtect: true,

  defaultCategory: "Login",
  sortOrder: "name",
  showPasswordPreview: false,

  generatorLength: 20,
  genUppercase: true,
  genLowercase: true,
  genNumbers: true,
  genSymbols: true,
  genPassphrase: false,
};

/** Shared surface implemented by both the Tauri (desktop) and web (Android) backends. */
export interface VaultApi {
  defaultVaultPath(): Promise<string>;
  vaultExists(path: string): Promise<boolean>;
  isUnlocked(): Promise<boolean>;
  createVault(path: string, accountNumber: string): Promise<VaultMeta>;
  openVault(path: string, accountNumber: string): Promise<VaultMeta>;
  lockVault(): Promise<void>;
  getEntries(token: string): Promise<Entry[]>;
  createEntry(token: string, entry: NewEntry): Promise<Entry>;
  updateEntry(token: string, entry: Entry): Promise<void>;
  deleteEntry(token: string, id: string): Promise<void>;
  generatePassword(options: PasswordOptions): Promise<string>;
  generateAccountNumber(): Promise<string>;
  estimateStrength(password: string): Promise<StrengthResult>;
  previewImport(format: string, path: string): Promise<ImportResult>;
  importFromFile(token: string, format: string, path: string): Promise<ImportResult>;
  exportVault(token: string, format: string, path: string): Promise<void>;
  backupVault(token: string, destPath: string): Promise<void>;
  changeMasterPassword(token: string, oldPw: string, newPw: string): Promise<void>;
  loadSettings(): Promise<Record<string, unknown>>;
  saveSettings(settings: Record<string, unknown>): Promise<void>;
}
