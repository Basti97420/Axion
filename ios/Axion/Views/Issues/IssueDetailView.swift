import SwiftUI

struct IssueDetailView: View {
    let issueId: Int

    @State private var issue: Issue? = nil
    @State private var comments: [Comment] = []
    @State private var isLoading: Bool = true
    @State private var error: String? = nil
    @State private var commentText: String = ""
    @State private var isSendingComment: Bool = false
    @State private var showStatusSheet: Bool = false

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Lade Issue…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = error {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundColor(.orange)
                    Text(error)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let issue = issue {
                issueContent(issue)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { load() }
        .sheet(isPresented: $showStatusSheet) {
            if let issue = issue {
                StatusPickerSheet(issue: issue) { newStatus in
                    changeStatus(to: newStatus)
                }
            }
        }
    }

    @ViewBuilder
    private func issueContent(_ issue: Issue) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {

                // Header
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        Image(systemName: issue.type.icon)
                            .foregroundColor(.secondary)
                        Text(issue.type.label)
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("#\(issue.id)")
                            .font(.caption)
                            .fontDesign(.monospaced)
                            .foregroundColor(.secondary)
                    }

                    Text(issue.title)
                        .font(.title2)
                        .fontWeight(.bold)
                        .fixedSize(horizontal: false, vertical: true)

                    // Status + Priority chips
                    HStack(spacing: 8) {
                        Button { showStatusSheet = true } label: {
                            HStack(spacing: 5) {
                                Image(systemName: issue.status.icon)
                                    .font(.caption2)
                                Text(issue.status.label)
                                    .font(.caption)
                                    .fontWeight(.medium)
                            }
                            .foregroundColor(issue.status.color)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(issue.status.color.opacity(0.12))
                            .cornerRadius(20)
                        }
                        .buttonStyle(.plain)

                        HStack(spacing: 5) {
                            Image(systemName: issue.priority.icon)
                                .font(.caption2)
                            Text(issue.priority.label)
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                        .foregroundColor(issue.priority.color)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(issue.priority.color.opacity(0.12))
                        .cornerRadius(20)
                    }
                }
                .padding(16)

                Divider()

                // Metadata
                VStack(spacing: 0) {
                    metaRow("Ersteller", value: issue.creatorName ?? "–", icon: "person")
                    Divider().padding(.leading, 40)
                    metaRow("Zugewiesen", value: issue.assigneeName ?? "–", icon: "person.fill")
                    if let due = issue.dueDate {
                        Divider().padding(.leading, 40)
                        metaRow("Fällig", value: formatDate(due), icon: "calendar")
                    }
                    if let hours = issue.estimatedHours {
                        Divider().padding(.leading, 40)
                        metaRow("Geschätzt", value: "\(String(format: "%.1f", hours)) h", icon: "clock")
                    }
                }
                .background(Color(.secondarySystemGroupedBackground))

                Divider()

                // Description
                if let desc = issue.description, !desc.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Beschreibung")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .textCase(.uppercase)
                        Text(desc)
                            .font(.body)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(16)

                    Divider()
                }

                // Comments
                VStack(alignment: .leading, spacing: 12) {
                    Text("Kommentare (\(comments.count))")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)
                        .textCase(.uppercase)

                    if comments.isEmpty {
                        Text("Noch keine Kommentare.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(.vertical, 4)
                    } else {
                        ForEach(comments) { comment in
                            CommentRowView(comment: comment)
                        }
                    }

                    // New comment input
                    VStack(spacing: 8) {
                        TextEditor(text: $commentText)
                            .frame(minHeight: 72)
                            .padding(8)
                            .background(Color(.systemFill))
                            .cornerRadius(10)
                            .font(.body)

                        HStack {
                            Spacer()
                            Button(action: sendComment) {
                                HStack(spacing: 6) {
                                    if isSendingComment {
                                        ProgressView()
                                            .scaleEffect(0.7)
                                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    }
                                    Text("Senden")
                                        .fontWeight(.semibold)
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(commentText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Color.gray : Color.indigo)
                                .foregroundColor(.white)
                                .cornerRadius(8)
                            }
                            .disabled(commentText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSendingComment)
                        }
                    }
                }
                .padding(16)
            }
        }
        .background(Color(.systemGroupedBackground))
    }

    @ViewBuilder
    private func metaRow(_ label: String, value: String, icon: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .frame(width: 20)
                .foregroundColor(.secondary)
                .font(.subheadline)
            Text(label)
                .font(.subheadline)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private func load() {
        isLoading = true
        Task {
            async let issueFetch = IssueService.getIssue(issueId)
            async let commentsFetch = IssueService.getComments(issueId: issueId)
            do {
                let (i, c) = try await (issueFetch, commentsFetch)
                await MainActor.run {
                    issue = i
                    comments = c
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

    private func changeStatus(to status: IssueStatus) {
        guard let current = issue else { return }
        Task {
            do {
                let updated = try await IssueService.patchStatus(issueId: current.id, status: status)
                await MainActor.run { issue = updated }
            } catch {}
        }
    }

    private func sendComment() {
        let text = commentText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        isSendingComment = true
        Task {
            do {
                let newComment = try await IssueService.postComment(issueId: issueId, content: text)
                await MainActor.run {
                    comments.append(newComment)
                    commentText = ""
                    isSendingComment = false
                }
            } catch {
                await MainActor.run { isSendingComment = false }
            }
        }
    }

    private func formatDate(_ isoDate: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        guard let date = formatter.date(from: isoDate) else { return isoDate }
        let out = DateFormatter()
        out.dateStyle = .medium
        out.locale = Locale(identifier: "de_DE")
        return out.string(from: date)
    }
}

struct CommentRowView: View {
    let comment: Comment

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            // Avatar
            ZStack {
                Circle()
                    .fill(Color.indigo.opacity(0.15))
                    .frame(width: 32, height: 32)
                Text(String(comment.authorName?.prefix(1).uppercased() ?? "?"))
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.indigo)
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(comment.authorName ?? "Unbekannt")
                        .font(.caption)
                        .fontWeight(.semibold)
                    Spacer()
                    if let date = comment.createdAt {
                        Text(formatRelativeDate(date))
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
                Text(comment.content)
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(10)
    }

    private func formatRelativeDate(_ isoDate: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: isoDate) else { return isoDate }
        let rel = RelativeDateTimeFormatter()
        rel.locale = Locale(identifier: "de_DE")
        return rel.localizedString(for: date, relativeTo: Date())
    }
}
