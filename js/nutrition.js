// A compact per-100 g nutrition table for ingredients that commonly appear in
// TheMealDB recipes, plus daily reference targets (Nordic Nutrition
// Recommendations, adult ballpark). All values are approximations for
// home-cooking insight — not medical data.

export const NUTRIENT_META = {
  kcal:      { label: "Calories",   unit: "kcal", target: 2000 },
  protein:   { label: "Protein",    unit: "g",    target: 60 },
  fat:       { label: "Fat",        unit: "g",    target: 70 },
  carbs:     { label: "Carbs",      unit: "g",    target: 250 },
  fiber:     { label: "Fiber",      unit: "g",    target: 30 },
  vitA:      { label: "Vitamin A",  unit: "µg",   target: 800 },
  vitC:      { label: "Vitamin C",  unit: "mg",   target: 80 },
  vitD:      { label: "Vitamin D",  unit: "µg",   target: 10 },
  b12:       { label: "Vitamin B12", unit: "µg",  target: 4 },
  iron:      { label: "Iron",       unit: "mg",   target: 11 },
  calcium:   { label: "Calcium",    unit: "mg",   target: 800 },
  potassium: { label: "Potassium",  unit: "mg",   target: 3500 },
  magnesium: { label: "Magnesium",  unit: "mg",   target: 350 },
};

export const NUTRIENT_KEYS = Object.keys(NUTRIENT_META);

// [kcal, protein, fat, carbs, fiber, vitA µg, vitC mg, vitD µg, B12 µg, iron mg, calcium mg, potassium mg, magnesium mg]
const N = (arr) => Object.fromEntries(NUTRIENT_KEYS.map((k, i) => [k, arr[i] || 0]));

const FOODS = {
  // — meat & poultry —
  "chicken":        N([165, 31, 3.6, 0, 0, 9, 0, 0.1, 0.3, 0.9, 11, 256, 27]),
  "chicken breast": N([165, 31, 3.6, 0, 0, 9, 0, 0.1, 0.3, 0.9, 11, 256, 27]),
  "chicken thigh":  N([209, 26, 11, 0, 0, 18, 0, 0.1, 0.6, 1.3, 9, 230, 23]),
  "beef":           N([250, 26, 15, 0, 0, 0, 0, 0.1, 2.6, 2.6, 12, 318, 21]),
  "ground beef":    N([254, 26, 16, 0, 0, 0, 0, 0.1, 2.5, 2.5, 12, 318, 20]),
  "minced beef":    N([254, 26, 16, 0, 0, 0, 0, 0.1, 2.5, 2.5, 12, 318, 20]),
  "beef brisket":   N([290, 24, 21, 0, 0, 0, 0, 0.1, 2.4, 2.2, 12, 250, 18]),
  "steak":          N([252, 27, 15, 0, 0, 0, 0, 0.1, 2.6, 2.7, 12, 330, 22]),
  "pork":           N([242, 27, 14, 0, 0, 2, 0.6, 0.5, 0.7, 0.9, 19, 423, 28]),
  "bacon":          N([541, 37, 42, 1.4, 0, 11, 0, 0.4, 1.2, 1.4, 11, 565, 33]),
  "ham":            N([145, 21, 6, 1.5, 0, 0, 0, 0.6, 0.7, 1, 8, 340, 22]),
  "lamb":           N([294, 25, 21, 0, 0, 0, 0, 0.1, 2.6, 1.9, 17, 310, 23]),
  "sausage":        N([301, 12, 27, 2, 0, 0, 0, 0.8, 1, 1.1, 20, 200, 14]),
  "duck":           N([337, 19, 28, 0, 0, 63, 3, 0.3, 0.3, 2.7, 11, 204, 16]),
  "turkey":         N([189, 29, 7, 0, 0, 0, 0, 0.3, 0.4, 1.1, 12, 240, 28]),

  // — fish & seafood —
  "salmon":         N([208, 20, 13, 0, 0, 12, 4, 11, 3.2, 0.3, 9, 363, 27]),
  "cod":            N([82, 18, 0.7, 0, 0, 12, 1, 1, 0.9, 0.4, 16, 413, 32]),
  "tuna":           N([132, 28, 1.3, 0, 0, 16, 0, 2, 2.2, 1, 4, 323, 35]),
  "haddock":        N([90, 20, 0.6, 0, 0, 17, 0, 0.5, 1.2, 0.2, 14, 351, 26]),
  "prawn":          N([99, 24, 0.3, 0.2, 0, 54, 0, 0.1, 1.1, 0.5, 70, 259, 35]),
  "shrimp":         N([99, 24, 0.3, 0.2, 0, 54, 0, 0.1, 1.1, 0.5, 70, 259, 35]),
  "mackerel":       N([205, 19, 14, 0, 0, 50, 0.4, 16, 8.7, 1.6, 12, 314, 76]),
  "sardine":        N([208, 25, 11, 0, 0, 32, 0, 4.8, 8.9, 2.9, 382, 397, 39]),
  "anchovy":        N([131, 20, 4.8, 0, 0, 15, 0, 1.7, 0.6, 3.3, 147, 383, 41]),
  "mussel":         N([172, 24, 4.5, 7, 0, 90, 13.6, 0.1, 24, 6.7, 33, 268, 37]),

  // — dairy & eggs —
  "egg":            N([143, 13, 9.5, 0.7, 0, 160, 0, 2, 0.9, 1.8, 56, 138, 12]),
  "milk":           N([61, 3.3, 3.3, 4.8, 0, 46, 0, 1.2, 0.5, 0, 113, 132, 10]),
  "butter":         N([717, 0.9, 81, 0.1, 0, 684, 0, 1.5, 0.2, 0, 24, 24, 2]),
  "cream":          N([340, 2.1, 36, 2.8, 0, 411, 0.6, 1.6, 0.2, 0.1, 66, 75, 7]),
  "double cream":   N([449, 1.7, 48, 2.7, 0, 500, 0.6, 1.6, 0.2, 0.1, 65, 64, 6]),
  "sour cream":     N([198, 2.4, 19, 4.6, 0, 165, 0.9, 0.4, 0.3, 0.1, 101, 125, 10]),
  "yogurt":         N([61, 3.5, 3.3, 4.7, 0, 27, 0.5, 0.1, 0.4, 0.1, 121, 155, 12]),
  "greek yogurt":   N([97, 9, 5, 4, 0, 26, 0, 0.1, 0.5, 0, 100, 141, 11]),
  "cheese":         N([402, 25, 33, 1.3, 0, 330, 0, 0.6, 0.8, 0.7, 721, 98, 28]),
  "cheddar":        N([402, 25, 33, 1.3, 0, 330, 0, 0.6, 0.8, 0.7, 721, 98, 28]),
  "parmesan":       N([431, 38, 29, 4.1, 0, 207, 0, 0.5, 1.2, 0.8, 1184, 92, 44]),
  "mozzarella":     N([280, 28, 17, 3.1, 0, 179, 0, 0.4, 2.3, 0.4, 505, 76, 20]),
  "feta":           N([264, 14, 21, 4.1, 0, 125, 0, 0.4, 1.7, 0.7, 493, 62, 19]),
  "cream cheese":   N([342, 6, 34, 4, 0, 308, 0, 0.6, 0.3, 0.4, 98, 138, 9]),

  // — grains, pasta, bread —
  "rice":           N([130, 2.7, 0.3, 28, 0.4, 0, 0, 0, 0, 0.2, 10, 35, 12]),
  "basmati rice":   N([130, 2.7, 0.3, 28, 0.4, 0, 0, 0, 0, 0.2, 10, 35, 12]),
  "brown rice":     N([112, 2.3, 0.8, 24, 1.8, 0, 0, 0, 0, 0.5, 10, 79, 44]),
  "pasta":          N([131, 5, 1.1, 25, 1.8, 0, 0, 0, 0, 0.5, 7, 44, 18]),
  "spaghetti":      N([131, 5, 1.1, 25, 1.8, 0, 0, 0, 0, 0.5, 7, 44, 18]),
  "noodles":        N([138, 4.5, 2.1, 25, 1.2, 0, 0, 0, 0, 0.5, 9, 38, 15]),
  "bread":          N([265, 9, 3.2, 49, 2.7, 0, 0, 0, 0, 3.6, 144, 115, 23]),
  "flour":          N([364, 10, 1, 76, 2.7, 0, 0, 0, 0, 1.2, 15, 107, 22]),
  "oats":           N([389, 17, 6.9, 66, 10.6, 0, 0, 0, 0, 4.7, 54, 429, 177]),
  "couscous":       N([112, 3.8, 0.2, 23, 1.4, 0, 0, 0, 0, 0.4, 8, 58, 8]),
  "quinoa":         N([120, 4.4, 1.9, 21, 2.8, 0, 0, 0, 0, 1.5, 17, 172, 64]),
  "tortilla":       N([310, 8, 8, 51, 3, 0, 0, 0, 0, 2.6, 150, 130, 23]),
  "breadcrumbs":    N([395, 13, 5.3, 72, 4.5, 0, 0, 0, 0, 4.8, 183, 196, 43]),

  // — vegetables —
  "potato":         N([77, 2, 0.1, 17, 2.2, 0, 19.7, 0, 0, 0.8, 12, 421, 23]),
  "sweet potato":   N([86, 1.6, 0.1, 20, 3, 709, 2.4, 0, 0, 0.6, 30, 337, 25]),
  "onion":          N([40, 1.1, 0.1, 9.3, 1.7, 0, 7.4, 0, 0, 0.2, 23, 146, 10]),
  "garlic":         N([149, 6.4, 0.5, 33, 2.1, 0, 31, 0, 0, 1.7, 181, 401, 25]),
  "tomato":         N([18, 0.9, 0.2, 3.9, 1.2, 42, 13.7, 0, 0, 0.3, 10, 237, 11]),
  "carrot":         N([41, 0.9, 0.2, 9.6, 2.8, 835, 5.9, 0, 0, 0.3, 33, 320, 12]),
  "broccoli":       N([34, 2.8, 0.4, 6.6, 2.6, 31, 89.2, 0, 0, 0.7, 47, 316, 21]),
  "spinach":        N([23, 2.9, 0.4, 3.6, 2.2, 469, 28.1, 0, 0, 2.7, 99, 558, 79]),
  "kale":           N([49, 4.3, 0.9, 8.8, 3.6, 500, 120, 0, 0, 1.5, 150, 491, 47]),
  "pepper":         N([31, 1, 0.3, 6, 2.1, 157, 128, 0, 0, 0.4, 7, 211, 12]),
  "bell pepper":    N([31, 1, 0.3, 6, 2.1, 157, 128, 0, 0, 0.4, 7, 211, 12]),
  "chilli":         N([40, 1.9, 0.4, 8.8, 1.5, 48, 144, 0, 0, 1, 14, 322, 23]),
  "mushroom":       N([22, 3.1, 0.3, 3.3, 1, 0, 2.1, 0.2, 0, 0.5, 3, 318, 9]),
  "courgette":      N([17, 1.2, 0.3, 3.1, 1, 10, 17.9, 0, 0, 0.4, 16, 261, 18]),
  "zucchini":       N([17, 1.2, 0.3, 3.1, 1, 10, 17.9, 0, 0, 0.4, 16, 261, 18]),
  "aubergine":      N([25, 1, 0.2, 5.9, 3, 1, 2.2, 0, 0, 0.2, 9, 229, 14]),
  "eggplant":       N([25, 1, 0.2, 5.9, 3, 1, 2.2, 0, 0, 0.2, 9, 229, 14]),
  "cucumber":       N([15, 0.7, 0.1, 3.6, 0.5, 5, 2.8, 0, 0, 0.3, 16, 147, 13]),
  "celery":         N([16, 0.7, 0.2, 3, 1.6, 22, 3.1, 0, 0, 0.2, 40, 260, 11]),
  "leek":           N([61, 1.5, 0.3, 14, 1.8, 83, 12, 0, 0, 2.1, 59, 180, 28]),
  "cabbage":        N([25, 1.3, 0.1, 5.8, 2.5, 5, 36.6, 0, 0, 0.5, 40, 170, 12]),
  "cauliflower":    N([25, 1.9, 0.3, 5, 2, 0, 48.2, 0, 0, 0.4, 22, 299, 15]),
  "peas":           N([81, 5.4, 0.4, 14, 5.7, 38, 40, 0, 0, 1.5, 25, 244, 33]),
  "green beans":    N([31, 1.8, 0.2, 7, 2.7, 35, 12.2, 0, 0, 1, 37, 211, 25]),
  "corn":           N([86, 3.3, 1.4, 19, 2, 9, 6.8, 0, 0, 0.5, 2, 270, 37]),
  "pumpkin":        N([26, 1, 0.1, 6.5, 0.5, 426, 9, 0, 0, 0.8, 21, 340, 12]),
  "avocado":        N([160, 2, 15, 8.5, 6.7, 7, 10, 0, 0, 0.6, 12, 485, 29]),
  "lettuce":        N([15, 1.4, 0.2, 2.9, 1.3, 370, 9.2, 0, 0, 0.9, 36, 194, 13]),
  "beetroot":       N([43, 1.6, 0.2, 9.6, 2.8, 2, 4.9, 0, 0, 0.8, 16, 325, 23]),
  "ginger":         N([80, 1.8, 0.8, 18, 2, 0, 5, 0, 0, 0.6, 16, 415, 43]),
  "spring onion":   N([32, 1.8, 0.2, 7.3, 2.6, 50, 18.8, 0, 0, 1.5, 72, 276, 20]),

  // — legumes, nuts, tofu —
  "lentils":        N([116, 9, 0.4, 20, 7.9, 0, 1.5, 0, 0, 3.3, 19, 369, 36]),
  "chickpeas":      N([164, 8.9, 2.6, 27, 7.6, 1, 1.3, 0, 0, 2.9, 49, 291, 48]),
  "kidney beans":   N([127, 8.7, 0.5, 23, 6.4, 0, 1.2, 0, 0, 2.9, 28, 403, 45]),
  "black beans":    N([132, 8.9, 0.5, 24, 8.7, 0, 0, 0, 0, 2.1, 27, 355, 70]),
  "beans":          N([127, 8.7, 0.5, 23, 6.4, 0, 1.2, 0, 0, 2.9, 28, 403, 45]),
  "tofu":           N([76, 8, 4.8, 1.9, 0.3, 0, 0.1, 0, 0, 5.4, 350, 121, 30]),
  "almonds":        N([579, 21, 50, 22, 12.5, 0, 0, 0, 0, 3.7, 269, 733, 270]),
  "walnuts":        N([654, 15, 65, 14, 6.7, 1, 1.3, 0, 0, 2.9, 98, 441, 158]),
  "peanuts":        N([567, 26, 49, 16, 8.5, 0, 0, 0, 0, 4.6, 92, 705, 168]),
  "peanut butter":  N([588, 25, 50, 20, 6, 0, 0, 0, 0, 1.9, 49, 649, 168]),
  "cashews":        N([553, 18, 44, 30, 3.3, 0, 0.5, 0, 0, 6.7, 37, 660, 292]),
  "sesame seeds":   N([573, 18, 50, 23, 11.8, 1, 0, 0, 0, 14.6, 975, 468, 351]),

  // — fruit —
  "apple":          N([52, 0.3, 0.2, 14, 2.4, 3, 4.6, 0, 0, 0.1, 6, 107, 5]),
  "banana":         N([89, 1.1, 0.3, 23, 2.6, 3, 8.7, 0, 0, 0.3, 5, 358, 27]),
  "orange":         N([47, 0.9, 0.1, 12, 2.4, 11, 53.2, 0, 0, 0.1, 40, 181, 10]),
  "lemon":          N([29, 1.1, 0.3, 9.3, 2.8, 1, 53, 0, 0, 0.6, 26, 138, 8]),
  "lime":           N([30, 0.7, 0.2, 11, 2.8, 2, 29.1, 0, 0, 0.6, 33, 102, 6]),
  "mango":          N([60, 0.8, 0.4, 15, 1.6, 54, 36.4, 0, 0, 0.2, 11, 168, 10]),
  "pineapple":      N([50, 0.5, 0.1, 13, 1.4, 3, 47.8, 0, 0, 0.3, 13, 109, 12]),
  "berries":        N([43, 0.7, 0.3, 10, 2.4, 3, 21, 0, 0, 0.4, 16, 77, 6]),
  "strawberries":   N([32, 0.7, 0.3, 7.7, 2, 1, 58.8, 0, 0, 0.4, 16, 153, 13]),
  "blueberries":    N([57, 0.7, 0.3, 14, 2.4, 3, 9.7, 0, 0, 0.3, 6, 77, 6]),
  "raisins":        N([299, 3.1, 0.5, 79, 3.7, 0, 2.3, 0, 0, 1.9, 50, 749, 32]),
  "coconut":        N([354, 3.3, 33, 15, 9, 0, 3.3, 0, 0, 2.4, 14, 356, 32]),

  // — fats, sauces, misc —
  "olive oil":      N([884, 0, 100, 0, 0, 0, 0, 0, 0, 0.6, 1, 1, 0]),
  "vegetable oil":  N([884, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  "oil":            N([884, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  "sugar":          N([387, 0, 0, 100, 0, 0, 0, 0, 0, 0, 1, 2, 0]),
  "brown sugar":    N([380, 0, 0, 98, 0, 0, 0, 0, 0, 0.7, 83, 133, 9]),
  "honey":          N([304, 0.3, 0, 82, 0.2, 0, 0.5, 0, 0, 0.4, 6, 52, 2]),
  "soy sauce":      N([53, 8, 0.6, 4.9, 0.8, 0, 0, 0, 0, 1.4, 33, 435, 74]),
  "tomato puree":   N([82, 4.3, 0.5, 19, 4.1, 76, 21.9, 0, 0, 3, 36, 1014, 42]),
  "tomato sauce":   N([29, 1.3, 0.2, 6.6, 1.5, 22, 7, 0, 0, 0.5, 14, 297, 15]),
  "coconut milk":   N([230, 2.3, 24, 5.5, 2.2, 0, 2.8, 0, 0, 1.6, 16, 263, 37]),
  "stock":          N([5, 0.5, 0.1, 0.5, 0, 0, 0, 0, 0, 0, 5, 25, 2]),
  "broth":          N([5, 0.5, 0.1, 0.5, 0, 0, 0, 0, 0, 0, 5, 25, 2]),
  "wine":           N([83, 0.1, 0, 2.6, 0, 0, 0, 0, 0, 0.4, 8, 99, 10]),
  "beer":           N([43, 0.5, 0, 3.6, 0, 0, 0, 0, 0, 0, 4, 27, 6]),
  "chocolate":      N([546, 4.9, 31, 61, 7, 20, 0, 0, 0.3, 8, 56, 559, 146]),
  "dark chocolate": N([598, 7.8, 43, 46, 10.9, 2, 0, 0, 0.3, 11.9, 73, 715, 228]),
  "mayonnaise":     N([680, 1, 75, 0.6, 0, 65, 0, 0.2, 0.3, 0.2, 8, 20, 1]),
  "mustard":        N([66, 4.4, 4, 5.8, 4, 4, 0.3, 0, 0, 1.6, 63, 152, 48]),
  "curry paste":    N([120, 3, 6, 13, 4, 100, 8, 0, 0, 3, 60, 350, 40]),
  "salt":           N([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24, 8, 1]),
};

const SYNONYMS = [
  [/chicken\s*(fillet|breast)/, "chicken breast"],
  [/mince|ground/, "ground beef"],
  [/king prawn|tiger prawn/, "prawn"],
  [/free.range egg|eggs?$/, "egg"],
  [/whole milk|semi.skimmed/, "milk"],
  [/plain flour|self.raising flour|all.purpose/, "flour"],
  [/caster sugar|granulated sugar|icing sugar/, "sugar"],
  [/red onion|white onion|yellow onion/, "onion"],
  [/cherry tomato|plum tomato|chopped tomato|canned tomato|tinned tomato/, "tomato"],
  [/red pepper|green pepper|yellow pepper|capsicum/, "bell pepper"],
  [/scallion|green onion/, "spring onion"],
  [/veg(etable)? stock|chicken stock|beef stock|fish stock|bouillon/, "stock"],
  [/sunflower oil|rapeseed|canola|corn oil/, "vegetable oil"],
  [/extra.virgin/, "olive oil"],
  [/creme fraiche|crème fraîche/, "sour cream"],
  [/heavy cream|whipping cream/, "double cream"],
  [/gruyere|gouda|emmental|monterey|red leicester/, "cheese"],
  [/penne|fusilli|macaroni|linguine|tagliatelle|fettuccine|lasagne sheets/, "pasta"],
  [/jasmine rice|long.grain rice|arborio/, "rice"],
  [/baguette|bun|roll|pitta|naan/, "bread"],
  [/butternut squash/, "pumpkin"],
  [/baby spinach/, "spinach"],
  [/cannellini|butter bean|haricot|pinto/, "beans"],
  [/desiccated coconut/, "coconut"],
  [/dark soy|light soy/, "soy sauce"],
  [/passata/, "tomato sauce"],
  [/paprika|cumin|coriander|turmeric|oregano|thyme|rosemary|basil|parsley|dill|cinnamon|nutmeg|clove|cardamom|bay lea|pepper corns?|black pepper|white pepper|chili powder|curry powder|garam masala|saffron|vanilla/, "spice"],
];

FOODS["spice"] = N([300, 10, 8, 50, 25, 30, 5, 0, 0, 20, 500, 1200, 250]);

function normalize(name) {
  return (name || "").toLowerCase().replace(/[^a-zæøå\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Find per-100g data for an ingredient name. Returns {key, per100} or null. */
export function lookupFood(name) {
  const n = normalize(name);
  if (!n) return null;
  if (FOODS[n]) return { key: n, per100: FOODS[n] };
  for (const [re, key] of SYNONYMS) {
    if (re.test(n)) return { key, per100: FOODS[key] };
  }
  // token match: "smoked salmon fillet" → "salmon"
  const keys = Object.keys(FOODS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (n.includes(key)) return { key, per100: FOODS[key] };
  }
  return null;
}

export function emptyTotals() {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0]));
}

export function addScaled(totals, per100, grams) {
  const factor = grams / 100;
  for (const key of NUTRIENT_KEYS) totals[key] += (per100[key] || 0) * factor;
  return totals;
}

/** Which foods to suggest when a nutrient runs low (drives recommendations). */
export const RICH_SOURCES = {
  protein:   ["chicken", "salmon", "lentils", "egg", "tofu"],
  fiber:     ["lentils", "beans", "oats", "broccoli", "chickpeas"],
  vitA:      ["carrot", "sweet potato", "spinach", "kale"],
  vitC:      ["pepper", "broccoli", "orange", "strawberries", "kale"],
  vitD:      ["salmon", "mackerel", "egg", "tuna"],
  b12:       ["salmon", "beef", "egg", "mussel", "cheese"],
  iron:      ["spinach", "lentils", "beef", "tofu", "kidney beans"],
  calcium:   ["cheese", "yogurt", "milk", "tofu", "sardine"],
  potassium: ["potato", "banana", "spinach", "avocado", "beans"],
  magnesium: ["oats", "almonds", "spinach", "quinoa", "black beans"],
};

/** Fallback parser when no Claude API key is set: scans free text for known
 * foods with optional quantities ("200 g chicken and some rice"). */
export function guessFoodsFromText(text) {
  const found = [];
  // normalize but keep digits — quantities like "200 g" must survive
  const n = (text || "").toLowerCase().replace(/[^a-z0-9æøå.,\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!n) return found;
  const keys = Object.keys(FOODS).filter((k) => k !== "spice").sort((a, b) => b.length - a.length);
  let remaining = ` ${n} `;
  for (const key of keys) {
    const idx = remaining.indexOf(` ${key}`);
    if (idx === -1) continue;
    // look back for "200 g" / "2 dl" style quantities just before the food
    const before = remaining.slice(Math.max(0, idx - 20), idx);
    const qty = before.match(/(\d+(?:[.,]\d+)?)\s*(g|gram|kg|dl|ml)?\s*$/);
    let grams = 100;
    if (qty) {
      const v = parseFloat(qty[1].replace(",", "."));
      const unit = qty[2] || "";
      grams = unit === "kg" ? v * 1000 : unit === "dl" ? v * 100 : unit === "ml" ? v : unit ? v : v > 20 ? v : 100;
    }
    found.push({ name: key, grams: Math.round(grams) });
    remaining = remaining.replace(` ${key}`, " ");
  }
  return found;
}
