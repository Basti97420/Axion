import client from './client'

export const projectsApi = {
  getAll:    ()           => client.get('/projects'),
  getOne:    (id)         => client.get(`/projects/${id}`),
  create:    (data)       => client.post('/projects', data),
  update:    (id, data)   => client.put(`/projects/${id}`, data),
  remove:    (id)         => client.delete(`/projects/${id}`),
  getIssues: (id)         => client.get(`/projects/${id}/issues`),
  getLog:    (id)         => client.get(`/projects/${id}/log`),

  // Status-CRUD
  getStatuses:    (id)              => client.get(`/projects/${id}/statuses`),
  createStatus:   (id, data)        => client.post(`/projects/${id}/statuses`, data),
  updateStatus:   (id, sid, data)   => client.put(`/projects/${id}/statuses/${sid}`, data),
  deleteStatus:   (id, sid)         => client.delete(`/projects/${id}/statuses/${sid}`),
}
