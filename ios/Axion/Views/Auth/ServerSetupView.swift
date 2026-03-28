import SwiftUI

struct ServerSetupView: View {
    @EnvironmentObject var appState: AppState
    @State private var urlInput: String = ""
    @State private var error: String? = nil

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 32) {
                // Logo
                VStack(spacing: 8) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 20)
                            .fill(Color.indigo)
                            .frame(width: 72, height: 72)
                        Text("⚡")
                            .font(.system(size: 36))
                    }
                    Text("Axion")
                        .font(.system(size: 28, weight: .bold))
                    Text("Server konfigurieren")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Server-URL")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)
                        .textCase(.uppercase)
                    TextField("http://192.168.1.10:65443", text: $urlInput)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.URL)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    if let error = error {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                    }

                    Text("IP-Adresse und Port deines Axion-Servers im lokalen Netzwerk.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 4)

                Button(action: save) {
                    Text("Weiter")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.indigo)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
                .disabled(urlInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(.horizontal, 32)

            Spacer()
        }
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
    }

    private func save() {
        let url = urlInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !url.isEmpty else {
            error = "Bitte eine URL eingeben."
            return
        }
        guard url.hasPrefix("http://") || url.hasPrefix("https://") else {
            error = "URL muss mit http:// oder https:// beginnen."
            return
        }
        error = nil
        appState.configureServer(url)
    }
}
