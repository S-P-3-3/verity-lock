# Builds the portable Windows version (no installer) and zips it.
# Usage:  pwsh scripts/build-portable-win.ps1
$ErrorActionPreference = "Stop"
Write-Host "Building sp3 Lock Portable..."

npm run tauri build -- --bundles nsis

$out = "dist-portable\sp3-lock-portable"
New-Item -ItemType Directory -Force -Path $out | Out-Null
Copy-Item "src-tauri\target\release\sp3-lock.exe" "$out\" -Force

@"
sp3 Lock — Portable Version

Starte sp3-lock.exe.
Beim ersten Start wird eine neue Vault-Datei erstellt.
Die Datei vault.sp3vault liegt im gleichen Ordner wie die .exe.

Kopiere diesen Ordner auf einen USB-Stick — fertig.

https://github.com/sp3dev/sp3-lock
"@ | Out-File "$out\LIES-MICH.txt" -Encoding UTF8

Compress-Archive -Path "$out\*" -DestinationPath "dist-portable\sp3-lock-portable-win.zip" -Force
Write-Host "Fertig: dist-portable\sp3-lock-portable-win.zip"
