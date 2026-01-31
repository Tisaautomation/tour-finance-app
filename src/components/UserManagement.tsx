import { useState, useEffect } from 'react'
import { supabase, User } from '../lib/supabase'
import { Users, UserPlus, Shield, Mail, Lock, Loader2, Check, X, Trash2 } from 'lucide-react'

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'staff',
    password: ''
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) setUsers(data as User[])
    setLoading(false)
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.email || !formData.name || !formData.password) return
    
    setSaving(true)
    const { error } = await supabase.from('app_users').insert({
      email: formData.email,
      name: formData.name,
      role: formData.role,
      password_hash: formData.password,
      is_active: true
    })

    if (error) {
      alert('Error: ' + error.message)
    } else {
      setFormData({ email: '', name: '', role: 'staff', password: '' })
      setShowForm(false)
      fetchUsers()
    }
    setSaving(false)
  }

  async function toggleActive(user: User) {
    await supabase
      .from('app_users')
      .update({ is_active: !user.is_active })
      .eq('id', user.id)
    
    fetchUsers()
  }

  async function deleteUser(user: User) {
    if (!confirm(`Delete user "${user.name}"? This cannot be undone.`)) return
    
    await supabase.from('app_users').delete().eq('id', user.id)
    fetchUsers()
  }

  const roles = [
    { value: 'admin', label: 'Admin', desc: 'Full access to everything', color: 'text-purple-600 bg-purple-100' },
    { value: 'manager', label: 'Manager', desc: 'All except user management', color: 'text-blue-600 bg-blue-100' },
    { value: 'staff', label: 'Staff', desc: 'View dashboard & orders only', color: 'text-green-600 bg-green-100' },
    { value: 'provider', label: 'Provider', desc: 'Own data only', color: 'text-orange-600 bg-orange-100' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner w-16 h-16"></div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">User Management</h1>
          <p className="text-gray-500 mt-1">Manage access & permissions</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="neu-btn px-5 py-3 flex items-center gap-2">
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      {/* Create User Form */}
      {showForm && (
        <div className="neu-card p-6 mb-6 fade-in">
          <h2 className="text-lg font-semibold text-[#2D3748] mb-4 flex items-center gap-2">
            <UserPlus size={20} className="text-[#9370DB]" />
            Create New User
          </h2>
          <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                className="neu-input w-full px-4 py-3"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  className="neu-input w-full pl-11 pr-4 py-3"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="neu-input w-full pl-11 pr-4 py-3"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2">Role</label>
              <select
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                className="neu-input w-full px-4 py-3"
              >
                {roles.map(r => (
                  <option key={r.value} value={r.value}>{r.label} - {r.desc}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={saving} className="neu-btn px-6 py-3 flex items-center gap-2">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {saving ? 'Creating...' : 'Create User'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="neu-flat px-6 py-3 text-gray-600 font-medium">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Role Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {roles.map(r => (
          <div key={r.value} className="neu-flat p-3 flex items-center gap-2">
            <Shield size={16} className={r.color.split(' ')[0]} />
            <div>
              <p className="font-semibold text-sm text-[#2D3748]">{r.label}</p>
              <p className="text-xs text-gray-400">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="neu-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="table-header">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-bold text-[#2D3748]">User</th>
                <th className="text-left px-6 py-4 text-sm font-bold text-[#2D3748]">Email</th>
                <th className="text-left px-6 py-4 text-sm font-bold text-[#2D3748]">Role</th>
                <th className="text-center px-6 py-4 text-sm font-bold text-[#2D3748]">Status</th>
                <th className="text-center px-6 py-4 text-sm font-bold text-[#2D3748]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(user => {
                const roleInfo = roles.find(r => r.value === user.role) || roles[2]
                return (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl icon-primary flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">{user.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="font-medium text-[#2D3748]">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => toggleActive(user)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                          user.is_active 
                            ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                            : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => deleteUser(user)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Delete user"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <Users size={48} className="mx-auto mb-3 opacity-30" />
                    <p>No users found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
