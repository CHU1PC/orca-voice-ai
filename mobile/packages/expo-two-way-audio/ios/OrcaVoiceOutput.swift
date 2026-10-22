import AVFoundation
import Foundation

final class OrcaVoiceOutput {
    private let synthesizer = AVSpeechSynthesizer()

    func enqueue(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        DispatchQueue.main.async {
            do {
                try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
                try AVAudioSession.sharedInstance().setActive(true)
            } catch {
                NSLog("Speech audio session failed: %@", String(describing: error))
            }
            let utterance = AVSpeechUtterance(string: text)
            utterance.voice = AVSpeechSynthesisVoice(language: "ja-JP")
            self.synthesizer.speak(utterance)
        }
    }

    func stop() {
        DispatchQueue.main.async {
            self.synthesizer.stopSpeaking(at: .immediate)
        }
    }
}
