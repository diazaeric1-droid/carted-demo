#!/bin/bash
# preship-check.sh — stop-doing #3 enforcement: flags may not outrun their paperwork.
# Run before every push. Fails if stale copy/config survives or the SW wasn't bumped.
set -u
cd "$(dirname "$0")"
fail=0
say(){ echo "  ✗ $1"; fail=1; }

# 1) old-brand colors must not exist anywhere shipped
grep -l "fbf3e4\|faf3e7" index.html manifest.json icon.svg privacy.html terms.html support.html 2>/dev/null | while read -r f; do say "old cream palette in $f"; done
[ -n "$(grep -l 'fbf3e4\|faf3e7' index.html manifest.json icon.svg 2>/dev/null)" ] && fail=1

# 2) the privacy lie must never come back
grep -q "stays on this device for now" index.html && say "stale 'stays on this device' modal copy in index.html"
grep -q "not transmitted to us" privacy.html && say "stale device-only room claim in privacy.html"

# 3) night is permanent — no clock-dependent reviewer story
grep -q "Night Shift" index.html && say "Night Shift copy resurfaced in index.html"

# 4) room red line: no XP/leaderboard strings in shipped UI copy
grep -qE '\+[0-9]+ XP' index.html && say "an XP reward string is user-visible again"

# 5) SW must be bumped when index.html changes
if ! git diff --quiet HEAD -- index.html 2>/dev/null; then
  git diff --quiet HEAD -- sw.js 2>/dev/null && say "index.html changed but sw.js CACHE not bumped"
fi

# 6) JS must parse
python3 - <<'PY' > /tmp/carted_check.js
import re
print(re.findall(r"<script>(.*?)</script>", open("index.html").read(), re.S)[0])
PY
node --check /tmp/carted_check.js 2>/dev/null || say "index.html script block has a syntax error"

if [ "$fail" -eq 0 ]; then echo "✓ preship checks pass"; else echo "PRESHIP CHECKS FAILED"; exit 1; fi
