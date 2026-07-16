// Recipe detail: Danish-unit ingredient list, step-by-step instructions,
// favorite + 5-star rating, "cooking mode" (screen stays awake, huge text,
// swipe navigation), and one-tap logging into the nutrition graph.

import { el, clear, icon, toast, starsEditor, fmt } from "../ui.js";
import * as mealdb from "../mealdb.js";
import { toDanishMeasure, measureToGrams, convertTemperatures } from "../units.js";
import { getFavorites, getRatings, toggleFavorite, setRating } from "../store.js";
import { lookupFood, emptyTotals, addScaled } from "../nutrition.js";
import { openLogMealModal } from "./diary.js";

export async function render(container, id) {
  clear(container);
  container.append(
    el("div", { class: "skeleton", style: "height:46px;width:220px;margin-bottom:1rem" }),
    el("div", { class: "recipe-hero" },
      el("div", { class: "skeleton", style: "aspect-ratio:4/3;border-radius:22px" }),
      el("div", {},
        el("div", { class: "skeleton", style: "height:44px;width:70%;margin-bottom:1rem" }),
        el("div", { class: "skeleton", style: "height:260px" }))),
  );

  let meal;
  try {
    meal = await mealdb.lookupMeal(id);
  } catch (err) {
    clear(container).append(el("div", { class: "empty-state" },
      el("div", { class: "big" }, "📡"),
      el("h3", {}, "Could not load the recipe"),
      el("p", { class: "hint" }, String(err.message || err))));
    return;
  }
  if (!meal) {
    clear(container).append(el("div", { class: "empty-state" },
      el("div", { class: "big" }, "🤷"), el("h3", {}, "Recipe not found.")));
    return;
  }

  const ingredients = mealdb.getIngredients(meal);
  const steps = mealdb.getSteps(meal).map(convertTemperatures);
  const [favs, ratings] = await Promise.all([getFavorites(), getRatings()]);
  const isFav = favs.has(meal.idMeal);

  // Approximate nutrition for the whole dish, from the ingredient list.
  const dishTotals = emptyTotals();
  const dishFoods = [];
  for (const ing of ingredients) {
    const grams = measureToGrams(ing.measure, ing.name);
    const match = lookupFood(ing.name);
    if (grams && match) addScaled(dishTotals, match.per100, grams);
    if (grams) dishFoods.push({ name: ing.name, grams });
  }
  const servings = 4; // TheMealDB doesn't provide servings; assume a family dish
  const perServing = Math.round(dishTotals.kcal / servings);

  clear(container);

  const favBtn = el("button", {
    class: `icon-btn${isFav ? "" : ""}`,
    "aria-label": isFav ? "Remove from favorites" : "Add to favorites",
    "aria-pressed": String(isFav),
    style: isFav ? "color: var(--heart)" : "",
    onclick: async () => {
      const on = await toggleFavorite(meal.idMeal);
      favBtn.style.color = on ? "var(--heart)" : "";
      favBtn.querySelector("svg").style.fill = on ? "currentColor" : "none";
      toast(on ? "Added to favorites ♥" : "Removed from favorites");
    },
  }, icon("heart"));
  if (isFav) favBtn.querySelector("svg").style.fill = "currentColor";

  const ingList = el("ul", { class: "ingredients-list" }, ingredients.map((ing) => {
    const check = el("input", { type: "checkbox", "aria-label": `Got ${ing.name}` });
    const li = el("li", {}, check,
      el("span", { class: "qty" }, toDanishMeasure(ing.measure, ing.name) || "–"),
      el("span", {}, ing.name));
    check.addEventListener("change", () => li.classList.toggle("checked", check.checked));
    return li;
  }));

  container.append(
    el("div", { class: "row spread", style: "margin-bottom:1rem" },
      el("button", { class: "ghost", onclick: () => history.back() }, icon("chevron-left"), "Back"),
      el("div", { class: "row" },
        favBtn,
        el("button", { class: "primary", onclick: () => startCookingMode(meal, ingredients, steps) },
          icon("flame"), "Cooking mode"),
        el("button", {
          onclick: () => openLogMealModal({
            title: meal.strMeal,
            recipeId: meal.idMeal,
            foods: dishFoods.map((f) => ({ name: f.name, grams: Math.round(f.grams / servings) })),
          }, () => toast("Saved to your diary")),
        }, icon("camera"), "I cooked this"))),

    el("div", { class: "recipe-hero" },
      el("div", {},
        el("img", { class: "hero-img", src: meal.strMealThumb, alt: meal.strMeal }),
        el("div", { class: "row", style: "margin-top:0.8rem" },
          meal.strCategory ? el("span", { class: "badge" }, meal.strCategory) : null,
          meal.strArea ? el("span", { class: "badge" }, meal.strArea) : null,
          dishTotals.kcal > 0 ? el("span", { class: "badge" }, `≈ ${fmt(perServing)} kcal/serving`) : null),
        el("div", { style: "margin-top:0.7rem" },
          el("div", { class: "hint" }, "Your rating — tap to rate"),
          starsEditor(ratings[meal.idMeal], async (n) => {
            await setRating(meal.idMeal, n);
            toast(n ? `Rated ${n} star${n > 1 ? "s" : ""} ★` : "Rating cleared");
          })),
        meal.strYoutube ? el("p", {}, el("a", { href: meal.strYoutube, target: "_blank", rel: "noopener" }, "▶ Watch video")) : null,
        meal.strSource ? el("p", {}, el("a", { href: meal.strSource, target: "_blank", rel: "noopener" }, "Original source")) : null),
      el("div", {},
        el("h1", { style: "margin-top:0" }, meal.strMeal),
        el("h2", { class: "section-title" }, `Ingredients · ${ingredients.length}`),
        el("div", { class: "card", style: "padding:0.4rem 1rem" }, ingList),
        el("p", { class: "hint" }, "Converted to Danish measures from the original. Nutrition figures are estimates."))),

    el("h2", { class: "section-title" }, "Method"),
    el("div", { class: "card" }, el("ol", { class: "steps" }, steps.map((s) => el("li", {}, s)))),
  );
}

// ---------- cooking mode ----------

function startCookingMode(meal, ingredients, steps) {
  let stepIndex = 0;
  let wakeLock = null;
  let showIngredients = false;

  const lockBadge = el("span", { class: "cook-lock" }, "screen: –");

  async function acquireWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        wakeLock = await navigator.wakeLock.request("screen");
        lockBadge.textContent = "screen stays on ✓";
        lockBadge.classList.add("on");
        wakeLock.addEventListener("release", () => {
          lockBadge.textContent = "screen: released";
          lockBadge.classList.remove("on");
        });
      } else {
        lockBadge.textContent = "wake lock unsupported";
      }
    } catch {
      lockBadge.textContent = "wake lock blocked (needs HTTPS)";
    }
  }

  const onVisibility = () => {
    // Wake locks are released when the tab is hidden; re-acquire on return.
    if (document.visibilityState === "visible" && overlay.isConnected) acquireWakeLock();
  };

  const progress = el("div", { class: "cook-progress", "aria-hidden": "true" },
    steps.map(() => el("span")));
  const stepNum = el("div", { class: "cook-step-num" });
  const stepText = el("div", { class: "cook-step-text" });
  const ingPanel = el("div", { class: "cook-ingredients", style: "display:none" },
    el("ul", { class: "ingredients-list" }, ingredients.map((ing) =>
      el("li", {}, el("span", { class: "qty" }, toDanishMeasure(ing.measure, ing.name) || "–"), el("span", {}, ing.name)))));

  const prevBtn = el("button", { onclick: () => go(-1) }, icon("chevron-left"), "Previous");
  const nextBtn = el("button", { class: "primary", onclick: () => go(1) }, "Next", icon("chevron-right"));

  function go(delta) {
    const next = Math.min(Math.max(stepIndex + delta, 0), steps.length - 1);
    if (next === stepIndex) return;
    stepIndex = next;
    paint(true);
  }

  function paint(animate = false) {
    stepNum.textContent = `Step ${stepIndex + 1} of ${steps.length}`;
    stepText.textContent = steps[stepIndex];
    [...progress.children].forEach((seg, i) => seg.classList.toggle("done", i <= stepIndex));
    prevBtn.disabled = stepIndex === 0;
    const last = stepIndex === steps.length - 1;
    nextBtn.replaceChildren(...(last ? [icon("check"), "Done"] : ["Next", icon("chevron-right")]));
    nextBtn.onclick = last ? exit : () => go(1);
    if (animate) {
      body.classList.remove("swap");
      void body.offsetWidth; // restart the entry animation
      body.classList.add("swap");
    }
  }

  function exit() {
    wakeLock?.release().catch(() => {});
    document.removeEventListener("visibilitychange", onVisibility);
    overlay.remove();
  }

  const body = el("div", { class: "cook-body" }, stepNum, stepText);

  // Swipe left/right between steps.
  let touchX = null;
  body.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  body.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
    touchX = null;
  }, { passive: true });

  const overlay = el("div", { class: "cook-overlay", role: "dialog", "aria-label": `Cooking ${meal.strMeal}` },
    el("div", { class: "cook-head" },
      el("h2", {}, meal.strMeal),
      el("div", { class: "row", style: "flex-wrap:nowrap" },
        lockBadge,
        el("button", {
          class: "ghost",
          "aria-pressed": "false",
          onclick: (e) => {
            showIngredients = !showIngredients;
            ingPanel.style.display = showIngredients ? "block" : "none";
            e.currentTarget.setAttribute("aria-pressed", String(showIngredients));
          },
        }, icon("clipboard"), "Ingredients"),
        el("button", { class: "icon-btn", "aria-label": "Exit cooking mode", onclick: exit }, icon("x")))),
    progress,
    body,
    ingPanel,
    el("div", { class: "cook-nav" }, prevBtn, nextBtn),
    el("div", { class: "cook-hint" }, "Swipe or use the buttons to move between steps — the screen won't sleep."),
  );

  // Keyboard navigation while the overlay is open.
  const onKey = (e) => {
    if (!overlay.isConnected) { document.removeEventListener("keydown", onKey); return; }
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "Escape") exit();
  };
  document.addEventListener("keydown", onKey);

  document.body.append(overlay);
  document.addEventListener("visibilitychange", onVisibility);
  acquireWakeLock();
  paint();
}
