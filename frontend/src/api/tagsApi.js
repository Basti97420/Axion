import client from './client'

export const tagsApi = {
  getAll:         (params)        => client.get('/tags', { params }),
  create:         (data)          => client.post('/tags', data),
  update:         (id, data)      => client.put(`/tags/${id}`, data),
  remove:         (id)            => client.delete(`/tags/${id}`),
  addToIssue:     (issueId, tagId)    => client.post(`/tags/issues/${issueId}/tags`, { tag_id: tagId }),
  removeFromIssue:(issueId, tagId)    => client.delete(`/tags/issues/${issueId}/tags/${tagId}`),
}
