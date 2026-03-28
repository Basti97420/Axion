import SwiftUI
import WebKit

struct WikiPageView: View {
    let slug: String
    let title: String

    @State private var page: WikiPage? = nil
    @State private var isLoading: Bool = true
    @State private var error: String? = nil

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Seite laden…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = error {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundColor(.orange)
                    Text(error)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let page = page {
                WikiWebView(html: styledHTML(page))
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { load() }
    }

    private func styledHTML(_ page: WikiPage) -> String {
        let body = page.renderedHtml ?? page.content?.replacingOccurrences(of: "\n", with: "<br>") ?? ""
        return """
        <!DOCTYPE html>
        <html>
        <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, sans-serif;
            font-size: 16px;
            line-height: 1.6;
            color: #1a1a1a;
            padding: 16px;
            margin: 0;
            max-width: 100%;
          }
          @media (prefers-color-scheme: dark) {
            body { color: #e0e0e0; background: #1c1c1e; }
            code, pre { background: #2c2c2e !important; color: #e0e0e0 !important; }
            a { color: #818cf8; }
          }
          h1, h2, h3 { font-weight: 700; margin-top: 24px; }
          h1 { font-size: 1.6em; }
          h2 { font-size: 1.3em; }
          h3 { font-size: 1.1em; }
          a { color: #6366f1; }
          code { background: #f0f0f5; padding: 2px 6px; border-radius: 4px; font-size: 0.88em; }
          pre { background: #f0f0f5; padding: 12px; border-radius: 8px; overflow-x: auto; }
          pre code { background: none; padding: 0; }
          blockquote { border-left: 3px solid #6366f1; margin-left: 0; padding-left: 12px; color: #666; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: 600; }
          img { max-width: 100%; height: auto; border-radius: 6px; }
        </style>
        </head>
        <body>\(body)</body>
        </html>
        """
    }

    private func load() {
        isLoading = true
        error = nil
        Task {
            do {
                let data = try await WikiService.getPage(slug: slug)
                await MainActor.run {
                    page = data
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}

// WKWebView wrapper
struct WikiWebView: UIViewRepresentable {
    let html: String

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.isScrollEnabled = true
        webView.backgroundColor = .clear
        webView.isOpaque = false
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        webView.loadHTMLString(html, baseURL: nil)
    }
}
