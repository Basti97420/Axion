import axios from 'axios'

// Läuft jetzt über nginx → main-api (kein separater calendar-service mehr)
const calClient = axios.create({
  baseURL: '/api/calendar',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

export const calendarApi = {
  getStatus:       ()              => calClient.get('/status'),
  getEvents:       (start, end)    => calClient.get('/events', { params: { start, end } }),
  createEvent:     (data)          => calClient.post('/events', data),
  deleteEvent:     (uid)           => calClient.delete(`/events/${uid}`),
  syncFromIcloud:  (start, end)    => calClient.post('/sync', { start, end }),
}
