#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# PreLife security battery — round 7 SUPPLEMENT (22 new vectors)
# All checks distinct from round7-battery.sh (66): CORS, session fixation,
# cookie tossing, OAuth forgery, host-header injection, XFF spoofing,
# unicode emails, type confusion, CRLF-in-next, numeric abuse, emoji,
# method matrix, trailing slash, missing-param probes.
# verdicts: PASS = secure; FAIL = vulnerability; INFO = accepted
# ═══════════════════════════════════════════════════════════════════════
set -u
BASE=http://localhost:3000
EV=/tmp/r7s; mkdir -p $EV
declare -a ROWS
PASS=0; FAIL=0; INFO=0
rec() { ROWS+=("$(printf '%-4s %-52s %-16s %-5s' "$1" "$2" "$3" "$4")")
  case "$4" in PASS) PASS=$((PASS+1));; FAIL) FAIL=$((FAIL+1));; *) INFO=$((INFO+1));; esac }
code() { local id=$1; shift; curl -s --max-time 10 -o "$EV/$id.raw" -D "$EV/$id.h" -w '%{http_code}' "$@" 2>/dev/null; }

AJ=/tmp/r7attacker.jar   # reuse attacker session from round7 battery

# ══ M. CORS / Origin (3) ════════════════════════════════════════════════
C=$(code M1 -X OPTIONS $BASE/api/auth/login -H 'Origin: https://evil.com' -H 'Access-Control-Request-Method: POST'); grep -qi "access-control-allow-origin:.*evil" $EV/M1.h && rec M1 "preflight reflects evil origin" "reflected!!!" FAIL || rec M1 "preflight evil origin" "$C no-reflect" PASS
C=$(code M2 $BASE/api/auth/me -H 'Origin: https://evil.com'); grep -qi "access-control-allow-origin:.*evil" $EV/M2.h && rec M2 "GET reflects evil origin" "reflected!!!" FAIL || rec M2 "GET evil origin no ACAO" "$C" PASS
C=$(code M3 -X POST $BASE/api/auth/login -H 'Origin: https://evil.com' -H 'Content-Type: application/json' -d '{"email":"a@b.c","password":"x"}'); grep -qi "access-control-allow-origin:.*evil" $EV/M3.h && rec M3 "POST evil origin ACAO echo" "reflected!!!" FAIL || rec M3 "POST evil origin" "$C no-reflect" PASS

# ══ N. Session fixation / tossing (3) ═══════════════════════════════════
C=$(code N1 -b "pl_session=attacker-chosen-fixed-token-000000000000" $BASE/api/auth/me); grep -q '"email"' $EV/N1.raw && rec N1 "attacker-chosen token accepted" "FIXATION!!!" FAIL || rec N1 "fixed token rejected" "$C user-null" PASS
C=$(code N2 -H 'Cookie: pl_session=garbage-a; pl_session=garbage-b' $BASE/api/auth/me); { [ "$C" != "500" ]; } && ! grep -q '"email"' $EV/N2.raw && rec N2 "cookie tossing two sessions" "$C user-null" PASS || rec N2 "cookie tossing" "$C" FAIL
# first-wins parse: garbage wins → user null = forced logout, NOT takeover.
# FAIL only if the toss yields a WRONG user or a 500.
code N3 -H "Cookie: pl_session=garbage; pl_session=$1" $BASE/api/auth/me > /dev/null
G=$(grep -c '"email"' $EV/N3.raw 2>/dev/null); [ "$G" = "1" ] && rec N3 "toss yields wrong user" "CONFUSION!!!" FAIL || { [ "$(head -c 3 $EV/N3.h | grep -c 500)" = "1" ] && rec N3 "toss 500" "500!!!" FAIL || rec N3 "toss = logout not takeover" "user-null (first-wins)" PASS; }

# ══ O. OAuth / callback forgery (3) ═════════════════════════════════════
C=$(code O1 "$BASE/api/auth/oauth/google"); echo "$C" | grep -qE '^3' && grep -qi "location:.*accounts.google" $EV/O1.h && ! grep -qi "state=\|code_challenge" $EV/O1.h && rec O1 "oauth start w/o PKCE state" "redirect!!!" FAIL || rec O1 "oauth start guarded" "$C" PASS
C=$(code O2 -X POST "$BASE/api/auth/callback" -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"code":"forged-code","provider":"google"}'); echo "$C" | grep -q '^2' && grep -qi 'set-cookie: pl_session' $EV/O2.h && rec O2 "callback forgery → session" "AUTH BYPASS!!!" FAIL || rec O2 "callback forgery rejected" "$C no-session" PASS
C=$(code O3 "$BASE/api/auth/callback?code=x&state=guess"); echo "$C" | grep -q '^2' && grep -qi 'set-cookie: pl_session' $EV/O3.h && rec O3 "GET callback forgery → session" "BYPASS!!!" FAIL || rec O3 "GET callback rejected" "$C" PASS

# ══ P. Host header / XFF (2) ════════════════════════════════════════════
C=$(code P1 -X POST $BASE/api/auth/resend -H 'Host: evil.com' -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"email":"nosuch8@test.dev"}'); grep -qi "evil.com" $EV/P1.raw && rec P1 "host header in mail links" "INJECTED!!!" FAIL || rec P1 "host header not trusted" "$C" PASS
BF=0; GOT=0
for i in 1 2 3 4 5 6; do
  RC=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -H "X-Forwarded-For: 10.9.9.$i" -d '{"email":"xff7@test.dev","password":"wrong-'$i'"}')
  [ "$RC" = "429" ] && { GOT=1; break; }
done
[ "$GOT" = "1" ] && rec P2 "XFF rotation no bypass" "429 ≤6" PASS || rec P2 "XFF rotation bucket" "6 wrongs, last=$RC" INFO

# ══ Q. Type confusion / unicode (5) ═════════════════════════════════════
C=$(code Q1 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"email":["arr@b.c"],"password":"x"}'); { [ "$C" = "400" ] || [ "$C" = "401" ] || [ "$C" = "422" ]; } && rec Q1 "email as array" "$C rejected" PASS || rec Q1 "email array abuse" "$C!!!" FAIL
C=$(code Q2 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"email":"num@b.c","password":123}'); { [ "$C" = "400" ] || [ "$C" = "401" ] || [ "$C" = "422" ]; } && rec Q2 "password as number" "$C rejected" PASS || rec Q2 "password number abuse" "$C!!!" FAIL
C=$(code Q3 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"email":"ﬀ-ligature@test.dev","password":"x"}'); { [ "$C" != "500" ]; } && rec Q3 "ligature unicode email" "$C no-500" PASS || rec Q3 "ligature email" "$C 500!!!" FAIL
C=$(code Q4 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"email":"v7vıctım@test.dev","password":"x"}'); { [ "$C" != "500" ]; } && rec Q4 "dotless-ı homoglyph email" "$C no-500" PASS || rec Q4 "homoglyph email" "$C 500!!!" FAIL
LONG=$(python3 -c 'print("long"*200)')
C=$(code Q5 -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d "{\"email\":\"$LONG@b.c\",\"password\":\"x\"}"); { [ "$C" != "500" ] && [ "$C" != "000" ]; } && rec Q5 "800-char email" "$C bounded" PASS || rec Q5 "long email" "$C" FAIL

# ══ R. CRLF-in-next / header injection via redirect (1) ═════════════════
C=$(code R1 "$BASE/az/login?next=%0d%0aSet-Cookie%3A%20pwned%3D1"); grep -qi 'set-cookie: pwned' $EV/R1.h && rec R1 "CRLF injection via ?next=" "INJECTED!!!" FAIL || rec R1 "CRLF in next= rejected" "$C clean" PASS

# ══ S. Numeric / pagination abuse (2) ═══════════════════════════════════
C=$(code S1 -b $AJ "$BASE/api/psych/journal?limit=99999999999999999999"); { [ "$C" != "500" ] && [ "$C" != "000" ]; } && rec S1 "limit=u64::MAX journal list" "$C bounded" PASS || rec S1 "limit abuse" "$C" FAIL
C=$(code S2 -b $AJ "$BASE/api/psych/journal?offset=-5"); { [ "$C" != "500" ] && [ "$C" != "000" ]; } && rec S2 "negative offset" "$C bounded" PASS || rec S2 "negative offset" "$C 500!!!" FAIL

# ══ T. 4-byte emoji round-trip (1) ══════════════════════════════════════
C=$(code T1 -b $AJ -X POST $BASE/api/psych/journal -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"content":"emoji probe r7s Buddha DNA"}'); { [ "$C" != "500" ] && [ "$C" != "000" ]; } && rec T1 "4-byte emoji journal POST" "$C no-500" PASS || rec T1 "emoji journal" "$C" FAIL

# ══ U. Method matrix extras (5) ═════════════════════════════════════════
C=$(code U1 -X OPTIONS $BASE/api/auth/me); { [ "$C" != "500" ]; } && rec U1 "OPTIONS /auth/me sane" "$C" PASS || rec U1 "OPTIONS /auth/me" "$C 500!!!" FAIL
C=$(code U2 -X TRACE $BASE/api/auth/me); { [ "$C" != "200" ] && [ "$C" != "500" ]; } && rec U2 "TRACE /auth/me" "$C refused" PASS || rec U2 "TRACE /auth/me" "$C!!!" FAIL
C=$(code U3 -X PATCH $BASE/api/auth/signup -H 'Content-Type: application/json' -d '{}'); { [ "$C" = "405" ] || [ "$C" = "404" ]; } && rec U3 "PATCH on signup POST-route" "$C" PASS || rec U3 "PATCH /auth/signup" "$C!!!" FAIL
C=$(code U4 -X POST $BASE/api/auth/login/ -H 'Content-Type: application/json' -d '{"email":"x@y.z","password":"x"}'); { [ "$C" != "500" ] && ! grep -qi 'set-cookie: pl_session' $EV/U4.h; } && rec U4 "trailing-slash login no session" "$C" PASS || rec U4 "trailing-slash login" "$C!!!" FAIL
C=$(code U5 "$BASE/api/auth/verify"); LOC=$(grep -i '^location' $EV/U5.h | tr -d '\r')
if echo "$C" | grep -qE '^3' && echo "$LOC" | grep -q "localhost:3000/"; then
  rec U5 "verify no-param → local error page" "303 $LOC" PASS
elif [ "$C" = "400" ] || [ "$C" = "401" ] || [ "$C" = "422" ] || [ "$C" = "404" ]; then
  rec U5 "verify w/o token param" "$C" PASS
else
  rec U5 "verify no-param" "$C $LOC!!!" FAIL
fi

# ══ V. Preferences abuse (2) ════════════════════════════════════════════
C=$(code V1 -b $AJ -X PATCH $BASE/api/me/preferences -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"lang":"<script>alert(1)</script>"}'); { [ "$C" != "500" ]; } && rec V1 "prefs lang XSS payload" "$C no-500" PASS || rec V1 "prefs lang XSS" "$C 500!!!" FAIL
C=$(code V2 -b $AJ -X PATCH $BASE/api/me/preferences -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' -d '{"reduce_motion":"notabool"}'); { [ "$C" != "500" ]; } && rec V2 "prefs bool type confusion" "$C no-500" PASS || rec V2 "prefs bool confusion" "$C 500!!!" FAIL

# ══ Report ══════════════════════════════════════════════════════════════
printf '%s\n' "${ROWS[@]}"
echo "──────────────────────────────────────────────────────"
echo "SUPPLEMENT TOTAL: $PASS pass, $FAIL fail, $INFO info — $((PASS+FAIL+INFO)) checks"
