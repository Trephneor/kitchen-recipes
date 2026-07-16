// Food diary: photograph the meal you made, describe it (typed or dictated —
// optionally structured by Claude), and it is stored in the nutrition graph.

import { el, clear, icon, modal, toast, fmt } from "../ui.js";
import { addMeal, getMeals, deleteMeal, kvGet } from "../store.js";
import { logMealToGraph, removeMealFromGraph } from "../graph.js";
import { lookupFood, emptyTotals, addScaled, guessFoodsFromText } from "../nutrition.js";
import { parseFoodsWithClaude } from "../claude.js";
import { startDictation, voiceSupported } from "../voice.js";

function totalsFor(foods) {
  const totals = emptyTotals();
  const unmatched = [];
  for (const f of foods) {
    const match = lookupFood(f.name);
    if (match) addScaled(totals, match.per100, f.grams || 0);
    else unmatched.push(f.name);
  }
  return { totals, unmatched };
}

/**
 * Shared "Log a meal" dialog. prefill: {title, recipeId, foods:[{name,grams}]}.
 * onSaved() is called after the meal is stored.
 */
export async function openLogMealModal(prefill = {}, onSaved = null) {
  const settings = await kvGet("settings", {});
  let photoBlob = null;
  let dictation = null;
  let foods = (prefill.foods || []).map((f) => ({ ...f }));

  modal((close) => {
    const title = el("input", { type: "text", value: prefill.title || "", placeholder: "e.g. Chicken curry with rice" });
    const desc = el("textarea", { placeholder: "What did you eat? Dictate or type — e.g. “a bowl of chicken curry with rice and half an avocado”." });

    const photoImg = el("img", { class: "photo-preview", alt: "Meal photo", style: "display:none" });
    const photoInput = el("input", {
      type: "file", accept: "image/*", capture: "environment", style: "display:none",
      onchange: () => {
        const file = photoInput.files[0];
        if (!file) return;
        photoBlob = file;
        photoImg.src = URL.createObjectURL(file);
        photoImg.style.display = "block";
      },
    });

    const foodRows = el("div", { class: "food-rows" });
    const nutritionPreview = el("div", { class: "hint" });

    function renderFoods() {
      foodRows.replaceChildren(...foods.map((food, i) =>
        el("div", { class: "row" },
          el("input", {
            type: "text", value: food.name, placeholder: "Food", "aria-label": "Food name",
            oninput: (e) => { food.name = e.target.value; renderPreview(); },
          }),
          el("input", {
            type: "number", class: "grams", value: food.grams || "", placeholder: "grams", min: 0, "aria-label": "Grams",
            oninput: (e) => { food.grams = Number(e.target.value) || 0; renderPreview(); },
          }),
          el("button", { class: "ghost icon-btn", "aria-label": `Remove ${food.name || "food"}`, onclick: () => { foods.splice(i, 1); renderFoods(); } }, icon("x")),
        )));
      foodRows.append(el("button", { class: "ghost", style: "align-self:flex-start", onclick: () => { foods.push({ name: "", grams: 100 }); renderFoods(); } }, icon("plus"), "Add food"));
      renderPreview();
    }

    function renderPreview() {
      const { totals, unmatched } = totalsFor(foods.filter((f) => f.name));
      const bits = [
        `≈ ${fmt(totals.kcal)} kcal`,
        `${fmt(totals.protein)} g protein`,
        `${fmt(totals.fat)} g fat`,
        `${fmt(totals.carbs)} g carbs`,
      ];
      nutritionPreview.textContent = foods.length ? bits.join(" · ") : "";
      if (unmatched.length) {
        nutritionPreview.textContent += ` — no nutrition data for: ${unmatched.join(", ")}`;
      }
    }

    const micIdle = () => micBtn.replaceChildren(icon("mic"), "Dictate");
    const micBtn = el("button", {
      class: "mic-btn",
      style: voiceSupported() ? "" : "display:none",
      onclick: () => {
        if (dictation) {
          dictation.stop(); dictation = null;
          micBtn.classList.remove("recording");
          micIdle();
          return;
        }
        const base = desc.value ? desc.value + " " : "";
        dictation = startDictation({
          lang: settings.voiceLang || "da-DK",
          onResult: (text) => { desc.value = base + text; },
          onEnd: () => { dictation = null; micBtn.classList.remove("recording"); micIdle(); },
          onError: (message) => toast(message, 4500),
        });
        micBtn.classList.add("recording");
        micBtn.replaceChildren(icon("stop"), "Stop");
      },
    });
    micIdle();

    const analyzeLabel = () => (settings.claudeKey ? "Analyse with Claude" : "Analyse description");
    const analyzeBtn = el("button", {
      onclick: async () => {
        const text = desc.value.trim() || title.value.trim();
        if (!text) { toast("Describe the meal first."); return; }
        analyzeBtn.disabled = true;
        analyzeBtn.replaceChildren("Analysing…");
        try {
          if (settings.claudeKey) {
            const parsed = await parseFoodsWithClaude(text, settings.claudeKey);
            foods = parsed.foods.map((f) => ({ name: f.name, grams: f.grams }));
            if (!title.value && parsed.summary) title.value = parsed.summary;
            toast("Claude broke the meal into foods — adjust weights if needed.");
          } else {
            foods = guessFoodsFromText(text);
            toast(foods.length
              ? "Matched foods from the description (offline mode). Add a Claude API key in Settings for smarter parsing."
              : "No known foods recognised — add them manually, or set a Claude API key in Settings.");
          }
          renderFoods();
        } catch (err) {
          toast(String(err.message || err), 5000);
        } finally {
          analyzeBtn.disabled = false;
          analyzeBtn.replaceChildren(icon("sparkles"), analyzeLabel());
        }
      },
    }, icon("sparkles"), analyzeLabel());

    renderFoods();

    return el("div", {},
      el("h2", {}, prefill.recipeId ? "Log this meal" : "Log a meal"),
      el("div", { class: "row", style: "margin-bottom:0.9rem" },
        el("button", { class: "primary", onclick: () => photoInput.click() }, icon("camera"), "Take photo"),
        micBtn, analyzeBtn),
      photoInput, photoImg,
      el("div", { style: "display:flex;flex-direction:column;gap:0.9rem;margin-top:0.9rem" },
        el("label", { class: "field" }, el("span", {}, "Meal name"), title),
        el("label", { class: "field" }, el("span", {}, "Description (saved with the photo)"), desc),
        el("label", { class: "field" }, el("span", {}, "Foods eaten (estimated grams)"), foodRows),
        nutritionPreview),
      el("div", { class: "row spread", style: "margin-top:1.2rem" },
        el("button", { class: "ghost", onclick: close }, "Cancel"),
        el("button", {
          class: "primary",
          onclick: async () => {
            const cleanFoods = foods.filter((f) => f.name && f.grams > 0);
            if (!title.value.trim() && cleanFoods.length === 0) {
              toast("Give the meal a name or add at least one food.");
              return;
            }
            const id = crypto.randomUUID();
            const ts = Date.now();
            const { totals } = totalsFor(cleanFoods);
            await addMeal({
              id, ts,
              title: title.value.trim() || "Meal",
              description: desc.value.trim(),
              recipeId: prefill.recipeId || null,
              foods: cleanFoods,
              totals,
              photo: photoBlob,
            });
            await logMealToGraph({ mealId: id, title: title.value.trim() || "Meal", ts, recipeId: prefill.recipeId || null, foods: cleanFoods });
            toast("Meal logged 🎉");
            close();
            onSaved?.();
          },
        }, icon("check"), "Save meal")),
    );
  });
}

export async function render(container) {
  clear(container);
  container.append(
    el("div", { class: "row spread" },
      el("h2", { style: "margin:0.2rem 0" }, "Food diary"),
      el("button", { class: "primary", onclick: () => openLogMealModal({}, () => render(container)) }, icon("plus"), "Log a meal")),
  );

  const meals = await getMeals();
  if (meals.length === 0) {
    container.append(el("div", { class: "empty-state" },
      el("div", { class: "big" }, "🥗"),
      el("h3", {}, "Nothing logged yet"),
      el("p", {}, "Cook something, snap a photo of the plate and tell me what's on it.")));
    return;
  }

  const list = el("div", { style: "display:flex;flex-direction:column;gap:0.8rem;margin-top:1rem" });
  let lastDay = "";
  for (const meal of meals) {
    const day = new Date(meal.ts).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" });
    if (day !== lastDay) {
      list.append(el("h3", { class: "section-title" }, day));
      lastDay = day;
    }
    const time = new Date(meal.ts).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
    const photo = meal.photo instanceof Blob
      ? el("img", { class: "photo", src: URL.createObjectURL(meal.photo), alt: meal.title })
      : el("div", { class: "no-photo" }, "🍽️");

    list.append(el("div", { class: "card meal-entry" },
      photo,
      el("div", { class: "grow" },
        el("h3", {}, meal.title),
        el("div", { class: "hint" }, time,
          meal.recipeId ? el("a", { href: `#/recipe/${meal.recipeId}`, style: "margin-left:0.5rem" }, "view recipe") : null),
        meal.description ? el("p", { style: "margin:0.3rem 0" }, meal.description) : null,
        el("div", {},
          el("span", { class: "meal-kcal" }, `${fmt(meal.totals?.kcal)} kcal`),
          el("span", { class: "hint" },
            `  ·  ${fmt(meal.totals?.protein)} g protein · ${fmt(meal.totals?.fat)} g fat · ${fmt(meal.totals?.carbs)} g carbs`)),
        meal.foods?.length
          ? el("details", { class: "data-table" },
              el("summary", {}, `${meal.foods.length} foods`),
              el("ul", {}, meal.foods.map((f) => el("li", {}, `${f.name} — ${fmt(f.grams)} g`))))
          : null),
      el("button", {
        class: "ghost icon-btn", "aria-label": `Delete ${meal.title}`,
        onclick: async () => {
          if (!confirm(`Delete "${meal.title}" from the diary?`)) return;
          await deleteMeal(meal.id);
          await removeMealFromGraph(meal.id);
          render(container);
        },
      }, icon("trash"))));
  }
  container.append(list);
}
