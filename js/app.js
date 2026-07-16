// App shell: hash router, theme bootstrap, service-worker registration.

import { kvGet } from "./store.js";
import { loadGraph } from "./graph.js";
import { applyTheme } from "./views/settings.js";
import * as recipes from "./views/recipes.js";
import * as recipe from "./views/recipe.js";
import * as diary from "./views/diary.js";
import * as dashboard from "./views/dashboard.js";
import * as settings from "./views/settings.js";

const main = document.getElementById("main");
const tabs = document.getElementById("tabs");

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, "") || "recipes";
  const [pathPart, queryPart] = hash.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(queryPart || ""));
  return { route: segments[0] || "recipes", arg: segments[1] || null, params };
}

async function route() {
  // Cross-fade between views where the browser supports View Transitions.
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (document.startViewTransition && !reduced && main.childElementCount > 0) {
    document.startViewTransition(() => renderRoute());
  } else {
    await renderRoute();
  }
}

async function renderRoute() {
  const { route, arg, params } = parseHash();

  for (const link of tabs.querySelectorAll("a")) {
    const r = link.dataset.route;
    const active = r === route || (route === "recipe" && r === "recipes");
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }

  window.scrollTo({ top: 0 });
  try {
    switch (route) {
      case "recipe":    await recipe.render(main, arg); break;
      case "diary":     await diary.render(main); break;
      case "dashboard": await dashboard.render(main); break;
      case "settings":  await settings.render(main); break;
      case "recipes":
      default:          await recipes.render(main, params); break;
    }
  } catch (err) {
    console.error(err);
    main.replaceChildren();
    const div = document.createElement("div");
    div.className = "empty-state";
    div.textContent = `Something went wrong: ${err.message || err}`;
    main.append(div);
  }
}

async function init() {
  const stored = await kvGet("settings", {});
  applyTheme(stored.theme || "auto");
  await loadGraph().catch((err) => console.warn("graph load failed", err));

  window.addEventListener("hashchange", route);
  await route();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW registration failed", err));
  }
}

init();
