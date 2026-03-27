import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import ProjectPage from './pages/ProjectPage'
import IssuePage from './pages/IssuePage'
import WikiIndexPage from './pages/WikiIndexPage'
import WikiSlugPage from './pages/WikiSlugPage'
import CalendarPage from './pages/CalendarPage'
import KiAgentsPage from './pages/KiAgentsPage'
import PythonScriptsPage from './pages/PythonScriptsPage'
import AdminUsersPage from './pages/AdminUsersPage'
import UserSettingsPage from './pages/UserSettingsPage'
import Layout from './components/common/Layout'

function PrivateRoute({ children }) {
  const user = useAuthStore((s) => s.user)
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="projects/:projectId" element={<ProjectPage />} />
        <Route path="projects/:projectId/issues/:issueId" element={<IssuePage />} />
        <Route path="projects/:projectId/calendar" element={<CalendarPage />} />
        <Route path="projects/:projectId/ki-agents" element={<KiAgentsPage />} />
        <Route path="projects/:projectId/python-scripts" element={<PythonScriptsPage />} />
        <Route path="wiki" element={<WikiIndexPage />} />
        <Route path="wiki/:slug" element={<WikiSlugPage />} />
        <Route path="admin/users" element={<AdminUsersPage />} />
        <Route path="settings" element={<UserSettingsPage />} />
      </Route>
    </Routes>
  )
}
