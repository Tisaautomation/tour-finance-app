import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Search, Download, Plus, X, Users, DollarSign, Phone, Mail, Edit2, Trash2, ChevronDown, ChevronUp, Save, MessageSquare, Hash } from 'lucide-react'

interface Provider {
  id: string
  provider_id: string
  name: string
  line_user_id: string | null
  line_group_id: string | null
  phone: string | null
  email: string | null
  commission_rate: number
  is_active: boolean
  is_available: boolean
  notes: string | null
  pricing: Record<string, number> | null
  created_at: string
  updated_at: string
}

interface ProviderFormData {
  provider_id: string
  name: string
  phone: string
  email: string
  line_user_id: string
  line_group_id: string
  commission_rate: number
  is_active: boolean
  is_available: boolean
  notes: string
}

const emptyForm: ProviderFormData = {
  provider_id: '',
  name: '',
  phone: '',
  email: '',
  line_user_id: '',
  line_group_id: '',
  commission_rate: 0,
  is_active: true,
  is_available: true,
  notes: ''
}

export default function ProvidersTable() {
  const { hasPermission } = useAuth()
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProviderFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pricingTour, setPricingTour] = useState('')
  const [pricingAmount, setPricingAmount] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { fetchProviders() }, [])

  const fetchProviders = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('providers').select('*').order('name')
    if (data) setProviders(data)
    if (error) console.error('Fetch providers error:', error)
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return providers.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.provider_id.toLowerCase().includes(search.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.phone || '').toLowerCase().includes(search.toLowerCase())
      const matchesStatus = !statusFilter ||
        (statusFilter === 'active' && p.is_active) ||
        (statusFilter === 'inactive' && !p.is_active) ||
        (statusFilter === 'available' && p.is_available) ||
        (statusFilter === 'unavailable' && !p.is_available)
      return matchesSearch && matchesStatus
    })
  }, [providers, search, statusFilter])

  const openAddForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
    setError('')
  }

  const openEditForm = (provider: Provider) => {
    setForm({
      provider_id: provider.provider_id,
      name: provider.name,
      phone: provider.phone || '',
      email: provider.email || '',
      line_user_id: provider.line_user_id || '',
      line_group_id: provider.line_group_id || '',
      commission_rate: provider.commission_rate,
      is_active: provider.is_active,
      is_available: provider.is_available,
      notes: provider.notes || ''
    })
    setEditingId(provider.id)
    setShowForm(true)
    setError('')
  }

  const handleSubmit = async () => {
    if (!form.provider_id.trim() || !form.name.trim()) {
      setError('Provider ID and Name are required')
      return
    }
    setSaving(true)
    setError('')

    try {
      const payload: Record<string, unknown> = {
        provider_id: form.provider_id.trim(),
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        line_user_id: form.line_user_id.trim() || null,
        commission_rate: form.commission_rate,
        is_active: form.is_active,
        is_available: form.is_available,
        notes: form.notes.trim() || null,
      }

      // Only include line_group_id if the column exists (graceful handling)
      if (form.line_group_id.trim()) {
        payload.line_group_id = form.line_group_id.trim()
      }

      if (editingId) {
        const { error: err } = await supabase.from('providers')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('providers')
          .insert(payload)
        if (err) throw err
      }
      setShowForm(false)
      fetchProviders()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setError(msg)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete provider "${name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('providers').delete().eq('id', id)
    if (!error) fetchProviders()
  }

  const savePricing = async (providerId: string, currentPricing: Record<string, number> | null) => {
    if (!pricingTour.trim() || !pricingAmount) return
    const updated = { ...(currentPricing || {}), [pricingTour.trim()]: parseFloat(pricingAmount) }
    const { error } = await supabase.from('providers')
      .update({ pricing: updated, updated_at: new Date().toISOString() })
      .eq('id', providerId)
    if (!error) {
      setPricingTour('')
      setPricingAmount('')
      fetchProviders()
    }
  }

  const removePricing = async (providerId: string, currentPricing: Record<string, number>, tourKey: string) => {
    const updated = { ...currentPricing }
    delete updated[tourKey]
    const { error } = await supabase.from('providers')
      .update({ pricing: updated, updated_at: new Date().toISOString() })
      .eq('id', providerId)
    if (!error) fetchProviders()
  }

  const exportCSV = () => {
    if (!hasPermission('canExport')) return
    const csv = [
      ['Provider ID', 'Name', 'Phone', 'Email', 'LINE User ID', 'LINE Group ID', 'Commission %', 'Active', 'Available', 'Notes'],
      ...filtered.map(p => [
        p.provider_id, p.name, p.phone || '', p.email || '', p.line_user_id || '', p.line_group_id || '',
        p.commission_rate, p.is_active ? 'Yes' : 'No', p.is_available ? 'Yes' : 'No', p.notes || ''
      ])
    ].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `providers-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div className="fade-in lg:h-full lg:overflow-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Providers</h1>
          <p className="text-gray-500 mt-1">{providers.length} providers registered</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openAddForm} className="neu-btn px-4 py-2 flex items-center gap-2 text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #00b4d8, #9b5de5)' }}>
            <Plus size={16} /> Add Provider
          </button>
          {hasPermission('canExport') && (
            <button onClick={exportCSV} className="neu-btn px-4 py-2 flex items-center gap-2 text-sm">
              <Download size={16} /> Export
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Search providers..." value={search} onChange={e => setSearch(e.target.value)} className="neu-input w-full pl-11 pr-4 py-3" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="neu-input px-4 py-3">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="neu-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00b4d8, #9b5de5)' }}>
            <Users className="text-white" size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-lg font-bold text-gray-800">{providers.length}</p>
          </div>
        </div>
        <div className="neu-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl icon-green flex items-center justify-center">
            <Users className="text-white" size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Active</p>
            <p className="text-lg font-bold text-green-600">{providers.filter(p => p.is_active).length}</p>
          </div>
        </div>
        <div className="neu-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-yellow-500">
            <Users className="text-white" size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Available</p>
            <p className="text-lg font-bold text-yellow-600">{providers.filter(p => p.is_available).length}</p>
          </div>
        </div>
        <div className="neu-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500">
            <DollarSign className="text-white" size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500">With Pricing</p>
            <p className="text-lg font-bold text-purple-600">{providers.filter(p => p.pricing && Object.keys(p.pricing).length > 0).length}</p>
          </div>
        </div>
      </div>

      {/* Provider Cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading providers...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-400">{providers.length === 0 ? 'No providers yet. Add your first one.' : 'No results match your filters.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(provider => {
            const isExpanded = expandedId === provider.id
            const pricingEntries = provider.pricing ? Object.entries(provider.pricing) : []

            return (
              <div key={provider.id} className="neu-card overflow-hidden">
                {/* Main row */}
                <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : provider.id)}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: provider.is_active ? 'linear-gradient(135deg, #00b4d8, #9b5de5)' : '#94a3b8' }}>
                    <span className="text-white font-bold text-lg">{provider.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800 truncate">{provider.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">{provider.provider_id}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                      {provider.phone && <span className="flex items-center gap-1"><Phone size={12} />{provider.phone}</span>}
                      {provider.email && <span className="flex items-center gap-1 truncate"><Mail size={12} />{provider.email}</span>}
                      {provider.line_group_id && <span className="flex items-center gap-1"><MessageSquare size={12} />LINE Group</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${provider.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {provider.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${provider.is_available ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-600'}`}>
                      {provider.is_available ? 'Available' : 'Busy'}
                    </span>
                    {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    {/* Provider Details */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">LINE Group ID</p>
                        <p className="text-sm font-medium text-gray-700 break-all font-mono">{provider.line_group_id || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">LINE User ID</p>
                        <p className="text-sm font-medium text-gray-700 break-all font-mono">{provider.line_user_id || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Commission Rate</p>
                        <p className="text-sm font-medium text-gray-700">{provider.commission_rate}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p>
                        <p className="text-sm font-medium text-gray-700">{provider.email || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Phone</p>
                        <p className="text-sm font-medium text-gray-700">{provider.phone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Since</p>
                        <p className="text-sm font-medium text-gray-700">{formatDate(provider.created_at)}</p>
                      </div>
                      {provider.notes && (
                        <div className="md:col-span-3">
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                          <p className="text-sm text-gray-600">{provider.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Net Pricing Section */}
                    <div className="border-t border-gray-100 p-4">
                      <p className="text-sm font-bold text-gray-700 mb-3">Net Prices (what we pay this provider)</p>
                      {pricingEntries.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {pricingEntries.map(([tour, price]) => (
                            <div key={tour} className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ background: '#e8e8ed', boxShadow: 'inset 2px 2px 5px #c8c8cd, inset -2px -2px 5px #fff' }}>
                              <span className="text-sm font-medium text-gray-700">{tour}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-purple-700">THB {price.toLocaleString()}</span>
                                <button onClick={(e) => { e.stopPropagation(); removePricing(provider.id, provider.pricing!, tour) }}
                                  className="text-red-400 hover:text-red-600 transition-colors p-1">
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Add pricing form */}
                      <div className="flex gap-2">
                        <input type="text" placeholder="Tour / program (e.g. TIK34-Private)" value={expandedId === provider.id ? pricingTour : ''} onChange={e => setPricingTour(e.target.value)}
                          className="neu-input flex-1 px-3 py-2 text-sm" onClick={e => e.stopPropagation()} />
                        <input type="number" placeholder="Net THB" value={expandedId === provider.id ? pricingAmount : ''} onChange={e => setPricingAmount(e.target.value)}
                          className="neu-input w-28 px-3 py-2 text-sm" onClick={e => e.stopPropagation()} />
                        <button onClick={(e) => { e.stopPropagation(); savePricing(provider.id, provider.pricing) }}
                          className="neu-btn px-3 py-2 text-sm flex items-center gap-1 font-medium text-purple-600">
                          <Save size={14} /> Add
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="border-t border-gray-100 p-4 flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); openEditForm(provider) }}
                        className="neu-btn px-4 py-2 text-sm flex items-center gap-2 font-medium text-blue-600">
                        <Edit2 size={14} /> Edit
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(provider.id, provider.name) }}
                        className="neu-btn px-4 py-2 text-sm flex items-center gap-2 font-medium text-red-500">
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-6" onClick={e => e.stopPropagation()}
            style={{ background: '#e0e0e5', boxShadow: '12px 12px 30px #b8b8bd, -12px -12px 30px #fff' }}>

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold gradient-text">{editingId ? 'Edit Provider' : 'Add Provider'}</h2>
              <button onClick={() => setShowForm(false)} className="neu-btn p-2 rounded-xl">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium">{error}</div>
            )}

            <div className="space-y-4">
              {/* Provider ID */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  <Hash size={12} className="inline mr-1" />Provider ID *
                </label>
                <input type="text" value={form.provider_id} onChange={e => setForm({ ...form, provider_id: e.target.value })}
                  placeholder="e.g. TIK01, TIK34, TIK47" className="neu-input w-full px-4 py-3" />
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  <Users size={12} className="inline mr-1" />Name *
                </label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Provider company or person name" className="neu-input w-full px-4 py-3" />
              </div>

              {/* Phone + Email row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    <Phone size={12} className="inline mr-1" />Phone
                  </label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+66..." className="neu-input w-full px-4 py-3" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    <Mail size={12} className="inline mr-1" />Email
                  </label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="provider@email.com" className="neu-input w-full px-4 py-3" />
                </div>
              </div>

              {/* LINE IDs Section - neumorphic inset group */}
              <div className="rounded-2xl p-4" style={{ background: '#d8d8dd', boxShadow: 'inset 2px 2px 5px #b8b8bd, inset -2px -2px 5px #f8f8fb' }}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                  <MessageSquare size={12} /> LINE Integration
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">LINE Group ID</label>
                    <input type="text" value={form.line_group_id} onChange={e => setForm({ ...form, line_group_id: e.target.value })}
                      placeholder="Ccb9bf737da51a45e5bf7d1218fdc18f3" className="neu-input w-full px-4 py-3 text-sm font-mono" />
                    <p className="text-xs text-gray-400 mt-1">Group chat ID for provider notifications</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">LINE User ID</label>
                    <input type="text" value={form.line_user_id} onChange={e => setForm({ ...form, line_user_id: e.target.value })}
                      placeholder="U1234567890abcdef..." className="neu-input w-full px-4 py-3 text-sm font-mono" />
                    <p className="text-xs text-gray-400 mt-1">Individual user ID for direct messages</p>
                  </div>
                </div>
              </div>

              {/* Commission Rate */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  <DollarSign size={12} className="inline mr-1" />Commission Rate (%)
                </label>
                <input type="number" value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: parseFloat(e.target.value) || 0 })}
                  min="0" max="100" step="0.5" className="neu-input w-full px-4 py-3" />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-colors" style={{ background: form.is_active ? '#d4edda' : '#e8e8ed', boxShadow: 'inset 2px 2px 5px #c8c8cd, inset -2px -2px 5px #fff' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    className="w-5 h-5 rounded accent-green-500" />
                  <span className={`text-sm font-medium ${form.is_active ? 'text-green-700' : 'text-gray-500'}`}>Active</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-colors" style={{ background: form.is_available ? '#d1ecf1' : '#e8e8ed', boxShadow: 'inset 2px 2px 5px #c8c8cd, inset -2px -2px 5px #fff' }}>
                  <input type="checkbox" checked={form.is_available} onChange={e => setForm({ ...form, is_available: e.target.checked })}
                    className="w-5 h-5 rounded accent-blue-500" />
                  <span className={`text-sm font-medium ${form.is_available ? 'text-blue-700' : 'text-gray-500'}`}>Available</span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Internal notes about this provider..." rows={3} className="neu-input w-full px-4 py-3 resize-none" />
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="neu-btn flex-1 py-3 font-semibold text-gray-500">Cancel</button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 py-3 rounded-2xl font-bold text-white transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #00b4d8, #9b5de5)', boxShadow: '4px 4px 12px #b8b8bd, -4px -4px 12px #fff' }}>
                {saving ? 'Saving...' : editingId ? 'Update Provider' : 'Add Provider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
