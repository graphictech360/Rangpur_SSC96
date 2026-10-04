#!/usr/bin/env bash
# ডেমো + অফলাইন প্রিভিউ: ডিপেন্ডেন্সি, ব্রাউজার, বিল্ড ও সব পরীক্ষা এক ধাপে।
# ব্যবহার: bash scripts/offline-checks.sh  [--with-system-deps]
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--with-system-deps" ]]; then
  sudo -n apt-get update -qq
  sudo -n apt-get install -y -qq \
    libnspr4 libnss3 libasound2t64 libatk1.0-0t64 libatk-bridge2.0-0t64 \
    libcups2t64 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2
fi

echo "== ডিপেন্ডেন্সি =="
[ -d node_modules ] || npm ci --no-audit --no-fund

echo "== হেডলেস ব্রাউজার =="
[ -d "$HOME/.cache/ms-playwright" ] || npx playwright install chromium

echo "== ইউনিট/SQL পরীক্ষা =="
npm test

echo "== প্রোডাকশন বিল্ড =="
npm run build 2>&1 | tail -2

echo "== অফলাইন প্রিভিউ বিল্ড =="
npm run preview:build

echo "== অফলাইন প্রিভিউ পরীক্ষা =="
npm run preview:test

echo "সব ঠিক আছে ✅"
