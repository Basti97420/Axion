import { Outlet, useLocation, useParams } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import AiChatPanel from '../ai/AiChatPanel'
import Toast from './Toast'
import ConfirmDialog from './ConfirmDialog'
import { projectsApi } from '../../api/projectsApi'
import { useProjectStore } from '../../store/projectStore'
import { userSettingsApi } from '../../api/userSettingsApi'
import { setUserTimezone } from '../../utils/dateUtils'

function GlobalDragOverlay() {
  const [visible, setVisible] = useState(false)
  const dragCount = useRef(0)
  const location = useLocation()

  useEffect(() => {
    function onEnter(e) {
      if (!e.dataTransfer?.types?.includes('Files')) return
      dragCount.current++
      setVisible(true)
    }
    function onLeave() {
      dragCount.current = Math.max(0, dragCount.current - 1)
      if (dragCount.current === 0) setVisible(false)
    }
    function onDrop() {
      dragCount.current = 0
      setVisible(false)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  // Hinweistext je nach aktueller Route
  function hint() {
    const p = location.pathname
    if (p.match(/\/issues\/\d+/))  return '📎 Datei auf dem Issue ablegen zum Hochladen'
    if (p.match(/\/knowledge\//))  return '🖼 Datei im Knowledge-Editor ablegen zum Einbetten'
    if (p.match(/\/python-scripts/)) return '🐍 .py-Datei auf den Editor ziehen zum Importieren'
    return '📁 Navigiere zu einem Issue oder Knowledge, um Dateien hochzuladen'
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[8888] pointer-events-none flex items-end justify-center pb-8">
      <div className="bg-gray-900/80 text-white text-sm px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-sm">
        {hint()}
      </div>
    </div>
  )
}

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
      <GlobalDragOverlay />
      <Toast />
      <ConfirmDialog />
    </div>
  )
}
