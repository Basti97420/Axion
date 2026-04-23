import client from './client'

export const chatWorkspaceApi = {
  listFiles:  ()                     => client.get('/ai/chat-workspace/files'),
  getFile:    (filename)             => client.get(`/ai/chat-workspace/files/${encodeURIComponent(filename)}`),
  saveFile:   (filename, content)    => client.put(`/ai/chat-workspace/files/${encodeURIComponent(filename)}`, { content }),
  deleteFile: (filename)             => client.delete(`/ai/chat-workspace/files/${encodeURIComponent(filename)}`),
}
