import Foundation

struct AIService {
    static func getStatus() async throws -> AIStatusResponse {
        return try await APIClient.shared.get("/ai/status")
    }

    static func chat(message: String, history: [APIChatMessage], projectId: Int? = nil) async throws -> AIChatResponse {
        let request = AIChatRequest(message: message, history: history, context: [:], projectId: projectId)
        return try await APIClient.shared.post("/ai/chat", body: request)
    }
}
