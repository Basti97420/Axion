import SwiftUI

struct AIChatView: View {
    var projectId: Int? = nil

    @State private var messages: [ChatMessage] = []
    @State private var inputText: String = ""
    @State private var isLoading: Bool = false
    @State private var aiAvailable: Bool? = nil
    @State private var providerName: String = ""

    var body: some View {
        VStack(spacing: 0) {
            // Status bar
            HStack(spacing: 6) {
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                Text(statusLabel)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(Color(.secondarySystemBackground))

            Divider()

            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        if messages.isEmpty {
                            VStack(spacing: 8) {
                                Image(systemName: "bubble.left.and.bubble.right")
                                    .font(.largeTitle)
                                    .foregroundColor(.secondary)
                                Text("Frag den KI-Assistenten")
                                    .foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.top, 60)
                        }

                        ForEach(messages) { msg in
                            ChatBubble(message: msg)
                                .id(msg.id)
                        }
                    }
                    .padding(16)
                }
                .onChange(of: messages.count) { _ in
                    if let last = messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }

            Divider()

            // Input
            HStack(spacing: 10) {
                TextField("Nachricht…", text: $inputText, axis: .vertical)
                    .lineLimit(1...5)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color(.systemFill))
                    .cornerRadius(20)

                Button(action: send) {
                    Image(systemName: isLoading ? "ellipsis" : "arrow.up.circle.fill")
                        .font(.system(size: 30))
                        .foregroundColor(canSend ? .indigo : .gray)
                }
                .disabled(!canSend)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color(.secondarySystemBackground))
        }
        .navigationTitle("KI-Chat")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { checkStatus() }
    }

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading
    }

    private var statusColor: Color {
        guard let available = aiAvailable else { return .gray }
        return available ? .green : .red
    }

    private var statusLabel: String {
        guard let available = aiAvailable else { return "Status wird geladen…" }
        if available { return providerName.isEmpty ? "Verfügbar" : "\(providerName) · Verfügbar" }
        return "Nicht verfügbar"
    }

    private func checkStatus() {
        Task {
            do {
                let status = try await AIService.getStatus()
                await MainActor.run {
                    aiAvailable = status.available
                    providerName = status.provider ?? ""
                }
            } catch {
                await MainActor.run { aiAvailable = false }
            }
        }
    }

    private func send() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        inputText = ""
        isLoading = true

        let userMsg = ChatMessage(role: .user, content: text)
        messages.append(userMsg)
        let loadingMsg = ChatMessage(role: .assistant, content: "", isLoading: true)
        messages.append(loadingMsg)

        // Build API messages
        let apiMessages = messages.dropLast().map { m in
            APIChatMessage(role: m.role.rawValue, content: m.content)
        }

        Task {
            do {
                let response = try await AIService.chat(messages: Array(apiMessages), projectId: projectId)
                await MainActor.run {
                    messages.removeLast() // remove loading
                    messages.append(ChatMessage(role: .assistant, content: response.reply))
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    messages.removeLast()
                    messages.append(ChatMessage(role: .assistant, content: "Fehler: \(error.localizedDescription)"))
                    isLoading = false
                }
            }
        }
    }
}

struct ChatBubble: View {
    let message: ChatMessage

    var isUser: Bool { message.role == .user }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if isUser { Spacer(minLength: 40) }

            if !isUser {
                ZStack {
                    Circle().fill(Color.indigo.opacity(0.15)).frame(width: 28, height: 28)
                    Text("⚡").font(.caption)
                }
            }

            if message.isLoading {
                HStack(spacing: 4) {
                    ForEach(0..<3, id: \.self) { i in
                        Circle()
                            .fill(Color.secondary)
                            .frame(width: 6, height: 6)
                            .opacity(0.5)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color(.secondarySystemGroupedBackground))
                .cornerRadius(18)
            } else {
                Text(message.content)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(isUser ? Color.indigo : Color(.secondarySystemGroupedBackground))
                    .foregroundColor(isUser ? .white : .primary)
                    .cornerRadius(18)
                    .cornerRadius(isUser ? 4 : 18, corners: isUser ? .bottomRight : .bottomLeft)
            }

            if !isUser { Spacer(minLength: 40) }
        }
    }
}

// Helper for selective corner radius
extension View {
    func cornerRadius(_ radius: CGFloat, corners: UIRectCorner) -> some View {
        clipShape(RoundedCorner(radius: radius, corners: corners))
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat
    var corners: UIRectCorner

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}
