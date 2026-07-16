// Kitchen Recipes — a kitchen-counter recipe & nutrition companion.
//
// SwiftUI app targeting iOS 26: Liquid Glass chrome, zoom navigation
// transitions, a swipeable discovery deck, and a cooking mode with a gentle
// ember border that keeps the screen awake.

import SwiftUI

@main
struct KitchenRecipesApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .tint(Palette.ember)
        }
    }
}
