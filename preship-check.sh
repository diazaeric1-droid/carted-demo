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

# 4b) diet-language ban (lever #3): the payoff is money + company, never body outcomes
grep -qiE 'calorie|kcal|\bdiet\b|weight[- ]loss|fasting' index.html manifest.json terms.html support.html privacy.html && say "diet/calorie language crept into shipped copy"
[ -f "$HOME/carted-app/APP_STORE.md" ] && grep -qiE 'calorie|kcal|\bdiet\b|weight[- ]loss|fasting' "$HOME/carted-app/APP_STORE.md" && say "diet/calorie language in APP_STORE.md"

# 4c) image-fidelity red line (lever #12): no external random-stock or AI-slop image sources
grep -qE 'loremflickr|placekitten|unsplash\.it|picsum' index.html && say "external random-image fallback is back (fidelity red line)"

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
