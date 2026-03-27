import client from './client'

export const attachmentsApi = {
  getList: (issueId) => client.get(`/issues/${issueId}/attachments`),

  upload: (issueId, file) => {
    const form = new FormData()
    form.append('file', file)
    return client.post(`/issues/${issueId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  download: (id) => {
    window.open(`/api/attachments/${id}/download`, '_blank')
  },

  previewUrl: (id) => `/api/attachments/${id}/preview`,

  remove: (id) => client.delete(`/attachments/${id}`),
}
