//! Vault data model and the on-disk `.sp3vault` binary format.
//!
//! File layout (all binary, never plaintext):
//! ```text
//! offset 0  : magic   "SP3V"        (4 bytes)
//! offset 4  : version 0x01          (1 byte)
//! offset 5  : salt                  (32 bytes)  -> Argon2id
//! offset 37 : nonce                 (12 bytes)  -> AES-256-GCM
//! offset 49 : ciphertext + tag      (rest)
//! ```
//! The 49-byte header is passed to AES-GCM as additional authenticated data
//! (AAD), so any tampering with salt/nonce/version is detected on open.

use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

use crate::crypto::{self, DerivedKey, NONCE_LEN, SALT_LEN};

const MAGIC: &[u8; 4] = b"SP3V";
const VERSION: u8 = 1;
const HEADER_LEN: usize = 4 + 1 + SALT_LEN + NONCE_LEN; // 49

/// A single secret entry. While the vault is unlocked these live decrypted in
/// RAM; sensitive fields are zeroized when the struct is dropped (see `Drop`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub id: String,
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: String,
    pub notes: String,
    pub category: String,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Drop for Entry {
    fn drop(&mut self) {
        self.password.zeroize();
        self.notes.zeroize();
    }
}

/// Payload from the frontend when creating a new entry (no id/timestamps yet).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewEntry {
    pub title: String,
    pub username: String,
    pub password: String,
    pub url: String,
    pub notes: String,
    pub category: String,
}

/// The decrypted contents of a vault.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct VaultData {
    pub entries: Vec<Entry>,
}

/// Metadata returned to the frontend after a successful unlock (no secrets).
#[derive(Debug, Clone, Serialize)]
pub struct VaultMeta {
    pub session_token: String,
    pub path: String,
    pub entry_count: usize,
}

/// Encrypt `data` with `key` and serialize it into the `.sp3vault` byte layout.
pub fn serialize_vault(
    data: &VaultData,
    salt: &[u8; SALT_LEN],
    key: &DerivedKey,
) -> Result<Vec<u8>, String> {
    let mut plaintext =
        serde_json::to_vec(data).map_err(|e| format!("serialize vault: {e}"))?;

    let nonce = crypto::random_nonce();

    // Build header first so we can authenticate it as AAD.
    let mut out = Vec::with_capacity(HEADER_LEN + plaintext.len() + 16);
    out.extend_from_slice(MAGIC);
    out.push(VERSION);
    out.extend_from_slice(salt);
    out.extend_from_slice(&nonce);
    let header = out.clone(); // exactly the 49-byte header

    let ciphertext = crypto::encrypt(key, &nonce, &plaintext, &header)?;
    plaintext.zeroize();

    out.extend_from_slice(&ciphertext);
    Ok(out)
}

/// Parsed header of a vault file (salt + nonce), used to derive the key.
pub struct VaultHeader {
    pub salt: [u8; SALT_LEN],
    pub nonce: [u8; NONCE_LEN],
    pub header_bytes: Vec<u8>,
    pub ciphertext_offset: usize,
}

/// Validate magic/version and extract salt + nonce from raw vault bytes.
pub fn parse_header(bytes: &[u8]) -> Result<VaultHeader, String> {
    if bytes.len() < HEADER_LEN {
        return Err("vault file is truncated or not a valid .sp3vault".into());
    }
    if &bytes[0..4] != MAGIC {
        return Err("not a valid sp3 vault (bad magic)".into());
    }
    if bytes[4] != VERSION {
        return Err(format!("unsupported vault version: {}", bytes[4]));
    }
    let mut salt = [0u8; SALT_LEN];
    salt.copy_from_slice(&bytes[5..5 + SALT_LEN]);
    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&bytes[5 + SALT_LEN..HEADER_LEN]);

    Ok(VaultHeader {
        salt,
        nonce,
        header_bytes: bytes[0..HEADER_LEN].to_vec(),
        ciphertext_offset: HEADER_LEN,
    })
}

/// Decrypt a parsed vault using the derived key.
pub fn decrypt_vault(
    bytes: &[u8],
    header: &VaultHeader,
    key: &DerivedKey,
) -> Result<VaultData, String> {
    let ciphertext = &bytes[header.ciphertext_offset..];
    let mut plaintext = crypto::decrypt(key, &header.nonce, ciphertext, &header.header_bytes)?;
    let data: VaultData =
        serde_json::from_slice(&plaintext).map_err(|e| format!("corrupt vault data: {e}"))?;
    plaintext.zeroize();
    Ok(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_data() -> VaultData {
        VaultData {
            entries: vec![Entry {
                id: "abc".into(),
                title: "GitHub".into(),
                username: "user@example.com".into(),
                password: "S3cr3t!".into(),
                url: "https://github.com".into(),
                notes: "2FA enabled".into(),
                category: "Login".into(),
                created_at: 1,
                updated_at: 2,
            }],
        }
    }

    #[test]
    fn vault_roundtrips_through_bytes() {
        let salt = crypto::random_salt();
        let key = crypto::derive_key("master-pw", &salt).unwrap();
        let bytes = serialize_vault(&sample_data(), &salt, &key).unwrap();

        // Header sanity.
        assert_eq!(&bytes[0..4], MAGIC);
        assert_eq!(bytes[4], VERSION);

        let header = parse_header(&bytes).unwrap();
        let key2 = crypto::derive_key("master-pw", &header.salt).unwrap();
        let data = decrypt_vault(&bytes, &header, &key2).unwrap();
        assert_eq!(data.entries.len(), 1);
        assert_eq!(data.entries[0].title, "GitHub");
        assert_eq!(data.entries[0].password, "S3cr3t!");
    }

    #[test]
    fn no_plaintext_secret_in_file() {
        let salt = crypto::random_salt();
        let key = crypto::derive_key("master-pw", &salt).unwrap();
        let bytes = serialize_vault(&sample_data(), &salt, &key).unwrap();
        let haystack = String::from_utf8_lossy(&bytes);
        assert!(!haystack.contains("S3cr3t!"));
        assert!(!haystack.contains("user@example.com"));
        assert!(!haystack.contains("GitHub"));
    }

    #[test]
    fn wrong_password_cannot_open() {
        let salt = crypto::random_salt();
        let key = crypto::derive_key("right-pw", &salt).unwrap();
        let bytes = serialize_vault(&sample_data(), &salt, &key).unwrap();
        let header = parse_header(&bytes).unwrap();
        let wrong = crypto::derive_key("wrong-pw", &header.salt).unwrap();
        assert!(decrypt_vault(&bytes, &header, &wrong).is_err());
    }

    #[test]
    fn tampered_header_is_detected() {
        let salt = crypto::random_salt();
        let key = crypto::derive_key("pw", &salt).unwrap();
        let mut bytes = serialize_vault(&sample_data(), &salt, &key).unwrap();
        bytes[10] ^= 0x01; // flip a salt byte
        let header = parse_header(&bytes).unwrap();
        let key2 = crypto::derive_key("pw", &header.salt).unwrap();
        assert!(decrypt_vault(&bytes, &header, &key2).is_err());
    }

    #[test]
    fn rejects_bad_magic() {
        assert!(parse_header(b"XXXXX....").is_err());
    }
}
