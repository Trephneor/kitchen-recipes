// Browse: live search, category chips with icons, favorites, and a grid of
// compact cards that zoom into the detail view (Airbnb-style transition).

import SwiftUI

struct RecipesView: View {
    @Environment(AppModel.self) private var model

    @State private var search = ""
    @State private var category = ""
    @State private var favoritesOnly = false
    @State private var ingredient: String?
    @State private var sortByRating = false

    @State private var categories: [String] = []
    @State private var results: [MealSummary] = []
    @State private var preloaded: [String: Recipe] = [:]
    @State private var isLoading = true
    @State private var loadFailed = false
    @State private var reloadToken = 0

    @Namespace private var zoom

    /// One value that captures everything a reload depends on — used as the
    /// identity of the loading task so typing cancels stale requests.
    private struct Query: Equatable {
        var search: String
        var category: String
        var favoritesOnly: Bool
        var ingredient: String?
        var token: Int
    }

    private var query: Query {
        Query(search: search, category: category, favoritesOnly: favoritesOnly,
              ingredient: ingredient, token: reloadToken)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    chipsRow
                    if let ingredient {
                        ingredientBanner(ingredient)
                    }
                    grid
                }
                .padding(.horizontal)
                .padding(.bottom, 24)
            }
            .background(Palette.canvas)
            .navigationTitle("Recipes")
            .searchable(text: $search, prompt: "Search recipes")
            .toolbar { toolbarContent }
            .navigationDestination(for: MealSummary.self) { summary in
                RecipeDetailView(summary: summary, preloaded: preloaded[summary.id])
                    .navigationTransition(.zoom(sourceID: summary.id, in: zoom))
            }
            .task(id: query) { await load() }
            .task { categories = (try? await model.mealDB.categories()) ?? [] }
            .onChange(of: search) { _, newValue in
                if !newValue.isEmpty {
                    category = ""; favoritesOnly = false; ingredient = nil
                }
            }
            .onChange(of: model.pendingIngredientFilter) { _, newValue in
                adoptPendingFilter(newValue)
            }
            .onAppear { adoptPendingFilter(model.pendingIngredientFilter) }
        }
    }

    private func adoptPendingFilter(_ pending: String?) {
        guard let pending else { return }
        ingredient = pending
        search = ""; category = ""; favoritesOnly = false
        model.pendingIngredientFilter = nil
    }

    // MARK: Chips & toolbar

    private var chipsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                CategoryChip(label: "All", systemImage: FoodIcons.symbol(for: "all"),
                             isActive: category.isEmpty && !favoritesOnly && ingredient == nil && search.isEmpty) {
                    search = ""; category = ""; favoritesOnly = false; ingredient = nil
                    reloadToken += 1
                }
                ForEach(categories, id: \.self) { name in
                    CategoryChip(label: name, systemImage: FoodIcons.symbol(for: name),
                                 isActive: category == name) {
                        category = category == name ? "" : name
                        search = ""; favoritesOnly = false; ingredient = nil
                    }
                }
            }
            .padding(.vertical, 4)
        }
        .scrollClipDisabled()
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                Haptics.tap()
                favoritesOnly.toggle()
                if favoritesOnly { search = ""; category = ""; ingredient = nil }
            } label: {
                Image(systemName: favoritesOnly ? "heart.fill" : "heart")
                    .foregroundStyle(favoritesOnly ? Palette.ember : .primary)
            }
            .accessibilityLabel("Show favorites only")
        }
        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                Picker("Sort", selection: $sortByRating) {
                    Label("A–Z", systemImage: "textformat").tag(false)
                    Label("My rating", systemImage: "star").tag(true)
                }
            } label: {
                Image(systemName: "arrow.up.arrow.down")
            }
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                Haptics.thud()
                search = ""; category = ""; favoritesOnly = false; ingredient = nil
                reloadToken += 1
            } label: {
                Image(systemName: "dice")
            }
            .accessibilityLabel("Surprise me with random recipes")
        }
    }

    private func ingredientBanner(_ name: String) -> some View {
        HStack {
            Label("Recipes with \(name)", systemImage: "basket")
                .font(.subheadline.weight(.medium))
            Spacer()
            Button("Clear") { ingredient = nil }
                .font(.subheadline)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .glassEffect(.regular, in: .rect(cornerRadius: 16))
    }

    // MARK: Grid

    private var sortedResults: [MealSummary] {
        if sortByRating {
            return results.sorted {
                (model.rating(for: $1.id), $0.name) < (model.rating(for: $0.id), $1.name)
            }
        }
        return results.sorted { $0.name < $1.name }
    }

    @ViewBuilder
    private var grid: some View {
        if !isLoading && loadFailed {
            emptyState(icon: "wifi.exclamationmark",
                       title: "Can't reach the recipe service",
                       message: "Check the connection and try again.")
        } else if !isLoading && sortedResults.isEmpty {
            emptyState(icon: favoritesOnly ? "heart.slash" : "frying.pan",
                       title: favoritesOnly ? "No favorites yet" : "Nothing found",
                       message: favoritesOnly
                           ? "Tap the heart on a recipe you love and it will live here."
                           : "Try another search, or let the dice pick something.")
        } else {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 168, maximum: 240), spacing: 12)],
                      spacing: 12) {
                if isLoading {
                    ForEach(0..<8, id: \.self) { _ in skeletonCard }
                } else {
                    ForEach(sortedResults) { summary in
                        card(summary)
                    }
                }
            }
        }
    }

    private func card(_ summary: MealSummary) -> some View {
        NavigationLink(value: summary) {
            ZStack(alignment: .bottomLeading) {
                // Bounded square base; the image fills it and gets clipped.
                Color.clear
                    .aspectRatio(1, contentMode: .fit)
                    .overlay { RemoteImage(url: summary.thumbnail) }

                LinearGradient(colors: [.clear, .clear, .black.opacity(0.75)],
                               startPoint: .top, endPoint: .bottom)

                VStack(alignment: .leading, spacing: 3) {
                    Text(summary.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                    HStack(spacing: 6) {
                        if let category = summary.category {
                            Text(category)
                                .font(.caption2)
                                .foregroundStyle(.white.opacity(0.85))
                        }
                        if model.rating(for: summary.id) > 0 {
                            RatingStars(rating: model.rating(for: summary.id))
                        }
                    }
                }
                .padding(12)
            }
            .overlay(alignment: .topTrailing) {
                HeartButton(isOn: model.isFavorite(summary.id)) {
                    let nowOn = model.toggleFavorite(summary.id)
                    if favoritesOnly && !nowOn {
                        results.removeAll { $0.id == summary.id }
                    }
                }
                .padding(8)
            }
            .clipShape(.rect(cornerRadius: 22, style: .continuous))
            .contentShape(.rect(cornerRadius: 22, style: .continuous))
            .shadow(color: .black.opacity(0.10), radius: 10, y: 4)
        }
        .buttonStyle(.squishy)
        .matchedTransitionSource(id: summary.id, in: zoom)
    }

    private var skeletonCard: some View {
        RoundedRectangle(cornerRadius: 22, style: .continuous)
            .fill(Palette.card)
            .aspectRatio(1, contentMode: .fit)
            .shimmering()
    }

    private func emptyState(icon: String, title: String, message: String) -> some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text(title).font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, 60)
        .frame(maxWidth: .infinity)
    }

    // MARK: Loading

    private func load() async {
        // Debounce keystrokes: the task is cancelled and restarted on each change.
        if !search.isEmpty {
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
        }
        isLoading = true
        loadFailed = false
        defer { isLoading = false }

        do {
            if favoritesOnly {
                let ids = Array(model.favorites)
                var loaded: [Recipe] = []
                for id in ids {
                    if let recipe = preloaded[id] ?? (try? await model.mealDB.lookup(id: id)) {
                        loaded.append(recipe)
                    }
                }
                for recipe in loaded { preloaded[recipe.id] = recipe }
                results = loaded.map(\.summary)
            } else if !search.isEmpty {
                let recipes = try await model.mealDB.search(search)
                for recipe in recipes { preloaded[recipe.id] = recipe }
                results = recipes.map(\.summary)
            } else if let ingredient {
                results = try await model.mealDB.filter(.ingredient(ingredient))
            } else if !category.isEmpty {
                results = try await model.mealDB.filter(.category(category))
            } else {
                let recipes = try await model.mealDB.random(count: 12)
                for recipe in recipes { preloaded[recipe.id] = recipe }
                results = recipes.map(\.summary)
            }
        } catch is CancellationError {
            // superseded by a newer query — keep whatever is on screen
        } catch {
            if !Task.isCancelled {
                results = []
                loadFailed = true
            }
        }
    }
}

// MARK: - Skeleton shimmer

private struct Shimmer: ViewModifier {
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        content
            .overlay {
                GeometryReader { proxy in
                    LinearGradient(colors: [.clear, .white.opacity(0.35), .clear],
                                   startPoint: .leading, endPoint: .trailing)
                        .frame(width: proxy.size.width * 0.6)
                        .offset(x: phase * proxy.size.width * 1.6)
                        .blendMode(.plusLighter)
                }
                .clipShape(.rect(cornerRadius: 22, style: .continuous))
            }
            .onAppear {
                withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

extension View {
    func shimmering() -> some View { modifier(Shimmer()) }
}
