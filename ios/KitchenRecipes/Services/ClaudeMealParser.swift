// Optional smarter meal parsing: when the user has added an Anthropic API
// key, spoken/typed meal descriptions are parsed by Claude into food portions
// that map onto the local nutrition catalog. Falls back to the catalog's own
// text scanner when no key is set or the call fails.

import Foundation

enum ClaudeMealParser {

    struct ParseError: Error {}

    /// "Two fried eggs and a bowl of rice" → [egg 110 g, rice 180 g]
    static func parse(text: String, apiKey: String) async throws -> [FoodPortion] {
        var request = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")

        let knownFoods = FoodCatalog.foods.keys.sorted().joined(separator: ", ")
        let prompt = """
        Parse this meal description into foods with estimated weights in grams.
        Reply with ONLY a JSON array, no prose: [{"name": "...", "grams": 123}, …]
        Each "name" MUST be chosen from this list (pick the closest match): \(knownFoods)
        Skip anything that has no reasonable match. Meal description:
        \(text)
        """

        let body: [String: Any] = [
            "model": "claude-opus-4-8",
            "max_tokens": 700,
            "messages": [["role": "user", "content": prompt]],
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw ParseError()
        }

        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = root["content"] as? [[String: Any]],
              let reply = content.first(where: { $0["type"] as? String == "text" })?["text"] as? String
        else { throw ParseError() }

        // Tolerate stray prose around the array.
        guard let start = reply.firstIndex(of: "["), let end = reply.lastIndex(of: "]"),
              start < end,
              let arrayData = String(reply[start...end]).data(using: .utf8),
              let items = try? JSONSerialization.jsonObject(with: arrayData) as? [[String: Any]]
        else { throw ParseError() }

        return items.compactMap { item in
            guard let name = item["name"] as? String,
                  let grams = (item["grams"] as? Double) ?? (item["grams"] as? Int).map(Double.init),
                  grams > 0, FoodCatalog.lookup(name) != nil
            else { return nil }
            return FoodPortion(name: name, grams: min(grams, 2000))
        }
    }
}
