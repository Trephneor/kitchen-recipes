// Recipe browser: live search (type-ahead, no submit button), category chips
// with food icons, grid/list views, favorites, sort by rating.

import { el, clear, icon, starsDisplay, toast } from "../ui.js";
import { categoryIcon } from "../foodicons.js";
import * as mealdb from "../mealdb.js";
import { getFavorites, getRatings, toggleFavorite } from "../store.js";

const state = {
  query: "",
  category: "",
  area: "",
  ingredient: "",
  favOnly: false,
  view: "grid",
  sort: "az",
  results: [],
};

export async function render(container, params = {}) {
  if (params.ingredient) {
    state.ingredient = params.ingredient;
    state.query = ""; state.category = ""; state.area = ""; state.favOnly = false;
  }

  clear(container);
  const [categories, areas] = await Promise.all([
    mealdb.listCategories().catch(() => []),
    mealdb.listAreas().catch(() => []),
  ]);

  // ---------- search (live, debounced — the toolbar is never re-rendered,
  // so typing keeps focus) ----------
  const searchInput = el("input", {
    type: "search", placeholder: "Search recipes…", value: state.query,
    "aria-label": "Search recipes", autocomplete: "off",
  });
  const clearBtn = el("button", {
    class: "search-clear", "aria-label": "Clear search", type: "button",
    style: state.query ? "" : "display:none",
    onclick: () => {
      searchInput.value = "";
      clearBtn.style.display = "none";
      applySearch("");
      searchInput.focus();
    },
  }, icon("x"));

  let debounce;
  searchInput.addEventListener("input", () => {
    clearBtn.style.display = searchInput.value ? "" : "none";
    clearTimeout(debounce);
    const q = searchInput.value.trim();
    debounce = setTimeout(() => {
      if (q.length >= 2 || q.length === 0) applySearch(q);
    }, 420);
  });
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      clearTimeout(debounce);
      applySearch(searchInput.value.trim());
    }
  });

  function applySearch(q) {
    if (q === state.query) return;
    state.query = q;
    if (q) { state.category = ""; state.ingredient = ""; state.favOnly = false; state.area = ""; areaSel.value = ""; }
    paintFilters();
    load();
  }

  // ---------- category chips with icons ----------
  const chipButtons = new Map(); // category name ("" = All) → button
  const makeChip = (label, name) => {
    const btn = el("button", {
      class: "chip",
      onclick: () => {
        state.category = state.category === name ? "" : name;
        state.query = ""; searchInput.value = ""; clearBtn.style.display = "none";
        state.ingredient = ""; state.favOnly = false;
        paintFilters();
        load();
      },
    }, categoryIcon(name || "all"), label);
    chipButtons.set(name, btn);
    return btn;
  };

  const chipsRow = el("div", { class: "chips-row", "aria-label": "Category" },
    makeChip("All", ""),
    categories.map((c) => makeChip(c, c)));

  // ---------- cuisine / sort / favorites / view ----------
  const areaSel = el("select", { "aria-label": "Cuisine", onchange: () => {
    state.area = areaSel.value;
    if (state.area) { state.query = ""; searchInput.value = ""; clearBtn.style.display = "none"; state.ingredient = ""; state.category = ""; state.favOnly = false; }
    paintFilters();
    load();
  } },
    el("option", { value: "" }, "All cuisines"),
    areas.map((a) => el("option", { value: a, selected: state.area === a || null }, a)));

  const sortSel = el("select", { "aria-label": "Sort order", onchange: () => { state.sort = sortSel.value; renderResults(); } },
    el("option", { value: "az", selected: state.sort === "az" || null }, "A–Z"),
    el("option", { value: "rating", selected: state.sort === "rating" || null }, "My rating"));

  const favChip = el("button", {
    class: "chip",
    "aria-pressed": String(state.favOnly),
    onclick: () => {
      state.favOnly = !state.favOnly;
      if (state.favOnly) { state.query = ""; searchInput.value = ""; clearBtn.style.display = "none"; state.category = ""; state.ingredient = ""; }
      favChip.setAttribute("aria-pressed", String(state.favOnly));
      paintFilters();
      load();
    },
  }, icon("heart"), "Favorites");

  const segmented = el("div", { class: "segmented", role: "group", "aria-label": "Layout" },
    el("button", {
      class: state.view === "grid" ? "active" : "", "aria-label": "Grid view",
      onclick: () => { state.view = "grid"; renderResults(); paintSegments(); },
    }, icon("grid")),
    el("button", {
      class: state.view === "list" ? "active" : "", "aria-label": "List view",
      onclick: () => { state.view = "list"; renderResults(); paintSegments(); },
    }, icon("list")));
  const paintSegments = () => {
    segmented.children[0].classList.toggle("active", state.view === "grid");
    segmented.children[1].classList.toggle("active", state.view === "list");
  };

  const surpriseBtn = el("button", {
    class: "icon-btn", "aria-label": "Surprise me with random recipes", title: "Surprise me",
    onclick: () => {
      Object.assign(state, { query: "", category: "", area: "", ingredient: "", favOnly: false });
      searchInput.value = ""; clearBtn.style.display = "none"; areaSel.value = "";
      paintFilters();
      load();
    },
  }, icon("shuffle"));

  // active-ingredient bar (from dashboard "find recipes with …" links)
  const ingredientBar = el("div", { class: "row", style: "display:none;margin-bottom:0.8rem" });

  function paintFilters() {
    for (const [name, btn] of chipButtons) {
      const active = name === ""
        ? !state.category && !state.favOnly && !state.ingredient && !state.query && !state.area
        : state.category === name;
      btn.classList.toggle("active", active);
    }
    favChip.classList.toggle("active", state.favOnly);
    if (state.ingredient) {
      ingredientBar.style.display = "";
      ingredientBar.replaceChildren(
        el("span", { class: "chip active" }, `Recipes with ${state.ingredient}`),
        el("button", { class: "ghost", onclick: () => { state.ingredient = ""; paintFilters(); load(); } }, icon("x"), "Clear"));
    } else {
      ingredientBar.style.display = "none";
    }
  }

  const grid = el("div", { class: `recipe-grid${state.view === "list" ? " list-mode" : ""}` });

  container.append(
    el("div", { class: "toolbar" },
      el("div", { class: "row" },
        el("div", { class: "search-field" }, icon("search"), searchInput, clearBtn),
        surpriseBtn),
      chipsRow,
      el("div", { class: "row wrap" }, areaSel, sortSel, favChip, el("span", { class: "grow" }), segmented)),
    ingredientBar,
    grid,
  );
  paintFilters();

  function showSkeletons() {
    grid.replaceChildren(...Array.from({ length: 10 }, () =>
      el("div", { class: "skeleton skeleton-card", "aria-hidden": "true" })));
  }

  let loadSeq = 0; // drop stale responses when the user keeps typing
  async function load() {
    const seq = ++loadSeq;
    showSkeletons();
    try {
      let meals;
      const favs = await getFavorites();
      if (state.favOnly) {
        meals = (await Promise.all([...favs].map((id) => mealdb.lookupMeal(id).catch(() => null)))).filter(Boolean);
      } else if (state.query) {
        meals = await mealdb.searchMeals(state.query);
      } else if (state.ingredient) {
        meals = await mealdb.filterBy("ingredient", state.ingredient);
      } else if (state.category) {
        meals = await mealdb.filterBy("category", state.category);
      } else if (state.area) {
        meals = await mealdb.filterBy("area", state.area);
      } else {
        meals = await mealdb.randomMeals(12);
      }
      if (seq !== loadSeq) return;
      state.results = meals;
      renderResults();
    } catch (err) {
      if (seq !== loadSeq) return;
      grid.replaceChildren(el("div", { class: "empty-state" },
        el("div", { class: "big" }, "📡"),
        el("h3", {}, "Can't reach the recipe service"),
        el("p", {}, "Check the network connection and try again."),
        el("p", { class: "hint" }, String(err.message || err))));
    }
  }

  async function renderResults() {
    const [favs, ratings] = await Promise.all([getFavorites(), getRatings()]);
    const meals = [...state.results];
    if (state.sort === "rating") {
      meals.sort((a, b) => (ratings[b.idMeal] || 0) - (ratings[a.idMeal] || 0) || a.strMeal.localeCompare(b.strMeal));
    } else {
      meals.sort((a, b) => a.strMeal.localeCompare(b.strMeal));
    }

    grid.className = `recipe-grid${state.view === "list" ? " list-mode" : ""}`;
    if (meals.length === 0) {
      grid.replaceChildren(el("div", { class: "empty-state" },
        el("div", { class: "big" }, state.favOnly ? "💔" : "🍳"),
        el("h3", {}, state.favOnly ? "No favorites yet" : "Nothing found"),
        el("p", {}, state.favOnly
          ? "Tap the heart on a recipe you love and it will live here."
          : "Try another search, or let the dice pick something for you.")));
      return;
    }

    grid.replaceChildren(...meals.map((meal, i) => {
      const isFav = favs.has(meal.idMeal);
      const heart = el("button", {
        class: `fav-btn${isFav ? " on" : ""}`,
        "aria-label": isFav ? "Remove from favorites" : "Add to favorites",
        "aria-pressed": String(isFav),
        onclick: async (e) => {
          e.stopPropagation();
          const on = await toggleFavorite(meal.idMeal);
          heart.classList.toggle("on", on);
          heart.setAttribute("aria-pressed", String(on));
          toast(on ? "Added to favorites ♥" : "Removed from favorites");
          if (state.favOnly && !on) { state.results = state.results.filter((m) => m.idMeal !== meal.idMeal); renderResults(); }
        },
      }, icon("heart"));

      return el("article", {
        class: "recipe-card enter",
        style: `--i:${Math.min(i, 11)}`,
        tabindex: 0,
        role: "link",
        "aria-label": meal.strMeal,
        onclick: () => { location.hash = `#/recipe/${meal.idMeal}`; },
        onkeydown: (e) => { if (e.key === "Enter") location.hash = `#/recipe/${meal.idMeal}`; },
      },
        el("img", { src: mealdb.thumb(meal), alt: "", loading: "lazy" }),
        el("div", { class: "scrim", "aria-hidden": "true" }),
        el("div", { class: "overlay" },
          el("h3", { class: "title" }, meal.strMeal),
          el("div", { class: "meta-row" },
            el("span", {}, [meal.strCategory, meal.strArea].filter(Boolean).join(" · ") || " "),
            ratings[meal.idMeal] ? starsDisplay(ratings[meal.idMeal]) : null)),
        heart);
    }));
  }

  load();
}
