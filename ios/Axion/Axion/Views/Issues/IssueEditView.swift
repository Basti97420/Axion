import SwiftUI

struct IssueEditView: View {
    let issue: Issue
    let onSaved: (Issue) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var title: String
    @State private var description: String
    @State private var type: IssueType
    @State private var dueDate: Date?
    @State private var hasDueDate: Bool
    @State private var estimatedHours: String
    @State private var isSaving: Bool = false
    @State private var error: String? = nil

    init(issue: Issue, onSaved: @escaping (Issue) -> Void) {
        self.issue = issue
        self.onSaved = onSaved
        _title = State(initialValue: issue.title)
        _description = State(initialValue: issue.description ?? "")
        _type = State(initialValue: issue.type)
        _estimatedHours = State(initialValue: issue.estimatedHours.map { String(format: "%.1f", $0) } ?? "")
        if let due = issue.dueDate {
            let f = ISO8601DateFormatter()
            f.formatOptions = [.withFullDate]
            let parsed = f.date(from: due)
            _dueDate = State(initialValue: parsed ?? Date())
            _hasDueDate = State(initialValue: parsed != nil)
        } else {
            _dueDate = State(initialValue: Date())
            _hasDueDate = State(initialValue: false)
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("Allgemein")) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Titel")
                            .font(.caption).foregroundColor(.secondary)
                        TextField("Titel", text: $title)
                    }

                    Picker("Typ", selection: $type) {
                        ForEach(IssueType.allCases, id: \.self) { t in
                            Label(t.label, systemImage: t.icon).tag(t)
                        }
                    }
                }

                Section(header: Text("Beschreibung")) {
                    TextEditor(text: $description)
                        .frame(minHeight: 100)
                        .font(.body)
                }

                Section(header: Text("Planung")) {
                    Toggle("Fälligkeitsdatum", isOn: $hasDueDate)
                    if hasDueDate {
                        DatePicker(
                            "Datum",
                            selection: Binding(
                                get: { dueDate ?? Date() },
                                set: { dueDate = $0 }
                            ),
                            displayedComponents: .date
                        )
                        .environment(\.locale, Locale(identifier: "de_DE"))
                    }

                    HStack {
                        Text("Geschätzte Stunden")
                        Spacer()
                        TextField("0.0", text: $estimatedHours)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 70)
                    }
                }

                if let error = error {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("Issue bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: save) {
                        if isSaving {
                            ProgressView().scaleEffect(0.8)
                        } else {
                            Text("Speichern").fontWeight(.semibold)
                        }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
    }

    private func save() {
        let cleanTitle = title.trimmingCharacters(in: .whitespaces)
        guard !cleanTitle.isEmpty else { return }
        isSaving = true
        error = nil

        var dueDateStr: String? = nil
        if hasDueDate, let d = dueDate {
            let f = ISO8601DateFormatter()
            f.formatOptions = [.withFullDate]
            dueDateStr = f.string(from: d)
        }
        let hours = Double(estimatedHours.replacingOccurrences(of: ",", with: "."))

        let body = IssueUpdateRequest(
            title: cleanTitle,
            description: description,
            type: type.rawValue,
            dueDate: dueDateStr,
            estimatedHours: hours
        )

        Task {
            do {
                let updated = try await IssueService.updateIssue(issueId: issue.id, body: body)
                await MainActor.run {
                    onSaved(updated)
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    isSaving = false
                }
            }
        }
    }
}
