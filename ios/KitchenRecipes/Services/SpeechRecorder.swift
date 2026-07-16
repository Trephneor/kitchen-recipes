// On-device dictation for meal logging: hold-to-talk style recording with a
// live transcript, built on SFSpeechRecognizer + AVAudioEngine.

import AVFoundation
import Foundation
import Observation
import Speech

@MainActor
@Observable
final class SpeechRecorder {

    private(set) var isRecording = false
    private(set) var transcript = ""
    private(set) var errorMessage: String?

    private let audioEngine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    init() {
        // Prefer the device locale; fall back to English if unsupported.
        recognizer = SFSpeechRecognizer(locale: .current) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    }

    func toggle() {
        isRecording ? stop() : start()
    }

    func start() {
        errorMessage = nil
        transcript = ""

        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            Task { @MainActor [weak self] in
                guard let self else { return }
                guard status == .authorized else {
                    self.errorMessage = "Speech recognition permission was declined."
                    return
                }
                AVAudioApplication.requestRecordPermission { granted in
                    Task { @MainActor [weak self] in
                        guard let self else { return }
                        guard granted else {
                            self.errorMessage = "Microphone permission was declined."
                            return
                        }
                        self.beginSession()
                    }
                }
            }
        }
    }

    private func beginSession() {
        guard let recognizer, recognizer.isAvailable else {
            errorMessage = "Speech recognition isn't available right now."
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            if recognizer.supportsOnDeviceRecognition {
                request.requiresOnDeviceRecognition = true
            }
            self.request = request

            let inputNode = audioEngine.inputNode
            let format = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                request.append(buffer)
            }

            task = recognizer.recognitionTask(with: request) { [weak self] result, error in
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    if let result {
                        self.transcript = result.bestTranscription.formattedString
                    }
                    if error != nil || (result?.isFinal ?? false) {
                        self.finishSession()
                    }
                }
            }

            audioEngine.prepare()
            try audioEngine.start()
            isRecording = true
            Haptics.tap()
        } catch {
            errorMessage = "Couldn't start recording: \(error.localizedDescription)"
            finishSession()
        }
    }

    func stop() {
        request?.endAudio()
        finishSession()
    }

    private func finishSession() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        task?.cancel()
        task = nil
        request = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        if isRecording {
            isRecording = false
            Haptics.tap()
        }
    }
}
