import Foundation
import SwiftUI

enum IssueStatus: String, Codable, CaseIterable {
    case open, in_progress, in_review, done, cancelled

    var label: String {
        switch self {
        case .open: return "Offen"
        case .in_progress: return "In Bearbeitung"
        case .in_review: return "In Review"
        case .done: return "Erledigt"
        case .cancelled: return "Abgebrochen"
        }
    }

    var color: Color {
        switch self {
        case .open: return .gray
        case .in_progress: return .blue
        case .in_review: return .orange
        case .done: return .green
        case .cancelled: return .red
        }
    }

    var icon: String {
        switch self {
        case .open: return "circle"
        case .in_progress: return "clock"
        case .in_review: return "eyes"
        case .done: return "checkmark.circle.fill"
        case .cancelled: return "xmark.circle"
        }
    }
}

enum IssuePriority: String, Codable, CaseIterable {
    case low, medium, high, critical

    var label: String {
        switch self {
        case .low: return "Niedrig"
        case .medium: return "Mittel"
        case .high: return "Hoch"
        case .critical: return "Kritisch"
        }
    }

    var color: Color {
        switch self {
        case .low: return .gray
        case .medium: return .blue
        case .high: return .orange
        case .critical: return .red
        }
    }

    var icon: String {
        switch self {
        case .low: return "arrow.down"
        case .medium: return "minus"
        case .high: return "arrow.up"
        case .critical: return "exclamationmark.2"
        }
    }
}

enum IssueType: String, Codable, CaseIterable {
    case task, bug, story, epic, subtask

    var label: String {
        switch self {
        case .task: return "Aufgabe"
        case .bug: return "Bug"
        case .story: return "Story"
        case .epic: return "Epic"
        case .subtask: return "Unteraufgabe"
        }
    }

    var icon: String {
        switch self {
        case .task: return "checkmark.square"
        case .bug: return "ladybug"
        case .story: return "book"
        case .epic: return "bolt"
        case .subtask: return "arrow.turn.down.right"
        }
    }
}

struct Issue: Codable, Identifiable {
    let id: Int
    let projectId: Int
    let title: String
    let description: String?
    let type: IssueType
    let status: IssueStatus
    let priority: IssuePriority
    let assigneeId: Int?
    let creatorId: Int?
    let dueDate: String?
    let startDate: String?
    let estimatedHours: Double?
    let createdAt: String?
    let updatedAt: String?
    let closedAt: String?
    let parentId: Int?
    let milestoneId: Int?

    // Joined fields (may be present in detail responses)
    let assigneeName: String?
    let creatorName: String?
    let projectKey: String?

    enum CodingKeys: String, CodingKey {
        case id, title, description, type, status, priority
        case projectId = "project_id"
        case assigneeId = "assignee_id"
        case creatorId = "creator_id"
        case dueDate = "due_date"
        case startDate = "start_date"
        case estimatedHours = "estimated_hours"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case closedAt = "closed_at"
        case parentId = "parent_id"
        case milestoneId = "milestone_id"
        case assigneeName = "assignee_name"
        case creatorName = "creator_name"
        case projectKey = "project_key"
    }
}
