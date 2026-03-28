import Foundation

struct ProjectService {
    static func getProjects() async throws -> [Project] {
        return try await APIClient.shared.get("/projects")
    }

    static func getProject(_ id: Int) async throws -> Project {
        return try await APIClient.shared.get("/projects/\(id)")
    }
}
