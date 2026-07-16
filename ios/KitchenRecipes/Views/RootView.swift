// Five tabs; on iPad (the kitchen-counter tablet) the tab bar adapts to a
// sidebar automatically. Liquid Glass tab chrome comes free on iOS 26.

import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.selectedTab) {
            Tab("Recipes", systemImage: "book.pages", value: AppTab.recipes) {
                RecipesView()
            }
            Tab("Discover", systemImage: "rectangle.stack", value: AppTab.discover) {
                DiscoverDeckView()
            }
            Tab("Diary", systemImage: "camera.on.rectangle", value: AppTab.diary) {
                DiaryView()
            }
            Tab("Insights", systemImage: "chart.xyaxis.line", value: AppTab.insights) {
                InsightsView()
            }
            Tab("Settings", systemImage: "gearshape", value: AppTab.settings) {
                SettingsView()
            }
        }
        .tabViewStyle(.sidebarAdaptable)
    }
}
