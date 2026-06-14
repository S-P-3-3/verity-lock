# Changelog

All notable changes to sp3 Lock are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.0.0] — 2026-06-14

### Added

- **Desktop app** (Tauri 2, Windows + Linux): AES-256-GCM vault with Argon2id
  (64 MiB / 3 / 4) key derivation, binary `.sp3vault` format, portable (stores
  vault next to the executable).
- **Android app** (Capacitor 6): same Mullvad-style UI, Web Crypto vault
  (PBKDF2 210k + AES-256-GCM), 100 % offline (no INTERNET permission).
- **Account-number login** — a 16-digit access number is the only key; no
  account, no server.
- Password generator (character + passphrase modes) with strength meter.
- Import: Bitwarden (JSON), KeePass 2.x (XML), CSV (Chrome/Edge, Firefox,
  LastPass, 1Password, generic) — on desktop and Android (native file picker).
- Export: encrypted `.sp3vault`, plus CSV/JSON (with warning).
- Full customization: 6 accent colors, topbar color, font size, compact mode,
  avatar style, animations toggle, auto-lock (incl. never), clipboard timer
  (incl. never), default category, sort order, password-preview, generator
  defaults.
- Persistent brute-force lockout (exponential backoff, survives restarts).
- Android screenshot protection (FLAG_SECURE) and background auto-lock.

### Security

- Brute-force protection: lock after 5 failed attempts, exponential backoff.
- Clipboard auto-clear with live countdown.
- `zeroize` on keys and sensitive fields (desktop).
