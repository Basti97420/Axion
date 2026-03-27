import client from './client'

export const telegramSettingsApi = {
  get:  ()     => client.get('/admin/settings/telegram'),
  save: (data) => client.put('/admin/settings/telegram', data),
}
