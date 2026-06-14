//! Tauri command surface. Every command that touches secrets requires a valid
//! session token. File paths come from the frontend dialog; all reading,
//! decryption and re-encryption happen here in Rust.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::State;
use uuid::Uuid;

use crate::crypto;
use crate::generator::{self, PasswordOptions, StrengthResult};
use crate::importer::{self, ImportResult};
use crate::state::{AppState, UnlockedSession};
use crate::vault::{self, Entry, NewEntry, VaultData, VaultMeta};

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Atomically write vault bytes: tmp -> rename(old->bak) -> rename(tmp->path),
/// removing the .bak on success. A crash leaves a recoverable .bak behind.
fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("sp3vault.tmp");
    let bak = path.with_extension("sp3vault.bak");
    fs::write(&tmp, bytes).map_err(|e| format!("write temp vault: {e}"))?;

    if path.exists() {
        if bak.exists() {
            fs::remove_file(&bak).map_err(|e| format!("remove old backup: {e}"))?;
        }
        fs::rename(path, &bak).map_err(|e| format!("rotate vault to backup: {e}"))?;
    }
    if let Err(e) = fs::rename(&tmp, path) {
        // Try to restore from backup so we never lose the vault.
        if bak.exists() {
            let _ = fs::rename(&bak, path);
        }
        return Err(format!("commit vault: {e}"));
    }
    let _ = fs::remove_file(&bak); // best-effort cleanup
    Ok(())
}

/// Re-encrypt the in-memory vault and persist it to its path.
fn persist(session: &UnlockedSession) -> Result<(), String> {
    let bytes = vault::serialize_vault(&session.data, &session.salt, &session.key)?;
    atomic_write(&session.path, &bytes)
}

// ---------------------------------------------------------------------------
// Vault lifecycle
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn create_vault(
    state: State<'_, AppState>,
    path: String,
    master_password: String,
) -> Result<VaultMeta, String> {
    let number = normalize_account_number(&master_password)?;
    let p = PathBuf::from(&path);
    if p.exists() {
        return Err("An dieser Stelle existiert bereits ein Vault".into());
    }

    let salt = crypto::random_salt();
    let key = crypto::derive_key(&number, &salt)?;
    let data = VaultData::default();
    let bytes = vault::serialize_vault(&data, &salt, &key)?;
    atomic_write(&p, &bytes)?;

    let _ = lock_clear(&path);
    let token = Uuid::new_v4().to_string();
    let mut guard = state.0.lock().map_err(|_| "state poisoned")?;
    guard.session = Some(UnlockedSession {
        token: token.clone(),
        path: p,
        salt,
        key,
        data,
    });
    Ok(VaultMeta {
        session_token: token,
        path,
        entry_count: 0,
    })
}

#[tauri::command]
pub async fn open_vault(
    state: State<'_, AppState>,
    path: String,
    master_password: String,
) -> Result<VaultMeta, String> {
    // Persistent brute-force gate (survives restarts).
    lock_check(&path)?;
    let number = normalize_account_number(&master_password)?;

    let p = PathBuf::from(&path);
    let bytes = fs::read(&p).map_err(|e| format!("cannot read vault: {e}"))?;
    let header = vault::parse_header(&bytes)?;
    let key = crypto::derive_key(&number, &header.salt)?;

    match vault::decrypt_vault(&bytes, &header, &key) {
        Ok(data) => {
            let _ = lock_clear(&path);
            let token = Uuid::new_v4().to_string();
            let count = data.entries.len();
            let mut guard = state.0.lock().map_err(|_| "state poisoned")?;
            guard.session = Some(UnlockedSession {
                token: token.clone(),
                path: p,
                salt: header.salt,
                key,
                data,
            });
            Ok(VaultMeta {
                session_token: token,
                path,
                entry_count: count,
            })
        }
        Err(_) => {
            let locked = lock_register_failure(&path);
            if locked > 0 {
                Err(format!("Falsche Kontonummer — gesperrt für {locked}s"))
            } else {
                Err("Falsche Kontonummer".into())
            }
        }
    }
}

#[tauri::command]
pub async fn lock_vault(state: State<'_, AppState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "state poisoned")?;
    guard.lock();
    Ok(())
}

#[tauri::command]
pub async fn is_unlocked(state: State<'_, AppState>) -> Result<bool, String> {
    let guard = state.0.lock().map_err(|_| "state poisoned")?;
    Ok(guard.session.is_some())
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_entries(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<Vec<Entry>, String> {
    let mut guard = state.0.lock().map_err(|_| "state poisoned")?;
    let session = guard.session_mut(&session_token)?;
    Ok(session.data.entries.clone())
}

#[tauri::command]
pub async fn create_entry(
    state: State<'_, AppState>,
    session_token: String,
    entry: NewEntry,
) -> Result<Entry, String> {
    let mut guard = state.0.lock().map_err(|_| "state poisoned")?;
    let session = guard.session_mut(&session_token)?;
    let ts = now_millis();
    let new = Entry {
        id: Uuid::new_v4().to_string(),
        title: entry.title,
        username: entry.username,
        password: entry.password,
        url: entry.url,
        notes: entry.notes,
        category: entry.category,
        created_at: ts,
        updated_at: ts,
    };
    session.data.entries.push(new.clone());
    persist(session)?;
    Ok(new)
}

#[tauri::command]
pub async fn update_entry(
    state: State<'_, AppState>,
    session_token: String,
    entry: Entry,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "state poisoned")?;
    let session = guard.session_mut(&session_token)?;
    let slot = session
        .data
        .entries
        .iter_mut()
        .find(|e| e.id == entry.id)
        .ok_or("entry not found")?;
    // Update in place (cannot move out of `entry` because Entry implements Drop
    // for zeroizing). created_at is preserved.
    slot.title = entry.title.clone();
    slot.username = entry.username.clone();
    slot.password = entry.password.clone();
    slot.url = entry.url.clone();
    slot.notes = entry.notes.clone();
    slot.category = entry.category.clone();
    slot.updated_at = now_millis();
    persist(session)
}

#[tauri::command]
pub async fn delete_entry(
    state: State<'_, AppState>,
    session_token: String,
    id: String,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "state poisoned")?;
    let session = guard.session_mut(&session_token)?;
    let before = session.data.entries.len();
    session.data.entries.retain(|e| e.id != id);
    if session.data.entries.len() == before {
        return Err("entry not found".into());
    }
    persist(session)
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn generate_password(options: PasswordOptions) -> Result<String, String> {
    generator::generate(&options)
}

#[tauri::command]
pub async fn estimate_password_strength(password: String) -> Result<StrengthResult, String> {
    Ok(generator::estimate_strength(&password))
}

/// Generate a 16-digit account number from the OS CSPRNG (Mullvad-style login).
/// The number itself is never stored — it is the input to Argon2id key
/// derivation, exactly like a master password.
#[tauri::command]
pub async fn generate_account_number() -> Result<String, String> {
    // 16 uniform digits via rejection sampling (no modulo bias).
    let mut out = String::with_capacity(16);
    while out.len() < 16 {
        for b in crypto::random_bytes(16) {
            if b < 250 {
                // 250 = floor(256/10)*10 -> unbiased
                out.push(char::from(b'0' + (b % 10)));
                if out.len() == 16 {
                    break;
                }
            }
        }
    }
    Ok(out)
}

// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------

/// Parse an external file without committing (for the wizard preview).
#[tauri::command]
pub async fn preview_import(format: String, path: String) -> Result<ImportResult, String> {
    let bytes = fs::read(&path).map_err(|e| format!("cannot read import file: {e}"))?;
    let entries = importer::parse(&format, &bytes)?;
    Ok(ImportResult {
        imported: entries.len(),
        skipped: 0,
        entries,
    })
}

#[tauri::command]
pub async fn import_from_file(
    state: State<'_, AppState>,
    session_token: String,
    format: String,
    path: String,
) -> Result<ImportResult, String> {
    let bytes = fs::read(&path).map_err(|e| format!("cannot read import file: {e}"))?;
    let parsed = importer::parse(&format, &bytes)?;

    let mut guard = state.0.lock().map_err(|_| "state poisoned")?;
    let session = guard.session_mut(&session_token)?;
    let ts = now_millis();
    let count = parsed.len();
    for ne in parsed {
        session.data.entries.push(Entry {
            id: Uuid::new_v4().to_string(),
            title: ne.title,
            username: ne.username,
            password: ne.password,
            url: ne.url,
            notes: ne.notes,
            category: ne.category,
            created_at: ts,
            updated_at: ts,
        });
    }
    persist(session)?;
    Ok(ImportResult {
        imported: count,
        skipped: 0,
        entries: Vec::new(),
    })
}

#[tauri::command]
pub async fn export_vault(
    state: State<'_, AppState>,
    session_token: String,
    format: String,
    path: String,
) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "state poisoned")?;
    let session = guard.session_mut(&session_token)?;
    let dest = PathBuf::from(&path);

    match format.to_lowercase().as_str() {
        "sp3vault" => {
            // Encrypted backup with the same key/salt.
            let bytes = vault::serialize_vault(&session.data, &session.salt, &session.key)?;
            fs::write(&dest, &bytes).map_err(|e| format!("write export: {e}"))
        }
        "csv" => {
            let mut wtr = csv::Writer::from_writer(Vec::new());
            wtr.write_record(["title", "username", "password", "url", "notes", "category"])
                .map_err(|e| e.to_string())?;
            for e in &session.data.entries {
                wtr.write_record([
                    &e.title, &e.username, &e.password, &e.url, &e.notes, &e.category,
                ])
                .map_err(|e| e.to_string())?;
            }
            let data = wtr.into_inner().map_err(|e| e.to_string())?;
            fs::write(&dest, data).map_err(|e| format!("write export: {e}"))
        }
        "json" => {
            let data =
                serde_json::to_vec_pretty(&session.data).map_err(|e| e.to_string())?;
            fs::write(&dest, data).map_err(|e| format!("write export: {e}"))
        }
        other => Err(format!("unsupported export format: {other}")),
    }
}

#[tauri::command]
pub async fn backup_vault(
    state: State<'_, AppState>,
    session_token: String,
    dest_path: String,
) -> Result<(), String> {
    let guard = state.0.lock().map_err(|_| "state poisoned")?;
    let session = match &guard.session {
        Some(s) if s.token == session_token => s,
        _ => return Err("no active session — vault is locked".into()),
    };
    fs::copy(&session.path, &dest_path).map_err(|e| format!("backup failed: {e}"))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Master password change (re-encryption)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn change_master_password(
    state: State<'_, AppState>,
    session_token: String,
    old_pw: String,
    new_pw: String,
) -> Result<(), String> {
    let old_number = normalize_account_number(&old_pw)?;
    let new_number = normalize_account_number(&new_pw)?;
    let mut guard = state.0.lock().map_err(|_| "state poisoned")?;
    let session = guard.session_mut(&session_token)?;

    // Verify the current account number against the current salt.
    let old_key = crypto::derive_key(&old_number, &session.salt)?;
    if old_key.0 != session.key.0 {
        return Err("Aktuelle Kontonummer ist falsch".into());
    }

    // Fresh salt + key, then re-encrypt everything.
    let new_salt = crypto::random_salt();
    let new_key = crypto::derive_key(&new_number, &new_salt)?;
    session.salt = new_salt;
    session.key = new_key;
    persist(session)
}

// ---------------------------------------------------------------------------
// Portable helpers & settings
// ---------------------------------------------------------------------------

fn exe_dir() -> Result<PathBuf, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    exe.parent()
        .map(|p| p.to_path_buf())
        .ok_or_else(|| "cannot resolve exe directory".into())
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Strip to ASCII digits and require exactly 16 (the account number).
fn normalize_account_number(s: &str) -> Result<String, String> {
    let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() != 16 {
        return Err("Ungültige Kontonummer".into());
    }
    Ok(digits)
}

fn settings_path() -> Result<PathBuf, String> {
    Ok(exe_dir()?.join("settings.json"))
}

fn read_settings_file() -> serde_json::Value {
    settings_path()
        .ok()
        .and_then(|p| fs::read(p).ok())
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_else(|| serde_json::json!({}))
}

fn write_settings_file(v: &serde_json::Value) -> Result<(), String> {
    let p = settings_path()?;
    let bytes = serde_json::to_vec_pretty(v).map_err(|e| e.to_string())?;
    fs::write(p, bytes).map_err(|e| format!("write settings: {e}"))
}

// --- Persistent brute-force lock (stored in settings.json under "_locks") -----

/// Returns Err if `path` is currently locked out.
fn lock_check(path: &str) -> Result<(), String> {
    let s = read_settings_file();
    if let Some(until) = s
        .get("_locks")
        .and_then(|l| l.get(path))
        .and_then(|e| e.get("locked_until"))
        .and_then(|v| v.as_u64())
    {
        let now = now_secs();
        if until > now {
            return Err(format!("Gesperrt noch {}s", until - now));
        }
    }
    Ok(())
}

/// Record a failed attempt; lock exponentially after 5 fails. Returns the
/// applied lock duration in seconds (0 if not yet locked). Persisted to disk.
fn lock_register_failure(path: &str) -> u64 {
    let mut root = match read_settings_file() {
        serde_json::Value::Object(m) => m,
        _ => serde_json::Map::new(),
    };
    let mut locks = match root.remove("_locks") {
        Some(serde_json::Value::Object(m)) => m,
        _ => serde_json::Map::new(),
    };
    let attempts = locks
        .get(path)
        .and_then(|e| e.get("attempts"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0)
        + 1;

    let mut entry = serde_json::Map::new();
    entry.insert("attempts".into(), serde_json::json!(attempts));
    let mut applied = 0u64;
    if attempts >= 5 {
        // 5 -> 30s, 6 -> 60s, 7 -> 120s ... capped at 1 hour.
        let extra = (attempts - 5).min(10) as u32;
        let secs = 30u64.saturating_mul(1u64 << extra).min(3600);
        entry.insert("locked_until".into(), serde_json::json!(now_secs() + secs));
        applied = secs;
    }
    locks.insert(path.to_string(), serde_json::Value::Object(entry));
    root.insert("_locks".into(), serde_json::Value::Object(locks));
    let _ = write_settings_file(&serde_json::Value::Object(root));
    applied
}

/// Clear lock state for a path after a successful unlock.
fn lock_clear(path: &str) -> Result<(), String> {
    let mut root = match read_settings_file() {
        serde_json::Value::Object(m) => m,
        _ => return Ok(()),
    };
    if let Some(serde_json::Value::Object(locks)) = root.get_mut("_locks") {
        locks.remove(path);
    }
    write_settings_file(&serde_json::Value::Object(root))
}

/// Default portable vault path: `vault.sp3vault` next to the executable.
#[tauri::command]
pub async fn default_vault_path() -> Result<String, String> {
    Ok(exe_dir()?
        .join("vault.sp3vault")
        .to_string_lossy()
        .to_string())
}

#[tauri::command]
pub async fn vault_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

#[tauri::command]
pub async fn load_settings() -> Result<serde_json::Value, String> {
    let path = exe_dir()?.join("settings.json");
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    serde_json::from_slice(&bytes).map_err(|e| format!("invalid settings.json: {e}"))
}

#[tauri::command]
pub async fn save_settings(settings: serde_json::Value) -> Result<(), String> {
    // Merge incoming top-level keys over existing, preserving keys the frontend
    // doesn't know about (e.g. "_locks" written by the brute-force gate).
    let mut root = match read_settings_file() {
        serde_json::Value::Object(m) => m,
        _ => serde_json::Map::new(),
    };
    if let serde_json::Value::Object(incoming) = settings {
        for (k, v) in incoming {
            root.insert(k, v);
        }
    }
    write_settings_file(&serde_json::Value::Object(root))
}
