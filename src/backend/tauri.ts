import { invoke } from "@tauri-apps/api/core";
import type { Entry, ImportResult, NewEntry, PasswordOptions, StrengthResult, VaultApi, VaultMeta } from "../types";

// Tauri converts top-level command arg names from camelCase to snake_case
// automatically; nested struct fields keep their serde (snake_case) names.
export const tauriApi: VaultApi = {
  defaultVaultPath: () => invoke<string>("default_vault_path"),
  vaultExists: (path) => invoke<boolean>("vault_exists", { path }),
  isUnlocked: () => invoke<boolean>("is_unlocked"),

  createVault: (path, masterPassword) => invoke<VaultMeta>("create_vault", { path, masterPassword }),
  openVault: (path, masterPassword) => invoke<VaultMeta>("open_vault", { path, masterPassword }),
  lockVault: () => invoke<void>("lock_vault"),

  getEntries: (sessionToken) => invoke<Entry[]>("get_entries", { sessionToken }),
  createEntry: (sessionToken, entry: NewEntry) => invoke<Entry>("create_entry", { sessionToken, entry }),
  updateEntry: (sessionToken, entry: Entry) => invoke<void>("update_entry", { sessionToken, entry }),
  deleteEntry: (sessionToken, id) => invoke<void>("delete_entry", { sessionToken, id }),

  generatePassword: (options: PasswordOptions) => invoke<string>("generate_password", { options }),
  generateAccountNumber: () => invoke<string>("generate_account_number"),
  estimateStrength: (password) => invoke<StrengthResult>("estimate_password_strength", { password }),

  previewImport: (format, path) => invoke<ImportResult>("preview_import", { format, path }),
  importFromFile: (sessionToken, format, path) => invoke<ImportResult>("import_from_file", { sessionToken, format, path }),
  exportVault: (sessionToken, format, path) => invoke<void>("export_vault", { sessionToken, format, path }),
  backupVault: (sessionToken, destPath) => invoke<void>("backup_vault", { sessionToken, destPath }),
  changeMasterPassword: (sessionToken, oldPw, newPw) => invoke<void>("change_master_password", { sessionToken, oldPw, newPw }),

  loadSettings: () => invoke<Record<string, unknown>>("load_settings"),
  saveSettings: (settings) => invoke<void>("save_settings", { settings }),
};
