// Cooking mode: full-screen, dark and calm, with the ember border flowing
// around the edge. Steps page horizontally, every step fits on screen, and
// any duration mentioned in a step becomes a tappable timer. The screen
// stays awake for the whole session.

import AudioToolbox
import SwiftUI

struct CookingModeView: View {
    @Environment(\.dismiss) private var dismiss
    let recipe: Recipe
    var onFinish: (() -> Void)? = nil

    @State private var step = 0
    @State private var timers = CookTimers()
    @State private var dragY: CGFloat = 0
    @State private var showIngredients = false

    private var steps: [String] { recipe.steps }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.11, green: 0.08, blue: 0.06),
                                    Color(red: 0.05, green: 0.04, blue: 0.03)],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                header
                pager
                controls
            }

            EmberBorderView()
        }
        .colorScheme(.dark)
        .offset(y: dragY)
        .opacity(1 - Double(dragY) / 900)
        .onAppear {
            UIApplication.shared.isIdleTimerDisabled = true
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
            timers.cancelAll()
        }
        .sheet(isPresented: $showIngredients) {
            ingredientsSheet
        }
    }

    // MARK: Header (also the drag-to-dismiss handle)

    private var header: some View {
        GlassEffectContainer(spacing: 12) {
            HStack(spacing: 12) {
                Button {
                    Haptics.tap()
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .bold))
                        .frame(width: 40, height: 40)
                        .glassEffect(.regular.interactive(), in: .circle)
                }
                .buttonStyle(.squishy)
                .accessibilityLabel("Leave cooking mode")

                VStack(spacing: 1) {
                    Text(recipe.name)
                        .font(.footnote.weight(.semibold))
                        .lineLimit(1)
                    Text("Step \(step + 1) of \(steps.count)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)

                if !timers.active.isEmpty {
                    TimelineView(.periodic(from: .now, by: 1)) { timeline in
                        Label(timers.soonestRemainingLabel(now: timeline.date),
                              systemImage: "timer")
                            .font(.caption.weight(.semibold).monospacedDigit())
                            .padding(.horizontal, 12)
                            .padding(.vertical, 9)
                            .glassEffect(.regular.tint(Palette.ember.opacity(0.6)))
                    }
                }

                Button {
                    showIngredients = true
                } label: {
                    Image(systemName: "basket")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(width: 40, height: 40)
                        .glassEffect(.regular.interactive(), in: .circle)
                }
                .buttonStyle(.squishy)
                .accessibilityLabel("Show ingredients")
            }
        }
        .padding(.horizontal, 26)
        .padding(.top, 8)
        .contentShape(.rect)
        .gesture(dismissDrag)
    }

    /// Pull the whole mode down to leave it — follows the finger with a hint
    /// of resistance, springs back if released early.
    private var dismissDrag: some Gesture {
        DragGesture()
            .onChanged { value in
                dragY = max(0, value.translation.height * 0.7)
            }
            .onEnded { value in
                if value.translation.height > 170 || value.predictedEndTranslation.height > 400 {
                    Haptics.tap()
                    dismiss()
                } else {
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
                        dragY = 0
                    }
                }
            }
    }

    // MARK: Steps pager

    private var pager: some View {
        TabView(selection: $step) {
            ForEach(Array(steps.enumerated()), id: \.offset) { index, text in
                stepPage(index: index, text: text)
                    .tag(index)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .animation(.spring(response: 0.45, dampingFraction: 0.85), value: step)
    }

    private func stepPage(index: Int, text: String) -> some View {
        VStack(spacing: 24) {
            Spacer(minLength: 8)

            Text(DanishUnits.convertTemperatures(text))
                .font(.system(size: 32, weight: .medium, design: .serif))
                .minimumScaleFactor(0.35)   // long steps shrink to fit — never scroll
                .lineSpacing(5)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 700)
                .frame(maxHeight: .infinity)

            let specs = timers.specs(in: text, stepIndex: index)
            if !specs.isEmpty {
                timerRow(specs)
            }

            Spacer(minLength: 8)
        }
        .padding(.horizontal, 44)
    }

    private func timerRow(_ specs: [CookTimers.Spec]) -> some View {
        TimelineView(.periodic(from: .now, by: 0.5)) { timeline in
            HStack(spacing: 10) {
                ForEach(specs) { spec in
                    timerChip(spec, now: timeline.date)
                }
            }
        }
    }

    private func timerChip(_ spec: CookTimers.Spec, now: Date) -> some View {
        let state = timers.state(of: spec, now: now)
        return Button {
            Haptics.thud()
            timers.toggle(spec)
        } label: {
            HStack(spacing: 7) {
                Image(systemName: state.symbol)
                Text(state.text(for: spec))
                    .monospacedDigit()
            }
            .font(.callout.weight(.semibold))
            .padding(.horizontal, 16)
            .padding(.vertical, 11)
            .glassEffect(state.isHot ? .regular.tint(Palette.ember).interactive()
                                     : .regular.interactive())
        }
        .buttonStyle(.squishy)
        .accessibilityLabel(state.accessibility(for: spec))
    }

    // MARK: Controls

    private var controls: some View {
        GlassEffectContainer(spacing: 16) {
            HStack(spacing: 16) {
                Button {
                    Haptics.tap()
                    withAnimation { step = max(0, step - 1) }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 18, weight: .bold))
                        .frame(width: 54, height: 54)
                        .glassEffect(.regular.interactive(), in: .circle)
                }
                .buttonStyle(.squishy)
                .disabled(step == 0)
                .opacity(step == 0 ? 0.35 : 1)
                .accessibilityLabel("Previous step")

                progressDots
                    .frame(maxWidth: .infinity)

                Button {
                    if step == steps.count - 1 {
                        Haptics.success()
                        dismiss()
                        onFinish?()
                    } else {
                        Haptics.tap()
                        withAnimation { step += 1 }
                    }
                } label: {
                    Label(step == steps.count - 1 ? "Finish" : "Next",
                          systemImage: step == steps.count - 1 ? "checkmark" : "chevron.right")
                        .font(.headline)
                        .padding(.horizontal, 10)
                        .frame(height: 54)
                }
                .buttonStyle(.glassProminent)
                .accessibilityLabel(step == steps.count - 1 ? "Finish cooking" : "Next step")
            }
        }
        .padding(.horizontal, 30)
        .padding(.bottom, 14)
    }

    private var progressDots: some View {
        HStack(spacing: 5) {
            // Cap the dots so 40-step recipes don't overflow; the label in the
            // header always carries the exact count.
            let visible = min(steps.count, 12)
            let mapped = steps.count <= 12 ? step : Int(Double(step) / Double(steps.count - 1) * 11)
            ForEach(0..<visible, id: \.self) { i in
                Capsule()
                    .fill(i == mapped ? Palette.emberSoft : .white.opacity(0.25))
                    .frame(width: i == mapped ? 24 : 7, height: 7)
                    .animation(.spring(response: 0.35, dampingFraction: 0.7), value: step)
            }
        }
    }

    // MARK: Ingredients peek

    private var ingredientsSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(recipe.ingredients) { line in
                        HStack(alignment: .firstTextBaseline) {
                            Text(line.name).font(.callout.weight(.medium))
                            Spacer()
                            Text(line.danishMeasure.isEmpty ? line.measure : line.danishMeasure)
                                .font(.callout.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 18)
                        .padding(.vertical, 10)
                        .background(Palette.card, in: .rect(cornerRadius: 12, style: .continuous))
                    }
                }
                .padding()
            }
            .navigationTitle("Ingredients")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(.thinMaterial)
        .colorScheme(.dark)
    }
}

// MARK: - Step timers

@MainActor
@Observable
final class CookTimers {

    struct Spec: Identifiable, Hashable {
        let id: String
        var label: String       // the matched text, e.g. "10–12 minutes"
        var seconds: TimeInterval
        var stepIndex: Int
    }

    struct Active {
        var spec: Spec
        var end: Date
        var fired = false
    }

    private(set) var active: [String: Active] = [:]
    @ObservationIgnored private var ticker: Timer?
    // Not observed: written lazily during view evaluation, which must not
    // register as a state change.
    @ObservationIgnored private var specCache: [Int: [Spec]] = [:]

    // MARK: Parsing ("simmer for 10-12 minutes" → 11-minute timer)

    private static let durationRegex = try! NSRegularExpression(
        pattern: #"(\d+(?:\.\d+)?)\s*(?:(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*)?(hours?|hrs?\.?|minutes?|mins?\.?|seconds?|secs?\.?)\b"#,
        options: [.caseInsensitive])

    func specs(in text: String, stepIndex: Int) -> [Spec] {
        if let cached = specCache[stepIndex] { return cached }
        var specs: [Spec] = []
        let range = NSRange(text.startIndex..., in: text)
        for (i, match) in Self.durationRegex.matches(in: text, range: range).enumerated() {
            guard let whole = Range(match.range, in: text),
                  let firstRange = Range(match.range(at: 1), in: text),
                  let unitRange = Range(match.range(at: 3), in: text),
                  let first = Double(text[firstRange]) else { continue }

            let second = Range(match.range(at: 2), in: text).flatMap { Double(text[$0]) }
            let value = second.map { (first + $0) / 2 } ?? first // ranges → midpoint

            let unit = text[unitRange].lowercased()
            let multiplier: Double
            if unit.hasPrefix("h") { multiplier = 3600 }
            else if unit.hasPrefix("m") { multiplier = 60 }
            else { multiplier = 1 }

            let seconds = value * multiplier
            guard seconds >= 5, seconds <= 12 * 3600 else { continue }
            specs.append(Spec(id: "step\(stepIndex)-\(i)",
                              label: String(text[whole]),
                              seconds: seconds,
                              stepIndex: stepIndex))
        }
        specCache[stepIndex] = specs
        return specs
    }

    // MARK: Lifecycle

    func toggle(_ spec: Spec) {
        if active[spec.id] != nil {
            active.removeValue(forKey: spec.id) // running → cancel, fired → clear
        } else {
            active[spec.id] = Active(spec: spec, end: Date().addingTimeInterval(spec.seconds))
            startTicker()
        }
        if active.isEmpty { stopTicker() }
    }

    func cancelAll() {
        active.removeAll()
        stopTicker()
    }

    private func startTicker() {
        guard ticker == nil else { return }
        ticker = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in self?.tick() }
        }
    }

    private func stopTicker() {
        ticker?.invalidate()
        ticker = nil
    }

    private func tick() {
        let now = Date()
        for (id, entry) in active where !entry.fired && entry.end <= now {
            active[id]?.fired = true
            ring()
        }
    }

    private func ring() {
        AudioServicesPlaySystemSound(SystemSoundID(1005))
        Haptics.warning()
    }

    // MARK: Presentation

    enum ChipState {
        case idle, running(TimeInterval), done

        var symbol: String {
            switch self {
            case .idle: return "timer"
            case .running: return "pause.fill"
            case .done: return "bell.fill"
            }
        }

        var isHot: Bool {
            switch self {
            case .idle: return false
            default: return true
            }
        }

        func text(for spec: Spec) -> String {
            switch self {
            case .idle: return spec.label
            case .running(let remaining): return Self.countdown(remaining)
            case .done: return "Done!"
            }
        }

        func accessibility(for spec: Spec) -> String {
            switch self {
            case .idle: return "Start timer for \(spec.label)"
            case .running(let remaining): return "Timer running, \(Self.countdown(remaining)) left. Tap to cancel."
            case .done: return "Timer finished. Tap to clear."
            }
        }

        static func countdown(_ interval: TimeInterval) -> String {
            let total = max(0, Int(interval.rounded()))
            let h = total / 3600, m = (total % 3600) / 60, s = total % 60
            return h > 0 ? String(format: "%d:%02d:%02d", h, m, s)
                         : String(format: "%d:%02d", m, s)
        }
    }

    func state(of spec: Spec, now: Date) -> ChipState {
        guard let entry = active[spec.id] else { return .idle }
        if entry.fired || entry.end <= now { return .done }
        return .running(entry.end.timeIntervalSince(now))
    }

    func soonestRemainingLabel(now: Date) -> String {
        let soonest = active.values
            .filter { !$0.fired }
            .map { $0.end.timeIntervalSince(now) }
            .min()
        guard let soonest else { return "Done!" }
        return ChipState.countdown(soonest)
    }
}
