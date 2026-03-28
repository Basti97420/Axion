import Foundation

struct LoginRequest: Codable {
    let name: String
    let password: String
}

struct LoginResponse: Codable {
    let user: User
}

struct AuthService {
    static func login(name: String, password: String) async throws -> User {
        let response: LoginResponse = try await APIClient.shared.post(
            "/auth/login",
            body: LoginRequest(name: name, password: password)
        )
        return response.user
    }

    static func me() async throws -> User {
        struct MeResponse: Codable { let user: User }
        let response: MeResponse = try await APIClient.shared.get("/auth/me")
        return response.user
    }

    static func logout() async throws {
        struct Empty: Codable {}
        let _: Empty = try await APIClient.shared.post("/auth/logout", body: Empty())
    }
}
