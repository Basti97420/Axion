import Foundation
import UserNotifications

class NotificationService: ObservableObject {
    static let shared = NotificationService()

    @Published var isEnabled: Bool {
        didSet { UserDefaults.standard.set(isEnabled, forKey: "notify_enabled") }
    }
    @Published var notifyNewIssues: Bool {
        didSet { UserDefaults.standard.set(notifyNewIssues, forKey: "notify_new_issues") }
    }
    @Published var notifyStatusChanges: Bool {
        didSet { UserDefaults.standard.set(notifyStatusChanges, forKey: "notify_status_changes") }
    }
    @Published var notifyAgentCompleted: Bool {
        didSet { UserDefaults.standard.set(notifyAgentCompleted, forKey: "notify_agent_completed") }
    }

    private var lastCheckDate: Date {
        get {
            let ts = UserDefaults.standard.double(forKey: "notify_last_check")
            return ts > 0 ? Date(timeIntervalSince1970: ts) : Date().addingTimeInterval(-3600)
        }
        set { UserDefaults.standard.set(newValue.timeIntervalSince1970, forKey: "notify_last_check") }
    }

    private init() {
        isEnabled = UserDefaults.standard.bool(forKey: "notify_enabled")
        notifyNewIssues = UserDefaults.standard.object(forKey: "notify_new_issues") as? Bool ?? true
        notifyStatusChanges = UserDefaults.standard.object(forKey: "notify_status_changes") as? Bool ?? true
        notifyAgentCompleted = UserDefaults.standard.object(forKey: "notify_agent_completed") as? Bool ?? false
    }

    // MARK: - Permission
    @MainActor
    func requestPermission() async -> Bool {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            if !granted { isEnabled = false }
            return granted
        } catch {
            isEnabled = false
            return false
        }
    }

    // MARK: - Schedule local notification
    func scheduleNotification(title: String, body: String, id: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let request = UNNotificationRequest(
            identifier: id,
            content: content,
            trigger: nil  // sofort
        )
        UNUserNotificationCenter.current().add(request)
    }

    // MARK: - Poll for updates
    struct ActivityEntry: Codable {
        let action: String
        let timestamp: String
        let fieldChanged: String?
        let newValue: String?
        let issueTitle: String?
        let userName: String?

        enum CodingKeys: String, CodingKey {
            case action, timestamp
            case fieldChanged = "field_changed"
            case newValue = "new_value"
            case issueTitle = "issue_title"
            case userName = "user_name"
        }
    }

    func checkForUpdates(projectId: Int) {
        guard isEnabled else { return }
        Task {
            guard let entries: [ActivityEntry] = try? await APIClient.shared.get("/projects/\(projectId)/log") else { return }
            let cutoff = lastCheckDate
            let newEntries = entries.filter { entry in
                let f = ISO8601DateFormatter()
                f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                guard let date = f.date(from: entry.timestamp) else { return false }
                return date > cutoff
            }

            await MainActor.run {
                lastCheckDate = Date()
                for entry in newEntries {
                    processEntry(entry)
                }
            }
        }
    }

    private func processEntry(_ entry: ActivityEntry) {
        switch entry.action {
        case "created" where notifyNewIssues:
            let title = entry.issueTitle ?? "Neues Issue"
            scheduleNotification(
                title: "Neues Issue",
                body: "\(entry.userName ?? "Jemand") hat '\(title)' erstellt",
                id: "issue_created_\(UUID().uuidString)"
            )
        case "status_changed" where notifyStatusChanges:
            let title = entry.issueTitle ?? "Issue"
            scheduleNotification(
                title: "Status geändert",
                body: "'\(title)' → \(entry.newValue ?? "?")",
                id: "status_\(UUID().uuidString)"
            )
        case "agent_completed" where notifyAgentCompleted:
            scheduleNotification(
                title: "Agent abgeschlossen",
                body: entry.issueTitle ?? "Ein Agent hat seine Ausführung beendet",
                id: "agent_\(UUID().uuidString)"
            )
        default:
            break
        }
    }
}
