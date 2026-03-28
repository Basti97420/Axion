import Foundation

enum ChatRole: String {
    case user, assistant
}

struct ChatMessage: Identifiable {
    let id: UUID = UUID()
    let role: ChatRole
    let content: String
    let isLoading: Bool

    init(role: ChatRole, content: String, isLoading: Bool = false) {
        self.role = role
        self.content = content
        self.isLoading = isLoading
    }
}

// API payload structures
struct APIChatMessage: Codable {
    let role: String
    let content: String
}

struct AIChatRequest: Codable {
    let message: String           // aktueller Nutzereingabe-Text (Singular)
    let history: [APIChatMessage] // vorherige Nachrichten (max 10)
    let context: [String: String] // leer {}
    let projectId: Int?

    enum CodingKeys: String, CodingKey {
        case message, history, context
        case projectId = "project_id"
    }
}

struct AIChatResponse: Codable {
    let reply: String
}

struct AIStatusResponse: Codable {
    let available: Bool
    let provider: String?
}
