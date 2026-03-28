import SwiftUI

struct StatusPickerSheet: View {
    let issue: Issue
    let onSelect: (IssueStatus) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach(IssueStatus.allCases, id: \.self) { status in
                    Button {
                        onSelect(status)
                        dismiss()
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: status.icon)
                                .foregroundColor(status.color)
                                .frame(width: 20)
                            Text(status.label)
                                .foregroundColor(.primary)
                            Spacer()
                            if issue.status == status {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.indigo)
                                    .fontWeight(.semibold)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Status setzen")
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
