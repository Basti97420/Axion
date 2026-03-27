import client from './client'

export const pythonScriptsApi = {
  getAll:   (projectId) => client.get(`/projects/${projectId}/python-scripts`),
  create:   (projectId, data) => client.post(`/projects/${projectId}/python-scripts`, data),
  get:      (id) => client.get(`/python-scripts/${id}`),
  update:   (id, data) => client.put(`/python-scripts/${id}`, data),
  remove:   (id) => client.delete(`/python-scripts/${id}`),
  run:      (id) => client.post(`/python-scripts/${id}/run`),
  runCells: (id, data) => client.post(`/python-scripts/${id}/run-cells`, data),
  getRuns:  (id) => client.get(`/python-scripts/${id}/runs`),
}
