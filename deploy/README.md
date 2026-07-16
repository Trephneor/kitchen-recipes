# Public deployment — HTTPS + password + Google Authenticator

This folder puts Kitchen Recipes on the public internet **behind a login
wall**: [Caddy](https://caddyserver.com) terminates HTTPS with automatic
Let's Encrypt certificates, and [Authelia](https://www.authelia.com)
requires a **username + password AND a 6-digit Google Authenticator (TOTP)
code** before any request reaches the app. The app container itself has no
published port — Caddy is the only way in, and Caddy refuses everything
without a valid Authelia session.

```
internet ──443──▶ Caddy (TLS) ──▶ Authelia (password + TOTP) ──▶ app (nginx)
```

HTTPS also unlocks the app's camera, microphone and screen-wake-lock
features, which browsers only allow on secure origins.

## Prerequisites

- A domain you control (a free dynamic-DNS name like DuckDNS works too —
  you then use e.g. `myname.duckdns.org` as the "domain").
- Two hostnames pointed at your public IP: one for the app
  (`recipes.example.com`) and one for the login portal (`auth.example.com`).
  Both must be on the same parent domain (the session cookie is shared).
- Ports **80 and 443** forwarded on your router to the server.
- Docker + docker compose on the server.

## Setup (once)

```bash
cd kitchen-recipes/deploy
./setup.sh          # asks for domain, hostnames, username, password
docker compose up -d --build
```

`setup.sh` generates:

| File | Contents |
|---|---|
| `.env` | your hostnames (used by Caddy) |
| `authelia/configuration.yml` | Authelia config with three random secrets |
| `authelia/users_database.yml` | your account, password stored as argon2id hash |

All three are `chmod 600` and **git-ignored** — they never get committed,
which matters in this repo since it auto-commits backups.

## First login — enrolling Google Authenticator

1. Open `https://recipes.your-domain` → you land on the Authelia portal.
2. Sign in with your username + password.
3. You're asked for a second factor → choose **One-Time Password** →
   **Register device**. Authelia wants to verify your identity with a
   one-time code; since a home server has no mail server, that code is
   written to a file instead:

   ```bash
   cat authelia/notification.txt
   ```

4. Enter the code, scan the QR with Google Authenticator (or any TOTP app),
   and confirm. From now on every new session is password + 6-digit code.
   "Remember me" keeps the kitchen tablet signed in for a month; tune
   `expiration` / `inactivity` / `remember_me` in
   `authelia/configuration.yml.tpl` and re-run `setup.sh` if you want
   different timings.

## Day-2 operations

```bash
docker compose logs -f authelia   # login attempts, bans
docker compose logs -f caddy      # certificate issuance
docker compose up -d --build      # redeploy after app updates (git pull)
```

- **Add a user / change password**: re-run `./setup.sh`, or hash a password
  manually with
  `docker run --rm authelia/authelia:4.38 authelia crypto hash generate argon2 --password '…'`
  and edit `authelia/users_database.yml`, then `docker compose restart authelia`.
- **Lost authenticator**: delete the row for your user in the TOTP table —
  easiest is to stop authelia, delete `authelia/db.sqlite3` (this only holds
  2FA enrollments/sessions, not your account) and re-enroll.
- **Brute force**: Authelia bans an account for 5 minutes after 3 failed
  attempts (see `regulation` in the config template).

## Alternative: no port forwarding

If you can't (or don't want to) open ports, a Cloudflare Tunnel with
Cloudflare Access in front achieves the same "public URL + login + TOTP"
result without touching the router — keep the `kitchen-recipes` service from
this compose file and point the tunnel at it instead of Caddy.
