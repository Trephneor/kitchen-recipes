// Diet overview: stat tiles, calories-over-time, macro split per day,
// nutrient coverage vs daily targets, and graph-driven recommendations.

import { el, clear, icon, fmt } from "../ui.js";
import { loadGraph, dailyTotals, coverage, recommendations, loggingStreak, graphStats } from "../graph.js";
import { statTile, lineChart, stackedBarChart, coverageBars } from "../charts.js";
import { kvGet } from "../store.js";
import { NUTRIENT_META } from "../nutrition.js";

let period = 14;

export async function render(container) {
  clear(container);
  await loadGraph();
  const settings = await kvGet("settings", {});
  const kcalTarget = Number(settings.kcalTarget) || NUTRIENT_META.kcal.target;

  const days = dailyTotals(period);
  const loggedDays = days.filter((d) => d.mealCount > 0);
  const today = days[days.length - 1];
  const streak = loggingStreak();
  const stats = graphStats();

  const avgKcal = loggedDays.length
    ? loggedDays.reduce((s, d) => s + d.totals.kcal, 0) / loggedDays.length
    : 0;

  const periodSel = el("select", {
    "aria-label": "Period",
    onchange: () => { period = Number(periodSel.value); render(container); },
  },
    [7, 14, 30].map((n) => el("option", { value: n, selected: period === n || null }, `Last ${n} days`)));

  container.append(
    el("div", { class: "row spread" },
      el("h2", { style: "margin:0.2rem 0" }, "Diet overview"),
      periodSel),
  );

  if (loggedDays.length === 0) {
    container.append(el("div", { class: "empty-state" },
      el("div", { class: "big" }, "📈"),
      el("h3", {}, "No meals in this period yet"),
      el("p", {}, "Log what you cook and the graphs will grow."),
      el("button", { class: "primary", onclick: () => { location.hash = "#/diary"; } }, icon("plus"), "Log your first meal")));
    return;
  }

  // ---- stat tiles ----
  const todayDelta = today.totals.kcal - kcalTarget;
  container.append(el("div", { class: "tiles", style: "margin-top:0.8rem" },
    statTile({
      label: "Today", value: fmt(today.totals.kcal), unit: "kcal",
      sub: today.mealCount === 0 ? "nothing logged yet" : `${todayDelta > 0 ? "+" : ""}${fmt(todayDelta)} vs target`,
      tone: today.mealCount === 0 ? null : Math.abs(todayDelta) < kcalTarget * 0.15 ? "good" : "bad",
    }),
    statTile({ label: `Avg / day (${loggedDays.length} logged)`, value: fmt(avgKcal), unit: "kcal", sub: `target ${fmt(kcalTarget)}` }),
    statTile({ label: "Protein today", value: fmt(today.totals.protein), unit: "g", sub: `target ${NUTRIENT_META.protein.target} g` }),
    statTile({ label: "Logging streak", value: String(streak), unit: streak === 1 ? "day" : "days", sub: `${stats.nodes} nodes · ${stats.edges} edges in your food graph` }),
  ));

  // ---- calories over time ----
  container.append(el("div", { class: "card chart-card" },
    el("h3", {}, "Calories per day"),
    el("div", { class: "sub" }, "Estimated energy intake from logged meals; dashed line is your daily target."),
    lineChart({
      points: days.map((d) => ({ date: d.date, value: Math.round(d.totals.kcal) })),
      unit: "kcal",
      target: kcalTarget,
    })));

  // ---- macro split ----
  container.append(el("div", { class: "card chart-card" },
    el("h3", {}, "Macronutrients per day"),
    el("div", { class: "sub" }, "Grams of protein, carbohydrate and fat in the meals you logged."),
    stackedBarChart({
      days: days.map((d) => ({
        date: d.date,
        values: {
          protein: Math.round(d.totals.protein),
          carbs: Math.round(d.totals.carbs),
          fat: Math.round(d.totals.fat),
        },
      })),
      series: [
        { key: "protein", label: "Protein", cssVar: "--series-1" },
        { key: "carbs", label: "Carbs", cssVar: "--series-2" },
        { key: "fat", label: "Fat", cssVar: "--series-3" },
      ],
      unit: "g",
    })));

  // ---- nutrient coverage ----
  const cov = coverage(period).filter((c) => c.key !== "kcal");
  container.append(el("div", { class: "card chart-card" },
    el("h3", {}, "Nutrient coverage"),
    el("div", { class: "sub" }, `Average daily intake vs recommended amounts, across the ${loggedDays.length} logged day${loggedDays.length === 1 ? "" : "s"}.`),
    coverageBars({ items: cov })));

  // ---- recommendations ----
  const recs = recommendations(7);
  container.append(el("div", { class: "card chart-card" },
    el("h3", {}, "Suggestions from your food graph"),
    el("div", { class: "sub" }, "Based on the last 7 days of meals, ingredients and nutrients you've logged."),
    ...recs.map((r) => el("div", { class: "reco" },
      el("span", { class: "dot" }, r.icon),
      el("div", { class: "grow" },
        el("div", {}, r.text),
        r.search
          ? el("button", {
              class: "ghost", style: "margin-top:0.3rem;color:var(--accent-text)",
              onclick: () => { location.hash = `#/recipes?ingredient=${encodeURIComponent(r.search)}`; },
            }, icon("search"), `Find recipes with ${r.search}`)
          : null)))));
}
