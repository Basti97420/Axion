import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @State private var urlInput: String = ""
    @State private var showLogoutConfirm: Bool = false
    @State private var showSaved: Bool = false

    var body: some View {
        Form {
            Section {
                HStack(spacing: 12) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.indigo)
                            .frame(width: 40, height: 40)
                        Text("⚡")
                            .font(.title3)
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text(appState.currentUser?.name ?? "–")
                            .fontWeight(.semibold)
                        Text(appState.currentUser?.isAdmin == true ? "Administrator" : "Benutzer")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }

            Section(header: Text("Server")) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Server-URL")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    TextField("http://...", text: $urlInput)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                }

                Button("URL speichern") {
                    appState.configureServer(urlInput)
                    showSaved = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { showSaved = false }
                }
                .disabled(urlInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                if showSaved {
                    Label("Gespeichert", systemImage: "checkmark.circle.fill")
                        .foregroundColor(.green)
                        .font(.caption)
                }
            }

            Section {
                Button(role: .destructive) {
                    showLogoutConfirm = true
                } label: {
                    Label("Abmelden", systemImage: "arrow.right.square")
                }
            }
        }
        .navigationTitle("Einstellungen")
        .onAppear { urlInput = appState.serverURL }
        .confirmationDialog("Wirklich abmelden?", isPresented: $showLogoutConfirm) {
            Button("Abmelden", role: .destructive) {
                Task {
                    try? await AuthService.logout()
                    await MainActor.run { appState.logout() }
                }
            }
            Button("Abbrechen", role: .cancel) {}
        }
    }
}
