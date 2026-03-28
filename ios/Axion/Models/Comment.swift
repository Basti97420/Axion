import Foundation

struct Comment: Codable, Identifiable {
    let id: Int
    let issueId: Int
    let authorId: Int
    let content: String
    let createdAt: String?
    let authorName: String?

    enum CodingKeys: String, CodingKey {
        case id, content
        case issueId = "issue_id"
        case authorId = "author_id"
        case createdAt = "created_at"
        case authorName = "author_name"
    }
}
