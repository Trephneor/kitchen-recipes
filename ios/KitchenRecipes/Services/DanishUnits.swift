// Converts TheMealDB's US/UK measures ("1 cup", "3 oz", "½ tsp") to Danish
// kitchen units (g, dl, spsk, tsk …) for display, and to grams for the
// nutrition estimate. Estimates are deliberately approximate — home cooking,
// not lab work. Direct port of the web app's units.js.

import Foundation

enum DanishUnits {

    // MARK: Public API

    /// Display converter: "1 cup" → "2,4 dl", "4 oz" → "113 g", …
    static func toDanish(measure: String, ingredient: String) -> String {
        let trimmed = measure.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return "" }
        let split = splitMeasure(trimmed)
        guard let value = split.value else { return translateWords(trimmed) }

        if let unit = unit(named: split.unit) { return unit.toDK(value) }
        if let piece = pieceUnit(named: split.unit) { return piece.dk(value) }
        // Bare count ("2", "2 large") — keep the count, translate size words.
        return translateWords(trimmed)
    }

    /// Best-effort grams for nutrition estimation. Nil when unknowable.
    static func grams(measure: String, ingredient: String) -> Double? {
        let trimmed = measure.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        let density = densityFor(ingredient)

        // "1 (400g) tin", "2 x 200 ml" — an embedded amount beats guessing.
        if let embedded = firstMatch(in: trimmed,
                pattern: #"(?:(\d+)\s*x\s*)?\(?(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|oz)\b"#) {
            let count = Double(embedded[1] ?? "1") ?? 1
            let amount = Double((embedded[2] ?? "0").replacingOccurrences(of: ",", with: ".")) ?? 0
            let factor: Double
            switch (embedded[3] ?? "").lowercased() {
            case "g": factor = 1
            case "kg": factor = 1000
            case "oz": factor = 28.35
            case "ml": factor = density
            case "l": factor = 1000 * density
            default: factor = 1
            }
            return (count * amount * factor).rounded()
        }

        let split = splitMeasure(trimmed)
        if let value = split.value {
            if let unit = unit(named: split.unit) {
                return unit.grams(value, density).map { $0.rounded() }
            }
            if let piece = pieceUnit(named: split.unit) {
                return (value * piece.grams).rounded()
            }
            // Bare count: use a typical piece weight for the ingredient.
            let name = ingredient.lowercased()
            for (fragment, weight) in Self.pieceWeights where name.contains(fragment) {
                return (value * weight).rounded()
            }
            return (value * 50).rounded() // generic "piece"
        }
        if trimmed.range(of: #"to taste|pinch|dash|garnish|sprinkl"#,
                         options: [.regularExpression, .caseInsensitive]) != nil {
            return 1
        }
        return nil
    }

    /// Adds °C after Fahrenheit temperatures in instruction text.
    static func convertTemperatures(_ text: String) -> String {
        let regex = try! NSRegularExpression(
            pattern: #"(\d{2,3})\s*°?\s*(?:degrees\s+)?F(?:ahrenheit)?\b"#,
            options: [.caseInsensitive])
        var result = text
        // Replace back-to-front so earlier ranges stay valid.
        let matches = regex.matches(in: text, range: NSRange(text.startIndex..., in: text)).reversed()
        for match in matches {
            guard let whole = Range(match.range, in: text),
                  let fRange = Range(match.range(at: 1), in: text),
                  let f = Int(text[fRange]) else { continue }
            let celsius = Int((Double(f - 32) * 5 / 9 / 5).rounded()) * 5
            result.replaceSubrange(whole, with: "\(text[whole]) (\(celsius) °C)")
        }
        return result
    }

    // MARK: Quantity parsing

    private static let unicodeFractions: [Character: Double] = [
        "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1.0 / 3, "⅔": 2.0 / 3,
        "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
        "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
    ]

    /// "1 1/2", "½", "3", "2-3" → number (ranges use the midpoint).
    private static func parseQuantity(_ text: String) -> (value: Double?, rest: String) {
        var s = text.trimmingCharacters(in: .whitespaces)
        for (ch, val) in unicodeFractions {
            s = s.replacingOccurrences(of: String(ch), with: " \(val) ")
        }

        if let range = firstMatch(in: s,
                pattern: #"^(\d+(?:[.,]\d+)?)\s*(?:-|–|to)\s*(\d+(?:[.,]\d+)?)"#),
           let a = Double((range[1] ?? "").replacingOccurrences(of: ",", with: ".")),
           let b = Double((range[2] ?? "").replacingOccurrences(of: ",", with: ".")) {
            return ((a + b) / 2, String(s.dropFirst(range.matchedLength)))
        }

        var value = 0.0
        var matched = false
        var rest = Substring(s)
        while true {
            let piece = String(rest)
            if let frac = firstMatch(in: piece, pattern: #"^\s*(\d+)\s*/\s*(\d+)"#),
               let num = Double(frac[1] ?? ""), let den = Double(frac[2] ?? ""), den != 0 {
                matched = true
                value += num / den
                rest = rest.dropFirst(frac.matchedLength)
            } else if let plain = firstMatch(in: piece, pattern: #"^\s*(\d+(?:[.,]\d+)?)"#),
                      let v = Double((plain[1] ?? "").replacingOccurrences(of: ",", with: ".")) {
                matched = true
                value += v
                rest = rest.dropFirst(plain.matchedLength)
            } else {
                break
            }
            let after = String(rest)
            // Only keep accumulating for mixed numbers ("1 1/2"), not "1 400g tin".
            if firstMatch(in: after, pattern: #"^\s*\d"#) == nil { break }
            if firstMatch(in: after, pattern: #"^\s*\d+\s*(g|kg|ml|l)\b"#) != nil { break }
        }
        return matched ? (value, String(rest)) : (nil, s)
    }

    private static func splitMeasure(_ measure: String) -> (value: Double?, unit: String) {
        let (value, rest) = parseQuantity(measure)
        var unitText = rest.trimmingCharacters(in: .whitespaces).lowercased()
        if unitText.hasPrefix("of ") { unitText = String(unitText.dropFirst(3)) }
        if unitText.hasSuffix(".") || unitText.hasSuffix(",") { unitText = String(unitText.dropLast()) }
        if firstMatch(in: unitText, pattern: #"^fl\.?\s*oz"#) != nil {
            unitText = "fl oz"
        } else {
            unitText = unitText.split(separator: " ").first.map(String.init) ?? ""
        }
        return (value, unitText)
    }

    // MARK: Units

    private struct Unit {
        var toDK: (Double) -> String
        var grams: (Double, Double) -> Double? // (value, density g/ml)
    }

    private static func unit(named raw: String) -> Unit? {
        switch raw {
        case "oz", "ounce", "ounces":
            return Unit(toDK: { gram($0 * 28.35) }, grams: { v, _ in v * 28.35 })
        case "lb", "lbs", "pound", "pounds":
            return Unit(toDK: { gram($0 * 453.6) }, grams: { v, _ in v * 453.6 })
        case "cup", "cups":
            return Unit(toDK: { deciliter($0 * 2.4) }, grams: { v, d in v * 240 * d })
        case "tbsp", "tbs", "tblsp", "tablespoon", "tablespoons":
            return Unit(toDK: { spoon($0, "spsk") }, grams: { v, d in v * 15 * d })
        case "tsp", "teaspoon", "teaspoons":
            return Unit(toDK: { spoon($0, "tsk") }, grams: { v, d in v * 5 * d })
        case "pint", "pints":
            return Unit(toDK: { deciliter($0 * 4.73) }, grams: { v, d in v * 473 * d })
        case "quart":
            return Unit(toDK: { liter($0 * 0.946) }, grams: { v, d in v * 946 * d })
        case "gallon":
            return Unit(toDK: { liter($0 * 3.785) }, grams: { v, d in v * 3785 * d })
        case "fl oz":
            return Unit(toDK: { deciliter($0 * 0.296) }, grams: { v, d in v * 29.6 * d })
        case "stick", "sticks":
            return Unit(toDK: { gram($0 * 113) }, grams: { v, _ in v * 113 })
        case "inch":
            return Unit(toDK: { "\(($0 * 2.54).dk(2)) cm" }, grams: { _, _ in nil })
        case "g", "gram", "grams", "gr":
            return Unit(toDK: { gram($0) }, grams: { v, _ in v })
        case "kg":
            return Unit(toDK: { gram($0 * 1000) }, grams: { v, _ in v * 1000 })
        case "ml":
            return Unit(toDK: { $0 >= 100 ? deciliter($0 / 100) : "\($0.dk(2)) ml" },
                        grams: { v, d in v * d })
        case "cl":
            return Unit(toDK: { deciliter($0 / 10) }, grams: { v, d in v * 10 * d })
        case "dl":
            return Unit(toDK: { deciliter($0) }, grams: { v, d in v * 100 * d })
        case "l", "litre", "liter", "litres":
            return Unit(toDK: { liter($0) }, grams: { v, d in v * 1000 * d })
        default:
            return nil
        }
    }

    // MARK: Piece units (descriptive, translated to Danish)

    private struct PieceUnit {
        var dk: (Double) -> String
        var grams: Double // typical piece weight
    }

    private static func pieceUnit(named raw: String) -> PieceUnit? {
        func plural(_ v: Double, _ one: String, _ many: String) -> String {
            "\(v.dk(2)) \(v == 1 ? one : many)"
        }
        switch raw {
        case "clove", "cloves":
            return PieceUnit(dk: { "\($0.dk(2)) fed" }, grams: 5)
        case "slice", "slices", "rasher", "rashers":
            return PieceUnit(dk: { plural($0, "skive", "skiver") }, grams: 25)
        case "pinch":
            return PieceUnit(dk: { _ in "1 knivspids" }, grams: 0.3)
        case "dash":
            return PieceUnit(dk: { _ in "1 stænk" }, grams: 0.5)
        case "handful":
            return PieceUnit(dk: { plural($0, "håndfuld", "håndfulde") }, grams: 30)
        case "can", "cans", "tin", "tins":
            return PieceUnit(dk: { plural($0, "dåse", "dåser") }, grams: 400)
        case "sprig", "sprigs":
            return PieceUnit(dk: { plural($0, "kvist", "kviste") }, grams: 2)
        case "bunch":
            return PieceUnit(dk: { "\($0.dk(2)) bundt" }, grams: 60)
        case "leaf":
            return PieceUnit(dk: { "\($0.dk(2)) blad" }, grams: 0.5)
        case "leaves":
            return PieceUnit(dk: { "\($0.dk(2)) blade" }, grams: 0.5)
        case "piece", "pieces":
            return PieceUnit(dk: { "\($0.dk(2)) stk" }, grams: 50)
        case "fillet", "fillets":
            return PieceUnit(dk: { plural($0, "filet", "fileter") }, grams: 150)
        default:
            return nil
        }
    }

    /// Bare-count items ("2 eggs", "1 onion"): typical weight per piece in grams.
    /// Checked in order, so more specific fragments come first.
    private static let pieceWeights: [(String, Double)] = [
        ("chicken breast", 175), ("chicken thigh", 120), ("bay leaf", 0.2),
        ("egg", 55), ("onion", 110), ("shallot", 40), ("garlic", 5), ("tomato", 120),
        ("potato", 170), ("carrot", 70), ("pepper", 45), ("chilli", 45), ("chili", 45),
        ("lemon", 70), ("lime", 70), ("apple", 150), ("orange", 150), ("banana", 120),
        ("avocado", 170), ("leek", 100),
    ]

    /// Ingredient-aware density (g per ml) used when converting volume → grams.
    private static func densityFor(_ name: String) -> Double {
        let n = name.lowercased()
        if ["flour", "cocoa", "oats"].contains(where: n.contains) { return 0.55 }
        if ["sugar", "rice", "salt", "lentil", "couscous"].contains(where: n.contains) { return 0.85 }
        if ["butter", "oil", "cream", "mayo"].contains(where: n.contains) { return 0.95 }
        if ["cheese", "breadcrumb"].contains(where: n.contains) { return 0.45 }
        if ["honey", "syrup", "jam"].contains(where: n.contains) { return 1.4 }
        return 1.0 // water-like: milk, stock, wine, chopped produce
    }

    // MARK: Danish formatting

    private static func gram(_ value: Double) -> String {
        value >= 1000 ? "\((value / 1000).dk(2)) kg" : "\(value.rounded().dk(0)) g"
    }

    private static func deciliter(_ value: Double) -> String {
        let tenth = (value * 10).rounded() / 10
        return "\((tenth == 0 ? value : tenth).dk(2)) dl"
    }

    private static func liter(_ value: Double) -> String { "\(value.dk(2)) l" }
    private static func spoon(_ value: Double, _ unit: String) -> String { "\(value.dk(2)) \(unit)" }

    private static func translateWords(_ text: String) -> String {
        var out = text
        // "12 oz" embedded in prose → grams.
        if let regex = try? NSRegularExpression(pattern: #"(\d+(?:[.,]\d+)?)\s*oz\b\.?"#,
                                                options: [.caseInsensitive]) {
            let matches = regex.matches(in: out, range: NSRange(out.startIndex..., in: out)).reversed()
            for match in matches {
                guard let whole = Range(match.range, in: out),
                      let vRange = Range(match.range(at: 1), in: out),
                      let v = Double(out[vRange].replacingOccurrences(of: ",", with: ".")) else { continue }
                out.replaceSubrange(whole, with: gram(v * 28.35))
            }
        }
        let words: [(String, String)] = [
            (#"\btins?\b"#, "dåse"), (#"\bcans?\b"#, "dåse"),
            (#"\bpinch\b"#, "knivspids"), (#"\bdash\b"#, "stænk"),
            (#"\blarge\b"#, "stor"), (#"\bmedium\b"#, "mellem"), (#"\bsmall\b"#, "lille"),
            (#"\bto taste\b"#, "efter smag"), (#"\bto serve\b"#, "til servering"),
            (#"\bchopped\b"#, "hakket"), (#"\bsliced\b"#, "i skiver"),
            (#"\bminced\b"#, "finthakket"),
        ]
        for (pattern, replacement) in words {
            out = out.replacingOccurrences(of: pattern, with: replacement,
                                           options: [.regularExpression, .caseInsensitive])
        }
        return out.trimmingCharacters(in: .whitespaces)
    }

    // MARK: Tiny regex helper

    /// First regex match: subscript by group number (nil when the group didn't
    /// participate), plus the matched length in Characters for slicing.
    struct Match {
        var groups: [String?]
        var matchedLength: Int
        subscript(_ i: Int) -> String? { i < groups.count ? groups[i] : nil }
    }

    static func firstMatch(in text: String, pattern: String) -> Match? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let wholeRange = Range(match.range, in: text)
        else { return nil }
        var groups: [String?] = []
        for i in 0..<match.numberOfRanges {
            if let r = Range(match.range(at: i), in: text) {
                groups.append(String(text[r]))
            } else {
                groups.append(nil)
            }
        }
        return Match(groups: groups, matchedLength: text.distance(from: wholeRange.lowerBound,
                                                                  to: wholeRange.upperBound))
    }
}
