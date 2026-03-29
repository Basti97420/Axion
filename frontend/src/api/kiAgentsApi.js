import client from './client'

export const kiAgentsApi = {
  getAll:     (projectId) => client.get(`/projects/${projectId}/ki-agents`),
  create:     (projectId, data) => client.post(`/projects/${projectId}/ki-agents`, data),
  get:        (id) => client.get(`/ki-agents/${id}`),
  update:     (id, data) => client.put(`/ki-agents/${id}`, data),
  remove:     (id) => client.delete(`/ki-agents/${id}`),
  run:        (id) => client.post(`/ki-agents/${id}/run`),
  getRuns:    (id) => client.get(`/ki-agents/${id}/runs`),
  getFiles:   (id) => client.get(`/ki-agents/${id}/files`),
  deleteFile: (id, filename) => client.delete(`/ki-agents/${id}/files/${encodeURIComponent(filename)}`),
  fileUrl:    (id, filename) => `/api/ki-agents/${id}/files/${encodeURIComponent(filename)}`,
  getPrompt:  (id) => client.get(`/ki-agents/${id}/prompt`),
  savePrompt: (id, content) => client.put(`/ki-agents/${id}/prompt`, { content }),
}
