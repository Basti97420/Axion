import Foundation

struct KiAgent: Codable, Identifiable {
    let id: Int
    let projectId: Int
    let name: String
    let prompt: String
    let apiProvider: String
    let scheduleType: String
    let intervalMin: Int
    let isActive: Bool
    let dryRun: Bool
    let notifyTelegram: Bool
    let retryOnError: Bool
    let workspace: String
    let lastRunAt: String?
    let nextRunAt: String?
    let scheduleDays: [Int]?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, prompt, workspace
        case projectId = "project_id"
        case apiProvider = "api_provider"
        case scheduleType = "schedule_type"
        case intervalMin = "interval_min"
        case isActive = "is_active"
        case dryRun = "dry_run"
        case notifyTelegram = "notify_telegram"
        case retryOnError = "retry_on_error"
        case lastRunAt = "last_run_at"
        case nextRunAt = "next_run_at"
        case scheduleDays = "schedule_days"
        case createdAt = "created_at"
    }
}

struct KiAgentRun: Codable, Identifiable {
    let id: Int
    let agentId: Int
    let output: String
    let error: String?
    let triggeredBy: String
    let startedAt: String?
    let finishedAt: String?
    let tokensIn: Int
    let tokensOut: Int

    enum CodingKeys: String, CodingKey {
        case id, output, error
        case agentId = "agent_id"
        case triggeredBy = "triggered_by"
        case startedAt = "started_at"
        case finishedAt = "finished_at"
        case tokensIn = "tokens_in"
        case tokensOut = "tokens_out"
    }
}
