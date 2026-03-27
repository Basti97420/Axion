import client from './client'

export const userSettingsApi = {
  get: () => client.get('/user/settings'),
  save: (data) => client.put('/user/settings', data),
}
