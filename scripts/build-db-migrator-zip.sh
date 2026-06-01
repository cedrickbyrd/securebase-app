#!/usr/bin/env bash
set -euo pipefail
OUT="files/phase6/db_migrator.zip"
TMP=$(mktemp -d)
cp phase6-backend/functions/db_migrator.py "$TMP/db_migrator.py"
pip install psycopg2-binary --target "$TMP" --quiet --no-cache-dir
mkdir -p "$TMP/migrations"
for f in phase6-backend/database/migrations/*.sql; do cp "$f" "$TMP/migrations/"; done
mkdir -p files/phase6
(cd "$TMP" && zip -r - .) > "$OUT"
rm -rf "$TMP"
echo "[build] done: $OUT ($(du -sh $OUT | cut -f1))"
