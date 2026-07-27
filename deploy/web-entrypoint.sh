#!/bin/sh
set -eu
cd /app
echo "[web] prisma migrate deploy..."
npx prisma migrate deploy
echo "[web] starting next on :3000..."
exec npx next start -H 0.0.0.0 -p 3000
