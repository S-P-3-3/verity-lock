================================================================
  sp3 Lock  —  portabel · 100% offline · militärisch verschlüsselt
================================================================

KURZANLEITUNG
-------------
1. Lege "sp3-lock.exe" in einen Ordner (z. B. auf den USB-Stick).
   Eine Installation ist NICHT nötig.

2. Starte die .exe per Doppelklick.

3. Erster Start: Master-Passwort vergeben -> "vault.sp3vault" wird
   im selben Ordner angelegt. Danach: Master-Passwort eingeben.

4. Unten gibt es 4 Tabs:
   - Vault         : Einträge ansehen, suchen, anlegen
   - Generator     : sichere Passwörter erzeugen
   - Import        : aus Bitwarden / KeePass / CSV importieren
   - Einstellungen : Auto-Lock, Backup, Master-Passwort ändern


SICHERHEIT
----------
* AES-256-GCM Verschlüsselung, Schlüssel via Argon2id (64 MB).
* Das Master-Passwort kann NICHT zurückgesetzt werden.
* Keine Netzwerkverbindung — alles bleibt lokal (Offline-Garantie).
* Auto-Lock nach Inaktivität (Standard 5 Min).
* Kopierte Passwörter werden nach 30 s aus der Zwischenablage gelöscht.
* Nach 5 Fehlversuchen: exponentiell steigende Sperre.


DATEIEN
-------
  sp3-lock.exe        Hauptprogramm
  vault.sp3vault      verschlüsselte Vault (wird angelegt)
  settings.json       Einstellungen (nichts Sensibles)
  vault.sp3vault.bak  automatisches Backup (falls vorhanden)


BACKUP
------
Sichere "vault.sp3vault" regelmäßig (oder via Einstellungen ->
Vault-Backup). Ohne diese Datei sind die Passwörter verloren.

================================================================
sp3 Lock — Open Source (GPL-3.0) · Tauri 2 + Rust + React
================================================================
