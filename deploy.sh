#!/usr/bin/env bash
# Redeploy TestExpress on this VPS: pull latest, rebuild frontend, restart backend.
#
# Assumes the one-time setup described in the deployment runbook is already
# done: Postgres reachable via DATABASE_URL, src/Backend/.env populated,
# `npx playwright install --with-deps` run once, Nginx pointed at ./build,
# and the backend already registered with PM2 as "testexpress-backend"
# (first run: `pm2 start src/Backend/ecosystem.config.js`).
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Pulling latest code"
git pull

echo "==> Installing frontend dependencies"
npm install

echo "==> Building frontend"
npm run build

echo "==> Installing backend dependencies"
npm --prefix src/Backend install

echo "==> Running database migrations"
npm --prefix src/Backend run db:migrate

echo "==> Restarting backend"
pm2 restart testexpress-backend

echo "==> Done. Backend status:"
pm2 status testexpress-backend
