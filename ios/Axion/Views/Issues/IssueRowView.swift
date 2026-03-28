import SwiftUI

struct IssueRowView: View {
    let issue: Issue

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                // Type icon
                Image(systemName: issue.type.icon)
                    .font(.caption)
                    .foregroundColor(.secondary)

                // Title
                Text(issue.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(2)

                Spacer()

                // Priority icon
                Image(systemName: issue.priority.icon)
                    .font(.caption)
                    .foregroundColor(issue.priority.color)
            }

            HStack(spacing: 6) {
                // Status badge
                HStack(spacing: 4) {
                    Circle()
                        .fill(issue.status.color)
                        .frame(width: 6, height: 6)
                    Text(issue.status.label)
                        .font(.caption2)
                        .foregroundColor(issue.status.color)
                }
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(issue.status.color.opacity(0.1))
                .cornerRadius(10)

                if let due = issue.dueDate {
                    HStack(spacing: 3) {
                        Image(systemName: "calendar")
                            .font(.caption2)
                        Text(formatDate(due))
                            .font(.caption2)
                    }
                    .foregroundColor(.secondary)
                }

                Spacer()

                Text("#\(issue.id)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .fontDesign(.monospaced)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }

    private func formatDate(_ isoDate: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        guard let date = formatter.date(from: isoDate) else { return isoDate }
        let out = DateFormatter()
        out.dateStyle = .short
        out.locale = Locale(identifier: "de_DE")
        return out.string(from: date)
    }
}
