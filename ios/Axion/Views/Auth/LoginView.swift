import SwiftUI

struct LoginView: View {
    @EnvironmentObject var appState: AppState
    @State private var username: String = ""
    @State private var password: String = ""
    @State private var isLoading: Bool = false
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
                    Text(appState.serverURL)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }

                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Benutzername")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .textCase(.uppercase)
                        TextField("admin", text: $username)
                            .textFieldStyle(.roundedBorder)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Passwort")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                            .textCase(.uppercase)
                        SecureField("Passwort", text: $password)
                            .textFieldStyle(.roundedBorder)
                    }

                    if let error = error {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.horizontal, 4)

                Button(action: doLogin) {
                    HStack {
                        if isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .scaleEffect(0.8)
                        }
                        Text("Anmelden")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.indigo)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .disabled(isLoading || username.isEmpty || password.isEmpty)

                Button {
                    appState.configureServer("")
                } label: {
                    Text("Server ändern")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.horizontal, 32)

            Spacer()
        }
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
    }

    private func doLogin() {
        isLoading = true
        error = nil
        Task {
            do {
                let user = try await AuthService.login(name: username, password: password)
                await MainActor.run { appState.login(user: user) }
            } catch let e as APIError {
                await MainActor.run {
                    error = e.errorDescription ?? "Anmeldefehler"
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.error = "Verbindung fehlgeschlagen"
                    isLoading = false
                }
            }
        }
    }
}
