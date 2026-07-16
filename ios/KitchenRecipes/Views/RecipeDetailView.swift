// Recipe detail: stretchy hero image, Danish ingredient list without scroll
// traps, star rating, nutrition estimate, and the door into cooking mode.

import SwiftUI

struct RecipeDetailView: View {
    @Environment(AppModel.self) private var model
    let summary: MealSummary
    var preloaded: Recipe?

    @State private var recipe: Recipe?
    @State private var loadFailed = false
    @State private var cooking = false
    @State private var logging = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                hero
                if let recipe {
                    content(recipe)
                } else if loadFailed {
                    failure
                } else {
                    ProgressView().padding(60)
                }
            }
        }
        .ignoresSafeArea(edges: .top)
        .background(Palette.canvas)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HeartButton(isOn: model.isFavorite(summary.id)) {
                    model.toggleFavorite(summary.id)
                }
            }
        }
        .task {
            if let preloaded {
                recipe = preloaded
            } else {
                do {
                    recipe = try await model.mealDB.lookup(id: summary.id)
                    loadFailed = recipe == nil
                } catch {
                    loadFailed = true
                }
            }
        }
        .fullScreenCover(isPresented: $cooking) {
            if let recipe {
                // Finishing the last step flows straight into "I made this".
                CookingModeView(recipe: recipe) { logging = true }
            }
        }
        .sheet(isPresented: $logging) {
            if let recipe {
                LogMealSheet(recipe: recipe)
            }
        }
    }

    // MARK: Hero (stretches on over-scroll, Airbnb style)

    private var hero: some View {
        GeometryReader { proxy in
            let minY = proxy.frame(in: .global).minY
            let stretch = max(0, minY)
            RemoteImage(url: recipe?.thumbnail ?? summary.thumbnail)
                .frame(width: proxy.size.width, height: proxy.size.height + stretch)
                .clipped()
                .offset(y: -stretch)
                .overlay(alignment: .bottom) {
                    LinearGradient(colors: [.clear, Palette.canvas],
                                   startPoint: .center, endPoint: .bottom)
                        .frame(height: 90)
                        .offset(y: 1)
                }
        }
        .frame(height: 320)
    }

    // MARK: Content

    private func content(_ recipe: Recipe) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 10) {
                Text(recipe.name)
                    .font(.system(.largeTitle, design: .serif, weight: .bold))
                HStack(spacing: 8) {
                    if let category = recipe.category {
                        Label(category, systemImage: FoodIcons.symbol(for: category))
                    }
                    if let area = recipe.area {
                        Label(area, systemImage: "globe.europe.africa")
                    }
                }
                .font(.subheadline.weight(.medium))
                .foregroundStyle(.secondary)

                HStack(spacing: 14) {
                    RatingStars(rating: model.rating(for: recipe.id), interactive: true) { stars in
                        model.setRating(stars, for: recipe.id)
                    }
                    Spacer()
                    let kcal = recipe.estimatedTotals.kcal
                    if kcal > 0 {
                        Label("≈ \((kcal / 4).dk(0)) kcal / serving", systemImage: "flame")
                            .font(.footnote.weight(.medium))
                            .foregroundStyle(.secondary)
                    }
                }
            }

            // Primary actions
            HStack(spacing: 12) {
                Button {
                    Haptics.thud()
                    cooking = true
                } label: {
                    Label("Cooking mode", systemImage: "flame.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.glassProminent)

                Button {
                    logging = true
                } label: {
                    Label("I made this", systemImage: "camera")
                        .font(.headline)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.glass)
            }

            ingredients(recipe)
            instructions(recipe)
            links(recipe)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 40)
    }

    /// Ingredients in Danish measures — a flowing two-column layout, never an
    /// inner scroll view.
    private func ingredients(_ recipe: Recipe) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Ingredients",
                          subtitle: "\(recipe.ingredients.count) items · Danish measures")
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 240), spacing: 10, alignment: .top)],
                      alignment: .leading, spacing: 10) {
                ForEach(recipe.ingredients) { line in
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Circle()
                            .fill(Palette.ember.opacity(0.7))
                            .frame(width: 6, height: 6)
                            .offset(y: -2)
                        Text(line.name)
                            .font(.callout.weight(.medium))
                        Spacer(minLength: 8)
                        Text(line.danishMeasure.isEmpty ? line.measure : line.danishMeasure)
                            .font(.callout.monospacedDigit())
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.trailing)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Palette.card, in: .rect(cornerRadius: 14, style: .continuous))
                }
            }
        }
    }

    private func instructions(_ recipe: Recipe) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Steps", subtitle: "\(recipe.steps.count) steps")
            ForEach(Array(recipe.steps.enumerated()), id: \.offset) { index, step in
                HStack(alignment: .top, spacing: 14) {
                    Text("\(index + 1)")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(Palette.ember)
                        .frame(width: 30, height: 30)
                        .background(Palette.ember.opacity(0.12), in: .circle)
                    Text(DanishUnits.convertTemperatures(step))
                        .font(.callout)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Palette.card, in: .rect(cornerRadius: 16, style: .continuous))
            }
        }
    }

    @ViewBuilder
    private func links(_ recipe: Recipe) -> some View {
        if recipe.youtube != nil || recipe.source != nil {
            HStack(spacing: 12) {
                if let youtube = recipe.youtube {
                    Link(destination: youtube) {
                        Label("Watch video", systemImage: "play.rectangle")
                    }
                }
                if let source = recipe.source {
                    Link(destination: source) {
                        Label("Original source", systemImage: "link")
                    }
                }
            }
            .font(.footnote.weight(.medium))
        }
    }

    private var failure: some View {
        VStack(spacing: 10) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
            Text("Couldn't load this recipe").font(.headline)
        }
        .padding(60)
    }
}
