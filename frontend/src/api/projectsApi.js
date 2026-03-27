import client from './client'

export const projectsApi = {
  getAll:    ()           => client.get('/projects'),
  getOne:    (id)         => client.get(`/projects/${id}`),
  create:    (data)       => client.post('/projects', data),
  update:    (id, data)   => client.put(`/projects/${id}`, data),
  remove:    (id)         => client.delete(`/projects/${id}`),
  getIssues: (id)         => client.get(`/projects/${id}/issues`),
  getLog:    (id)         => client.get(`/projects/${id}/log`),
}
