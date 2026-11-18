#!/usr/bin/env bash
# Auto-restarting dev runner for the PreLife Rust API (port 3031).
# Rebuilds and restarts whenever a source file changes.
cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:$PATH"

last=""
pid=""

shutdown() {
  [ -n "$pid" ] && kill "$pid" 2>/dev/null
  exit 0
}
trap shutdown INT TERM

while true; do
  sum=$(cat Cargo.toml src/*.rs 2>/dev/null | md5sum | cut -d' ' -f1)
  if [ "$sum" != "$last" ]; then
    if [ -n "$pid" ]; then
      echo "[dev] source changed — restarting"
      kill "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
    fi
    echo "[dev] cargo build…"
    out=$(cargo build 2>&1); rc=$?
    echo "$out" | tail -30
    if [ $rc -eq 0 ] && [ -x target/debug/prelife-api ]; then
      ./target/debug/prelife-api &
      pid=$!
      last="$sum"
      echo "[dev] prelife-api running (pid $pid, port 3031)"
    else
      echo "[dev] build failed — waiting for changes"
    fi
  fi
  sleep 2
done
