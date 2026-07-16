# Kitchen Recipes 🍳

A recipe + nutrition app built for a **tablet mounted on the kitchen wall**.
No build step, no accounts, no cloud database — a static PWA served straight
from this repo, with all personal data stored locally on your device.

## Use it right now

**https://trephneor.github.io/kitchen-recipes/** — deployed automatically
from `main` by GitHub Actions (`.github/workflows/pages.yml`).

Open it on the tablet and choose *Add to Home Screen*: it installs as a
fullscreen app, works offline (except fetching new recipes), and because
GitHub Pages is HTTPS, the camera, voice input and screen wake-lock all work.

> **Privacy:** the URL is public, but it serves only the app code. Your
> diary, photos, ratings and the nutrition graph live in your browser's
> local storage on your device and are never uploaded anywhere. Use
> Settings → *Export backup* to move them between devices. (For a
> password + 2FA protected self-hosted deployment, see [`deploy/`](deploy/).)

## Features

- **Recipe browser** — search and browse recipes from
  [TheMealDB](https://www.themealdb.com) (free public API). Filter by
  category, cuisine or ingredient; switch between grid and list view; sort by
  your own rating; "Surprise me" random picks.
- **Favorites & 5-star ratings** — heart recipes and rate them; sort by your
  ratings.
- **Danish measurements** — ingredient lists are converted from US/UK measures
  to Danish kitchen units (`g`, `dl`, `spsk`, `tsk`, `fed`, `dåse`, …) and
  oven temperatures get their °C equivalent.
- **Cooking mode** — one tap and the screen **stays awake** (Screen Wake Lock
  API) while you cook: huge step-by-step text, previous/next buttons sized for
  floury fingers, ingredient panel one tap away.
- **Meal photo diary** — when you've cooked something, snap a photo of the
  plate with the tablet camera and log it.
- **Voice input** — dictate what you ate (Danish or English, Web Speech API).
  The transcript is saved as the photo's description.
- **Claude-powered food parsing (optional)** — add an Anthropic API key in
  Settings and Claude turns "en skål kyllingekarry med ris og en halv avocado"
  into structured foods with gram estimates. Without a key, a built-in
  offline matcher does a simpler job.
- **Nutrition knowledge graph** — every logged meal becomes nodes and edges
  (`meal → ingredient → nutrient`, `meal → day`, `meal → recipe`) persisted in
  IndexedDB. Calories, macros, vitamins and minerals are derived by
  traversing the graph.
- **Diet overview** — stat tiles, calories-over-time with your target line,
  macro split per day, vitamin/mineral coverage vs recommended daily amounts,
  and **recommendations** computed from the graph ("Vitamin C is at 45% —
  good sources: pepper, broccoli, orange", with a one-tap search for recipes
  using them).

## Quick start

```bash
cd kitchen-recipes

# Option A — docker (serves on http://<server>:8480)
docker compose up -d --build

# Option B — any static file server
python3 -m http.server 8480
```

Open the URL on the tablet, then "Add to Home Screen" — the app installs as a
fullscreen PWA and works offline for everything except fetching new recipes.

### Public internet access (with login + Google Authenticator)

To reach the app from outside your home safely, use the ready-made stack in
[`deploy/`](deploy/README.md): Caddy (automatic HTTPS) + Authelia
(username + password + TOTP code) in front of the app. Run
`deploy/setup.sh` once, point DNS at your IP, forward ports 80/443, then
`docker compose up -d --build` inside `deploy/`.

### HTTPS matters

The camera, the microphone (voice input) and the screen wake lock are browser
features that **require a secure context**. On `http://localhost` everything
works; across the LAN you should serve the app through your reverse proxy
with TLS (Traefik / Caddy / Nginx Proxy Manager with a local cert). Plain
`http://192.168.x.x` will still browse recipes and show the dashboard, but
photo capture, dictation and wake lock will be blocked by the browser.

### Claude API key (optional)

Settings → *Claude AI* → paste an Anthropic API key (`sk-ant-…`). The key is
stored only in the browser's IndexedDB on the tablet and is only ever sent to
`api.anthropic.com`. It is used for exactly one thing: parsing meal
descriptions into structured foods (`claude-opus-4-8` with a strict JSON
schema).

## Architecture

## Design

The UI is an "editorial kitchen" system: warm paper/charcoal surfaces, the
[Fraunces](https://fonts.google.com/specimen/Fraunces) display serif
(self-hosted in `fonts/`, SIL Open Font License) for headings and hero
numbers, a terracotta accent, SVG stroke icons, image-forward recipe cards,
skeleton loading states, bottom-sheet dialogs and a bottom navigation bar on
narrow screens. Page changes use the View Transitions API where available,
and all motion respects `prefers-reduced-motion`. Chart colors are the
CVD-validated reference palette, re-validated against these surfaces.

```
kitchen-recipes/
├── index.html              app shell (tabs: Recipes · Diary · Overview · Settings)
├── css/style.css           design system: tokens, light/dark, motion, components
├── fonts/                  Fraunces variable font (OFL)
├── js/
│   ├── app.js              hash router + bootstrap
│   ├── store.js            IndexedDB (settings, favorites, ratings, meals+photos, graph)
│   ├── mealdb.js           TheMealDB client
│   ├── units.js            US/UK → Danish measure conversion + grams estimation
│   ├── nutrition.js        per-100 g nutrition table (~100 foods) + daily targets (NNR)
│   ├── graph.js            the knowledge graph: nodes/edges, traversals, recommendations
│   ├── claude.js           optional Claude call (structured output) for meal parsing
│   ├── voice.js            Web Speech API dictation
│   ├── charts.js           hand-rolled SVG charts (line, stacked bars, coverage bars)
│   └── views/              recipes, recipe (+cooking mode), diary, dashboard, settings
├── sw.js                   offline app-shell cache
├── manifest.webmanifest    installable fullscreen PWA
└── Dockerfile / docker-compose.yml
```

**Graph model** — the "AI" layer is a knowledge graph, not a black box:

```
(meal)-[CONTAINS {grams}]->(ingredient)-[HAS {per 100 g}]->(nutrient)
(meal)-[ATE_ON]->(day)      (meal)-[BASED_ON]->(recipe)
```

Daily totals, trends and coverage are traversals over this structure; the
recommendation engine looks for nutrients persistently under ~70% of the
Nordic Nutrition Recommendations and points at ingredient-level fixes.

## Honest limitations

- Nutrition values are approximations from a built-in per-100 g table —
  useful for trends and insight, **not** medical advice.
- TheMealDB doesn't publish serving counts; per-serving estimates assume a
  4-serving dish.
- Voice recognition quality depends on the browser (Chrome/Edge on Android
  tablets work best; `da-DK` is supported there).
- All data lives in the tablet's browser storage — use Settings → *Export
  backup* now and then (backups include photos).
