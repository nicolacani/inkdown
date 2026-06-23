#!/bin/bash
# Builds a UNIVERSAL (Intel + Apple Silicon), ad-hoc deep-signed DMG of Inkdown,
# ready to send to others. Works around two macOS pitfalls:
#   1) hdiutil/electron-builder choke when building inside iCloud Drive / paths
#      with spaces  -> we build in a local copy under ~/inkdown-build.
#   2) electron-builder with identity:null SKIPS signing, leaving nested Electron
#      helpers unsigned -> recipients would get "App is damaged". We deep ad-hoc
#      sign the whole bundle, then rebuild the DMG from the signed app.
#
# Note: the app is NOT Apple-notarized (that needs a paid Developer ID). On first
# launch recipients must approve it via System Settings > Privacy & Security >
# "Open Anyway" (see "Leggimi - Prima apertura.txt" inside the DMG).
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL="$HOME/inkdown-build"
APP_NAME="Inkdown"

echo "==> 1/5  Sincronizzo il sorgente in $LOCAL (fuori da iCloud)"
mkdir -p "$LOCAL"
rsync -a --delete \
  --exclude 'node_modules' --exclude 'release' --exclude 'dist' \
  --exclude '*.dmg' --exclude 'build/icon.iconset' \
  "$SRC/" "$LOCAL/"

cd "$LOCAL"
if [ ! -d node_modules ]; then
  echo "==> 2/5  npm install (prima volta)"
  env -u ELECTRON_RUN_AS_NODE npm install
else
  echo "==> 2/5  node_modules gia' presente, salto npm install"
fi

echo "==> 3/5  Build app universale + DMG (la firma verra' rifatta dopo)"
env -u ELECTRON_RUN_AS_NODE CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist

APP="$LOCAL/release/mac-universal/$APP_NAME.app"
echo "==> 4/5  Firma ad-hoc profonda dell'intero bundle"
xattr -cr "$APP"
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"
echo "    firma OK (valid on disk)"

echo "==> 5/5  Ricostruisco il DMG dall'app firmata"
rm -f "$LOCAL"/release/*.dmg "$LOCAL"/release/*.blockmap
env -u ELECTRON_RUN_AS_NODE CSC_IDENTITY_AUTO_DISCOVERY=false \
  npx electron-builder --prepackaged "$APP"

DMG="$(ls "$LOCAL"/release/*.dmg | head -1)"
cp "$DMG" "$SRC/"
echo ""
echo "✓ DMG universale pronto:"
echo "  $SRC/$(basename "$DMG")"
echo "  (firmato ad-hoc, non notarizzato — vedi il Leggimi dentro il DMG)"
