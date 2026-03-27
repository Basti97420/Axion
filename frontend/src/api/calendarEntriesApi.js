import client from './client'

export const calendarEntriesApi = {
  getAll: (projectId, start, end) =>
    client.get(`/projects/${projectId}/calendar-entries`, { params: { start, end } }),

  create: (data) => client.post('/calendar-entries', data),

  update: (id, data) => client.put(`/calendar-entries/${id}`, data),

  remove: (id) => client.delete(`/calendar-entries/${id}`),
}
