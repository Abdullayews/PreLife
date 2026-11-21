#!/usr/bin/env bash
# Round 4 setup: two independent sessions (attacker=round4, victim=victim2)
# + a journal entry owned by victim2 (for cross-user IDOR probes).
set -u
BASE=http://localhost:3000

jq_get() { python3 -c "import sys,json;print(json.load(sys.stdin).get('$1',''))"; }

# ── victim2 session ─────────────────────────────────────────────────────
DL=$(curl -s -X POST $BASE/api/auth/signup -H 'Content-Type: application/json' \
  -d '{"name":"Victim Two","email":"victim2@test.dev","password":"v2-Secret-Passw0rd!","locale":"en"}' | jq_get devLink)
[ -z "$DL" ] && { echo "FAIL: no devLink for victim2"; exit 1; }
# strip the gateway transform param for a clean verify hit
DL=${DL%%&XTransformPort*}
curl -s -c /tmp/v2cookies.txt -o /dev/null "$DL"
R=$(curl -s -b /tmp/v2cookies.txt -c /tmp/v2cookies.txt -X POST $BASE/api/auth/complete \
  -H 'Content-Type: application/json' -d '{"name":"Victim Two","password":"v2-Secret-Passw0rd!"}')
echo "victim2 complete: $R"

# victim2 owns a journal entry
JID=$(curl -s -b /tmp/v2cookies.txt -X POST $BASE/api/psych/journal \
  -H 'Content-Type: application/json' -d '{"title":"secret entry","content":"victim2 private thoughts"}' | jq_get id)
echo "victim2 journal id: $JID"

# victim2 devices list (for device-id IDOR)
DEVID=$(curl -s -b /tmp/v2cookies.txt $BASE/api/devices | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d if isinstance(d,list) else d.get('devices',d.get('items',[]))
print(items[0]['id'] if items else '')")
echo "victim2 device id: $DEVID"

echo "V2JID=$JID"    > /tmp/round4-vars
echo "V2DEVID=$DEVID" >> /tmp/round4-vars
echo "setup done"
