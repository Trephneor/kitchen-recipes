# Kitchen Recipes — native iOS app

A SwiftUI rebuild of the kitchen-counter recipe & nutrition PWA as a real
iOS app, targeting **iOS 26** so it can use the real Liquid Glass APIs.

## What's inside

- **Recipes** — live search, category chips with icons, favorites, 5-star
  ratings, Danish measurements, and Airbnb-style zoom transitions from card
  to detail.
- **Discover** — a Tinder-style deck of random recipes: swipe right to save
  a favorite, left to pass, tap to open. A filter sheet (toolbar button,
  badge when active) narrows the deck to chosen categories — Vegetarian,
  Dessert, Seafood… — applied on Done, with no-repeat dealing and a
  "seen them all / start over" state.
- **Cooking mode** — full-screen, dark and calm, with a *gentle ember border*
  flowing around the screen edge (one Canvas, ~30 particles, 30 fps cap, no
  live blur — it respects Reduce Motion). Steps page horizontally and always
  fit on screen; any duration mentioned in a step becomes a tappable timer;
  the screen stays awake; pull down on the header or tap ✕ to leave.
- **Diary** — photograph the meal you made, dictate what you ate (on-device
  speech recognition), and the description is parsed into foods + amounts —
  by Claude if an API key is set in Settings, otherwise by a built-in parser.
- **Insights** — the nutrition knowledge graph (meals, foods, nutrients,
  days, recipes as nodes; weighted edges) drives Swift Charts: today's
  energy, a 14-day trend, macro balance, vitamin & mineral coverage, and
  "eat healthier" recommendations that deep-link back into recipe search.

Everything is stored on-device (JSON + JPEGs in Application Support; the
Claude key in the Keychain). Recipes come from [TheMealDB](https://www.themealdb.com).

## Building

Requirements: **Xcode 26** on macOS (the project targets iOS 26 and uses the
Liquid Glass APIs: `glassEffect`, `GlassEffectContainer`, glass button styles).

```
open ios/KitchenRecipes.xcodeproj
```

1. Select the *KitchenRecipes* target → Signing & Capabilities → pick your
   team (bundle id is `com.example.KitchenRecipes`; change it to taste).
2. Build & run on an iPhone/iPad or the simulator.

No packages, no build scripts — the project uses Xcode's folder-synchronized
groups, so every Swift file in `KitchenRecipes/` is picked up automatically.

## Layout

```
ios/
├── KitchenRecipes.xcodeproj
└── KitchenRecipes/
    ├── KitchenRecipesApp.swift      # entry point
    ├── Models.swift                 # Recipe, DiaryMeal, Nutrient vocabulary
    ├── Theme.swift                  # palette, haptics, micro-interactions
    ├── FoodIcons.swift              # category → SF Symbol
    ├── Services/
    │   ├── MealDBClient.swift       # TheMealDB API
    │   ├── DanishUnits.swift        # cups/oz → dl/g, °F → °C
    │   ├── FoodCatalog.swift        # per-100 g nutrition table + text parser
    │   ├── NutritionGraph.swift     # the knowledge graph + recommendations
    │   ├── AppModel.swift           # app state + persistence
    │   ├── SpeechRecorder.swift     # dictation
    │   └── ClaudeMealParser.swift   # optional Claude-powered meal parsing
    └── Views/
        ├── RootView.swift           # tabs (sidebar-adaptable on iPad)
        ├── RecipesView.swift        # browse/search/filter grid
        ├── DiscoverDeckView.swift   # swipe deck
        ├── RecipeDetailView.swift   # stretchy hero, DK ingredients, rating
        ├── CookingModeView.swift    # steps, timers, wake lock
        ├── EmberBorderView.swift    # the fire that flows around the border
        ├── DiaryView.swift          # photo + voice logging
        ├── InsightsView.swift       # Swift Charts dashboard
        ├── SettingsView.swift
        └── Components.swift
```
