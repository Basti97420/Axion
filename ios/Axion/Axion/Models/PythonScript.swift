import Foundation

struct PythonScript: Codable, Identifiable {
    let id: Int
    let projectId: Int
    let name: String
    let description: String
    let scheduleType: String
    let intervalMin: Int
    let isActive: Bool
    let hasNotebook: Bool  // cells != nil
    let lastRunAt: String?
    let nextRunAt: String?
    let scheduleDays: [Int]?
    let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description
        case projectId = "project_id"
        case scheduleType = "schedule_type"
        case intervalMin = "interval_min"
        case isActive = "is_active"
        case lastRunAt = "last_run_at"
        case nextRunAt = "next_run_at"
        case scheduleDays = "schedule_days"
        case createdAt = "created_at"
        case cells  // raw field for decoding
    }

    // Custom init to derive hasNotebook from cells
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int.self, forKey: .id)
        projectId = try c.decode(Int.self, forKey: .projectId)
        name = try c.decode(String.self, forKey: .name)
        description = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        scheduleType = try c.decodeIfPresent(String.self, forKey: .scheduleType) ?? "manual"
        intervalMin = try c.decodeIfPresent(Int.self, forKey: .intervalMin) ?? 60
        isActive = try c.decodeIfPresent(Bool.self, forKey: .isActive) ?? true
        lastRunAt = try c.decodeIfPresent(String.self, forKey: .lastRunAt)
        nextRunAt = try c.decodeIfPresent(String.self, forKey: .nextRunAt)
        scheduleDays = try c.decodeIfPresent([Int].self, forKey: .scheduleDays)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        // cells can be null or an array – just check if non-nil
        let rawCells = try? c.decodeIfPresent([String].self, forKey: .cells)
        hasNotebook = rawCells != nil
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(name, forKey: .name)
    }
}

struct PythonScriptRun: Codable, Identifiable {
    let id: Int
    let scriptId: Int
    let stdout: String
    let stderr: String
    let exitCode: Int?
    let error: String?
    let triggeredBy: String
    let startedAt: String?
    let finishedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, stdout, stderr, error
        case scriptId = "script_id"
        case exitCode = "exit_code"
        case triggeredBy = "triggered_by"
        case startedAt = "started_at"
        case finishedAt = "finished_at"
    }
}
