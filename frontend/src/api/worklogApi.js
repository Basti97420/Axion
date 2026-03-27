import client from './client'

export const worklogApi = {
  getAll:   (issueId)         => client.get(`/issues/${issueId}/worklogs`),
  create:   (issueId, data)   => client.post(`/issues/${issueId}/worklogs`, data),
  update:   (worklogId, data) => client.put(`/worklogs/${worklogId}`, data),
  remove:   (worklogId)       => client.delete(`/worklogs/${worklogId}`),
  summary:  (params)          => client.get('/worklog/summary', { params }),
}
