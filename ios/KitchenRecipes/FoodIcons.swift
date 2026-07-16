// Tasteful SF Symbols for TheMealDB's recipe categories — evocative rather
// than literal where the symbol library has no exact food glyph.

import SwiftUI

enum FoodIcons {
    static func symbol(for category: String) -> String {
        switch category.lowercased() {
        case "all", "": return "square.grid.2x2"
        case "beef": return "flame"                    // the grill
        case "breakfast": return "sun.horizon"
        case "chicken": return "bird"
        case "dessert": return "birthday.cake"
        case "goat": return "mountain.2"               // where goats live
        case "lamb": return "cloud"                    // fluffy
        case "miscellaneous": return "sparkles"
        case "pasta": return "oval.portrait"           // a strand nest
        case "pork": return "frying.pan"
        case "seafood": return "fish"
        case "side": return "square.on.square"
        case "starter": return "fork.knife"
        case "vegan": return "leaf"
        case "vegetarian": return "carrot"
        default: return "circle.grid.2x2"
        }
    }
}
