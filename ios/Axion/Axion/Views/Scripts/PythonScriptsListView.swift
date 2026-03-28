import SwiftUI

struct PythonScriptsListView: View {
    let project: Project

    @State private var scripts: [PythonScript] = []
    @State private var isLoading: Bool = true
    @State private var error: String? = nil

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Scripts laden…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = error {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle).foregroundColor(.orange)
                    Text(error).multilineTextAlignment(.center)
                    Button("Erneut versuchen") { load() }.buttonStyle(.bordered)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if scripts.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "terminal")
                        .font(.largeTitle).foregroundColor(.secondary)
                    Text("Keine Scripts").foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(scripts) { script in
                    NavigationLink(destination: PythonScriptDetailView(script: script)) {
                        ScriptRowView(script: script)
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
                let data = try await PythonScriptService.getScripts(projectId: project.id)
                await MainActor.run { scripts = data; isLoading = false }
            } catch {
                await MainActor.run { self.error = error.localizedDescription; isLoading = false }
            }
        }
    }
}

struct ScriptRowView: View {
    let script: PythonScript

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Circle()
                    .fill(script.isActive ? Color.green : Color.gray)
                    .frame(width: 8, height: 8)
                Text(script.name)
                    .fontWeight(.medium).lineLimit(1)
                if script.hasNotebook {
                    Text("NB")
                        .font(.caption2).fontWeight(.bold)
                        .foregroundColor(.orange)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(Color.orange.opacity(0.12))
                        .cornerRadius(4)
                }
                Spacer()
                Text("#\(script.id)")
                    .font(.caption2).foregroundColor(.secondary)
                    .fontDesign(.monospaced)
            }
            if !script.description.isEmpty {
                Text(script.description)
                    .font(.caption).foregroundColor(.secondary).lineLimit(1)
            }
            HStack(spacing: 4) {
                Image(systemName: script.scheduleType == "interval" ? "clock" : "hand.tap")
                    .font(.caption2).foregroundColor(.secondary)
                Text(script.scheduleType == "interval" ? "alle \(script.intervalMin) Min" : "Manuell")
                    .font(.caption).foregroundColor(.secondary)
                if let last = script.lastRunAt {
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
