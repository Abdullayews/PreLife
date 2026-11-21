#!/usr/bin/env bash
# Round 5 — OAuth happy-path verification (both modes) + takeover regression
set -u
EV=/tmp/round5; mkdir -p $EV
BASE=http://localhost:3000

run_flow() { # run_flow <label> <mode> <email-or-empty>
  local label=$1 mode=$2 want_email=$3
  local jar="$EV/flow-$label.jar"
  rm -f "$jar"
  curl -s --max-time 10 -D "$EV/f$label.1.h" -o /dev/null \
    "$BASE/api/auth/oauth/google?mode=$mode" -c "$jar"
  local az=$(grep -i '^location' "$EV/f$label.1.h" | tr -d '\r' | awk '{print $2}')
  curl -s --max-time 10 -b "$jar" "$az" > "$EV/f$label.page"
  python3 - "$label" "$want_email" <<'EOF'
import re, sys, urllib.parse
label, want = sys.argv[1], sys.argv[2]
html = open(f"/tmp/round5/f{label}.page").read()
action = re.search(r'action="([^"]+)"', html).group(1)
fields = dict(re.findall(r'name="([^"]+)" value="([^"]*)"', html))
if want: fields['email'] = want
m = re.search(r'name="email"[^>]*value="([^"]*)"|value="([^"]*)"[^>]*name="email"', html)
if 'email' not in fields and m:
    fields['email'] = m.group(1) or m.group(2)
if not fields.get('email'):
    fields['email'] = 'google.user@emu.prelife.dev'
open(f"/tmp/round5/f{label}.f","w").write(action+"\n"+urllib.parse.urlencode(fields))
EOF
  local A=$(head -1 "$EV/f$label.f") B=$(tail -1 "$EV/f$label.f")
  curl -s --max-time 10 -b "$jar" -c "$jar" -X POST "$A" \
    -H "Origin: http://localhost:3000" -H "Content-Type: application/x-www-form-urlencoded" \
    --data "$B" -D "$EV/f$label.2.h" -o /dev/null
  local cb=$(grep -i '^location' "$EV/f$label.2.h" | tr -d '\r' | awk '{print $2}')
  curl -s --max-time 10 -b "$jar" -c "$jar" -D "$EV/f$label.3.h" -o /dev/null "$cb"
  local fin=$(grep -i '^location' "$EV/f$label.3.h" | tr -d '\r' | awk '{print $2}')
  curl -s --max-time 10 -b "$jar" "$BASE/api/auth/me" > "$EV/f$label.me"
  python3 - "$label" "$fin" <<'EOF'
import json, sys
label, fin = sys.argv[1], sys.argv[2]
u = (json.load(open(f"/tmp/round5/f{label}.me")).get("user") or {})
print(f"{label}: user={u.get('email','NONE')} final_redirect={fin}")
EOF
}

run_flow signup signup ""
run_flow login login ""
run_flow takeover login "r5victim@test.dev"
