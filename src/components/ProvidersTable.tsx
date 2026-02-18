import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Search, Download, Plus, X, Users, DollarSign, Phone, Mail, Edit2, Trash2, ChevronDown, ChevronUp, Save, MessageSquare, Hash, MapPin, RefreshCw, Percent, Tag } from 'lucide-react'

const WEBHOOK = 'https://timelessconcept.app.n8n.cloud/webhook/claude-full-access'
const SHEET_ID = '1L6b4_voMI8RcH1JxcD7FSjzp6A9Ek7WiOgrbWc7UhUY'

interface Provider {
  id: string
  provider_id: string
  name: string
  line_user_id: string | null
  line_group_id: string | null
  phone: string | null
  email: string | null
  commission_rate: number
  commission_type: string
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
  commission_type: 'fixed' | 'percentage'
  is_active: boolean
  is_available: boolean
  notes: string
}

interface NetPriceRow {
  tour_id: string
  tour_name: string
  provider_id: string
  provider_name: string
  priority: string
  adult_net: string
  child_net: string
  infant_net: string
  _row: number
}

interface TourOption {
  tour_id: string
  tour_name: string
}

const emptyForm: ProviderFormData = {
  provider_id: '', name: '', phone: '', email: '',
  line_user_id: '', line_group_id: '',
  commission_rate: 0, commission_type: 'percentage',
  is_active: true, is_available: true, notes: ''
}

async function sheetsRead(range: string) {
  const r = await fetch(WEBHOOK, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sheets_read', params: { spreadsheet_id: SHEET_ID, range } }),
  })
  const d = await r.json()
  return d?.data?.values || []
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
  const [error, setError] = useState('')

  // Net prices state
  const [netPrices, setNetPrices] = useState<NetPriceRow[]>([])
  const [allTours, setAllTours] = useState<TourOption[]>([])
  const [editedPrices, setEditedPrices] = useState<Set<number>>(new Set())
  const [savingPrices, setSavingPrices] = useState(false)
  const [priceMsg, setPriceMsg] = useState('')
  const [addTourId, setAddTourId] = useState('')

  useEffect(() => { fetchProviders(); fetchNetPrices(); fetchTours() }, [])

  const fetchProviders = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('providers').select('*').order('name')
    if (data) setProviders(data)
    if (error) console.error('Fetch providers error:', error)
    setLoading(false)
  }

  const fetchNetPrices = useCallback(async () => {
    try {
      const vals = await sheetsRead('NetPrices')
      if (vals.length > 1) {
        const headers = vals[0] as string[]
        const rows: NetPriceRow[] = vals.slice(1).map((row: string[], idx: number) => {
          const obj: Record<string, string> = {}
          headers.forEach((h: string, i: number) => (obj[h] = row[i] || ''))
          return { ...obj, _row: idx + 2 } as unknown as NetPriceRow
        })
        setNetPrices(rows)
      }
    } catch (e) { console.error('Fetch net prices error:', e) }
  }, [])

  const fetchTours = useCallback(async () => {
    try {
      const vals = await sheetsRead('Tours')
      if (vals.length > 1) {
        const headers = vals[0] as string[]
        const tours: TourOption[] = vals.slice(1).map((row: string[]) => {
          const obj: Record<string, string> = {}
          headers.forEach((h: string, i: number) => (obj[h] = row[i] || ''))
          return { tour_id: obj.tk_id || '', tour_name: obj.Short_Name || obj.Tour_Name || '' }
        }).filter((t: { tour_id: string }) => t.tour_id)
        setAllTours(tours)
      }
    } catch (e) { console.error('Fetch tours error:', e) }
  }, [])

  const getProviderPrices = (providerId: string) => netPrices.filter(p => p.provider_id === providerId)

  const getAvailableTours = (providerId: string) => {
    const assigned = new Set(getProviderPrices(providerId).map(p => p.tour_id))
    return allTours.filter(t => !assigned.has(t.tour_id))
  }

  const handlePriceChange = (row: NetPriceRow, field: string, value: string) => {
    setNetPrices(prev => prev.map(p =>
      p._row === row._row ? { ...p, [field]: value } : p
    ))
    setEditedPrices(prev => new Set(prev).add(row._row))
  }

  const saveProviderPrices = async (providerId: string) => {
    const provPrices = getProviderPrices(providerId)
    const toSave = provPrices.filter(p => editedPrices.has(p._row))
    if (toSave.length === 0) return

    setSavingPrices(true)
    setPriceMsg('')
    try {
      const updates = toSave.map(row => ({
        range: `NetPrices!F${row._row}:H${row._row}`,
        values: [[row.adult_net || '', row.child_net || '', row.infant_net || '']],
      }))
      const r = await fetch(WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sheets_batch_update', params: { spreadsheet_id: SHEET_ID, data: updates } }),
      })
      const res = await r.json()
      if (!res.success) throw new Error('Save failed')
      setPriceMsg(`✅ ${toSave.length} prices saved`)
      setEditedPrices(prev => {
        const next = new Set(prev)
        toSave.forEach(p => next.delete(p._row))
        return next
      })
      setTimeout(() => setPriceMsg(''), 3000)
    } catch (e: unknown) {
      setPriceMsg('❌ ' + (e instanceof Error ? e.message : 'Error'))
    }
    setSavingPrices(false)
  }

  const addTourToProvider = async (providerId: string, providerName: string) => {
    if (!addTourId) return
    const tour = allTours.find(t => t.tour_id === addTourId)
    if (!tour) return

    setSavingPrices(true)
    try {
      // Find next empty row or append
      const newRow = [tour.tour_id, tour.tour_name, providerId, providerName, '1', '', '', '']
      const r = await fetch(WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sheets_append',
          params: { spreadsheet_id: SHEET_ID, range: 'NetPrices!A:H', values: [newRow] }
        }),
      })
      const res = await r.json()
      if (!res.success) throw new Error('Append failed')
      setAddTourId('')
      setPriceMsg(`✅ ${tour.tour_id} added`)
      await fetchNetPrices()
      setTimeout(() => setPriceMsg(''), 3000)
    } catch (e: unknown) {
      setPriceMsg('❌ ' + (e instanceof Error ? e.message : 'Error'))
    }
    setSavingPrices(false)
  }

  const removeTourFromProvider = async (row: NetPriceRow) => {
    if (!confirm(`Remove ${row.tour_id} from ${row.provider_id}?`)) return
    setSavingPrices(true)
    try {
      // Clear the row content (can't delete rows via API easily, so blank it)
      const r = await fetch(WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sheets_batch_update',
          params: { spreadsheet_id: SHEET_ID, data: [{ range: `NetPrices!A${row._row}:H${row._row}`, values: [['', '', '', '', '', '', '', '']] }] }
        }),
      })
      await r.json()
      await fetchNetPrices()
      setPriceMsg('✅ Tour removed')
      setTimeout(() => setPriceMsg(''), 3000)
    } catch (e: unknown) {
      setPriceMsg('❌ ' + (e instanceof Error ? e.message : 'Error'))
    }
    setSavingPrices(false)
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

  const openAddForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); setError('') }

  const openEditForm = (provider: Provider) => {
    setForm({
      provider_id: provider.provider_id,
      name: provider.name,
      phone: provider.phone || '',
      email: provider.email || '',
      line_user_id: provider.line_user_id || '',
      line_group_id: provider.line_group_id || '',
      commission_rate: provider.commission_rate,
      commission_type: (provider.commission_type as 'fixed' | 'percentage') || 'percentage',
      is_active: provider.is_active,
      is_available: provider.is_available,
      notes: provider.notes || ''
    })
    setEditingId(provider.id)
    setShowForm(true)
    setError('')
  }

  const handleSubmit = async () => {
    if (!form.provider_id.trim() || !form.name.trim()) { setError('Provider ID and Name are required'); return }
    setSaving(true); setError('')
    try {
      const payload: Record<string, unknown> = {
        provider_id: form.provider_id.trim(), name: form.name.trim(),
        phone: form.phone.trim() || null, email: form.email.trim() || null,
        line_user_id: form.line_user_id.trim() || null,
        commission_rate: form.commission_rate,
        commission_type: form.commission_type,
        is_active: form.is_active, is_available: form.is_available,
        notes: form.notes.trim() || null,
      }
      if (form.line_group_id.trim()) payload.line_group_id = form.line_group_id.trim()

      if (editingId) {
        const { error: err } = await supabase.from('providers')
          .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('providers').insert(payload)
        if (err) throw err
      }
      setShowForm(false); fetchProviders()
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Save failed') }
    setSaving(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete provider "${name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('providers').delete().eq('id', id)
    if (!error) fetchProviders()
  }

  const exportCSV = () => {
    if (!hasPermission('canExport')) return
    const csv = [
      ['Provider ID', 'Name', 'Phone', 'Email', 'LINE Group ID', 'Commission', 'Type', 'Active', 'Available', 'Tours', 'Notes'],
      ...filtered.map(p => {
        const tours = getProviderPrices(p.provider_id).map(np => np.tour_id).join('; ')
        return [p.provider_id, p.name, p.phone || '', p.email || '', p.line_group_id || '',
          p.commission_rate, (p.commission_type as string) || 'percentage',
          p.is_active ? 'Yes' : 'No', p.is_available ? 'Yes' : 'No', tours, p.notes || '']
      })
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
          <p className="text-gray-500 mt-1">{providers.length} providers &middot; {netPrices.filter(p => p.adult_net).length}/{netPrices.length} prices set</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { fetchProviders(); fetchNetPrices() }} className="neu-btn px-3 py-2">
            <RefreshCw size={16} className="text-gray-500" />
          </button>
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
          <div><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold text-gray-800">{providers.length}</p></div>
        </div>
        <div className="neu-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl icon-green flex items-center justify-center"><Users className="text-white" size={18} /></div>
          <div><p className="text-xs text-gray-500">Active</p><p className="text-lg font-bold text-green-600">{providers.filter(p => p.is_active).length}</p></div>
        </div>
        <div className="neu-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500"><DollarSign className="text-white" size={18} /></div>
          <div><p className="text-xs text-gray-500">Prices Set</p><p className="text-lg font-bold text-purple-600">{netPrices.filter(p => p.adult_net).length}/{netPrices.length}</p></div>
        </div>
        <div className="neu-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500"><MapPin className="text-white" size={18} /></div>
          <div><p className="text-xs text-gray-500">Tours Assigned</p><p className="text-lg font-bold text-amber-600">{netPrices.length}</p></div>
        </div>
      </div>

      {/* Price save feedback */}
      {priceMsg && (
        <div className={`mb-4 px-4 py-2 rounded-xl text-sm font-semibold ${priceMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {priceMsg}
        </div>
      )}

      {/* Provider Cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading providers...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-400">{providers.length === 0 ? 'No providers yet.' : 'No results match your filters.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(provider => {
            const isExpanded = expandedId === provider.id
            const provPrices = getProviderPrices(provider.provider_id)
            const availTours = getAvailableTours(provider.provider_id)
            const hasEdited = provPrices.some(p => editedPrices.has(p._row))
            const commLabel = (provider.commission_type === 'fixed')
              ? `THB ${provider.commission_rate?.toLocaleString() || 0}`
              : `${provider.commission_rate || 0}%`

            return (
              <div key={provider.id} className="neu-card overflow-hidden">
                {/* Main row */}
                <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : provider.id)}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: provider.is_active ? 'linear-gradient(135deg, #00b4d8, #9b5de5)' : '#94a3b8' }}>
                    <span className="text-white font-bold text-lg">{provider.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800 truncate">{provider.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">{provider.provider_id}</span>
                      {provPrices.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 flex-shrink-0">
                          {provPrices.length} tours
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                      {provider.phone && <span className="flex items-center gap-1"><Phone size={12} />{provider.phone}</span>}
                      <span className="flex items-center gap-1"><DollarSign size={12} />{commLabel}</span>
                      {provider.line_group_id && <span className="flex items-center gap-1"><MessageSquare size={12} />LINE</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${provider.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {provider.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    {/* Provider info */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Commission</p>
                        <p className="text-sm font-medium text-gray-700">{commLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">LINE Group</p>
                        <p className="text-sm font-medium text-gray-700 break-all font-mono">{provider.line_group_id || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Since</p>
                        <p className="text-sm font-medium text-gray-700">{formatDate(provider.created_at)}</p>
                      </div>
                      {provider.email && <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p><p className="text-sm text-gray-700">{provider.email}</p></div>}
                      {provider.phone && <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Phone</p><p className="text-sm text-gray-700">{provider.phone}</p></div>}
                      {provider.notes && <div className="md:col-span-3"><p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p><p className="text-sm text-gray-600">{provider.notes}</p></div>}
                    </div>

                    {/* === TOURS & NET PRICES SECTION === */}
                    <div className="border-t border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
                          <Tag size={14} className="text-purple-500" />
                          Assigned Tours & Net Prices
                        </p>
                        {hasEdited && (
                          <button onClick={(e) => { e.stopPropagation(); saveProviderPrices(provider.provider_id) }}
                            disabled={savingPrices}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1"
                            style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}>
                            <Save size={12} />{savingPrices ? 'Saving...' : `Save (${provPrices.filter(p => editedPrices.has(p._row)).length})`}
                          </button>
                        )}
                      </div>

                      {/* Existing tours with prices */}
                      {provPrices.length > 0 ? (
                        <div className="space-y-2 mb-3">
                          {/* Header */}
                          <div className="hidden md:flex items-center gap-2 px-3 text-xs font-semibold text-gray-400 uppercase">
                            <div className="flex-1">Tour</div>
                            <div className="w-20 text-center">Adult</div>
                            <div className="w-20 text-center">Child</div>
                            <div className="w-20 text-center">Infant</div>
                            <div className="w-8"></div>
                          </div>
                          {provPrices.map(row => {
                            const isEdited = editedPrices.has(row._row)
                            return (
                              <div key={row._row}
                                className={`flex items-center gap-2 p-3 rounded-xl flex-wrap transition-all ${isEdited ? 'ring-1 ring-purple-200' : ''}`}
                                style={{ background: isEdited ? '#ede9fe' : '#e8e8ed', boxShadow: 'inset 2px 2px 5px #c8c8cd, inset -2px -2px 5px #fff' }}
                                onClick={e => e.stopPropagation()}>
                                <div className="flex-1 min-w-[140px]">
                                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700 mr-1">{row.tour_id}</span>
                                  <span className="text-sm text-gray-600">{row.tour_name}</span>
                                </div>
                                {(['adult_net', 'child_net', 'infant_net'] as const).map(field => (
                                  <div key={field} className="w-20">
                                    <label className="md:hidden text-[10px] font-semibold text-gray-400 uppercase block">{field.replace('_net', '')}</label>
                                    <input type="number" value={row[field]} placeholder="0"
                                      onChange={e => handlePriceChange(row, field, e.target.value)}
                                      className="w-full px-2 py-1.5 rounded-lg text-center text-sm font-semibold neu-input"
                                      style={{ color: row[field] ? '#1f2937' : '#ccc' }} />
                                  </div>
                                ))}
                                <button onClick={() => removeTourFromProvider(row)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                  <X size={14} />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic mb-3">No tours assigned yet</p>
                      )}

                      {/* Add tour */}
                      <div className="flex gap-2 items-center" onClick={e => e.stopPropagation()}>
                        <select value={addTourId} onChange={e => setAddTourId(e.target.value)}
                          className="neu-input flex-1 px-3 py-2 text-sm">
                          <option value="">+ Add tour...</option>
                          {availTours.map(t => (
                            <option key={t.tour_id} value={t.tour_id}>{t.tour_id} — {t.tour_name}</option>
                          ))}
                        </select>
                        <button onClick={() => addTourToProvider(provider.provider_id, provider.name)}
                          disabled={!addTourId || savingPrices}
                          className={`px-4 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-1 transition-all ${addTourId ? 'opacity-100' : 'opacity-40'}`}
                          style={{ background: 'linear-gradient(135deg, #00b4d8, #9b5de5)' }}>
                          <Plus size={14} /> Add
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

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold gradient-text">{editingId ? 'Edit Provider' : 'Add Provider'}</h2>
              <button onClick={() => setShowForm(false)} className="neu-btn p-2 rounded-xl"><X size={18} className="text-gray-500" /></button>
            </div>

            {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium">{error}</div>}

            <div className="space-y-4">
              {/* Provider ID */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"><Hash size={12} className="inline mr-1" />Provider ID *</label>
                <input type="text" value={form.provider_id} onChange={e => setForm({ ...form, provider_id: e.target.value })}
                  placeholder="e.g. TIK01, TIK34" className="neu-input w-full px-4 py-3" />
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"><Users size={12} className="inline mr-1" />Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Provider name" className="neu-input w-full px-4 py-3" />
              </div>

              {/* Phone + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"><Phone size={12} className="inline mr-1" />Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+66..." className="neu-input w-full px-4 py-3" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"><Mail size={12} className="inline mr-1" />Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="provider@email.com" className="neu-input w-full px-4 py-3" />
                </div>
              </div>

              {/* LINE Section */}
              <div className="rounded-2xl p-4" style={{ background: '#d8d8dd', boxShadow: 'inset 2px 2px 5px #b8b8bd, inset -2px -2px 5px #f8f8fb' }}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1"><MessageSquare size={12} /> LINE Integration</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">LINE Group ID</label>
                    <input type="text" value={form.line_group_id} onChange={e => setForm({ ...form, line_group_id: e.target.value })}
                      placeholder="Ccb9bf737..." className="neu-input w-full px-4 py-3 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">LINE User ID</label>
                    <input type="text" value={form.line_user_id} onChange={e => setForm({ ...form, line_user_id: e.target.value })}
                      placeholder="U1234567..." className="neu-input w-full px-4 py-3 text-sm font-mono" />
                  </div>
                </div>
              </div>

              {/* Commission — Fixed or % */}
              <div className="rounded-2xl p-4" style={{ background: '#d8d8dd', boxShadow: 'inset 2px 2px 5px #b8b8bd, inset -2px -2px 5px #f8f8fb' }}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1"><DollarSign size={12} /> Commission</p>
                <div className="flex gap-2 mb-3">
                  <button onClick={() => setForm({ ...form, commission_type: 'percentage' })}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1 transition-all ${
                      form.commission_type === 'percentage'
                        ? 'text-white shadow-md' : 'text-gray-500'
                    }`}
                    style={form.commission_type === 'percentage'
                      ? { background: 'linear-gradient(135deg, #00b4d8, #9b5de5)' }
                      : { background: '#e0e0e5', boxShadow: '3px 3px 6px #b8b8bd, -3px -3px 6px #fff' }}>
                    <Percent size={14} /> Percentage
                  </button>
                  <button onClick={() => setForm({ ...form, commission_type: 'fixed' })}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1 transition-all ${
                      form.commission_type === 'fixed'
                        ? 'text-white shadow-md' : 'text-gray-500'
                    }`}
                    style={form.commission_type === 'fixed'
                      ? { background: 'linear-gradient(135deg, #00b4d8, #9b5de5)' }
                      : { background: '#e0e0e5', boxShadow: '3px 3px 6px #b8b8bd, -3px -3px 6px #fff' }}>
                    <DollarSign size={14} /> Fixed THB
                  </button>
                </div>
                <input type="number" value={form.commission_rate}
                  onChange={e => setForm({ ...form, commission_rate: parseFloat(e.target.value) || 0 })}
                  min="0" step={form.commission_type === 'percentage' ? '0.5' : '100'}
                  placeholder={form.commission_type === 'percentage' ? 'e.g. 15' : 'e.g. 500'}
                  className="neu-input w-full px-4 py-3 text-lg font-bold text-center" />
                <p className="text-xs text-gray-400 text-center mt-1">
                  {form.commission_type === 'percentage' ? 'Our margin as % of selling price' : 'Fixed THB amount we earn per booking'}
                </p>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-colors"
                  style={{ background: form.is_active ? '#d4edda' : '#e8e8ed', boxShadow: 'inset 2px 2px 5px #c8c8cd, inset -2px -2px 5px #fff' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-5 h-5 rounded accent-green-500" />
                  <span className={`text-sm font-medium ${form.is_active ? 'text-green-700' : 'text-gray-500'}`}>Active</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-colors"
                  style={{ background: form.is_available ? '#d1ecf1' : '#e8e8ed', boxShadow: 'inset 2px 2px 5px #c8c8cd, inset -2px -2px 5px #fff' }}>
                  <input type="checkbox" checked={form.is_available} onChange={e => setForm({ ...form, is_available: e.target.checked })} className="w-5 h-5 rounded accent-blue-500" />
                  <span className={`text-sm font-medium ${form.is_available ? 'text-blue-700' : 'text-gray-500'}`}>Available</span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Internal notes..." rows={3} className="neu-input w-full px-4 py-3 resize-none" />
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
