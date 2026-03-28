import Foundation

struct User: Codable, Identifiable {
    let id: Int
    let name: String
    let isAdmin: Bool
    let createdAt: String?
    let lastLogin: String?

    enum CodingKeys: String, CodingKey {
        case id, name
        case isAdmin = "is_admin"
        case createdAt = "created_at"
        case lastLogin = "last_login"
    }
}
