#!/bin/bash
# Build, package and (re)install Inkdown into /Applications, ad-hoc signed.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

env -u ELECTRON_RUN_AS_NODE CSC_IDENTITY_AUTO_DISCOVERY=false npm run pack

pkill -9 -f "/Applications/Inkdown.app/Contents/MacOS/Inkdown" 2>/dev/null || true
sleep 1

rm -rf /Applications/Inkdown.app
ditto "$ROOT/release/mac-arm64/Inkdown.app" /Applications/Inkdown.app
xattr -cr /Applications/Inkdown.app
codesign --force --deep --sign - /Applications/Inkdown.app
codesign --verify --deep --strict /Applications/Inkdown.app
echo "✓ Inkdown installed to /Applications"
