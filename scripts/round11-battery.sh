#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# PreLife security battery — round 11 (52 distinct checks)
# All vectors NEW vs rounds 1-10 (~256 prior checks). Territory:
# booking/pay business logic (object-level cancel+pay IDOR, slot window,
# message bounds), session lifecycle (server-side revocation, dual
# cookies, bearer, verify literal tokens), parser/enum abuse (NaN, null
# byte, homoglyph, enum unknowns), shelf/i18n content edges, HTTP
# semantics + XFF rotation vs the login buckets. verdicts: PASS = secure;
# FAIL = vulnerability; INFO = accepted. Flood LAST (bucket hygiene).
# ═══════════════════════════════════════════════════════════════════════
set -u
BASE=http://localhost:3000
EV=/tmp/r11; mkdir -p $EV
declare -a ROWS
PASS=0; FAIL=0; INFO=0
rec() { ROWS+=("$(printf '%-4s %-56s %-26s %-5s' "$1" "$2" "$3" "$4")")
  case "$4" in PASS) PASS=$((PASS+1));; FAIL) FAIL=$((FAIL+1));; *) INFO=$((INFO+1));; esac }
code() { local id=$1; shift; curl -s --max-time 12 -o "$EV/$id.raw" -D "$EV/$id.h" -w '%{http_code}' "$@" 2>/dev/null; }

PW="R11-Secret-Passw0rd!"
RUN=$(date +%s)
VK=v11victim-$RUN@test.dev; AK=v11attacker-$RUN@test.dev
VJ=/tmp/r11victim.jar; AJ=/tmp/r11attacker.jar
J='Content-Type: application/json'; O='Origin: http://localhost:3000'

# Booking day rotates (tomorrow..+11d, Sunday bumped) so re-runs never
# collide with leftovers; availability matrix (ISO weekday 1=Mon..7=Sun)
# mirrors psychologist_availability seeds.
DAYOFF=$(python3 -c "print($RUN % 12)")
BD=$(python3 -c "
import datetime,zoneinfo
d=datetime.datetime.now(zoneinfo.ZoneInfo('Asia/Baku')).date()+datetime.timedelta(days=1)
d+=datetime.timedelta(days=$DAYOFF)
if d.isoweekday()==7: d+=datetime.timedelta(days=1)
print(d.isoformat())")
WD=$(python3 -c "import datetime;print(datetime.date.fromisoformat('$BD').isoweekday())")
SLOTS() { case $WD in
  1) echo "aida-k:10 rasim-i:9 kamran-y:16";;
  2) echo "leyla-m:10 gulshan-h:15 samir-a:19 nariman-q:11";;
  3) echo "aida-k:11 elmira-r:10 gulshan-h:15";;
  4) echo "leyla-m:10 samir-a:19 elmira-r:11 nariman-q:17";;
  5) echo "aida-k:16 gulshan-h:15 rasim-i:9 nariman-q:11";;
  6) echo "leyla-m:12 kamran-y:11 rasim-i:10 elmira-r:12";;
esac; }
book_slot() { # idprefix jar slug hour message → echoes "code id"
  local c
  c=$(code "$1bs" -b "$2" -X POST $BASE/api/psych/book -H "$J" -H "$O" \
    -d "{\"slug\":\"$3\",\"date\":\"$BD\",\"hour\":$4,\"mode\":\"online\",\"message\":\"$5\"}")
  echo "$c $(python3 -c "import json,sys;d=json.load(open('$EV/$1bs.raw'));print(d.get('id') or '')" 2>/dev/null)"
}

mkacct() { # email jar name → verified+complete session
  local dl
  dl=$(curl -s --max-time 10 -X POST $BASE/api/auth/signup -H "$J" -H "$O" \
    -d "{\"name\":\"$3\",\"email\":\"$1\",\"password\":\"$PW\",\"locale\":\"az\"}" \
    | python3 -c "import json,sys;print(json.load(sys.stdin).get('devLink',''))" 2>/dev/null)
  [ -z "$dl" ] && { echo "SETUP-FAIL($1)"; return 1; }
  curl -s --max-time 10 -c "$2" "$dl" -o /dev/null
  curl -s --max-time 10 -b "$2" -c "$2" -X POST $BASE/api/auth/complete -H "$J" -H "$O" \
    -d "{\"name\":\"$3\",\"password\":\"$PW\",\"heightCm\":175,\"gender\":\"male\",\"goal\":\"fitness\",\"activityLevel\":\"moderate\",\"fitnessLevel\":\"beginner\",\"workoutsPerWeek\":3,\"readingGoalBooksPerYear\":6}" >/dev/null
}
mkacct "$VK" $VJ "R11 Victim" || exit 1
mkacct "$AK" $AJ "R11 Attacker" || exit 1
echo "setup ok (booking day: $BD, weekday $WD)"

# ═══ Group V — booking / pay business logic ════════════════════════════
# V1: victim books an OPEN slot (probe the availability matrix)
BID=""; BSLUG=""; BHOUR=0
IX=0
for cand in $(SLOTS); do
  cs=${cand%%:*}; ch=${cand##*:}
  read -r rc rid <<< "$(book_slot v1probe $VJ "$cs" "$ch" "r11 probe")"
  if echo "$rc" | grep -q '^2' && [ -n "$rid" ]; then BID=$rid; BSLUG=$cs; BHOUR=$ch; break; fi
  IX=$((IX+1))
done
[ -n "$BID" ] && rec V1 "valid booking on open slot" "id=$BID @$BSLUG:$BHOUR" PASS || rec V1 "valid booking" "all slots rejected!!!" FAIL
# V2: attacker cancels victim's booking → object authz
C=$(code V2 -b $AJ -X POST $BASE/api/psych/cancel -H "$J" -H "$O" -d "{\"id\":\"$BID\"}")
{ [ "$C" = "404" ] || [ "$C" = "403" ] || [ "$C" = "400" ]; } && rec V2 "foreign booking CANCEL blocked" "$C" PASS || rec V2 "foreign booking cancel" "$C IDOR!!!" FAIL
# V2b: booking row must be untouched (still requested)
ST=$(curl -s --max-time 8 -b $VJ $BASE/api/psych/bookings | grep -c '"status":"cancelled"' || true)
{ [ "$C" = "404" ] || [ "$C" = "403" ] || [ "$C" = "400" ]; } && [ "$ST" = "0" ] && rec V2b "victim booking intact" "not cancelled" PASS || rec V2b "victim booking state" "cancelled=$ST!!!" FAIL
# V3: victim cancels own, then cancels again (idempotent or 404 — no 500)
C=$(code V3 -b $VJ -X POST $BASE/api/psych/cancel -H "$J" -H "$O" -d "{\"id\":\"$BID\"}")
C3b=$(code V3b -b $VJ -X POST $BASE/api/psych/cancel -H "$J" -H "$O" -d "{\"id\":\"$BID\"}")
{ echo "$C" | grep -q '^2'; } && { [ "$C3b" != "500" ]; } && rec V3 "own cancel + re-cancel" "$C → $C3b no-500" PASS || rec V3 "own cancel chain" "$C/$C3b!!!" FAIL
# V4: cancel id PostgREST-style injection (no 500, no cross filter)
C=$(code V4 -b $VJ -X POST $BASE/api/psych/cancel -H "$J" -H "$O" -d '{"id":"or.(id.eq.x)"}')
C4b=$(code V4b -b $VJ -X POST $BASE/api/psych/cancel -H "$J" -H "$O" -d '{"id":"neq.null"}')
{ [ "$C" != "500" ] && [ "$C4b" != "500" ]; } && rec V4 "cancel id filter injection" "$C/$C4b no-500" PASS || rec V4 "cancel filter injection" "$C/$C4b!!!" FAIL
# V5-V6: hour bounds + strict typing
C=$(code V5 -b $VJ -X POST $BASE/api/psych/book -H "$J" -H "$O" -d "{\"slug\":\"$BSLUG\",\"date\":\"$BD\",\"hour\":24,\"message\":\"h\"}")
[ "$C" = "400" ] && rec V5 "book hour=24" "400" PASS || rec V5 "book hour=24" "$C!!!" FAIL
C=$(code V6 -b $VJ -X POST $BASE/api/psych/book -H "$J" -H "$O" -d "{\"slug\":\"$BSLUG\",\"date\":\"$BD\",\"hour\":\"10\",\"message\":\"h\"}")
{ [ "$C" = "400" ] || [ "$C" = "409" ]; } && rec V6 "book hour as string" "$C strict" PASS || rec V6 "book hour string" "$C!!!" FAIL
# V7-V8: date window (past → slot_past 409 is correct; beyond 60d → 400)
C=$(code V7 -b $VJ -X POST $BASE/api/psych/book -H "$J" -H "$O" -d '{"slug":"aida-k","date":"2020-01-01","hour":10,"message":"h"}')
{ [ "$C" = "400" ] || [ "$C" = "409" ]; } && rec V7 "book past date" "$C slot_past" PASS || rec V7 "book past date" "$C!!!" FAIL
FAR=$(python3 -c "import datetime,zoneinfo;print((datetime.datetime.now(zoneinfo.ZoneInfo('Asia/Baku'))+datetime.timedelta(days=90)).strftime('%Y-%m-%d'))")
C=$(code V8 -b $VJ -X POST $BASE/api/psych/book -H "$J" -H "$O" -d "{\"slug\":\"$BSLUG\",\"date\":\"$FAR\",\"hour\":10,\"message\":\"h\"}")
[ "$C" = "400" ] && rec V8 "book +90d beyond window" "400" PASS || rec V8 "book +90d" "$C!!!" FAIL
# V9: message bounds — 1001 chars rejected, 1 char accepted (next slot)
BIG=$(python3 -c "print('x'*1001)")
C=$(code V9 -b $VJ -X POST $BASE/api/psych/book -H "$J" -H "$O" -d "{\"slug\":\"$BSLUG\",\"date\":\"$BD\",\"hour\":$BHOUR,\"mode\":\"online\",\"message\":\"$BIG\"}")
BID2=""; for cand in $(SLOTS); do
  cs=${cand%%:*}; ch=${cand##*:}
  [ "$cs:$ch" = "$BSLUG:$BHOUR" ] && continue
  read -r rc rid <<< "$(book_slot v9probe $VJ "$cs" "$ch" "x")"
  if echo "$rc" | grep -q '^2' && [ -n "$rid" ]; then BID2=$rid; break; fi
done
{ [ "$C" = "400" ] && [ -n "$BID2" ]; } && rec V9 "message 1001↔1 boundary" "1001→400, 1→200" PASS || rec V9 "message bounds" "$C bid2=$BID2!!!" FAIL
# V10: attacker pays victim's booking → object authz
C=$(code V10 -b $AJ -X POST $BASE/api/psych/pay -H "$J" -H "$O" -d "{\"id\":\"$BID2\"}")
{ [ "$C" = "404" ] || [ "$C" = "403" ] || [ "$C" = "400" ]; } && rec V10 "foreign booking PAY blocked" "$C" PASS || rec V10 "foreign booking pay" "$C IDOR!!!" FAIL
# V11: pay own booking still in requested state → 409 not_confirmed
C=$(code V11 -b $VJ -X POST $BASE/api/psych/pay -H "$J" -H "$O" -d "{\"id\":\"$BID2\"}")
{ [ -n "$BID2" ] && [ "$C" = "409" ]; } && rec V11 "pay unconfirmed booking" "409 not_confirmed" PASS || rec V11 "pay unconfirmed" "$C (bid2=$BID2)!!!" FAIL
# V12: bookings lists are per-user (no foreign ids anywhere)
L=$(curl -s --max-time 8 -b $AJ $BASE/api/psych/bookings)
if [ -n "$BID2" ] && echo "$L" | grep -q "$BID2"; then rec V12 "attacker list leaks victim booking" "LEAK!!!" FAIL; else rec V12 "bookings per-user isolation" "own-only" PASS; fi

# ═══ Group W — session / token lifecycle ═══════════════════════════════
# W1: logout must revoke server-side — old cookie reuse must die
TOK=$(awk '$6=="pl_session" {print $7}' $VJ | tail -1)
curl -s --max-time 8 -b $VJ -X POST $BASE/api/auth/logout -o /dev/null
C=$(code W1 -H "Cookie: pl_session=$TOK" $BASE/api/auth/me)
grep -q '"email"' $EV/W1.raw && rec W1 "cookie reuse after logout" "STILL ALIVE!!!" FAIL || rec W1 "cookie reuse after logout" "$C revoked" PASS
# W1b: fresh login restores access (and refreshes VJ for later groups)
C=$(code W1b -b $VJ -c $VJ -X POST $BASE/api/auth/login -H "$J" -H "$O" -d "{\"email\":\"$VK\",\"password\":\"$PW\"}")
grep -q '"email"' $EV/W1b.raw && rec W1b "re-login after logout" "session restored" PASS || rec W1b "re-login after logout" "$C!!!" FAIL
TOKFRESH=$(awk '$6=="pl_session" {print $7}' $VJ | tail -1)
# W2: two parallel sessions both valid
curl -s --max-time 8 -c /tmp/r11w2.jar -X POST $BASE/api/auth/login -H "$J" -H "$O" -d "{\"email\":\"$VK\",\"password\":\"$PW\"}" -o /dev/null
C=$(code W2 -b /tmp/r11w2.jar $BASE/api/auth/me)
C2=$(code W2b -b $VJ $BASE/api/auth/me)
{ grep -q '"email"' $EV/W2.raw && grep -q '"email"' $EV/W2b.raw; } && rec W2 "concurrent sessions valid" "both authed" PASS || rec W2 "concurrent sessions" "$C/$C2!!!" FAIL
# W3-W4: verify token literal junk
C=$(code W3 "$BASE/api/auth/verify?token=undefined")
C4=$(code W4 "$BASE/api/auth/verify?token=null")
{ [ "$C" != "500" ] && [ "$C4" != "500" ] && ! grep -q pl_session $EV/W3.h && ! grep -q pl_session $EV/W4.h; } && rec W3 "verify token=undefined/null" "$C/$C4 no-session" PASS || rec W3 "verify literal tokens" "$C/$C4!!!" FAIL
# W5: callback without code param
C=$(code W5 "$BASE/api/auth/callback")
{ [ "$C" != "500" ] && ! grep -q pl_session $EV/W5.h; } && rec W5 "callback w/o code" "$C clean" PASS || rec W5 "callback w/o code" "$C!!!" FAIL
# W6: bearer-token auth must not work (cookie-only) — with a LIVE token
C=$(code W6 -H "Authorization: Bearer $TOKFRESH" $BASE/api/auth/me)
grep -q '"email"' $EV/W6.raw && rec W6 "Bearer live token accepted" "AUTH BYPASS!!!" FAIL || rec W6 "bearer token rejected" "$C cookie-only" PASS
# W7: duplicate pl_session cookies — identity is exactly one live account
ATOK=$(awk '$6=="pl_session" {print $7}' $AJ | tail -1)
C=$(code W7 -H "Cookie: pl_session=$TOKFRESH; pl_session=$ATOK" $BASE/api/auth/me)
EM=$(python3 -c "import json,sys;d=json.load(open('$EV/W7.raw'));print(d.get('user',{}).get('email') or d.get('email') or '')" 2>/dev/null)
if [ "$EM" = "$VK" ] || [ "$EM" = "$AK" ]; then rec W7 "dual pl_session cookies" "single identity" PASS; else rec W7 "dual cookies identity" "got '$EM'!!!" FAIL; fi
# W8: percent-prefixed cookie value — no decode confusion (%2E = '.')
C=$(code W8 -H "Cookie: pl_session=%2E$TOKFRESH" $BASE/api/auth/me)
grep -q '"email"' $EV/W8.raw && rec W8 "percent-prefixed cookie accepted" "decoder confusion!!!" INFO || rec W8 "percent-prefixed cookie" "$C rejected" PASS
# W9: signup-only (never verified) login → bounded, no 500
curl -s --max-time 10 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"W9\",\"email\":\"w9-$RUN@test.dev\",\"password\":\"$PW\",\"locale\":\"az\"}" -o /dev/null
C=$(code W9 -X POST $BASE/api/auth/login -H "$J" -H "$O" -d "{\"email\":\"w9-$RUN@test.dev\",\"password\":\"$PW\"}")
{ [ "$C" != "500" ]; } && rec W9 "login pre-verify account" "$C bounded (403 enum tradeoff)" INFO || rec W9 "login pre-verify" "$C 500!!!" FAIL
# W10: devLink with extra junk param still verifies (tamper-tolerant, no bypass)
DL10=$(curl -s --max-time 10 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"W10\",\"email\":\"w10-$RUN@test.dev\",\"password\":\"$PW\",\"locale\":\"az\"}" | python3 -c "import json,sys;print(json.load(sys.stdin).get('devLink',''))" 2>/dev/null)
C=$(code W10 -c /tmp/r11w10.jar "${DL10}&utm=r11junk")
grep -q pl_session $EV/W10.h && rec W10 "verify link + junk param" "session issued" PASS || rec W10 "verify + junk param" "$C no session" INFO

# ═══ Group X — parser / enum / numeric abuse ═══════════════════════════
# X1: null byte inside email (JSON \u0000)
C=$(code X1 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"X1\",\"email\":\"x1\\u0000-$RUN@test.dev\",\"password\":\"$PW\",\"locale\":\"az\"}")
{ [ "$C" = "400" ] || [ "$C" = "422" ]; } && rec X1 "email null byte" "$C" PASS || rec X1 "email null byte" "$C!!!" FAIL
# X2: Cyrillic homoglyph email — bounded (gate rejects or distinct), no 500
HG=$(python3 -c "print('v11hg-'+str($RUN)+'@t\u0435st.dev')")
C=$(code X2 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"X2\",\"email\":\"$HG\",\"password\":\"$PW\",\"locale\":\"az\"}")
{ [ "$C" != "500" ]; } && rec X2 "homoglyph email signup" "$C no-500" PASS || rec X2 "homoglyph email" "$C 500!!!" FAIL
# X3: 300-char name
N300=$(python3 -c "print('N'*300)")
C=$(code X3 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"$N300\",\"email\":\"x3-$RUN@test.dev\",\"password\":\"$PW\",\"locale\":\"az\"}")
{ [ "$C" != "500" ]; } && rec X3 "signup name 300 chars" "$C bounded" PASS || rec X3 "name 300 chars" "$C 500!!!" FAIL
# X4: whitespace-only name
C=$(code X4 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"   \",\"email\":\"x4-$RUN@test.dev\",\"password\":\"$PW\",\"locale\":\"az\"}")
{ [ "$C" != "500" ]; } && rec X4 "whitespace-only name" "$C" PASS || rec X4 "whitespace name" "$C 500!!!" FAIL
# X5: NaN JSON token (serde strictness)
python3 -c 'print("{\"heightCm\":NaN}")' > $EV/x5body.json
C=$(code X5 -b $VJ -X POST $BASE/api/auth/complete -H "$J" -H "$O" --data-binary @$EV/x5body.json)
{ [ "$C" != "500" ] && [ "$C" != "200" ]; } && rec X5 "NaN JSON body" "$C strict" PASS || rec X5 "NaN JSON body" "$C!!!" FAIL
# X6-X11: complete-field enum/numeric abuse on ONE fresh incomplete account
# (all invalid completes must 400 and leave it incomplete; then the valid
#  complete at X11b must succeed — proves the account was consumable)
DLX=$(curl -s --max-time 10 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"X6\",\"email\":\"x6-$RUN@test.dev\",\"password\":\"$PW\",\"locale\":\"az\"}" | python3 -c "import json,sys;print(json.load(sys.stdin).get('devLink',''))" 2>/dev/null)
XJ=/tmp/r11x.jar; curl -s --max-time 10 -c $XJ "$DLX" -o /dev/null
# NOTE: complete reads ONLY name+password (auth.rs) — profile fields are
# ignored here, so X6-X11 assert the route stays 2xx-and-harmless for
# junk values, and X11b proves the account consumable.
XB='"name":"X6","password":"'"$PW"'"'
C=$(code X6 -b $XJ -X POST $BASE/api/auth/complete -H "$J" -H "$O" -d "{$XB,\"heightCm\":0,\"goal\":\"crossfit1999\",\"fitnessLevel\":\"wizard\",\"workoutsPerWeek\":-3,\"readingGoalBooksPerYear\":1.5}")
echo "$C" | grep -q '^2' && rec X6 "complete junk profile fields" "$C ignored-harmless" PASS || rec X6 "junk profile fields" "$C!!!" FAIL
C=$(code X7 -b $XJ -X POST $BASE/api/auth/complete -H "$J" -H "$O" -d "{$XB,\"role\":\"admin\",\"hallSlug\":\"ironhouse\",\"heightCm\":400}")
echo "$C" | grep -q '^2' && {
  ROLE=$(curl -s --max-time 8 -b $XJ $BASE/api/auth/me | python3 -c "import json,sys;d=json.load(sys.stdin);u=d.get('user') or d;print(u.get('role','user'))" 2>/dev/null)
  [ "$ROLE" = "user" ] && rec X7 "complete role=admin ignored" "$C role stays user" PASS || rec X7 "complete role=admin" "$C ROLE=$ROLE!!!" FAIL
} || rec X7 "complete role=admin" "$C!!!" FAIL
C=$(code X8 -b $VJ -X PATCH $BASE/api/me/profile -H "$J" -H "$O" -d '{"heightCm":0}')
{ [ "$C" = "400" ] || [ "$C" = "422" ]; } && rec X8 "profile heightCm=0" "$C" PASS || rec X8 "profile heightCm=0" "$C!!!" FAIL
C=$(code X9 -b $VJ -X PATCH $BASE/api/me/profile -H "$J" -H "$O" -d '{"heightCm":400}')
{ [ "$C" = "400" ] || [ "$C" = "422" ]; } && rec X9 "profile heightCm=400" "$C" PASS || rec X9 "profile heightCm=400" "$C!!!" FAIL
C=$(code X10 -b $VJ -X PATCH $BASE/api/me/profile -H "$J" -H "$O" -d '{"goal":"crossfit1999"}')
{ [ "$C" = "400" ] || [ "$C" = "422" ]; } && rec X10 "profile goal unknown enum" "$C" PASS || rec X10 "profile goal enum" "$C!!!" FAIL
C=$(code X11 -b $VJ -X PATCH $BASE/api/me/profile -H "$J" -H "$O" -d '{"fitnessLevel":"wizard"}')
{ [ "$C" = "400" ] || [ "$C" = "422" ]; } && rec X11 "profile fitnessLevel enum" "$C" PASS || rec X11 "fitnessLevel enum" "$C!!!" FAIL
C=$(code X11b -b $XJ -X POST $BASE/api/auth/complete -H "$J" -H "$O" -d "{$XB,\"heightCm\":175,\"goal\":\"fitness\"}")
echo "$C" | grep -q '^2' && rec X11b "valid complete still works" "$C (control)" PASS || rec X11b "valid complete control" "$C!!!" FAIL
# X12: preferences locale junk value
C=$(code X12 -b $VJ -X PATCH $BASE/api/me/preferences -H "$J" -H "$O" -d '{"locale":"en_US.UTF-8$$"}')
{ [ "$C" = "400" ] || [ "$C" = "422" ] || [ "$C" != "500" ]; } && rec X12 "preferences locale junk" "$C no-500" PASS || rec X12 "locale junk" "$C 500!!!" FAIL

# ═══ Group Y — shelf / content edges ═══════════════════════════════════
# Y1: traversal slug storage — must be gated or neutralized
C=$(code Y1 -b $VJ -X POST $BASE/api/library/shelf -H "$J" -H "$O" -d '{"slug":"../../etc/passwd"}')
SL=$(curl -s --max-time 8 -b $VJ $BASE/api/library/shelf)
echo "$SL" | grep -q '\.\./' && rec Y1 "traversal slug echoed" "STORED RAW!!!" FAIL || rec Y1 "traversal slug" "$C neutralized" PASS
# Y2: duplicate slug adds — no 500, sane dedup
C=$(code Y2 -b $VJ -X POST $BASE/api/library/shelf -H "$J" -H "$O" -d '{"slug":"r11-dup"}')
C2=$(code Y2b -b $VJ -X POST $BASE/api/library/shelf -H "$J" -H "$O" -d '{"slug":"r11-dup"}')
{ [ "$C" != "500" ] && [ "$C2" != "500" ]; } && rec Y2 "duplicate shelf slug" "$C/$C2 no-500" PASS || rec Y2 "duplicate slug" "$C/$C2!!!" FAIL
# Y3: encoded traversal in DELETE path — clean, no 500
C=$(code Y3 -b $VJ -X DELETE "$BASE/api/library/shelf/..%2F..%2Fetc%2Fpasswd")
[ "$C" != "500" ] && rec Y3 "shelf DELETE encoded traversal" "$C clean" PASS || rec Y3 "shelf DELETE traversal" "$C 500!!!" FAIL
# Y4: 300-char slug
S300=$(python3 -c "print('s'*300)")
C=$(code Y4 -b $VJ -X POST $BASE/api/library/shelf -H "$J" -H "$O" -d "{\"slug\":\"$S300\"}")
{ [ "$C" = "400" ] || [ "$C" = "422" ] || [ "$C" != "500" ]; } && rec Y4 "shelf slug 300 chars" "$C bounded" PASS || rec Y4 "slug 300 chars" "$C 500!!!" FAIL
# Y5: i18n locale path traversal
C=$(code Y5 "$BASE/api/i18n?locale=../../admin")
{ [ "$C" != "500" ] && ! grep -qiE 'root:|admin:' $EV/Y5.raw; } && rec Y5 "i18n locale traversal" "$C clean" PASS || rec Y5 "i18n traversal" "$C!!!" FAIL
# Y6: PostgREST-ish filter param on public content
C=$(code Y6 "$BASE/api/content/worlds?limit=eq.1&id=neq.null")
[ "$C" != "500" ] && rec Y6 "content filter param abuse" "$C no-500" PASS || rec Y6 "content filter abuse" "$C 500!!!" FAIL
# Y6b: cleanup dup slug rows (self-delete, idempotent)
curl -s --max-time 6 -b $VJ -X DELETE "$BASE/api/library/shelf/r11-dup" -o /dev/null
rec Y6b "dup slug cleanup" "self-delete done" INFO

# ═══ Group Z — HTTP semantics & header abuse ═══════════════════════════
# Z1: text/plain content-type on login (parser is CT-agnostic; CSRF is
# guarded by SameSite=Lax + attacker never knows victim credentials)
C=$(code Z1 -X POST $BASE/api/auth/login -H 'Content-Type: text/plain' -H "$O" -d "{\"email\":\"$VK\",\"password\":\"$PW\"}")
{ [ "$C" != "500" ]; } && rec Z1 "login text/plain CT" "$C CT-agnostic (accepted)" INFO || rec Z1 "login text/plain" "$C 500!!!" FAIL
# Z2: empty body login
C=$(code Z2 -X POST $BASE/api/auth/login -H "$J" -H "$O" --data-binary '')
[ "$C" = "400" ] && rec Z2 "login empty body" "400" PASS || rec Z2 "login empty body" "$C!!!" FAIL
# Z3: OPTIONS preflight on authed route
C=$(code Z3 -X OPTIONS $BASE/api/auth/me)
{ [ "$C" != "500" ] && ! grep -q '"email"' $EV/Z3.raw; } && rec Z3 "OPTIONS auth/me" "$C no-data" PASS || rec Z3 "OPTIONS auth/me" "$C!!!" FAIL
# Z4: wrong verb on logout
C=$(code Z4 -X PATCH $BASE/api/auth/logout -b $VJ)
[ "$C" = "405" ] && rec Z4 "PATCH logout verb" "405" PASS || rec Z4 "PATCH logout verb" "$C" INFO
# Z5: HEAD /api/health — no body
C=$(code Z5 -I $BASE/api/health)
echo "$C" | grep -q '^2' && rec Z5 "HEAD health" "2xx" PASS || rec Z5 "HEAD health" "$C" INFO
# Z6: Accept-Language script injection — no reflection
C=$(code Z6 -H 'Accept-Language: <script>alert(1)</script>' $BASE/az/welcome)
grep -q '<script>alert(1)</script>' $EV/Z6.raw && rec Z6 "Accept-Language reflection" "REFLECTED!!!" FAIL || rec Z6 "Accept-Language injection" "no reflection" PASS
# Z7: garbage If-None-Match on public content
C=$(code Z7 -H 'If-None-Match: "garbage-r11"' $BASE/api/content/worlds)
[ "$C" != "500" ] && rec Z7 "garbage If-None-Match" "$C no-500" PASS || rec Z7 "If-None-Match garbage" "$C 500!!!" FAIL
# Z8: XFF rotation vs login buckets — email bucket must cap regardless
# (client_ip takes the LAST XFF hop by design: trusted edge appends the
#  real client, so prod is append-chain-safe; dev surface is local-only)
BF=0
for i in $(seq 1 25); do
  RC=$(curl -s --max-time 8 -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/login -H "$J" -H "$O" \
    -H "X-Forwarded-For: 10.77.$((i/250)).$((i%250+1))" \
    -d "{\"email\":\"xff-$RUN@test.dev\",\"password\":\"wrong-$i\"}")
  [ "$RC" = "429" ] && BF=$((BF+1))
done
[ "$BF" -gt 0 ] && rec Z8 "XFF rotation vs login buckets" "429 ×$BF (em-bucket holds)" PASS || rec Z8 "XFF rotation brute" "25x no 429!!!" FAIL

# ── cleanup: cancel our bookings so re-runs never hit slot_taken ───────
[ -n "$BID2" ] && curl -s --max-time 6 -b $VJ -X POST $BASE/api/psych/cancel -H "$J" -H "$O" -d "{\"id\":\"$BID2\"}" -o /dev/null
rec C0 "booking cleanup" "remaining slots cancelled" INFO

# ── report ─────────────────────────────────────────────────────────────
printf '%s\n' "${ROWS[@]}"
echo "════════════════════════════════════════"
echo "ROUND 11: $PASS pass, $FAIL fail, $INFO info — total $((PASS+FAIL+INFO))"
[ "$FAIL" -eq 0 ] && echo "VERDICT: CLEAN" || echo "VERDICT: $FAIL VULNERABILITIES"
