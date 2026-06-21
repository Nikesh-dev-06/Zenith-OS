import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('zenith_token')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('zenith_token', token)
  } else {
    localStorage.removeItem('zenith_token')
  }
}

export function getAuthToken() {
  return localStorage.getItem('zenith_token')
}

export default api
