// Discover: a swipeable deck of random recipes. Swipe right to save a
// favorite, left to pass — with rotation, stamps and spring physics in the
// Tinder tradition. Tap a card to open the full recipe.

import SwiftUI

struct DiscoverDeckView: View {
    @Environment(AppModel.self) private var model

    @State private var deck: [Recipe] = []
    @State private var isLoading = false
    @State private var loadFailed = false
    @State private var savedCount = 0

    var body: some View {
        NavigationStack {
            ZStack {
                Palette.canvas.ignoresSafeArea()

                if deck.isEmpty && isLoading {
                    ProgressView("Shuffling recipes…")
                } else if deck.isEmpty && loadFailed {
                    VStack(spacing: 12) {
                        Image(systemName: "wifi.exclamationmark")
                            .font(.system(size: 40))
                            .foregroundStyle(.secondary)
                        Text("Can't reach the recipe service").font(.headline)
                        Button("Try again") { Task { await refill() } }
                            .buttonStyle(.glassProminent)
                    }
                } else {
                    deckStack
                }
            }
            .navigationTitle("Discover")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Haptics.thud()
                        deck.removeAll()
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
            .task { if deck.isEmpty { await refill() } }
        }
    }

    private var deckStack: some View {
        VStack(spacing: 18) {
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
            savedCount += 1
        }
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            deck.removeAll { $0.id == recipe.id }
        }
        if deck.count < 3 {
            Task { await refill() }
        }
    }

    private func refill() async {
        guard !isLoading else { return }
        isLoading = true
        loadFailed = false
        defer { isLoading = false }
        do {
            let fresh = try await model.mealDB.random(count: 8)
            let existing = Set(deck.map(\.id))
            deck.append(contentsOf: fresh.filter { !existing.contains($0.id) })
        } catch {
            loadFailed = deck.isEmpty
        }
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
