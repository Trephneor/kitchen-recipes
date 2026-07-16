// Discover: a swipeable deck of recipes. Swipe right to save a favorite,
// left to pass — with rotation, stamps and spring physics in the Tinder
// tradition. Tap a card to open the full recipe. A filter sheet narrows the
// deck to chosen categories (Vegetarian, Dessert, …) without cluttering the
// main view: just a toolbar button that shows a badge while filters are on.

import SwiftUI

struct DiscoverDeckView: View {
    @Environment(AppModel.self) private var model

    @State private var deck: [Recipe] = []
    @State private var isLoading = false
    @State private var loadFailed = false

    @State private var categories: [String] = []
    @State private var selectedCategories: Set<String> = []
    @State private var showFilters = false
    /// Everything already dealt in this session, so refills never repeat cards.
    @State private var seenIDs: Set<String> = []

    var body: some View {
        NavigationStack {
            ZStack {
                Palette.canvas.ignoresSafeArea()

                if deck.isEmpty && loadFailed {
                    unavailableState(icon: "wifi.exclamationmark",
                                     title: "Can't reach the recipe service",
                                     message: "Check the connection and try again.",
                                     actionLabel: "Try again") {
                        Task { await refill() }
                    }
                } else if deck.isEmpty && !isLoading && !selectedCategories.isEmpty {
                    unavailableState(icon: "checkmark.rectangle.stack",
                                     title: "You've seen them all",
                                     message: "Every \(selectedCategories.sorted().joined(separator: " and ").lowercased()) recipe has crossed the deck.",
                                     actionLabel: "Start over") {
                        seenIDs.removeAll()
                        Task { await refill() }
                    }
                } else if deck.isEmpty {
                    ProgressView("Shuffling recipes…")
                } else {
                    deckStack
                }
            }
            .navigationTitle("Discover")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Haptics.tap()
                        showFilters = true
                    } label: {
                        Image(systemName: selectedCategories.isEmpty
                              ? "line.3.horizontal.decrease"
                              : "line.3.horizontal.decrease.circle.fill")
                            .foregroundStyle(selectedCategories.isEmpty ? Color.primary : Palette.ember)
                            .contentTransition(.symbolEffect(.replace))
                    }
                    .accessibilityLabel(selectedCategories.isEmpty
                                        ? "Filter the deck"
                                        : "Filter the deck (\(selectedCategories.count) active)")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Haptics.thud()
                        deck.removeAll()
                        seenIDs.removeAll()
                        Task { await refill() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .accessibilityLabel("New deck")
                }
            }
            .navigationDestination(for: MealSummary.self) { summary in
                RecipeDetailView(summary: summary,
                                 preloaded: deck.first { $0.id == summary.id })
            }
            .sheet(isPresented: $showFilters) {
                DeckFilterSheet(categories: categories, selected: $selectedCategories)
            }
            .task {
                if categories.isEmpty {
                    categories = (try? await model.mealDB.categories()) ?? []
                }
                if deck.isEmpty { await refill() }
            }
            .onChange(of: selectedCategories) { _, _ in
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    deck.removeAll()
                }
                seenIDs.removeAll()
                Task { await refill() }
            }
        }
    }

    // MARK: Deck

    private var deckStack: some View {
        VStack(spacing: 14) {
            if !selectedCategories.isEmpty {
                activeFilterPill
            }
            ZStack {
                // Bottom-most card renders first; only the top card is draggable.
                ForEach(Array(deck.prefix(3).enumerated().reversed()), id: \.element.id) { index, recipe in
                    SwipeCard(recipe: recipe,
                              stackIndex: index,
                              isTop: index == 0,
                              onSwiped: { liked in advance(recipe: recipe, liked: liked) })
                }
            }
            .frame(maxWidth: 560, maxHeight: .infinity)
            .padding(.horizontal, 20)

            actionRow
        }
        .padding(.bottom, 16)
    }

    /// One quiet line above the deck: what's filtered, tap to edit, ✕ to clear.
    private var activeFilterPill: some View {
        HStack(spacing: 0) {
            Button {
                showFilters = true
            } label: {
                HStack(spacing: 7) {
                    Image(systemName: "line.3.horizontal.decrease")
                        .font(.caption.weight(.semibold))
                    Text(selectedCategories.sorted().joined(separator: " · "))
                        .font(.footnote.weight(.medium))
                        .lineLimit(1)
                }
                .padding(.leading, 14)
                .padding(.vertical, 9)
            }
            Button {
                Haptics.tap()
                selectedCategories.removeAll()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 9)
            }
            .accessibilityLabel("Clear filters")
        }
        .glassEffect(.regular.interactive())
        .buttonStyle(.squishy)
        .padding(.horizontal, 20)
    }

    private var actionRow: some View {
        GlassEffectContainer(spacing: 22) {
            HStack(spacing: 22) {
                Button {
                    Haptics.tap()
                    if let top = deck.first { advance(recipe: top, liked: false) }
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(.secondary)
                        .frame(width: 62, height: 62)
                        .glassEffect(.regular.interactive(), in: .circle)
                }
                .buttonStyle(.squishy)
                .accessibilityLabel("Pass")

                Button {
                    Haptics.success()
                    if let top = deck.first { advance(recipe: top, liked: true) }
                } label: {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 72, height: 72)
                        .glassEffect(.regular.tint(Palette.ember).interactive(), in: .circle)
                }
                .buttonStyle(.squishy)
                .accessibilityLabel("Save to favorites")
            }
        }
    }

    private func advance(recipe: Recipe, liked: Bool) {
        if liked, !model.isFavorite(recipe.id) {
            model.toggleFavorite(recipe.id)
        }
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            deck.removeAll { $0.id == recipe.id }
        }
        if deck.count < 3 {
            Task { await refill() }
        }
    }

    // MARK: Loading

    private func refill() async {
        guard !isLoading else { return }
        isLoading = true
        loadFailed = false
        defer { isLoading = false }
        do {
            let fresh: [Recipe]
            if selectedCategories.isEmpty {
                fresh = try await model.mealDB.random(count: 8)
            } else {
                fresh = try await filteredBatch()
            }
            let excluded = Set(deck.map(\.id)).union(seenIDs)
            let newOnes = fresh.filter { !excluded.contains($0.id) }
            deck.append(contentsOf: newOnes)
            seenIDs.formUnion(newOnes.map(\.id))
        } catch {
            loadFailed = deck.isEmpty
        }
    }

    /// Union the selected categories, drop everything already seen, shuffle,
    /// and hydrate a handful of full recipes for the deck.
    private func filteredBatch() async throws -> [Recipe] {
        let client = model.mealDB
        var pool: [MealSummary] = []
        for category in selectedCategories.sorted() {
            pool += try await client.filter(.category(category))
        }
        let excluded = Set(deck.map(\.id)).union(seenIDs)
        let picks = pool.filter { !excluded.contains($0.id) }.shuffled().prefix(8)

        return try await withThrowingTaskGroup(of: Recipe?.self) { group in
            for summary in picks {
                group.addTask { try await client.lookup(id: summary.id) }
            }
            var out: [Recipe] = []
            for try await recipe in group {
                if let recipe { out.append(recipe) }
            }
            return out
        }
    }

    private func unavailableState(icon: String, title: String, message: String,
                                  actionLabel: String, action: @escaping () -> Void) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text(title).font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            HStack(spacing: 12) {
                Button(actionLabel, action: action)
                    .buttonStyle(.glassProminent)
                if !selectedCategories.isEmpty {
                    Button("Change filters") { showFilters = true }
                        .buttonStyle(.glass)
                }
            }
        }
    }
}

// MARK: - Filter sheet

private struct DeckFilterSheet: View {
    @Environment(\.dismiss) private var dismiss
    let categories: [String]
    @Binding var selected: Set<String>

    /// Edits are local until "Done" — the deck doesn't thrash mid-selection.
    @State private var draft: Set<String>

    init(categories: [String], selected: Binding<Set<String>>) {
        self.categories = categories
        self._selected = selected
        self._draft = State(initialValue: selected.wrappedValue)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 148), spacing: 10)],
                          spacing: 10) {
                    ForEach(categories, id: \.self) { name in
                        let isOn = draft.contains(name)
                        Button {
                            Haptics.tap()
                            if isOn {
                                draft.remove(name)
                            } else {
                                draft.insert(name)
                            }
                        } label: {
                            Label(name, systemImage: FoodIcons.symbol(for: name))
                                .font(.subheadline.weight(.medium))
                                .lineLimit(1)
                                .foregroundStyle(isOn ? Color.white : .primary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 13)
                                .glassEffect(isOn ? .regular.tint(Palette.ember).interactive()
                                                  : .regular.interactive(),
                                             in: .capsule)
                        }
                        .buttonStyle(.squishy)
                        .accessibilityAddTraits(isOn ? .isSelected : [])
                    }
                }
                .padding(.horizontal)
                .padding(.top, 6)

                Text("Pick as many as you like — the deck deals only those kinds of recipes.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
            }
            .navigationTitle("Filter the deck")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Clear") {
                        Haptics.tap()
                        draft.removeAll()
                    }
                    .disabled(draft.isEmpty)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        if selected != draft { selected = draft }
                        dismiss()
                    }
                    .bold()
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}

// MARK: - One draggable card

private struct SwipeCard: View {
    @Environment(AppModel.self) private var model
    let recipe: Recipe
    let stackIndex: Int
    let isTop: Bool
    let onSwiped: (Bool) -> Void

    @State private var translation: CGSize = .zero

    private var swipeProgress: CGFloat {
        max(-1, min(1, translation.width / 140))
    }

    var body: some View {
        NavigationLink(value: recipe.summary) {
            card
        }
        .buttonStyle(.plain)
        .disabled(!isTop)
        // Depth: cards behind peek out slightly smaller and lower.
        .scaleEffect(1 - CGFloat(stackIndex) * 0.045)
        .offset(y: CGFloat(stackIndex) * 14)
        .offset(translation)
        .rotationEffect(.degrees(Double(swipeProgress) * 8), anchor: .bottom)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: stackIndex)
        .gesture(isTop ? dragGesture : nil)
        .zIndex(Double(-stackIndex))
    }

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                translation = value.translation
            }
            .onEnded { value in
                let fling = value.predictedEndTranslation.width
                if abs(fling) > 220 || abs(translation.width) > 140 {
                    let liked = (fling + translation.width) > 0
                    withAnimation(.easeOut(duration: 0.3)) {
                        translation = CGSize(width: liked ? 900 : -900,
                                             height: translation.height + value.velocity.height * 0.1)
                    }
                    Task {
                        try? await Task.sleep(for: .milliseconds(180))
                        onSwiped(liked)
                    }
                } else {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.65)) {
                        translation = .zero
                    }
                }
            }
    }

    private var card: some View {
        ZStack(alignment: .bottomLeading) {
            // Bounded 3:4 base; the image fills it and gets clipped.
            Color.clear
                .aspectRatio(3.0 / 4.0, contentMode: .fit)
                .overlay { RemoteImage(url: recipe.thumbnail) }

            LinearGradient(colors: [.clear, .clear, .black.opacity(0.8)],
                           startPoint: .top, endPoint: .bottom)

            VStack(alignment: .leading, spacing: 8) {
                Text(recipe.name)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                HStack(spacing: 8) {
                    if let category = recipe.category {
                        Label(category, systemImage: FoodIcons.symbol(for: category))
                    }
                    if let area = recipe.area {
                        Label(area, systemImage: "globe.europe.africa")
                    }
                    let kcal = recipe.estimatedTotals.kcal
                    if kcal > 0 {
                        Label("\((kcal / 4).dk(0)) kcal", systemImage: "flame")
                    }
                }
                .font(.caption.weight(.medium))
                .foregroundStyle(.white.opacity(0.9))
            }
            .padding(20)
        }
        .overlay { stamps }
        .clipShape(.rect(cornerRadius: 28, style: .continuous))
        .shadow(color: .black.opacity(isTop ? 0.22 : 0.1), radius: 18, y: 10)
    }

    /// SAVE / PASS stamps fade in as the card crosses the threshold.
    private var stamps: some View {
        ZStack {
            stamp("SAVE", color: Palette.leaf, angle: -12)
                .opacity(Double(max(0, swipeProgress)))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            stamp("PASS", color: Palette.ember, angle: 12)
                .opacity(Double(max(0, -swipeProgress)))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
        }
        .padding(22)
    }

    private func stamp(_ text: String, color: Color, angle: Double) -> some View {
        Text(text)
            .font(.system(size: 32, weight: .heavy))
            .kerning(2)
            .foregroundStyle(color)
            .padding(.horizontal, 14)
            .padding(.vertical, 6)
            .overlay {
                RoundedRectangle(cornerRadius: 10)
                    .stroke(color, lineWidth: 4)
            }
            .rotationEffect(.degrees(angle))
    }
}
