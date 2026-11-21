#!/usr/bin/env bash
# Functional battery v5.3 — "all functions work" verification.
# Runs against :3000 (the same /api/* proxy path production uses).
set -u
B="http://127.0.0.1:3000/api"
EM="functest-$(date +%s)@test.dev"
PW="Ft-Secret-Passw0rd!"
JAR=/tmp/func-jar.txt
PASS=0; FAIL=0; FAILED_ITEMS=""

code() { PASS=$((PASS+1)); echo "  PASS $1"; }
bad()  { FAIL=$((FAIL+1)); FAILED_ITEMS="$FAILED_ITEMS $1"; echo "  FAIL $1  <<<<"; }
c()    { curl -s --max-time 10 "$@"; }
cj()   { curl -s --max-time 10 -b "$JAR" -c "$JAR" "$@"; }
jget() { python3 -c "
import sys,json
d=json.load(sys.stdin)
v=d$1
print(v if isinstance(v,str) else json.dumps(v))
" 2>/dev/null; }
# json.dumps(True) is "true" (lowercase) — compare accordingly.

echo "== 1. Health & content & i18n (public) =="
[ "$(c $B/health | jget "['ok']")" = "true" ] && code "health ok" || bad "health"
[ "$(c "$B/i18n?locale=az" | wc -c)" -gt 10000 ] && code "i18n az catalog" || bad "i18n az"
c $B/content/worlds | jget "['worlds']" >/dev/null 2>&1 && code "content worlds" || bad "content worlds"
c $B/content/gym     | head -c 20 | grep -q "{" && code "content gym" || bad "content gym"
c $B/content/diet    | head -c 20 | grep -q "{" && code "content diet" || bad "content diet"
c $B/content/meditation | head -c 20 | grep -q "{" && code "content meditation" || bad "content meditation"
c $B/content/library | head -c 20 | grep -q "{" && code "content library" || bad "content library"
c $B/content/subscription | head -c 20 | grep -q "{" && code "content subscription" || bad "content subscription"

echo "== 2. Auth: mail-first signup flow =="
ACT=$(c -X POST $B/auth/login -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3000" -d "{\"email\":\"$EM\",\"password\":\"wrong-pass-1\"}" | jget "['action']")
[ "$ACT" = "signup_prefill" ] && code "unknown email → signup_prefill" || bad "unknown email prefill ($ACT)"
DEV=$(c -X POST $B/auth/signup -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3000" -d "{\"name\":\"Func Tester\",\"email\":\"$EM\",\"password\":\"$PW\",\"locale\":\"az\"}" | jget "['devLink']")
[ -n "$DEV" ] && [ "$DEV" != "null" ] && code "signup → devLink" || bad "signup devLink ($DEV)"
VRES=$(c -c /tmp/func-pre.txt "${DEV/localhost:3000/127.0.0.1:3000}" -o /dev/null -w "%{http_code}")
[ "$VRES" = "303" ] || [ "$VRES" = "302" ] || [ "$VRES" = "307" ] && code "verify link → redirect + pre-session" || bad "verify link ($VRES)"
grep -q "pl_session" /tmp/func-pre.txt && code "verify sets pre-session cookie" || bad "verify pre-session"
MEPRE=$(c -b /tmp/func-pre.txt $B/auth/me)
echo "$MEPRE" | grep -q '"email"' && code "auth/me pre-session" || bad "auth/me pre-session ($MEPRE)"
CRES=$(c -b /tmp/func-pre.txt -X POST $B/auth/complete -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3000" -d "{\"name\":\"Func Tester\",\"password\":\"$PW\"}")
echo "$CRES" | grep -q '"ok"' && code "complete → ok" || bad "complete ($CRES)"
LRES=$(c -X POST $B/auth/login -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3000" -c "$JAR" -d "{\"email\":\"$EM\",\"password\":\"$PW\"}")
echo "$LRES" | grep -q '"user"' && code "login → user + session" || bad "login ($LRES)"
grep -q "pl_session" "$JAR" && code "pl_session cookie set" || bad "pl_session cookie"
ME=$(c -b "$JAR" $B/auth/me)
echo "$ME" | grep -q '"email"' && code "auth/me with session" || bad "auth/me ($ME)"
ME2=$(c $B/auth/me)
echo "$ME2" | grep -q '"user":null' && code "auth/me anon → user null" || bad "auth/me anon ($ME2)"

echo "== 3. Account =="
P=$(cj -X PATCH $B/me/profile -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3000" -d '{"name":"Func Tester Updated"}')
echo "$P" | grep -q "Updated" && code "profile PATCH" || bad "profile PATCH ($P)"
PJ=$(cj $B/me/profile); echo "$PJ" | grep -q "Updated" && code "profile GET" || bad "profile GET ($PJ)"
PR=$(cj $B/me/preferences); echo "$PR" | grep -q '"locale"\|preferences' && code "preferences GET" || bad "preferences GET ($PR)"
PRP=$(cj -X PATCH $B/me/preferences -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3000" -d '{"locale":"az"}')
echo "$PRP" | grep -q "az" && code "preferences PATCH" || bad "preferences PATCH ($PRP)"
DV=$(cj $B/devices); echo "$DV" | grep -q '\[' && code "devices list" || bad "devices ($DV)"

echo "== 4. Psych (journal, mood, overview) =="
JID=$(cj -X POST $B/psych/journal -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3000" -d '{"content":"Func test entry <script>alert(1)</script>"}' | jget "['id']")
[ -n "$JID" ] && [ "$JID" != "None" ] && [ "$JID" != "null" ] && code "journal POST" || bad "journal POST"
JL=$(cj $B/psych/journal); echo "$JL" | grep -q "Func test" && code "journal GET" || bad "journal GET"
JD=$(cj -X DELETE $B/psych/journal/$JID); echo "$JD" | grep -q '"ok"\|"deleted"' && code "journal DELETE" || bad "journal DELETE ($JD)"
MO=$(cj -X POST $B/psych/mood -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3000" -d '{"mood":4,"energy":3,"sleepQ":5}')
echo "$MO" | grep -q '"ok"\|"id"\|mood' && code "mood POST" || bad "mood POST ($MO)"
OV=$(cj $B/psych/overview); echo "$OV" | grep -q '{' && code "psych overview" || bad "overview ($OV)"
SW=$(cj "$B/psych/schedule-window"); echo "$SW" | grep -q '{' && code "schedule window" || bad "schedule window ($SW)"

echo "== 5. Gym plan =="
GP=$(cj -X POST $B/gym/plan -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3000" -d '{"goal":"strength","experience":"beginner","days":3,"equipment":"full"}')
echo "$GP" | grep -q '{' && code "gym plan POST" || bad "gym plan POST ($GP)"
GPG=$(cj $B/gym/plan); echo "$GPG" | grep -q '{' && code "gym plan GET" || bad "gym plan GET"

echo "== 6. Subscription =="
SC=$(cj $B/subscription/custom); echo "$SC" | grep -q '{\|\[' && code "subscription custom GET" || bad "sub custom GET ($SC)"
SCP=$(cj -X POST $B/subscription/custom -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3000" -d '{"features":["gym"],"months":1}')
echo "$SCP" | grep -q '{' && code "subscription custom POST" || bad "sub custom POST ($SCP)"

echo "== 7. AI =="
AI=$(c -X POST $B/ai/chat -H 'Content-Type: application/json' -H "Origin: http://127.0.0.1:3000" -d '{"locale":"az","messages":[{"role":"user","content":"Salam, bir sözlü cavab ver"}]}')
echo "$AI" | grep -q '"reply"\|"message"\|"text"' && code "ai chat guest" || bad "ai chat ($AI)"

echo "== 8. Logout =="
LO=$(cj -X POST $B/auth/logout -H "Origin: http://127.0.0.1:3000")
ME3=$(cj $B/auth/me)
echo "$ME3" | grep -q '"user":null' && code "logout → session dead" || bad "logout ($ME3)"

echo
echo "RESULT: $PASS pass, $FAIL fail${FAILED_ITEMS:+ — failed:$FAILED_ITEMS}"
[ $FAIL -eq 0 ]
