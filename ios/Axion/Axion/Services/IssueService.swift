import Foundation

struct StatusPatchRequest: Codable {
    let status: String
}

struct PriorityPatchRequest: Codable {
    let priority: String
}

struct CommentRequest: Codable {
    let content: String
}

struct IssueUpdateRequest: Codable {
    let title: String
    let description: String
    let type: String
    let dueDate: String?
    let estimatedHours: Double?

    enum CodingKeys: String, CodingKey {
        case title, description, type
        case dueDate = "due_date"
        case estimatedHours = "estimated_hours"
    }
}

struct IssueService {
    static func getIssues(projectId: Int, status: String? = nil) async throws -> [Issue] {
        var path = "/projects/\(projectId)/issues"
        if let status = status { path += "?status=\(status)" }
        return try await APIClient.shared.get(path)
    }

    static func getIssue(_ id: Int) async throws -> Issue {
        return try await APIClient.shared.get("/issues/\(id)")
    }

    static func updateIssue(issueId: Int, body: IssueUpdateRequest) async throws -> Issue {
        return try await APIClient.shared.put("/issues/\(issueId)", body: body)
    }

    static func patchPriority(issueId: Int, priority: IssuePriority) async throws -> Issue {
        return try await APIClient.shared.patch(
            "/issues/\(issueId)/priority",
            body: PriorityPatchRequest(priority: priority.rawValue)
        )
    }

    static func patchStatus(issueId: Int, status: IssueStatus) async throws -> Issue {
        return try await APIClient.shared.patch(
            "/issues/\(issueId)/status",
            body: StatusPatchRequest(status: status.rawValue)
        )
    }

    static func getComments(issueId: Int) async throws -> [Comment] {
        return try await APIClient.shared.get("/issues/\(issueId)/comments")
    }

    static func postComment(issueId: Int, content: String) async throws -> Comment {
        return try await APIClient.shared.post(
            "/issues/\(issueId)/comments",
            body: CommentRequest(content: content)
        )
    }
}
