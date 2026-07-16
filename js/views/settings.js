// Settings: theme, calorie target, voice language, optional Claude API key,
// and data export/import.

import { el, clear, icon, toast } from "../ui.js";
import { kvGet, kvSet, exportData, importData, wipeAll } from "../store.js";

export async function render(container) {
  clear(container);
  const settings = await kvGet("settings", {});

  const save = async (patch) => {
    Object.assign(settings, patch);
    await kvSet("settings", settings);
    toast("Saved");
  };

  const themeSel = el("select", {
    onchange: () => {
      save({ theme: themeSel.value });
      applyTheme(themeSel.value);
    },
  },
    el("option", { value: "auto", selected: (settings.theme || "auto") === "auto" || null }, "Follow system"),
    el("option", { value: "light", selected: settings.theme === "light" || null }, "Light"),
    el("option", { value: "dark", selected: settings.theme === "dark" || null }, "Dark"));

  const kcalInput = el("input", { type: "number", min: 1000, max: 5000, step: 50, value: settings.kcalTarget || 2000 });
  const langSel = el("select", {},
    el("option", { value: "da-DK", selected: (settings.voiceLang || "da-DK") === "da-DK" || null }, "Dansk (da-DK)"),
    el("option", { value: "en-US", selected: settings.voiceLang === "en-US" || null }, "English (en-US)"),
    el("option", { value: "en-GB", selected: settings.voiceLang === "en-GB" || null }, "English (en-GB)"));
  const keyInput = el("input", { type: "password", value: settings.claudeKey || "", placeholder: "sk-ant-…", autocomplete: "off" });

  container.append(
    el("h2", {}, "Settings"),

    el("div", { class: "card", style: "display:flex;flex-direction:column;gap:1rem" },
      el("label", { class: "field" }, el("span", {}, "Theme"), themeSel),
      el("label", { class: "field" }, el("span", {}, "Daily calorie target (kcal)"), kcalInput),
      el("label", { class: "field" }, el("span", {}, "Voice input language"), langSel),
      el("button", {
        class: "primary", style: "align-self:flex-start",
        onclick: () => save({ kcalTarget: Number(kcalInput.value) || 2000, voiceLang: langSel.value }),
      }, "Save")),

    el("h2", { class: "section-title" }, "Claude AI (optional)"),
    el("div", { class: "card", style: "display:flex;flex-direction:column;gap:0.8rem" },
      el("p", { class: "hint", style: "margin:0" },
        "With an Anthropic API key, dictated meal descriptions are parsed by Claude into foods and portion sizes. ",
        "The key is stored only in this browser and sent only to api.anthropic.com. Without a key, a simpler built-in matcher is used."),
      el("label", { class: "field" }, el("span", {}, "Anthropic API key"), keyInput),
      el("div", { class: "row" },
        el("button", { class: "primary", onclick: () => save({ claudeKey: keyInput.value.trim() }) }, "Save key"),
        el("button", { onclick: () => { keyInput.value = ""; save({ claudeKey: "" }); } }, "Remove key"))),

    el("h2", { class: "section-title" }, "Your data"),
    el("div", { class: "card row" },
      el("button", {
        onclick: async () => {
          const json = await exportData();
          const blob = new Blob([json], { type: "application/json" });
          const a = el("a", { href: URL.createObjectURL(blob), download: `kitchen-recipes-backup-${new Date().toISOString().slice(0, 10)}.json` });
          a.click();
          URL.revokeObjectURL(a.href);
        },
      }, icon("download"), "Export backup"),
      el("button", {
        onclick: () => {
          const input = el("input", { type: "file", accept: "application/json" });
          input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            try {
              await importData(await file.text());
              toast("Backup imported — reloading…");
              setTimeout(() => location.reload(), 800);
            } catch (err) {
              toast(`Import failed: ${err.message}`, 5000);
            }
          };
          input.click();
        },
      }, icon("upload"), "Import backup"),
      el("button", {
        class: "danger",
        onclick: async () => {
          if (!confirm("Delete ALL local data — favorites, ratings, diary and the food graph?")) return;
          await wipeAll();
          toast("All data deleted");
          setTimeout(() => location.reload(), 800);
        },
      }, icon("trash"), "Delete all data")),

    el("p", { class: "hint", style: "margin-top:1.5rem" },
      "Recipes come from TheMealDB (public API). All personal data — photos, diary, ratings — stays on this device. ",
      "Nutrition values are estimates for insight, not medical advice."),
  );
}

const THEME_COLORS = { light: "#f4efe6", dark: "#14110e" };

export function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
  // Keep the browser/PWA chrome color in sync with the effective theme.
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const scheme = theme === "light" || theme === "dark"
      ? theme
      : (meta.media || "").includes("dark") ? "dark" : "light";
    meta.setAttribute("content", THEME_COLORS[scheme]);
  });
}
