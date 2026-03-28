import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case notAuthenticated
    case serverError(String)
    case decodingError(Error)
    case unknown(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Ungültige Server-URL"
        case .notAuthenticated: return "Nicht angemeldet"
        case .serverError(let msg): return msg
        case .decodingError(let e): return "Datenfehler: \(e.localizedDescription)"
        case .unknown(let e): return e.localizedDescription
        }
    }
}

class APIClient {
    static let shared = APIClient()

    private var session: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = HTTPCookieStorage.shared
        config.httpShouldSetCookies = true
        config.httpCookieAcceptPolicy = .always
        return URLSession(configuration: config)
    }()

    var baseURL: String {
        UserDefaults.standard.string(forKey: "axion_server_url") ?? ""
    }

    private func url(_ path: String) throws -> URL {
        guard !baseURL.isEmpty, let url = URL(string: baseURL + "/api" + path) else {
            throw APIError.invalidURL
        }
        return url
    }

    // MARK: - GET
    func get<T: Decodable>(_ path: String) async throws -> T {
        let url = try url(path)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        return try await perform(request)
    }

    // MARK: - POST
    func post<B: Encodable, T: Decodable>(_ path: String, body: B) async throws -> T {
        let url = try url(path)
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await perform(request)
    }

    // MARK: - PUT
    func put<B: Encodable, T: Decodable>(_ path: String, body: B) async throws -> T {
        let url = try url(path)
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await perform(request)
    }

    // MARK: - PATCH
    func patch<B: Encodable, T: Decodable>(_ path: String, body: B) async throws -> T {
        let url = try url(path)
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        return try await perform(request)
    }

    // MARK: - Perform
    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw APIError.unknown(URLError(.badServerResponse))
        }
        if http.statusCode == 401 {
            throw APIError.notAuthenticated
        }
        if http.statusCode >= 400 {
            // Try to decode error message
            if let errorBody = try? JSONDecoder().decode([String: String].self, from: data),
               let msg = errorBody["error"] {
                throw APIError.serverError(msg)
            }
            throw APIError.serverError("HTTP \(http.statusCode)")
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }
    }
}
