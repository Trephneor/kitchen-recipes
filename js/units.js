// Converts TheMealDB's US/UK measures ("1 cup", "3 oz", "½ tsp") to Danish
// kitchen units (g, dl, spsk, tsk …) for display, and to grams for the
// nutrition estimate. Estimates are deliberately approximate — home cooking,
// not lab work.

const UNICODE_FRACTIONS = {
  "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3,
  "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

/** "1 1/2", "½", "3", "2-3" → number (ranges use the midpoint). */
function parseQuantity(text) {
  let s = text.trim();
  for (const [ch, val] of Object.entries(UNICODE_FRACTIONS)) {
    s = s.replace(ch, ` ${val} `);
  }
  const range = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:-|–|to)\s*(\d+(?:[.,]\d+)?)/);
  if (range) return { value: (parseFloat(range[1]) + parseFloat(range[2])) / 2, rest: s.slice(range[0].length) };

  let value = 0;
  let matched = false;
  let rest = s;
  while (true) {
    const m = rest.match(/^\s*(\d+)\s*\/\s*(\d+)/) || rest.match(/^\s*(\d+(?:[.,]\d+)?)/);
    if (!m) break;
    matched = true;
    value += m[2] !== undefined ? parseInt(m[1], 10) / parseInt(m[2], 10) : parseFloat(m[1].replace(",", "."));
    rest = rest.slice(m[0].length);
    if (!/^\s*\d/.test(rest) || /^\s*(\d+)\s*(g|kg|ml|l)/i.test(rest)) break;
  }
  return matched ? { value, rest } : { value: null, rest: s };
}

// unit → {dk: display converter, grams: grams-per-unit (approx, for nutrition)}
const UNITS = {
  oz:      { toDK: (v) => gram(v * 28.35), grams: (v) => v * 28.35 },
  ounce:   { alias: "oz" }, ounces: { alias: "oz" },
  lb:      { toDK: (v) => gram(v * 453.6), grams: (v) => v * 453.6 },
  lbs:     { alias: "lb" }, pound: { alias: "lb" }, pounds: { alias: "lb" },
  cup:     { toDK: (v) => deciliter(v * 2.4), grams: (v, density) => v * 240 * density },
  cups:    { alias: "cup" },
  tbsp:    { toDK: (v) => spoon(v, "spsk"), grams: (v, density) => v * 15 * density },
  tbs:     { alias: "tbsp" }, tblsp: { alias: "tbsp" }, tablespoon: { alias: "tbsp" }, tablespoons: { alias: "tbsp" },
  tsp:     { toDK: (v) => spoon(v, "tsk"), grams: (v, density) => v * 5 * density },
  teaspoon: { alias: "tsp" }, teaspoons: { alias: "tsp" },
  pint:    { toDK: (v) => deciliter(v * 4.73), grams: (v, density) => v * 473 * density },
  pints:   { alias: "pint" },
  quart:   { toDK: (v) => liter(v * 0.946), grams: (v, density) => v * 946 * density },
  gallon:  { toDK: (v) => liter(v * 3.785), grams: (v, density) => v * 3785 * density },
  "fl oz": { toDK: (v) => deciliter(v * 0.296), grams: (v, density) => v * 29.6 * density },
  stick:   { toDK: (v) => gram(v * 113), grams: (v) => v * 113 },
  sticks:  { alias: "stick" },
  inch:    { toDK: (v) => `${fmtDK(v * 2.54)} cm`, grams: () => null },
  g:       { toDK: (v) => gram(v), grams: (v) => v },
  gram:    { alias: "g" }, grams: { alias: "g" }, gr: { alias: "g" },
  kg:      { toDK: (v) => gram(v * 1000), grams: (v) => v * 1000 },
  ml:      { toDK: (v) => (v >= 100 ? deciliter(v / 100) : `${fmtDK(v)} ml`), grams: (v, density) => v * density },
  cl:      { toDK: (v) => deciliter(v / 10), grams: (v, density) => v * 10 * density },
  dl:      { toDK: (v) => deciliter(v), grams: (v, density) => v * 100 * density },
  l:       { toDK: (v) => liter(v), grams: (v, density) => v * 1000 * density },
  litre:   { alias: "l" }, liter: { alias: "l" }, litres: { alias: "l" },
};

// Descriptive units, translated to Danish; grams are typical piece weights.
const PIECE_UNITS = {
  clove:    { dk: (v) => `${fmtDK(v)} fed`, grams: 5 },
  cloves:   { alias: "clove" },
  slice:    { dk: (v) => `${fmtDK(v)} skive${v === 1 ? "" : "r"}`, grams: 25 },
  slices:   { alias: "slice" },
  pinch:    { dk: () => "1 knivspids", grams: 0.3 },
  dash:     { dk: () => "1 stænk", grams: 0.5 },
  handful:  { dk: (v) => `${fmtDK(v)} håndfuld${v === 1 ? "" : "e"}`, grams: 30 },
  can:      { dk: (v) => `${fmtDK(v)} dåse${v === 1 ? "" : "r"}`, grams: 400 },
  cans:     { alias: "can" }, tin: { alias: "can" }, tins: { alias: "can" },
  sprig:    { dk: (v) => `${fmtDK(v)} kvist${v === 1 ? "" : "e"}`, grams: 2 },
  sprigs:   { alias: "sprig" },
  bunch:    { dk: (v) => `${fmtDK(v)} bundt`, grams: 60 },
  leaves:   { dk: (v) => `${fmtDK(v)} blade`, grams: 0.5 },
  leaf:     { dk: (v) => `${fmtDK(v)} blad`, grams: 0.5 },
  piece:    { dk: (v) => `${fmtDK(v)} stk`, grams: 50 },
  pieces:   { alias: "piece" },
  fillet:   { dk: (v) => `${fmtDK(v)} filet${v === 1 ? "" : "er"}`, grams: 150 },
  fillets:  { alias: "fillet" },
  rasher:   { dk: (v) => `${fmtDK(v)} skive${v === 1 ? "" : "r"}`, grams: 25 },
  rashers:  { alias: "rasher" },
};

// Bare-count items ("2 eggs", "1 onion"): typical weight per piece in grams.
const PIECE_WEIGHTS = [
  [/egg/, 55], [/onion/, 110], [/shallot/, 40], [/garlic/, 5], [/tomato/, 120],
  [/potato/, 170], [/carrot/, 70], [/pepper|chilli|chili/, 45], [/lemon|lime/, 70],
  [/apple|orange/, 150], [/banana/, 120], [/avocado/, 170], [/leek/, 100],
  [/chicken breast/, 175], [/chicken thigh/, 120], [/bay leaf/, 0.2],
];

function fmtDK(value) {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("da-DK", { maximumFractionDigits: 2 });
}

function gram(value) {
  if (value >= 1000) return `${fmtDK(value / 1000)} kg`;
  return `${fmtDK(Math.round(value))} g`;
}

function deciliter(value) {
  const tenth = Math.round(value * 10) / 10;
  return `${fmtDK(tenth || value)} dl`;
}

function liter(value) { return `${fmtDK(value)} l`; }
function spoon(value, unit) { return `${fmtDK(value)} ${unit}`; }

function resolve(table, key) {
  const entry = table[key];
  return entry && entry.alias ? table[entry.alias] : entry;
}

function splitMeasure(measure) {
  const { value, rest } = parseQuantity(measure || "");
  let unitText = rest.trim().toLowerCase()
    .replace(/^of\s+/, "")
    .replace(/[.,]$/, "");
  if (/^fl\.?\s*oz/.test(unitText)) unitText = "fl oz";
  else unitText = unitText.split(/\s+/)[0] || "";
  return { value, unit: unitText, tail: rest.trim() };
}

/** Ingredient-aware density (g per ml) used when converting volume → grams. */
function densityFor(name) {
  const n = (name || "").toLowerCase();
  if (/flour|cocoa|oats/.test(n)) return 0.55;
  if (/sugar|rice|salt|lentil|couscous/.test(n)) return 0.85;
  if (/butter|oil|cream|mayo/.test(n)) return 0.95;
  if (/cheese|breadcrumb/.test(n)) return 0.45;
  if (/honey|syrup|jam/.test(n)) return 1.4;
  return 1.0; // water-like: milk, stock, wine, chopped produce
}

/** Display converter: "1 cup" → "2,5 dl", "4 oz" → "113 g", … */
export function toDanishMeasure(measure, ingredientName) {
  if (!measure || !measure.trim()) return "";
  const { value, unit } = splitMeasure(measure);
  if (value == null) return translateWords(measure);

  const conv = resolve(UNITS, unit);
  if (conv) return conv.toDK(value);

  const piece = resolve(PIECE_UNITS, unit);
  if (piece) return piece.dk(value);

  // Bare count ("2", "2 large") — keep the count, translate size words.
  return translateWords(measure);
}

function translateWords(text) {
  return text
    .replace(/(\d+(?:[.,]\d+)?)\s*oz\b\.?/gi, (m, v) => gram(parseFloat(v.replace(",", ".")) * 28.35))
    .replace(/\btins?\b/gi, "dåse")
    .replace(/\bcans?\b/gi, "dåse")
    .replace(/\bpinch\b/gi, "knivspids")
    .replace(/\bdash\b/gi, "stænk")
    .replace(/\blarge\b/gi, "stor")
    .replace(/\bmedium\b/gi, "mellem")
    .replace(/\bsmall\b/gi, "lille")
    .replace(/\bto taste\b/gi, "efter smag")
    .replace(/\bto serve\b/gi, "til servering")
    .replace(/\bchopped\b/gi, "hakket")
    .replace(/\bsliced\b/gi, "i skiver")
    .replace(/\bminced\b/gi, "finthakket")
    .trim();
}

/** Best-effort grams for nutrition estimation. Returns null when unknowable. */
export function measureToGrams(measure, ingredientName) {
  if (!measure || !measure.trim()) return null;

  // "1 (400g) tin", "1 (12 oz.) packet", "2 x 200 ml" — an embedded amount beats guessing.
  const embedded = measure.match(/(?:(\d+)\s*x\s*)?\(?(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|oz)\b/i);
  if (embedded) {
    const count = embedded[1] ? parseInt(embedded[1], 10) : 1;
    const amount = parseFloat(embedded[2].replace(",", "."));
    const density = densityFor(ingredientName);
    const factor = { g: 1, kg: 1000, oz: 28.35, ml: density, l: 1000 * density }[embedded[3].toLowerCase()];
    return Math.round(count * amount * factor);
  }

  const { value, unit } = splitMeasure(measure);
  const density = densityFor(ingredientName);

  if (value != null) {
    const conv = resolve(UNITS, unit);
    if (conv) {
      const grams = conv.grams(value, density);
      return grams == null ? null : Math.round(grams);
    }
    const piece = resolve(PIECE_UNITS, unit);
    if (piece) return Math.round(value * piece.grams);

    // Bare count: use a typical piece weight for the ingredient.
    const name = (ingredientName || "").toLowerCase();
    for (const [re, grams] of PIECE_WEIGHTS) {
      if (re.test(name)) return Math.round(value * grams);
    }
    return Math.round(value * 50); // generic "piece"
  }
  if (/to taste|pinch|dash|garnish|sprinkl/i.test(measure)) return 1;
  return null;
}

/** Adds °C after Fahrenheit temperatures in instruction text. */
export function convertTemperatures(text) {
  return (text || "").replace(/(\d{2,3})\s*°?\s*(?:degrees\s+)?F(?:ahrenheit)?\b/gi, (m, f) => {
    const c = Math.round(((parseInt(f, 10) - 32) * 5) / 9 / 5) * 5;
    return `${m} (${c} °C)`;
  });
}
