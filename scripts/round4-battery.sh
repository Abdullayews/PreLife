#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# PreLife security round 4 — 58 attack paths
# verdicts: PASS = secure behaviour; FAIL = vulnerability (needs fix);
#           INFO = accepted-risk / documented observation.
# Evidence: /tmp/round4/<id>_<n>.txt
# ═══════════════════════════════════════════════════════════════════════
set -u
BASE=http://localhost:3000
R4=/tmp/r4cookies.txt          # attacker session (round4@test.dev)
V2=/tmp/v2cookies.txt          # victim session  (victim2@test.dev)
EV=/tmp/round4; mkdir -p $EV
source /tmp/round4-vars        # V2JID, V2DEVID
N=0
declare -a ROWS

rec() { # rec <id> <expected> <got> <verdict>
  ROWS+=("$(printf '%-4s %-42s %-14s %-8s' "$1" "$2" "$3" "$4")")
}
# every probe gets a hard 8s ceiling so a hanging endpoint can't stall the run
code() { local id=$1; shift; curl -s --max-time 8 -o "$EV/$id.raw" -w '%{http_code}' "$@" 2>/dev/null; }

ck() { # ck <id> <expected> <verdict-on-code> <curl-args...>
  local id=$1 exp=$2 got; shift 2
  local ok=$1; shift
  got=$(code "$id" "$@")
  if [ "$got" = "$ok" ]; then rec "$id" "$exp" "$got" PASS; else rec "$id" "$exp" "$got" CHECK; fi
}
size_of() { wc -c < "$EV/$1.raw" 2>/dev/null || echo 0; }

# ── A. OAuth / PKCE flow (emulated, dev-only) ───────────────────────────
# A1 consent page renders for google
got=$(code A1 "$BASE/api/auth/oauth/google"); rec A1 "consent page 200" "$got" "$([ "$got" = 200 ] && echo PASS || echo CHECK)"
# A2 XSS in redirect_to (reflected into consent HTML?)
code A2 "$BASE/api/auth/oauth/google?redirect_to=https://x.test/%22%3E%3Cscript%3Ealert(1)%3C/script%3E"
grep -qi "<script>alert" $EV/A2.raw && rec A2 "redirect_to escaped" "reflected" FAIL || rec A2 "redirect_to escaped" "escaped" PASS
# A3 XSS via next-ish param / client_id / challenge reflection
code A3 "$BASE/api/auth/oauth/google?client_id=%3Cimg%20src=x%20onerror=alert(1)%3E"
grep -qi "onerror=alert" $EV/A3.raw && rec A3 "client_id escaped" "reflected" FAIL || rec A3 "client_id escaped" "escaped" PASS
# A4 provider path traversal
got=$(code A4 "$BASE/api/auth/oauth/%2e%2e%2fsupa-emu%2fauth%2fv1%2fauthorize"); rec A4 "traversal provider -> 40x/404" "$got" "$([ "$got" = 404 ] || [ "$got" = 400 ] && echo PASS || echo CHECK)"
# A5 unknown provider
got=$(code A5 "$BASE/api/auth/oauth/facebook"); [ "$got" = 200 ] && rec A5 "unknown provider" "200 generic consent" INFO || rec A5 "unknown provider" "$got" PASS
# A6 authorize POST with evil Origin (CSRF layer)
got=$(code A6 -X POST "$BASE/api/supa-emu/auth/v1/authorize" -H "Origin: https://evil.com" -H "Content-Type: application/x-www-form-urlencoded" -d "provider=google")
rec A6 "foreign Origin POST -> 403" "$got" "$([ "$got" = 403 ] && echo PASS || echo FAIL)"
# A7 authorize POST Origin:null + forged Sec-Fetch-Site (curl can forge both)
got=$(code A7 -X POST "$BASE/api/supa-emu/auth/v1/authorize" -H "Origin: null" -H "Sec-Fetch-Site: same-origin" -H "Content-Type: application/x-www-form-urlencoded" -d "provider=google")
rec A7 "null-Origin+fetch-site (curl forge)" "$got" INFO
# A8 consent approve redirect_to external host
code A8 -X POST "$BASE/api/supa-emu/auth/v1/authorize" -H "Origin: null" -H "Sec-Fetch-Site: same-origin" -H "Content-Type: application/x-www-form-urlencoded" -d "provider=google&redirect_to=https://evil.com/harvest"
LOC=$(grep -i '^location' $EV/A8.raw | tr -d '\r' | awk '{print $2}')
case "$LOC" in https://evil.com*) rec A8 "approve redirect ext host" "open-redirect" FAIL;; *) rec A8 "approve redirect ext host" "${LOC:-none}" PASS;; esac
# A9 approve redirect_to protocol-relative
code A9 -X POST "$BASE/api/supa-emu/auth/v1/authorize" -H "Origin: null" -H "Sec-Fetch-Site: same-origin" -H "Content-Type: application/x-www-form-urlencoded" -d "provider=google&redirect_to=//evil.com/x"
LOC=$(grep -i '^location' $EV/A9.raw | tr -d '\r' | awk '{print $2}')
case "$LOC" in //evil.com*) rec A9 "approve redirect proto-rel" "open-redirect" FAIL;; *) rec A9 "approve redirect proto-rel" "${LOC:-none}" PASS;; esac
# A10 consent page security headers
curl -sI --max-time 8 "$BASE/api/auth/oauth/google" | tr -d '\r' > $EV/A10.raw
grep -qi "x-frame-options: DENY" $EV/A10.raw && grep -qi "x-content-type-options" $EV/A10.raw && rec A10 "consent headers" "present" PASS || rec A10 "consent headers" "missing" FAIL

# ── B. Callback / verify replay ─────────────────────────────────────────
# B1 callback with garbage code+verifier
got=$(code B1 "$BASE/api/auth/callback?code=emu-oauth-forged&code_verifier=x"); rec B1 "forged oauth code" "$got" "$([ "$got" = 302 ] || [ "$got" = 400 ] || [ "$got" = 403 ] && echo PASS || echo CHECK)"
grep -i "evil" $EV/B1.raw >/dev/null 2>&1 && rec B1b "callback reflect" "evil found" FAIL || rec B1b "callback reflect" "clean" PASS
# B2 verify token replay (already-consumed token)
got=$(code B2 "$BASE/api/auth/verify?token=Dgt5i02Sc7_2sr2iAD-pV3y58e10XL5iEcF4I7DEMFE&locale=en")
grep -o "status=[a-z]*" $EV/B2.raw | head -1 > $EV/B2.st
[ "$(cat $EV/B2.st)" = "status=invalid" ] && rec B2 "verify replay" "invalid" PASS || rec B2 "verify replay" "$(cat $EV/B2.st)" FAIL
# B3 callback missing params
got=$(code B3 "$BASE/api/auth/callback"); rec B3 "callback no params" "$got" "$([ "$got" = 302 ] && echo PASS || echo CHECK)"
# B4 login sets rotated session (compare tokens)
T1=$(grep pl_session $R4 | awk '{print $NF}')
curl -s --max-time 8 -b $R4 -c /tmp/r4b.txt -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"round4@test.dev","password":"r4-Secret-Passw0rd!"}' -o $EV/B4.raw
T2=$(grep pl_session /tmp/r4b.txt | awk '{print $NF}')
[ -n "$T2" ] && [ "$T1" != "$T2" ] && rec B4 "login rotates session" "rotated" PASS || rec B4 "login rotates session" "same/none" FAIL
# B5 logout invalidates server-side
curl -s --max-time 8 -b /tmp/r4b.txt -c /tmp/r4b.txt -X POST $BASE/api/auth/logout -o $EV/B5.raw
got=$(curl -s --max-time 8 -b /tmp/r4b.txt -o /dev/null -w '%{http_code}' $BASE/api/auth/me)
rec B5 "old cookie after logout -> 401" "$got" "$([ "$got" = 401 ] && echo PASS || echo FAIL)"
# B6 cookie flags on fresh login
curl -s --max-time 8 -D /tmp/r4h.txt -o /dev/null -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"round4@test.dev","password":"r4-Secret-Passw0rd!"}' -c /tmp/r4c.txt
grep -i "set-cookie.*pl_session" /tmp/r4h.txt > $EV/B6.raw
grep -qi "httponly" $EV/B6.raw && grep -qi "samesite=lax" $EV/B6.raw && rec B6 "cookie HttpOnly+SameSite" "present" PASS || rec B6 "cookie HttpOnly+SameSite" "missing" FAIL
# B7 session via Authorization header (should NOT work)
got=$(curl -s --max-time 8 -H "Authorization: Bearer $(grep pl_session /tmp/r4c.txt | awk '{print $NF}')" -o /dev/null -w '%{http_code}' $BASE/api/auth/me)
rec B7 "authz header session -> 401" "$got" "$([ "$got" = 401 ] && echo PASS || echo FAIL)"
# B8 malformed session token
got=$(curl -s --max-time 8 -H "Cookie: pl_session=$(python3 -c 'print("A"*128)')" -o /dev/null -w '%{http_code}' $BASE/api/auth/me)
rec B8 "128-char junk token -> 401" "$got" "$([ "$got" = 401 ] && echo PASS || echo FAIL)"

# ── C. Enumeration / reset flows ────────────────────────────────────────
R1=$(curl -s --max-time 8 -w '\n%{time_total}' -X POST $BASE/api/auth/resend -H 'Content-Type: application/json' -d '{"email":"nobody-absent@test.dev"}' -o $EV/C1.raw)
R2=$(curl -s --max-time 8 -w '\n%{time_total}' -X POST $BASE/api/auth/resend -H 'Content-Type: application/json' -d '{"email":"victim2@test.dev"}' -o $EV/C2.raw)
B1o=$(head -1 $EV/C1.raw); B2o=$(head -1 $EV/C2.raw)
[ "$B1o" = "$B2o" ] && rec C1 "resend response parity" "same body" PASS || rec C1 "resend response parity" "differs" FAIL
# C2 resend burst 6x — rate limit?
for i in 1 2 3 4 5 6; do curl -s --max-time 8 -o /dev/null -w '%{http_code} ' -X POST $BASE/api/auth/resend -H 'Content-Type: application/json' -d '{"email":"victim2@test.dev"}'; done > $EV/C2.seq
grep -q 429 $EV/C2.seq && rec C2 "resend burst limit" "429 seen" PASS || rec C2 "resend burst limit" "no 429" INFO
# C3 login wrong-pw vs no-user body parity
curl -s --max-time 8 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"round4@test.dev","password":"wrongpass99"}' -o $EV/C3a.raw
curl -s --max-time 8 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"ghost-user@test.dev","password":"wrongpass99"}' -o $EV/C3b.raw
diff -q $EV/C3a.raw $EV/C3b.raw >/dev/null && rec C3 "login msg parity" "identical" PASS || rec C3 "login msg parity" "differs" INFO
# C4 signup with existing completed email
got=$(code C4 -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' -d '{"name":"Dup User","email":"victim2@test.dev","password":"whatever123","locale":"en"}')
rec C4 "dup signup handling" "$got" INFO
# C5 email charset/homoglyph signup
got=$(code C5 -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' -d '{"name":"Uni Üser","email":"юникод@test.dev","password":"whatever123","locale":"en"}')
rec C5 "non-ascii email -> 400" "$got" "$([ "$got" = 400 ] && echo PASS || echo INFO)"
# C6 email with embedded header chars
got=$(code C6 -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' -d '{"name":"Hdr","email":"a@b.test.dev\r\nBcc: x@y.z","password":"whatever123","locale":"en"}')
rec C6 "CRLF email -> 400" "$got" "$([ "$got" = 400 ] && echo PASS || echo INFO)"

# ── D. Subscription / pay path ──────────────────────────────────────────
got=$(code D1 -X POST $BASE/api/psych/pay); rec D1 "pay unauth -> 401" "$got" "$([ "$got" = 401 ] && echo PASS || echo FAIL)"
got=$(code D2 -b $R4 -X POST $BASE/api/psych/pay -H 'Content-Type: application/json' -d '{"amount":-9900,"currency":"azn"}'); rec D2 "pay negative amount" "$got" INFO
got=$(code D3 -b $R4 -X POST $BASE/api/psych/pay -H 'Content-Type: application/json' -d '{"amount":"NaN","currency":"azn"}'); rec D3 "pay NaN amount" "$got" INFO
got=$(code D4 -b $R4 -X POST $BASE/api/subscription/custom -H 'Content-Type: application/json' -d '{"id":"x","user_id":"other-user","price":0,"items":["a","b"]}'); rec D4 "custom mass-assignment" "$got" INFO
got=$(code D5 -X POST $BASE/api/subscription/custom -H 'Content-Type: application/json' -d '{"price":0}'); rec D5 "custom unauth -> 401" "$got" "$([ "$got" = 401 ] && echo PASS || echo FAIL)"
got=$(code D6 -X POST $BASE/api/psych/book); rec D6 "book unauth -> 401" "$got" "$([ "$got" = 401 ] && echo PASS || echo FAIL)"

# ── E. i18n / locale injection ──────────────────────────────────────────
got=$(code E1 "$BASE/api/i18n?locale=../../../../etc/passwd"); grep -q "root:" $EV/E1.raw && rec E1 "i18n locale traversal" "file read" FAIL || rec E1 "i18n locale traversal" "$got" PASS
got=$(code E2 "$BASE/api/i18n?locale=%3Cscript%3Ealert(1)%3C/script%3E"); grep -qi "<script>alert" $EV/E2.raw && rec E2 "i18n XSS reflect" "reflected" FAIL || rec E2 "i18n XSS reflect" "$got" PASS
got=$(code E3 "$BASE/api/i18n?locale=zz-ZZ"); rec E3 "unknown locale" "$got" INFO
got=$(code E4 "$BASE/en/../admin"); rec E4 "frontend locale ../ path" "$got" INFO
got=$(code E5 "$BASE/qq/welcome"); rec E5 "bad locale prefix" "$got" INFO
got=$(code E6 -H "Accept-Language: en;q=0.9, <script>alert(1)" "$BASE/"); grep -qi "<script>alert" $EV/E6.raw && rec E6 "accept-lang XSS" "reflected" FAIL || rec E6 "accept-lang XSS" "$got" PASS

# ── F. HTTP verb tampering ──────────────────────────────────────────────
got=$(code F1 -X PUT "$BASE/api/auth/login"); rec F1 "login PUT" "$got" "$([ "$got" = 405 ] || [ "$got" = 404 ] && echo PASS || echo CHECK)"
got=$(code F2 -X DELETE "$BASE/api/content/worlds"); rec F2 "content DELETE" "$got" "$([ "$got" = 405 ] || [ "$got" = 404 ] && echo PASS || echo CHECK)"
got=$(code F3 -X PUT -b $R4 "$BASE/api/me/profile"); rec F3 "profile PUT" "$got" "$([ "$got" = 405 ] || [ "$got" = 404 ] && echo PASS || echo CHECK)"
got=$(code F4 -X POST -b $R4 "$BASE/api/devices"); rec F4 "devices POST" "$got" "$([ "$got" = 405 ] || [ "$got" = 404 ] && echo PASS || echo CHECK)"
got=$(code F5 -X TRACE "$BASE/api/health"); rec F5 "TRACE health" "$got" "$([ "$got" = 405 ] || [ "$got" = 404 ] && echo PASS || echo CHECK)"
got=$(code F6 -X PATCH "$BASE/api/auth/login"); rec F6 "login PATCH" "$got" "$([ "$got" = 405 ] || [ "$got" = 404 ] && echo PASS || echo CHECK)"
got=$(code F7 -X DELETE -b $R4 "$BASE/api/subscription/custom"); rec F7 "custom DELETE" "$got" "$([ "$got" = 405 ] || [ "$got" = 404 ] && echo PASS || echo CHECK)"
got=$(code F8 -X PUT "$BASE/internal/home"); rec F8 "internal PUT" "$got" "$([ "$got" = 405 ] || [ "$got" = 404 ] && echo PASS || echo CHECK)"
got=$(code F9 -X HEAD "$BASE/api/health"); rec F9 "HEAD health" "$got" INFO
got=$(code F10 -X OPTIONS "$BASE/api/auth/login" -o /dev/null -w '%{http_code}'); rec F10 "OPTIONS login" "$got" INFO

# ── G. IDOR (victim2 resources, attacker session) ───────────────────────
got=$(code G1 -b $R4 -X DELETE "$BASE/api/psych/journal/$V2JID"); rec G1 "journal IDOR delete" "$got" "$([ "$got" = 404 ] || [ "$got" = 403 ] && echo PASS || echo FAIL)"
grep -q '"ok":true' $EV/G1.raw && rec G1b "journal IDOR deleted!" "ok:true" FAIL || true
got=$(code G2 -b $R4 -X PATCH "$BASE/api/devices/$V2DEVID" -H 'Content-Type: application/json' -d '{"name":"hijacked","icon":"watch"}'); rec G2 "device IDOR patch" "$got" "$([ "$got" = 404 ] || [ "$got" = 403 ] && echo PASS || echo FAIL)"
grep -q '"ok":true' $EV/G2.raw && rec G2b "device IDOR patched!" "ok:true" FAIL || true
got=$(code G3 -b $R4 -X DELETE "$BASE/api/devices/$V2DEVID"); rec G3 "device IDOR delete" "$got" "$([ "$got" = 404 ] || [ "$got" = 403 ] && echo PASS || echo FAIL)"
grep -q '"ok":true' $EV/G3.raw && rec G3b "device IDOR deleted!" "ok:true" FAIL || true
# G4 verify victim2 device still there
got=$(curl -s --max-time 8 -b $V2 -o $EV/G4.raw -w '%{http_code}' $BASE/api/devices)
python3 -c "
import json,sys
d=json.load(open('$EV/G4.raw'))
items=d if isinstance(d,list) else d.get('devices',d.get('items',[]))
print(len(items))" > $EV/G4.n
[ "$(cat $EV/G4.n)" -ge 1 ] && rec G4 "victim device intact" "$(cat $EV/G4.n)" PASS || rec G4 "victim device intact" "0" FAIL
# G5 journal still owned by victim2
got=$(curl -s --max-time 8 -b $V2 -o $EV/G5.raw -w '%{http_code}' "$BASE/api/psych/journal")
python3 -c "
import json
d=json.load(open('$EV/G5.raw'))
items=d if isinstance(d,list) else d.get('items',d.get('entries',[]))
print(len(items))" > $EV/G5.n
[ "$(cat $EV/G5.n)" -ge 1 ] && rec G5 "victim journal intact" "$(cat $EV/G5.n)" PASS || rec G5 "victim journal intact" "0" FAIL

# ── H. Mass assignment / JSON abuse ─────────────────────────────────────
got=$(code H1 -b $R4 -X PATCH "$BASE/api/me/profile" -H 'Content-Type: application/json' -d '{"id":"forged","role":"admin","email":"root@evil.com","psych_slug":"all","full_name":"Escalate"}')
python3 -c "
import json
d=json.load(open('$EV/H1.raw'))
print('role' in json.dumps(d).lower() and d.get('role')=='admin')" > $EV/H1.flag 2>/dev/null; echo 0 > $EV/H1.flag
rec H1 "profile mass-assign role" "$got" INFO
# verify role not written: read profile back
curl -s --max-time 8 -b $R4 $BASE/api/me/profile -o $EV/H1b.raw
grep -qi '"role"\s*:\s*"admin"' $EV/H1b.raw && rec H1b "role actually written?" "admin!" FAIL || rec H1b "role actually written?" "no role" PASS
got=$(code H2 -b $R4 -X PATCH "$BASE/api/me/preferences" -H 'Content-Type: application/json' -d "{\"a\":$(python3 -c 'print("{\"x\":"*40+"1"+"}"*40)')}"); rec H2 "deep nested prefs" "$got" INFO
got=$(code H3 -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '[1,2,3]'); rec H3 "array body login" "$got" "$([ "$got" = 400 ] || [ "$got" = 401 ] && echo PASS || echo CHECK)"
got=$(code H4 -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '"just-a-string"'); rec H4 "string body login" "$got" "$([ "$got" = 400 ] || [ "$got" = 401 ] && echo PASS || echo CHECK)"
got=$(code H5 -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"round4@test.dev","email":"wrong@x.y","password":"r4-Secret-Passw0rd!"}'); rec H5 "duplicate keys" "$got" INFO
got=$(code H6 -X POST "$BASE/api/auth/login" -H 'Content-Type: text/plain' -d '{"email":"round4@test.dev","password":"r4-Secret-Passw0rd!"}'); rec H6 "text/plain json" "$got" INFO
python3 -c "import sys;sys.stdout.write('{\"email\":\"round4@test.dev\",\"password\":\"x\"'+',\"pad\":\"'+\"A\"*1100000+'\"}')" > /tmp/big.json
got=$(curl -s --max-time 8 -o /dev/null -w '%{http_code}' --max-time 20 -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' --data-binary @/tmp/big.json)
rec H7 "1.1MB body" "$got" "$([ "$got" = 413 ] || [ "$got" = 400 ] || [ "$got" = 422 ] && echo PASS || echo CHECK)"

# ── I. Numeric / business-logic abuse ───────────────────────────────────
got=$(code I1 -b $R4 -X POST "$BASE/api/psych/mood" -H 'Content-Type: application/json' -d '{"score":-999}'); rec I1 "mood -999" "$got" INFO
got=$(code I2 -b $R4 -X POST "$BASE/api/psych/mood" -H 'Content-Type: application/json' -d '{"score":9999}'); rec I2 "mood 9999" "$got" INFO
got=$(code I3 -b $R4 -X POST "$BASE/api/psych/mood" -H 'Content-Type: application/json' -d '{"score":"high"}'); rec I3 "mood string" "$got" INFO
got=$(code I4 -b $R4 -X POST "$BASE/api/psych/quiz" -H 'Content-Type: application/json' -d '{"answers":[9999,-999,0,1e999]}'); rec I4 "quiz out-of-range" "$got" INFO
got=$(code I5 -b $R4 -X POST "$BASE/api/psych/progress" -H 'Content-Type: application/json' -d '{"minutes":-5000000,"section":"gym"}'); rec I5 "progress negative" "$got" INFO
J=$(python3 -c "print('A'*600000)")
got=$(curl -s --max-time 8 -b $R4 -o /dev/null -w '%{http_code}' --max-time 20 -X POST "$BASE/api/psych/journal" -H 'Content-Type: application/json' -d "{\"title\":\"t\",\"content\":\"$J\"}")
rec I6 "journal 600KB" "$got" "$([ "$got" = 400 ] || [ "$got" = 413 ] || [ "$got" = 422 ] && echo PASS || echo CHECK)"
got=$(code I7 -b $R4 "$BASE/api/psych/book?slug=eq psychologist'); DROP TABLE students--"); rec I7 "book slug injection" "$got" INFO
got=$(code I8 -b $R4 "$BASE/api/psych/journal?limit=99999999&offset=-5"); rec I8 "journal limit abuse" "$got" INFO

# ── J. Gateway / host header tricks ─────────────────────────────────────
got=$(code J1 "$BASE/api/health?XTransformPort=9999"); rec J1 "XTransformPort abuse" "$got" INFO
got=$(code J2 "$BASE/api/auth/oauth/google" -H "X-Forwarded-Host: evil.com"); grep -qi "evil.com" $EV/J2.raw && rec J2 "XFH reflection" "reflected" FAIL || rec J2 "XFH reflection" "$got" PASS
got=$(code J3 -X POST "$BASE/api/psych/console" -b $R4 -H "Origin: https://evil.com" -H "X-Forwarded-Host: evil.com" -H 'Content-Type: application/json' -d '{"text":"x"}'); rec J3 "origin guard XFH match" "$got" INFO
# verify Location of verify route under foreign Host
got=$(curl -s --max-time 8 -D $EV/J4.h -o /dev/null "$BASE/api/auth/verify?token=x&locale=en" -H "Host: evil.com"); LOC=$(grep -i '^location' $EV/J4.h | tr -d '\r' | awk '{print $2}')
case "$LOC" in http://evil.com*|https://evil.com*) rec J4 "Host-injected redirect" "$LOC" FAIL;; *) rec J4 "Host-injected redirect" "${LOC:-none}" PASS;; esac
got=$(code J5 "$BASE/api/auth/callback?code=x&code_verifier=y&next=https://evil.com"); LOC=$(grep -i '^location' $EV/J5.raw | tr -d '\r' | awk '{print $2}')
case "$LOC" in *evil.com*) rec J5 "callback next ext" "$LOC" FAIL;; *) rec J5 "callback next ext" "${LOC:-none}" PASS;; esac
got=$(code J6 -X POST "$BASE/api/ai/chat" -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"hi"}],"model":"gpt-9"}'); rec J6 "ai model param" "$got" INFO

# ── K. Path traversal / encoding ────────────────────────────────────────
got=$(code K1 "$BASE/api/content/worlds/..%2f..%2fauth%2fme"); rec K1 "worlds traversal" "$got" INFO
got=$(code K2 "$BASE/api/devices/..%2f..%2fetc%2fpasswd"); rec K2 "device id traversal" "$got" INFO
got=$(code K3 -b $R4 "$BASE/api/psych/journal?title=eq.%00"); rec K3 "NUL in filter" "$got" INFO
got=$(code K4 "$BASE/en/..%2f..%2f.env"); grep -q "DB_" $EV/K4.raw && rec K4 "env file read" "leaked" FAIL || rec K4 "env file read" "$got" PASS
got=$(code K5 "$BASE/api/internal/home"); rec K5 "internal via :3000" "$got" INFO

# ── summary ─────────────────────────────────────────────────────────────
echo "════ ROUND 4 RESULTS ════"
printf '%-4s %-42s %-14s %-8s\n' ID EXPECTED CODE VERDICT
for r in "${ROWS[@]}"; do echo "$r"; done
echo "───"
echo "checks: ${#ROWS[@]}"
echo "FAIL count: $(printf '%s\n' "${ROWS[@]}" | grep -c FAIL)"
echo "CHECK count: $(printf '%s\n' "${ROWS[@]}" | grep -c CHECK)"
