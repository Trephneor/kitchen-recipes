#!/usr/bin/env bash
# One-time setup for the public deployment: generates secrets, the Authelia
# configuration and your user account (argon2id-hashed password).
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ] || [ -f authelia/configuration.yml ]; then
  echo "Existing configuration found (.env / authelia/configuration.yml)."
  read -rp "Overwrite and re-generate everything? [y/N] " yn
  case "$yn" in [Yy]*) ;; *) echo "Aborted."; exit 1 ;; esac
fi

command -v docker  >/dev/null || { echo "docker is required";  exit 1; }
command -v openssl >/dev/null || { echo "openssl is required"; exit 1; }

read -rp  "Your domain (e.g. example.com): " DOMAIN
[ -n "$DOMAIN" ] || { echo "A domain is required."; exit 1; }
read -rp  "Hostname for the app          [recipes.$DOMAIN]: " RECIPES_HOST
RECIPES_HOST=${RECIPES_HOST:-recipes.$DOMAIN}
read -rp  "Hostname for the login portal [auth.$DOMAIN]: " AUTH_HOST
AUTH_HOST=${AUTH_HOST:-auth.$DOMAIN}
read -rp  "Username: " USERNAME
read -rp  "Display name [$USERNAME]: " DISPLAYNAME
DISPLAYNAME=${DISPLAYNAME:-$USERNAME}
DISPLAYNAME=${DISPLAYNAME//\'/\'\'}   # escape single quotes for YAML
read -rp  "E-mail for the account record: " EMAIL
read -rsp "Password: " PASSWORD; echo
read -rsp "Password (again): " PASSWORD2; echo
[ "$PASSWORD" = "$PASSWORD2" ] || { echo "Passwords do not match."; exit 1; }

echo "Hashing password (argon2id)…"
HASH=$(docker run --rm authelia/authelia:4.38 \
  authelia crypto hash generate argon2 --password "$PASSWORD" | sed -n 's/^Digest: //p')
[ -n "$HASH" ] || { echo "Password hashing failed."; exit 1; }

JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
STORAGE_KEY=$(openssl rand -hex 32)

sed -e "s/__DOMAIN__/$DOMAIN/g" \
    -e "s/__RECIPES_HOST__/$RECIPES_HOST/g" \
    -e "s/__AUTH_HOST__/$AUTH_HOST/g" \
    -e "s/__JWT_SECRET__/$JWT_SECRET/g" \
    -e "s/__SESSION_SECRET__/$SESSION_SECRET/g" \
    -e "s/__STORAGE_KEY__/$STORAGE_KEY/g" \
    authelia/configuration.yml.tpl > authelia/configuration.yml

cat > authelia/users_database.yml <<EOF
users:
  $USERNAME:
    disabled: false
    displayname: '$DISPLAYNAME'
    password: '$HASH'
    email: $EMAIL
    groups: []
EOF

cat > .env <<EOF
DOMAIN=$DOMAIN
RECIPES_HOST=$RECIPES_HOST
AUTH_HOST=$AUTH_HOST
EOF

chmod 600 authelia/users_database.yml authelia/configuration.yml .env

cat <<EOF

✔ Configuration generated.

Next steps:
  1. DNS: create A (or dynamic-DNS CNAME) records for
         $RECIPES_HOST
         $AUTH_HOST
     pointing at your public IP.
  2. Router: forward ports 80 and 443 to this machine.
  3. Start everything:   docker compose up -d --build
  4. Open https://$RECIPES_HOST — log in with '$USERNAME' + your password.
  5. First login asks for a second factor: choose "One-Time Password",
     confirm your identity with the code found in
         ./authelia/notification.txt
     then scan the QR code with Google Authenticator. Done — from then on
     it's password + 6-digit code.
EOF
