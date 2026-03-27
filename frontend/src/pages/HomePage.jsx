import { useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { projectsApi } from '../api/projectsApi'
import ProjectGrid from '../components/projects/ProjectGrid'
import ProjectForm from '../components/projects/ProjectForm'
import Modal from '../components/common/Modal'

export default function HomePage() {
  const projects = useProjectStore((s) => s.projects)
  const { upsertProject, removeProject } = useProjectStore()
  const [modal, setModal] = useState(null) // null | 'create' | {project}
  const [loading, setLoading] = useState(false)

  async function handleCreate(data) {
    setLoading(true)
    try {
      const { data: project } = await projectsApi.create(data)
      upsertProject(project)
      setModal(null)
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Erstellen')
    } finally {
      setLoading(false)
    }
  }

  async function handleEdit(data) {
    setLoading(true)
    try {
      const { data: project } = await projectsApi.update(modal.id, data)
      upsertProject(project)
      setModal(null)
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(project) {
    if (!confirm(`Projekt "${project.name}" wirklich löschen? Alle Issues werden ebenfalls gelöscht.`)) return
    await projectsApi.remove(project.id)
    removeProject(project.id)
  }

  const isEdit = modal && modal !== 'create'

  return (
    <div className="p-6">
      <ProjectGrid
        projects={projects}
        onNew={() => setModal('create')}
        onEdit={(p) => setModal(p)}
        onDelete={handleDelete}
      />

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={isEdit ? 'Projekt bearbeiten' : 'Neues Projekt'}
      >
        <ProjectForm
          initial={isEdit ? modal : {}}
          onSubmit={isEdit ? handleEdit : handleCreate}
          onCancel={() => setModal(null)}
          loading={loading}
        />
      </Modal>
    </div>
  )
}
