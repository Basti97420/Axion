import SwiftUI

struct PriorityPickerSheet: View {
    let issue: Issue
    let onSelect: (IssuePriority) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(IssuePriority.allCases, id: \.self) { priority in
                    Button {
                        onSelect(priority)
                        dismiss()
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: priority.icon)
                                .foregroundColor(priority.color)
                                .frame(width: 20)
                            Text(priority.label)
                                .foregroundColor(.primary)
                            Spacer()
                            if issue.priority == priority {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.indigo)
                                    .fontWeight(.semibold)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Priorität setzen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}
