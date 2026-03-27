import client from './client'

export const settingsApi = {
  getAiConfig:      ()     => client.get('/admin/settings/ai'),
  saveAiConfig:     (data) => client.put('/admin/settings/ai', data),
  getTelegramConfig:()     => client.get('/admin/settings/telegram'),
  saveTelegramConfig:(data)=> client.put('/admin/settings/telegram', data),
  getIcloudConfig:  ()     => client.get('/admin/settings/icloud'),
  saveIcloudConfig: (data) => client.put('/admin/settings/icloud', data),
}
