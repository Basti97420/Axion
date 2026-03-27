import axios from 'axios'

const client = axios.create({
  baseURL: '/api/wiki',
  withCredentials: true,  // main-api hat @login_required auf Wiki-Routen
})

export const wikiApi = {
  listPages: (params) => client.get('/pages', { params }),
  createPage: (data) => client.post('/pages', data),
  getPage: (slug) => client.get(`/pages/${slug}`),
  updatePage: (slug, data) => client.put(`/pages/${slug}`, data),
  deletePage: (slug) => client.delete(`/pages/${slug}`),
  getChildren: (slug) => client.get(`/pages/${slug}/children`),
  search: (q, projectId) => client.get('/search', { params: { q, project_id: projectId } }),

  uploadAttachment: (slug, file) => {
    const fd = new FormData()
    fd.append('file', file)
    return client.post(`/pages/${slug}/attachments`, fd)
  },
  getAttachmentUrl: (id) => `/api/wiki/attachments/${id}`,
  deleteAttachment: (id) => client.delete(`/attachments/${id}`),
}
