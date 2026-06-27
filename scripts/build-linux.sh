#!/bin/bash
# Builds the Linux DEB + AppImage. Run on Linux (Ubuntu 22.04 recommended).
set -e
echo "Building Verity Lock für Linux..."

npm install
npm run tauri build

DEB=$(find src-tauri/target/release/bundle/deb -name "*.deb" | head -1)
IMG=$(find src-tauri/target/release/bundle/appimage -name "*.AppImage" | head -1)

mkdir -p dist-linux
cp "$DEB" dist-linux/verity-lock_1.0.0_amd64.deb
cp "$IMG" dist-linux/verity-lock_1.0.0_amd64.AppImage
chmod +x dist-linux/verity-lock_1.0.0_amd64.AppImage

echo "Fertig:"
echo "  dist-linux/verity-lock_1.0.0_amd64.deb"
echo "  dist-linux/verity-lock_1.0.0_amd64.AppImage"
