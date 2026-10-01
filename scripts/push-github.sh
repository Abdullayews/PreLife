#!/bin/sh
# Push the PreLife repo (branch main) to GitHub.
#
# Usage:
#   GH_TOKEN=<your-PAT> scripts/push-github.sh https://github.com/<you>/<repo>.git
#
# The token is read from the environment at runtime only — it is never written
# to any file, to git config, or into the remote URL. Use a fine-grained PAT
# scoped to this one repo with "Contents: read and write"; revoke it after the
# push if you like.
set -eu

REMOTE="${1:?usage: GH_TOKEN=<PAT> scripts/push-github.sh https://github.com/<you>/<repo>.git}"
[ -n "${GH_TOKEN:-}" ] || { echo "error: GH_TOKEN is not set"; exit 1; }

git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE"

GH_TOKEN="$GH_TOKEN" git -c credential.helper='!f() { test "$1" = get && { echo "username=x-access-token"; echo "password=$GH_TOKEN"; } ; }; f' push -u origin main

echo "pushed main -> $REMOTE"
