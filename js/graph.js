// The nutrition knowledge graph. Everything you eat becomes nodes and edges:
//
//   (meal) -CONTAINS{grams}-> (ingredient) -HAS{per100g}-> (nutrient)
//   (meal) -ATE_ON->          (day)
//   (meal) -BASED_ON->        (recipe)
//
// Aggregations (daily totals, coverage, trends) and the diet recommendations
// are graph traversals over this structure. The graph is persisted to
// IndexedDB and kept in memory for queries.

import { putGraph, getGraph, deleteGraphItems } from "./store.js";
import { NUTRIENT_META, NUTRIENT_KEYS, RICH_SOURCES, lookupFood, emptyTotals, addScaled } from "./nutrition.js";
import { todayKey } from "./ui.js";

const nodes = new Map(); // id -> {id, type, ...props}
const edges = new Map(); // id -> {id, type, from, to, ...props}
let loaded = false;

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9æøå]+/g, "-").replace(/^-|-$/g, "");
}

export async function loadGraph() {
  if (loaded) return;
  const { nodes: ns, edges: es } = await getGraph();
  ns.forEach((n) => nodes.set(n.id, n));
  es.forEach((e) => edges.set(e.id, e));
  loaded = true;
}

function edgesFrom(id, type) {
  const out = [];
  for (const e of edges.values()) {
    if (e.from === id && (!type || e.type === type)) out.push(e);
  }
  return out;
}

function edgesTo(id, type) {
  const out = [];
  for (const e of edges.values()) {
    if (e.to === id && (!type || e.type === type)) out.push(e);
  }
  return out;
}

/** Record a meal in the graph. foods: [{name, grams}]. Returns the meal node. */
export async function logMealToGraph({ mealId, title, ts, recipeId, foods }) {
  await loadGraph();
  const newNodes = [];
  const newEdges = [];
  const dayId = `day:${todayKey(new Date(ts))}`;
  const mealNodeId = `meal:${mealId}`;

  const upsertNode = (node) => {
    if (!nodes.has(node.id)) { nodes.set(node.id, node); newNodes.push(node); }
    return nodes.get(node.id);
  };
  const upsertEdge = (edge) => {
    if (!edges.has(edge.id)) { edges.set(edge.id, edge); newEdges.push(edge); }
    return edges.get(edge.id);
  };

  upsertNode({ id: mealNodeId, type: "meal", title, ts });
  upsertNode({ id: dayId, type: "day", date: dayId.slice(4) });
  upsertEdge({ id: `${mealNodeId}->${dayId}`, type: "ATE_ON", from: mealNodeId, to: dayId });

  if (recipeId) {
    const recipeNodeId = `recipe:${recipeId}`;
    upsertNode({ id: recipeNodeId, type: "recipe", recipeId });
    upsertEdge({ id: `${mealNodeId}->${recipeNodeId}`, type: "BASED_ON", from: mealNodeId, to: recipeNodeId });
  }

  for (const nutrientKey of NUTRIENT_KEYS) {
    upsertNode({ id: `nut:${nutrientKey}`, type: "nutrient", key: nutrientKey, ...NUTRIENT_META[nutrientKey] });
  }

  foods.forEach((food, i) => {
    const match = lookupFood(food.name);
    const ingId = `ing:${slug(match ? match.key : food.name)}`;
    upsertNode({ id: ingId, type: "ingredient", name: match ? match.key : food.name, known: !!match });
    upsertEdge({
      id: `${mealNodeId}->${ingId}#${i}`,
      type: "CONTAINS",
      from: mealNodeId,
      to: ingId,
      grams: food.grams || 0,
    });
    if (match) {
      for (const nutrientKey of NUTRIENT_KEYS) {
        const per100 = match.per100[nutrientKey] || 0;
        if (per100 > 0) {
          upsertEdge({
            id: `${ingId}->nut:${nutrientKey}`,
            type: "HAS",
            from: ingId,
            to: `nut:${nutrientKey}`,
            per100,
          });
        }
      }
    }
  });

  await putGraph(newNodes, newEdges);
  return nodes.get(mealNodeId);
}

export async function removeMealFromGraph(mealId) {
  await loadGraph();
  const mealNodeId = `meal:${mealId}`;
  const edgeIds = [];
  for (const e of edges.values()) {
    if (e.from === mealNodeId || e.to === mealNodeId) edgeIds.push(e.id);
  }
  edgeIds.forEach((id) => edges.delete(id));
  nodes.delete(mealNodeId);
  await deleteGraphItems([mealNodeId], edgeIds);
}

/** Nutrition totals for one meal node (traverses CONTAINS → HAS). */
export function mealTotals(mealNodeId) {
  const totals = emptyTotals();
  for (const contains of edgesFrom(mealNodeId, "CONTAINS")) {
    for (const has of edgesFrom(contains.to, "HAS")) {
      const key = has.to.slice(4);
      totals[key] += (has.per100 * contains.grams) / 100;
    }
  }
  return totals;
}

/** Per-day totals for the last `days` days: [{date, totals, mealCount}]. */
export function dailyTotals(days) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const date = todayKey(d);
    const dayId = `day:${date}`;
    const totals = emptyTotals();
    let mealCount = 0;
    for (const ateOn of edgesTo(dayId, "ATE_ON")) {
      mealCount++;
      const t = mealTotals(ateOn.from);
      for (const key of NUTRIENT_KEYS) totals[key] += t[key];
    }
    out.push({ date, totals, mealCount });
  }
  return out;
}

/** Average % of daily target reached per nutrient over logged days. */
export function coverage(days) {
  const perDay = dailyTotals(days).filter((d) => d.mealCount > 0);
  if (perDay.length === 0) return [];
  return NUTRIENT_KEYS.map((key) => {
    const meta = NUTRIENT_META[key];
    const avg = perDay.reduce((sum, d) => sum + d.totals[key], 0) / perDay.length;
    return { key, label: meta.label, unit: meta.unit, target: meta.target, avg, pct: (avg / meta.target) * 100 };
  });
}

/** The "AI dietician": inspects the graph for gaps and excesses over the last
 * week and turns them into concrete, actionable suggestions. */
export function recommendations(days = 7) {
  const cov = coverage(days);
  if (cov.length === 0) {
    return [{ severity: "info", icon: "👋", text: "Log a few meals and I'll start analysing your diet here.", search: null }];
  }
  const recs = [];
  const by = Object.fromEntries(cov.map((c) => [c.key, c]));

  const kcalPct = by.kcal.pct;
  if (kcalPct > 115) {
    recs.push({ severity: "serious", icon: "🔥", text: `You're averaging ${Math.round(by.kcal.avg)} kcal/day — about ${Math.round(kcalPct - 100)}% over your target. Lighter dinners (fish, salads) a few days a week would close the gap.`, search: "salmon" });
  } else if (kcalPct < 70) {
    recs.push({ severity: "warning", icon: "🍽️", text: `Average intake is only ${Math.round(by.kcal.avg)} kcal/day. If you're logging everything, consider adding an extra wholesome meal or snack.`, search: "oats" });
  }

  const fatShare = (by.fat.avg * 9) / Math.max(by.kcal.avg, 1);
  if (fatShare > 0.42) {
    recs.push({ severity: "warning", icon: "🧈", text: `${Math.round(fatShare * 100)}% of your calories come from fat. Swapping some butter/cream dishes for legume- or fish-based recipes would rebalance it.`, search: "lentils" });
  }

  // Low micronutrients & protein/fiber — worst three first.
  const lows = cov
    .filter((c) => !["kcal", "fat", "carbs"].includes(c.key) && c.pct < 70)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 3);
  for (const low of lows) {
    const sources = RICH_SOURCES[low.key] || [];
    const list = sources.slice(0, 3).join(", ");
    recs.push({
      severity: low.pct < 40 ? "serious" : "warning",
      icon: "🥦",
      text: `${low.label} is at ~${Math.round(low.pct)}% of the recommended daily amount. Good sources: ${list}.`,
      search: sources[0] || null,
    });
  }

  const goods = cov.filter((c) => c.pct >= 90 && c.pct <= 130 && !["kcal", "fat", "carbs"].includes(c.key));
  if (goods.length >= 3) {
    recs.push({ severity: "good", icon: "✅", text: `Nicely covered this week: ${goods.slice(0, 4).map((g) => g.label).join(", ")}. Keep it up!`, search: null });
  }
  if (recs.length === 0) {
    recs.push({ severity: "good", icon: "🌟", text: "Your week looks balanced — no glaring gaps in the graph. Keep logging!", search: null });
  }
  return recs;
}

/** Days-in-a-row with at least one logged meal (ending today or yesterday). */
export function loggingStreak() {
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const has = edgesTo(`day:${todayKey(d)}`, "ATE_ON").length > 0;
    if (has) streak++;
    else if (i === 0) continue; // today may simply not be logged yet
    else break;
  }
  return streak;
}

export function graphStats() {
  return { nodes: nodes.size, edges: edges.size };
}
