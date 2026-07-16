// Settings: daily energy target, optional Claude API key for smarter meal
// parsing, and data management.

import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var confirmClear = false

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Text("Daily energy target")
                        Spacer()
                        Text("\(model.dailyKcalTarget.dk(0)) kcal")
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    Slider(value: $model.dailyKcalTarget, in: 1200...3500, step: 50) {
                        Text("Daily energy target")
                    }
                } header: {
                    Text("Nutrition")
                } footer: {
                    Text("Targets follow the Nordic Nutrition Recommendations ballpark for adults. All estimates are for insight, not medical advice.")
                }

                Section {
                    SecureField("Anthropic API key (optional)", text: $model.claudeAPIKey)
                        .textContentType(.password)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                } header: {
                    Text("Claude")
                } footer: {
                    Text("With a key, meal descriptions are parsed by Claude into foods and amounts. Without one, a built-in parser scans for known foods. The key is stored in the Keychain and used only against api.anthropic.com.")
                }

                Section {
                    LabeledContent("Meals logged", value: "\(model.diary.count)")
                    LabeledContent("Graph",
                                   value: "\(model.graph.nodeCount) nodes · \(model.graph.edgeCount) edges")
                    Button("Delete all diary entries", role: .destructive) {
                        confirmClear = true
                    }
                    .disabled(model.diary.isEmpty)
                } header: {
                    Text("Data")
                } footer: {
                    Text("Everything lives on this device. Recipes come from TheMealDB.")
                }

                Section("About") {
                    LabeledContent("Version", value: "1.0")
                    Link("Recipes by TheMealDB",
                         destination: URL(string: "https://www.themealdb.com")!)
                }
            }
            .navigationTitle("Settings")
            .confirmationDialog("Delete all diary entries?",
                                isPresented: $confirmClear, titleVisibility: .visible) {
                Button("Delete everything", role: .destructive) {
                    model.clearDiary()
                    Haptics.warning()
                }
            } message: {
                Text("This removes every logged meal and photo. There is no undo.")
            }
        }
    }
}
