// Design system: a calm, warm palette (paper, charcoal, ember), soft depth,
// and springy micro-interactions shared across the app.

import SwiftUI
import UIKit

enum Palette {
    /// Terracotta accent carried over from the web app, tuned for vibrancy on OLED.
    static let ember = Color(red: 0.83, green: 0.36, blue: 0.20)
    static let emberSoft = Color(red: 0.95, green: 0.56, blue: 0.32)
    static let flameYellow = Color(red: 1.00, green: 0.78, blue: 0.36)

    static let leaf = Color(red: 0.36, green: 0.55, blue: 0.31)
    static let sea = Color(red: 0.23, green: 0.45, blue: 0.62)

    /// Chart series — colorblind-safe ordering (blue/orange/green/purple).
    static let chart: [Color] = [
        Color(red: 0.27, green: 0.47, blue: 0.72),
        Color(red: 0.88, green: 0.53, blue: 0.20),
        Color(red: 0.36, green: 0.62, blue: 0.35),
        Color(red: 0.55, green: 0.42, blue: 0.67),
        Color(red: 0.75, green: 0.31, blue: 0.30),
    ]

    /// Warm card background that adapts to light/dark.
    static let card = Color(uiColor: .secondarySystemGroupedBackground)
    static let canvas = Color(uiColor: .systemGroupedBackground)
}

// MARK: - Haptics

enum Haptics {
    static func tap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
    static func thud() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
    static func warning() {
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
    }
}

// MARK: - Micro-interactions

/// Buttons scale down slightly and spring back — the "alive" feel, applied
/// consistently instead of per-view one-offs.
struct SquishyButtonStyle: ButtonStyle {
    var scale: CGFloat = 0.94

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? scale : 1)
            .animation(.spring(response: 0.28, dampingFraction: 0.55), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == SquishyButtonStyle {
    static var squishy: SquishyButtonStyle { SquishyButtonStyle() }
}

/// Standard card container: rounded, softly elevated, concentric with the
/// device corners when near screen edges.
struct CardBackground: ViewModifier {
    var cornerRadius: CGFloat = 24

    func body(content: Content) -> some View {
        content
            .background(Palette.card, in: .rect(cornerRadius: cornerRadius, style: .continuous))
            .shadow(color: .black.opacity(0.06), radius: 12, y: 4)
    }
}

extension View {
    func cardBackground(cornerRadius: CGFloat = 24) -> some View {
        modifier(CardBackground(cornerRadius: cornerRadius))
    }
}

// MARK: - Formatting helpers

extension Double {
    /// "1.234,5" style Danish decimal formatting with ≤ `digits` fraction digits.
    func dk(_ digits: Int = 0) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "da_DK")
        formatter.maximumFractionDigits = digits
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: self)) ?? String(Int(self.rounded()))
    }
}
