import SwiftUI

struct PythonScriptDetailView: View {
    let script: PythonScript

    @State private var runs: [PythonScriptRun] = []
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
                                .fill(script.isActive ? Color.green.opacity(0.15) : Color.gray.opacity(0.1))
                                .frame(width: 44, height: 44)
                            Image(systemName: "terminal")
                                .foregroundColor(script.isActive ? .green : .gray)
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            Text(script.name)
                                .font(.title3).fontWeight(.bold)
                            HStack(spacing: 6) {
                                Text(script.isActive ? "Aktiv" : "Inaktiv")
                                    .font(.caption)
                                    .foregroundColor(script.isActive ? .green : .secondary)
                                if script.hasNotebook {
                                    Text("· Notebook")
                                        .font(.caption).foregroundColor(.orange)
                                }
                            }
                        }
                        Spacer()
                        Button(action: runScript) {
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

                    if !script.description.isEmpty {
                        Text(script.description)
                            .font(.subheadline).foregroundColor(.secondary)
                    }

                    HStack(spacing: 6) {
                        Image(systemName: script.scheduleType == "interval" ? "clock" : "hand.tap")
                            .font(.caption).foregroundColor(.secondary)
                        Text(script.scheduleType == "interval" ? "Alle \(script.intervalMin) Minuten" : "Manuell")
                            .font(.caption).foregroundColor(.secondary)
                        if let last = script.lastRunAt {
                            Text("· Zuletzt: \(formatDate(last))")
                                .font(.caption).foregroundColor(.secondary)
                        }
                    }
                }
                .padding(16)

                Divider()

                // Letzter Run Output
                if let lastRun = runs.first {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Letzter Output")
                                .font(.caption).fontWeight(.semibold)
                                .foregroundColor(.secondary).textCase(.uppercase)
                            Spacer()
                            Image(systemName: lastRun.exitCode == 0 ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .foregroundColor(lastRun.exitCode == 0 ? .green : .red)
                                .font(.caption)
                        }

                        if let err = lastRun.error {
                            Text(err)
                                .font(.caption).foregroundColor(.red)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        if !lastRun.stdout.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                Text(lastRun.stdout)
                                    .font(.system(.caption, design: .monospaced))
                                    .foregroundColor(.primary)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .padding(10)
                            .background(Color(.systemFill))
                            .cornerRadius(8)
                        }
                        if !lastRun.stderr.isEmpty {
                            Text(lastRun.stderr)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundColor(.orange)
                                .padding(10)
                                .background(Color.orange.opacity(0.08))
                                .cornerRadius(8)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(16)

                    Divider()
                }

                // Alle Runs
                VStack(alignment: .leading, spacing: 8) {
                    Text("Ausführungsverlauf (\(runs.count))")
                        .font(.caption).fontWeight(.semibold)
                        .foregroundColor(.secondary).textCase(.uppercase)

                    if runs.isEmpty {
                        Text("Noch nicht ausgeführt.")
                            .font(.caption).foregroundColor(.secondary)
                    } else {
                        ForEach(runs.prefix(10)) { run in
                            ScriptRunCard(run: run, isExpanded: expandedRuns.contains(run.id)) {
                                if expandedRuns.contains(run.id) { expandedRuns.remove(run.id) }
                                else { expandedRuns.insert(run.id) }
                            }
                        }
                    }
                }
                .padding(16)
            }
        }
        .navigationTitle(script.name)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { loadRuns() }
    }

    private func runScript() {
        isRunning = true; runError = nil
        Task {
            do {
                _ = try await PythonScriptService.run(script.id)
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                let newRuns = try await PythonScriptService.getRuns(script.id)
                await MainActor.run { runs = newRuns; isRunning = false }
            } catch {
                await MainActor.run { runError = error.localizedDescription; isRunning = false }
            }
        }
    }

    private func loadRuns() {
        Task {
            if let data = try? await PythonScriptService.getRuns(script.id) {
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

struct ScriptRunCard: View {
    let run: PythonScriptRun
    let isExpanded: Bool
    let onToggle: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onToggle) {
                HStack(spacing: 10) {
                    Image(systemName: (run.exitCode ?? -1) == 0 ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundColor((run.exitCode ?? -1) == 0 ? .green : .red)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(formatDate(run.startedAt))
                            .font(.subheadline).fontWeight(.medium)
                        Text(run.triggeredBy)
                            .font(.caption2).foregroundColor(.secondary)
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
                VStack(alignment: .leading, spacing: 6) {
                    if let err = run.error {
                        Text(err).font(.caption).foregroundColor(.red)
                    }
                    if !run.stdout.isEmpty {
                        Text(run.stdout)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.primary)
                            .lineLimit(20)
                    }
                    if !run.stderr.isEmpty {
                        Text(run.stderr)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.orange)
                            .lineLimit(10)
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
