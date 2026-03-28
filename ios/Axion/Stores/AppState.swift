import Foundation
import Combine

class AppState: ObservableObject {
    @Published var isLoggedIn: Bool = false
    @Published var currentUser: User? = nil
    @Published var serverURL: String {
        didSet { UserDefaults.standard.set(serverURL, forKey: "axion_server_url") }
    }
    @Published var isServerConfigured: Bool

    init() {
        let saved = UserDefaults.standard.string(forKey: "axion_server_url") ?? ""
        self.serverURL = saved
        self.isServerConfigured = !saved.isEmpty
    }

    func configureServer(_ url: String) {
        var clean = url.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.hasSuffix("/") { clean = String(clean.dropLast()) }
        serverURL = clean
        isServerConfigured = !clean.isEmpty
    }

    func login(user: User) {
        currentUser = user
        isLoggedIn = true
    }

    func logout() {
        currentUser = nil
        isLoggedIn = false
        // Clear cookies
        if let cookies = HTTPCookieStorage.shared.cookies {
            for cookie in cookies { HTTPCookieStorage.shared.deleteCookie(cookie) }
        }
    }
}
