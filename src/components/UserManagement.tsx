import { useState, useEffect } from 'react'
import { supabase, User } from '../lib/supabase'
import { Users, UserPlus, Shield, Mail, Lock, Loader2, Check, Trash2 } from 'lucide-react'

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ email: '', name: '', role: 'staff', password: '' })

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    setLoading(true)
    const { data } = await supabase.from('app_users').select('*').order('created_at', { ascending: false })
    if (data) setUsers(data as User[])
    setLoading(false)
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.email || !formData.name || !formData.password) return
    setSaving(true)
    const { error } = await supabase.from('app_users').insert({
      email: formData.email, name: formData.name, role: formData.role, password_hash: formData.password, is_active: true
    })
    if (error) alert('Error: ' + error.message)
    else { setFormData({ email: '', name: '', role: 'staff', password: '' }); setShowForm(false); fetchUsers() }
    setSaving(false)
  }

  async function toggleActive(user: User) {
    await supabase.from('app_users').update({ is_active: !user.is_active }).eq('id', user.id)
    fetchUsers()
  }

  async function deleteUser(user: User) {
    if (!confirm(`Delete user "${user.name}"?`)) return
    await supabase.from('app_users').delete().eq('id', user.id)
    fetchUsers()
  }

  const roles = [
    { value: 'admin', label: 'Admin', desc: 'Full access', color: 'text-purple-600 bg-purple-100' },
    { value: 'manager', label: 'Manager', desc: 'No user mgmt', color: 'text-blue-600 bg-blue-100' },
    { value: 'staff', label: 'Staff', desc: 'View only', color: 'text-green-600 bg-green-100' },
    { value: 'provider', label: 'Provider', desc: 'Own data', color: 'text-orange-600 bg-orange-100' },
  ]

  if (loading) return <div className="flex items-center justify-center h-64"><div className="spinner w-12 h-12"></div></div>

  return (
    <div className="fade-in w-full max-w-full lg:h-full lg:overflow-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold gradient-text">Users</h1>
          <p className="text-gray-500 text-sm mt-1">Manage access</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="neu-btn px-4 py-2.5 flex items-center gap-2 text-sm">
          <UserPlus size={16} /> Add User
        </button>
      </div>

      {/* Create User Form */}
      {showForm && (
        <div className="neu-card p-4 lg:p-6 mb-4 fade-in">
          <h2 className="text-base font-semibold text-[#2D3748] mb-4 flex items-center gap-2">
            <UserPlus size={18} className="text-[#9370DB]" /> New User
          </h2>
          <form onSubmit={createUser} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe" className="neu-input w-full px-3 py-2.5 text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com" className="neu-input w-full pl-9 pr-3 py-2.5 text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••" className="neu-input w-full pl-9 pr-3 py-2.5 text-sm" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Role</label>
                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="neu-input w-full px-3 py-2.5 text-sm">
                  {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="neu-btn px-4 py-2 flex items-center gap-2 text-sm">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="neu-flat px-4 py-2 text-gray-600 font-medium text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Role Legend - Scrollable on mobile */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
        {roles.map(r => (
          <div key={r.value} className="neu-flat p-2.5 flex items-center gap-2 flex-shrink-0 min-w-[140px]">
            <Shield size={14} className={r.color.split(' ')[0]} />
            <div>
              <p className="font-semibold text-xs text-[#2D3748]">{r.label}</p>
              <p className="text-xs text-gray-400">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Users - Cards on mobile, Table on desktop */}
      <div className="neu-card overflow-hidden">
        {/* Mobile Cards */}
        <div className="lg:hidden divide-y divide-gray-100">
          {users.map(user => {
            const roleInfo = roles.find(r => r.value === user.role) || roles[2]
            return (
              <div key={user.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl icon-primary flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">{user.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-[#2D3748] text-sm">{user.name}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[150px]">{user.email}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteUser(user)} className="p-2 rounded-lg text-red-400 hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${roleInfo.color}`}>{roleInfo.label}</span>
                  <button onClick={() => toggleActive(user)}
                    className={`px-2 py-0.5 rounded-md text-xs font-bold ${user.is_active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            )
          })}
          {users.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <Users size={40} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No users found</p>
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="table-header">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#2D3748]">User</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#2D3748]">Email</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#2D3748]">Role</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-[#2D3748]">Status</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-[#2D3748]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(user => {
                const roleInfo = roles.find(r => r.value === user.role) || roles[2]
                return (
                  <tr key={user.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl icon-primary flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">{user.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="font-medium text-[#2D3748] text-sm">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${roleInfo.color}`}>{roleInfo.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActive(user)}
                        className={`px-2 py-0.5 rounded-md text-xs font-bold ${user.is_active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => deleteUser(user)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
