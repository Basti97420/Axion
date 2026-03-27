import client from './client'

export const aiApi = {
  getStatus: () => client.get('/ai/status'),
  chat: (data) => client.post('/ai/chat', data),
}
