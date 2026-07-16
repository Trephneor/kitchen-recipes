// Hand-rolled SVG charts following the data-viz method: thin marks, recessive
// grid, one axis, legend + direct labels for multi-series, hover tooltips,
// and a data-table fallback under every chart. Colors come from the validated
// palette via CSS custom properties, so light/dark theming is automatic.

import { el, fmt } from "./ui.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function shortDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("da-DK", { day: "numeric", month: "short" });
}

function niceMax(value) {
  if (value <= 0) return 10;
  const mag = 10 ** Math.floor(Math.log10(value));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (value <= m * mag) return m * mag;
  }
  return 10 * mag;
}

function attachTooltip(wrap, svg, resolve) {
  const tip = el("div", { class: "chart-tip" });
  wrap.append(tip);
  const vb = svg.viewBox.baseVal;
  const move = (e) => {
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * vb.width;
    const y = ((e.clientY - rect.top) / rect.height) * vb.height;
    const hit = resolve(x, y);
    if (!hit) { tip.style.display = "none"; return; }
    tip.innerHTML = hit.html;
    tip.style.display = "block";
    const px = (hit.x / vb.width) * rect.width;
    const py = (hit.y / vb.height) * rect.height;
    tip.style.left = `${Math.min(px + 12, rect.width - tip.offsetWidth - 4)}px`;
    tip.style.top = `${Math.max(py - tip.offsetHeight - 10, 0)}px`;
  };
  svg.addEventListener("mousemove", move);
  svg.addEventListener("mouseleave", () => { tip.style.display = "none"; });
}

function dataTable(headers, rows) {
  return el("details", { class: "data-table" },
    el("summary", {}, "View data as table"),
    el("table", {},
      el("thead", {}, el("tr", {}, headers.map((h) => el("th", {}, h)))),
      el("tbody", {}, rows.map((r) => el("tr", {}, r.map((c) => el("td", {}, c))))),
    ),
  );
}

export function statTile({ label, value, unit, sub, tone }) {
  return el("div", { class: "tile" },
    el("div", { class: "t-label" }, label),
    el("div", { class: "t-value" }, value, unit ? el("small", {}, ` ${unit}`) : null),
    sub ? el("div", { class: `t-sub${tone ? ` ${tone}` : ""}` }, sub) : null,
  );
}

/** Single-series line chart (calories over time) with optional target line. */
export function lineChart({ points, unit = "", target = null }) {
  const W = 720, H = 260, padL = 46, padR = 14, padT = 14, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const values = points.map((p) => p.value);
  const yMax = niceMax(Math.max(...values, target || 0, 1) * 1.1);
  const xAt = (i) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yAt = (v) => padT + plotH - (v / yMax) * plotH;

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "Line chart" });

  for (let g = 0; g <= 4; g++) {
    const y = padT + (g / 4) * plotH;
    svg.append(svgEl("line", { x1: padL, x2: W - padR, y1: y, y2: y, stroke: "var(--grid)", "stroke-width": 1 }));
    const lbl = svgEl("text", { x: padL - 8, y: y + 4, "text-anchor": "end", "font-size": 11, fill: "var(--muted)" });
    lbl.textContent = fmt(yMax * (1 - g / 4));
    svg.append(lbl);
  }
  svg.append(svgEl("line", { x1: padL, x2: W - padR, y1: padT + plotH, y2: padT + plotH, stroke: "var(--baseline)", "stroke-width": 1 }));

  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  points.forEach((p, i) => {
    if (i % labelEvery !== 0 && i !== points.length - 1) return;
    const t = svgEl("text", { x: xAt(i), y: H - 8, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" });
    t.textContent = shortDate(p.date);
    svg.append(t);
  });

  if (target) {
    const y = yAt(target);
    svg.append(svgEl("line", { x1: padL, x2: W - padR, y1: y, y2: y, stroke: "var(--muted)", "stroke-width": 1.5, "stroke-dasharray": "5 4" }));
    const t = svgEl("text", { x: W - padR, y: y - 5, "text-anchor": "end", "font-size": 11, fill: "var(--muted)" });
    t.textContent = `target ${fmt(target)}`;
    svg.append(t);
  }

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(" ");
  svg.append(svgEl("path", { d: path, fill: "none", stroke: "var(--series-1)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));

  points.forEach((p, i) => {
    if (p.value <= 0) return;
    svg.append(svgEl("circle", {
      cx: xAt(i), cy: yAt(p.value), r: 3.5,
      fill: "var(--series-1)", stroke: "var(--surface)", "stroke-width": 2,
    }));
  });

  const wrap = el("div", { class: "chart-wrap" }, svg);
  attachTooltip(wrap, svg, (x) => {
    let best = 0, bestDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(xAt(i) - x);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    if (bestDist > 40) return null;
    const p = points[best];
    return { x: xAt(best), y: yAt(p.value), html: `<strong>${shortDate(p.date)}</strong><br>${fmt(p.value)} ${unit}` };
  });

  const container = el("div", {}, wrap,
    dataTable(["Day", unit || "value"], points.map((p) => [shortDate(p.date), fmt(p.value)])));
  return container;
}

/** Stacked bars (macros per day). series: [{key,label,cssVar}]; days: [{date, values}] */
export function stackedBarChart({ days, series, unit = "g" }) {
  const W = 720, H = 260, padL = 46, padR = 14, padT = 14, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const dayTotal = (d) => series.reduce((s, sr) => s + (d.values[sr.key] || 0), 0);
  const yMax = niceMax(Math.max(...days.map(dayTotal), 1) * 1.1);
  const slot = plotW / days.length;
  const barW = Math.min(46, slot * 0.66);
  const yAt = (v) => padT + plotH - (v / yMax) * plotH;

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "Stacked bar chart" });

  for (let g = 0; g <= 4; g++) {
    const y = padT + (g / 4) * plotH;
    svg.append(svgEl("line", { x1: padL, x2: W - padR, y1: y, y2: y, stroke: "var(--grid)", "stroke-width": 1 }));
    const lbl = svgEl("text", { x: padL - 8, y: y + 4, "text-anchor": "end", "font-size": 11, fill: "var(--muted)" });
    lbl.textContent = fmt(yMax * (1 - g / 4));
    svg.append(lbl);
  }
  svg.append(svgEl("line", { x1: padL, x2: W - padR, y1: padT + plotH, y2: padT + plotH, stroke: "var(--baseline)", "stroke-width": 1 }));

  const bars = []; // for tooltip hit-testing
  const labelEvery = Math.max(1, Math.ceil(days.length / 8));

  days.forEach((d, i) => {
    const cx = padL + slot * i + slot / 2;
    let acc = 0;
    series.forEach((sr, si) => {
      const v = d.values[sr.key] || 0;
      if (v <= 0) return;
      const y1 = yAt(acc + v), y0 = yAt(acc);
      const rect = svgEl("rect", {
        x: cx - barW / 2, y: y1, width: barW, height: Math.max(y0 - y1, 0),
        fill: `var(${sr.cssVar})`,
        stroke: "var(--surface)", "stroke-width": 2, // 2px surface gap between segments
        rx: si === series.length - 1 ? 4 : 0,        // rounded data-end on the top segment
      });
      svg.append(rect);
      acc += v;
    });
    bars.push({ x: cx, day: d });
    if (i % labelEvery === 0 || i === days.length - 1) {
      const t = svgEl("text", { x: cx, y: H - 8, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)" });
      t.textContent = shortDate(d.date);
      svg.append(t);
    }
  });

  const wrap = el("div", { class: "chart-wrap" }, svg);
  attachTooltip(wrap, svg, (x) => {
    let best = null, bestDist = Infinity;
    bars.forEach((b) => {
      const dd = Math.abs(b.x - x);
      if (dd < bestDist) { bestDist = dd; best = b; }
    });
    if (!best || bestDist > slot) return null;
    const lines = series.map((sr) => `${sr.label}: ${fmt(best.day.values[sr.key] || 0)} ${unit}`).join("<br>");
    return { x: best.x, y: padT + 20, html: `<strong>${shortDate(best.day.date)}</strong><br>${lines}` };
  });

  const legend = el("div", { class: "legend" }, series.map((sr) =>
    el("span", { class: "key" },
      el("span", { class: "swatch", style: `background: var(${sr.cssVar})` }),
      sr.label)));

  return el("div", {}, wrap, legend,
    dataTable(["Day", ...series.map((s) => `${s.label} (${unit})`)],
      days.map((d) => [shortDate(d.date), ...series.map((s) => fmt(d.values[s.key] || 0))])));
}

/** Horizontal coverage bars (% of daily target per nutrient) — one measure,
 * one hue; values are direct-labeled so color never carries meaning alone. */
export function coverageBars({ items }) {
  const W = 720, rowH = 34, padL = 120, padR = 88, padT = 8;
  const H = padT + items.length * rowH + 8;
  const plotW = W - padL - padR;
  const max = Math.max(140, ...items.map((i) => i.pct));
  const xAt = (pct) => padL + (Math.min(pct, max) / max) * plotW;

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "Nutrient coverage" });

  const targetX = xAt(100);
  svg.append(svgEl("line", { x1: targetX, x2: targetX, y1: padT, y2: H - 8, stroke: "var(--muted)", "stroke-width": 1.5, "stroke-dasharray": "5 4" }));
  const tl = svgEl("text", { x: targetX, y: H - 0.5, "text-anchor": "middle", "font-size": 10, fill: "var(--muted)" });
  tl.textContent = "100%";
  svg.append(tl);

  items.forEach((item, i) => {
    const y = padT + i * rowH + rowH / 2;
    const name = svgEl("text", { x: padL - 10, y: y + 4, "text-anchor": "end", "font-size": 12, fill: "var(--ink-2)" });
    name.textContent = item.label;
    svg.append(name);

    const w = Math.max(xAt(item.pct) - padL, 2);
    svg.append(svgEl("rect", {
      x: padL, y: y - 8, width: w, height: 16, rx: 4,
      fill: "var(--seq-450)",
      opacity: item.pct >= 70 ? 1 : 0.55, // low coverage recedes; label carries the value
    }));

    const val = svgEl("text", { x: padL + w + 8, y: y + 4, "font-size": 12, "font-weight": 700, fill: "var(--ink)" });
    val.textContent = `${Math.round(item.pct)}%`;
    svg.append(val);
  });

  const wrap = el("div", { class: "chart-wrap" }, svg);
  return el("div", {}, wrap,
    dataTable(["Nutrient", "Avg/day", "Target", "%"],
      items.map((i) => [i.label, `${fmt(i.avg, 1)} ${i.unit}`, `${fmt(i.target)} ${i.unit}`, `${Math.round(i.pct)}%`])));
}
