import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    const success = await login(email, password)
    
    if (!success) {
      setError('Invalid email or account not active')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(145deg, #E8EEF5 0%, #F0F4F8 50%, #E4EAF1 100%)' }}>
      <div className="neu-card p-8 w-full max-w-md fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="logo-circle mb-4" style={{ width: '80px', height: '80px', padding: '12px' }}>
            <img src="/images/compass.png" alt="SATP" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">SATP Group</h1>
          <p className="text-gray-400 text-sm mt-1">Finance Dashboard</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600">
            <AlertCircle size={20} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="neu-input w-full pl-11 pr-4 py-3.5"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-600 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="neu-input w-full pl-11 pr-4 py-3.5"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="neu-btn w-full py-4 flex items-center justify-center gap-2 text-lg disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          © 2026 SATP Group. All rights reserved.
        </p>
      </div>
    </div>
  )
}
