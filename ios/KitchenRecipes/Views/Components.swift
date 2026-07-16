// Small shared views: remote images, hearts, star ratings, chips.

import SwiftUI

// MARK: - Remote image with a quiet fade-in

struct RemoteImage: View {
    var url: URL?

    var body: some View {
        AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.35))) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFill().transition(.opacity)
            case .failure:
                placeholder(symbol: "photo.badge.exclamationmark")
            case .empty:
                placeholder(symbol: nil)
            @unknown default:
                placeholder(symbol: nil)
            }
        }
    }

    private func placeholder(symbol: String?) -> some View {
        ZStack {
            LinearGradient(colors: [Palette.card, Palette.canvas],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            if let symbol {
                Image(systemName: symbol)
                    .font(.title2)
                    .foregroundStyle(.tertiary)
            }
        }
    }
}

// MARK: - Favorite heart

struct HeartButton: View {
    var isOn: Bool
    var action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            Image(systemName: isOn ? "heart.fill" : "heart")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(isOn ? Palette.ember : .primary)
                .contentTransition(.symbolEffect(.replace))
                .padding(10)
                .glassEffect(.regular.interactive())
        }
        .buttonStyle(.squishy)
        .accessibilityLabel(isOn ? "Remove from favorites" : "Add to favorites")
    }
}

// MARK: - Star rating (display + interactive)

struct RatingStars: View {
    var rating: Int
    var interactive = false
    var onChange: ((Int) -> Void)? = nil

    var body: some View {
        HStack(spacing: interactive ? 8 : 2) {
            ForEach(1...5, id: \.self) { star in
                Image(systemName: star <= rating ? "star.fill" : "star")
                    .font(interactive ? .title2 : .caption)
                    .foregroundStyle(star <= rating ? Palette.flameYellow : .secondary)
                    .symbolEffect(.bounce, value: rating == star)
                    .onTapGesture {
                        guard interactive else { return }
                        Haptics.tap()
                        // Tapping the current rating clears it.
                        onChange?(star == rating ? 0 : star)
                    }
            }
        }
        .accessibilityLabel("\(rating) of 5 stars")
    }
}

// MARK: - Category chip

struct CategoryChip: View {
    var label: String
    var systemImage: String
    var isActive: Bool
    var action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            Label(label, systemImage: systemImage)
                .font(.subheadline.weight(.medium))
                .lineLimit(1)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .foregroundStyle(isActive ? Color.white : .primary)
                .glassEffect(isActive ? .regular.tint(Palette.ember).interactive()
                                      : .regular.interactive())
        }
        .buttonStyle(.squishy)
    }
}

// MARK: - Section header for card stacks

struct SectionHeader: View {
    var title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.title3.weight(.semibold))
            if let subtitle {
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
