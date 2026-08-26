import AVFoundation
import Speech
import UIKit
import WebKit

@UIApplicationMain
public class AppDelegate: UIResponder, UIApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
  public var window: UIWindow?

  private weak var webView: WKWebView?
  private weak var statusLabel: UILabel?
  private let audioEngine = AVAudioEngine()
  private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en_US"))
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private var hasInstalledAudioTap = false
  private var lastDbSentAt: TimeInterval = 0
  private var lastTranscript = ""
  private var shouldRunAudio = false

  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let window = UIWindow(frame: UIScreen.main.bounds)
    let viewController = UIViewController()
    viewController.view.backgroundColor = UIColor(red: 0.96, green: 0.97, blue: 0.99, alpha: 1)

    let configuration = WKWebViewConfiguration()
    configuration.allowsInlineMediaPlayback = true
    configuration.mediaTypesRequiringUserActionForPlayback = []
    if #available(iOS 14.0, *) {
      configuration.defaultWebpagePreferences.allowsContentJavaScript = true
    }

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.translatesAutoresizingMaskIntoConstraints = false
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.backgroundColor = UIColor(red: 0.96, green: 0.97, blue: 0.99, alpha: 1)
    webView.isOpaque = false
    webView.scrollView.isScrollEnabled = false
    webView.scrollView.bounces = false
    webView.scrollView.contentInsetAdjustmentBehavior = .never

    viewController.view.addSubview(webView)
    NSLayoutConstraint.activate([
      webView.leadingAnchor.constraint(equalTo: viewController.view.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: viewController.view.trailingAnchor),
      webView.topAnchor.constraint(equalTo: viewController.view.safeAreaLayoutGuide.topAnchor),
      webView.bottomAnchor.constraint(equalTo: viewController.view.bottomAnchor),
    ])

    let statusLabel = UILabel()
    let buildNumber = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown"
    statusLabel.translatesAutoresizingMaskIntoConstraints = false
    statusLabel.text = "Loading Shout Out to the Moon... Build \(buildNumber)"
    statusLabel.numberOfLines = 0
    statusLabel.textAlignment = .center
    statusLabel.textColor = UIColor(red: 0.10, green: 0.15, blue: 0.24, alpha: 1)
    statusLabel.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
    statusLabel.adjustsFontForContentSizeCategory = false
    viewController.view.addSubview(statusLabel)
    NSLayoutConstraint.activate([
      statusLabel.centerXAnchor.constraint(equalTo: viewController.view.centerXAnchor),
      statusLabel.centerYAnchor.constraint(equalTo: viewController.view.centerYAnchor),
      statusLabel.leadingAnchor.constraint(equalTo: viewController.view.leadingAnchor, constant: 24),
      statusLabel.trailingAnchor.constraint(equalTo: viewController.view.trailingAnchor, constant: -24),
    ])

    window.rootViewController = viewController
    window.makeKeyAndVisible()
    self.window = window
    self.webView = webView
    self.statusLabel = statusLabel

    webView.loadHTMLString(Self.gameHTML, baseURL: Bundle.main.bundleURL)
    return true
  }

  public func applicationDidEnterBackground(_ application: UIApplication) {
    stopNativeAudio()
  }

  public func applicationWillEnterForeground(_ application: UIApplication) {
    shouldRunAudio = true
    requestNativeAudio()
  }

  public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    sendAudioStatus("Native game loaded. Waiting for microphone permission.")
    verifyWebGameRendered()
    requestNativeAudio()
  }

  public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
    showNativeFailure("Web game failed to load: \(error.localizedDescription)")
  }

  public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    showNativeFailure("Web game failed to start: \(error.localizedDescription)")
  }

  @available(iOS 15.0, *)
  public func webView(
    _ webView: WKWebView,
    requestMediaCapturePermissionFor origin: WKSecurityOrigin,
    initiatedByFrame frame: WKFrameInfo,
    type: WKMediaCaptureType,
    decisionHandler: @escaping (WKPermissionDecision) -> Void
  ) {
    decisionHandler(.grant)
  }

  private func requestNativeAudio() {
    shouldRunAudio = true
    AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
      DispatchQueue.main.async {
        guard let self else { return }
        guard granted else {
          self.sendAudioStatus("Microphone permission was denied. Use the dB buttons to test.")
          return
        }
        SFSpeechRecognizer.requestAuthorization { [weak self] authorization in
          DispatchQueue.main.async {
            guard let self else { return }
            let canUseSpeech = authorization == .authorized
            if !canUseSpeech {
              self.sendAudioStatus("Speech recognition is not authorized. Use the Launch button to start.")
            }
            self.startNativeAudio(includeSpeech: canUseSpeech)
          }
        }
      }
    }
  }

  private func startNativeAudio(includeSpeech: Bool) {
    guard shouldRunAudio else { return }
    if audioEngine.isRunning { return }

    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.record, mode: .measurement, options: [.duckOthers])
      try session.setActive(true)
    } catch {
      sendAudioStatus("Audio session failed: \(error.localizedDescription)")
      return
    }

    if includeSpeech {
      startSpeechRecognitionTask()
    }

    let inputNode = audioEngine.inputNode
    let inputFormat = inputNode.outputFormat(forBus: 0)
    if hasInstalledAudioTap {
      inputNode.removeTap(onBus: 0)
      hasInstalledAudioTap = false
    }
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: inputFormat) { [weak self] buffer, _ in
      self?.handleAudioBuffer(buffer)
    }
    hasInstalledAudioTap = true

    audioEngine.prepare()
    do {
      try audioEngine.start()
      sendAudioStatus(includeSpeech ? "Native microphone and speech recognition active." : "Native microphone active.")
    } catch {
      sendAudioStatus("Microphone failed to start: \(error.localizedDescription)")
    }
  }

  private func stopNativeAudio() {
    shouldRunAudio = false
    if audioEngine.isRunning {
      audioEngine.stop()
    }
    if hasInstalledAudioTap {
      audioEngine.inputNode.removeTap(onBus: 0)
      hasInstalledAudioTap = false
    }
    recognitionRequest?.endAudio()
    recognitionTask?.cancel()
    recognitionRequest = nil
    recognitionTask = nil
  }

  private func startSpeechRecognitionTask() {
    recognitionTask?.cancel()
    recognitionTask = nil
    recognitionRequest?.endAudio()

    guard let speechRecognizer, speechRecognizer.isAvailable else {
      sendAudioStatus("Speech recognition is unavailable. Use the Launch button to start.")
      return
    }

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    recognitionRequest = request
    lastTranscript = ""

    recognitionTask = speechRecognizer.recognitionTask(with: request) { [weak self] result, error in
      guard let self else { return }
      if let transcript = result?.bestTranscription.formattedString, !transcript.isEmpty, transcript != self.lastTranscript {
        self.lastTranscript = transcript
        self.dispatchWebEvent("native-speech", detail: ["transcript": transcript])
      }
      if error != nil || result?.isFinal == true {
        self.restartSpeechRecognitionSoon()
      }
    }
  }

  private func restartSpeechRecognitionSoon() {
    recognitionTask?.cancel()
    recognitionTask = nil
    recognitionRequest?.endAudio()
    recognitionRequest = nil
    lastTranscript = ""

    DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
      guard let self, self.shouldRunAudio, self.audioEngine.isRunning else { return }
      self.startSpeechRecognitionTask()
    }
  }

  private func handleAudioBuffer(_ buffer: AVAudioPCMBuffer) {
    recognitionRequest?.append(buffer)
    guard let channelData = buffer.floatChannelData?[0] else { return }

    let frameLength = Int(buffer.frameLength)
    guard frameLength > 0 else { return }

    var total: Float = 0
    for index in 0..<frameLength {
      let sample = channelData[index]
      total += sample * sample
    }

    let rms = Double(sqrt(total / Float(frameLength)))
    let measuredDb = max(0, min(110, Int((20.0 * log10(rms + 0.00001) + 96.0).rounded())))
    let now = Date().timeIntervalSince1970
    guard now - lastDbSentAt >= 0.08 else { return }
    lastDbSentAt = now
    dispatchWebEvent("native-decibel", detail: ["db": measuredDb])
  }

  private func dispatchWebEvent(_ eventName: String, detail: [String: Any]) {
    guard
      let data = try? JSONSerialization.data(withJSONObject: detail, options: []),
      let json = String(data: data, encoding: .utf8)
    else {
      return
    }

    DispatchQueue.main.async { [weak self] in
      self?.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('\(eventName)', { detail: \(json) }));")
    }
  }

  private func sendAudioStatus(_ message: String) {
    dispatchWebEvent("native-audio-status", detail: ["message": message])
  }

  private func verifyWebGameRendered() {
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
      guard let self, let webView = self.webView else { return }
      let script = "document.getElementById('root') ? document.getElementById('root').children.length : -1"
      webView.evaluateJavaScript(script) { [weak self] result, error in
        guard let self else { return }
        if let error {
          self.showNativeFailure("Web game verification failed: \(error.localizedDescription)")
          return
        }
        let renderedChildren = (result as? NSNumber)?.intValue ?? (result as? Int) ?? -1
        if renderedChildren > 0 {
          self.statusLabel?.isHidden = true
        } else {
          self.showNativeFailure("Web game loaded but rendered no content.")
        }
      }
    }
  }

  private func showNativeFailure(_ message: String) {
    if let statusLabel {
      statusLabel.text = message
      statusLabel.textColor = UIColor(red: 0.70, green: 0.15, blue: 0.12, alpha: 1)
      statusLabel.isHidden = false
      return
    }

    let label = UILabel()
    label.translatesAutoresizingMaskIntoConstraints = false
    label.text = message
    label.numberOfLines = 0
    label.textAlignment = .center
    label.textColor = UIColor(red: 0.70, green: 0.15, blue: 0.12, alpha: 1)
    label.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
    label.adjustsFontForContentSizeCategory = false

    guard let view = window?.rootViewController?.view else { return }
    view.addSubview(label)
    NSLayoutConstraint.activate([
      label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      label.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
      label.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
    ])
  }

  private static let gameHTML = #"""
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Shout Out to the Moon</title>
    <style>* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
}

body {
  font-family: Arial, Helvetica, sans-serif;
  -webkit-text-size-adjust: 100%;
  background: #f5f7fb;
}

button,
select {
  font: inherit;
}

.app {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
}

.top {
  text-align: center;
}

.top h1 {
  margin: 0;
  color: #2e3747;
  font-size: 20px;
}

.top p,
.bottom p {
  margin: 3px 0 0;
  color: #536072;
  font-size: 12px;
}

.phone {
  overflow: hidden;
  border: 2px solid #4f5763;
  background: #eeeeee;
}

.sky {
  --launch-pad-height: 29%;
  --rocket-art-bottom-offset: 52px;
  --rocket-visible-gap-fix: 28px;
  position: relative;
  height: calc(100% - 162px);
  overflow: hidden;
  background: #eeeeee;
}

.hud {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 20;
  color: #2d3440;
  font-size: 12px;
  font-weight: 800;
}

.timer {
  display: inline-block;
  border: 1px solid rgba(79, 87, 99, 0.35);
  border-radius: 6px;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.76);
}

.mini-map {
  position: absolute;
  top: 28px;
  right: 12px;
  width: 34px;
  height: 76%;
  z-index: 14;
}

.mini-map::before {
  content: "";
  position: absolute;
  top: 34px;
  right: 15px;
  bottom: 10px;
  width: 5px;
  border: 2px solid #6f7479;
  background: #d7ebf5;
}

.mini-moon {
  position: absolute;
  top: 0;
  right: 5px;
  width: 24px;
  height: 24px;
}

.mini-rocket {
  position: absolute;
  right: 6px;
  bottom: 0;
  width: 24px;
  height: 24px;
}

.world {
  --scroll: 0px;
  position: absolute;
  inset: 0;
  transform: translateY(var(--scroll));
  transition: transform 80ms linear;
}

.launch-pad {
  position: absolute;
  left: 20%;
  right: 20%;
  bottom: 0;
  height: var(--launch-pad-height);
  border: 2px solid #777777;
  background: #fff5c9;
}

.cloud {
  position: absolute;
  z-index: 3;
  width: 128px;
  height: 48px;
  background-image: var(--cloud-image, url("public/assets/clouds.png"));
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  pointer-events: none;
}

.cloud::before,
.cloud::after {
  content: none;
}

.back-cloud {
  z-index: 2;
  opacity: 0.86;
}

.front-cloud {
  z-index: 10;
}

.big-moon {
  position: absolute;
  top: -20%;
  left: 50%;
  width: 35%;
  max-width: 170px;
  min-width: 118px;
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 180ms ease;
  z-index: 5;
}

.big-moon.visible {
  opacity: 1;
}

.rocket {
  position: absolute;
  left: 50%;
  bottom: calc(var(--launch-pad-height) - var(--rocket-art-bottom-offset) - var(--rocket-visible-gap-fix));
  width: 136px;
  height: 184px;
  transform: translateX(-50%) scale(0.64);
  transform-origin: bottom center;
  z-index: 8;
  transition: transform 120ms ease;
}

.rocket.launching {
  transform: translateX(-50%) scale(0.64);
}

.rocket:not(.launching) .flame {
  display: none;
}

.rocket-art {
  position: absolute;
  left: 50%;
  bottom: 52px;
  width: 126px;
  height: 126px;
  object-fit: contain;
  transform: translateX(-50%);
}

.flame {
  position: absolute;
  left: 50%;
  bottom: -20px;
  width: 104px;
  height: 104px;
  transform: translateX(-50%);
  transform-origin: top center;
  transition: width 120ms ease, height 120ms ease;
}

.flame[data-level="1"] {
  width: 48px;
  height: 48px;
}

.flame[data-level="2"] {
  width: 60px;
  height: 60px;
}

.flame[data-level="3"] {
  width: 72px;
  height: 72px;
}

.flame[data-level="4"] {
  width: 88px;
  height: 88px;
}

.flame[data-level="5"] {
  width: 104px;
  height: 104px;
}

.flame-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  opacity: 0;
}

.flame-image.active {
  opacity: 1;
}

.ufo {
  position: absolute;
  width: 88px;
  height: 60px;
  z-index: 11;
  opacity: 0;
  transform: translate(-50%, -50%);
  transition: opacity 120ms ease;
}

.ufo.visible {
  opacity: 1;
}

.ufo img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  pointer-events: none;
}

.landing-scene {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 178px;
  height: 214px;
  opacity: 0;
  visibility: hidden;
  transform: translate(-50%, -50%) scale(0.96);
  transition: opacity 180ms ease, transform 180ms ease;
  z-index: 9;
  pointer-events: none;
}

.landing-scene.visible {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, -50%) scale(1);
}

.landing-moon {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 154px;
  height: 154px;
  object-fit: contain;
  transform: translateX(-50%);
}

.landing-rocket {
  position: absolute;
  left: 50%;
  bottom: 118px;
  width: 66px;
  height: 66px;
  object-fit: contain;
  transform: translateX(-50%);
}

.center-message {
  position: absolute;
  top: 28%;
  left: 50%;
  width: 86%;
  color: #5d626a;
  font-size: 28px;
  font-weight: 800;
  line-height: 1.32;
  text-align: center;
  transform: translate(-50%, -50%);
  z-index: 18;
  pointer-events: none;
}

.center-message.phase-landed,
.center-message.phase-replayPrompt {
  top: 74%;
}

.center-message strong,
.center-message span {
  display: block;
}

.center-message span {
  margin-top: 10px;
  font-size: 18px;
}

.challenge-count {
  display: block;
  margin-top: 8px;
  color: #082fff;
  font-size: 36px;
}

.energy-bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 19;
  height: 24px;
  border-top: 2px solid #5f6570;
  background: #eeeeee;
}

.energy-bar span {
  display: block;
  width: 100%;
  height: 100%;
  background: #fff800;
  transition: width 80ms linear;
}

.hidden {
  display: none;
}

.meter {
  width: 100%;
  height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  border: 0;
  border-top: 2px solid #a8a69c;
  color: #555d68;
  background: #d8edff;
  cursor: pointer;
}

.meter strong {
  font-size: 23px;
  font-weight: 900;
}

.meter span {
  font-size: 16px;
  font-weight: 700;
}

.test-label {
  height: 24px;
  border-top: 2px solid #a8a69c;
  color: #5f6470;
  background: #fff4c9;
  font-size: 12px;
  line-height: 24px;
  text-align: center;
}

.buttons {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  height: 76px;
  background: #fff4c9;
}

.buttons button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 0;
  border-top: 2px solid #a8a69c;
  border-right: 2px solid #a8a69c;
  background: transparent;
  color: #101317;
  font-size: 23px;
  font-weight: 700;
  line-height: 28px;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
}

.buttons button.active {
  background: #fff900;
}

.buttons button span {
  pointer-events: none;
}

.bottom {
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.bottom button {
  min-height: 32px;
  padding: 4px 9px;
  border: 1px solid #cfd6e1;
  border-radius: 6px;
  color: #4d5868;
  background: white;
  font-size: 13px;
}

.bottom select {
  min-height: 32px;
  border: 1px solid #cfd6e1;
  border-radius: 6px;
  color: #4d5868;
  background: white;
  font-size: 13px;
}

.bottom p {
  flex-basis: 100%;
  min-height: 18px;
  text-align: center;
}
</style>
  </head>
  <body>
    <div id="root"></div>
    <script>
window.SHOUT_MOON_NATIVE_AUDIO = true;
window.SHOUT_MOON_ASSETS = {"240px_level1.png":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAOdEVYdFNvZnR3YXJlAEZpZ21hnrGWYwAABU9JREFUeAHtnUty20YQhrtBUJWsglRyAOoEsUpStqFPYOsEZk6Q6AS2T+D4BvINlBMY3kZRmTlBmH1KgleuEsVpT4MPAyDemAFAsr8VMYBe+Kcf0/MQgCAcMljl4Ye/vCfo4Bv9cQxCLogwI8Cr4end69znoCSrl/9ef/RAKM2C8PKb87s/su6XEuDzR280UPgeCUYgVCVwB3SMJ0GQdtOBEsjLb4Q3f3QmWTcLBZjfei/l5TcDkZ5l3sv5utD1uAv8F4Tm0ODp8Px/P9mcawHsekAwA6rnac2ZAjzc/jAR12MSepHWmmMB6iUIJvHmNz+Ok42pAkjvtwOBepJsy7AA6f02SMuGtgSQ3m+VYgtAUi9AsIVHOrWPNsQE+Ly8OQbBGgs1GEevYwIMEjcF8xBRzA3FBNDu5xkIVtFl6u+i18kYMAbBKtoCRtHrjQBc7wep9VtHF99G0euNAI4zGIFgHUp08o0AyeAgWCNdAB2BfwKhdaJBWPx/B3x1QSjlhy7YCKDrP2IB7RCbnBcX1DKYI4DQAjoNnUWvRYCWUQSfotciQMs4iLPY9fqDzoJmIFiHSFxQpyA40+h1NA2dgWAd131MF4AA/wPBNtPkIl2xgBZBxGmy7asFOPHoLJhHgfqQbNsIsHAWPghWGTrgJ9s2Anx7EswgMUwWjML+f5ZsTKahUxAsgR/SWhMC4D8g2IGc67TmuACkrkEwDu+YTNucwcQEcN3QBUkcMAwR/pl1L74wazlIkDhgGHegMrepbtWCCJ13IJjET8t+1mwJMHQWHAfEDRmCkHI79Pby9KUb8kFoDAffo9PgKu+Z9HI00VsQDIB+4RNZN+Z/f38PMlHfiNURBbO8Z7InZMQKGqErn1dFL5/JFECPCTh1kmBck4GjXpd5LlOAMBiLFdSibO9ncueExQrqUbb3M7kCiBVUp0rvZwpXRYgVVKNK72cKBRArKE/V3s+UWhfEViALt4qp2vuZUgKwFThElyBkUqf3M6VXxrlnARfpfBC24JpPnd7PVFqa+DigX0EC8hak8F2d3s9UOriVebjxftfm9gaEEO797un9MdSk8uLco/OA01IfhBAFVMv1rKm1Olpc0Ybronp/EbUE4EVcCKEIB40uNzfODGvvD1hmRXiwA7S6aefW94GG6IkbPlt0DAfEMu2kpyYEaLxDhuPBoY2SOfCaePlMYwtgVkccf4QDmMJsmnYmMbJHLFxZTXQBBwC7HjCIsU16w/PAJ9zvzMhU4I1idJdkmBNTs4FJjwnq1nvyML5NVVvCq70UgfCt6d7PGAnCacxvvFfaZvfiCGTTgTeKtY3a+2QJTes9eVizgDV7YAnT4dn9CVjC+lEFbAm7nB2Rsvu7t3JWBGdH+g852bURM6edRz8HVjesWHdBUXbt/5GVWVzblFZPS+ER82I5kuz9ZkAbg67UnwMd0ffg3EbvZzo7L4iDs57UuehjXGir9zOdHtjEkzorl+RDj1AL1dpEU2cuKEmPXJKv836jFc88enNkGbskPblz3LVLKtrVaJreWECUrqzBZs0ni14e2rexBsCWN40X72o0TS8FYHjMcHR2N+EyRltuiVT7pwT00gWl8XDrTfSva/V/G+vg2/r76K0FJOF6Upiy2itx+9ABOyMAw27JWnyg9BOtbLNTAqxZxwcWgi3CRIxAVJ0c07MzMaCIpjGCy+W2S89p7I0Aa/QYYqy782/64/OyX9NF/r9mJ11QHrw+SWczF8tRdbkU1uacbxF7ZwFpsFUQOhNA+iXpoojocrXppBMOQoAooYsCZ0yggqEL122VnYWe8gV7eO2nJHX9uwAAAABJRU5ErkJggg==","240px_level2.png":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAOdEVYdFNvZnR3YXJlAEZpZ21hnrGWYwAACgpJREFUeAHtnc9zHEcVx1/37MpxqihvJeRAFS7EiSNWWeLABbngTnLiSPIXOFRxx+YKh3DgjLiFEw45khTLxVQZU4YjnMTPFI5lrRPHcqSdfuk3KznyZld6b3Zed+92fy6Wd1va2ZnvvJ/dPQCFrDEQicM7r1wxBgdQeI7+1oMhBCS4AA7vDq4bMDf8j+Xiz8AY2HVgb65d3duBAAQVwNFfBj8BbC5+4TyMudG/+vAmKBNMAEd/Hmz7L/UHKLBBhxtr3xr9FRSxEApjrkNBhLH2dVAmiADw3oD8/atQEGEAvw/KBBHAkavKxW8BAqwf3zxqBBGABfwOFFpRK988YVwAYrEArdG9edQF0ET/JedvD+I2KKJvAYwtd/8CaMcBPVCHb8KqV97wR/Qy5AA+vg3u49ussXUN2/6fW6CAqgBIueMarrAG+wtvvvRtyIbxHgBTAAh2G5QEoOoC6rra5o61F78BOWEE39chroMSqgJAEAQwL+QlgMbV2RdZQysD3wQllINAZB+4zU0AwLd6moGgdhawzRp14bJvhOcR/D2HIOAdj3u8WEqImgCO83/eQaxdhhwxgu9trE4coCYAb7b4is3Q/BOSQNBXU5fLAlhr2f7fXMjTAkhcgFYmoGcBBAdsMnUBhOl/mTVOKxPQDAK3OYNMZvn/NFzxo1I/RUUAh3cGbH+V893fwKwFeAYaqaCKAIwRqLXHM4Eri6z3sRwCkGQAZu2rkDNGVgtYh45RsgB2nT24YpvA1cReZA/VqAUoBYH4Ne7I3GMAE9kFamUBPF+VSe//TAQWEN2SWAA0sM4Zx82BC3roxADIE4AgBVpdJFbQLEkWwP90fgBUaNLrS9AxnQvg4N5gnTs2dgBUUBBAdSQwU8UFRKdzAYiqgMUFRCduDFCIThFA5kQVgCmFIBGI8Ag6pliA2Lgn/LEII+iYqAJAdwDZE/kcxLUAEvWvKjX/HPg2+2pZgAJZQb4ArDVFACuHQADozC50TOcCGPdglz24xACA44cQkxIDxEZwDnq98S50TOcCeEEQqOD4AWTP4b/ZQ83GaBc6pvtewMaIBNB5sLKqcINAAwLXKkBrRhBLAChQ/6qCn/LOAS6TAAy3YlVnHgPQ3c+0AE6hDEworQswf2MNpH1ycuaI//0tGJVNo3UsgCQQPMpXBJIg2Bi3PAJAw1drznEAHv6HPxZ7KoG1igCspGuVsxsQiN/XAJbHAhxVtcAC/AtyBY/YLmB0nF53jooALk4KFrxU8ODvkCU++he4P7WnhmiWgnkHTS4gw5IwN/+fwMyqWqAoAP5By07GaiAJAA24ISiht0eQKBPgn4yV4Snf9TmnUwUk1ARQ23rIHYuf3IPccHyrN9J8cpiaAESBYG61AIp7+EUgtYtPaM8HGLJGUUScUTaAn0pSX70AkNDdLRzxj+yxT/8BuSD5rpoBIKEqACMwX1lZAMF3rSqmFW2JqgD6W6MhcOMAiopzqAcIC0BaFcAT1OcE+tbwO9yx7uM/gRh/Qt2j98Htv9v8C4l3FyU1D2OMagBI6D80ypihDwZ+yBnapIOXvgtc3N5v/EV/b+q1t8Fe+h7Yl38AKYJP+NfUgWPHUG1RtwB9W9/ijpW4gVkX/9l7/nV3/1eQIpKUt291/T+hLoBjHzbkjue4AQqi5l38Z3/n8e30AktBumsM7GrMAp4m1KNj2XEApyroRu8CB/fR+5ASMkF61xmAIALo92CHO5bcwJknylfRuCdSVnDRR5L/h/D/RBABSN3AWYFS/aHAtyfWapZYgBD+nwi2NEziBppHqs64cPS61K8n02omy8UMAEP5fyKYAI7dAK+oQbn9jGCQcn0pqbSaXYL+nwgmgIkbML/mjnePfv/8/8kqtFhLiE8TyQQkx4GObS0XJezqYHT8ByCfDvbIIrS4+5uPTCQVdAf8ANDX/9UrgCcEFcBxb2DIHX9y0ZsSb9uVxCm0mikOEfT/Q/l/Ivj+AKKagDebZPrPK/qc/3fitpqdaMKLCZL+nRBcAKJg0OMo7VswlYtuAQT1f0DLd5MdEFwATTCI+AsISOxWsyQD0FoBNI8oW8T0evAWBN5EolWruQMa68MX31C7/z9NFAFEsQKRZh6L6hAY1v8T0TaJCm0Fzu0xaH3uE4nw7BACE00AUazAk6DudfKZgvn//a0HQwhM1G3iQluBeT0GLYT+P7w6IfZ28R1YAWqcgKTH8CjcHAHZBhAmWPn3NNG3il3UCkxOnKTH8F4wKyDy/6g7/38e0QVAVsBXB29CS9C5HVGPYYG+ghRMZP3fWSSxWfTa1ugtNK1WwDYnTtxj8FZAPSOgi5+4/yeS2S3cOHwD5Hx+4oRWRNsKOEH/IZb/J5IRgPQuXvT3m0aTZkAo6P8bsMUCEOOqsQLsgNCYqf3zpVZg7221KWOC9f8QI/8/ISkB0J4CkoBw+ilabaxI/f9fdp8V0N/j9/+HEJGkBEBQQAjMk4Kzds+UZhTjPajv70CXpLIBFIfkBEBwXAEVgNaujnamX59YASMqLlG+3mVQmNL6//NIUgCNKzD4o3nv08WvLF6b936vcjekaaXb/92kVNwBkomoIef/zSJJARB0d3tL8HWcVPkaa9BcVG/i/cXfOGveHBWX2qSVNPuoi/oA1wWEnP8/9xhghTm6+5KPJ/C66Jfsi1B95cdgLlyGVvgAcLzL+0iH8M6Frf1XISLJWoAuIFcA0iqbv4D1Bz9vvdGEJADUegaAhJUWALkC70ZeA2mzie7iD37WSgSiHUCVngEgYaUFQDT7FWIjAhk+PSQRiAtFgvULmjuAcll5ARBNatim40g1Au8OJCIQ7AASrQN4miwEQHgR3JDWBxqOYwL+ngTxt4CXkI0AiP7mwzdRMHnkGcciOLdOkMBTwKRkJQCiX7k3oeXdR3WCsyqGy5YBENkJgDKDXtVUEduJgCqG80QgaCqlkAEQ2QmA6EQE97+4ZlHyJHCtp4BJyVIAxMIieHwb6v9NFYwEKWDoNYDzyFYAxKIioJTvuYKR4BF4odcAziNrARCLiqApGP33p83aw9hPAm/DSjeDpBzefWnHAG9f4wUZ9jf3r0ECZG8BTrO2+fD1VsUiIanUAIgigCmoWAQLLFThUFmzD4lQBDCDpmysKAJ08E9IhCKAOZAIfDwgbyUvGUUAZ9DbHN0aV7jRctnaXIydWs8QkSKAc6D5BLXFa12LIBWKABiQCPoWN/yP/FXIZ4F1Mm6lCIAJFYx87v5aF8FhKn0AoghACAWHiM2ahZUIDosAWkDL1zSCwxgUAbTkJDiERKZ2taUIYAGa4HBzf0NaPk6lFUwUAXSApHxsjNlJpRVMlG5ghxzeGVyByvzWIKzPev9kUWvs9YCnKRagQ2ief1M0mjHzmO788xa1xqBYACUO7g3We+OJJej19J8CXigUCnI+A074s7SUX21nAAAAAElFTkSuQmCC","240px_level3.png":"data:image/png;base64,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","240px_level4.png":"data:image/png;base64,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","240px_level5.png":"data:image/png;base64,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","240px_moon.png":"data:image/png;base64,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","240px_rocket.png":"data:image/png;base64,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","24px_moon.png":"data:image/png;base64,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","24px_rocket.png":"data:image/png;base64,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","clouds.png":"data:image/png;base64,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","ufo_128.png":"data:image/png;base64,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"};
window.addEventListener("error", function (event) {
  document.body.innerHTML = '<pre style="white-space:pre-wrap;padding:16px;color:#b42318;font:14px -apple-system,BlinkMacSystemFont,sans-serif;">Web game error: ' + String(event.message || "Unknown error") + '</pre>';
});
window.addEventListener("unhandledrejection", function (event) {
  var reason = event.reason && event.reason.message ? event.reason.message : event.reason;
  document.body.innerHTML = '<pre style="white-space:pre-wrap;padding:16px;color:#b42318;font:14px -apple-system,BlinkMacSystemFont,sans-serif;">Web game promise error: ' + String(reason || "Unknown error") + '</pre>';
});
const BASE_WIDTH = 1179;
const BASE_HEIGHT = 2556;
const BASE_RATIO = BASE_WIDTH / BASE_HEIGHT;
const ENERGY_SECONDS = 45;
const UFO_TRIGGER_PROGRESS = 0.03;
const UFO_END_PROGRESS = 0.62;
const MOON_TRIGGER_PROGRESS = 0.62;
const MOON_APPEAR_PROGRESS = 0.36;
const WORLD_SCROLL_PIXELS = 780;
const CLOUD_SCROLL_PIXELS = 360;
const CLAP_WINDOW_MS = 8000;
const CLAP_MIN_GAP_MS = 260;
const CLAP_DB_THRESHOLD = 72;
const HOLD_TARGET_MIN = 50;
const HOLD_TARGET_MAX = 60;
const HOLD_REQUIRED_MS = 5000;
const HOLD_FAIL_GRACE_MS = 2200;
const HOLD_START_GRACE_MS = 1500;
const CLAP_MIN_ENERGY_MS = 12000;
const HOLD_MIN_ENERGY_MS = 10000;
const LAUNCH_WORDS = ["launch", "launched", "launches", "lunch", "런치", "론치"];
const REPLAY_WORDS = ["replay", "yes", "restart", "again", "예스", "다시", "리플레이"];

const DB_RANGES = [
  { id: "20-40", min: 20, max: 40, label: ["20", "40"] },
  { id: "40-60", min: 40, max: 60, label: ["40", "60"] },
  { id: "60-80", min: 60, max: 80, label: ["60", "80"] },
  { id: "80-100", min: 80, max: 100, label: ["80", "100"] },
  { id: "100+", min: 100, max: 110, label: ["100", "+"] },
];

const CLOUDS = [
  { x: 0.14, y: 0.1, scale: 0.48, front: false, delay: 0 },
  { x: 0.7, y: 0.18, scale: 0.54, front: true, delay: 0.15 },
  { x: 0.24, y: 0.3, scale: 0.58, front: true, delay: 0.3 },
  { x: 0.72, y: 0.42, scale: 0.5, front: false, delay: 0.45 },
  { x: 0.16, y: 0.54, scale: 0.64, front: true, delay: 0.6 },
  { x: 0.62, y: 0.62, scale: 0.52, front: false, delay: 0.75 },
  { x: 0.34, y: 0.76, scale: 0.44, front: false, delay: 0.9 },
  { x: 0.78, y: 0.86, scale: 0.58, front: true, delay: 1.05 },
  { x: 0.46, y: 1.02, scale: 0.5, front: false, delay: 1.2 },
  { x: 0.12, y: 1.18, scale: 0.62, front: true, delay: 1.35 },
];

const STRINGS = {
  ko: {
    title: "Shout Out to the Moon",
    subtitle: "Launch라고 외친 뒤, dB로 로켓을 달까지 보내세요.",
    current: "현재",
    max: "최대",
    test: "테스트 dB",
    timer: "Energy",
    waitingLaunch: "Say “Launch”",
    flying: "Make some noise!",
    avoidUfo: "UFO를 피하세요!",
    avoidUfoHint: "소리를 크게/작게 내서 속도를 바꾸세요",
    getReadyHold: "곧 50~60dB 유지!",
    getReadyClap: "다음은 박수 3번!",
    clapPrompt: "박수 3번!",
    clapHint: "8초 안에 박수 3번 또는 아래 Clap 버튼",
    holdPrompt: "50~60dB 유지!",
    holdHint: "5초 동안 50~60dB를 유지하세요",
    landing: "Landing...",
    landedTitle: "Congratulations!",
    landedBody: "You've landed successfully.",
    replayPrompt: "Replay?",
    failed: "Game Over",
    micStatus: "마이크를 허용하면 실제 소리로 플레이할 수 있습니다.",
    speechUnsupported: "Speech Recognition is not available in this browser.",
    voiceEnable: "Voice",
    voiceReady: "Launch 음성 인식 대기 중",
    voiceHeard: "인식",
    clapFailed: "박수 3번을 8초 안에 완료하지 못했습니다.",
    holdFailed: "50~60dB를 5초간 유지하지 못했습니다.",
    ufoFailed: "UFO에 닿았습니다. UFO가 보이는 동안은 dB로 속도를 조절해 피하세요.",
    energyFailed: "Energy가 0이 되었습니다.",
  },
  en: {
    title: "Shout Out to the Moon",
    subtitle: "Say Launch, then use dB to fly to the moon.",
    current: "Current",
    max: "Max",
    test: "Test dB",
    timer: "Energy",
    waitingLaunch: "Say “Launch”",
    flying: "Make some noise!",
    avoidUfo: "Avoid the UFO!",
    avoidUfoHint: "Change your dB to speed up or slow down",
    getReadyHold: "Get ready: hold 50-60dB!",
    getReadyClap: "Next: clap 3 times!",
    clapPrompt: "Clap 3 times!",
    clapHint: "Clap 3 times within 8 seconds or tap the Clap button below",
    holdPrompt: "Hold 50-60dB!",
    holdHint: "Keep 50-60dB steady for 5 seconds",
    landing: "Landing...",
    landedTitle: "Congratulations!",
    landedBody: "You've landed successfully.",
    replayPrompt: "Replay?",
    failed: "Game Over",
    micStatus: "Allow microphone access to play with real sound.",
    speechUnsupported: "Speech Recognition is not available in this browser.",
    voiceEnable: "Voice",
    voiceReady: "Listening for Launch",
    voiceHeard: "Heard",
    clapFailed: "You did not clap 3 times within 8 seconds.",
    holdFailed: "You did not hold 50-60dB for 5 seconds.",
    ufoFailed: "You touched the UFO. Change dB to dodge it while it is on screen.",
    energyFailed: "Energy reached zero.",
  },
};

const state = {
  language: getLanguage(),
  phase: "waitingLaunch",
  db: 0,
  maxDb: 0,
  progress: 0,
  timeLeftMs: ENERGY_SECONDS * 1000,
  lastTick: Date.now(),
  manualModeUntil: 0,
  lastButtonActionAt: 0,
  clapCount: 0,
  clapStartedAt: 0,
  lastClapAt: 0,
  holdMs: 0,
  holdOutMs: 0,
  holdStartedAt: 0,
  status: "",
  speechStatus: "",
  heardSpeech: "",
  ufoSeed: Math.random(),
  ufoStartedAt: 0,
  ufoExitStartedAt: 0,
  landingStartedAt: 0,
  landingSceneX: 50,
  landingSceneY: 50,
};

const speech = {
  recognition: null,
  isListening: false,
  shouldListen: true,
  hasUserGesture: false,
  restartTimer: 0,
};

const root = document.getElementById("root");
state.status = STRINGS[state.language].micStatus;

function asset(name) {
  return window.SHOUT_MOON_ASSETS?.[name] ?? `public/assets/${name}`;
}

function readStoredValue(key) {
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStoredValue(key, value) {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Storage can be unavailable in embedded WebViews. The game should keep running.
  }
}

function getLanguage() {
  const saved = readStoredValue("settings.language");
  if (saved === "ko" || saved === "en") return saved;
  return navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampDb(db) {
  return Math.max(0, Math.min(110, Math.round(db)));
}

function randomDb(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function getRange(db) {
  return DB_RANGES.find((range) => db >= range.min && db < range.max) ?? DB_RANGES[0];
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return `0:${String(totalSeconds).padStart(2, "0")}`;
}

function flameLevel(db) {
  if (db < 40) return 1;
  if (db < 60) return 2;
  if (db < 80) return 3;
  if (db < 100) return 4;
  return 5;
}

function getFlameAsset(db) {
  return asset(`240px_level${flameLevel(db)}.png`);
}

function isRunningPhase() {
  return state.phase === "flying" || state.phase === "clapPrompt" || state.phase === "holdPrompt";
}

function canAcceptDb() {
  return state.phase === "flying" || state.phase === "holdPrompt";
}

function startGame() {
  if (state.phase !== "waitingLaunch") return;
  speech.shouldListen = false;
  stopSpeechRecognition();
  state.phase = "flying";
  state.db = 0;
  state.maxDb = 0;
  state.progress = 0;
  state.timeLeftMs = ENERGY_SECONDS * 1000;
  state.lastTick = Date.now();
  state.manualModeUntil = 0;
  state.clapCount = 0;
  state.holdMs = 0;
  state.holdOutMs = 0;
  state.ufoSeed = Math.random();
  state.ufoStartedAt = Date.now();
  state.ufoExitStartedAt = 0;
  state.status = "";
  updateUi();
}

function beginClapChallenge() {
  state.phase = "clapPrompt";
  state.db = 0;
  state.clapCount = 0;
  state.clapStartedAt = Date.now();
  state.lastClapAt = 0;
  state.manualModeUntil = 0;
  state.timeLeftMs = Math.max(state.timeLeftMs, CLAP_MIN_ENERGY_MS);
  state.status = "";
  updateUi();
}

function beginHoldChallenge() {
  state.phase = "holdPrompt";
  state.db = 0;
  state.holdMs = 0;
  state.holdOutMs = 0;
  state.holdStartedAt = Date.now();
  state.ufoExitStartedAt = Date.now();
  state.manualModeUntil = 0;
  state.timeLeftMs = Math.max(state.timeLeftMs, HOLD_MIN_ENERGY_MS);
  state.status = "";
  updateUi();
}

function beginLanding() {
  const sky = root.querySelector(".sky");
  const moon = root.querySelector(".big-moon");
  if (sky && moon) {
    const skyRect = sky.getBoundingClientRect();
    const moonRect = moon.getBoundingClientRect();
    state.landingSceneX = ((moonRect.left + moonRect.width / 2 - skyRect.left) / skyRect.width) * 100;
    state.landingSceneY = ((moonRect.top + moonRect.height / 2 - skyRect.top) / skyRect.height) * 100;
  }
  state.phase = "landing";
  state.progress = 1;
  state.landingStartedAt = Date.now();
  updateUi();
}

function completeLanding() {
  state.phase = "landed";
  updateUi();
  window.setTimeout(() => {
    if (state.phase !== "landed") return;
    state.phase = "replayPrompt";
    speech.shouldListen = true;
    startVoiceInput({ force: true });
    updateUi();
  }, 1700);
}

function failGame(message) {
  state.phase = "failed";
  state.status = message;
  speech.shouldListen = true;
  startVoiceInput({ force: true });
  updateUi();
}

function reset() {
  state.phase = "waitingLaunch";
  state.db = 0;
  state.maxDb = 0;
  state.progress = 0;
  state.timeLeftMs = ENERGY_SECONDS * 1000;
  state.lastTick = Date.now();
  state.manualModeUntil = 0;
  state.clapCount = 0;
  state.clapStartedAt = 0;
  state.lastClapAt = 0;
  state.holdMs = 0;
  state.holdOutMs = 0;
  state.holdStartedAt = 0;
  state.heardSpeech = "";
  state.ufoSeed = Math.random();
  state.ufoStartedAt = 0;
  state.ufoExitStartedAt = 0;
  state.landingSceneX = 50;
  state.landingSceneY = 50;
  state.status = STRINGS[state.language].micStatus;
  speech.shouldListen = true;
  updateUi();
  startVoiceInput({ force: true });
}

function setMeasuredDb(value) {
  if (!canAcceptDb()) return;
  state.db = clampDb(value);
  state.maxDb = Math.max(state.maxDb, state.db);
  updateUi();
}

function registerClap(db) {
  if (state.phase !== "clapPrompt") return;
  state.db = clampDb(db);
  state.maxDb = Math.max(state.maxDb, state.db);
  const now = Date.now();
  if (db < CLAP_DB_THRESHOLD || now - state.lastClapAt < CLAP_MIN_GAP_MS) return;
  state.lastClapAt = now;
  state.clapCount += 1;
  if (state.clapCount >= 3) {
    beginLanding();
  } else {
    updateUi();
  }
}

function handleButtonAction(target) {
  if (target.dataset.action === "reset") {
    reset();
    return true;
  }
  if (target.dataset.action === "debug-launch") {
    startGame();
    return true;
  }
  if (target.dataset.action === "enable-voice") {
    startVoiceInput({ fromUserGesture: true, force: true });
    return true;
  }
  if (target.dataset.action === "debug-clap") {
    registerClap(90);
    return true;
  }
  if (target.dataset.action === "debug-hold") {
    if (state.phase === "holdPrompt") setMeasuredDb(55);
    return true;
  }
  if (target.dataset.action === "debug-replay") {
    if (state.phase === "replayPrompt" || state.phase === "failed") reset();
    return true;
  }
  if (target.dataset.min && target.dataset.max) {
    setMeasuredDb(randomDb(Number(target.dataset.min), Number(target.dataset.max)));
    return true;
  }
  return false;
}

function getBoardSize() {
  const maxWidth = Math.min(window.innerWidth - 32, 520);
  const maxHeight = Math.max(window.innerHeight - 170, 620);
  const width = Math.min(maxWidth, maxHeight * BASE_RATIO);
  return { width, height: width / BASE_RATIO };
}

function getSkyHeight() {
  return getBoardSize().height - 162;
}

function getWorldScrollRatio(progress = state.progress) {
  return (clamp(progress, 0, 1) * WORLD_SCROLL_PIXELS) / getSkyHeight();
}

function getCloudScrollRatio(progress = state.progress) {
  return (clamp(progress, 0, 1) * CLOUD_SCROLL_PIXELS) / getSkyHeight();
}

function getWorldAnchoredViewportY(startProgress, startViewportY) {
  const worldY = startViewportY - getWorldScrollRatio(startProgress) - getCloudScrollRatio(startProgress);
  return {
    worldY,
    viewportY: worldY + getWorldScrollRatio() + getCloudScrollRatio(),
  };
}

function render() {
  const text = STRINGS[state.language];
  const board = getBoardSize();
  root.style.setProperty("--cloud-image", `url("${asset("clouds.png")}")`);
  root.innerHTML = `
    <main class="app">
      <header class="top">
        <h1>${text.title}</h1>
        <p>${text.subtitle}</p>
      </header>
      <section class="phone" style="width:${board.width}px;height:${board.height}px">
        <div class="sky">
          <div class="hud">
            <span class="timer"></span>
          </div>
          <div class="mini-map">
            <img class="mini-moon" src="${asset("24px_moon.png")}" alt="" />
            <img class="mini-rocket" src="${asset("24px_rocket.png")}" alt="" />
          </div>
          <div class="world">
            <div class="launch-pad"></div>
            ${CLOUDS.map((cloud, index) => `
              <div class="cloud cloud-${index} ${cloud.front ? "front-cloud" : "back-cloud"}"></div>
            `).join("")}
            <img class="big-moon" src="${asset("240px_moon.png")}" alt="" />
            <div class="ufo" aria-hidden="true">
              <img src="${asset("ufo_128.png")}" alt="" />
            </div>
          </div>
          <div class="rocket">
            <img class="rocket-art" src="${asset("240px_rocket.png")}" alt="" />
            <div class="flame" aria-hidden="true">
              ${[1, 2, 3, 4, 5].map((level) => `
                <img class="flame-image flame-level-${level}" src="${asset(`240px_level${level}.png`)}" alt="" />
              `).join("")}
            </div>
          </div>
          <div class="landing-scene" aria-hidden="true">
            <img class="landing-moon" src="${asset("240px_moon.png")}" alt="" />
            <img class="landing-rocket" src="${asset("240px_rocket.png")}" alt="" />
          </div>
          <div class="center-message"></div>
          <div class="energy-bar"><span></span></div>
        </div>
        <button class="meter" type="button" data-action="reset">
          <strong></strong>
          <span></span>
        </button>
        <div class="test-label">${text.test}</div>
        <div class="buttons">
          ${DB_RANGES.map((item) => `
            <button type="button" data-range-id="${item.id}" data-min="${item.min}" data-max="${item.max}">
              <span>${item.label[0]}</span><span>${item.label[1]}</span>
            </button>
          `).join("")}
        </div>
      </section>
      <footer class="bottom">
        <button type="button" data-action="enable-voice">${text.voiceEnable}</button>
        <button type="button" data-action="debug-launch">Launch</button>
        <button type="button" data-action="debug-clap">Clap</button>
        <button type="button" data-action="debug-hold">55dB</button>
        <button type="button" data-action="debug-replay">Replay</button>
        <select data-action="language">
          <option value="en" ${state.language === "en" ? "selected" : ""}>English</option>
          <option value="ko" ${state.language === "ko" ? "selected" : ""}>Korean</option>
        </select>
        <p></p>
      </footer>
    </main>
  `;
  updateUi();
}

function updateUi() {
  const text = STRINGS[state.language];
  const displayedDb = state.phase === "waitingLaunch" ? 0 : Math.round(state.db);
  const range = getRange(state.db);
  const flightDistance = clamp(state.progress, 0, 1);
  const energyRatio = clamp(state.timeLeftMs / (ENERGY_SECONDS * 1000), 0, 1);
  const ufo = getUfoState();

  const timer = root.querySelector(".timer");
  if (timer) timer.textContent = `${text.timer}: ${formatTime(state.timeLeftMs)}`;

  const world = root.querySelector(".world");
  if (world) world.style.setProperty("--scroll", `${flightDistance * WORLD_SCROLL_PIXELS}px`);

  root.querySelectorAll(".cloud").forEach((cloud, index) => {
    const config = CLOUDS[index];
    const drift = Math.sin((flightDistance * 8 + config.delay) * Math.PI) * 28;
    cloud.style.left = `${config.x * 100}%`;
    cloud.style.top = `${config.y * 100}%`;
    cloud.style.transform = `translate(${drift}px, ${flightDistance * CLOUD_SCROLL_PIXELS}px) scale(${config.scale})`;
  });

  const rocket = root.querySelector(".rocket");
  if (rocket) {
    rocket.classList.toggle("launching", state.phase !== "waitingLaunch");
    rocket.classList.toggle("hidden", state.phase === "landing" || state.phase === "landed" || state.phase === "replayPrompt");
  }

  const flame = root.querySelector(".flame");
  if (flame) {
    const level = flameLevel(state.db);
    flame.dataset.level = String(level);
    root.querySelectorAll(".flame-image").forEach((image) => {
      image.classList.toggle("active", image.classList.contains(`flame-level-${level}`));
    });
  }

  const miniRocket = root.querySelector(".mini-rocket");
  if (miniRocket) {
    miniRocket.style.bottom = `calc(${flightDistance * 100}% - ${flightDistance * 24}px)`;
  }

  const bigMoon = root.querySelector(".big-moon");
  if (bigMoon) {
    const moon = getMoonState();
    bigMoon.classList.toggle("visible", moon.visible);
    bigMoon.style.top = `${moon.y * 100}%`;
    bigMoon.style.opacity = moon.visible ? moon.opacity : 0;
  }

  const ufoEl = root.querySelector(".ufo");
  if (ufoEl) {
    ufoEl.classList.toggle("visible", ufo.visible);
    ufoEl.style.left = `${ufo.x * 100}%`;
    ufoEl.style.top = `${ufo.y * 100}%`;
    ufoEl.style.opacity = ufo.visible ? ufo.opacity : 0;
  }

  const landingScene = root.querySelector(".landing-scene");
  if (landingScene) {
    landingScene.classList.toggle("visible", state.phase === "landing" || state.phase === "landed" || state.phase === "replayPrompt");
    landingScene.style.left = `${state.landingSceneX}%`;
    landingScene.style.top = `${state.landingSceneY}%`;
  }

  const centerMessage = root.querySelector(".center-message");
  if (centerMessage) {
    centerMessage.className = `center-message phase-${state.phase}`;
    centerMessage.innerHTML = getCenterMessage(text);
  }

  const energyFill = root.querySelector(".energy-bar span");
  if (energyFill) energyFill.style.width = `${energyRatio * 100}%`;

  const currentDb = root.querySelector(".meter strong");
  const maxDb = root.querySelector(".meter span");
  if (currentDb) currentDb.textContent = `${displayedDb} dB`;
  if (maxDb) maxDb.textContent = `${text.max}: ${state.maxDb} dB`;

  const footerStatus = root.querySelector(".bottom p");
  if (footerStatus) {
    const heard = state.heardSpeech ? `${text.voiceHeard}: ${state.heardSpeech}` : "";
    footerStatus.textContent = [state.status, state.speechStatus, heard].filter(Boolean).join(" ");
  }

  root.querySelectorAll(".buttons button").forEach((button) => {
    button.classList.toggle("active", canAcceptDb() && button.dataset.rangeId === range.id);
  });
}

function getCenterMessage(text) {
  if (state.phase === "waitingLaunch") return text.waitingLaunch;
  if (state.phase === "flying") {
    if (state.progress >= MOON_TRIGGER_PROGRESS * 0.72 && hasUfoClearedRocketForChallenge()) {
      return `<strong>${text.getReadyHold}</strong><span>${text.holdHint}</span>`;
    }
    if (state.progress >= UFO_TRIGGER_PROGRESS) {
      return `<strong>${text.avoidUfo}</strong><span>${text.avoidUfoHint}</span>`;
    }
    return text.flying;
  }
  if (state.phase === "clapPrompt") {
    const clapsLeft = Math.max(0, 3 - state.clapCount);
    const secondsLeft = Math.max(0, Math.ceil((CLAP_WINDOW_MS - (Date.now() - state.clapStartedAt)) / 1000));
    return `<strong>${text.clapPrompt}</strong><span>${text.clapHint}</span><span class="challenge-count">${clapsLeft} / ${secondsLeft}s</span>`;
  }
  if (state.phase === "holdPrompt") {
    const seconds = Math.max(0, Math.ceil((HOLD_REQUIRED_MS - state.holdMs) / 1000));
    return `<strong>${text.holdPrompt}</strong><span>${text.holdHint}</span><span class="challenge-count">${seconds}s</span>`;
  }
  if (state.phase === "landing") return text.landing;
  if (state.phase === "landed") return `<strong>${text.landedTitle}</strong><span>${text.landedBody}</span>`;
  if (state.phase === "replayPrompt") return text.replayPrompt;
  if (state.phase === "failed") {
    return `<strong>${text.failed}</strong>${state.status ? `<span>${state.status}</span>` : ""}<span>${text.replayPrompt}</span>`;
  }
  return "";
}

function getUfoState() {
  const position = getWorldAnchoredViewportY(UFO_TRIGGER_PROGRESS, -0.08);
  const exitingMs = state.ufoExitStartedAt > 0 ? Date.now() - state.ufoExitStartedAt : 0;
  const exitOffset = state.ufoExitStartedAt > 0 ? Math.min(1.25, exitingMs / 2800) : 0;
  const viewportY = position.viewportY + exitOffset;
  const activePhase =
    state.phase === "flying" ||
    state.phase === "holdPrompt" ||
    state.phase === "clapPrompt" ||
    state.phase === "landing" ||
    state.phase === "landed";
  const visible = activePhase && state.progress >= UFO_TRIGGER_PROGRESS && viewportY < 1.32;
  const elapsed = state.ufoStartedAt > 0 ? Date.now() - state.ufoStartedAt : 0;
  const wave = Math.cos(elapsed / 5200);
  return {
    visible,
    x: clamp(0.5 + wave * 0.28, 0.18, 0.82),
    y: position.worldY + exitOffset,
    viewportY,
    opacity: 1,
  };
}

function getMoonState() {
  const activePhase = state.phase === "flying" || state.phase === "clapPrompt" || state.phase === "holdPrompt";
  const position = getWorldAnchoredViewportY(MOON_APPEAR_PROGRESS, -0.22);
  const viewportY = position.viewportY;
  const visible = activePhase && state.progress >= MOON_APPEAR_PROGRESS && viewportY < 1.05;
  const fadeIn = clamp((viewportY + 0.2) / 0.12, 0, 1);
  return {
    visible,
    y: position.worldY,
    viewportY,
    opacity: fadeIn,
  };
}

function checkUfoCollision() {
  const text = STRINGS[state.language];
  const ufo = getUfoState();
  if (!ufo.visible) return;
  const ufoBody = root.querySelector(".ufo");
  const rocketArt = root.querySelector(".rocket-art");
  if (!ufoBody || !rocketArt) return;
  const ufoRect = ufoBody.getBoundingClientRect();
  const rocketRect = rocketArt.getBoundingClientRect();
  const rocketHit = {
    left: rocketRect.left + rocketRect.width * 0.32,
    right: rocketRect.right - rocketRect.width * 0.32,
    top: rocketRect.top + rocketRect.height * 0.18,
    bottom: rocketRect.top + rocketRect.height * 0.84,
  };
  const ufoHit = {
    left: ufoRect.left + ufoRect.width * 0.24,
    right: ufoRect.right - ufoRect.width * 0.24,
    top: ufoRect.top + ufoRect.height * 0.34,
    bottom: ufoRect.bottom - ufoRect.height * 0.28,
  };
  const overlapsX = ufoHit.right >= rocketHit.left && ufoHit.left <= rocketHit.right;
  const overlapsY = ufoHit.bottom >= rocketHit.top && ufoHit.top <= rocketHit.bottom;
  if (overlapsX && overlapsY) {
    failGame(text.ufoFailed);
  }
}

function hasUfoClearedRocketForChallenge() {
  const ufoEl = root.querySelector(".ufo");
  const rocketArt = root.querySelector(".rocket-art");
  if (!ufoEl || !rocketArt) return state.progress >= UFO_END_PROGRESS;
  const ufoRect = ufoEl.getBoundingClientRect();
  const rocketRect = rocketArt.getBoundingClientRect();
  return ufoRect.top >= rocketRect.bottom + 18;
}

function updateGame(delta) {
  const text = STRINGS[state.language];
  if (isRunningPhase()) {
    state.timeLeftMs = Math.max(0, state.timeLeftMs - delta);
    if (state.timeLeftMs <= 0) {
      failGame(text.energyFailed);
      return;
    }
  }

  if (state.phase === "flying") {
    const speed = state.db * 0.00000048;
    state.progress = Math.min(1, state.progress + speed * delta);
    checkUfoCollision();
    if (state.phase !== "flying") return;
    if (state.progress >= MOON_TRIGGER_PROGRESS && hasUfoClearedRocketForChallenge()) beginHoldChallenge();
  }

  if (state.phase === "clapPrompt" && Date.now() - state.clapStartedAt > CLAP_WINDOW_MS) {
    failGame(text.clapFailed);
  }

  if (state.phase === "holdPrompt") {
    if (state.db >= HOLD_TARGET_MIN && state.db <= HOLD_TARGET_MAX) {
      state.holdMs += delta;
      state.holdOutMs = 0;
    } else if (Date.now() - state.holdStartedAt < HOLD_START_GRACE_MS) {
      state.holdOutMs = 0;
    } else {
      state.holdOutMs += delta;
    }
    if (state.holdOutMs > HOLD_FAIL_GRACE_MS) {
      failGame(text.holdFailed);
      return;
    }
    if (state.holdMs >= HOLD_REQUIRED_MS) beginClapChallenge();
  }

  if (state.phase === "landing" && Date.now() - state.landingStartedAt > 1400) {
    completeLanding();
  }
}

root.addEventListener("pointerdown", (event) => {
  speech.hasUserGesture = true;
  startVoiceInput({ fromUserGesture: true });
  const target = event.target.closest("button");
  if (!target) return;
  if (handleButtonAction(target)) {
    state.lastButtonActionAt = Date.now();
    event.preventDefault();
  }
});

root.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.action || (target.dataset.min && target.dataset.max)) {
    if (Date.now() - state.lastButtonActionAt > 250) {
      handleButtonAction(target);
      state.lastButtonActionAt = Date.now();
    }
    event.preventDefault();
  }
});

root.addEventListener("change", (event) => {
  if (event.target.dataset.action !== "language") return;
  state.language = event.target.value;
  writeStoredValue("settings.language", state.language);
  state.status = STRINGS[state.language].micStatus;
  render();
});

window.addEventListener("resize", render);

window.setInterval(() => {
  const now = Date.now();
  const delta = now - state.lastTick;
  state.lastTick = now;
  updateGame(delta);
  updateUi();
}, 50);

function normalizeSpeechText(value) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ");
}

function transcriptMatchesAny(transcript, words) {
  const normalized = normalizeSpeechText(transcript);
  return words.some((word) => normalized.includes(word));
}

function readSpeechTranscript(event) {
  const transcripts = [];
  for (let index = event.resultIndex; index < event.results.length; index += 1) {
    const result = event.results[index];
    for (let alternativeIndex = 0; alternativeIndex < result.length; alternativeIndex += 1) {
      const transcript = result[alternativeIndex]?.transcript;
      if (transcript) transcripts.push(transcript);
    }
  }
  return transcripts.join(" ");
}

function handleSpeechTranscript(transcript) {
  if (!transcript) return;
  state.heardSpeech = normalizeSpeechText(transcript).slice(0, 36);
  if (state.phase === "waitingLaunch" && transcriptMatchesAny(transcript, LAUNCH_WORDS)) {
    startGame();
  } else if ((state.phase === "replayPrompt" || state.phase === "failed") && transcriptMatchesAny(transcript, REPLAY_WORDS)) {
    reset();
  } else {
    updateUi();
  }
}

function scheduleSpeechRestart(delay = 700) {
  if (!speech.shouldListen || (state.phase !== "waitingLaunch" && state.phase !== "replayPrompt" && state.phase !== "failed")) {
    return;
  }
  window.clearTimeout(speech.restartTimer);
  speech.restartTimer = window.setTimeout(() => {
    startSpeechRecognition({ force: true });
  }, delay);
}

function stopSpeechRecognition() {
  speech.shouldListen = false;
  window.clearTimeout(speech.restartTimer);
  if (!speech.recognition || !speech.isListening) return;
  try {
    speech.recognition.stop();
  } catch {
    // Some browsers throw if recognition is already stopping.
  }
}

function createSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 5;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    const transcript = readSpeechTranscript(event);
    handleSpeechTranscript(transcript);
  };

  recognition.onerror = (event) => {
    speech.isListening = false;
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      state.speechStatus = "Speech recognition permission was denied.";
      speech.shouldListen = false;
    } else if (event.error === "no-speech") {
      state.speechStatus = STRINGS[state.language].voiceReady;
      scheduleSpeechRestart(250);
    } else if (event.error === "audio-capture") {
      state.speechStatus = "Speech recognition cannot access the microphone.";
      scheduleSpeechRestart(1000);
    } else if (event.error !== "aborted") {
      state.speechStatus = `Speech recognition error: ${event.error}`;
      scheduleSpeechRestart(1000);
    }
    updateUi();
  };

  recognition.onend = () => {
    speech.isListening = false;
    scheduleSpeechRestart(speech.hasUserGesture ? 350 : 1200);
  };
  return recognition;
}

function startSpeechRecognition(options = {}) {
  const text = STRINGS[state.language];
  if (options.fromUserGesture) speech.hasUserGesture = true;
  if (!speech.shouldListen && !options.force) return;
  if (state.phase !== "waitingLaunch" && state.phase !== "replayPrompt" && state.phase !== "failed") return;
  speech.shouldListen = true;
  if (!speech.recognition) speech.recognition = createSpeechRecognition();
  if (!speech.recognition) {
    state.speechStatus = text.speechUnsupported;
    updateUi();
    return;
  }
  if (speech.isListening) return;
  try {
    speech.recognition.start();
    speech.isListening = true;
    state.speechStatus = text.voiceReady;
  } catch (error) {
    speech.isListening = false;
    state.speechStatus = error instanceof Error ? error.message : "Speech recognition could not start.";
    scheduleSpeechRestart(speech.hasUserGesture ? 700 : 1500);
  } finally {
    updateUi();
  }
}

function startVoiceInput(options = {}) {
  if (window.SHOUT_MOON_NATIVE_AUDIO) {
    speech.shouldListen = true;
    if (options.fromUserGesture) speech.hasUserGesture = true;
    return;
  }
  startSpeechRecognition(options);
}

async function startMeter() {
  if (!navigator.mediaDevices?.getUserMedia) {
    state.status = "Browser microphone API is not available.";
    render();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Browser audio analysis API is not available.");
    }
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);

    function tick() {
      analyser.getByteTimeDomainData(samples);
      let total = 0;
      samples.forEach((sample) => {
        const normalized = (sample - 128) / 128;
        total += normalized * normalized;
      });
      const rms = Math.sqrt(total / samples.length);
      const db = Math.max(0, Math.min(110, Math.round(20 * Math.log10(rms + 0.00001) + 96)));
      if (state.phase === "clapPrompt") {
        state.db = clampDb(db);
        state.maxDb = Math.max(state.maxDb, state.db);
        registerClap(db);
      } else {
        setMeasuredDb(db, false);
      }
      requestAnimationFrame(tick);
    }

    tick();
  } catch (error) {
    state.status = error instanceof Error ? error.message : "Microphone dB measurement failed.";
    render();
  }
}

window.addEventListener("native-decibel", (event) => {
  const db = Number(event.detail?.db);
  if (!Number.isFinite(db)) return;
  if (state.phase === "clapPrompt") {
    state.db = clampDb(db);
    state.maxDb = Math.max(state.maxDb, state.db);
    registerClap(db);
  } else {
    setMeasuredDb(db);
  }
});

window.addEventListener("native-speech", (event) => {
  handleSpeechTranscript(String(event.detail?.transcript ?? ""));
});

window.addEventListener("native-audio-status", (event) => {
  const message = String(event.detail?.message ?? "");
  if (!message) return;
  state.status = message;
  updateUi();
});

render();
if (!window.SHOUT_MOON_NATIVE_AUDIO) {
  startVoiceInput();
  startMeter();
}
</script>
  </body>
</html>

"""#
}
