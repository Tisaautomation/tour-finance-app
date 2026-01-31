import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase, User, ROLE_PERMISSIONS } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ error?: string }>
  logout: () => void
  hasPermission: (permission: keyof typeof ROLE_PERMISSIONS.admin) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('tik_finance_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {}
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', email.toLowerCase())
        .eq('is_active', true)
        .single()

      if (error || !data) {
        return { error: 'Invalid email or account not active' }
      }

      // Simple password validation (role + year)
      if (password !== data.password_hash) {
        return { error: 'Invalid password' }
      }

      const userData: User = {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        is_active: data.is_active
      }

      localStorage.setItem('tik_finance_user', JSON.stringify(userData))
      setUser(userData)
      return {}
    } catch (err) {
      return { error: 'Login failed' }
    }
  }

  const logout = () => {
    localStorage.removeItem('tik_finance_user')
    setUser(null)
  }

  const hasPermission = (permission: keyof typeof ROLE_PERMISSIONS.admin): boolean => {
    if (!user) return false
    const perms = ROLE_PERMISSIONS[user.role]
    return perms ? perms[permission] : false
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
