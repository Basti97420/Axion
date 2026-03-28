import SwiftUI

struct WikiListView: View {
    @State private var pages: [WikiPage] = []
    @State private var isLoading: Bool = true
    @State private var error: String? = nil
    @State private var searchText: String = ""

    // Flache, geordnete Liste mit Einrückungstiefe – vermeidet rekursive @ViewBuilder
    private var orderedPages: [(page: WikiPage, depth: Int)] {
        var result: [(WikiPage, Int)] = []
        func addChildren(parentId: Int?, depth: Int) {
            let children = pages.filter { $0.parentId == parentId }
            for child in children {
                result.append((child, depth))
                addChildren(parentId: child.id, depth: depth + 1)
            }
        }
        addChildren(parentId: nil, depth: 0)
        return result
    }

    private var filtered: [(page: WikiPage, depth: Int)] {
        if searchText.isEmpty { return orderedPages }
        return orderedPages.filter { $0.page.title.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Wiki laden…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = error {
                VStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.largeTitle)
                        .foregroundColor(.orange)
                    Text(error)
                    Button("Erneut versuchen") { load() }
                        .buttonStyle(.bordered)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if pages.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "doc.text")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("Keine Wiki-Seiten")
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(filtered, id: \.page.id) { item in
                    wikiRow(item.page, depth: item.depth)
                }
                .listStyle(.insetGrouped)
                .searchable(text: $searchText, prompt: "Wiki durchsuchen")
            }
        }
        .navigationTitle("Wiki")
        .refreshable { load() }
        .onAppear { load() }
    }

    private func wikiRow(_ page: WikiPage, depth: Int) -> some View {
        NavigationLink(destination: WikiPageView(slug: page.slug, title: page.title)) {
            HStack(spacing: 8) {
                if depth > 0 {
                    Color.clear.frame(width: CGFloat(depth) * 16)
                    Image(systemName: "arrow.turn.down.right")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                Image(systemName: "doc.text")
                    .font(.caption)
                    .foregroundColor(.indigo)
                Text(page.title)
                    .font(.subheadline)
            }
        }
    }

    private func load() {
        isLoading = true
        error = nil
        Task {
            do {
                let data = try await WikiService.getPages()
                await MainActor.run {
                    pages = data
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.error = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}
