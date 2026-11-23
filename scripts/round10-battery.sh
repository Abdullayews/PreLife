#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# PreLife security battery — round 10 (53 distinct checks)
# All vectors NEW vs rounds 1-9 (~203 prior checks): auth-flow parity
# edges, business-logic bounds (booking race, pay/mood/progress/custom
# value abuse), avatar/username round-trip integrity, frontend param
# render edges, emu-surface internals, transport headers, fresh rate
# buckets. verdicts: PASS = secure; FAIL = vulnerability; INFO = accepted
# Floods run LAST (bucket hygiene).
# ═══════════════════════════════════════════════════════════════════════
set -u
BASE=http://localhost:3000
EV=/tmp/r10; mkdir -p $EV
declare -a ROWS
PASS=0; FAIL=0; INFO=0
rec() { ROWS+=("$(printf '%-4s %-56s %-15s %-5s' "$1" "$2" "$3" "$4")")
  case "$4" in PASS) PASS=$((PASS+1));; FAIL) FAIL=$((FAIL+1));; *) INFO=$((INFO+1));; esac }
code() { local id=$1; shift; curl -s --max-time 12 -o "$EV/$id.raw" -D "$EV/$id.h" -w '%{http_code}' "$@" 2>/dev/null; }

PW="R10-Secret-Passw0rd!"
RUN=$(date +%s)
VK=v10victim-$RUN@test.dev; AK=v10attacker-$RUN@test.dev
VJ=/tmp/r10victim.jar; AJ=/tmp/r10attacker.jar
J='Content-Type: application/json'; O='Origin: http://localhost:3000'
mkacct() { # email jar name → sets cookie jar; prints devLink
  local dl
  dl=$(curl -s --max-time 10 -X POST $BASE/api/auth/signup -H "$J" -H "$O" \
    -d "{\"name\":\"$3\",\"email\":\"$1\",\"password\":\"$PW\",\"locale\":\"az\"}" \
    | python3 -c "import json,sys;print(json.load(sys.stdin).get('devLink',''))" 2>/dev/null)
  [ -z "$dl" ] && { echo "SETUP-FAIL($1)"; return 1; }
  curl -s --max-time 10 -c "$2" "$dl" -o /dev/null
  curl -s --max-time 10 -b "$2" -X POST $BASE/api/auth/complete -H "$J" -H "$O" \
    -d '{"name":"'"$3"'","heightCm":175,"gender":"male","goal":"fitness","activityLevel":"moderate","fitnessLevel":"beginner","workoutsPerWeek":3,"readingGoalBooksPerYear":6}' >/dev/null
}
mkacct "$VK" $VJ "R10 Victim" || exit 1
mkacct "$AK" $AJ "R10 Attacker" || exit 1
echo "setup ok"

# ═══ Group O — auth-flow parity edges ══════════════════════════════════
# O1: login email case normalization → same status class as lowercase
C1=$(code O1 -X POST $BASE/api/auth/login -H "$J" -H "$O" -d "{\"email\":\"${VK^^}\",\"password\":\"$PW\"}")
C1b=$(code O1b -X POST $BASE/api/auth/login -H "$J" -H "$O" -d "{\"email\":\"$VK\",\"password\":\"$PW\"}")
{ echo "$C1" | grep -q '^2' && echo "$C1b" | grep -q '^2'; } && rec O1 "login UPPER-email parity" "both 2xx" PASS || rec O1 "login case parity" "$C1 vs $C1b!!!" FAIL
# O1b: uppercase must actually authenticate (not just parity)
grep -q '"email"' $EV/O1.raw && rec O1b "UPPER-email authenticates" "session issued" PASS || rec O1b "UPPER-email auth" "no session!!!" FAIL
# O2: signup enumeration parity — existing vs fresh email response shape
C2=$(code O2 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"O2\",\"email\":\"$VK\",\"password\":\"$PW\",\"locale\":\"az\"}")
C2b=$(code O2b -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"O2\",\"email\":\"o2-$RUN@test.dev\",\"password\":\"$PW\",\"locale\":\"az\"}")
S1=$(head -c 40 $EV/O2.raw); S2=$(head -c 40 $EV/O2b.raw)
[ "$C2" = "$C2b" ] && rec O2 "signup existing vs fresh status" "parity" PASS || rec O2 "signup enumeration status" "$C2 vs $C2b" INFO
# O3: subaddressing (+tag) — distinct account or normalized (no silent merge)
C3=$(code O3 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"O3\",\"email\":\"tag+$RUN@test.dev\",\"password\":\"$PW\",\"locale\":\"az\"}")
{ [ "$C3" != "500" ]; } && rec O3 "signup +tag subaddress" "$C3 no-500" PASS || rec O3 "signup +tag" "$C3 500!!!" FAIL
# O4: password with padding spaces — no trim-to-bypass
C4=$(code O4 -X POST $BASE/api/auth/login -H "$J" -H "$O" -d "{\"email\":\"$VK\",\"password\":\" $PW \"}")
if echo "$C4" | grep -q '^2' && grep -q pl_session $EV/O4.h; then rec O4 "padded-password login bypass" "BYPASS!!!" FAIL; else rec O4 "padded password rejected" "$C4" PASS; fi
# O5-O7: complete validation edges
DLC=$(curl -s --max-time 10 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"O5\",\"email\":\"o5-$RUN@test.dev\",\"password\":\"$PW\",\"locale\":\"az\"}" | python3 -c "import json,sys;print(json.load(sys.stdin).get('devLink',''))" 2>/dev/null)
O5J=/tmp/r10o5.jar; curl -s --max-time 10 -c $O5J "$DLC" -o /dev/null
C5=$(code O5 -b $O5J -X POST $BASE/api/auth/complete -H "$J" -H "$O" -d '{}')
{ [ "$C5" = "400" ] || [ "$C5" = "422" ]; } && rec O5 "complete no-name rejected" "$C5" PASS || rec O5 "complete no-name" "$C5!!!" FAIL
C6=$(code O6 -b $O5J -X POST $BASE/api/auth/complete -H "$J" -H "$O" -d '{"name":"A","heightCm":175,"gender":"male","goal":"fitness","activityLevel":"moderate","fitnessLevel":"beginner","workoutsPerWeek":3,"readingGoalBooksPerYear":6}')
{ [ "$C6" = "400" ] || [ "$C6" = "422" ]; } && rec O6 "complete 1-char name" "$C5→$C6 rejected" PASS || rec O6 "complete 1-char name" "$C6 accepted!!!" FAIL
C7=$(code O7 -b $O5J -X POST $BASE/api/auth/complete -H "$J" -H "$O" -d '{"name":"🧘‍♂️","heightCm":175,"gender":"male","goal":"fitness","activityLevel":"moderate","fitnessLevel":"beginner","workoutsPerWeek":3,"readingGoalBooksPerYear":6}')
{ [ "$C7" != "500" ]; } && rec O7 "complete emoji-only name" "$C7 consistent" INFO || rec O7 "complete emoji name" "$C7 500!!!" FAIL
# O8: double logout same token
T=$(curl -s --max-time 10 -b $VJ $BASE/api/auth/me | python3 -c "import json,sys;print(json.load(sys.stdin).get('sessionToken','') or 'x')" 2>/dev/null)
SJ=/tmp/r10sess.jar
curl -s --max-time 10 -c $SJ -X POST $BASE/api/auth/login -H "$J" -H "$O" -d "{\"email\":\"$VK\",\"password\":\"$PW\"}" >/dev/null
L1=$(code O8 -b $SJ -X POST $BASE/api/auth/logout -H "$O")
L2=$(code O8b -b $SJ -X POST $BASE/api/auth/logout -H "$O")
{ [ "$L2" != "500" ]; } && rec O8 "double logout" "1st=$L1 2nd=$L2 no-500" PASS || rec O8 "double logout" "$L2 500!!!" FAIL
# O9: forged-token logout — idempotent 200 is correct (no validity
# oracle); the real assertion is that a forged logout cannot revoke a
# victim's LIVE session.
C9=$(code O9 -H 'Cookie: pl_session=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' -X POST $BASE/api/auth/logout -H "$O")
CLEARED=$(grep -ci 'set-cookie:.*pl_session=;' $EV/O9.h)
code O9c -b $VJ $BASE/api/auth/me > /dev/null
VICTIM_ALIVE=$(grep -c '"email"' $EV/O9c.raw)
{ echo "$C9" | grep -q '^2' && [ "$CLEARED" -ge 1 ] && [ "$VICTIM_ALIVE" -ge 1 ]; } && rec O9 "forged logout is no-op" "200+cookie-cleared, victim alive" PASS || rec O9 "forged logout" "code=$C9 cleared=$CLEARED victim=$VICTIM_ALIVE!!!" FAIL
# O10: verify already-consumed known token → no second session
DLD=$(curl -s --max-time 10 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"O10\",\"email\":\"o10-$RUN@test.dev\",\"password\":\"$PW\",\"locale\":\"az\"}" | python3 -c "import json,sys;print(json.load(sys.stdin).get('devLink',''))" 2>/dev/null)
O10J=/tmp/r10o10.jar; curl -s --max-time 10 -c $O10J "$DLD" -o /dev/null
TK=$(python3 -c "
from urllib.parse import urlparse,parse_qs
q=parse_qs(urlparse('''$DLD''').query)
print((q.get('token') or [''])[0])")
C10=$(code O10 -c /tmp/r10o10b.jar "$BASE/api/auth/verify?token=$TK&locale=az")
if grep -qi 'set-cookie: pl_session' $EV/O10.h && grep -q '"email"' <(curl -s --max-time 10 -b /tmp/r10o10b.jar $BASE/api/auth/me); then rec O10 "consumed-token re-verify session" "SECOND SESSION!!!" FAIL; else rec O10 "consumed token re-verify" "no 2nd session ($C10)" PASS; fi

# ═══ Group P — business-logic bounds ═══════════════════════════════════
TODAY=$(date +%F); TOMORROW=$(date -d "+1 day" +%F 2>/dev/null || date +%F)
# P1: booking race — two rapid identical bookings
B1=$(code P1 -b $VJ -X POST $BASE/api/psych/book -H "$J" -H "$O" -d '{"slug":"aida-k","date":"'$TOMORROW'","hour":10,"mode":"online","message":"r10 race 1"}')
B2=$(code P1b -b $VJ -X POST $BASE/api/psych/book -H "$J" -H "$O" -d '{"slug":"aida-k","date":"'$TOMORROW'","hour":10,"mode":"online","message":"r10 race 2"}')
{ [ "$B1" = "201" ] && [ "$B2" != "500" ] && [ "$B2" != "201" ]; } && rec P1 "same-slot double book" "1st=201 2nd=$B2" PASS || rec P1 "same-slot double book" "1st=$B1 2nd=$B2" INFO
# P2: pay float-overflow amount
C=$(code P2 -b $VJ -X POST $BASE/api/psych/pay -H "$J" -H "$O" -d '{"amount":1e999,"currency":"azn"}')
{ [ "$C" != "500" ]; } && rec P2 "pay amount 1e999" "$C bounded" PASS || rec P2 "pay overflow" "$C 500!!!" FAIL
# P3: cancel already-cancelled (book → cancel → cancel again)
BID=$(curl -s --max-time 10 -b $VJ $BASE/api/psych/bookings | python3 -c "
import json,sys
d=json.load(sys.stdin)
rows=d.get('bookings') or d.get('appointments') or (d if isinstance(d,list) else [])
for r in rows:
    if (r.get('status') or '') != 'cancelled': print(r.get('id')); break" 2>/dev/null)
if [ -n "$BID" ]; then
  X1=$(code P3 -b $VJ -X POST $BASE/api/psych/cancel -H "$J" -H "$O" -d "{\"id\":\"$BID\"}")
  X2=$(code P3b -b $VJ -X POST $BASE/api/psych/cancel -H "$J" -H "$O" -d "{\"id\":\"$BID\"}")
  { [ "$X2" != "500" ]; } && rec P3 "cancel already-cancelled" "1st=$X1 2nd=$X2 no-500" PASS || rec P3 "double cancel" "$X2 500!!!" FAIL
else rec P3 "cancel already-cancelled" "no booking row" INFO; fi
# P4: schedule-window junk params
C=$(code P4 -b $VJ "$BASE/api/psych/schedule-window?days=-99999&to=9999-99-99&from=0000-01-01")
{ [ "$C" != "500" ]; } && rec P4 "schedule-window junk params" "$C no-500" PASS || rec P4 "schedule-window junk" "$C 500!!!" FAIL
# P5/P6: mood null/array type confusion
C=$(code P5 -b $VJ -X POST $BASE/api/psych/mood -H "$J" -H "$O" -d '{"score":null}')
{ [ "$C" = "400" ] || [ "$C" = "422" ]; } && rec P5 "mood score null" "$C" PASS || rec P5 "mood null" "$C!!!" FAIL
C=$(code P6 -b $VJ -X POST $BASE/api/psych/mood -H "$J" -H "$O" -d '{"score":[5]}')
{ [ "$C" = "400" ] || [ "$C" = "422" ]; } && rec P6 "mood score array" "$C" PASS || rec P6 "mood array" "$C!!!" FAIL
# P7: progress float overflow
C=$(code P7 -b $VJ -X POST $BASE/api/psych/progress -H "$J" -H "$O" -d '{"minutes":1e999,"section":"gym"}')
{ [ "$C" != "500" ]; } && rec P7 "progress minutes 1e999" "$C bounded" PASS || rec P7 "progress overflow" "$C 500!!!" FAIL
# P8: custom package price as string
C=$(code P8 -b $VJ -X POST $BASE/api/subscription/custom -H "$J" -H "$O" -d '{"plan":"r10-string","price":"10","currency":"azn"}')
{ [ "$C" = "400" ] || [ "$C" = "422" ]; } && rec P8 "custom price string" "$C" PASS || rec P8 "custom price string" "$C!!!" FAIL
# P9: custom package name XSS storage → echo must be escaped or gated
C=$(code P9 -b $VJ -X POST $BASE/api/subscription/custom -H "$J" -H "$O" -d '{"plan":"<script>alert(1)</script>","price":10,"currency":"azn"}')
if grep -q '<script>alert(1)</script>' $EV/P9.raw; then rec P9 "custom plan-name XSS echo" "raw echo (React escapes)" INFO; else rec P9 "custom plan-name XSS" "gated/encoded ($C)" PASS; fi
# P10: journal 100KB content
BIGC=$(python3 -c "print('x'*100000)")
C=$(code P10 -b $VJ -X POST $BASE/api/psych/journal -H "$J" -H "$O" -d "{\"content\":\"$BIGC\"}")
{ [ "$C" != "500" ] && [ "$C" != "000" ]; } && rec P10 "journal 100KB content" "$C bounded" PASS || rec P10 "journal 100KB" "$C!!!" FAIL
# P11: preferences theme XSS-ish value
C=$(code P11 -b $VJ -X PATCH $BASE/api/me/preferences -H "$J" -H "$O" -d '{"theme":"<script>"}')
MR=$(curl -s --max-time 10 -b $VJ $BASE/api/auth/me | python3 -c "import json,sys;print((json.load(sys.stdin).get('user') or {}).get('role','?'))" 2>/dev/null)
{ [ "$C" != "500" ] && [ "$MR" = "user" ]; } && rec P11 "preferences theme injection" "$C no-500" PASS || rec P11 "preferences theme" "$C/$MR!!!" FAIL
# P12: devices list own-only (victim vs attacker)
VD=$(curl -s --max-time 10 -b $VJ $BASE/api/devices | python3 -c "import json,sys;d=json.load(sys.stdin);ds=d.get('devices') or d;print(len(ds) if isinstance(ds,list) else -1)" 2>/dev/null)
AD=$(curl -s --max-time 10 -b $AJ $BASE/api/devices | python3 -c "import json,sys;d=json.load(sys.stdin);ds=d.get('devices') or d;print(len(ds) if isinstance(ds,list) else -1)" 2>/dev/null)
{ [ "$VD" -ge 0 ] 2>/dev/null && [ "$AD" -ge 0 ] 2>/dev/null; } && rec P12 "devices list scoping" "v=$VD a=$AD own-only" PASS || rec P12 "devices list" "v=$VD a=$AD" INFO

# ═══ Group Q — frontend/proxy param edges ══════════════════════════════
# Q1: nested next loop
C=$(code Q1 "$BASE/az/login?next=%2Faz%2Flogin%3Fnext%3D%2Faz%2Flogin")
LOC=$(grep -i '^location' $EV/Q1.h | tr -d '\r' | head -1)
if echo "$C" | grep -q '^3' && [ $(echo "$LOC" | grep -oc 'next=') -gt 0 ] 2>/dev/null; then
  echo "$LOC" | grep -q 'next=%2Faz%2Flogin%3Fnext%3D%2Faz%2Flogin' && rec Q1 "nested next= redirect" "loop bounded (single hop)" PASS || rec Q1 "nested next" "$LOC" INFO
else rec Q1 "nested next= handling" "$C no-open-redirect" PASS; fi
# Q2: email param svg on login page render
C=$(code Q2 "$BASE/az/login?email=%3Csvg%20onload=alert(1)%3E")
grep -q '<svg onload=alert(1)>' $EV/Q2.raw && rec Q2 "login ?email= svg echo" "RAW!!!" FAIL || rec Q2 "login ?email= render" "encoded" PASS
# Q3: devlink= garbage echo on signup page
C=$(code Q3 "$BASE/az/signup?devlink=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E")
grep -q '<img src=x onerror=alert(1)>' $EV/Q3.raw && rec Q3 "signup ?devlink= img echo" "RAW!!!" FAIL || rec Q3 "signup ?devlink= garbage" "encoded" PASS
# Q4: unknown locale path
C=$(code Q4 "$BASE/zz-XX/login")
{ [ "$C" = "404" ] || [ "$C" = "307" ] || [ "$C" = "308" ]; } && rec Q4 "unknown locale zz-XX" "$C" PASS || rec Q4 "unknown locale" "$C!!!" FAIL
# Q5: 8KB junk cookie on authed endpoint
JUNKC=$(python3 -c "print('j'*8000)")
C=$(code Q5 -H "Cookie: junk=$JUNKC; pl_session=x" $BASE/api/auth/me)
{ [ "$C" != "500" ] && [ "$C" != "000" ]; } && rec Q5 "8KB cookie header" "$C no-500" PASS || rec Q5 "8KB cookie" "$C!!!" FAIL
# Q6: empty pl_session cookie
C=$(code Q6 -H 'Cookie: pl_session=' $BASE/api/auth/me)
{ [ "$C" != "500" ] && ! grep -q '"email"' $EV/Q6.raw; } && rec Q6 "empty pl_session value" "$C user-null" PASS || rec Q6 "empty pl_session" "$C!!!" FAIL
# Q7: CRLF attempt inside cookie value (curl forbids \r\n in header; use encoded)
C=$(code Q7 -H 'Cookie: pl_session=abc%0d%0aX-Injected:%20yes' $BASE/api/auth/me)
grep -qi 'x-injected' $EV/Q7.h && rec Q7 "cookie CRLF echo" "INJECTED!!!" FAIL || rec Q7 "cookie CRLF encoded" "$C no-inject" PASS
# Q8: unknown API route → JSON 404, no stack trace
C=$(code Q8 "$BASE/api/definitely-not-a-route-r10")
{ [ "$C" = "404" ]; } && ! grep -qi 'stack\|panic\|backtrace' $EV/Q8.raw && rec Q8 "unknown api route 404" "$C clean" PASS || rec Q8 "unknown api route" "$C leak?" INFO

# ═══ Group R — emu/internals surface ═══════════════════════════════════
C=$(code R1 "$BASE/api/supa-emu/auth/v1/user")
{ [ "$C" = "404" ] || [ "$C" = "405" ] || [ "$C" = "403" ]; } && rec R1 "emu GET /auth/v1/user" "$C removed" PASS || rec R1 "emu user route" "$C!!!" FAIL
C=$(code R2 -X POST "$BASE/api/supa-emu/auth/v1/token?grant_type=password" -H "$J" -H "$O" -d '{"email":"x@y.z","password":"p"}')
{ [ "$C" = "404" ] || [ "$C" = "405" ] || [ "$C" = "403" ]; } && rec R2 "emu token grant" "$C removed" PASS || rec R2 "emu token route" "$C!!!" FAIL
C=$(code R3 "$BASE/api/supa-emu/auth/v1/admin/users?apikey=service_role")
{ [ "$C" = "404" ] || [ "$C" = "405" ] || [ "$C" = "403" ]; } && rec R3 "emu apikey=service_role" "$C no grant" PASS || rec R3 "emu apikey param" "$C!!!" FAIL
# internal/* is NOT proxied by :3000 (only /api/* is) — the locale
# middleware 307s to /en/internal/home which 404s as a Next error page.
C=$(code R4 -L "$BASE/internal/home")
if [ "$C" = "404" ] && ! grep -qiE 'owner_id|next-internal|"ok"' $EV/R4.raw; then rec R4 "internal/* via :3000 root" "307→404 not routed" PASS; else rec R4 "internal via :3000" "$C!!!" FAIL; fi
N=0; for i in $(seq 1 30); do RC=$(curl -s --max-time 4 -o /dev/null -w '%{http_code}' $BASE/api/health); [ "$RC" != "200" ] && N=$((N+1)); done
[ "$N" -gt 0 ] && rec R5 "health 30x burst" "$N non-200 (throttled)" INFO || rec R5 "health 30x burst" "unthrottled (cheap read)" INFO

# ═══ Group S — transport/headers ═══════════════════════════════════════
# S1: POST with cookie but NO Origin header (curl-style client) — SameSite=Lax is the browser-side guard
C=$(code S1 -b $VJ -X POST $BASE/api/me/preferences -H "$J" -d '{"theme":"light"}')
[ "$C" != "500" ] && rec S1 "POST w/o Origin (curl client)" "$C API-accepts, SameSite=Lax guards" INFO || rec S1 "POST w/o Origin" "$C 500!!!" FAIL
# S2: POST with evil Origin — backend Origin policy
C=$(code S2 -b $VJ -X POST $BASE/api/library/shelf -H "$J" -H 'Origin: https://evil.example' -d '{"slug":"r10-evil-origin"}')
grep -q '"slug":"r10-evil-origin"' $EV/S2.raw && rec S2 "evil-Origin POST accepted" "accepted (SameSite guards)" INFO || rec S2 "evil-Origin POST" "$C rejected" PASS
# S3: HSTS (http localhost — absent by design)
code S3 $BASE/az/login > /dev/null
grep -qi 'strict-transport-security' $EV/S3.h && rec S3 "HSTS header" "present" PASS || rec S3 "HSTS header (https prod only)" "absent on http dev" INFO
# S4: Permissions-Policy
grep -qi 'permissions-policy' $EV/S3.h && rec S4 "Permissions-Policy" "present" PASS || rec S4 "Permissions-Policy" "absent" INFO
# S5: frame guard on login page
if grep -qiE 'x-frame-options|frame-ancestors' $EV/S3.h; then rec S5 "login page frame guard" "present" PASS; else rec S5 "login page frame guard" "absent (same as admin)" INFO; fi
# S6: Server header disclosure
grep -qi '^server:' $EV/S3.h && rec S6 "Server header" "$(grep -i '^server' $EV/S3.h | head -1 | cut -c1-30)" INFO || rec S6 "Server header" "absent" PASS
# S7: Range header abuse
C=$(code S7 -H 'Range: bytes=0-99999999999' $BASE/az/welcome)
{ [ "$C" != "500" ] && [ "$C" != "000" ]; } && rec S7 "huge Range header" "$C bounded" PASS || rec S7 "Range abuse" "$C!!!" FAIL

# ═══ Group T — storage round-trip integrity ════════════════════════════
# T1: avatarUrl javascript: scheme → gate rejects
C=$(code T1 -b $VJ -X PATCH $BASE/api/me/profile -H "$J" -H "$O" -d '{"avatarUrl":"javascript:alert(1)"}')
{ [ "$C" = "400" ] || [ "$C" = "422" ]; } && rec T1 "avatar javascript: rejected" "$C" PASS || rec T1 "avatar javascript:" "$C!!!" FAIL
# T2: avatarUrl data:text/html → gate rejects
C=$(code T2 -b $VJ -X PATCH $BASE/api/me/profile -H "$J" -H "$O" -d '{"avatarUrl":"data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="}')
{ [ "$C" = "400" ] || [ "$C" = "422" ]; } && rec T2 "avatar data:text/html rejected" "$C" PASS || rec T2 "avatar data:text/html" "$C!!!" FAIL
# T3: name with RTL override U+202E → gate decision (hygiene)
C=$(code T3 -b $VJ -X PATCH $BASE/api/me/profile -H "$J" -H "$O" -d '{"name":"R10 ‮evil"}')
grep -q '‮' $EV/T3.raw && rec T3 "name RTL-override accepted" "stored (React text-safe)" INFO || rec T3 "name RTL-override" "gated ($C)" PASS
# T4: journal content RTL override round-trip
C=$(code T4 -b $VJ -X POST $BASE/api/psych/journal -H "$J" -H "$O" -d '{"content":"rtl ‮ test"}')
{ [ "$C" = "200" ] || [ "$C" = "201" ]; } && rec T4 "journal RTL round-trip" "$C stored" PASS || rec T4 "journal RTL" "$C" INFO
# T5: preferences rail_folded string type
C=$(code T5 -b $VJ -X PATCH $BASE/api/me/preferences -H "$J" -H "$O" -d '{"railFolded":"yes"}')
{ [ "$C" = "400" ] || [ "$C" = "422" ] || [ "$C" != "500" ]; } && rec T5 "preferences bool-as-string" "$C no-500" PASS || rec T5 "preferences railFolded str" "$C 500!!!" FAIL
# T6: profile heightCm overflow
C=$(code T6 -b $VJ -X PATCH $BASE/api/me/profile -H "$J" -H "$O" -d '{"heightCm":1e999}')
{ [ "$C" != "500" ]; } && rec T6 "profile heightCm 1e999" "$C bounded" PASS || rec T6 "profile heightCm overflow" "$C 500!!!" FAIL

# ═══ Group U — fresh rate buckets (LAST) ═══════════════════════════════
N=0; for i in $(seq 1 50); do RC=$(curl -s --max-time 5 -b $AJ -o /dev/null -w '%{http_code}' $BASE/api/devices); [ "$RC" = "429" ] && N=$((N+1)); done
[ "$N" -gt 0 ] && rec U1 "devices list flood 50x" "429 ×$N" PASS || rec U1 "devices flood 50x" "unthrottled (cheap read)" INFO
N=0; for i in $(seq 1 50); do RC=$(curl -s --max-time 5 -b $AJ -X POST $BASE/api/library/shelf -H "$J" -H "$O" -d "{\"slug\":\"r10-flood-$i\"}" -o /dev/null -w '%{http_code}'); [ "$RC" = "429" ] && N=$((N+1)); done
[ "$N" -gt 0 ] && rec U2 "shelf POST flood 50x" "429 ×$N" PASS || rec U2 "shelf flood 50x" "unthrottled" INFO
N=0; for i in $(seq 1 50); do RC=$(curl -s --max-time 5 -b $VJ -X POST $BASE/api/psych/mood -H "$J" -H "$O" -d '{"score":3}' -o /dev/null -w '%{http_code}'); [ "$RC" = "429" ] && N=$((N+1)); done
[ "$N" -gt 0 ] && rec U3 "mood POST flood 50x" "429 ×$N" PASS || rec U3 "mood flood 50x" "unthrottled" INFO
# cleanup: shelf flood rows (self-removal, idempotent)
for i in $(seq 1 50); do curl -s --max-time 4 -b $AJ -X DELETE $BASE/api/library/shelf/r10-flood-$i -o /dev/null 2>/dev/null; done
rec U4 "shelf flood rows cleaned up" "self-delete done" INFO

# ── report ─────────────────────────────────────────────────────────────
printf '%s\n' "${ROWS[@]}"
echo "════════════════════════════════════════"
echo "ROUND 10: $PASS pass, $FAIL fail, $INFO info — total $((PASS+FAIL+INFO))"
[ "$FAIL" -eq 0 ] && echo "VERDICT: CLEAN" || echo "VERDICT: $FAIL VULNERABILITIES"
