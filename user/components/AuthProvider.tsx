'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

interface AuthUser {
  id: string
  nama: string
  email: string
  phone: string
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (identifier: string, password: string, captchaToken: string) => Promise<{ success: boolean; error?: string }>
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string; passwordErrors?: string[] }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

interface RegisterData {
  nama: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  captchaToken: string
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      const data = await res.json()
      if (data.authenticated && data.user) {
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = async (identifier: string, password: string, captchaToken: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier, password, captchaToken }),
      })

      const data = await res.json()

      if (!res.ok) {
        return { success: false, error: data.error || 'Login gagal' }
      }

      if (data.user) {
        setUser(data.user)
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || 'Terjadi kesalahan' }
    }
  }

  const register = async (registerData: RegisterData) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(registerData),
      })

      const data = await res.json()

      if (!res.ok) {
        return {
          success: false,
          error: data.error || 'Registrasi gagal',
          passwordErrors: data.passwordErrors,
        }
      }

      if (data.user) {
        setUser(data.user)
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || 'Terjadi kesalahan' }
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // ignore
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
