// Hand-drawn stroke icons for TheMealDB recipe categories — same visual
// language as the UI icon set (24×24 grid, round caps), food-specific.

const CATEGORY_ICONS = {
  all: '<path d="M5 3v4.5a2 2 0 0 0 4 0V3"/><line x1="7" y1="7.5" x2="7" y2="21"/><path d="M18 3c-2.4 1.2-3.8 3.6-3.8 6v3.2H18"/><line x1="18" y1="3" x2="18" y2="21"/>',
  beef: '<path d="M5 9.5c1.5-3 5-4.6 8.5-4.1 3.1.4 5.5 2.5 5.5 5.1 0 3.6-3.1 6.5-7 6.5-4.6 0-8.2-2.6-7-7.5z"/><path d="M8.3 9.3c2-1.4 4.4-1.6 6.4-.5"/><circle cx="15.6" cy="12.9" r="1.5"/>',
  breakfast: '<path d="M13.2 4.3c3.8.6 6.9 3.6 6.6 7-.3 3.2-3.1 5.6-6.1 6.4-3.5.9-7.8-.2-9.2-3.3-1.2-2.6 0-5.5 2-7.1 1.9-1.6 4-3.4 6.7-3z"/><circle cx="11.5" cy="12" r="3"/>',
  chicken: '<path d="M14.6 4.2a5.6 5.6 0 0 1 5.2 5.1 5.6 5.6 0 0 1-6.5 5.5l-2.8 2.8-3.1-3.1 2.8-2.8a5.6 5.6 0 0 1 4.4-7.5z"/><path d="M10.1 15l-3.3 3.3"/><circle cx="4.9" cy="17.5" r="1.5"/><circle cx="7.5" cy="20.1" r="1.5"/>',
  dessert: '<path d="M7 12.5h10l-1.1 6a1.6 1.6 0 0 1-1.6 1.3H9.7a1.6 1.6 0 0 1-1.6-1.3z"/><path d="M7 12.5a5 5 0 0 1 10 0"/><circle cx="12" cy="5.4" r="1.3"/><path d="M10.3 13v6.6M13.7 13v6.6"/>',
  goat: '<path d="M8.5 7.5C7 6.8 6 5.2 6 3.2c1.8.2 3.2 1.2 4 2.9"/><path d="M15.5 7.5c1.5-.7 2.5-2.3 2.5-4.3-1.8.2-3.2 1.2-4 2.9"/><path d="M8 7.5h8l-1.2 6.6a4.1 4.1 0 0 1-2.8 3.3 4.1 4.1 0 0 1-2.8-3.3z"/><path d="M10.4 11h.01M13.6 11h.01"/><path d="M12 17.4v2.4"/>',
  lamb: '<path d="M6.5 12.6a3 3 0 0 1-.6-5.6 3.2 3.2 0 0 1 3-3.2 3.2 3.2 0 0 1 5.4-.4 3.2 3.2 0 0 1 3.5 1.9 3 3 0 0 1-1.2 5.7z"/><path d="M8.7 12.6v4.6M14 12.6v4.6"/><circle cx="18.3" cy="11.2" r="2.3"/><path d="M18.1 11.2h.01"/>',
  miscellaneous: '<path d="M4 16.5h16"/><path d="M5.5 16.5a6.5 6.5 0 0 1 13 0"/><line x1="12" y1="10" x2="12" y2="8.8"/><circle cx="12" cy="7.4" r="1"/>',
  pasta: '<path d="M4 12.5h16a8 8 0 0 1-16 0z"/><path d="M7.2 9.6c1.2-1 2.4-1 3.6 0s2.4 1 3.6 0 2.2-1 3.4 0"/><path d="M8.4 6.6c1-.9 2-.9 3 0s2 .9 3 0 2-.9 3 0"/>',
  pork: '<circle cx="12" cy="12.5" r="7.6"/><ellipse cx="12" cy="13.6" rx="3" ry="2.2"/><path d="M11 13.6h.01M13 13.6h.01"/><path d="M5.6 8.4 4.2 5.4l3.1 1M18.4 8.4l1.4-3-3.1 1"/><path d="M9.2 9.8h.01M14.8 9.8h.01"/>',
  seafood: '<path d="M6.4 12c2-3.4 5.4-5 8.9-5 2.6 0 4.7 2 5.2 5-.5 3-2.6 5-5.2 5-3.5 0-6.9-1.6-8.9-5z"/><path d="M6.4 12 3.2 8.9v6.2z"/><path d="M17.3 10.6h.01"/>',
  side: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.4"/>',
  starter: '<path d="M9 3h6"/><path d="M12 3v9.3"/><circle cx="12" cy="15.4" r="3.1"/><path d="M12 18.5V21"/>',
  vegan: '<path d="M5.5 18.5C5.5 11 10.6 6 19 5.5c-.5 8.4-5.5 13.4-13.5 13z"/><path d="M5.5 18.5C8 14.4 11.4 11 15 8.7"/>',
  vegetarian: '<circle cx="12" cy="13.6" r="6.8"/><path d="M12 6.8C11.2 5 9.6 4.2 7.8 4.1c.9 1.8 2.3 2.7 4.2 2.7z"/><path d="M12 6.8c.8-1.8 2.4-2.6 4.2-2.7-.9 1.8-2.3 2.7-4.2 2.7z"/><path d="M12 6.8v2.1"/>',
};

/** Small stroke icon for a recipe category; null when we have none. */
export function categoryIcon(name) {
  const paths = CATEGORY_ICONS[(name || "").toLowerCase()];
  if (!paths) return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = paths;
  return svg;
}

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS);
