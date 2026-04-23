import client from './client'

export const chatWorkspaceApi = {
  listFiles:  ()                     => client.get('/workspace/files'),
  getFile:    (filename)             => client.get(`/workspace/files/${encodeURIComponent(filename)}`),
  saveFile:   (filename, content)    => client.put(`/workspace/files/${encodeURIComponent(filename)}`, { content }),
  deleteFile: (filename)             => client.delete(`/workspace/files/${encodeURIComponent(filename)}`),
}
