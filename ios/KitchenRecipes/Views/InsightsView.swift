// Insights: what the nutrition graph knows — today's energy, two weeks of
// trend, macro balance, vitamin & mineral coverage, most-eaten foods, and
// "eat healthier" recommendations that deep-link back into recipe search.

import Charts
import SwiftUI

struct InsightsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        NavigationStack {
            Group {
                if model.diary.isEmpty {
                    emptyState
                } else {
                    ScrollView {
                        VStack(spacing: 16) {
                            todayCard
                            energyTrendCard
                            macroCard
                            coverageCard
                            recommendationsCard
                            topFoodsCard
                            graphFootnote
                        }
                        .padding()
                    }
                }
            }
            .background(Palette.canvas)
            .navigationTitle("Insights")
        }
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "chart.xyaxis.line")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("The graph is hungry").font(.headline)
            Text("Log a few meals in the diary and this tab fills up with\nenergy trends, macro balance and personalised suggestions.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: Today

    private var todayCard: some View {
        let today = model.graph.totals(lastDays: 1).last?.totals ?? NutrientTotals()
        let target = model.dailyKcalTarget
        return HStack(spacing: 20) {
            Gauge(value: min(today.kcal, target * 1.5), in: 0...(target * 1.5)) {
                Text("kcal")
            } currentValueLabel: {
                Text(today.kcal.dk(0))
                    .font(.system(.title3, design: .rounded, weight: .bold))
            }
            .gaugeStyle(.accessoryCircular)
            .tint(Gradient(colors: [Palette.leaf, Palette.flameYellow, Palette.ember]))
            .scaleEffect(1.35)
            .frame(width: 92, height: 92)

            VStack(alignment: .leading, spacing: 6) {
                Text("Today")
                    .font(.title3.weight(.semibold))
                Text("\(today.kcal.dk(0)) of \(target.dk(0)) kcal")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                HStack(spacing: 12) {
                    macroPill("Protein", grams: today.protein, color: Palette.chart[0])
                    macroPill("Fat", grams: today.fat, color: Palette.chart[1])
                    macroPill("Carbs", grams: today.carbs, color: Palette.chart[2])
                }
            }
            Spacer(minLength: 0)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardBackground()
    }

    private func macroPill(_ label: String, grams: Double, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(grams.dk(0) + " g")
                .font(.footnote.weight(.bold).monospacedDigit())
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: Energy trend (14 days)

    private var energyTrendCard: some View {
        let days = model.graph.totals(lastDays: 14)
        let loggedDays = days.filter { $0.totals.kcal > 0 }
        let average = loggedDays.isEmpty ? 0
            : loggedDays.reduce(0) { $0 + $1.totals.kcal } / Double(loggedDays.count)

        return VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Energy, last 14 days",
                          subtitle: average > 0 ? "Average \(average.dk(0)) kcal on logged days" : nil)
            Chart {
                ForEach(days, id: \.day) { entry in
                    BarMark(
                        x: .value("Day", entry.day, unit: .day),
                        y: .value("kcal", entry.totals.kcal)
                    )
                    .foregroundStyle(
                        entry.totals.kcal > model.dailyKcalTarget
                            ? Palette.ember.gradient
                            : Palette.chart[0].gradient
                    )
                    .cornerRadius(4)
                }
                RuleMark(y: .value("Target", model.dailyKcalTarget))
                    .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                    .foregroundStyle(.secondary)
                    .annotation(position: .topTrailing, alignment: .trailing) {
                        Text("target")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
            }
            .chartXAxis {
                AxisMarks(values: .stride(by: .day, count: 2)) { _ in
                    AxisGridLine()
                    AxisValueLabel(format: .dateTime.day(), centered: true)
                }
            }
            .frame(height: 190)
        }
        .padding(18)
        .cardBackground()
    }

    // MARK: Macro balance (7 days)

    private struct MacroSlice: Identifiable {
        var name: String
        var kcal: Double
        var color: Color
        var id: String { name }
    }

    private var macroCard: some View {
        let avg = model.graph.averageDaily(lastDays: 7)
        let slices = [
            MacroSlice(name: "Protein", kcal: avg.protein * 4, color: Palette.chart[0]),
            MacroSlice(name: "Fat", kcal: avg.fat * 9, color: Palette.chart[1]),
            MacroSlice(name: "Carbs", kcal: avg.carbs * 4, color: Palette.chart[2]),
        ].filter { $0.kcal > 0 }
        let total = slices.reduce(0) { $0 + $1.kcal }

        return VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Macro balance",
                          subtitle: "Average share of energy, last 7 days")
            if total > 0 {
                HStack(spacing: 18) {
                    Chart(slices) { slice in
                        SectorMark(
                            angle: .value("kcal", slice.kcal),
                            innerRadius: .ratio(0.62),
                            angularInset: 2
                        )
                        .foregroundStyle(slice.color)
                        .cornerRadius(4)
                    }
                    .frame(width: 150, height: 150)

                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(slices) { slice in
                            HStack(spacing: 8) {
                                Circle().fill(slice.color).frame(width: 9, height: 9)
                                Text(slice.name).font(.subheadline)
                                Spacer()
                                Text("\((slice.kcal / total * 100).dk(0)) %")
                                    .font(.subheadline.weight(.semibold).monospacedDigit())
                            }
                        }
                    }
                }
            } else {
                Text("Not enough data yet.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardBackground()
    }

    // MARK: Vitamin & mineral coverage

    private var coverageCard: some View {
        let micros: [Nutrient] = [.fiber, .vitA, .vitC, .vitD, .b12,
                                  .iron, .calcium, .potassium, .magnesium]
        let coverage = model.graph.coverage(lastDays: 7)
            .filter { micros.contains($0.nutrient) }

        return VStack(alignment: .leading, spacing: 12) {
            SectionHeader(title: "Vitamins & minerals",
                          subtitle: "Average daily intake vs. reference target, last 7 days")
            Chart {
                ForEach(coverage, id: \.nutrient) { entry in
                    BarMark(
                        x: .value("Coverage", min(entry.fraction, 1.5) * 100),
                        y: .value("Nutrient", entry.nutrient.label)
                    )
                    .foregroundStyle(color(for: entry.fraction).gradient)
                    .cornerRadius(4)
                    .annotation(position: .trailing) {
                        Text("\((entry.fraction * 100).dk(0)) %")
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                }
                RuleMark(x: .value("Target", 100))
                    .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                    .foregroundStyle(.secondary)
            }
            .chartXAxis(.hidden)
            .chartXScale(domain: 0...165)
            .frame(height: CGFloat(coverage.count) * 32 + 20)
        }
        .padding(18)
        .cardBackground()
    }

    private func color(for fraction: Double) -> Color {
        if fraction >= 0.85 { return Palette.leaf }
        if fraction >= 0.5 { return Palette.flameYellow }
        return Palette.ember
    }

    // MARK: Recommendations

    private var recommendationsCard: some View {
        let recommendations = model.graph.recommendations()
        return Group {
            if !recommendations.isEmpty {
                VStack(alignment: .leading, spacing: 14) {
                    SectionHeader(title: "Eat healthier",
                                  subtitle: "Where last week ran low — and foods that fix it")
                    ForEach(recommendations) { rec in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Label(rec.nutrient.label, systemImage: "arrow.up.heart")
                                    .font(.subheadline.weight(.semibold))
                                Spacer()
                                Text("\((rec.fraction * 100).dk(0)) % of target")
                                    .font(.caption.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(rec.foods, id: \.self) { food in
                                        Button {
                                            Haptics.tap()
                                            model.pendingIngredientFilter = food
                                            model.selectedTab = .recipes
                                        } label: {
                                            Label(food, systemImage: "magnifyingglass")
                                                .font(.footnote.weight(.medium))
                                                .padding(.horizontal, 12)
                                                .padding(.vertical, 8)
                                                .glassEffect(.regular.interactive())
                                        }
                                        .buttonStyle(.squishy)
                                    }
                                }
                            }
                            .scrollClipDisabled()
                        }
                        .padding(12)
                        .background(Palette.canvas, in: .rect(cornerRadius: 16, style: .continuous))
                    }
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .cardBackground()
            }
        }
    }

    // MARK: Top foods

    private var topFoodsCard: some View {
        let foods = model.graph.topFoods(6)
        return Group {
            if !foods.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    SectionHeader(title: "Most eaten", subtitle: "By total amount logged")
                    Chart {
                        ForEach(foods, id: \.name) { food in
                            BarMark(
                                x: .value("Grams", food.grams),
                                y: .value("Food", food.name)
                            )
                            .foregroundStyle(Palette.chart[3].gradient)
                            .cornerRadius(4)
                            .annotation(position: .trailing) {
                                Text("\(food.grams.dk(0)) g")
                                    .font(.caption2.monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .chartXAxis(.hidden)
                    .frame(height: CGFloat(foods.count) * 32 + 16)
                }
                .padding(18)
                .cardBackground()
            }
        }
    }

    private var graphFootnote: some View {
        Label("Knowledge graph: \(model.graph.nodeCount) nodes · \(model.graph.edgeCount) edges. Estimates are for insight, not medical advice.",
              systemImage: "point.3.connected.trianglepath.dotted")
            .font(.caption2)
            .foregroundStyle(.tertiary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 6)
    }
}
