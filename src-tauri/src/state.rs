//! In-memory application state: the single unlocked session. Secrets live only
//! here, only while unlocked, and are zeroized on lock (see `Drop` impls on
//! `Entry` / `DerivedKey`).
//!
//! Brute-force lock state is NOT kept here — it is persisted to settings.json so
//! it survives app restarts (see `commands::lock_*`).

use std::path::PathBuf;
use std::sync::Mutex;

use crate::crypto::{DerivedKey, SALT_LEN};
use crate::vault::VaultData;

/// Everything we keep in RAM for an open vault, including the derived key so we
/// can re-encrypt on every mutation without re-prompting for the account number.
pub struct UnlockedSession {
    pub token: String,
    pub path: PathBuf,
    pub salt: [u8; SALT_LEN],
    pub key: DerivedKey,
    pub data: VaultData,
}

#[derive(Default)]
pub struct AppStateInner {
    pub session: Option<UnlockedSession>,
}

pub struct AppState(pub Mutex<AppStateInner>);

impl Default for AppState {
    fn default() -> Self {
        AppState(Mutex::new(AppStateInner::default()))
    }
}

impl AppStateInner {
    /// Validate a session token; returns a mutable reference to the session.
    pub fn session_mut(&mut self, token: &str) -> Result<&mut UnlockedSession, String> {
        match &mut self.session {
            Some(s) if s.token == token => Ok(s),
            _ => Err("no active session — vault is locked".into()),
        }
    }

    /// Drop the active session (zeroizes secrets on drop).
    pub fn lock(&mut self) {
        self.session = None;
    }
}
