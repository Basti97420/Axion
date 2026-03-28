import Foundation

struct KiAgentService {
    static func getAgents(projectId: Int) async throws -> [KiAgent] {
        return try await APIClient.shared.get("/projects/\(projectId)/ki-agents")
    }

    static func getAgent(_ id: Int) async throws -> KiAgent {
        return try await APIClient.shared.get("/ki-agents/\(id)")
    }

    static func getRuns(_ id: Int) async throws -> [KiAgentRun] {
        return try await APIClient.shared.get("/ki-agents/\(id)/runs")
    }

    static func run(_ id: Int) async throws {
        struct Empty: Codable {}
        let _: Empty = try await APIClient.shared.post("/ki-agents/\(id)/run", body: Empty())
    }
}
