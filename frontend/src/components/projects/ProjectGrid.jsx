import ProjectCard from './ProjectCard'
import Button from '../common/Button'

export default function ProjectGrid({ projects, onNew, onEdit, onDelete }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Projekte</h2>
        <Button size="sm" onClick={onNew}>+ Neues Projekt</Button>
      </div>
      {projects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base mb-3">Noch keine Projekte</p>
          <Button size="sm" onClick={onNew}>Erstes Projekt anlegen</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
