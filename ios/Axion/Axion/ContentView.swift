import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        Group {
            if !appState.isServerConfigured {
                ServerSetupView()
            } else if !appState.isLoggedIn {
                LoginView()
            } else {
                MainTabView()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: appState.isLoggedIn)
        .animation(.easeInOut(duration: 0.2), value: appState.isServerConfigured)
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            NavigationStack {
                ProjectListView()
            }
            .tabItem {
                Label("Projekte", systemImage: "folder")
            }

            NavigationStack {
                WikiListView()
            }
            .tabItem {
                Label("Wiki", systemImage: "doc.text")
            }

            NavigationStack {
                AIChatView()
            }
            .tabItem {
                Label("KI-Chat", systemImage: "bubble.left.and.bubble.right")
            }

            NavigationStack {
                SettingsView()
            }
            .tabItem {
                Label("Einstellungen", systemImage: "gear")
            }
        }
        .tint(.indigo)
    }
}
