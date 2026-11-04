#!/usr/bin/env bash
# Authors: Grok and Eldon R. Brown - WA0UWH
# Rev 20261103 - build the WA0UWH Dev zip with a Rev_<version_name>.txt marker.
# Usage (from chrome-extension/): packaging/build_dev_zip.sh [out.zip]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-/workspace/Bots/mrgit/voice-reader/Grok-Voice-Reader-WA0UWH-Dev.zip}"
VER=$(python3 -c "import json;print(json.load(open('manifest.json'))['version_name'])")
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp -r manifest.json popup.html popup.js popup.css piper-offscreen.html icons src vendor "$STAGE/"
cat > "$STAGE/Rev_${VER}.txt" <<TXT
# Authors: Grok and Eldon R. Brown - WA0UWH
Version: ${VER}
Commit: $(git rev-parse --short HEAD)$(git diff --quiet HEAD -- . || echo " (+local changes)")
Branch: $(git rev-parse --abbrev-ref HEAD)
Built: $(TZ=America/Los_Angeles date "+%Y-%m-%d %-I:%M %p %Z")
# End
TXT
rm -f "$OUT"
( cd "$STAGE" && python3 - "$OUT" <<'PY'
import os, sys, zipfile
with zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_DEFLATED) as z:
    for d, _, fs in os.walk("."):
        for f in sorted(fs):
            p = os.path.join(d, f)[2:]
            z.write(p, p)
PY
)
echo "Built $OUT ($VER)"
# End
