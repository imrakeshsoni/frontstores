// FrontStores Admin — native macOS wrapper around the local admin panel.
// Loads http://127.0.0.1:3002 in a WKWebView and auto-signs in using a
// password read from a local-only token file, so the admin never has to
// type the admin password on this Mac.
import SwiftUI
import WebKit

let adminURL = "http://127.0.0.1:3002"
let tokenPath = NSString(string: "~/Library/Application Support/FrontStores/admin_local.token").expandingTildeInPath

func readLocalToken() -> String? {
    guard let raw = try? String(contentsOfFile: tokenPath, encoding: .utf8) else { return nil }
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
}

struct WebView: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero)
        load(into: webView)
        return webView
    }
    func updateNSView(_ nsView: WKWebView, context: Context) {}

    private func load(into webView: WKWebView) {
        var urlString = adminURL
        if let token = readLocalToken(),
           let encoded = token.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            urlString += "/?local_token=\(encoded)"
        }
        if let url = URL(string: urlString) {
            webView.load(URLRequest(url: url))
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
