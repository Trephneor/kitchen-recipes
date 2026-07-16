// Recipe detail: Danish-unit ingredient list, step-by-step instructions,
// favorite + 5-star rating, "cooking mode" (screen stays awake, auto-sized
// step text, step timers, swipe navigation), and one-tap logging into the
// nutrition graph.

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
    class: "icon-btn",
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

  const ingList = el("ul", { class: "ingredients-list grid-cols" }, ingredients.map((ing) => {
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

/** Find timeable durations in a step ("bake 35 minutes", "10-15 min"). */
function parseDurations(text) {
  const out = [];
  const seen = new Set();
  const re = /(\d+(?:\.\d+)?)\s*(?:(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*)?(hours?|hrs?\.?|minutes?|mins?\.?|seconds?|secs?\.?)\b/gi;
  let m;
  while ((m = re.exec(text))) {
    const a = parseFloat(m[1]);
    const b = m[2] ? parseFloat(m[2]) : null;
    const unit = m[3].toLowerCase();
    const mult = unit.startsWith("h") ? 3600 : unit.startsWith("m") ? 60 : 1;
    const value = Math.round((b ?? a) * mult); // for ranges, take the upper bound
    if (value < 15 || value > 6 * 3600 || seen.has(value)) continue;
    seen.add(value);
    const label = mult === 3600 ? `${b ?? a} h` : mult === 60 ? `${b ?? a} min` : `${b ?? a} s`;
    out.push({ seconds: value, label });
  }
  return out.slice(0, 3);
}

function formatCountdown(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

let audioCtx = null;
function ringAlarm() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    for (let i = 0; i < 4; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain).connect(audioCtx.destination);
      osc.frequency.value = i % 2 ? 660 : 880;
      const t = now + i * 0.45;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      osc.start(t);
      osc.stop(t + 0.42);
    }
  } catch { /* no audio available */ }
  navigator.vibrate?.([300, 140, 300, 140, 300]);
}

function startCookingMode(meal, ingredients, steps) {
  let stepIndex = 0;
  let wakeLock = null;
  let showIngredients = false;
  const durations = steps.map(parseDurations);

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

  // ----- timers (survive step navigation; shown under the progress bar) -----
  const activeTimers = [];
  const timersBar = el("div", { class: "cook-timers", style: "display:none" });
  let tick = null;

  function ensureTick() {
    if (tick) return;
    tick = setInterval(() => {
      let anyRunning = false;
      for (const timer of activeTimers) {
        if (timer.done) continue;
        const left = Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000));
        if (left <= 0) {
          timer.done = true;
          timer.chip.classList.remove("running");
          timer.chip.classList.add("done");
          timer.chip.replaceChildren(icon("bell"), `Step ${timer.step + 1} — time's up! ✕`);
          ringAlarm();
        } else {
          anyRunning = true;
          timer.chip.replaceChildren(icon("clock"), `Step ${timer.step + 1} · ${formatCountdown(left)}`);
        }
      }
      if (!anyRunning) { clearInterval(tick); tick = null; }
    }, 1000);
  }

  function addTimer(seconds) {
    const chip = el("button", { class: "timer-chip running", "aria-label": "Cancel timer" },
      icon("clock"), `Step ${stepIndex + 1} · ${formatCountdown(seconds)}`);
    const timer = { endsAt: Date.now() + seconds * 1000, step: stepIndex, chip, done: false };
    chip.onclick = () => {
      activeTimers.splice(activeTimers.indexOf(timer), 1);
      chip.remove();
      if (activeTimers.length === 0) timersBar.style.display = "none";
    };
    activeTimers.push(timer);
    timersBar.append(chip);
    timersBar.style.display = "flex";
    ensureTick();
  }

  // ----- step UI -----
  const progress = el("div", { class: "cook-progress", "aria-hidden": "true" },
    steps.map(() => el("span")));
  const stepNum = el("div", { class: "cook-step-num" });
  const stepText = el("div", { class: "cook-step-text" });
  const stepTimers = el("div", { class: "step-timers" });
  const ingPanel = el("div", { class: "cook-ingredients", style: "display:none" },
    el("ul", {}, ingredients.map((ing) =>
      el("li", {}, el("span", { class: "qty" }, toDanishMeasure(ing.measure, ing.name) || "–"), el("span", {}, ing.name)))));

  const prevBtn = el("button", { onclick: () => go(-1) }, icon("chevron-left"), "Previous");
  // No handler here — paint() owns nextBtn.onclick (Next vs Done/exit) so a
  // single click never fires two handlers.
  const nextBtn = el("button", { class: "primary" }, "Next", icon("chevron-right"));

  function go(delta) {
    const next = Math.min(Math.max(stepIndex + delta, 0), steps.length - 1);
    if (next === stepIndex) return;
    stepIndex = next;
    paint(true);
  }

  function paint(animate = false) {
    stepNum.textContent = `Step ${stepIndex + 1} of ${steps.length}`;
    const text = steps[stepIndex];
    stepText.textContent = text;
    // Size the type so the step fits on screen instead of scrolling.
    const size = text.length < 110 ? "xl" : text.length < 220 ? "lg" : text.length < 380 ? "md" : "sm";
    stepText.className = `cook-step-text size-${size}`;
    stepTimers.replaceChildren(...durations[stepIndex].map((d) =>
      el("button", { class: "chip", onclick: () => addTimer(d.seconds) }, icon("clock"), `Start ${d.label} timer`)));
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
    document.removeEventListener("keydown", onKey);
    if (tick) { clearInterval(tick); tick = null; }
    document.body.style.overflow = "";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      overlay.remove();
      return;
    }
    overlay.classList.add("closing");
    overlay.addEventListener("animationend", () => overlay.remove(), { once: true });
    setTimeout(() => overlay.remove(), 450); // safety net
  }

  const body = el("div", { class: "cook-body" }, stepNum, stepText, stepTimers);

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
        el("button", { class: "cook-exit", "aria-label": "Exit cooking mode", onclick: exit },
          icon("x"), el("span", {}, "Exit")))),
    progress,
    timersBar,
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
  document.body.style.overflow = "hidden";
  document.addEventListener("visibilitychange", onVisibility);
  acquireWakeLock();
  paint();
}
