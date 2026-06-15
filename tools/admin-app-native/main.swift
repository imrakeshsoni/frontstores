// FrontStores Admin — native macOS wrapper around the admin panel.
// Loads https://update.frontstores.com/admin (Cloudflare Worker + D1, the live
// source of truth) in a WKWebView and auto-signs in using a password read from
// a local-only token file, so the admin never has to type the admin password.
// Previously pointed at the local Mac server (127.0.0.1:3002), which is retired.
//
// Hardened: a navigation delegate catches load failures and shows a visible
// error page (with auto-retry) instead of a blank white window.
import SwiftUI
import WebKit

let adminURL = "https://update.frontstores.com/admin"
let tokenPath = NSString(string: "~/Library/Application Support/FrontStores/admin_local.token").expandingTildeInPath

func readLocalToken() -> String? {
    guard let raw = try? String(contentsOfFile: tokenPath, encoding: .utf8) else { return nil }
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
}

func targetURL() -> URL? {
    var urlString = adminURL
    if let token = readLocalToken(),
       let encoded = token.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
        urlString += "?local_token=\(encoded)"
    }
    return URL(string: urlString)
}

struct WebView: NSViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(context.coordinator, name: "retry")
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        context.coordinator.webView = webView
        context.coordinator.loadTarget()
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        weak var webView: WKWebView?
        private var retries = 0

        // "Retry now" button in the error page posts here.
        func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
            retries = 0
            loadTarget()
        }

        func loadTarget() {
            guard let webView = webView else { return }
            guard let url = targetURL() else {
                showError("Could not build the admin URL or read the local sign-in token.")
                return
            }
            var req = URLRequest(url: url)
            req.cachePolicy = .reloadIgnoringLocalCacheData
            req.timeoutInterval = 20
            webView.load(req)
        }

        // Successful load resets the retry counter.
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            retries = 0
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            handleFailure(error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            handleFailure(error)
        }

        private func handleFailure(_ error: Error) {
            let ns = error as NSError
            // -999 = NSURLErrorCancelled (a new load superseded this one) — ignore.
            if ns.code == NSURLErrorCancelled { return }
            if retries < 3 {
                retries += 1
                let delay = Double(retries) * 1.5
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                    self?.loadTarget()
                }
                showError("Connecting to the admin server…\nRetry \(retries) of 3 — \(ns.localizedDescription)")
            } else {
                showError("Couldn't reach the admin server.\n\n\(ns.localizedDescription)\n\nCheck your internet connection, then press Retry.")
            }
        }

        private func showError(_ message: String) {
            guard let webView = webView else { return }
            let safe = message
                .replacingOccurrences(of: "&", with: "&amp;")
                .replacingOccurrences(of: "<", with: "&lt;")
                .replacingOccurrences(of: ">", with: "&gt;")
                .replacingOccurrences(of: "\n", with: "<br>")
            let html = """
            <!DOCTYPE html><html><head><meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              html,body{height:100%;margin:0}
              body{background:#0f1320;color:#e7e9f3;font-family:-apple-system,system-ui,sans-serif;
                   display:flex;align-items:center;justify-content:center;text-align:center}
              .card{max-width:520px;padding:40px}
              h1{font-size:20px;font-weight:800;margin:0 0 14px}
              p{color:#a8adc4;font-size:14px;line-height:1.6;margin:0 0 26px;white-space:pre-line}
              button{background:#3b82f6;color:#fff;border:0;border-radius:10px;
                     padding:12px 26px;font-size:14px;font-weight:700;cursor:pointer}
              button:active{transform:translateY(1px)}
            </style></head><body>
              <div class="card">
                <h1>FrontStores Admin</h1>
                <p>\(safe)</p>
                <button onclick="window.webkit.messageHandlers.retry.postMessage('retry')">Retry now</button>
              </div>
              <script>
                // Fallback if message handler isn't wired: reload the admin URL.
                if (!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.retry)) {
                  document.querySelector('button').onclick = function(){ location.href = '\(adminURL)'; };
                }
              </script>
            </body></html>
            """
            webView.loadHTMLString(html, baseURL: nil)
        }
    }
}

@main
struct FrontStoresAdminApp: App {
    var body: some Scene {
        WindowGroup("FrontStores Admin") {
            WebView()
                .frame(minWidth: 1100, minHeight: 720)
        }
        .windowResizability(.contentSize)
    }
}
