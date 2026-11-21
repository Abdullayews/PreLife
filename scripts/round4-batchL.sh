#!/usr/bin/env bash
# Round 4 batch L — 20 additional vectors
set -u
BASE=http://localhost:3000
R4=/tmp/r4c.txt
EV=/tmp/round4; mkdir -p $EV
declare -a ROWS
rec() { ROWS+=("$(printf '%-4s %-46s %-12s %-8s' "$1" "$2" "$3" "$4")"); }

# L1 XFF rotation vs per-email login bucket (20/15min)
codes=""
for i in $(seq 1 24); do
  c=$(curl -s --max-time 8 -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/login \
    -H 'Content-Type: application/json' -H "X-Forwarded-For: 10.9.$i.$i" \
    -d '{"email":"round4@test.dev","password":"totally-wrong'$i'"}')
  codes="$codes $c"
done
echo "$codes" > $EV/L1.seq
echo "$codes" | grep -q 429 && rec L1 "XFF rotation beats IP bucket; em bucket trips" "429 seen" PASS || rec L1 "XFF rotation" "no 429 in 24" FAIL

# L2 CORS preflight with evil Origin
h=$(curl -s --max-time 8 -D - -o /dev/null -X OPTIONS $BASE/api/auth/me -H "Origin: https://evil.com" -H "Access-Control-Request-Method: GET")
echo "$h" | grep -qi "access-control-allow-origin" && rec L2 "CORS preflight ACAO" "present" CHECK || rec L2 "CORS preflight ACAO" "absent" PASS
# L3 CORS GET with evil Origin (credentials?)
curl -s --max-time 8 -D $EV/L3.h -o /dev/null $BASE/api/auth/me -H "Origin: https://evil.com"
grep -qi "access-control-allow-origin: \*" $EV/L3.h && rec L3 "GET ACAO:*" "wildcard" CHECK || rec L3 "GET ACAO" "absent/echo" PASS
# L4 authorize approve Location header injection (%0d%0a)
curl -s --max-time 8 -D $EV/L4.h -o /dev/null -X POST "$BASE/api/supa-emu/auth/v1/authorize" \
  -H "Origin: null" -H "Sec-Fetch-Site: same-origin" -H "Content-Type: application/x-www-form-urlencoded" \
  -d "provider=google&redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fx%0d%0aSet-Cookie%3A hacked%3D1"
grep -qi "set-cookie: hacked" $EV/L4.h && rec L4 "Location CRLF injection" "injected" FAIL || rec L4 "Location CRLF injection" "clean" PASS
# L5 approve redirect_to javascript: scheme
curl -s --max-time 8 -D $EV/L5.h -o /dev/null -X POST "$BASE/api/supa-emu/auth/v1/authorize" \
  -H "Origin: null" -H "Sec-Fetch-Site: same-origin" -H "Content-Type: application/x-www-form-urlencoded" \
  -d "provider=google&redirect_to=javascript:alert(1)"
LOC=$(grep -i '^location' $EV/L5.h | tr -d '\r' | awk '{print $2}')
case "$LOC" in javascript:*) rec L5 "js: scheme redirect" "$LOC" FAIL;; *) rec L5 "js: scheme redirect" "${LOC:-none}" PASS;; esac
# L6 authorize approve without challenge (PKCE edge)
c=$(curl -s --max-time 8 -o $EV/L6.raw -w '%{http_code}' -X POST "$BASE/api/supa-emu/auth/v1/authorize" \
  -H "Origin: null" -H "Sec-Fetch-Site: same-origin" -H "Content-Type: application/x-www-form-urlencoded" -d "provider=google")
rec L6 "approve w/o challenge" "$c" INFO
# L7 verify token 100KB
c=$(curl -s --max-time 8 -o /dev/null -w '%{http_code}' "$BASE/api/auth/verify?token=$(python3 -c 'print("x"*100000)')")
rec L7 "verify 100KB token" "$c" "$([ "$c" = 400 ] || [ "$c" = 302 ] || [ "$c" = 414 ] && echo PASS || echo CHECK)"
# L8 zero-width name signup
c=$(curl -s --max-time 8 -o $EV/L8.raw -w '%{http_code}' -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -d '{"name":"​‍​ab","email":"zw@test.dev","password":"whatever123","locale":"en"}')
rec L8 "zero-width joiner name" "$c" INFO
# L9 signup locale injection
c=$(curl -s --max-time 8 -o $EV/L9.raw -w '%{http_code}' -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -d '{"name":"Loc Test","email":"loctest@test.dev","password":"whatever123","locale":"../../etc"}')
rec L9 "signup locale traversal" "$c" INFO
# L10 100 cookies header
CK=$(python3 -c "print('; '.join('c%d=v'%i for i in range(100)))")
c=$(curl -s --max-time 8 -o /dev/null -w '%{http_code}' -H "Cookie: $CK" $BASE/api/content/worlds)
rec L10 "100-cookie header" "$c" INFO
# L11 10KB query string
c=$(curl -s --max-time 8 -o /dev/null -w '%{http_code}' "$BASE/api/i18n?q=$(python3 -c 'print("a"*10000)')")
rec L11 "10KB query" "$c" INFO
# L12 unicode locale path
c=$(curl -s --max-time 8 -o /dev/null -w '%{http_code}' "$BASE/%CA%BB/welcome")
rec L12 "unicode locale path" "$c" INFO
# L13 anon AI burst 11x (10/min IP)
seq=""
for i in $(seq 1 11); do
  c=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' -X POST $BASE/api/ai/chat -H 'Content-Type: application/json' \
    -d '{"messages":[{"role":"user","content":"hi '$i'"}]}')
  seq="$seq $c"
done
echo "$seq" > $EV/L13.seq
echo "$seq" | grep -q 429 && rec L13 "AI guest 10/min ceiling" "429 on 11th" PASS || rec L13 "AI guest ceiling" "$seq" FAIL
# L14 stored XSS in journal title (owner-scoped)
c=$(curl -s --max-time 8 -b $R4 -o $EV/L14.raw -w '%{http_code}' -X POST $BASE/api/psych/journal -H 'Content-Type: application/json' \
  -d '{"title":"<img src=x onerror=alert(1)>","content":"xss probe entry"}')
grep -q "onerror" $EV/L14.raw && rec L14 "journal XSS stored raw" "echoed raw" INFO || rec L14 "journal XSS stored" "$c" PASS
# L15 devices icon allowlist
c=$(curl -s --max-time 8 -b $R4 -o $EV/L15.raw -w '%{http_code}' -X PATCH $BASE/api/devices/$(python3 -c "import json;d=json.load(open('/tmp/round4/G4.raw'));items=d if isinstance(d,list) else d.get('devices',[]);print(items[0]['id'])" 2>/dev/null || echo "00000000-0000-0000-0000-000000000000") \
  -H 'Content-Type: application/json' -d '{"icon":"javascript:alert(1)"}')
rec L15 "device icon allowlist" "$c" INFO
# L16 Accept: text/html on JSON API
curl -s --max-time 8 -D $EV/L16.h -o $EV/L16.raw $BASE/api/health -H "Accept: text/html"
grep -qi "nosniff" $EV/L16.h && rec L16 "nosniff with Accept html" "present" PASS || rec L16 "nosniff" "missing" FAIL
# L17 health no-store
grep -qi "cache-control: no-store" $EV/L16.h && rec L17 "API no-store" "present" PASS || rec L17 "API no-store" "missing" FAIL
# L18 profile_patch name charset roundtrip
c=$(curl -s --max-time 8 -b $R4 -o $EV/L18.raw -w '%{http_code}' -X PATCH $BASE/api/me/profile -H 'Content-Type: application/json' \
  -d '{"full_name":"Round ﬁ𝕏𝕏\u0001 Four"}')
rec L18 "name control-char patch" "$c" INFO
# L19 mood very long note
c=$(curl -s --max-time 8 -b $R4 -o /dev/null -w '%{http_code}' -X POST $BASE/api/psych/mood -H 'Content-Type: application/json' \
  -d "{\"score\":3,\"note\":\"$(python3 -c 'print("B"*70000)')\"}")
rec L19 "mood 70KB note" "$c" INFO
# L20 worlds filter param abuse (?select=*)
c=$(curl -s --max-time 8 -o $EV/L20.raw -w '%{http_code}' "$BASE/api/content/worlds?select=*&limit=1")
python3 -c "
import json
d=json.load(open('$EV/L20.raw'))
items=d if isinstance(d,list) else d.get('items',d.get('worlds',[]))
print('ok' if items else 'empty')" > $EV/L20.v 2>/dev/null || echo parse-err > $EV/L20.v
rec L20 "worlds select/limit" "$c/$(cat $EV/L20.v)" INFO

echo "════ BATCH L ════"
printf '%-4s %-46s %-12s %-8s\n' ID EXPECTED CODE VERDICT
for r in "${ROWS[@]}"; do echo "$r"; done
echo "checks: ${#ROWS[@]}  FAIL: $(printf '%s\n' "${ROWS[@]}" | grep -c FAIL)"
