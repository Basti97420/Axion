import { NavLink, useLocation } from 'react-router-dom'
import { useProjectStore } from '../../store/projectStore'

export default function Sidebar() {
  const projects = useProjectStore((s) => s.projects)
  const location = useLocation()

  const navItem = 'flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors'
  const activeNavItem = 'bg-primary-50 text-primary-700 font-medium'

  function isViewActive(projectId, view) {
    return (
      location.pathname === `/projects/${projectId}` &&
      new URLSearchParams(location.search).get('view') === view
    )
  }

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col py-3 overflow-y-auto">
      {/* Hauptnavigation */}
      <nav className="px-2 space-y-0.5">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `${navItem} ${isActive ? activeNavItem : ''}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
          </svg>
          Projekte
        </NavLink>
        <NavLink
          to="/knowledge"
          className={({ isActive }) => `${navItem} ${isActive ? activeNavItem : ''}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          Knowledge
        </NavLink>
      </nav>

      {/* Projekt-Liste */}
      {projects.length > 0 && (
        <>
          <div className="mt-4 px-4 mb-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Projekte</span>
          </div>
          <nav className="px-2 space-y-0.5">
            {projects.map((project) => (
              <div key={project.id}>
                <NavLink
                  to={`/projects/${project.id}`}
                  end
                  className={({ isActive }) => `${navItem} ${isActive ? activeNavItem : ''}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="truncate">{project.name}</span>
                </NavLink>
                <NavLink
                  to={`/projects/${project.id}?view=kanban`}
                  className={`${navItem} pl-7 text-xs ${isViewActive(project.id, 'kanban') ? activeNavItem : 'text-gray-400'}`}
                >
                  📋 Kanban
                </NavLink>
                <NavLink
                  to={`/projects/${project.id}?view=activity`}
                  className={`${navItem} pl-7 text-xs ${isViewActive(project.id, 'activity') ? activeNavItem : 'text-gray-400'}`}
                >
                  📊 Aktivität
                </NavLink>
                <NavLink
                  to={`/projects/${project.id}?view=milestones`}
                  className={`${navItem} pl-7 text-xs ${isViewActive(project.id, 'milestones') ? activeNavItem : 'text-gray-400'}`}
                >
                  🏁 Meilensteine
                </NavLink>
                <NavLink
                  to={`/projects/${project.id}?view=worklogs`}
                  className={`${navItem} pl-7 text-xs ${isViewActive(project.id, 'worklogs') ? activeNavItem : 'text-gray-400'}`}
                >
                  ⏱ Zeiterfassung
                </NavLink>
                <NavLink
                  to={`/projects/${project.id}/calendar`}
                  className={({ isActive }) => `${navItem} pl-7 text-xs ${isActive ? activeNavItem : 'text-gray-400'}`}
                >
                  📅 Kalender
                </NavLink>
                <NavLink
                  to={`/projects/${project.id}/ki-agents`}
                  className={({ isActive }) => `${navItem} pl-7 text-xs ${isActive ? activeNavItem : 'text-gray-400'}`}
                >
                  🤖 Agenten
                </NavLink>
                <NavLink
                  to={`/projects/${project.id}/python-scripts`}
                  className={({ isActive }) => `${navItem} pl-7 text-xs ${isActive ? activeNavItem : 'text-gray-400'}`}
                >
                  🐍 Python Scripts
                </NavLink>
              </div>
            ))}
          </nav>
        </>
      )}
    </aside>
  )
}
