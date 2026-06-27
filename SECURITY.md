# Security Policy

## Modell

Verity Lock ist **100 % offline**. Es gibt keinen Server, keinen Account und keine
Netzwerkverbindung (Android: keine `INTERNET`-Berechtigung; Desktop: CSP
`connect-src 'none'`).

- **Verschlüsselung:** AES-256-GCM.
- **Key Derivation:** Argon2id (Desktop, 64 MiB / 3 / 4) bzw. PBKDF2-SHA-256
  (Android, 210 000 Iterationen — Browser haben kein Argon2).
- **Zugang:** eine 16-stellige Kontonummer ist der einzige Schlüssel. Sie wird
  **nie gespeichert** — nur der daraus abgeleitete Schlüssel ver-/entschlüsselt
  den Vault. Geht die Nummer verloren, ist der Vault unwiederbringlich.
- **Brute-Force-Schutz:** Sperre nach 5 Fehlversuchen, exponentiell steigend,
  über Neustarts hinweg persistent.

## Eine Schwachstelle melden

Bitte **kein öffentliches Issue** für Sicherheitslücken. Melde sie privat:

- Discord: https://discord.gg/FbJaSSGtB6 (DM an einen Maintainer), oder
- GitHub Security Advisory („Report a vulnerability").

Wir antworten so schnell wie möglich und koordinieren eine Offenlegung.

## Unterstützte Versionen

| Version | Unterstützt |
|---|---|
| 1.0.x | ✅ |
