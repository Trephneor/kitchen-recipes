// Core value types: recipes (from TheMealDB), diary meals, and the nutrient
// vocabulary shared by the catalog, the graph, and the charts.

import Foundation

// MARK: - Nutrients

enum Nutrient: String, CaseIterable, Codable, Identifiable, Hashable {
    case kcal, protein, fat, carbs, fiber
    case vitA, vitC, vitD, b12
    case iron, calcium, potassium, magnesium

    var id: String { rawValue }

    var label: String {
        switch self {
        case .kcal: return "Calories"
        case .protein: return "Protein"
        case .fat: return "Fat"
        case .carbs: return "Carbs"
        case .fiber: return "Fiber"
        case .vitA: return "Vitamin A"
        case .vitC: return "Vitamin C"
        case .vitD: return "Vitamin D"
        case .b12: return "Vitamin B12"
        case .iron: return "Iron"
        case .calcium: return "Calcium"
        case .potassium: return "Potassium"
        case .magnesium: return "Magnesium"
        }
    }

    var unit: String {
        switch self {
        case .kcal: return "kcal"
        case .protein, .fat, .carbs, .fiber: return "g"
        case .vitA, .vitD, .b12: return "µg"
        case .vitC, .iron, .calcium, .potassium, .magnesium: return "mg"
        }
    }

    /// Daily reference target (Nordic Nutrition Recommendations, adult ballpark).
    var dailyTarget: Double {
        switch self {
        case .kcal: return 2000
        case .protein: return 60
        case .fat: return 70
        case .carbs: return 250
        case .fiber: return 30
        case .vitA: return 800
        case .vitC: return 80
        case .vitD: return 10
        case .b12: return 4
        case .iron: return 11
        case .calcium: return 800
        case .potassium: return 3500
        case .magnesium: return 350
        }
    }
}

/// A fixed-width bundle of nutrient amounts. Used both as "per 100 g" catalog
/// rows and as accumulated day/meal totals.
struct NutrientTotals: Codable, Hashable {
    var kcal = 0.0, protein = 0.0, fat = 0.0, carbs = 0.0, fiber = 0.0
    var vitA = 0.0, vitC = 0.0, vitD = 0.0, b12 = 0.0
    var iron = 0.0, calcium = 0.0, potassium = 0.0, magnesium = 0.0

    subscript(_ key: Nutrient) -> Double {
        get {
            switch key {
            case .kcal: return kcal
            case .protein: return protein
            case .fat: return fat
            case .carbs: return carbs
            case .fiber: return fiber
            case .vitA: return vitA
            case .vitC: return vitC
            case .vitD: return vitD
            case .b12: return b12
            case .iron: return iron
            case .calcium: return calcium
            case .potassium: return potassium
            case .magnesium: return magnesium
            }
        }
        set {
            switch key {
            case .kcal: kcal = newValue
            case .protein: protein = newValue
            case .fat: fat = newValue
            case .carbs: carbs = newValue
            case .fiber: fiber = newValue
            case .vitA: vitA = newValue
            case .vitC: vitC = newValue
            case .vitD: vitD = newValue
            case .b12: b12 = newValue
            case .iron: iron = newValue
            case .calcium: calcium = newValue
            case .potassium: potassium = newValue
            case .magnesium: magnesium = newValue
            }
        }
    }

    /// Values in the canonical `Nutrient.allCases` order.
    init(values: [Double] = []) {
        for (index, key) in Nutrient.allCases.enumerated() where index < values.count {
            self[key] = values[index]
        }
    }

    mutating func add(_ per100: NutrientTotals, grams: Double) {
        let factor = grams / 100
        for key in Nutrient.allCases {
            self[key] += per100[key] * factor
        }
    }

    static func + (lhs: NutrientTotals, rhs: NutrientTotals) -> NutrientTotals {
        var out = lhs
        for key in Nutrient.allCases { out[key] += rhs[key] }
        return out
    }
}

// MARK: - Recipes

/// A lightweight card-level recipe (browse results, favorites list).
struct MealSummary: Identifiable, Codable, Hashable {
    let id: String
    var name: String
    var thumbnail: URL?
    var category: String?
    var area: String?
}

struct IngredientLine: Identifiable, Codable, Hashable {
    var id: Int
    var name: String
    var measure: String

    /// "1 cup" → "2,4 dl" etc. Computed once per render; cheap string work.
    var danishMeasure: String { DanishUnits.toDanish(measure: measure, ingredient: name) }

    /// Best-effort grams for the nutrition estimate; nil when unknowable.
    var grams: Double? { DanishUnits.grams(measure: measure, ingredient: name) }
}

struct Recipe: Identifiable, Codable, Hashable {
    let id: String
    var name: String
    var category: String?
    var area: String?
    var instructions: String
    var thumbnail: URL?
    var youtube: URL?
    var source: URL?
    var tags: [String]
    var ingredients: [IngredientLine]

    var summary: MealSummary {
        MealSummary(id: id, name: name, thumbnail: thumbnail, category: category, area: area)
    }

    /// Instructions split into cook-along steps: numbered lines are respected,
    /// long paragraphs are broken at sentence boundaries so each step fits on
    /// screen in cooking mode.
    var steps: [String] {
        let lines = instructions
            .replacingOccurrences(of: "\r\n", with: "\n")
            .split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .map { line -> String in
                // Drop "STEP 3" / "3." / "3)" prefixes — we number steps ourselves.
                var s = line
                if let range = s.range(of: #"^(step\s*\d+[:.)]?|\d+[.)])\s*"#,
                                       options: [.regularExpression, .caseInsensitive]) {
                    s.removeSubrange(range)
                }
                return s
            }
            .filter { !$0.isEmpty && $0.count > 2 }

        var steps: [String] = []
        for line in lines {
            if line.count <= 260 {
                steps.append(line)
                continue
            }
            // Split long paragraphs on sentence ends, re-packing to ≤ 260 chars.
            var current = ""
            for sentence in line.split(separator: ". ", omittingEmptySubsequences: true) {
                var piece = String(sentence)
                if !piece.hasSuffix(".") { piece += "." }
                if current.isEmpty {
                    current = piece
                } else if current.count + piece.count + 1 <= 260 {
                    current += " " + piece
                } else {
                    steps.append(current)
                    current = piece
                }
            }
            if !current.isEmpty { steps.append(current) }
        }
        return steps.isEmpty ? [instructions] : steps
    }

    /// Total kcal estimate for the whole dish (all ingredients we can map).
    var estimatedTotals: NutrientTotals {
        var totals = NutrientTotals()
        for line in ingredients {
            guard let grams = line.grams,
                  let food = FoodCatalog.lookup(line.name) else { continue }
            totals.add(food.per100, grams: grams)
        }
        return totals
    }
}

// MARK: - Diary

struct FoodPortion: Codable, Hashable, Identifiable {
    var id = UUID()
    var name: String
    var grams: Double
}

/// One logged meal: a photo, a spoken/typed description, resolved food
/// portions, and cached nutrient totals.
struct DiaryMeal: Identifiable, Codable, Hashable {
    var id = UUID()
    var date: Date
    var text: String
    var photoFilename: String?
    var portions: [FoodPortion]
    var totals: NutrientTotals
    var recipeID: String?
    var recipeName: String?
}
