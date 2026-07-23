import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getMe, Me } from '../api/auth'

interface AuthContextValue {
  token: string | null
  me: Me | null
  login: (token: string) => void
  logout: () => void
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    if (!token) {
      setMe(null)
      return
    }

    getMe()
      .then(({ data }) => setMe(data))
      .catch(() => setMe(null))
  }, [token])

  const login = (newToken: string) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
  }

  const hasPermission = (permission: string) => me?.permissions.includes(permission) ?? false

  return (
    <AuthContext.Provider value={{ token, me, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
