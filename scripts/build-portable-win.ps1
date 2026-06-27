# Builds the portable Windows version (no installer) and zips it.
# Usage:  pwsh scripts/build-portable-win.ps1
$ErrorActionPreference = "Stop"
Write-Host "Building Verity Lock Portable..."

npm run tauri build -- --bundles nsis

$out = "dist-portable\verity-lock-portable"
New-Item -ItemType Directory -Force -Path $out | Out-Null
Copy-Item "src-tauri\target\release\verity-lock.exe" "$out\" -Force

@"
Verity Lock — Portable Version

Starte verity-lock.exe.
Beim ersten Start wird eine neue Vault-Datei erstellt.
Die Datei vault.sp3vault liegt im gleichen Ordner wie die .exe.

Kopiere diesen Ordner auf einen USB-Stick — fertig.

https://github.com/S-P-3-3/verity-lock
"@ | Out-File "$out\LIES-MICH.txt" -Encoding UTF8

Compress-Archive -Path "$out\*" -DestinationPath "dist-portable\verity-lock-portable-win.zip" -Force
Write-Host "Fertig: dist-portable\verity-lock-portable-win.zip"
