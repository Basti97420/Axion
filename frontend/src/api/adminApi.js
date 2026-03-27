import client from './client'

export const adminApi = {
  getUsers:   ()         => client.get('/admin/users'),
  createUser: (data)     => client.post('/admin/users', data),
  updateUser: (id, data) => client.put(`/admin/users/${id}`, data),
  deleteUser: (id)       => client.delete(`/admin/users/${id}`),
}
