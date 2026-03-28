import Foundation

struct PythonScriptRunResponse: Codable {
    let runId: Int
    enum CodingKeys: String, CodingKey { case runId = "run_id" }
}

struct PythonScriptService {
    static func getScripts(projectId: Int) async throws -> [PythonScript] {
        return try await APIClient.shared.get("/projects/\(projectId)/python-scripts")
    }

    static func getRuns(_ id: Int) async throws -> [PythonScriptRun] {
        return try await APIClient.shared.get("/python-scripts/\(id)/runs")
    }

    static func run(_ id: Int) async throws -> PythonScriptRunResponse {
        struct Empty: Codable {}
        return try await APIClient.shared.post("/python-scripts/\(id)/run", body: Empty())
    }
}
