// The cooking-mode fire: a gentle procession of ember glows drifting around
// the screen border. Deliberately compute-efficient — one Canvas, a fixed
// pool of ~30 particles, 30 fps cap, no per-frame allocations beyond the
// draw pass, and no live blur (the glow is faked with layered strokes and
// radial gradients). Honors Reduce Motion by freezing to a calm static glow.

import SwiftUI

struct EmberBorderView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// How far the glow band sits from the screen edge.
    var inset: CGFloat = 10
    var cornerRadius: CGFloat = 42

    private static let particles: [Particle] = Particle.pool(count: 30)

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: reduceMotion)) { timeline in
            Canvas(rendersAsynchronously: true) { context, size in
                let time = timeline.date.timeIntervalSinceReferenceDate
                draw(context: &context, size: size, time: reduceMotion ? 0 : time)
            }
        }
        .allowsHitTesting(false)
        .ignoresSafeArea()
    }

    // MARK: Drawing

    private func draw(context: inout GraphicsContext, size: CGSize, time: TimeInterval) {
        let rect = CGRect(origin: .zero, size: size).insetBy(dx: inset, dy: inset)
        guard rect.width > 80, rect.height > 80 else { return }
        let radius = min(cornerRadius, min(rect.width, rect.height) / 2 - 1)
        let path = Path(roundedRect: rect, cornerRadius: radius, style: .continuous)

        // Slow "breathing" of the whole band.
        let breath = 0.8 + 0.2 * sin(time * 0.6)

        // Base glow: three concentric strokes instead of a blur filter.
        context.blendMode = .plusLighter
        context.stroke(path, with: .color(Palette.ember.opacity(0.10 * breath)), lineWidth: 16)
        context.stroke(path, with: .color(Palette.ember.opacity(0.22 * breath)), lineWidth: 7)
        context.stroke(path, with: .color(Palette.emberSoft.opacity(0.5 * breath)), lineWidth: 2)

        guard time > 0 else { return } // Reduce Motion: static glow only

        let geometry = PerimeterGeometry(rect: rect, cornerRadius: radius)
        for particle in Self.particles {
            particle.draw(in: &context, along: geometry, time: time)
        }
    }

    // MARK: One ember

    private struct Particle {
        var phase: Double       // 0…1 start position along the perimeter
        var speed: Double       // perimeter loops per second (tiny)
        var size: CGFloat       // base radius in points
        var flickerFreq: Double
        var flickerPhase: Double
        var wobble: CGFloat     // inward drift amplitude
        var warmth: Double      // 0 = deep ember, 1 = bright flame

        /// A deterministic, pleasingly irregular pool (golden-ratio spacing —
        /// no RNG, no clumping).
        static func pool(count: Int) -> [Particle] {
            (0..<count).map { i in
                let f = Double(i)
                let g = (f * 0.6180339887).truncatingRemainder(dividingBy: 1)
                return Particle(
                    phase: g,
                    speed: (0.008 + 0.014 * ((f * 0.7548776662).truncatingRemainder(dividingBy: 1)))
                        * (i % 5 == 0 ? -1 : 1), // a few drift the other way
                    size: 5 + 9 * ((f * 0.3247179572).truncatingRemainder(dividingBy: 1)),
                    flickerFreq: 0.6 + 1.4 * g,
                    flickerPhase: f * 2.399963,
                    wobble: 2 + 7 * ((f * 0.8191725133).truncatingRemainder(dividingBy: 1)),
                    warmth: (f * 0.5698402910).truncatingRemainder(dividingBy: 1)
                )
            }
        }

        func draw(in context: inout GraphicsContext, along geometry: PerimeterGeometry,
                  time: TimeInterval) {
            var t = (phase + speed * time).truncatingRemainder(dividingBy: 1)
            if t < 0 { t += 1 }
            let flicker = 0.5 + 0.5 * sin(time * flickerFreq + flickerPhase)

            let (point, inward) = geometry.point(at: t)
            let drift = wobble * CGFloat(0.4 + 0.6 * flicker)
            let center = CGPoint(x: point.x + inward.dx * drift,
                                 y: point.y + inward.dy * drift)

            let radius = size * CGFloat(0.75 + 0.35 * flicker)
            let color = Color(
                red: 0.83 + 0.17 * warmth * flicker,
                green: 0.36 + 0.42 * warmth * flicker,
                blue: 0.20 + 0.12 * warmth * flicker
            )
            let alpha = 0.14 + 0.20 * flicker

            let rect = CGRect(x: center.x - radius, y: center.y - radius,
                              width: radius * 2, height: radius * 2)
            context.fill(
                Path(ellipseIn: rect),
                with: .radialGradient(
                    Gradient(colors: [color.opacity(alpha), color.opacity(0)]),
                    center: center, startRadius: 0, endRadius: radius)
            )
        }
    }

    /// Maps t ∈ [0, 1) to a point on a rounded-rect perimeter (clockwise from
    /// the top-left corner's end) plus the inward normal at that point.
    private struct PerimeterGeometry {
        let rect: CGRect
        let r: CGFloat
        let straightW: CGFloat
        let straightH: CGFloat
        let arc: CGFloat
        let total: CGFloat

        init(rect: CGRect, cornerRadius: CGFloat) {
            self.rect = rect
            self.r = cornerRadius
            self.straightW = max(0, rect.width - 2 * cornerRadius)
            self.straightH = max(0, rect.height - 2 * cornerRadius)
            self.arc = .pi * cornerRadius / 2
            self.total = 2 * straightW + 2 * straightH + 4 * arc
        }

        func point(at t: Double) -> (CGPoint, CGVector) {
            var d = CGFloat(t) * total

            // Top edge, left → right.
            if d < straightW {
                return (CGPoint(x: rect.minX + r + d, y: rect.minY), CGVector(dx: 0, dy: 1))
            }
            d -= straightW
            // Top-right corner.
            if d < arc {
                let a = d / r // 0…π/2
                let angle = -CGFloat.pi / 2 + a
                return cornerPoint(center: CGPoint(x: rect.maxX - r, y: rect.minY + r), angle: angle)
            }
            d -= arc
            // Right edge, top → bottom.
            if d < straightH {
                return (CGPoint(x: rect.maxX, y: rect.minY + r + d), CGVector(dx: -1, dy: 0))
            }
            d -= straightH
            // Bottom-right corner.
            if d < arc {
                let angle = d / r
                return cornerPoint(center: CGPoint(x: rect.maxX - r, y: rect.maxY - r), angle: angle)
            }
            d -= arc
            // Bottom edge, right → left.
            if d < straightW {
                return (CGPoint(x: rect.maxX - r - d, y: rect.maxY), CGVector(dx: 0, dy: -1))
            }
            d -= straightW
            // Bottom-left corner.
            if d < arc {
                let angle = .pi / 2 + d / r
                return cornerPoint(center: CGPoint(x: rect.minX + r, y: rect.maxY - r), angle: angle)
            }
            d -= arc
            // Left edge, bottom → top.
            if d < straightH {
                return (CGPoint(x: rect.minX, y: rect.maxY - r - d), CGVector(dx: 1, dy: 0))
            }
            d -= straightH
            // Top-left corner.
            let angle = .pi + min(d, arc) / r
            return cornerPoint(center: CGPoint(x: rect.minX + r, y: rect.minY + r), angle: angle)
        }

        private func cornerPoint(center: CGPoint, angle: CGFloat) -> (CGPoint, CGVector) {
            let point = CGPoint(x: center.x + r * cos(angle), y: center.y + r * sin(angle))
            return (point, CGVector(dx: -cos(angle), dy: -sin(angle)))
        }
    }
}
