import { readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const assetsDir = join(root, "public/assets");
const output = join(root, "ios/ShoutOuttotheMoon/AppDelegate.swift");
const requiredAssets = new Set([
  "24px_moon.png",
  "24px_rocket.png",
  "240px_level1.png",
  "240px_level2.png",
  "240px_level3.png",
  "240px_level4.png",
  "240px_level5.png",
  "240px_moon.png",
  "240px_rocket.png",
  "clouds.png",
  "ufo_128.png",
]);

const mimeTypes = new Map([
  [".gif", "image/gif"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

function swiftRawString(value) {
  if (value.includes('"""#')) {
    throw new Error('Generated HTML contains the Swift raw string terminator """#.');
  }
  return `#"""\n${value}\n"""#`;
}

function buildSwift(html) {
  const htmlLiteral = swiftRawString(html);
  return `import AVFoundation
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
    statusLabel.text = "Loading Shout Out to the Moon... Build \\(buildNumber)"
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
    showNativeFailure("Web game failed to load: \\(error.localizedDescription)")
  }

  public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
    showNativeFailure("Web game failed to start: \\(error.localizedDescription)")
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
      sendAudioStatus("Audio session failed: \\(error.localizedDescription)")
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
      sendAudioStatus("Microphone failed to start: \\(error.localizedDescription)")
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
      self?.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('\\(eventName)', { detail: \\(json) }));")
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
          self.showNativeFailure("Web game verification failed: \\(error.localizedDescription)")
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

  private static let gameHTML = ${htmlLiteral}
}
`;
}

const [html, css, js, assetFiles] = await Promise.all([
  readFile(join(root, "index.html"), "utf8"),
  readFile(join(root, "src/web/styles.css"), "utf8"),
  readFile(join(root, "src/web/main.js"), "utf8"),
  readdir(assetsDir),
]);

const assetEntries = await Promise.all(
  assetFiles
    .filter((file) => requiredAssets.has(file) && mimeTypes.has(extname(file).toLowerCase()))
    .map(async (file) => {
      const extension = extname(file).toLowerCase();
      const data = await readFile(join(assetsDir, file));
      return [file, `data:${mimeTypes.get(extension)};base64,${data.toString("base64")}`];
    }),
);

const assetScript = `
window.SHOUT_MOON_NATIVE_AUDIO = true;
window.SHOUT_MOON_ASSETS = ${JSON.stringify(Object.fromEntries(assetEntries))};
window.addEventListener("error", function (event) {
  document.body.innerHTML = '<pre style="white-space:pre-wrap;padding:16px;color:#b42318;font:14px -apple-system,BlinkMacSystemFont,sans-serif;">Web game error: ' + String(event.message || "Unknown error") + '</pre>';
});
window.addEventListener("unhandledrejection", function (event) {
  var reason = event.reason && event.reason.message ? event.reason.message : event.reason;
  document.body.innerHTML = '<pre style="white-space:pre-wrap;padding:16px;color:#b42318;font:14px -apple-system,BlinkMacSystemFont,sans-serif;">Web game promise error: ' + String(reason || "Unknown error") + '</pre>';
});`;

const document = html
  .replace(/<link\s+rel="stylesheet"\s+href="[^"]*src\/web\/styles\.css"[^>]*\/?\s*>/, `<style>${css}</style>`)
  .replace(/<script\s+type="module"\s+src="[^"]*src\/web\/main\.js[^"]*"><\/script>/, `<script>${assetScript}\n${js}</script>`);

await writeFile(output, buildSwift(document));
console.log(`Generated ${output}`);
