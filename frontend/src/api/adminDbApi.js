import client from './client'

export const adminDbApi = {
  // DB-Browser
  getTables:   ()                          => client.get('/admin/db/tables'),
  getRows:     (table, page = 1, q = '')   => client.get(`/admin/db/tables/${table}/rows`, { params: { page, q } }),
  updateRow:   (table, id, fields)         => client.put(`/admin/db/tables/${table}/rows/${id}`, fields),

  // Workspace-Dateien
  getTree:          ()                              => client.get('/admin/workspace/tree'),
  getAgentFile:     (agentId, filename)             => client.get(`/admin/workspace/agents/${agentId}/files/${filename}`),
  saveAgentFile:    (agentId, filename, content)    => client.put(`/admin/workspace/agents/${agentId}/files/${filename}`, { content }),
  getScriptFile:    (scriptId, filename)            => client.get(`/admin/workspace/scripts/${scriptId}/files/${filename}`),
  saveScriptFile:   (scriptId, filename, content)   => client.put(`/admin/workspace/scripts/${scriptId}/files/${filename}`, { content }),
}
