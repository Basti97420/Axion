import SwiftUI

struct KiAgentsListView: View {
    let project: Project

    @State private var agents: [KiAgent] = []
    @State private var isLoading: Bool = true
    @State private var error: String? = nil

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Agenten laden…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = error {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle).foregroundColor(.orange)
                    Text(error).multilineTextAlignment(.center)
                    Button("Erneut versuchen") { load() }.buttonStyle(.bordered)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if agents.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "cpu")
                        .font(.largeTitle).foregroundColor(.secondary)
                    Text("Keine Agenten").foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(agents) { agent in
                    NavigationLink(destination: KiAgentDetailView(agent: agent)) {
                        AgentRowView(agent: agent)
                    }
                }
                .listStyle(.plain)
            }
        }
        .refreshable { load() }
        .onAppear { load() }
    }

    private func load() {
        isLoading = true; error = nil
        Task {
            do {
                let data = try await KiAgentService.getAgents(projectId: project.id)
                await MainActor.run { agents = data; isLoading = false }
            } catch {
                await MainActor.run { self.error = error.localizedDescription; isLoading = false }
            }
        }
    }
}

struct AgentRowView: View {
    let agent: KiAgent

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Circle()
                    .fill(agent.isActive ? Color.green : Color.gray)
                    .frame(width: 8, height: 8)
                Text(agent.name)
                    .fontWeight(.medium)
                    .lineLimit(1)
                if agent.dryRun {
                    Text("SIM")
                        .font(.caption2).fontWeight(.bold)
                        .foregroundColor(.orange)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(Color.orange.opacity(0.12))
                        .cornerRadius(4)
                }
                Spacer()
                Text("#\(agent.id)")
                    .font(.caption2).foregroundColor(.secondary)
                    .fontDesign(.monospaced)
            }
            HStack(spacing: 4) {
                Image(systemName: agent.scheduleType == "interval" ? "clock" : "hand.tap")
                    .font(.caption2).foregroundColor(.secondary)
                Text(agent.scheduleType == "interval" ? "alle \(agent.intervalMin) Min" : "Manuell")
                    .font(.caption).foregroundColor(.secondary)
                if let last = agent.lastRunAt {
                    Text("· \(formatRelative(last))")
                        .font(.caption).foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func formatRelative(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = f.date(from: iso) else { return iso }
        let rel = RelativeDateTimeFormatter()
        rel.locale = Locale(identifier: "de_DE")
        return rel.localizedString(for: date, relativeTo: Date())
    }
}
