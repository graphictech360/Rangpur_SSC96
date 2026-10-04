#!/usr/bin/env bash
# ডেমো সার্ভার চালু/পুনরায় চালু (পরীক্ষার জন্য) — পুরোনোটা বন্ধ করে নতুন করে চালায়
set -u
cd "$(dirname "$0")/.." || exit 1
PORT="${PORT:-3312}"
pids=$(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u)
for p in $pids; do kill "$p" 2>/dev/null; done
sleep 1
rm -f data/demo-store.json   # পরীক্ষা শুরুর আগে ডেমো ডেটা পরিষ্কার
DATA_MODE=demo PORT="$PORT" SESSION_SECRET=test-secret-1234567890123456789012 APP_ORIGIN="http://127.0.0.1:$PORT" \
  nohup node server/index.mjs > "/tmp/demo$PORT.log" 2>&1 &
for _ in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/api/site" || true)
  [ "$code" = "200" ] && { echo "ডেমো সার্ভার চালু: http://127.0.0.1:$PORT (data: demo)"; exit 0; }
  sleep 1
done
echo "সার্ভার চালু হয়নি — লগ দেখুন: /tmp/demo$PORT.log" >&2
exit 1
