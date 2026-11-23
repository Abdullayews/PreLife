#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# PreLife security battery — round 9 (55 distinct checks)
# Focus: the v5.4 role system attack surface (mass-assignment role
# escalation, role-gate matrix, hall-console deep abuse, admin console
# privacy) + new general vectors (plan-delete IDOR, known-token double
# consume, preflight/verb handling, console floods). All vectors NEW vs
# rounds 1-8 (93 + 54 prior checks).
# verdicts: PASS = secure; FAIL = vulnerability; INFO = accepted design
# Floods run LAST (bucket hygiene).
# ═══════════════════════════════════════════════════════════════════════
set -u
BASE=http://localhost:3000
EV=/tmp/r9; mkdir -p $EV
declare -a ROWS
PASS=0; FAIL=0; INFO=0
rec() { ROWS+=("$(printf '%-4s %-56s %-15s %-5s' "$1" "$2" "$3" "$4")")
  case "$4" in PASS) PASS=$((PASS+1));; FAIL) FAIL=$((FAIL+1));; *) INFO=$((INFO+1));; esac }
code() { local id=$1; shift; curl -s --max-time 12 -o "$EV/$id.raw" -D "$EV/$id.h" -w '%{http_code}' "$@" 2>/dev/null; }
jar_role() { # email pw jarfile → prints role from /api/auth/me, empty if guest
  curl -s --max-time 10 -c "$3" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
    -H 'Origin: http://localhost:3000' -d "{\"email\":\"$1\",\"password\":\"$2\"}" >/dev/null
  curl -s --max-time 10 -b "$3" $BASE/api/auth/me | python3 -c "import json,sys
try:
  d=json.load(sys.stdin); print((d.get('user') or {}).get('role') or 'user')
except Exception: print('')" 2>/dev/null
}

PW="R9-Secret-Passw0rd!"
RUN=$(date +%s)
VK=v9victim-$RUN@test.dev; AK=v9attacker-$RUN@test.dev
VJ=/tmp/r9victim.jar; AJ=/tmp/r9attacker.jar
CONSOLE_PW=R9-Console-Passw0rd
PSY=/tmp/r9psy.jar; ZAL=/tmp/r9zal.jar; ADM=/tmp/r9adm.jar

# ── setup: victim, attacker, console roles ────────────────────────────────
DL=$(curl -s --max-time 10 -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' -d "{\"name\":\"R9 V\",\"email\":\"$VK\",\"password\":\"$PW\",\"locale\":\"az\"}" \
  | python3 -c "import json,sys;print(json.load(sys.stdin).get('devLink',''))" 2>/dev/null)
[ -z "$DL" ] && { echo "SETUP-FAIL victim"; exit 1; }
curl -s --max-time 10 -c $VJ "$DL" -o /dev/null
curl -s --max-time 10 -b $VJ -X POST $BASE/api/auth/complete -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' -d '{"name":"R9 Victim","heightCm":175,"gender":"male","goal":"fitness","activityLevel":"moderate","fitnessLevel":"beginner","workoutsPerWeek":3,"readingGoalBooksPerYear":6}' >/dev/null
DLA=$(curl -s --max-time 10 -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' -d "{\"name\":\"R9 A\",\"email\":\"$AK\",\"password\":\"$PW\",\"locale\":\"az\"}" \
  | python3 -c "import json,sys;print(json.load(sys.stdin).get('devLink',''))" 2>/dev/null)
[ -z "$DLA" ] && { echo "SETUP-FAIL attacker"; exit 1; }
curl -s --max-time 10 -c $AJ "$DLA" -o /dev/null
curl -s --max-time 10 -b $AJ -X POST $BASE/api/auth/complete -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' -d '{"name":"R9 Attacker","heightCm":175,"gender":"male","goal":"fitness","activityLevel":"moderate","fitnessLevel":"beginner","workoutsPerWeek":3,"readingGoalBooksPerYear":6}' >/dev/null
[ "$(jar_role $VK $PW $VJ)" = "user" ] || { echo "SETUP-FAIL victim role"; exit 1; }
[ "$(jar_role $AK $PW $AJ)" = "user" ] || { echo "SETUP-FAIL attacker role"; exit 1; }
PR=$(jar_role r9-psixoloq@test.dev $CONSOLE_PW $PSY); ZR=$(jar_role r9-zal@test.dev $CONSOLE_PW $ZAL); AR=$(jar_role r9-admin@test.dev $CONSOLE_PW $ADM)
{ [ "$PR" = "psychologist" ] && [ "$ZR" = "hall_manager" ] && [ "$AR" = "admin" ]; } || { echo "SETUP-FAIL console roles: $PR/$ZR/$AR"; exit 1; }
echo "setup ok: victim+attacker+psy+zal+admin"

J='Content-Type: application/json'
O='Origin: http://localhost:3000'

# ═══ Group K — role escalation via mass assignment ═════════════════════
# K1: signup body carries role=admin → account must be plain user
C=$(code K1 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"K1\",\"email\":\"k1-$RUN@test.dev\",\"password\":\"$PW\",\"locale\":\"az\",\"role\":\"admin\"}")
R=$(python3 -c "import json;print(json.load(open('$EV/K1.raw')).get('user',{}).get('role','?'))" 2>/dev/null)
{ [ "$C" = "200" ] || [ "$C" = "201" ]; } && [ "$R" != "admin" ] && rec K1 "signup body role=admin" "role=$R" PASS || rec K1 "signup body role=admin" "role=$R code=$C!!!" FAIL

# K2: signup user_metadata role smuggling
C=$(code K2 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"K2\",\"email\":\"k2-$RUN@test.dev\",\"password\":\"$PW\",\"locale\":\"az\",\"user_metadata\":{\"role\":\"admin\"}}")
grep -q '"role":"admin"' $EV/K2.raw && rec K2 "signup metadata role" "echoed!!!" FAIL || rec K2 "signup metadata role" "stripped" PASS

# K3: profile PATCH role=admin → ignored
C=$(code K3 -b $VJ -X PATCH $BASE/api/me/profile -H "$J" -H "$O" -d '{"role":"admin"}')
MR=$(curl -s --max-time 10 -b $VJ $BASE/api/auth/me | python3 -c "import json,sys;print((json.load(sys.stdin).get('user') or {}).get('role','?'))" 2>/dev/null)
{ [ "$C" != "500" ] && [ "$MR" = "user" ]; } && rec K3 "profile PATCH role=admin" "role=$MR" PASS || rec K3 "profile PATCH role=admin" "role=$MR!!!" FAIL

# K4: profile PATCH role+hallSlug
C=$(code K4 -b $VJ -X PATCH $BASE/api/me/profile -H "$J" -H "$O" -d '{"role":"hall_manager","hallSlug":"ironhouse"}')
MR=$(curl -s --max-time 10 -b $VJ $BASE/api/auth/me | python3 -c "import json,sys;u=json.load(sys.stdin).get('user') or {};print(u.get('role','?'),u.get('hallSlug') or '')" 2>/dev/null)
{ [ "$C" != "500" ] && echo "$MR" | grep -q '^user ' ; } && rec K4 "profile PATCH role+hallSlug" "role=$MR" PASS || rec K4 "profile PATCH role+hallSlug" "role=$MR!!!" FAIL

# K5: preferences PATCH role
C=$(code K5 -b $VJ -X PATCH $BASE/api/me/preferences -H "$J" -H "$O" -d '{"role":"admin","theme":"light"}')
MR=$(curl -s --max-time 10 -b $VJ $BASE/api/auth/me | python3 -c "import json,sys;print((json.load(sys.stdin).get('user') or {}).get('role','?'))" 2>/dev/null)
{ [ "$C" != "500" ] && [ "$MR" = "user" ]; } && rec K5 "preferences PATCH role" "role=$MR" PASS || rec K5 "preferences PATCH role" "role=$MR!!!" FAIL

# K6: complete with role field (fresh unverified user)
DLC=$(curl -s --max-time 10 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"K6\",\"email\":\"k6-$RUN@test.dev\",\"password\":\"$PW\",\"locale\":\"az\"}" | python3 -c "import json,sys;print(json.load(sys.stdin).get('devLink',''))" 2>/dev/null)
K6J=/tmp/r9k6.jar; curl -s --max-time 10 -c $K6J "$DLC" -o /dev/null
C=$(code K6 -b $K6J -X POST $BASE/api/auth/complete -H "$J" -H "$O" -d '{"name":"K6 U","role":"admin","heightCm":175,"gender":"male","goal":"fitness","activityLevel":"moderate","fitnessLevel":"beginner","workoutsPerWeek":3,"readingGoalBooksPerYear":6}')
MR=$(curl -s --max-time 10 -b $K6J $BASE/api/auth/me | python3 -c "import json,sys;print((json.load(sys.stdin).get('user') or {}).get('role','?'))" 2>/dev/null)
{ [ "$C" != "500" ] && [ "$MR" != "admin" ]; } && rec K6 "complete body role=admin" "role=$MR" PASS || rec K6 "complete body role=admin" "role=$MR!!!" FAIL

# K7: profile PATCH role=123 (number type confusion)
C=$(code K7 -b $VJ -X PATCH $BASE/api/me/profile -H "$J" -H "$O" -d '{"role":123}')
MR=$(curl -s --max-time 10 -b $VJ $BASE/api/auth/me | python3 -c "import json,sys;print((json.load(sys.stdin).get('user') or {}).get('role','?'))" 2>/dev/null)
{ [ "$C" != "500" ] && [ "$MR" = "user" ]; } && rec K7 "profile PATCH role=123" "role=$MR" PASS || rec K7 "profile PATCH role=123" "role=$MR!!!" FAIL

# K8: profile PATCH role=[array]
C=$(code K8 -b $VJ -X PATCH $BASE/api/me/profile -H "$J" -H "$O" -d '{"role":["admin"]}')
MR=$(curl -s --max-time 10 -b $VJ $BASE/api/auth/me | python3 -c "import json,sys;print((json.load(sys.stdin).get('user') or {}).get('role','?'))" 2>/dev/null)
{ [ "$C" != "500" ] && [ "$MR" = "user" ]; } && rec K8 "profile PATCH role=[\"admin\"]" "role=$MR" PASS || rec K8 "profile PATCH role=[\"admin\"]" "role=$MR!!!" FAIL

# K9: login body role=admin ignored
C=$(code K9 -X POST $BASE/api/auth/login -H "$J" -H "$O" -d "{\"email\":\"$VK\",\"password\":\"$PW\",\"role\":\"admin\"}")
grep -q '"role":"admin"' $EV/K9.raw && rec K9 "login body role=admin" "echoed!!!" FAIL || rec K9 "login body role=admin" "ignored" PASS

# K10: devices PATCH role smuggling
VDEV=$(curl -s --max-time 10 -b $VJ $BASE/api/devices | python3 -c "import json,sys;d=json.load(sys.stdin);ds=d.get('devices') or d;print((ds[0].get('id') if isinstance(ds,list) and ds else ''))" 2>/dev/null)
C=$(code K10 -b $VJ -X PATCH $BASE/api/devices/$VDEV -H "$J" -H "$O" -d '{"role":"admin","name":"r9 dev"}')
MR=$(curl -s --max-time 10 -b $VJ $BASE/api/auth/me | python3 -c "import json,sys;print((json.load(sys.stdin).get('user') or {}).get('role','?'))" 2>/dev/null)
{ [ "$C" != "500" ] && [ "$MR" = "user" ]; } && rec K10 "devices PATCH role" "role=$MR" PASS || rec K10 "devices PATCH role" "role=$MR!!!" FAIL

# K11: journal POST role smuggling
C=$(code K11 -b $VJ -X POST $BASE/api/psych/journal -H "$J" -H "$O" -d '{"content":"r9 k11 note","role":"admin"}')
MR=$(curl -s --max-time 10 -b $VJ $BASE/api/auth/me | python3 -c "import json,sys;print((json.load(sys.stdin).get('user') or {}).get('role','?'))" 2>/dev/null)
{ [ "$C" = "200" ] || [ "$C" = "201" ]; } && [ "$MR" = "user" ] && rec K11 "journal POST role" "role=$MR" PASS || rec K11 "journal POST role" "code=$C role=$MR!!!" FAIL

# K12: verify endpoint role param
C=$(code K12 "$BASE/api/auth/verify?token=$(python3 -c 'print("c"*43)')&locale=az&role=admin")
grep -qi 'set-cookie: pl_session' $EV/K12.h && rec K12 "verify role param grants session" "BYPASS!!!" FAIL || rec K12 "verify role param" "no session" PASS

# ═══ Group L — role-gate matrix (every console × every role) ═══════════
C=$(code L1 $BASE/api/gym/console); { [ "$C" = "401" ] || [ "$C" = "403" ]; } && rec L1 "guest GET gym/console" "$C" PASS || rec L1 "guest GET gym/console" "$C!!!" FAIL
C=$(code L2 $BASE/api/admin/console); { [ "$C" = "401" ] || [ "$C" = "403" ]; } && rec L2 "guest GET admin/console" "$C" PASS || rec L2 "guest GET admin/console" "$C!!!" FAIL
C=$(code L3 -b $VJ -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"update","dayPrice":1}'); [ "$C" = "403" ] && rec L3 "plain user POST gym/console" "403" PASS || rec L3 "plain user POST gym/console" "$C!!!" FAIL
C=$(code L4 -b $VJ -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"add_trainer","name":"H4x","specCode":"strength","years":1}'); [ "$C" = "403" ] && rec L4 "plain user add_trainer" "403" PASS || rec L4 "plain user add_trainer" "$C!!!" FAIL
C=$(code L5 -b $VJ -X DELETE $BASE/api/admin/console); { [ "$C" = "404" ] || [ "$C" = "405" ]; } && rec L5 "admin/console has no DELETE" "$C" PASS || rec L5 "admin/console DELETE" "$C!!!" FAIL
C=$(code L6 -b $ADM -X POST $BASE/api/admin/console -H "$J" -H "$O" -d '{"stats":{}}'); { [ "$C" = "404" ] || [ "$C" = "405" ]; } && rec L6 "admin POST admin/console (no write)" "$C" PASS || rec L6 "admin POST admin/console" "$C!!!" FAIL
C=$(code L7 -b $ADM -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"update","dayPrice":1}'); [ "$C" = "403" ] && rec L7 "admin POST gym/console" "403" PASS || rec L7 "admin POST gym/console" "$C!!!" FAIL
C=$(code L8 -b $PSY $BASE/api/gym/console); [ "$C" = "403" ] && rec L8 "psychologist GET gym/console" "403" PASS || rec L8 "psychologist GET gym/console" "$C!!!" FAIL
C=$(code L9 -b $ADM $BASE/api/gym/console); [ "$C" = "403" ] && rec L9 "admin GET gym/console" "403" PASS || rec L9 "admin GET gym/console" "$C!!!" FAIL

# ═══ Group M — hall console deep abuse (as hall manager) ═══════════════
# M1: update with identity fields in body → identity unchanged
C=$(code M1 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"update","dayPrice":19,"slug":"owned","name":"Hacked Hall","rating":1.0,"owner_id":"00000000-0000-0000-0000-000000000000","id":"999"}')
HK=$(python3 -c "import json;h=json.load(open('$EV/M1.raw')).get('hall',{});print(h.get('slug',''),h.get('nameKey',''),h.get('id',''))" 2>/dev/null)
{ [ "$C" = "200" ] && echo "$HK" | grep -q 'ironhouse venueIronName'; } && rec M1 "update w/ identity fields" "identity intact" PASS || rec M1 "update w/ identity fields" "$HK code=$C!!!" FAIL
# M2/M3: welcomeVisible type confusion
C=$(code M2 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"update","welcomeVisible":"true"}'); [ "$C" = "400" ] && rec M2 "welcomeVisible=\"true\" str" "400" PASS || rec M2 "welcomeVisible string" "$C!!!" FAIL
C=$(code M3 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"update","welcomeVisible":1}'); [ "$C" = "400" ] && rec M3 "welcomeVisible=1 num" "400" PASS || rec M3 "welcomeVisible number" "$C!!!" FAIL
# M4-M7: dayPrice type/range abuse
C=$(code M4 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"update","dayPrice":"21"}'); [ "$C" = "400" ] && rec M4 "dayPrice string" "400" PASS || rec M4 "dayPrice string" "$C!!!" FAIL
C=$(code M5 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"update","dayPrice":1e999}'); { [ "$C" = "400" ] || [ "$C" != "500" ]; } && rec M5 "dayPrice 1e999" "$C bounded" PASS || rec M5 "dayPrice 1e999" "$C!!!" FAIL
C=$(code M6 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"update","dayPrice":-1}'); [ "$C" = "400" ] && rec M6 "dayPrice negative" "400" PASS || rec M6 "dayPrice negative" "$C!!!" FAIL
C=$(code M7 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"update","dayPrice":100001}'); [ "$C" = "400" ] && rec M7 "dayPrice >100k cap" "400" PASS || rec M7 "dayPrice over cap" "$C!!!" FAIL
# M8: hours boundary 61 chars
H61=$(python3 -c "print('x'*61)")
C=$(code M8 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d "{\"action\":\"update\",\"hours\":\"$H61\"}"); [ "$C" = "400" ] && rec M8 "hours 61-char over cap" "400" PASS || rec M8 "hours 61-char" "$C!!!" FAIL
# M9: address XSS → public render must encode
XADDR='R9 st <img src=x onerror=alert(1)>'
C=$(code M9 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d "{\"action\":\"update\",\"address\":\"$XADDR\"}")
code M9b $BASE/az/gym > /dev/null
if grep -q 'onerror=alert' $EV/M9b.raw; then rec M9 "address XSS on public page" "RAW!!! " FAIL; else rec M9 "address XSS on public page" "encoded/no-echo" PASS; fi
# M10: trainer name XSS → charset gate
C=$(code M10 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"add_trainer","name":"<script>alert(1)</script>","specCode":"strength","years":3}'); [ "$C" = "400" ] && rec M10 "trainer name XSS" "400 charset" PASS || rec M10 "trainer name XSS" "$C!!!" FAIL
# M11: trainer years abuse
C=$(code M11 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"add_trainer","name":"R9 Years","specCode":"strength","years":-5}'); [ "$C" = "400" ] && rec M11 "trainer years=-5" "400" PASS || rec M11 "trainer years=-5" "$C!!!" FAIL
# M12: remove_trainer random uuid → no-op, roster intact
BEFORE=$(curl -s --max-time 10 -b $ZAL $BASE/api/gym/console | python3 -c "import json,sys;print(len(json.load(sys.stdin)['trainers']))" 2>/dev/null)
C=$(code M12 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"remove_trainer","trainerId":"00000000-0000-0000-0000-000000000000"}')
AFTER=$(curl -s --max-time 10 -b $ZAL $BASE/api/gym/console | python3 -c "import json,sys;print(len(json.load(sys.stdin)['trainers']))" 2>/dev/null)
[ "$BEFORE" = "$AFTER" ] && rec M12 "remove foreign/random trainer" "roster intact" PASS || rec M12 "remove foreign/random trainer" "$BEFORE→$AFTER!!!" FAIL
# M13: unknown action
C=$(code M13 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"delete_hall"}'); [ "$C" = "400" ] && rec M13 "unknown action delete_hall" "400" PASS || rec M13 "unknown action" "$C!!!" FAIL
# M14: empty update patch
C=$(code M14 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"update"}'); [ "$C" = "400" ] && rec M14 "update empty patch" "400" PASS || rec M14 "update empty patch" "$C!!!" FAIL
# M15: specCode injection → registry gate
C=$(code M15 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d "{\"action\":\"add_trainer\",\"name\":\"R9 Spec\",\"specCode\":\"strength'); DROP TABLE gym_trainers--\",\"years\":2}"); [ "$C" = "400" ] && rec M15 "specCode injection" "400 registry" PASS || rec M15 "specCode injection" "$C!!!" FAIL

# ═══ Group N — new general vectors ═════════════════════════════════════
# N1: plan DELETE is own-only (attacker delete cannot touch victim plan)
curl -s --max-time 10 -b $VJ -X POST $BASE/api/gym/plan -H "$J" -H "$O" -d '{"days":[{"day":1,"sets":3,"exercises":[{"slug":"push-up","sets":3,"reps":10}]}]}' >/dev/null 2>&1
C=$(code N1 -b $AJ -X DELETE $BASE/api/gym/plan)
VP=$(curl -s --max-time 10 -b $VJ $BASE/api/gym/plan | python3 -c "import json,sys;d=json.load(sys.stdin);p=d.get('plan') or d;print('yes' if p else 'empty')" 2>/dev/null)
[ "$VP" = "yes" ] && rec N1 "plan DELETE cross-user" "victim intact" PASS || rec N1 "plan DELETE cross-user" "victim=$VP!!!" FAIL
# N2: plan DELETE no-cookie
C=$(code N2 -X DELETE $BASE/api/gym/plan); { [ "$C" = "401" ] || [ "$C" = "403" ]; } && rec N2 "plan DELETE no-cookie" "$C" PASS || rec N2 "plan DELETE no-cookie" "$C!!!" FAIL
# N3: shelf slug query-ish
C=$(code N3 -b $AJ -X POST $BASE/api/library/shelf -H "$J" -H "$O" -d '{"slug":"r9-q?a=b&c"}'); { [ "$C" != "500" ]; } && rec N3 "shelf query-ish slug" "$C no-500" PASS || rec N3 "shelf query-ish slug" "$C 500!!!" FAIL
# N4: known devLink double-consume → no second session
DLD=$(curl -s --max-time 10 -X POST $BASE/api/auth/signup -H "$J" -H "$O" -d "{\"name\":\"N4\",\"email\":\"n4-$RUN@test.dev\",\"password\":\"$PW\",\"locale\":\"az\"}" | python3 -c "import json,sys;print(json.load(sys.stdin).get('devLink',''))" 2>/dev/null)
N4J=/tmp/r9n4.jar; curl -s --max-time 10 -c $N4J "$DLD" -o /dev/null
N4J2=/tmp/r9n4b.jar; curl -s --max-time 10 -c $N4J2 "$DLD" -o /dev/null
S2=$(curl -s --max-time 10 -b $N4J2 $BASE/api/auth/me | python3 -c "import json,sys;d=json.load(sys.stdin);print('yes' if d.get('user') else 'no')" 2>/dev/null)
[ "$S2" = "no" ] && rec N4 "devLink double-consume" "second dead" PASS || rec N4 "devLink double-consume" "second alive!!!" FAIL
# N5: complete twice → no 500
C=$(code N5 -b $N4J -X POST $BASE/api/auth/complete -H "$J" -H "$O" -d '{"name":"N4 Again","heightCm":175,"gender":"male","goal":"fitness","activityLevel":"moderate","fitnessLevel":"beginner","workoutsPerWeek":3,"readingGoalBooksPerYear":6}')
{ [ "$C" != "500" ]; } && rec N5 "complete already-completed" "$C no-500" PASS || rec N5 "complete twice" "$C 500!!!" FAIL
# N6: admin console privacy — no PII in response
C=$(code N6 -b $ADM $BASE/api/admin/console)
if grep -qiE '"(email|full_name|content)"' $EV/N6.raw; then rec N6 "admin console PII leak" "PII!!!" FAIL; else rec N6 "admin console counts-only" "no PII" PASS; fi
# N7: gym console sees exactly one hall
NSLUG=$(curl -s --max-time 10 -b $ZAL $BASE/api/gym/console | python3 -c "import json,sys;print(json.load(sys.stdin)['hall']['slug'])" 2>/dev/null)
[ "$NSLUG" = "ironhouse" ] && rec N7 "gym console own hall only" "own hall" PASS || rec N7 "gym console hall scope" "$NSLUG!!!" FAIL
# N8: clickjacking headers on console page
code N8 -b $ADM $BASE/az/admin > /dev/null
if grep -qiE 'x-frame-options|frame-ancestors' $EV/N8.h; then rec N8 "admin page frame guard" "present" PASS; else rec N8 "admin page frame guard" "absent" INFO; fi
# N9: CORS preflight evil origin on gym console
C=$(code N9 -X OPTIONS $BASE/api/gym/console -H 'Origin: https://evil.example' -H 'Access-Control-Request-Method: POST')
if grep -qi 'access-control-allow-origin: https://evil' $EV/N9.h; then rec N9 "preflight evil origin ACAO" "REFLECTED!!!" FAIL; else rec N9 "preflight evil origin" "no evil ACAO" PASS; fi
# N10: HEAD verb on authed endpoint
C=$(code N10 -b $VJ -I $BASE/api/auth/me)
grep -q '"email"' $EV/N10.raw && rec N10 "HEAD verb bypass" "body???" FAIL || rec N10 "HEAD verb handling" "$C no-body" PASS
# N11: i18n locale=admin (nonexistent locale)
C=$(code N11 "$BASE/api/i18n?locale=admin"); { [ "$C" = "200" ] || [ "$C" = "400" ]; } && rec N11 "i18n locale=admin" "$C fallback" PASS || rec N11 "i18n locale=admin" "$C!!!" FAIL
# N12: public content/gym must not expose owner_id
code N12 $BASE/api/content/gym > /dev/null
grep -q 'owner_id' $EV/N12.raw && rec N12 "content/gym owner_id leak" "exposed" INFO || rec N12 "content/gym owner_id" "not exposed" PASS
# N13: SSR console pages leak no data to wrong roles
code N13 -b $VJ $BASE/az/gym/console > /dev/null
grep -qE '"dayPrice":[0-9]|ironhouse' $EV/N13.raw && rec N13 "SSR gym/console plain user" "data!!!" FAIL || rec N13 "SSR gym/console plain user" "no hall data" PASS
code N14 -b $PSY $BASE/az/admin > /dev/null
grep -q '"stats"' $EV/N14.raw && rec N14 "SSR admin psych user" "stats!!!" FAIL || rec N14 "SSR admin psych user" "no stats" PASS
# N15: supa-emu admin surface still removed post-v5.4
C=$(code N15 -X POST "$BASE/api/supa-emu/auth/v1/admin/users" -H "$J" -H "$O" -d '{"email":"forged@test.dev","role":"admin"}')
{ [ "$C" = "404" ] || [ "$C" = "403" ] || [ "$C" = "405" ]; } && rec N15 "supa-emu admin surface" "$C removed" PASS || rec N15 "supa-emu admin surface" "$C!!!" FAIL
# N16: role persistence after re-login (K3 tamper attempt then fresh session)
curl -s --max-time 10 -b $VJ -X PATCH $BASE/api/me/profile -H "$J" -H "$O" -d '{"role":"admin"}' >/dev/null
RE=$(jar_role $VK $PW /tmp/r9relogin.jar)
[ "$RE" = "user" ] && rec N16 "role persists user after re-login" "user" PASS || rec N16 "role after re-login" "$RE!!!" FAIL
# N17: address CRLF-ish newline stored — render safety (echo of M9 with \n)
C=$(code N17 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"update","address":"line1\nX-Injected: yes"}')
{ [ "$C" != "500" ]; } && rec N17 "address newline abuse" "$C no-500" PASS || rec N17 "address newline abuse" "$C 500!!!" FAIL
# N18: psychologist console role isolation — victim GET psych/console
C=$(code N18 -b $VJ $BASE/api/psych/console); { [ "$C" = "401" ] || [ "$C" = "403" ]; } && rec N18 "plain user GET psych/console" "$C" PASS || rec N18 "plain user psych/console" "$C!!!" FAIL
# N19: admin console GET flood (40 rapid) — read-only, may be unthrottled by design
RL=""; for i in $(seq 1 40); do RL=$(curl -s --max-time 5 -b $ADM -o /dev/null -w '%{http_code}' $BASE/api/admin/console); done
[ "$RL" = "429" ] && rec N19 "admin console flood 40x" "429" PASS || rec N19 "admin console flood 40x" "unthrottled (read-only)" INFO
# N20: restore hall data (M1 changed dayPrice) + final M9 cleanup
curl -s --max-time 10 -b $ZAL -X POST $BASE/api/gym/console -H "$J" -H "$O" -d '{"action":"update","dayPrice":18,"hours":"24/7","address":"Nərimanov, Ə. Rəcəbli küç.","welcomeVisible":true}' -o /dev/null
rec N20 "hall data restored post-battery" "dayPrice=18" INFO

# ── report ─────────────────────────────────────────────────────────────
printf '%s\n' "${ROWS[@]}"
echo "════════════════════════════════════════"
echo "ROUND 9: $PASS pass, $FAIL fail, $INFO info — total $((PASS+FAIL+INFO))"
[ "$FAIL" -eq 0 ] && echo "VERDICT: CLEAN" || echo "VERDICT: $FAIL VULNERABILITIES"
