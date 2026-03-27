import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import AiChatPanel from '../ai/AiChatPanel'
import { projectsApi } from '../../api/projectsApi'
import { useProjectStore } from '../../store/projectStore'
import { userSettingsApi } from '../../api/userSettingsApi'
import { setUserTimezone } from '../../utils/dateUtils'

export default function Layout() {
  const setProjects = useProjectStore((s) => s.setProjects)
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem('sidebar') !== 'closed'
  )

  useEffect(() => {
    projectsApi.getAll()
      .then(({ data }) => setProjects(data))
      .catch(() => {})
    userSettingsApi.get()
      .then(({ data }) => setUserTimezone(data.timezone))
      .catch(() => {})
  }, [setProjects])

  function toggleSidebar() {
    setSidebarOpen((v) => {
      const next = !v
      localStorage.setItem('sidebar', next ? 'open' : 'closed')
      return next
    })
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar onToggleSidebar={toggleSidebar} />
      <div className="flex flex-1 overflow-hidden">
        <div className={`${sidebarOpen ? 'w-56' : 'w-0'} shrink-0 overflow-hidden transition-all duration-200`}>
          <Sidebar />
        </div>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <AiChatPanel />
    </div>
  )
}
