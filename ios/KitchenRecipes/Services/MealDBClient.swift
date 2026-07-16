// TheMealDB API client (free/test key "1"). All calls are async; decoding
// handles the API's flat strIngredient1…20 / strMeasure1…20 shape.

import Foundation

struct MealDBClient: Sendable {
    var apiKey = "1"

    private var base: String { "https://www.themealdb.com/api/json/v1/\(apiKey)" }

    // MARK: Public API

    func search(_ query: String) async throws -> [Recipe] {
        try await meals(path: "search.php", query: [URLQueryItem(name: "s", value: query)])
            .compactMap(Self.recipe(from:))
    }

    func lookup(id: String) async throws -> Recipe? {
        try await meals(path: "lookup.php", query: [URLQueryItem(name: "i", value: id)])
            .compactMap(Self.recipe(from:)).first
    }

    /// N distinct random recipes (the API only hands out one at a time).
    func random(count: Int) async throws -> [Recipe] {
        try await withThrowingTaskGroup(of: Recipe?.self) { group in
            for _ in 0..<count {
                group.addTask {
                    try await meals(path: "random.php", query: []).compactMap(Self.recipe(from:)).first
                }
            }
            var seen = Set<String>()
            var out: [Recipe] = []
            for try await recipe in group {
                if let recipe, seen.insert(recipe.id).inserted { out.append(recipe) }
            }
            return out
        }
    }

    enum Filter {
        case category(String), area(String), ingredient(String)

        var queryItem: URLQueryItem {
            switch self {
            case .category(let v): return URLQueryItem(name: "c", value: v)
            case .area(let v): return URLQueryItem(name: "a", value: v)
            case .ingredient(let v): return URLQueryItem(name: "i", value: v)
            }
        }
    }

    /// Filter endpoints return card-level data only (id, name, thumbnail).
    func filter(_ filter: Filter) async throws -> [MealSummary] {
        try await meals(path: "filter.php", query: [filter.queryItem]).compactMap { raw in
            guard let id = raw["idMeal"], let name = raw["strMeal"] else { return nil }
            return MealSummary(id: id, name: name,
                               thumbnail: raw["strMealThumb"].flatMap(URL.init(string:)),
                               category: nil, area: nil)
        }
    }

    func categories() async throws -> [String] {
        try await meals(path: "list.php", query: [URLQueryItem(name: "c", value: "list")])
            .compactMap { $0["strCategory"] }
    }

    func areas() async throws -> [String] {
        try await meals(path: "list.php", query: [URLQueryItem(name: "a", value: "list")])
            .compactMap { $0["strArea"] }
    }

    // MARK: Transport & decoding

    private func meals(path: String, query: [URLQueryItem]) async throws -> [RawMeal] {
        var components = URLComponents(string: "\(base)/\(path)")!
        if !query.isEmpty { components.queryItems = query }
        let (data, response) = try await URLSession.shared.data(from: components.url!)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(Envelope.self, from: data).meals ?? []
    }

    private struct Envelope: Decodable {
        var meals: [RawMeal]?
    }

    /// TheMealDB rows are flat string maps with nullable values; decode them
    /// generically so strIngredient1…20 can be walked with a loop.
    private struct RawMeal: Decodable {
        private var fields: [String: String] = [:]

        subscript(_ key: String) -> String? {
            guard let value = fields[key]?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !value.isEmpty else { return nil }
            return value
        }

        private struct AnyKey: CodingKey {
            var stringValue: String
            var intValue: Int? { nil }
            init?(stringValue: String) { self.stringValue = stringValue }
            init?(intValue: Int) { return nil }
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: AnyKey.self)
            for key in container.allKeys {
                if let value = try? container.decodeIfPresent(String.self, forKey: key) {
                    fields[key.stringValue] = value
                }
            }
        }
    }

    private static func recipe(from raw: RawMeal) -> Recipe? {
        guard let id = raw["idMeal"], let name = raw["strMeal"] else { return nil }
        var ingredients: [IngredientLine] = []
        for i in 1...20 {
            guard let ingredient = raw["strIngredient\(i)"] else { continue }
            ingredients.append(IngredientLine(id: i, name: ingredient,
                                              measure: raw["strMeasure\(i)"] ?? ""))
        }
        return Recipe(
            id: id,
            name: name,
            category: raw["strCategory"],
            area: raw["strArea"],
            instructions: raw["strInstructions"] ?? "",
            thumbnail: raw["strMealThumb"].flatMap(URL.init(string:)),
            youtube: raw["strYoutube"].flatMap(URL.init(string:)),
            source: raw["strSource"].flatMap(URL.init(string:)),
            tags: raw["strTags"]?.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) } ?? [],
            ingredients: ingredients
        )
    }
}
