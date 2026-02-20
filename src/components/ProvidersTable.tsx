import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Search, Download, Plus, X, Users, DollarSign, Phone, Mail, Edit2, Trash2, ChevronDown, ChevronUp, Save, MessageSquare, Hash, RefreshCw, Percent, Tag, Package } from 'lucide-react'

const WEBHOOK = 'https://timelessconcept.app.n8n.cloud/webhook/claude-full-access'
const SHEET_ID = '1L6b4_voMI8RcH1JxcD7FSjzp6A9Ek7WiOgrbWc7UhUY'

interface Provider {
  id: string; provider_id: string; name: string; line_user_id: string | null; line_group_id: string | null
  phone: string | null; email: string | null; commission_rate: number; commission_type: string
  is_active: boolean; is_available: boolean; notes: string | null; pricing: Record<string, number> | null
  created_at: string; updated_at: string
}

interface ProviderFormData {
  provider_id: string; name: string; phone: string; email: string; line_user_id: string; line_group_id: string
  commission_rate: number; commission_type: 'fixed' | 'percentage'; is_active: boolean; is_available: boolean; notes: string
}

interface NetPriceRow {
  provider_id: string; tour_id: string; tour_name: string; program: string; price_type: string
  net_price: string; priority: string; updated_by: string; updated_at: string; _row: number
}

interface AddonPriceRow {
  provider_id: string; addon_id: string; addon_name: string; net_price: string
  updated_by: string; updated_at: string; _row: number
}

interface TourOption { tour_id: string; tour_name: string; pricing_model: string }

const MODEL_DEFAULTS: Record<string, string[]> = {
  per_person: ['adult', 'child'], flat_rate: ['private'], per_vehicle: ['vehicle'],
  per_duration: ['unit'], per_variant: ['standard'],
}

const PRICE_TYPE_LABELS: Record<string, string> = {
  adult: 'Adult', child: 'Child', private: 'Private', vehicle: 'Vehicle',
  unit: 'Unit', standard: 'Standard', ringside: 'Ringside', vip: 'VIP', premium: 'Premium',
}

const emptyForm: ProviderFormData = {
  provider_id: '', name: '', phone: '', email: '', line_user_id: '', line_group_id: '',
  commission_rate: 0, commission_type: 'percentage', is_active: true, is_available: true, notes: ''
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
  const [showDropdown, setShowDropdown] = useState(false)
  const [netPrices, setNetPrices] = useState<NetPriceRow[]>([])
  const [allTours, setAllTours] = useState<TourOption[]>([])
  const [editedPrices, setEditedPrices] = useState<Set<number>>(new Set())
  const [savingPrices, setSavingPrices] = useState(false)
  const [priceMsg, setPriceMsg] = useState('')
  const [addTourId, setAddTourId] = useState('')
  const [newPriceType, setNewPriceType] = useState('')
  const [addonPrices, setAddonPrices] = useState<AddonPriceRow[]>([])
  const [editedAddons, setEditedAddons] = useState<Set<number>>(new Set())
  const [newAddonId, setNewAddonId] = useState('')
  const [newAddonName, setNewAddonName] = useState('')

  useEffect(() => { fetchProviders(); fetchNetPrices(); fetchTours(); fetchAddonPrices() }, [])
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.relative')) setShowDropdown(false) }
    document.addEventListener('click', close); return () => document.removeEventListener('click', close)
  }, [])

  const fetchProviders = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('providers').select('*').order('provider_id')
    if (data) setProviders(data); if (error) console.error(error); setLoading(false)
  }

  const fetchNetPrices = useCallback(async () => {
    try {
      const vals = await sheetsRead('NetPrices')
      if (vals.length > 1) {
        const h = vals[0] as string[]
        setNetPrices(vals.slice(1).map((row: string[], idx: number) => {
          const obj: Record<string, string> = {}; h.forEach((k, i) => obj[k] = row[i] || '')
          return { ...obj, _row: idx + 2 } as unknown as NetPriceRow
        }).filter((r: NetPriceRow) => r.provider_id && r.tour_id))
      }
    } catch (e) { console.error(e) }
  }, [])

  const fetchAddonPrices = useCallback(async () => {
    try {
      const vals = await sheetsRead('AddonNetPrices')
      if (vals.length > 1) {
        const h = vals[0] as string[]
        setAddonPrices(vals.slice(1).map((row: string[], idx: number) => {
          const obj: Record<string, string> = {}; h.forEach((k, i) => obj[k] = row[i] || '')
          return { ...obj, _row: idx + 2 } as unknown as AddonPriceRow
        }).filter((r: AddonPriceRow) => r.provider_id && r.addon_id))
      }
    } catch (e) { console.error(e) }
  }, [])

  const fetchTours = useCallback(async () => {
    try {
      const vals = await sheetsRead('Tours!A:K')
      if (vals.length > 1) {
        const h = vals[0] as string[]
        setAllTours(vals.slice(1).map((row: string[]) => {
          const obj: Record<string, string> = {}; h.forEach((k, i) => obj[k] = row[i] || '')
          return { tour_id: obj.tk_id || '', tour_name: obj.Short_Name || obj.Tour_Name || '', pricing_model: obj.pricing_model || 'per_person' }
        }).filter((t: TourOption) => t.tour_id))
      }
    } catch (e) { console.error(e) }
  }, [])

  const getProviderPrices = (pid: string) => netPrices.filter(p => p.provider_id === pid)
  const getProviderTourGroups = (pid: string) => {
    const g: Record<string, NetPriceRow[]> = {}
    getProviderPrices(pid).forEach(p => { if (!g[p.tour_id]) g[p.tour_id] = []; g[p.tour_id].push(p) })
    return g
  }
  const getAvailableTours = (pid: string) => {
    const assigned = new Set(getProviderPrices(pid).map(p => p.tour_id))
    return allTours.filter(t => !assigned.has(t.tour_id))
  }
  const getProviderAddons = (pid: string) => addonPrices.filter(a => a.provider_id === pid)
  const getTourModel = (tid: string) => allTours.find(t => t.tour_id === tid)?.pricing_model || 'per_person'
  const getProviderTourCount = (pid: string) => new Set(getProviderPrices(pid).map(p => p.tour_id)).size

  const handlePriceChange = (row: NetPriceRow, value: string) => {
    setNetPrices(prev => prev.map(p => p._row === row._row ? { ...p, net_price: value } : p))
    setEditedPrices(prev => new Set(prev).add(row._row))
  }
  const handleAddonPriceChange = (row: AddonPriceRow, value: string) => {
    setAddonPrices(prev => prev.map(a => a._row === row._row ? { ...a, net_price: value } : a))
    setEditedAddons(prev => new Set(prev).add(row._row))
  }

  const saveProviderPrices = async (pid: string) => {
    const tp = getProviderPrices(pid).filter(p => editedPrices.has(p._row))
    const ta = getProviderAddons(pid).filter(a => editedAddons.has(a._row))
    if (!tp.length && !ta.length) return
    setSavingPrices(true); setPriceMsg('')
    try {
      const now = new Date().toISOString().split('T')[0]
      const updates: { range: string; values: string[][] }[] = []
      tp.forEach(row => updates.push({ range: `NetPrices!F${row._row}:I${row._row}`, values: [[row.net_price || '', row.priority || '', 'admin', now]] }))
      ta.forEach(row => updates.push({ range: `AddonNetPrices!D${row._row}:F${row._row}`, values: [[row.net_price || '', 'admin', now]] }))
      if (updates.length) {
        const r = await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sheets_batch_update', params: { spreadsheet_id: SHEET_ID, data: updates } }) })
        if (!(await r.json()).success) throw new Error('Save failed')
      }
      setPriceMsg(`✅ ${tp.length + ta.length} price(s) saved`)
      setEditedPrices(prev => { const n = new Set(prev); tp.forEach(p => n.delete(p._row)); return n })
      setEditedAddons(prev => { const n = new Set(prev); ta.forEach(a => n.delete(a._row)); return n })
      setTimeout(() => setPriceMsg(''), 3000)
    } catch (e: unknown) { setPriceMsg('❌ ' + (e instanceof Error ? e.message : 'Error')) }
    setSavingPrices(false)
  }

  const addTourToProvider = async (pid: string) => {
    if (!addTourId) return
    const tour = allTours.find(t => t.tour_id === addTourId); if (!tour) return
    setSavingPrices(true)
    try {
      const defaults = MODEL_DEFAULTS[tour.pricing_model] || ['adult']
      const now = new Date().toISOString().split('T')[0]
      for (const pt of defaults) {
        const r = await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sheets_append', params: { spreadsheet_id: SHEET_ID, range: 'NetPrices!A:I',
            values: [[pid, tour.tour_id, tour.tour_name, '', pt, '', '1', 'admin', now]] } }) })
        if (!(await r.json()).success) throw new Error('Append failed')
      }
      setAddTourId(''); setPriceMsg(`✅ ${tour.tour_id} added (${defaults.join(', ')})`); await fetchNetPrices()
      setTimeout(() => setPriceMsg(''), 3000)
    } catch (e: unknown) { setPriceMsg('❌ ' + (e instanceof Error ? e.message : 'Error')) }
    setSavingPrices(false)
  }

  const addPriceType = async (pid: string, tid: string, tname: string, pt: string, priority: string) => {
    if (!pt.trim()) return; setSavingPrices(true)
    try {
      const now = new Date().toISOString().split('T')[0]
      const r = await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sheets_append', params: { spreadsheet_id: SHEET_ID, range: 'NetPrices!A:I',
          values: [[pid, tid, tname, '', pt.trim().toLowerCase(), '', priority, 'admin', now]] } }) })
      if (!(await r.json()).success) throw new Error('Append failed')
      setNewPriceType(''); setPriceMsg(`✅ ${pt} added to ${tid}`); await fetchNetPrices()
      setTimeout(() => setPriceMsg(''), 3000)
    } catch (e: unknown) { setPriceMsg('❌ ' + (e instanceof Error ? e.message : 'Error')) }
    setSavingPrices(false)
  }

  const removeTourFromProvider = async (pid: string, tid: string) => {
    if (!confirm(`Remove ${tid} from ${pid}? All price rows will be cleared.`)) return
    setSavingPrices(true)
    try {
      const rows = netPrices.filter(p => p.provider_id === pid && p.tour_id === tid)
      const updates = rows.map(r => ({ range: `NetPrices!A${r._row}:I${r._row}`, values: [Array(9).fill('')] }))
      if (updates.length) await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sheets_batch_update', params: { spreadsheet_id: SHEET_ID, data: updates } }) })
      await fetchNetPrices(); setPriceMsg('✅ Tour removed'); setTimeout(() => setPriceMsg(''), 3000)
    } catch (e: unknown) { setPriceMsg('❌ ' + (e instanceof Error ? e.message : 'Error')) }
    setSavingPrices(false)
  }

  const removePriceRow = async (row: NetPriceRow) => {
    if (!confirm(`Remove ${row.price_type} from ${row.tour_id}?`)) return
    setSavingPrices(true)
    try {
      await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sheets_batch_update', params: { spreadsheet_id: SHEET_ID,
          data: [{ range: `NetPrices!A${row._row}:I${row._row}`, values: [Array(9).fill('')] }] } }) })
      await fetchNetPrices(); setPriceMsg('✅ Row removed'); setTimeout(() => setPriceMsg(''), 3000)
    } catch (e: unknown) { setPriceMsg('❌ ' + (e instanceof Error ? e.message : 'Error')) }
    setSavingPrices(false)
  }

  const addAddonToProvider = async (pid: string) => {
    if (!newAddonId.trim() || !newAddonName.trim()) return; setSavingPrices(true)
    try {
      const now = new Date().toISOString().split('T')[0]
      const r = await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sheets_append', params: { spreadsheet_id: SHEET_ID, range: 'AddonNetPrices!A:F',
          values: [[pid, newAddonId.trim().toLowerCase(), newAddonName.trim(), '', 'admin', now]] } }) })
      if (!(await r.json()).success) throw new Error('Append failed')
      setNewAddonId(''); setNewAddonName(''); setPriceMsg(`✅ Addon added`); await fetchAddonPrices()
      setTimeout(() => setPriceMsg(''), 3000)
    } catch (e: unknown) { setPriceMsg('❌ ' + (e instanceof Error ? e.message : 'Error')) }
    setSavingPrices(false)
  }

  const removeAddon = async (row: AddonPriceRow) => {
    if (!confirm(`Remove addon "${row.addon_name}"?`)) return; setSavingPrices(true)
    try {
      await fetch(WEBHOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sheets_batch_update', params: { spreadsheet_id: SHEET_ID,
          data: [{ range: `AddonNetPrices!A${row._row}:F${row._row}`, values: [Array(6).fill('')] }] } }) })
      await fetchAddonPrices(); setPriceMsg('✅ Addon removed'); setTimeout(() => setPriceMsg(''), 3000)
    } catch (e: unknown) { setPriceMsg('❌ ' + (e instanceof Error ? e.message : 'Error')) }
    setSavingPrices(false)
  }

  const filtered = useMemo(() => providers.filter(p => {
    const ms = p.name.toLowerCase().includes(search.toLowerCase()) || p.provider_id.toLowerCase().includes(search.toLowerCase()) || (p.email||'').toLowerCase().includes(search.toLowerCase())
    const mf = !statusFilter || (statusFilter==='active'&&p.is_active) || (statusFilter==='inactive'&&!p.is_active) || (statusFilter==='available'&&p.is_available) || (statusFilter==='unavailable'&&!p.is_available)
    return ms && mf
  }), [providers, search, statusFilter])

  const openAddForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); setError('') }
  const openEditForm = (p: Provider) => {
    setForm({ provider_id: p.provider_id, name: p.name, phone: p.phone||'', email: p.email||'',
      line_user_id: p.line_user_id||'', line_group_id: p.line_group_id||'', commission_rate: p.commission_rate,
      commission_type: (p.commission_type as 'fixed'|'percentage')||'percentage', is_active: p.is_active, is_available: p.is_available, notes: p.notes||'' })
    setEditingId(p.id); setShowForm(true); setError('')
  }

  const handleSubmit = async () => {
    if (!form.provider_id.trim()||!form.name.trim()) { setError('Provider ID and Name required'); return }
    setSaving(true); setError('')
    try {
      const payload: Record<string, unknown> = { provider_id: form.provider_id.trim(), name: form.name.trim(),
        phone: form.phone.trim()||null, email: form.email.trim()||null, line_user_id: form.line_user_id.trim()||null,
        commission_rate: form.commission_rate, commission_type: form.commission_type,
        is_active: form.is_active, is_available: form.is_available, notes: form.notes.trim()||null }
      if (form.line_group_id.trim()) payload.line_group_id = form.line_group_id.trim()
      if (editingId) { const { error: e } = await supabase.from('providers').update({...payload, updated_at: new Date().toISOString()}).eq('id', editingId); if(e) throw e }
      else { const { error: e } = await supabase.from('providers').insert(payload); if(e) throw e }
      setShowForm(false); fetchProviders()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Save failed') }
    setSaving(false)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    const { error } = await supabase.from('providers').delete().eq('id', id); if (!error) fetchProviders()
  }

  const exportCSV = () => {
    if (!hasPermission('canExport')) return
    const csv = [['Provider ID','Name','Phone','Email','LINE Group','Commission','Type','Active','Available','Tours','Notes'],
      ...filtered.map(p => { const tg = Object.keys(getProviderTourGroups(p.provider_id)).join('; ')
        return [p.provider_id,p.name,p.phone||'',p.email||'',p.line_group_id||'',p.commission_rate,(p.commission_type as string)||'percentage',
          p.is_active?'Yes':'No',p.is_available?'Yes':'No',tg,p.notes||''] })
    ].map(r=>r.map(c=>`"${c}"`).join(',')).join('\n')
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    a.download=`providers-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})
  const pricesSet = netPrices.filter(p=>p.net_price).length
  const addonSet = addonPrices.filter(a=>a.net_price).length

  return (
    <div className="fade-in lg:h-full lg:overflow-auto overflow-x-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Providers</h1>
          <p className="text-gray-500 mt-1">{providers.length} providers &middot; {pricesSet}/{netPrices.length} prices set &middot; {addonSet} addon prices</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>{fetchProviders();fetchNetPrices();fetchAddonPrices()}} className="neu-btn px-3 py-2"><RefreshCw size={16} className="text-gray-500"/></button>
          <button onClick={openAddForm} className="neu-btn px-4 py-2 flex items-center gap-2 text-sm font-semibold text-white" style={{background:'linear-gradient(135deg, #00b4d8, #9b5de5)'}}><Plus size={16}/> Add Provider</button>
          {hasPermission('canExport') && <button onClick={exportCSV} className="neu-btn px-4 py-2 flex items-center gap-2 text-sm"><Download size={16}/> Export</button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18}/>
          <input type="text" placeholder="Search by ID or name..." value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setShowDropdown(true)} className="neu-input w-full pl-11 pr-4 py-3"/>
          {showDropdown && <div className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-2xl z-50" style={{background:'#e8e8ed',boxShadow:'6px 6px 16px #b8b8bd, -6px -6px 16px #fff'}}>
            {providers.filter(p=>!search||p.provider_id.toLowerCase().includes(search.toLowerCase())||p.name.toLowerCase().includes(search.toLowerCase())).map(p=>
              <button key={p.id} onClick={()=>{setSearch(p.provider_id);setShowDropdown(false)}} className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-white/60 transition-colors border-b border-gray-200/30 last:border-0">
                <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-purple-100 text-purple-700 min-w-[52px] text-center">{p.provider_id}</span>
                <span className="text-sm text-gray-700 truncate">{p.name}</span>
                <span className="ml-auto text-xs text-gray-400">{getProviderTourCount(p.provider_id)} tours</span>
              </button>)}
          </div>}
        </div>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="neu-input px-4 py-3">
          <option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
          <option value="available">Available</option><option value="unavailable">Unavailable</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="neu-card p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg, #00b4d8, #9b5de5)'}}><Users className="text-white" size={18}/></div><div><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold text-gray-800">{providers.length}</p></div></div>
        <div className="neu-card p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl icon-green flex items-center justify-center"><Users className="text-white" size={18}/></div><div><p className="text-xs text-gray-500">Active</p><p className="text-lg font-bold text-green-600">{providers.filter(p=>p.is_active).length}</p></div></div>
        <div className="neu-card p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500"><DollarSign className="text-white" size={18}/></div><div><p className="text-xs text-gray-500">Prices Set</p><p className="text-lg font-bold text-purple-600">{pricesSet}/{netPrices.length}</p></div></div>
        <div className="neu-card p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500"><Package className="text-white" size={18}/></div><div><p className="text-xs text-gray-500">Addon Prices</p><p className="text-lg font-bold text-amber-600">{addonSet}</p></div></div>
      </div>

      {priceMsg && <div className={`mb-4 px-4 py-2 rounded-xl text-sm font-semibold ${priceMsg.startsWith('✅')?'bg-green-50 text-green-700':'bg-red-50 text-red-700'}`}>{priceMsg}</div>}

      {loading ? <div className="text-center py-12 text-gray-400">Loading providers...</div>
      : filtered.length===0 ? <div className="text-center py-12"><Users className="mx-auto text-gray-300 mb-3" size={48}/><p className="text-gray-400">{providers.length===0?'No providers yet.':'No results.'}</p></div>
      : <div className="space-y-4">{filtered.map(provider => {
        const isExp = expandedId===provider.id
        const tourGroups = getProviderTourGroups(provider.provider_id)
        const tourCount = Object.keys(tourGroups).length
        const provAddons = getProviderAddons(provider.provider_id)
        const hasEdited = getProviderPrices(provider.provider_id).some(p=>editedPrices.has(p._row)) || provAddons.some(a=>editedAddons.has(a._row))
        const commLabel = provider.commission_type==='fixed' ? `THB ${provider.commission_rate?.toLocaleString()||0}` : `${provider.commission_rate||0}%`
        return (
          <div key={provider.id} className="neu-card overflow-hidden">
            <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={()=>setExpandedId(isExp?null:provider.id)}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:provider.is_active?'linear-gradient(135deg, #00b4d8, #9b5de5)':'#94a3b8'}}><span className="text-white font-bold text-lg">{provider.name.charAt(0).toUpperCase()}</span></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-800 truncate">{provider.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{provider.provider_id}</span>
                  {tourCount>0 && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">{tourCount} tours</span>}
                  {provAddons.length>0 && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">{provAddons.length} addons</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                  {provider.phone && <span className="flex items-center gap-1"><Phone size={12}/>{provider.phone}</span>}
                  <span className="flex items-center gap-1"><DollarSign size={12}/>{commLabel}</span>
                  {provider.line_group_id && <span className="flex items-center gap-1"><MessageSquare size={12}/>LINE</span>}
                  {provider.email && <span className="flex items-center gap-1"><Mail size={12}/>{provider.email}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${provider.is_active?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{provider.is_active?'Active':'Inactive'}</span>
                {isExp ? <ChevronUp size={18} className="text-gray-400"/> : <ChevronDown size={18} className="text-gray-400"/>}
              </div>
            </div>

            {isExp && <div className="border-t border-gray-100 bg-gray-50/50">
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Commission</p><p className="text-sm font-medium text-gray-700">{commLabel}</p></div>
                <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-1">LINE Group</p><p className="text-sm font-medium text-gray-700 break-all font-mono">{provider.line_group_id||'—'}</p></div>
                <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Since</p><p className="text-sm font-medium text-gray-700">{fmtDate(provider.created_at)}</p></div>
                {provider.email && <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Email</p><p className="text-sm text-gray-700">{provider.email}</p></div>}
                {provider.phone && <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Phone</p><p className="text-sm text-gray-700">{provider.phone}</p></div>}
                {provider.notes && <div className="md:col-span-3"><p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notes</p><p className="text-sm text-gray-600">{provider.notes}</p></div>}
              </div>

              {/* TOURS & NET PRICES */}
              <div className="border-t border-gray-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-700 flex items-center gap-2"><Tag size={14} className="text-purple-500"/>Assigned Tours & Net Prices</p>
                  {hasEdited && <button onClick={e=>{e.stopPropagation();saveProviderPrices(provider.provider_id)}} disabled={savingPrices}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1" style={{background:'linear-gradient(135deg, #22C55E, #16a34a)'}}><Save size={12}/>{savingPrices?'Saving...':'Save Changes'}</button>}
                </div>

                {tourCount>0 ? <div className="space-y-3 mb-3">{Object.entries(tourGroups).map(([tid, rows])=>{
                  const model = getTourModel(tid); const tname = rows[0]?.tour_name||tid
                  return <div key={tid} className="rounded-xl p-3" style={{background:'#e8e8ed',boxShadow:'inset 2px 2px 5px #c8c8cd, inset -2px -2px 5px #fff'}} onClick={e=>e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">{tid}</span>
                        <span className="text-sm text-gray-600 truncate max-w-[200px]">{tname}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 uppercase">{model.replace('_',' ')}</span>
                      </div>
                      <button onClick={()=>removeTourFromProvider(provider.provider_id,tid)} className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={13}/></button>
                    </div>
                    <div className="space-y-1.5">{rows.map(row=>{
                      const isEd = editedPrices.has(row._row); const lbl = PRICE_TYPE_LABELS[row.price_type]||row.price_type
                      return <div key={row._row} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isEd?'ring-1 ring-purple-300 bg-purple-50/50':''}`}>
                        <span className="text-xs font-semibold text-gray-500 uppercase w-20 flex-shrink-0">{lbl}</span>
                        <input type="number" value={row.net_price} placeholder="0" onChange={e=>handlePriceChange(row,e.target.value)}
                          className="w-24 px-2 py-1.5 rounded-lg text-center text-sm font-semibold neu-input" style={{color:row.net_price?'#1f2937':'#ccc'}}/>
                        <span className="text-xs text-gray-400">THB</span>
                        {row.updated_at && <span className="text-[10px] text-gray-400 ml-auto hidden md:block">{row.updated_at}</span>}
                        <button onClick={()=>removePriceRow(row)} className="w-6 h-6 rounded flex items-center justify-center text-red-300 hover:text-red-500"><X size={12}/></button>
                      </div>
                    })}</div>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200/50">
                      <input type="text" value={newPriceType} placeholder="Add type (vip, ringside...)" onChange={e=>setNewPriceType(e.target.value)}
                        onKeyDown={e=>{if(e.key==='Enter')addPriceType(provider.provider_id,tid,tname,newPriceType,rows[0]?.priority||'1')}} className="neu-input flex-1 px-2 py-1 text-xs"/>
                      <button onClick={()=>addPriceType(provider.provider_id,tid,tname,newPriceType,rows[0]?.priority||'1')} disabled={!newPriceType.trim()||savingPrices}
                        className={`px-2 py-1 rounded-lg text-xs font-bold text-white ${newPriceType.trim()?'opacity-100':'opacity-40'}`} style={{background:'linear-gradient(135deg, #00b4d8, #9b5de5)'}}><Plus size={12}/></button>
                    </div>
                  </div>
                })}</div> : <p className="text-sm text-gray-400 italic mb-3">No tours assigned yet</p>}

                <div className="flex gap-2 items-center" onClick={e=>e.stopPropagation()}>
                  <select value={addTourId} onChange={e=>setAddTourId(e.target.value)} className="neu-input flex-1 px-3 py-2 text-sm">
                    <option value="">+ Add tour...</option>
                    {getAvailableTours(provider.provider_id).map(t=><option key={t.tour_id} value={t.tour_id}>{t.tour_id} — {t.tour_name} ({t.pricing_model})</option>)}
                  </select>
                  <button onClick={()=>addTourToProvider(provider.provider_id)} disabled={!addTourId||savingPrices}
                    className={`px-4 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-1 ${addTourId?'opacity-100':'opacity-40'}`} style={{background:'linear-gradient(135deg, #00b4d8, #9b5de5)'}}><Plus size={14}/> Add</button>
                </div>
              </div>

              {/* ADD-ON NET PRICES */}
              <div className="border-t border-gray-100 p-4">
                <p className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3"><Package size={14} className="text-amber-500"/>Add-on Net Prices</p>
                {provAddons.length>0 ? <div className="space-y-1.5 mb-3">{provAddons.map(addon=>{
                  const isEd = editedAddons.has(addon._row)
                  return <div key={addon._row} className={`flex items-center gap-2 p-2 rounded-xl ${isEd?'ring-1 ring-amber-200':''}`}
                    style={{background:isEd?'#fef3c7':'#e8e8ed',boxShadow:'inset 2px 2px 5px #c8c8cd, inset -2px -2px 5px #fff'}} onClick={e=>e.stopPropagation()}>
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700">{addon.addon_id}</span>
                    <span className="text-sm text-gray-600 flex-1 truncate">{addon.addon_name}</span>
                    <input type="number" value={addon.net_price} placeholder="0" onChange={e=>handleAddonPriceChange(addon,e.target.value)}
                      className="w-24 px-2 py-1.5 rounded-lg text-center text-sm font-semibold neu-input" style={{color:addon.net_price?'#1f2937':'#ccc'}}/>
                    <span className="text-xs text-gray-400">THB</span>
                    {addon.updated_at && <span className="text-[10px] text-gray-400 hidden md:block">{addon.updated_at}</span>}
                    <button onClick={()=>removeAddon(addon)} className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50"><X size={13}/></button>
                  </div>
                })}</div> : <p className="text-sm text-gray-400 italic mb-3">No add-ons yet</p>}
                <div className="flex gap-2 items-center flex-wrap" onClick={e=>e.stopPropagation()}>
                  <input type="text" value={newAddonId} onChange={e=>setNewAddonId(e.target.value)} placeholder="ID (kayak)" className="neu-input w-28 px-2 py-2 text-sm"/>
                  <input type="text" value={newAddonName} onChange={e=>setNewAddonName(e.target.value)} placeholder="Name (Kayak Rental)" className="neu-input flex-1 min-w-[140px] px-2 py-2 text-sm"/>
                  <button onClick={()=>addAddonToProvider(provider.provider_id)} disabled={!newAddonId.trim()||!newAddonName.trim()||savingPrices}
                    className={`px-4 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-1 ${newAddonId.trim()&&newAddonName.trim()?'opacity-100':'opacity-40'}`} style={{background:'linear-gradient(135deg, #f59e0b, #d97706)'}}><Plus size={14}/> Add</button>
                </div>
              </div>

              <div className="border-t border-gray-100 p-4 flex gap-2">
                <button onClick={e=>{e.stopPropagation();openEditForm(provider)}} className="neu-btn px-4 py-2 text-sm flex items-center gap-2 font-medium text-blue-600"><Edit2 size={14}/> Edit</button>
                <button onClick={e=>{e.stopPropagation();handleDelete(provider.id,provider.name)}} className="neu-btn px-4 py-2 text-sm flex items-center gap-2 font-medium text-red-500"><Trash2 size={14}/> Delete</button>
              </div>
            </div>}
          </div>
        )})}</div>}

      {/* Add/Edit Modal */}
      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={()=>setShowForm(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
        <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-6" onClick={e=>e.stopPropagation()} style={{background:'#e0e0e5',boxShadow:'12px 12px 30px #b8b8bd, -12px -12px 30px #fff'}}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold gradient-text">{editingId?'Edit Provider':'Add Provider'}</h2>
            <button onClick={()=>setShowForm(false)} className="neu-btn p-2 rounded-xl"><X size={18} className="text-gray-500"/></button>
          </div>
          {error && <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium">{error}</div>}
          <div className="space-y-4">
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"><Hash size={12} className="inline mr-1"/>Provider ID *</label>
              <input type="text" value={form.provider_id} onChange={e=>setForm({...form,provider_id:e.target.value})} placeholder="e.g. TIK01" className="neu-input w-full px-4 py-3"/></div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"><Users size={12} className="inline mr-1"/>Name *</label>
              <input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Provider name" className="neu-input w-full px-4 py-3"/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"><Phone size={12} className="inline mr-1"/>Phone</label>
                <input type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+66..." className="neu-input w-full px-4 py-3"/></div>
              <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1"><Mail size={12} className="inline mr-1"/>Email</label>
                <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="provider@email.com" className="neu-input w-full px-4 py-3"/></div>
            </div>
            <div className="rounded-2xl p-4" style={{background:'#d8d8dd',boxShadow:'inset 2px 2px 5px #b8b8bd, inset -2px -2px 5px #f8f8fb'}}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1"><MessageSquare size={12}/> LINE Integration</p>
              <div className="space-y-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">LINE Group ID</label>
                  <input type="text" value={form.line_group_id} onChange={e=>setForm({...form,line_group_id:e.target.value})} placeholder="Ccb9bf737..." className="neu-input w-full px-4 py-3 text-sm font-mono"/></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">LINE User ID</label>
                  <input type="text" value={form.line_user_id} onChange={e=>setForm({...form,line_user_id:e.target.value})} placeholder="U1234567..." className="neu-input w-full px-4 py-3 text-sm font-mono"/></div>
              </div>
            </div>
            <div className="rounded-2xl p-4" style={{background:'#d8d8dd',boxShadow:'inset 2px 2px 5px #b8b8bd, inset -2px -2px 5px #f8f8fb'}}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1"><DollarSign size={12}/> Commission</p>
              <div className="flex gap-2 mb-3">
                <button onClick={()=>setForm({...form,commission_type:'percentage'})} className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1 ${form.commission_type==='percentage'?'text-white shadow-md':'text-gray-500'}`}
                  style={form.commission_type==='percentage'?{background:'linear-gradient(135deg, #00b4d8, #9b5de5)'}:{background:'#e0e0e5',boxShadow:'3px 3px 6px #b8b8bd, -3px -3px 6px #fff'}}><Percent size={14}/> Percentage</button>
                <button onClick={()=>setForm({...form,commission_type:'fixed'})} className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1 ${form.commission_type==='fixed'?'text-white shadow-md':'text-gray-500'}`}
                  style={form.commission_type==='fixed'?{background:'linear-gradient(135deg, #00b4d8, #9b5de5)'}:{background:'#e0e0e5',boxShadow:'3px 3px 6px #b8b8bd, -3px -3px 6px #fff'}}><DollarSign size={14}/> Fixed THB</button>
              </div>
              <input type="number" value={form.commission_rate} onChange={e=>setForm({...form,commission_rate:parseFloat(e.target.value)||0})} min="0" step={form.commission_type==='percentage'?'0.5':'100'}
                placeholder={form.commission_type==='percentage'?'e.g. 15':'e.g. 500'} className="neu-input w-full px-4 py-3 text-lg font-bold text-center"/>
              <p className="text-xs text-gray-400 text-center mt-1">{form.commission_type==='percentage'?'Our margin as % of selling price':'Fixed THB per booking'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl" style={{background:form.is_active?'#d4edda':'#e8e8ed',boxShadow:'inset 2px 2px 5px #c8c8cd, inset -2px -2px 5px #fff'}}>
                <input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})} className="w-5 h-5 rounded accent-green-500"/>
                <span className={`text-sm font-medium ${form.is_active?'text-green-700':'text-gray-500'}`}>Active</span></label>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl" style={{background:form.is_available?'#d1ecf1':'#e8e8ed',boxShadow:'inset 2px 2px 5px #c8c8cd, inset -2px -2px 5px #fff'}}>
                <input type="checkbox" checked={form.is_available} onChange={e=>setForm({...form,is_available:e.target.checked})} className="w-5 h-5 rounded accent-blue-500"/>
                <span className={`text-sm font-medium ${form.is_available?'text-blue-700':'text-gray-500'}`}>Available</span></label>
            </div>
            <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</label>
              <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Internal notes..." rows={3} className="neu-input w-full px-4 py-3 resize-none"/></div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={()=>setShowForm(false)} className="neu-btn flex-1 py-3 font-semibold text-gray-500">Cancel</button>
            <button onClick={handleSubmit} disabled={saving} className="flex-1 py-3 rounded-2xl font-bold text-white disabled:opacity-50"
              style={{background:'linear-gradient(135deg, #00b4d8, #9b5de5)',boxShadow:'4px 4px 12px #b8b8bd, -4px -4px 12px #fff'}}>{saving?'Saving...':editingId?'Update Provider':'Add Provider'}</button>
          </div>
        </div>
      </div>}
    </div>
  )
}
