import client from './client'

export const settingsApi = {
  getAiConfig:       ()         => client.get('/admin/settings/ai'),
  saveAiConfig:      (data)     => client.put('/admin/settings/ai', data),
  getTelegramConfig: ()         => client.get('/admin/settings/telegram'),
  saveTelegramConfig:(data)     => client.put('/admin/settings/telegram', data),
  getIcloudConfig:   ()         => client.get('/admin/settings/icloud'),
  saveIcloudConfig:  (data)     => client.put('/admin/settings/icloud', data),

  // Backup
  getBackupConfig:   ()         => client.get('/admin/settings/backup'),
  saveBackupConfig:  (data)     => client.put('/admin/settings/backup', data),
  listBackups:       ()         => client.get('/admin/backups'),
  triggerBackup:     ()         => client.post('/admin/backups/run'),
  deleteBackup:      (filename) => client.delete(`/admin/backups/${filename}`),
  backupDownloadUrl: (filename) => `${client.defaults.baseURL}/admin/backups/${filename}`,
}
