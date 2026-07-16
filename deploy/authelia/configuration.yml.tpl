# Authelia configuration TEMPLATE — do not edit the generated
# configuration.yml by hand; re-run ../setup.sh instead.
# __PLACEHOLDERS__ are filled in by setup.sh.

theme: auto

server:
  address: 'tcp://:9091'

log:
  level: info

identity_validation:
  reset_password:
    jwt_secret: '__JWT_SECRET__'

authentication_backend:
  file:
    path: /config/users_database.yml
    password:
      algorithm: argon2

# The "Google Authenticator" part: time-based one-time passwords.
# Any TOTP app works (Google Authenticator, Aegis, 1Password, …).
totp:
  issuer: Kitchen Recipes
  period: 30
  digits: 6

access_control:
  default_policy: deny
  rules:
    - domain: '__RECIPES_HOST__'
      policy: two_factor   # password AND authenticator code

session:
  secret: '__SESSION_SECRET__'
  cookies:
    - domain: '__DOMAIN__'
      authelia_url: 'https://__AUTH_HOST__'
      default_redirection_url: 'https://__RECIPES_HOST__'
      expiration: 12h      # session length after login
      inactivity: 45m
      remember_me: 1M      # "remember me" — convenient for the kitchen tablet

# Brute-force protection: 3 wrong attempts → 5 minute ban.
regulation:
  max_retries: 3
  find_time: 2m
  ban_time: 5m

storage:
  encryption_key: '__STORAGE_KEY__'
  local:
    path: /config/db.sqlite3

# No mail server on a home box: identity-verification codes (needed once,
# when you register your authenticator app) are written to this file.
notifier:
  filesystem:
    filename: /config/notification.txt
