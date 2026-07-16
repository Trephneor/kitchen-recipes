// TheMealDB — free, public recipe API (test key "1").
// https://www.themealdb.com/api.php

const BASE = "https://www.themealdb.com/api/json/v1/1";
const cache = new Map();

async function fetchJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`TheMealDB request failed (${res.status})`);
  const data = await res.json();
  cache.set(path, data);
  return data;
}

export async function searchMeals(query) {
  const data = await fetchJSON(`search.php?s=${encodeURIComponent(query)}`);
  return data.meals || [];
}

export async function filterBy(kind, value) {
  const param = { category: "c", area: "a", ingredient: "i" }[kind];
  const data = await fetchJSON(`filter.php?${param}=${encodeURIComponent(value)}`);
  return data.meals || [];
}

export async function lookupMeal(id) {
  const data = await fetchJSON(`lookup.php?i=${encodeURIComponent(id)}`);
  return (data.meals || [])[0] || null;
}

export async function listCategories() {
  const data = await fetchJSON("list.php?c=list");
  return (data.meals || []).map((m) => m.strCategory);
}

export async function listAreas() {
  const data = await fetchJSON("list.php?a=list");
  return (data.meals || []).map((m) => m.strArea);
}

/** n distinct random meals (random.php can repeat, so de-dupe). */
export async function randomMeals(n = 12) {
  const results = await Promise.allSettled(
    Array.from({ length: n }, () => fetch(`${BASE}/random.php`).then((r) => r.json())),
  );
  const seen = new Map();
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.meals?.[0]) {
      const meal = r.value.meals[0];
      seen.set(meal.idMeal, meal);
    }
  }
  return [...seen.values()];
}

/** Extract [{name, measure}] from a meal object's strIngredientN fields. */
export function getIngredients(meal) {
  const out = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || "").trim();
    const measure = (meal[`strMeasure${i}`] || "").trim();
    if (name) out.push({ name, measure });
  }
  return out;
}

/** Split instructions into readable steps. */
export function getSteps(meal) {
  const raw = meal.strInstructions || "";
  let steps = raw.split(/\r?\n+/).map((s) => s.trim()).filter((s) => s.length > 3);
  if (steps.length <= 2 && raw.length > 300) {
    // one big paragraph — split into sentence pairs
    const sentences = raw.match(/[^.!?]+[.!?]+/g) || [raw];
    steps = [];
    for (let i = 0; i < sentences.length; i += 2) {
      steps.push(sentences.slice(i, i + 2).join(" ").trim());
    }
  }
  return steps.map((s) => s.replace(/^(step\s*)?\d+[.):]\s*/i, ""));
}

export function thumb(meal, size = "medium") {
  return meal.strMealThumb ? `${meal.strMealThumb}/${size}` : "";
}
