import SwiftUI

struct KiAgentDetailView: View {
    let agent: KiAgent

    @State private var runs: [KiAgentRun] = []
    @State private var isRunning: Bool = false
    @State private var runError: String? = nil
    @State private var expandedRuns: Set<Int> = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {

                // Header
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 10) {
                        ZStack {
                            Circle()
                                .fill(agent.isActive ? Color.green.opacity(0.15) : Color.gray.opacity(0.1))
                                .frame(width: 44, height: 44)
                            Image(systemName: "cpu")
                                .foregroundColor(agent.isActive ? .green : .gray)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(agent.name)
                                .font(.title3).fontWeight(.bold)
                            HStack(spacing: 6) {
                                Text(agent.isActive ? "Aktiv" : "Inaktiv")
                                    .font(.caption).foregroundColor(agent.isActive ? .green : .secondary)
                                if agent.dryRun {
                                    Text("· Simulation")
                                        .font(.caption).foregroundColor(.orange)
                                }
                            }
                        }
                        Spacer()
                        Button(action: runAgent) {
                            HStack(spacing: 5) {
                                if isRunning {
                                    ProgressView().scaleEffect(0.7)
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Image(systemName: "play.fill")
                                }
                                Text(isRunning ? "Läuft…" : "Ausführen")
                                    .fontWeight(.semibold)
                            }
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(isRunning ? Color.gray : Color.indigo)
                            .foregroundColor(.white)
                            .cornerRadius(10)
                        }
                        .disabled(isRunning)
                    }

                    if let e = runError {
                        Label(e, systemImage: "exclamationmark.triangle")
                            .font(.caption).foregroundColor(.red)
                    }

                    // Schedule info
                    HStack(spacing: 6) {
                        Image(systemName: agent.scheduleType == "interval" ? "clock" : "hand.tap")
                            .font(.caption).foregroundColor(.secondary)
                        Text(agent.scheduleType == "interval" ? "Alle \(agent.intervalMin) Minuten" : "Manuell")
                            .font(.caption).foregroundColor(.secondary)
                        if let last = agent.lastRunAt {
                            Text("· Zuletzt: \(formatDate(last))")
                                .font(.caption).foregroundColor(.secondary)
                        }
                    }
                }
                .padding(16)

                Divider()

                // Letzter Output (workspace)
                if !agent.workspace.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Letzter Output")
                            .font(.caption).fontWeight(.semibold)
                            .foregroundColor(.secondary).textCase(.uppercase)
                        Text(agent.workspace)
                            .font(.body)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(16)

                    Divider()
                }

                // Runs
                VStack(alignment: .leading, spacing: 8) {
                    Text("Letzte Ausführungen (\(runs.count))")
                        .font(.caption).fontWeight(.semibold)
                        .foregroundColor(.secondary).textCase(.uppercase)

                    if runs.isEmpty {
                        Text("Noch nicht ausgeführt.")
                            .font(.caption).foregroundColor(.secondary)
                    } else {
                        ForEach(runs.prefix(10)) { run in
                            RunCard(run: run, isExpanded: expandedRuns.contains(run.id)) {
                                if expandedRuns.contains(run.id) {
                                    expandedRuns.remove(run.id)
                                } else {
                                    expandedRuns.insert(run.id)
                                }
                            }
                        }
                    }
                }
                .padding(16)
            }
        }
        .navigationTitle(agent.name)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { loadRuns() }
    }

    private func runAgent() {
        isRunning = true; runError = nil
        Task {
            do {
                try await KiAgentService.run(agent.id)
                // Kurz warten, dann Runs neu laden
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                let newRuns = try await KiAgentService.getRuns(agent.id)
                await MainActor.run { runs = newRuns; isRunning = false }
            } catch {
                await MainActor.run { runError = error.localizedDescription; isRunning = false }
            }
        }
    }

    private func loadRuns() {
        Task {
            if let data = try? await KiAgentService.getRuns(agent.id) {
                await MainActor.run { runs = data }
            }
        }
    }

    private func formatDate(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = f.date(from: iso) else { return iso }
        let out = DateFormatter()
        out.dateStyle = .short; out.timeStyle = .short
        out.locale = Locale(identifier: "de_DE")
        return out.string(from: date)
    }
}

struct RunCard: View {
    let run: KiAgentRun
    let isExpanded: Bool
    let onToggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header Row
            Button(action: onToggle) {
                HStack(spacing: 10) {
                    Image(systemName: run.error != nil ? "xmark.circle.fill" : "checkmark.circle.fill")
                        .foregroundColor(run.error != nil ? .red : .green)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(formatDate(run.startedAt))
                            .font(.subheadline).fontWeight(.medium)
                        HStack(spacing: 6) {
                            Text(run.triggeredBy)
                                .font(.caption2).foregroundColor(.secondary)
                            if run.tokensIn > 0 || run.tokensOut > 0 {
                                Text("· \(run.tokensIn)↑ \(run.tokensOut)↓ Token")
                                    .font(.caption2).foregroundColor(.secondary)
                            }
                        }
                    }
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption).foregroundColor(.secondary)
                }
                .padding(12)
            }
            .buttonStyle(.plain)

            if isExpanded {
                Divider()
                VStack(alignment: .leading, spacing: 8) {
                    if let err = run.error {
                        Text(err)
                            .font(.caption).foregroundColor(.red)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if !run.output.isEmpty {
                        Text(run.output)
                            .font(.caption).foregroundColor(.primary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(12)
            }
        }
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(10)
    }

    private func formatDate(_ iso: String?) -> String {
        guard let iso = iso else { return "–" }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = f.date(from: iso) else { return iso }
        let out = DateFormatter()
        out.dateStyle = .short; out.timeStyle = .short
        out.locale = Locale(identifier: "de_DE")
        return out.string(from: date)
    }
}
