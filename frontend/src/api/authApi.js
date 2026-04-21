import client from './client'

export const authApi = {
  login:          (name, password, remember = false) => client.post('/auth/login', { name, password, remember }),
  logout:         ()               => client.post('/auth/logout'),
  me:             ()               => client.get('/auth/me'),
  setupInfo:      ()               => client.get('/auth/setup-info'),
  changePassword: (data)           => client.patch('/auth/password', data),
}
