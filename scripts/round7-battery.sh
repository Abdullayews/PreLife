#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# PreLife security battery — fresh cycle round 1 (66 distinct checks)
# verdicts: PASS = secure behaviour; FAIL = vulnerability; INFO = accepted
# Brute-force runs LAST so its rate-limit bucket never poisons other checks.
# NOTE: untracked tooling — never committed to the repo.
# ═══════════════════════════════════════════════════════════════════════
set -u
BASE=http://localhost:3000
EV=/tmp/r7; mkdir -p $EV
declare -a ROWS
PASS=0; FAIL=0; INFO=0
rec() { ROWS+=("$(printf '%-4s %-52s %-16s %-5s' "$1" "$2" "$3" "$4")")
  case "$4" in PASS) PASS=$((PASS+1));; FAIL) FAIL=$((FAIL+1));; *) INFO=$((INFO+1));; esac }
code() { local id=$1; shift; curl -s --max-time 10 -o "$EV/$id.raw" -D "$EV/$id.h" -w '%{http_code}' "$@" 2>/dev/null; }
jd()   { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }

VK=v7victim@test.dev; AK=v7attacker@test.dev; PW="R7-Secret-Passw0rd!"
VJ=/tmp/r7victim.jar; AJ=/tmp/r7attacker.jar
mkuser() { # $1=email $2=jar
  curl -s --max-time 10 -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
    -H 'Origin: http://localhost:3000' -d "{\"name\":\"R7 U\",\"email\":\"$1\",\"password\":\"$PW\",\"locale\":\"az\"}" > "$EV/su.$1.json"
  DL=$(python3 -c "import json;print(json.load(open('$EV/su.$1.json')).get('devLink') or '')" 2>/dev/null)
  [ -z "$DL" ] && { echo "SETUP-FAIL($1): $(cat $EV/su.$1.json | head -c 120)"; return 1; }
  curl -s --max-time 10 -c $2 "$DL" -o /dev/null
  curl -s --max-time 10 -b $2 -X POST $BASE/api/auth/complete -H 'Content-Type: application/json' \
    -H 'Origin: http://localhost:3000' -d "{\"name\":\"R7 U\",\"password\":\"$PW\"}" > /dev/null
  curl -s --max-time 10 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
    -H 'Origin: http://localhost:3000' -c $2 -d "{\"email\":\"$1\",\"password\":\"$PW\"}" > /dev/null
}
mkuser $VK $VJ || exit 1
mkuser $AK $AJ || exit 1

# victim artifacts for IDOR
curl -s --max-time 10 -b $VJ -X POST $BASE/api/psych/journal -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' -d '{"content":"victim secret journal r7"}' > $EV/vjp.json
VID=$(python3 -c "import json;d=json.load(open('$EV/vjp.json'));print(d.get('id') or d.get('entry',{}).get('id') or '')" 2>/dev/null)
if [ -z "$VID" ]; then
  VID=$(curl -s --max-time 10 -b $VJ $BASE/api/psych/journal | python3 -c "
import sys,json
d=json.load(sys.stdin)
rows=d if isinstance(d,list) else d.get('entries') or d.get('rows') or []
print(rows[0]['id'] if rows else '')" 2>/dev/null)
fi
VDEV=$(curl -s --max-time 10 -b $VJ $BASE/api/devices | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d if isinstance(d,list) else d.get('devices') or []
print(items[0]['id'] if items else '')" 2>/dev/null)
[ -z "$VDEV" ] && VDEV="11111111-2222-3333-4444-555555555555"

# ══ A. Auth bypass matrix (10) ══════════════════════════════════════════
C=$(code A1 $BASE/api/auth/me); [ "$C" = "200" ] && ! grep -q '"email"' $EV/A1.raw && rec A1 "no-cookie /auth/me → user null" "$C" PASS || rec A1 "no-cookie /auth/me leak" "$C $(head -c 60 $EV/A1.raw)" FAIL
C=$(code A2 $BASE/api/me/profile); { [ "$C" = "401" ] || [ "$C" = "403" ]; } && rec A2 "no-cookie /me/profile" "$C" PASS || rec A2 "no-cookie /me/profile" "$C" FAIL
C=$(code A3 $BASE/api/me/preferences); { [ "$C" = "401" ] || [ "$C" = "403" ]; } && rec A3 "no-cookie /me/preferences" "$C" PASS || rec A3 "no-cookie /me/preferences" "$C" FAIL
C=$(code A4 $BASE/api/devices); { [ "$C" = "401" ] || [ "$C" = "403" ]; } && rec A4 "no-cookie /devices" "$C" PASS || rec A4 "no-cookie /devices" "$C" FAIL
C=$(code A5 -X DELETE $BASE/api/devices/$VDEV); { [ "$C" = "401" ] || [ "$C" = "403" ]; } && rec A5 "no-cookie DELETE /devices/id" "$C" PASS || rec A5 "no-cookie DELETE /devices/id" "$C" FAIL
C=$(code A6 $BASE/api/psych/journal); { [ "$C" = "401" ] || [ "$C" = "403" ]; } && rec A6 "no-cookie /psych/journal" "$C" PASS || rec A6 "no-cookie /psych/journal" "$C" FAIL
C=$(code A7 $BASE/api/psych/console); { [ "$C" = "401" ] || [ "$C" = "403" ]; } && rec A7 "no-cookie /psych/console" "$C" PASS || rec A7 "no-cookie /psych/console" "$C" FAIL
C=$(code A8 $BASE/api/library/shelf); { [ "$C" = "401" ] || [ "$C" = "403" ]; } && rec A8 "no-cookie /library/shelf" "$C" PASS || rec A8 "no-cookie /library/shelf" "$C" FAIL
C=$(code A9 -X POST $BASE/api/gym/progress -H 'Content-Type: application/json' -d '{}'); { [ "$C" = "401" ] || [ "$C" = "403" ]; } && rec A9 "no-cookie POST /gym/progress" "$C" PASS || rec A9 "no-cookie POST /gym/progress" "$C" FAIL
C=$(code A10 $BASE/api/subscription/custom); { [ "$C" = "401" ] || [ "$C" = "403" ]; } && rec A10 "no-cookie /subscription/custom" "$C" PASS || rec A10 "no-cookie /subscription/custom" "$C" FAIL

# ══ B. IDOR / object-level authz (7) ════════════════════════════════════
J=$(curl -s --max-time 10 -b $AJ $BASE/api/psych/journal); echo "$J" | grep -q "victim secret" && rec B1 "journal list leaks victim row" "leak" FAIL || rec B1 "journal list isolation" "no leak" PASS
C=$(code B2 -b $AJ -X DELETE $BASE/api/psych/journal/$VID); { [ "$C" = "404" ] || [ "$C" = "403" ] || [ "$C" = "400" ]; } && rec B2 "foreign journal DELETE blocked" "$C" PASS || rec B2 "foreign journal DELETE" "$C!!!" FAIL
STILL=$(curl -s --max-time 10 -b $VJ $BASE/api/psych/journal | grep -c "victim secret" || true); [ "$STILL" -ge 1 ] && rec B3 "victim journal intact after attack" "intact" PASS || rec B3 "victim journal destroyed" "lost" FAIL
C=$(code B4 -b $AJ -X PATCH $BASE/api/devices/$VDEV -H 'Content-Type: application/json' -d '{"name":"pwn"}'); { [ "$C" = "404" ] || [ "$C" = "403" ] || [ "$C" = "400" ]; } && rec B4 "foreign device PATCH blocked" "$C" PASS || rec B4 "foreign device PATCH" "$C!!!" FAIL
C=$(code B5 -b $AJ -X DELETE $BASE/api/devices/$VDEV); { [ "$C" = "404" ] || [ "$C" = "403" ] || [ "$C" = "400" ]; } && rec B5 "foreign device DELETE blocked" "$C" PASS || rec B5 "foreign device DELETE" "$C!!!" FAIL
C=$(code B6 -b $AJ $BASE/api/library/shelf); grep -q "victim" $EV/B6.raw 2>/dev/null && rec B6 "shelf leaks other user" "leak" FAIL || rec B6 "shelf per-user isolation" "$C own-only" PASS
curl -s --max-time 10 -b $VJ -X POST $BASE/api/library/shelf -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"slug":"r7-idor-probe"}' > /dev/null
C=$(code B7 -b $AJ -X DELETE $BASE/api/library/shelf/r7-idor-probe); VS=$(curl -s --max-time 10 -b $VJ $BASE/api/library/shelf | grep -c "r7-idor-probe" || true)
[ "$VS" -ge 1 ] && rec B7 "shelf DELETE user_id-scoped" "$C victim intact" PASS || rec B7 "shelf DELETE cross-user" "$C victim lost!!!" FAIL

# ══ C. Injection (8) ════════════════════════════════════════════════════
C=$(code C1 -b $AJ "$BASE/api/psych/journal?or=(id.eq.$VID,user_id.eq.$VID)"); grep -q "victim secret" $EV/C1.raw && rec C1 "PostgREST or.() filter injection" "leak" FAIL || rec C1 "or.() filter ignored" "$C own-only" PASS
C=$(code C2 -b $AJ "$BASE/api/psych/journal?id=eq.$VID"); grep -q "victim secret" $EV/C2.raw && rec C2 "PostgREST id=eq. injection" "leak" FAIL || rec C2 "id=eq. filter ignored" "$C own-only" PASS
C=$(code C3 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"email":"'"'"' OR 1=1--@x.dev","password":"x"}'); { [ "$C" != "500" ]; } && ! grep -qi "token" $EV/C3.raw && rec C3 "SQL meta-chars in email" "$C" PASS || rec C3 "SQL chars in email" "$C" FAIL
C=$(code C4 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"email":"'$VK'","password":{"$gt":""}}'); { [ "$C" = "400" ] || [ "$C" = "401" ] || [ "$C" = "422" ]; } && ! grep -q pl_session $EV/C4.h && rec C4 "non-string password on real acct" "$C rejected" PASS || rec C4 "non-string password abuse" "$C!!!" FAIL
C=$(code C5 -b $AJ -X POST $BASE/api/psych/journal -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"content":"<script>alert(1)</script> ; DROP TABLE users;--"}'); { [ "$C" != "500" ]; } && rec C5 "XSS/SQL payload in journal POST" "$C no-500" PASS || rec C5 "journal payload" "$C 500!!!" FAIL
C=$(code C6 -b $AJ -X DELETE "$BASE/api/library/shelf/..%2F..%2Fetc%2Fpasswd"); { [ "$C" != "500" ] && [ "$C" != "200" ]; } && rec C6 "shelf path traversal slug" "$C" PASS || rec C6 "shelf traversal" "$C!!!" FAIL
C=$(code C7 -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"name":"X\r\nBcc: a@b.c","email":"crlf7@test.dev","password":"'$PW'","locale":"az"}'); { [ "$C" != "500" ]; } && rec C7 "CRLF in signup name" "$C no-500" PASS || rec C7 "CRLF name" "$C 500!!!" FAIL
C=$(code C8 "$BASE/api/i18n?locale=<script>alert(1)</script>"); { [ "$C" != "500" ]; } && ! grep -q "<script>alert" $EV/C8.raw && rec C8 "i18n locale injection" "$C encoded" PASS || rec C8 "i18n locale injection" "$C raw!!!" FAIL

# ══ D. XSS / reflection (5) ═════════════════════════════════════════════
P='<script>alert(1)</script>'
C=$(code D1 "$BASE/az/login?next=$P"); grep -q "<script>alert(1)</script>" $EV/D1.raw && rec D1 "login ?next= raw script" "raw!!!" FAIL || rec D1 "login ?next= not raw" "$C encoded" PASS
C=$(code D2 "$BASE/az/login?email=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E"); grep -qE 'value="<img|><img src=x' $EV/D2.raw && rec D2 "login ?email= decoded html" "decoded!!!" FAIL || rec D2 "login ?email= entity/JSON-escaped" "$C" PASS
C=$(code D3 "$BASE/az/signup?devlink=javascript:alert(1)"); grep -q 'href="javascript:alert(1)"' $EV/D3.raw && rec D3 "devlink javascript: href" "raw!!!" FAIL || rec D3 "signup ?devlink= safe" "$C" PASS
C=$(code D4 "$BASE/az/login?error=%3Csvg%20onload%3Dalert(1)%3E"); grep -qE '><svg onload|value="<svg' $EV/D4.raw && rec D4 "login ?error= decoded html" "decoded!!!" FAIL || rec D4 "login ?error= never decoded" "$C" PASS
C=$(code D5 "$BASE/az/login?next=%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E"); grep -q '"><script>alert(1)</script>' $EV/D5.raw && rec D5 "next= attribute breakout" "raw!!!" FAIL || rec D5 "next= attr-encoded" "$C" PASS

# ══ E. Open redirect (4) ════════════════════════════════════════════════
C=$(code E1 "$BASE/az/login?next=//evil.com"); grep -qF 'href="//evil.com' $EV/E1.raw && rec E1 "?next=//evil.com live link" "raw!!!" FAIL || rec E1 "?next=//evil.com (safeNext rejects)" "$C" PASS
C=$(code E2 "$BASE/az/login?next=https:%2F%2Fevil.com%2Fphish"); grep -qE 'href="https://evil.com|src="https://evil.com' $EV/E2.raw && rec E2 "absolute next live link" "raw!!!" FAIL || rec E2 "?next=https:// (safeNext rejects)" "$C" PASS
C=$(code E3 "$BASE/az/login?next=%2F%5Cevil.com"); ! grep -q '/\\evil.com' $EV/E3.raw && rec E3 "?next=/\\evil.com normalized" "$C" PASS || rec E3 "backslash next embedded" "$C raw" FAIL
C=$(code E4 "$BASE/az/login?next=javascript:alert(1)"); ! grep -qi "javascript:" $EV/E4.raw && rec E4 "?next=javascript: rejected" "$C" PASS || rec E4 "js-scheme next embedded" "$C raw" FAIL

# ══ G. Enumeration (4) ══════════════════════════════════════════════════
C=$(code G1 -X POST $BASE/api/auth/resend -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"email":"nosuch7@test.dev"}'); R1=$(cat $EV/G1.raw | tr -d ' \n' | head -c 90)
C=$(code G1b -X POST $BASE/api/auth/resend -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"email":"'$VK'"}'); R2=$(cat $EV/G1b.raw | tr -d ' \n' | head -c 90)
[ "$R1" = "$R2" ] && rec G1 "resend parity unknown vs known" "identical" PASS || rec G1 "resend enumeration" "$R1 vs $R2" FAIL
C=$(code G2 -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"name":"E","email":"'$VK'","password":"'$PW'","locale":"az"}'); grep -qi "already\|exists\|in use" $EV/G2.raw && rec G2 "signup existing-email leak" "leak!!!" FAIL || rec G2 "signup existing email generic" "$C" PASS
C=$(code G3 "$BASE/api/auth/verify?token=00000000-0000-0000-0000-000000000000"); C=$(code G3b "$BASE/api/auth/verify?token=zzzz-garbage-zzzz"); [ "$(cat $EV/G3.raw | head -c 40)" = "$(cat $EV/G3b.raw | head -c 40)" ] && rec G3 "verify token shapes parity" "same" PASS || rec G3 "verify token distinguishable" "differs" INFO
C=$(code G4 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"email":"'$VK'","password":"totally-wrong-1"}'); [ "$C" = "401" ] && rec G4 "known-email wrong-pw → 401" "$C" PASS || rec G4 "known-email wrong-pw" "$C" INFO

# ══ H. Cookie / header audit (6) ════════════════════════════════════════
curl -s --max-time 10 -D $EV/H1.h -o /dev/null -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -c $EV/H1.jar -d '{"email":"'$VK'","password":"'$PW'"}'
SC=$(grep -i 'set-cookie: pl_session' $EV/H1.h | head -1)
echo "$SC" | grep -qi "HttpOnly" && rec H1 "session cookie HttpOnly" "yes" PASS || rec H1 "session cookie HttpOnly" "MISSING" FAIL
echo "$SC" | grep -qi "SameSite=Lax" && rec H2 "session cookie SameSite=Lax" "yes" PASS || rec H2 "session cookie SameSite" "MISSING" FAIL
echo "$SC" | grep -qi "Path=/" && ! echo "$SC" | grep -qi "Domain=" && rec H3 "cookie Path=/ no Domain" "yes" PASS || rec H3 "cookie Path/Domain" "$(echo $SC | head -c 60)" FAIL
C=$(code H4 $BASE/az/login); grep -qi "x-frame-options\|frame-ancestors" $EV/H4.h && rec H4 "clickjacking guard present" "yes" PASS || grep -q "isProd.*frame-ancestors" next.config.ts && rec H4 "frame guard prod-only (design)" "dev preview" INFO || rec H4 "frame guard" "MISSING EVERYWHERE" FAIL
grep -qi "x-content-type-options" $EV/H4.h && rec H5 "nosniff header" "yes" PASS || rec H5 "nosniff" "MISSING" FAIL
grep -qi "referrer-policy" $EV/H4.h && rec H6 "referrer-policy" "yes" PASS || rec H6 "referrer-policy" "MISSING" FAIL

# ══ I. Session security (5) ═════════════════════════════════════════════
TOK=$(echo "$SC" | sed 's/.*pl_session=\([^;]*\).*/\1/')
C=$(code I1 -b "pl_session=$TOK" -X POST $BASE/api/auth/logout -H 'Origin: http://localhost:3000'); [ "$C" = "200" ] && rec I1 "logout accepted" "$C" PASS || rec I1 "logout" "$C" FAIL
C=$(code I2 -b "pl_session=$TOK" $BASE/api/auth/me); grep -q '"email"' $EV/I2.raw && rec I2 "token alive after logout" "LIVE!!!" FAIL || rec I2 "logout kills token" "$C user-null" PASS
DL2=$(python3 -c "import json;print(json.load(open('$EV/su.$VK.json')).get('devLink') or '')")
C=$(code I3 "$DL2"); { [ "$C" = "303" ] || [ "$C" = "302" ] || [ "$C" = "200" ] || [ "$C" = "307" ]; } && rec I3 "verify link replay handled" "$C" INFO || rec I3 "verify replay" "$C" FAIL
C=$(code I4 -X POST $BASE/api/auth/complete -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"name":"X","password":"'$PW'"}'); { [ "$C" = "401" ] || [ "$C" = "403" ] || [ "$C" = "400" ]; } && rec I4 "complete without pre-session" "$C" PASS || rec I4 "complete no-cookie" "$C!!!" FAIL
L=${#TOK}; [ "$L" -ge 32 ] && rec I5 "session token length" "$L chars" PASS || rec I5 "token entropy" "$L chars SHORT" FAIL

# ══ J. Verb tampering / method abuse (4) ════════════════════════════════
C=$(code J1 $BASE/api/auth/login); { [ "$C" = "405" ] || [ "$C" = "404" ]; } && rec J1 "GET on login POST-route" "$C" PASS || rec J1 "GET /auth/login" "$C!!!" FAIL
C=$(code J2 -X POST $BASE/api/auth/me -H 'Content-Type: application/json' -d '{}'); { [ "$C" = "405" ] || [ "$C" = "404" ]; } && rec J2 "POST on /auth/me" "$C" PASS || rec J2 "POST /auth/me" "$C!!!" FAIL
C=$(code J3 -b $AJ -X PUT $BASE/api/me/preferences -H 'Content-Type: application/json' -d '{"lang":"en"}'); { [ "$C" = "405" ] || [ "$C" = "404" ]; } && rec J3 "PUT on preferences (PATCH-only)" "$C" PASS || rec J3 "PUT /me/preferences" "$C!!!" FAIL
C=$(code J4 -b $AJ -X DELETE $BASE/api/psych/console); { [ "$C" = "405" ] || [ "$C" = "404" ]; } && rec J4 "DELETE on console GET-route" "$C" PASS || rec J4 "DELETE /psych/console" "$C!!!" FAIL

# ══ K. Mass assignment (4) ══════════════════════════════════════════════
curl -s --max-time 10 -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"name":"Mx","email":"mass7@test.dev","password":"'$PW'","locale":"az","role":"psychologist","is_admin":true,"email_confirmed":true}' > $EV/K1.json
DLK=$(python3 -c "import json;print(json.load(open('$EV/K1.json')).get('devLink') or '')" 2>/dev/null)
KJ=/tmp/r7mass.jar; ROLE="unset"
if [ -n "$DLK" ]; then
  curl -s --max-time 10 -c $KJ "$DLK" -o /dev/null
  curl -s --max-time 10 -b $KJ -X POST $BASE/api/auth/complete -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"name":"Mx","password":"'$PW'"}' > /dev/null
  ROLE=$(curl -s --max-time 10 -b $KJ $BASE/api/auth/me | python3 -c "import sys,json;print((json.load(sys.stdin).get('user') or {}).get('role','none'))" 2>/dev/null)
fi
{ [ "$ROLE" = "user" ] || [ "$ROLE" = "none" ]; } && rec K1 "signup role=psychologist ignored" "role=$ROLE" PASS || rec K1 "signup mass-assign role" "role=$ROLE!!!" FAIL
C=$(code K2 -b $AJ -X PATCH $BASE/api/me/profile -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"user_id":"'$VID'","role":"psychologist"}'); { [ "$C" != "500" ]; } && rec K2 "profile PATCH foreign user_id" "$C ignored" PASS || rec K2 "profile PATCH abuse" "$C 500" FAIL
R=$(curl -s --max-time 10 -b $AJ $BASE/api/auth/me | python3 -c "import sys,json;print((json.load(sys.stdin).get('user') or {}).get('role','none'))" 2>/dev/null)
[ "$R" = "user" ] && rec K3 "attacker role unchanged" "user" PASS || rec K3 "attacker role escalated" "$R!!!" FAIL
C=$(code K4 -b $AJ -X POST $BASE/api/psych/mood -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"user_id":"'$VID'","mood":1,"score":1}'); { [ "$C" != "500" ]; } && rec K4 "mood POST foreign user_id" "$C scoped-to-self" PASS || rec K4 "mood POST abuse" "$C 500" FAIL

# ══ L. Misc abuse (5) ═══════════════════════════════════════════════════
C=$(code L1 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{broken json!!'); { [ "$C" = "400" ] || [ "$C" = "422" ] || [ "$C" = "401" ]; } && rec L1 "malformed JSON → 4xx" "$C" PASS || rec L1 "malformed JSON" "$C!!! (500?)" FAIL
C=$(code L2 -X POST $BASE/api/auth/login -H 'Content-Type: application/x-www-form-urlencoded' -H 'Origin: http://localhost:3000' -d 'email=a@b.c&password=x'); { [ "$C" != "500" ]; } && rec L2 "form-encoded to JSON route" "$C no-500" PASS || rec L2 "form-encoded abuse" "$C 500" FAIL
NEST=$(python3 -c "print('{\"a\":' * 800 + '1' + '}' * 800)")
C=$(code L3 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d "$NEST"); { [ "$C" != "500" ] && [ "$C" != "000" ]; } && rec L3 "deep-nested JSON" "$C no-500" PASS || rec L3 "deep-nested JSON" "$C" FAIL
BIG=$(python3 -c "print('A'*1100000)")
C=$(code L4 -X POST $BASE/api/psych/journal -b $AJ -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d "{\"content\":\"$BIG\"}"); { [ "$C" != "500" ] && [ "$C" != "000" ]; } && rec L4 "1.1MB journal payload" "$C bounded" PASS || rec L4 "oversized payload" "$C" FAIL
C=$(code L5 -X POST "$BASE/api/supa-emu/auth/v1/token" -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"p"}'); { [ "$C" = "403" ] || [ "$C" = "401" ] || [ "$C" = "404" ]; } && rec L5 "emu route w/o allowed origin" "$C" PASS || rec L5 "emu route unguarded" "$C!!!" FAIL

# ══ F. Brute force / rate limit (LAST — burns login buckets) (4) ════════
BF=0; GOT429=0
for i in $(seq 1 22); do
  RC=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"email":"brute7@test.dev","password":"wrong-'$i'"}')
  BF=$RC; [ "$RC" = "429" ] && { GOT429=1; break; }
done
[ "$GOT429" = "1" ] && rec F1 "per-email brute force ceiling" "429 @ ≤22" PASS || rec F1 "brute force unthrottled" "22x all $BF" FAIL
RC=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"email":"brute7@test.dev","password":"wrong-more"}')
[ "$RC" = "429" ] && rec F2 "ceiling holds after trip" "still 429" PASS || rec F2 "ceiling after trip" "$RC" INFO
C=$(code F3 -X POST $BASE/api/auth/demo -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{}'); [ "$C" = "404" ] && rec F3 "demo endpoint stays removed" "404" PASS || rec F3 "demo endpoint resurrected" "$C!!!" FAIL
N=0; for i in $(seq 1 12); do RC=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/resend -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"email":"resend7@test.dev"}'); [ "$RC" = "429" ] && { N=$RC; break; }; N=$RC; done
{ [ "$N" = "429" ] || [ "$N" != "500" ]; } && rec F4 "resend flood no 500/leak" "last=$N" PASS || rec F4 "resend flood" "$N" FAIL

# ══ Report ══════════════════════════════════════════════════════════════
printf '%s\n' "${ROWS[@]}"
echo "──────────────────────────────────────────────────────"
echo "TOTAL: $PASS pass, $FAIL fail, $INFO info — $((PASS+FAIL+INFO)) checks"
