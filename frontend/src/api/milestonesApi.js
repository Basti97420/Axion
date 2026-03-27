import client from './client'

export const milestonesApi = {
  getAll:  (projectId)       => client.get(`/projects/${projectId}/milestones`),
  getOne:  (id)              => client.get(`/milestones/${id}`),
  create:  (projectId, data) => client.post(`/projects/${projectId}/milestones`, data),
  update:  (id, data)        => client.put(`/milestones/${id}`, data),
  remove:  (id)              => client.delete(`/milestones/${id}`),
}
