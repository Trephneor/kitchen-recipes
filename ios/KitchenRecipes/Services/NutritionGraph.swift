// The knowledge graph behind the diet insights: meals, foods, nutrients, days
// and recipes as nodes, with weighted edges (grams eaten, nutrient content).
// Rebuilt from the diary — the diary is the source of truth, the graph is the
// queryable brain on top of it.

import Foundation

struct NutritionGraph {

    struct Node: Identifiable, Hashable {
        enum Kind: String { case meal, food, nutrient, day, recipe }
        let id: String
        var kind: Kind
        var label: String
    }

    struct Edge: Hashable {
        enum Kind: String {
            case loggedOn    // meal → day
            case contains    // meal → food (weight = grams)
            case provides    // food → nutrient (weight = amount per 100 g)
            case cookedFrom  // meal → recipe
        }
        var from: String
        var to: String
        var kind: Kind
        var weight: Double
    }

    struct Recommendation: Identifiable {
        var nutrient: Nutrient
        /// Average daily intake as a fraction of the target (0…1+).
        var fraction: Double
        /// Foods rich in the nutrient, least-recently-eaten first.
        var foods: [String]
        var id: String { nutrient.rawValue }
    }

    private(set) var nodes: [String: Node] = [:]
    private(set) var edges: [Edge] = []
    /// Totals keyed by start-of-day.
    private(set) var dayTotals: [Date: NutrientTotals] = [:]
    /// Cumulative grams eaten per food key.
    private(set) var foodGrams: [String: Double] = [:]

    private let calendar: Calendar

    init(diary: [DiaryMeal], calendar: Calendar = .current) {
        self.calendar = calendar

        for meal in diary {
            let mealID = "meal:\(meal.id.uuidString)"
            let day = calendar.startOfDay(for: meal.date)
            let dayID = "day:\(day.timeIntervalSince1970)"

            addNode(id: mealID, kind: .meal, label: meal.text)
            addNode(id: dayID, kind: .day, label: day.formatted(date: .abbreviated, time: .omitted))
            edges.append(Edge(from: mealID, to: dayID, kind: .loggedOn, weight: 1))

            if let recipeID = meal.recipeID {
                let rid = "recipe:\(recipeID)"
                addNode(id: rid, kind: .recipe, label: meal.recipeName ?? recipeID)
                edges.append(Edge(from: mealID, to: rid, kind: .cookedFrom, weight: 1))
            }

            for portion in meal.portions {
                guard let entry = FoodCatalog.lookup(portion.name) else { continue }
                let foodID = "food:\(entry.key)"
                addNode(id: foodID, kind: .food, label: entry.key)
                edges.append(Edge(from: mealID, to: foodID, kind: .contains, weight: portion.grams))
                foodGrams[entry.key, default: 0] += portion.grams

                for nutrient in Nutrient.allCases where entry.per100[nutrient] > 0 {
                    let nid = "nutrient:\(nutrient.rawValue)"
                    addNode(id: nid, kind: .nutrient, label: nutrient.label)
                    edges.append(Edge(from: foodID, to: nid, kind: .provides,
                                      weight: entry.per100[nutrient]))
                }
            }

            dayTotals[day, default: NutrientTotals()] = dayTotals[day, default: NutrientTotals()] + meal.totals
        }
    }

    private mutating func addNode(id: String, kind: Node.Kind, label: String) {
        if nodes[id] == nil { nodes[id] = Node(id: id, kind: kind, label: label) }
    }

    // MARK: Queries

    var nodeCount: Int { nodes.count }
    var edgeCount: Int { edges.count }

    /// Most-eaten foods by cumulative grams.
    func topFoods(_ limit: Int = 8) -> [(name: String, grams: Double)] {
        foodGrams.sorted { $0.value > $1.value }.prefix(limit).map { ($0.key, $0.value) }
    }

    /// Day-by-day totals for the trailing window, zero-filled so charts show
    /// gaps honestly. Oldest first.
    func totals(lastDays days: Int, endingAt end: Date = .now) -> [(day: Date, totals: NutrientTotals)] {
        let endDay = calendar.startOfDay(for: end)
        return (0..<days).reversed().compactMap { offset in
            guard let day = calendar.date(byAdding: .day, value: -offset, to: endDay) else { return nil }
            return (day, dayTotals[day] ?? NutrientTotals())
        }
    }

    /// Average daily intake over days that actually have logged meals.
    func averageDaily(lastDays days: Int, endingAt end: Date = .now) -> NutrientTotals {
        let window = totals(lastDays: days, endingAt: end)
        let logged = window.filter { $0.totals.kcal > 0 }
        guard !logged.isEmpty else { return NutrientTotals() }
        var sum = NutrientTotals()
        for entry in logged { sum = sum + entry.totals }
        var avg = NutrientTotals()
        for key in Nutrient.allCases { avg[key] = sum[key] / Double(logged.count) }
        return avg
    }

    /// Intake as a fraction of the daily target, per nutrient.
    func coverage(lastDays days: Int = 7) -> [(nutrient: Nutrient, fraction: Double)] {
        let avg = averageDaily(lastDays: days)
        return Nutrient.allCases.map { ($0, avg[$0] / $0.dailyTarget) }
    }

    /// The "healthier options" engine: find the nutrients running lowest over
    /// the last week and suggest rich food sources the user hasn't been eating.
    func recommendations(lastDays days: Int = 7, limit: Int = 3) -> [Recommendation] {
        guard !dayTotals.isEmpty else { return [] }
        // kcal/fat/carbs are budgets rather than goals — don't recommend "more".
        let goals: [Nutrient] = [.protein, .fiber, .vitA, .vitC, .vitD, .b12,
                                 .iron, .calcium, .potassium, .magnesium]
        let low = coverage(lastDays: days)
            .filter { goals.contains($0.nutrient) && $0.fraction < 0.85 }
            .sorted { $0.fraction < $1.fraction }
            .prefix(limit)

        return low.compactMap { item in
            guard let sources = FoodCatalog.richSources[item.nutrient] else { return nil }
            // Prefer foods the user hasn't already been eating a lot of.
            let ranked = sources.sorted { (foodGrams[$0] ?? 0) < (foodGrams[$1] ?? 0) }
            return Recommendation(nutrient: item.nutrient, fraction: max(0, item.fraction),
                                  foods: Array(ranked.prefix(4)))
        }
    }
}
