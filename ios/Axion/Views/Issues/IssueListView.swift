import SwiftUI

struct IssueListView: View {
    let project: Project

    @State private var issues: [Issue] = []
    @State private var isLoading: Bool = true
    @State private var error: String? = nil
    @State private var statusFilter: String = "all"
    @State private var statusSheet: Issue? = nil

    private let filterOptions: [(String, String)] = [
        ("all", "Alle"),
        ("open", "Offen"),
        ("in_progress", "In Bearbeitung"),
        ("in_review", "In Review"),
        ("done", "Erledigt"),
        ("cancelled", "Abgebrochen"),
    ]

    private var filtered: [Issue] {
        if statusFilter == "all" { return issues }
        return issues.filter { $0.status.rawValue == statusFilter }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Filter-Picker
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(filterOptions, id: \.0) { (value, label) in
                        Button {
                            statusFilter = value
                        } label: {
                            Text(label)
                                .font(.caption)
                                .fontWeight(statusFilter == value ? .semibold : .regular)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(statusFilter == value ? Color.indigo : Color(.systemFill))
                                .foregroundColor(statusFilter == value ? .white : .primary)
                                .cornerRadius(20)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
            }
            Divider()

            // List
            if isLoading {
                ProgressView("Issues laden…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = error {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundColor(.orange)
                    Text(error)
                        .multilineTextAlignment(.center)
                    Button("Erneut versuchen") { load() }
                        .buttonStyle(.bordered)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if filtered.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "tray")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("Keine Issues")
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(filtered) { issue in
                    NavigationLink(destination: IssueDetailView(issueId: issue.id)) {
                        IssueRowView(issue: issue)
                    }
                    .contextMenu {
                        statusMenuItems(for: issue)
                    }
                    .swipeActions(edge: .leading, allowsFullSwipe: false) {
                        Button {
                            statusSheet = issue
                        } label: {
                            Label("Status", systemImage: "arrow.triangle.2.circlepath")
                        }
                        .tint(.indigo)
                    }
                    // Long press → status sheet
                    .simultaneousGesture(
                        LongPressGesture(minimumDuration: 0.5).onEnded { _ in
                            statusSheet = issue
                        }
                    )
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { load() }
        .onAppear { load() }
        .sheet(item: $statusSheet) { issue in
            StatusPickerSheet(issue: issue) { newStatus in
                changeStatus(issue: issue, to: newStatus)
            }
        }
    }

    @ViewBuilder
    private func statusMenuItems(for issue: Issue) -> some View {
        ForEach(IssueStatus.allCases, id: \.self) { status in
            Button {
                changeStatus(issue: issue, to: status)
            } label: {
                Label(status.label, systemImage: status.icon)
            }
        }
    }

    private func load() {
        isLoading = true
        error = nil
        Task {
            do {
                let data = try await IssueService.getIssues(projectId: project.id)
                await MainActor.run {
                    issues = data
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }

    private func changeStatus(issue: Issue, to status: IssueStatus) {
        Task {
            do {
                let updated = try await IssueService.patchStatus(issueId: issue.id, status: status)
                await MainActor.run {
                    if let idx = issues.firstIndex(where: { $0.id == updated.id }) {
                        issues[idx] = updated
                    }
                }
            } catch {
                // Silently ignore, could show a toast here
            }
        }
    }
}
