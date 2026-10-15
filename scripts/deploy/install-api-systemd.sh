#!/bin/bash
# Run on the target EC2 host as root, with a tested Linux binary and its source commit.
set -euo pipefail
if [ "$(id -u)" != 0 ] || [ "$#" != 4 ]; then
  echo "Usage (root): install-api-systemd.sh BINARY RELEASE_ID AUTHOR_ID UNIT_FILE" >&2
  exit 1
fi
binary=$(realpath "$1")
release_id=$2
author=$3
unit=$(realpath "$4")
[[ "$release_id" =~ ^[a-f0-9]{7,40}$ ]] || { echo 'Invalid release commit' >&2; exit 1; }
[[ "$author" =~ ^[A-Za-z0-9._:-]{1,128}$ ]] || { echo 'Invalid author ID' >&2; exit 1; }
test -f "$binary" && test -f "$unit"
id writer-agent >/dev/null 2>&1 || useradd --system --user-group --home-dir /var/lib/writer-agent --shell /usr/sbin/nologin writer-agent
install -d -m 0755 /opt/writer-agent/releases /srv/writer-agent/harness
install -d -m 0750 -o root -g writer-agent /etc/writer-agent
install -d -m 0700 -o writer-agent -g writer-agent /var/lib/writer-agent
install -d -m 0700 /var/backups/writer-agent
backup=$(mktemp -d /var/backups/writer-agent/deploy-XXXXXXXX)
chmod 0700 "$backup"
previous=$(readlink -f /opt/writer-agent/current || true)
release=/opt/writer-agent/releases/$release_id
if [ -e "$release" ]; then
  cmp "$binary" "$release/writer-agent-api" || { echo 'Release ID already contains a different binary' >&2; exit 1; }
fi
rollback() {
  result=$?
  if [ "$result" -ne 0 ] && [ -n "$previous" ] && [ -x "$previous/writer-agent-api" ]; then
    systemctl stop writer-agent-api || true
    ln -sfn "$previous" /opt/writer-agent/current.rollback
    mv -Tf /opt/writer-agent/current.rollback /opt/writer-agent/current
    if [ -f "$backup/writer-agent-api.service" ]; then
      cp "$backup/writer-agent-api.service" /etc/systemd/system/writer-agent-api.service
    fi
    systemctl daemon-reload
    systemctl start writer-agent-api || true
    echo "Restored previous binary without replacing application data: $previous" >&2
  fi
}
trap rollback EXIT
if systemctl is-active --quiet writer-agent-api; then systemctl stop writer-agent-api; fi
# Snapshot only after all API writers have stopped. Never replace state when rolling back binaries.
tar -C /var/lib -czf "$backup/state.tar.gz" writer-agent
[ ! -d /etc/writer-agent ] || cp -a /etc/writer-agent "$backup/config"
[ ! -f /etc/systemd/system/writer-agent-api.service ] || cp -a /etc/systemd/system/writer-agent-api.service "$backup/"
printf '%s\n' "$previous" > "$backup/previous-release"
if [ ! -e /etc/writer-agent/auth-token ]; then
  python3 - <<'PY'
import os,secrets
p='/etc/writer-agent/auth-token'
fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f: f.write(secrets.token_hex(32)+'\n')
PY
  chown root:writer-agent /etc/writer-agent/auth-token
  chmod 0640 /etc/writer-agent/auth-token
fi
if [ ! -e /etc/writer-agent/api.env ]; then
  umask 077
  cat > /etc/writer-agent/api.env <<ENV
WRITER_AGENT_ENV=production
WRITER_AGENT_AUTH_MODE=bearer
WRITER_AGENT_AUTH_TOKEN_FILE=/etc/writer-agent/auth-token
WRITER_AGENT_AUTHOR_ID=$author
WRITER_AGENT_PROJECT_ID=local
WRITER_AGENT_API_HOST=127.0.0.1
WRITER_AGENT_API_PORT=8787
WRITER_AGENT_HARNESS_ROOT=/srv/writer-agent/harness
WRITER_AGENT_STATE_DIR=/var/lib/writer-agent
ENV
fi
if [ ! -e "$release" ]; then
  install -d -m 0755 "$release"
  install -m 0755 "$binary" "$release/writer-agent-api"
fi
install -m 0644 "$unit" /etc/systemd/system/writer-agent-api.service
ln -sfn "$release" /opt/writer-agent/current.next
mv -Tf /opt/writer-agent/current.next /opt/writer-agent/current
systemctl daemon-reload
systemctl enable --now writer-agent-api
for attempt in $(seq 1 20); do
  if curl -fsS --max-time 2 http://127.0.0.1:8787/healthz >/dev/null; then
    echo "API healthy. Release: $release_id; backup: $backup"
    exit 0
  fi
  sleep 1
done
echo "API failed health check. Previous release: $previous; backup: $backup" >&2
# Do not restore an old snapshot over newer writes. Operator can repoint current to previous.
exit 1
