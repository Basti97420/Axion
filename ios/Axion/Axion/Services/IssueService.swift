import Foundation

struct StatusPatchRequest: Codable {
    let status: String
}

struct CommentRequest: Codable {
    let content: String
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
