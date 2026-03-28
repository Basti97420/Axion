import Foundation

struct WikiService {
    static func getPages() async throws -> [WikiPage] {
        return try await APIClient.shared.get("/wiki/pages")
    }

    static func getPage(slug: String) async throws -> WikiPage {
        return try await APIClient.shared.get("/wiki/pages/\(slug)")
    }
}
