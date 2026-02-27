#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"
APP_USER="${APP_USER:-seo}"
FORCE_DEPLOY="${FORCE_DEPLOY:-0}"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD || echo main)"
if [[ "${CURRENT_BRANCH}" != "main" ]]; then
  git checkout main
fi

git fetch origin main
LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse origin/main)"
CHANGED="0"

if [[ "${LOCAL_SHA}" != "${REMOTE_SHA}" ]]; then
  git reset --hard origin/main
  CHANGED="1"
fi

if [[ "${CHANGED}" != "1" && "${FORCE_DEPLOY}" != "1" ]]; then
  echo "no changes"
  exit 0
fi

if [[ ! -d ".venv" ]]; then
  python3 -m venv .venv
fi

.venv/bin/pip install --upgrade pip
if [[ -f "requirements.txt" ]]; then
  .venv/bin/pip install -r requirements.txt
fi

if id -u "${APP_USER}" >/dev/null 2>&1; then
  chown -R "${APP_USER}:${APP_USER}" "${ROOT_DIR}"
fi

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q '^seo_wibe.service'; then
  systemctl restart seo_wibe
  systemctl is-active --quiet seo_wibe
fi

if systemctl list-unit-files | grep -q '^seo_wibe.service'; then
  curl -fsS --max-time 15 "http://127.0.0.1:8016/" >/dev/null
fi
echo "deploy ok: ${REMOTE_SHA}"
