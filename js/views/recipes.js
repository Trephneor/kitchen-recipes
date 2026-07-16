// Recipe browser: search TheMealDB, filter with category chips + cuisine,
// grid (image-forward cards) or list view, favorites-only, sort by rating.

import { el, clear, icon, starsDisplay, toast } from "../ui.js";
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

  const refresh = () => render(container, {});

  // --- row 1: search + surprise ---
  const searchInput = el("input", {
    type: "search", placeholder: "Search recipes…", value: state.query,
    "aria-label": "Search recipes",
    onkeydown: (e) => { if (e.key === "Enter") { setSearch(searchInput.value); } },
  });
  const setSearch = (q) => {
    state.query = q; state.ingredient = ""; state.category = ""; state.favOnly = false;
    refresh();
  };

  const row1 = el("div", { class: "row" },
    el("div", { class: "search-field" }, icon("search"), searchInput),
    el("button", { class: "primary", onclick: () => setSearch(searchInput.value) }, "Search"),
    el("button", {
      "aria-label": "Surprise me with random recipes",
      onclick: () => { state.query = ""; state.category = ""; state.area = ""; state.ingredient = ""; state.favOnly = false; refresh(); },
    }, icon("shuffle"), el("span", { class: "surprise-label" }, "Surprise me")),
  );

  // --- row 2: category chips ---
  const chip = (label, active, onclick) =>
    el("button", { class: `chip${active ? " active" : ""}`, onclick }, label);

  const chipsRow = el("div", { class: "chips-row", role: "tablist", "aria-label": "Category" },
    chip("All", !state.category && !state.favOnly && !state.ingredient, () => {
      state.category = ""; state.favOnly = false; state.ingredient = ""; refresh();
    }),
    categories.map((c) => chip(c, state.category === c, () => {
      state.category = state.category === c ? "" : c;
      state.query = ""; state.ingredient = ""; state.favOnly = false;
      refresh();
    })));

  // --- row 3: cuisine, sort, favorites, view ---
  const areaSel = el("select", { "aria-label": "Cuisine", onchange: () => {
    state.area = areaSel.value; state.query = ""; state.ingredient = ""; state.category = ""; state.favOnly = false; refresh();
  } },
    el("option", { value: "" }, "All cuisines"),
    areas.map((a) => el("option", { value: a, selected: state.area === a || null }, a)));

  const sortSel = el("select", { "aria-label": "Sort order", onchange: () => { state.sort = sortSel.value; renderResults(); } },
    el("option", { value: "az", selected: state.sort === "az" || null }, "A–Z"),
    el("option", { value: "rating", selected: state.sort === "rating" || null }, "My rating"));

  const favChip = el("button", {
    class: `chip${state.favOnly ? " active" : ""}`,
    "aria-pressed": String(state.favOnly),
    onclick: () => { state.favOnly = !state.favOnly; refresh(); },
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

  const row3 = el("div", { class: "row wrap" }, areaSel, sortSel, favChip, el("span", { class: "grow" }), segmented);

  container.append(el("div", { class: "toolbar" }, row1, chipsRow, row3));

  if (state.ingredient) {
    container.append(el("div", { class: "row", style: "margin-bottom:0.8rem" },
      el("span", { class: "chip active" }, `Recipes with ${state.ingredient}`),
      el("button", { class: "ghost", onclick: () => { state.ingredient = ""; refresh(); } }, icon("x"), "Clear")));
  }

  const grid = el("div", { class: `recipe-grid${state.view === "list" ? " list-mode" : ""}` });
  container.append(grid);

  function showSkeletons() {
    grid.replaceChildren(...Array.from({ length: 8 }, () =>
      el("div", { class: "skeleton skeleton-card", "aria-hidden": "true" })));
  }

  async function load() {
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
      state.results = meals;
      renderResults();
    } catch (err) {
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

    grid.replaceChildren(...meals.map((meal) => {
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
        class: "recipe-card",
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
