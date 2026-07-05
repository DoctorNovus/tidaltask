import UIKit
import Capacitor
import AVFoundation
import Speech
import WidgetKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        WidgetCenter.shared.reloadAllTimelines()
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        if let token = UserDefaults.standard.string(forKey: "siriDeviceToken"), !token.isEmpty {
            UserDefaults(suiteName: "group.com.ottegi.sequenced-app")?.set(token, forKey: "deviceToken")
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

@objc(VoiceCommandsPlugin)
public class VoiceCommandsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VoiceCommandsPlugin"
    public let jsName = "VoiceCommands"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkSpeechPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestSpeechPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startListening", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopListening", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "speak", returnType: CAPPluginReturnPromise)
    ]

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let synthesizer = AVSpeechSynthesizer()
    private var isListening = false

    @objc func checkSpeechPermission(_ call: CAPPluginCall) {
        let speechStatus = SFSpeechRecognizer.authorizationStatus()
        let recordStatus = AVAudioSession.sharedInstance().recordPermission
        call.resolve([
            "speech": mapSpeechStatus(speechStatus),
            "microphone": mapRecordStatus(recordStatus)
        ])
    }

    @objc func requestSpeechPermission(_ call: CAPPluginCall) {
        let group = DispatchGroup()
        var speechStatus: SFSpeechRecognizerAuthorizationStatus = .notDetermined
        var recordStatus: AVAudioSession.RecordPermission = .undetermined

        group.enter()
        SFSpeechRecognizer.requestAuthorization { status in
            speechStatus = status
            group.leave()
        }

        group.enter()
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            recordStatus = granted ? .granted : .denied
            group.leave()
        }

        group.notify(queue: .main) {
            call.resolve([
                "speech": self.mapSpeechStatus(speechStatus),
                "microphone": self.mapRecordStatus(recordStatus)
            ])
        }
    }

    @objc func startListening(_ call: CAPPluginCall) {
        if isListening {
            call.resolve()
            return
        }

        guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
            call.reject("Speech recognition permission not granted.")
            return
        }

        guard AVAudioSession.sharedInstance().recordPermission == .granted else {
            call.reject("Microphone permission not granted.")
            return
        }

        do {
            try configureAudioSession()
        } catch {
            call.reject("Failed to configure audio session: \(error.localizedDescription)")
            return
        }

        recognitionTask?.cancel()
        recognitionTask = nil

        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        recognitionRequest?.shouldReportPartialResults = true

        guard let recognitionRequest else {
            call.reject("Unable to create speech request.")
            return
        }

        guard let inputNode = audioEngine.inputNode as AVAudioInputNode? else {
            call.reject("Audio input not available.")
            return
        }

        inputNode.removeTap(onBus: 0)
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            recognitionRequest.append(buffer)
        }

        audioEngine.prepare()

        do {
            try audioEngine.start()
        } catch {
            call.reject("Audio engine failed to start: \(error.localizedDescription)")
            return
        }

        isListening = true
        notifyListeners("listeningState", data: ["isListening": true])

        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self else { return }
            if let result {
                let text = result.bestTranscription.formattedString
                self.notifyListeners("partialResult", data: ["text": text, "isFinal": result.isFinal])
                if result.isFinal {
                    self.notifyListeners("finalResult", data: ["text": text])
                }
            }

            if let error {
                self.notifyListeners("error", data: ["message": error.localizedDescription])
                self.stopInternal()
            }
        }

        call.resolve()
    }

    @objc func stopListening(_ call: CAPPluginCall) {
        stopInternal()
        call.resolve()
    }

    @objc func speak(_ call: CAPPluginCall) {
        guard let text = call.getString("text")?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else {
            call.reject("Text is required.")
            return
        }

        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        synthesizer.speak(utterance)
        call.resolve()
    }

    private func stopInternal() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }

        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
        isListening = false
        notifyListeners("listeningState", data: ["isListening": false])
    }

    private func configureAudioSession() throws {
        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.playAndRecord, mode: .default, options: [.allowBluetooth])
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
    }

    private func mapSpeechStatus(_ status: SFSpeechRecognizerAuthorizationStatus) -> String {
        switch status {
        case .authorized:
            return "authorized"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "not_determined"
        @unknown default:
            return "unknown"
        }
    }

    private func mapRecordStatus(_ status: AVAudioSession.RecordPermission) -> String {
        switch status {
        case .granted:
            return "granted"
        case .denied:
            return "denied"
        case .undetermined:
            return "undetermined"
        @unknown default:
            return "unknown"
        }
    }
}
