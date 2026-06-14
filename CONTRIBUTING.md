# Contributing to sp3 Lock

Pull Requests sind willkommen!

## Setup

```bash
git clone https://github.com/sp3dev/sp3-lock.git
cd sp3-lock
npm install
npm run tauri dev        # Desktop (Tauri)
```

Android:

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Richtlinien

- **Kein Plaintext-Passwort** jemals auf Disk schreiben.
- **Kein `unwrap()`** in Rust-Production-Code — Fehler sauber propagieren.
- Geteilter UI-Code muss auf Desktop **und** Android funktionieren
  (Plattform-Abstraktion in `src/utils/platform.ts` + `src/api.ts`).
- Neues Feature → zuerst ein Issue öffnen.
- PR beschreibt **was** geändert wurde und **warum**.
- Vor dem PR: `npm run build` (tsc) und `cd src-tauri && cargo test` müssen grün sein.

## Architektur (Kurz)

- `src/` — React/TS UI (geteilt).
- `src/backend/tauri.ts` — Desktop-Backend (Rust/IPC, Argon2id).
- `src/backend/web.ts` — Android-Backend (Web Crypto, PBKDF2).
- `src-tauri/` — Rust-Backend (AES-256-GCM, `.sp3vault`).
- `android/` — Capacitor-Projekt.

## Kontakt

Discord: https://discord.gg/FbJaSSGtB6
