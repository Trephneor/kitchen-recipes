// Food diary: meals grouped by day with photos, dictated descriptions and
// nutrient estimates. Logging happens in a sheet — photo, voice or keyboard.

import PhotosUI
import SwiftUI

struct DiaryView: View {
    @Environment(AppModel.self) private var model
    @State private var logging = false

    private var groupedByDay: [(day: Date, meals: [DiaryMeal])] {
        let groups = Dictionary(grouping: model.diary) {
            Calendar.current.startOfDay(for: $0.date)
        }
        return groups.keys.sorted(by: >).map { ($0, groups[$0]!.sorted { $0.date > $1.date }) }
    }

    var body: some View {
        NavigationStack {
            Group {
                if model.diary.isEmpty {
                    emptyState
                } else {
                    list
                }
            }
            .background(Palette.canvas)
            .navigationTitle("Diary")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Haptics.tap()
                        logging = true
                    } label: {
                        Label("Log a meal", systemImage: "plus")
                    }
                    .buttonStyle(.glassProminent)
                }
            }
            .sheet(isPresented: $logging) {
                LogMealSheet()
            }
        }
    }

    private var list: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18, pinnedViews: []) {
                ForEach(groupedByDay, id: \.day) { group in
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(dayLabel(group.day))
                                .font(.title3.weight(.semibold))
                            Spacer()
                            let kcal = group.meals.reduce(0) { $0 + $1.totals.kcal }
                            Text("\(kcal.dk(0)) kcal")
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                        ForEach(group.meals) { meal in
                            MealRow(meal: meal)
                        }
                    }
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 30)
        }
    }

    private func dayLabel(_ day: Date) -> String {
        if Calendar.current.isDateInToday(day) { return "Today" }
        if Calendar.current.isDateInYesterday(day) { return "Yesterday" }
        return day.formatted(.dateTime.weekday(.wide).day().month())
    }

    private var emptyState: some View {
        VStack(spacing: 14) {
            Image(systemName: "camera.on.rectangle")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("Nothing logged yet").font(.headline)
            Text("Cook something, snap a photo and tell me what you ate —\nthe insights tab does the rest.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                logging = true
            } label: {
                Label("Log a meal", systemImage: "plus")
                    .font(.headline)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
            }
            .buttonStyle(.glassProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - One diary row

private struct MealRow: View {
    @Environment(AppModel.self) private var model
    let meal: DiaryMeal

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if let url = model.photoURL(for: meal) {
                AsyncImage(url: url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Palette.canvas
                }
                .frame(width: 84, height: 84)
                .clipShape(.rect(cornerRadius: 16, style: .continuous))
            } else {
                Image(systemName: "fork.knife")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                    .frame(width: 84, height: 84)
                    .background(Palette.canvas, in: .rect(cornerRadius: 16, style: .continuous))
            }

            VStack(alignment: .leading, spacing: 5) {
                Text(meal.text.isEmpty ? (meal.recipeName ?? "Meal") : meal.text)
                    .font(.callout.weight(.medium))
                    .lineLimit(2)
                HStack(spacing: 10) {
                    Text(meal.date.formatted(date: .omitted, time: .shortened))
                    if meal.totals.kcal > 0 {
                        Label("\(meal.totals.kcal.dk(0)) kcal", systemImage: "flame")
                    }
                    if let recipeName = meal.recipeName {
                        Label(recipeName, systemImage: "book.pages")
                            .lineLimit(1)
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)

                if !meal.portions.isEmpty {
                    Text(meal.portions.map { "\($0.name) \($0.grams.dk(0)) g" }
                        .joined(separator: " · "))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .cardBackground(cornerRadius: 22)
        .contextMenu {
            Button(role: .destructive) {
                model.deleteMeal(meal)
            } label: {
                Label("Delete entry", systemImage: "trash")
            }
        }
    }
}

// MARK: - Logging sheet (photo · voice · text)

struct LogMealSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var recipe: Recipe? = nil

    @State private var text = ""
    @State private var image: UIImage?
    @State private var showCamera = false
    @State private var libraryItem: PhotosPickerItem?
    @State private var speech = SpeechRecorder()
    @State private var saving = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    photoSection
                    voiceAndText
                    if let recipe {
                        Label("Logged as “\(recipe.name)”", systemImage: "book.pages")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding()
            }
            .background(Palette.canvas)
            .navigationTitle(recipe == nil ? "Log a meal" : "I made this")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        save()
                    } label: {
                        if saving {
                            ProgressView()
                        } else {
                            Text("Save").bold()
                        }
                    }
                    .disabled(saving || (text.isEmpty && image == nil && recipe == nil))
                }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraPicker(image: $image)
                    .ignoresSafeArea()
            }
            .onChange(of: libraryItem) { _, item in
                guard let item else { return }
                Task {
                    if let data = try? await item.loadTransferable(type: Data.self),
                       let picked = UIImage(data: data) {
                        image = picked
                    }
                }
            }
            .onChange(of: speech.transcript) { _, transcript in
                if !transcript.isEmpty { text = transcript }
            }
        }
        .presentationDetents([.large])
    }

    private var photoSection: some View {
        VStack(spacing: 10) {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity)
                    .frame(height: 220)
                    .clipShape(.rect(cornerRadius: 22, style: .continuous))
                    .overlay(alignment: .topTrailing) {
                        Button {
                            self.image = nil
                        } label: {
                            Image(systemName: "xmark")
                                .font(.caption.weight(.bold))
                                .padding(8)
                                .glassEffect(.regular.interactive(), in: .circle)
                        }
                        .padding(8)
                    }
            }
            HStack(spacing: 12) {
                Button {
                    showCamera = true
                } label: {
                    Label(image == nil ? "Take a photo" : "Retake", systemImage: "camera")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.glass)

                PhotosPicker(selection: $libraryItem, matching: .images) {
                    Label("Library", systemImage: "photo.on.rectangle")
                        .padding(.vertical, 6)
                }
                .buttonStyle(.glass)
            }
        }
    }

    private var voiceAndText: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader(title: "What did you eat?",
                          subtitle: "Dictate or type — foods and amounts are picked out automatically.")

            TextEditor(text: $text)
                .frame(minHeight: 110)
                .padding(10)
                .scrollContentBackground(.hidden)
                .background(Palette.card, in: .rect(cornerRadius: 16, style: .continuous))
                .overlay(alignment: .topLeading) {
                    if text.isEmpty {
                        Text("e.g. “grilled salmon with 200 g rice and broccoli”")
                            .font(.callout)
                            .foregroundStyle(.tertiary)
                            .padding(18)
                            .allowsHitTesting(false)
                    }
                }

            Button {
                speech.toggle()
            } label: {
                Label(speech.isRecording ? "Listening… tap to stop" : "Dictate",
                      systemImage: speech.isRecording ? "waveform" : "mic.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .contentTransition(.symbolEffect(.replace))
            }
            .buttonStyle(.glassProminent)
            .tint(speech.isRecording ? .red : Palette.ember)

            if let error = speech.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func save() {
        saving = true
        let photo = image
        let description = text
        Task {
            if speech.isRecording { speech.stop() }
            _ = await model.logMeal(text: description, photo: photo, recipe: recipe)
            Haptics.success()
            dismiss()
        }
    }
}

// MARK: - Camera

struct CameraPicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            picker.sourceType = .camera
        }
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            parent.image = (info[.originalImage] as? UIImage)
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
