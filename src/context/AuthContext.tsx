import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User, UserRole } from '../types'
import api, { setAuthToken } from '../lib/api'

interface AuthContextType {
  user: User | null
  login: (email: string, password: string, role?: UserRole) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('zenith_token')
    if (!token) {
      setLoading(false)
      return
    }

    const fetchCurrentUser = async () => {
      try {
        setAuthToken(token)
        const response = await api.get('/auth/me')
        setUser(response.data.user)
      } catch (err) {
        setAuthToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    fetchCurrentUser()
  }, [])

  const login = async (email: string, password: string, role?: UserRole) => {
    const response = await api.post('/auth/login', { email, password })
    const { token, user: loggedUser } = response.data
    setAuthToken(token)
    setUser(loggedUser)

    return loggedUser
  }

  const logout = () => {
    setAuthToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
