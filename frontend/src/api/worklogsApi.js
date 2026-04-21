import client from './client'

export const worklogsApi = {
  getProjectWorklogs: (projectId, weeks = 4) =>
    client.get(`/projects/${projectId}/worklogs`, { params: { weeks } }),
  getPending: ()    => client.get('/worklogs/pending'),
  confirm:    (id)  => client.post(`/worklogs/${id}/confirm`),
  remove:     (id)  => client.delete(`/worklogs/${id}`),
}
