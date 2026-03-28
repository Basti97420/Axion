import Foundation

struct WikiPage: Codable, Identifiable {
    let id: Int
    let slug: String
    let title: String
    let content: String?
    let renderedHtml: String?
    let parentId: Int?
    let projectId: Int?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, slug, title, content
        case renderedHtml = "rendered_html"
        case parentId = "parent_id"
        case projectId = "project_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
