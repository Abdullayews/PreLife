#!/usr/bin/env bash
# sandbox-restore.sh — rebuild the dev runtime after a sandbox wipe.
#
# A sandbox reset keeps the repo (tracked files) but removes untracked
# runtime state (~/.cargo, db/emu-store.json, .env extras, .loop-*) and
# /tmp. This script recreates everything the loop needs. It reads
# credentials from .loop-secrets.json in the repo root — if that file is
# ALSO gone, first recreate it from the durable cron vault:
#   cron tool → action=list  → job "PreLife credential vault" (payload
#   holds every key; write it back to .loop-secrets.json), then re-run.
#
# Usage:  bash scripts/sandbox-restore.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[restore] 0/5 git identity"
git config user.name  "Abdullayews"
git config user.email "08abdullayevv@gmail.com"

SECRETS=.loop-secrets.json
[ -f "$SECRETS" ] || {
  echo "ERROR: $SECRETS missing — recover it from the cron vault job"
  echo "       ('PreLife credential vault') and re-run."
  exit 1
}
gh_token=$(python3 -c "import json;print(json.load(open('$SECRETS'))['git']['token'])")
gemini_key=$(python3 -c "import json;print(json.load(open('$SECRETS'))['gemini']['api_key'])")

echo "[restore] 1/5 .loop-token"
printf '%s' "$gh_token" > .loop-token && chmod 600 .loop-token

echo "[restore] 2/5 .env (emulator mode — sandbox never touches real Supabase)"
cat > .env <<EOF
DATABASE_URL=file:$(pwd)/db/custom.db
SUPABASE_EMU=1
PUBLIC_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
API_TRANSFORM_PORT=3030
NEXT_PUBLIC_API_TRANSFORM_PORT=3030
API_INTERNAL_URL=http://127.0.0.1:3030
MAIL_FROM=PreLife <no-reply@prelife.net>
GEMINI_API_KEY=$gemini_key
GEMINI_MODEL=gemini-flash-lite-latest
EOF

echo "[restore] 3/5 .loop-state.json (if missing)"
if [ ! -f .loop-state.json ]; then
  cat > .loop-state.json <<'EOF'
{
  "phase": "security",
  "iteration": 1,
  "cleanStreak": 0,
  "securityRound": 1,
  "cleanSecurityStreak": 0,
  "history": [],
  "notes": "Fresh state after sandbox wipe (scripts/sandbox-restore.sh). Previous rounds are in git history (git log --oneline | grep 'loop iter'). Continue the security battery; cleanSecurityStreak >= 2 → done + delete the cron loop job."
}
EOF
fi

echo "[restore] 4/5 Rust toolchain"
if ! command -v cargo >/dev/null 2>&1 && [ ! -x "$HOME/.cargo/bin/cargo" ]; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --profile minimal --default-toolchain stable
fi

echo "[restore] 5/5 dev stack (backend :3030 + next :3000)"
if ! curl -s --max-time 2 http://127.0.0.1:3030/api/health >/dev/null 2>&1; then
  ( setsid bash -c 'cd /home/z/my-project && exec bun run dev' \
      </dev/null >>/tmp/dev-relaunch.log 2>&1 & )
  echo "        started in background (cargo build takes a few minutes on a"
  echo "        wiped toolchain) — poll: curl -s http://127.0.0.1:3030/api/health"
else
  echo "        already running"
fi

echo "[restore] done. Sanity checks:"
echo "  curl -s http://127.0.0.1:3030/api/health"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' http://localhost:3000/"
echo "  scripts/functional-battery.sh   (35 checks)"
