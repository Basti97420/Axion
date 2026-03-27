import client from './client'

export const issuesApi = {
  getAll:       (params)        => client.get('/issues', { params }),
  getOne:       (id)            => client.get(`/issues/${id}`),
  create:       (data)          => client.post('/issues', data),
  update:       (id, data)      => client.put(`/issues/${id}`, data),
  remove:       (id, deleteSubtasks = false) => client.delete(`/issues/${id}`, { params: deleteSubtasks ? { delete_subtasks: 'true' } : {} }),
  patchStatus:   (id, status)    => client.patch(`/issues/${id}/status`, { status }),
  patchPriority: (id, priority)  => client.patch(`/issues/${id}/priority`, { priority }),
  patchDueDate:  (id, due_date)  => client.patch(`/issues/${id}/due_date`, { due_date }),
  getSubtasks:  (id)            => client.get(`/issues/${id}/subtasks`),
  getActivity:  (id)            => client.get(`/issues/${id}/activity`),
  getComments:  (id)            => client.get(`/issues/${id}/comments`),
  addComment:   (id, content)   => client.post(`/issues/${id}/comments`, { content }),
  deleteComment:   (id, cid)            => client.delete(`/issues/${id}/comments/${cid}`),
  getDependencies: (id)                 => client.get(`/issues/${id}/dependencies`),
  addDependency:   (id, data)           => client.post(`/issues/${id}/dependencies`, data),
  removeDependency:  (id, targetId, type) => client.delete(`/issues/${id}/dependencies/${targetId}`, { params: { type } }),
  revertActivity:    (issueId, activityId) => client.post(`/issues/${issueId}/activity/${activityId}/revert`),
}
