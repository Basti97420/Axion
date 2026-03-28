import SwiftUI

struct ProjectDetailView: View {
    let project: Project
    @State private var selectedTab: Int = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            IssueListView(project: project)
                .tabItem { Label("Issues", systemImage: "list.bullet") }
                .tag(0)

            KiAgentsListView(project: project)
                .tabItem { Label("Agenten", systemImage: "cpu") }
                .tag(1)

            PythonScriptsListView(project: project)
                .tabItem { Label("Scripts", systemImage: "terminal") }
                .tag(2)
        }
        .navigationTitle(project.name)
        .navigationBarTitleDisplayMode(.inline)
        .tint(.indigo)
    }
}
