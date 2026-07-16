// App-wide observable state: favorites, ratings, the food diary, settings,
// and the derived nutrition graph. Persistence is plain JSON in Application
// Support (small data, fully offline); meal photos are JPEGs on disk.

import Foundation
import Observation
import Security
import UIKit

@MainActor
@Observable
final class AppModel {

    // MARK: State

    private(set) var favorites: Set<String> = []
    private(set) var ratings: [String: Int] = [:]
    private(set) var diary: [DiaryMeal] = []
    private(set) var graph = NutritionGraph(diary: [])

    var dailyKcalTarget: Double {
        didSet { defaults.set(dailyKcalTarget, forKey: "dailyKcalTarget") }
    }

    /// Optional Anthropic API key for smarter meal parsing (kept in Keychain).
    var claudeAPIKey: String {
        didSet { Keychain.set(claudeAPIKey, for: "claude-api-key") }
    }

    let mealDB = MealDBClient()

    /// Cross-tab deep link: dashboard "find recipes with X" → recipes tab.
    var pendingIngredientFilter: String?
    var selectedTab: AppTab = .recipes

    // MARK: Init & persistence

    private let defaults = UserDefaults.standard
    private let fileManager = FileManager.default

    private var storeURL: URL {
        let base = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("KitchenRecipes", isDirectory: true)
        try? fileManager.createDirectory(at: base, withIntermediateDirectories: true)
        return base
    }

    private var photosURL: URL {
        let url = storeURL.appendingPathComponent("Photos", isDirectory: true)
        try? fileManager.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    init() {
        let storedTarget = defaults.double(forKey: "dailyKcalTarget")
        dailyKcalTarget = storedTarget > 0 ? storedTarget : Nutrient.kcal.dailyTarget
        claudeAPIKey = Keychain.get("claude-api-key") ?? ""

        favorites = load("favorites.json") ?? []
        ratings = load("ratings.json") ?? [:]
        diary = load("diary.json") ?? []
        diary.sort { $0.date > $1.date }
        graph = NutritionGraph(diary: diary)
    }

    private func load<T: Decodable>(_ filename: String) -> T? {
        let url = storeURL.appendingPathComponent(filename)
        guard let data = try? Data(contentsOf: url) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(T.self, from: data)
    }

    private func save<T: Encodable>(_ value: T, to filename: String) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(value) else { return }
        try? data.write(to: storeURL.appendingPathComponent(filename), options: .atomic)
    }

    // MARK: Favorites & ratings

    func isFavorite(_ id: String) -> Bool { favorites.contains(id) }

    @discardableResult
    func toggleFavorite(_ id: String) -> Bool {
        let nowFavorite: Bool
        if favorites.contains(id) {
            favorites.remove(id)
            nowFavorite = false
        } else {
            favorites.insert(id)
            nowFavorite = true
        }
        save(favorites, to: "favorites.json")
        return nowFavorite
    }

    func rating(for id: String) -> Int { ratings[id] ?? 0 }

    func setRating(_ stars: Int, for id: String) {
        if stars <= 0 {
            ratings.removeValue(forKey: id)
        } else {
            ratings[id] = min(stars, 5)
        }
        save(ratings, to: "ratings.json")
    }

    // MARK: Diary

    /// Log a meal: resolve foods from the description (Claude when a key is
    /// set, catalog scan otherwise), estimate nutrients, store the photo.
    func logMeal(text: String, photo: UIImage?, date: Date = .now,
                 recipe: Recipe? = nil) async -> DiaryMeal {
        var portions: [FoodPortion] = []
        if !claudeAPIKey.isEmpty {
            portions = (try? await ClaudeMealParser.parse(text: text, apiKey: claudeAPIKey)) ?? []
        }
        if portions.isEmpty {
            portions = FoodCatalog.guessFoods(from: text)
        }
        // Cooking from a recipe with no described foods? Use its ingredients
        // (one serving ≈ a quarter of the dish).
        if portions.isEmpty, let recipe {
            portions = recipe.ingredients.compactMap { line in
                guard let grams = line.grams, FoodCatalog.lookup(line.name) != nil else { return nil }
                return FoodPortion(name: line.name, grams: (grams / 4).rounded())
            }
        }

        var photoFilename: String?
        if let photo, let data = photo.jpegData(compressionQuality: 0.82) {
            let filename = "meal-\(UUID().uuidString).jpg"
            try? data.write(to: photosURL.appendingPathComponent(filename), options: .atomic)
            photoFilename = filename
        }

        let meal = DiaryMeal(date: date, text: text, photoFilename: photoFilename,
                             portions: portions, totals: FoodCatalog.totals(for: portions),
                             recipeID: recipe?.id, recipeName: recipe?.name)
        diary.insert(meal, at: 0)
        diaryChanged()
        return meal
    }

    func deleteMeal(_ meal: DiaryMeal) {
        if let filename = meal.photoFilename {
            try? fileManager.removeItem(at: photosURL.appendingPathComponent(filename))
        }
        diary.removeAll { $0.id == meal.id }
        diaryChanged()
    }

    func clearDiary() {
        try? fileManager.removeItem(at: photosURL)
        diary.removeAll()
        diaryChanged()
    }

    func photoURL(for meal: DiaryMeal) -> URL? {
        guard let filename = meal.photoFilename else { return nil }
        let url = photosURL.appendingPathComponent(filename)
        return fileManager.fileExists(atPath: url.path) ? url : nil
    }

    private func diaryChanged() {
        diary.sort { $0.date > $1.date }
        save(diary, to: "diary.json")
        graph = NutritionGraph(diary: diary)
    }
}

enum AppTab: Hashable {
    case recipes, discover, diary, insights, settings
}

// MARK: - Minimal Keychain wrapper (for the Claude API key)

enum Keychain {
    private static func query(for key: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "com.example.KitchenRecipes",
         kSecAttrAccount as String: key]
    }

    static func set(_ value: String, for key: String) {
        SecItemDelete(query(for: key) as CFDictionary)
        guard !value.isEmpty, let data = value.data(using: .utf8) else { return }
        var attributes = query(for: key)
        attributes[kSecValueData as String] = data
        SecItemAdd(attributes as CFDictionary, nil)
    }

    static func get(_ key: String) -> String? {
        var q = query(for: key)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
