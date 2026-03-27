import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// 401 → zur Login-Seite umleiten
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Zustand-Store aus dem Modul heraus zurücksetzen
      import('../store/authStore').then(({ useAuthStore }) => {
        useAuthStore.getState().clearUser()
      })
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default client
