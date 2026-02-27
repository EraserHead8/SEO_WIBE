#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/EraserHead8/SEO_WIBE.git}"
APP_DIR="${APP_DIR:-/opt/seo_wibe}"
APP_USER="${APP_USER:-seo}"
APP_PORT="${APP_PORT:-8016}"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y git python3 python3-venv python3-pip nginx ufw curl

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/${APP_USER}" --shell /usr/sbin/nologin "${APP_USER}"
fi

if [[ ! -d "${APP_DIR}/.git" ]]; then
  rm -rf "${APP_DIR}"
  git clone "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"
git fetch origin main
git checkout main
git reset --hard origin/main

chmod +x scripts/deploy_server.sh || true
APP_USER="${APP_USER}" FORCE_DEPLOY=1 scripts/deploy_server.sh

cat >/etc/systemd/system/seo_wibe.service <<SERVICE
[Unit]
Description=SEO WIBE FastAPI service
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=PYTHONUNBUFFERED=1
ExecStart=${APP_DIR}/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${APP_PORT}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICE

cat >/etc/systemd/system/seo_wibe-autodeploy.service <<AUTODEPLOYSVC
[Unit]
Description=SEO WIBE auto-deploy check
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${APP_DIR}
ExecStart=${APP_DIR}/scripts/deploy_server.sh
AUTODEPLOYSVC

cat >/etc/systemd/system/seo_wibe-autodeploy.timer <<AUTODEPLOYTIMER
[Unit]
Description=Run SEO WIBE auto-deploy every minute

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
Unit=seo_wibe-autodeploy.service

[Install]
WantedBy=timers.target
AUTODEPLOYTIMER

cat >/etc/nginx/sites-available/seo_wibe <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
    }
}
NGINX

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/seo_wibe /etc/nginx/sites-enabled/seo_wibe

systemctl daemon-reload
systemctl enable --now seo_wibe
systemctl enable --now nginx
systemctl enable --now seo_wibe-autodeploy.timer
nginx -t
systemctl restart nginx

ufw allow OpenSSH || true
ufw allow "Nginx Full" || true
ufw allow ${APP_PORT}/tcp || true
ufw --force enable || true

systemctl restart seo_wibe
systemctl status seo_wibe --no-pager -l || true
systemctl status seo_wibe-autodeploy.timer --no-pager -l || true

curl -fsS --max-time 20 "http://127.0.0.1:${APP_PORT}/" >/dev/null
echo "setup complete"
