import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Save, RefreshCw, DollarSign, Filter, ChevronDown, ChevronUp } from 'lucide-react'

const WEBHOOK = 'https://timelessconcept.app.n8n.cloud/webhook/claude-full-access'
const SHEET_ID = '1L6b4_voMI8RcH1JxcD7FSjzp6A9Ek7WiOgrbWc7UhUY'

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
  _idx: number
}

async function sheetsRead(range: string) {
  const r = await fetch(WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sheets_read', params: { spreadsheet_id: SHEET_ID, range } }),
  })
  const d = await r.json()
  return d?.data?.values || []
}

export default function NetPricesManager() {
  const [prices, setPrices] = useState<NetPriceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filterProvider, setFilterProvider] = useState('')
  const [filterTour, setFilterTour] = useState('')
  const [search, setSearch] = useState('')
  const [edited, setEdited] = useState<Set<number>>(new Set())
  const [msg, setMsg] = useState('')
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const vals = await sheetsRead('NetPrices')
      if (vals.length > 1) {
        const headers = vals[0] as string[]
        const rows: NetPriceRow[] = vals.slice(1).map((row: string[], idx: number) => {
          const obj: Record<string, string> = {}
          headers.forEach((h: string, i: number) => (obj[h] = row[i] || ''))
          return { ...obj, _row: idx + 2, _idx: idx } as unknown as NetPriceRow
        })
        setPrices(rows)
      }
    } catch (e: unknown) {
      setMsg('Error loading: ' + (e instanceof Error ? e.message : String(e)))
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const providers = useMemo(() => [...new Set(prices.map(r => r.provider_id))].sort(), [prices])
  const tours = useMemo(() => [...new Set(prices.map(r => r.tour_id))].sort(), [prices])

  const filtered = useMemo(() => prices.filter(p => {
    if (filterProvider && p.provider_id !== filterProvider) return false
    if (filterTour && p.tour_id !== filterTour) return false
    if (search) {
      const s = search.toLowerCase()
      return p.tour_id.toLowerCase().includes(s) || p.tour_name.toLowerCase().includes(s) ||
             p.provider_id.toLowerCase().includes(s) || p.provider_name.toLowerCase().includes(s)
    }
    return true
  }), [prices, filterProvider, filterTour, search])

  const grouped = useMemo(() => {
    const g: Record<string, { name: string; rows: NetPriceRow[] }> = {}
    filtered.forEach(p => {
      if (!g[p.provider_id]) g[p.provider_id] = { name: p.provider_name || p.provider_id, rows: [] }
      g[p.provider_id].rows.push(p)
    })
    return g
  }, [filtered])

  const handleChange = (idx: number, field: string, value: string) => {
    setPrices(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
    setEdited(prev => new Set(prev).add(idx))
  }

  const saveAll = async () => {
    if (edited.size === 0) return
    setSaving(true)
    setMsg('')
    try {
      const updates: { range: string; values: string[][] }[] = []
      for (const idx of edited) {
        const row = prices[idx]
        updates.push({
          range: `NetPrices!F${row._row}:H${row._row}`,
          values: [[row.adult_net || '', row.child_net || '', row.infant_net || '']],
        })
      }
      for (let i = 0; i < updates.length; i += 20) {
        const batch = updates.slice(i, i + 20)
        const r = await fetch(WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sheets_batch_update', params: { spreadsheet_id: SHEET_ID, data: batch } }),
        })
        const res = await r.json()
        if (!res.success) throw new Error('Batch update failed')
      }
      setMsg(`✅ ${edited.size} prices saved`)
      setEdited(new Set())
      setTimeout(() => setMsg(''), 3000)
    } catch (e: unknown) {
      setMsg('❌ Error: ' + (e instanceof Error ? e.message : String(e)))
    }
    setSaving(false)
  }

  const filled = filtered.filter(p => p.adult_net).length
  const total = filtered.length

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="neo-card p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">{prices.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Combos</div>
        </div>
        <div className="neo-card p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{prices.filter(p => p.adult_net).length}</div>
          <div className="text-xs text-gray-500 mt-1">Prices Set</div>
        </div>
        <div className="neo-card p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{prices.filter(p => !p.adult_net).length}</div>
          <div className="text-xs text-gray-500 mt-1">Missing</div>
        </div>
        <div className="neo-card p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{providers.length}</div>
          <div className="text-xs text-gray-500 mt-1">Providers</div>
        </div>
      </div>

      {/* Filters */}
      <div className="neo-card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-semibold text-gray-500 block mb-1">SEARCH</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tour or provider..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm neo-input"
              />
            </div>
          </div>
          <div className="min-w-[150px]">
            <label className="text-xs font-semibold text-gray-500 block mb-1"><Filter size={10} className="inline mr-1" />PROVIDER</label>
            <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} className="w-full py-2 px-3 rounded-xl text-sm neo-input">
              <option value="">All ({providers.length})</option>
              {providers.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="text-xs font-semibold text-gray-500 block mb-1"><Filter size={10} className="inline mr-1" />TOUR</label>
            <select value={filterTour} onChange={e => setFilterTour(e.target.value)} className="w-full py-2 px-3 rounded-xl text-sm neo-input">
              <option value="">All ({tours.length})</option>
              {tours.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={saveAll} disabled={saving || edited.size === 0}
              className={`px-4 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-1 transition-all ${
                edited.size > 0 ? 'bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg hover:shadow-xl' : 'bg-gray-300 cursor-default'
              }`}>
              <Save size={14} />{saving ? 'Saving...' : `Save${edited.size > 0 ? ` (${edited.size})` : ''}`}
            </button>
            <button onClick={load} disabled={loading}
              className="p-2 rounded-xl neo-btn hover:bg-gray-100 transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin text-purple-500' : 'text-gray-500'} />
            </button>
          </div>
        </div>
        {msg && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-semibold ${msg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msg}
          </div>
        )}
        <div className="mt-2 text-xs text-gray-400">{filled}/{total} prices configured in view</div>
      </div>

      {/* Provider Groups */}
      {loading ? (
        <div className="neo-card p-12 text-center text-gray-400">Loading net prices...</div>
      ) : (
        Object.entries(grouped).map(([pid, { name, rows }]) => {
          const isExpanded = expandedProvider === null || expandedProvider === pid
          const allSet = rows.every(r => r.adult_net)
          return (
            <div key={pid} className="neo-card overflow-hidden">
              <button
                onClick={() => setExpandedProvider(expandedProvider === pid ? null : pid)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-700">{pid}</span>
                  <span className="font-semibold text-gray-700 text-sm">{name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${allSet ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {rows.filter(r => r.adult_net).length}/{rows.length}
                  </span>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 p-3 space-y-2">
                  {rows.map(row => {
                    const isEdited = edited.has(row._idx)
                    return (
                      <div key={row.tour_id + row.provider_id}
                        className={`rounded-xl p-3 flex items-center gap-3 flex-wrap transition-all ${
                          isEdited ? 'bg-purple-50 ring-1 ring-purple-200' : 'bg-gray-50/80'
                        }`}>
                        <div className="flex-1 min-w-[160px]">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700 mr-2">{row.tour_id}</span>
                          <span className="text-sm text-gray-600">{row.tour_name}</span>
                          <span className="text-xs text-gray-400 ml-2">P{row.priority}</span>
                        </div>
                        {(['adult_net', 'child_net', 'infant_net'] as const).map(field => (
                          <div key={field} className="w-[85px]">
                            <label className="text-[10px] font-semibold text-gray-400 uppercase block">{field.replace('_net', '')}</label>
                            <input
                              type="number" value={row[field]} placeholder="0"
                              onChange={e => handleChange(row._idx, field, e.target.value)}
                              className={`w-full px-2 py-1.5 rounded-lg text-center text-sm font-semibold neo-input ${
                                row[field] ? 'text-gray-800' : 'text-gray-300'
                              }`}
                            />
                          </div>
                        ))}
                        {isEdited && <DollarSign size={14} className="text-purple-500 animate-pulse" />}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })
      )}
      {!loading && filtered.length === 0 && (
        <div className="neo-card p-12 text-center text-gray-400 text-sm">No prices found for selected filters</div>
      )}
    </div>
  )
}
