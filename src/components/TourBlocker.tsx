import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  ShieldBan, Plus, Trash2, Edit3, X, Check, Calendar, ChevronLeft, ChevronRight,
  Filter, Search, AlertTriangle, RefreshCw, Copy, Power, PowerOff
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────
interface TourBlock {
  id: string
  tour_name: string
  shopify_product_id: number | null
  provider_id: string | null
  program: string | null
  block_type: 'always' | 'one_day' | 'date_range' | 'recurring'
  blocked_date: string | null
  start_date: string | null
  end_date: string | null
  blocked_weekdays: string[] | null
  blocked_days_of_month: number[] | null
  reason: string
  notes: string | null
  auto_unblock: boolean
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

interface TourOption {
  name: string
  shopify_product_id: number | null
  category: string
}

// ─── Constants ───────────────────────────────────────────────────
const TOURS: TourOption[] = [
  { name: 'ATV Adventure Koh Samui – 2-Hour Tour (NEW FORMAT)', shopify_product_id: 8285568106690, category: 'Adventure' },
  { name: 'ATV Adventure Koh Samui – 2‑Hour Jungle Tour', shopify_product_id: 8265144893634, category: 'Adventure' },
  { name: 'ATV Taster Tour Koh Samui – 1‑Hour Easy Jungle Drive', shopify_product_id: 8265142468802, category: 'Adventure' },
  { name: 'Advanced ATV Tour Koh Samui – 3‑Hour Off‑Road', shopify_product_id: 8265146269890, category: 'Adventure' },
  { name: 'Angthong Marine Park Big Boat Tour', shopify_product_id: 8265107964098, category: 'Group' },
  { name: 'Angthong Marine Park Premium Semi‑Private Speedboat', shopify_product_id: 8265108947138, category: 'Private' },
  { name: 'Angthong Marine Park Private Speedboat Charter', shopify_product_id: 8265109242050, category: 'Private' },
  { name: 'Angthong Marine Park Sailing Cruise', shopify_product_id: 8265105080514, category: 'Leisure' },
  { name: 'Angthong Marine Park VIP Speedboat Tour', shopify_product_id: 8265108226242, category: 'Group' },
  { name: 'Best Attractions Exclusive Excursion – Yacht Tour', shopify_product_id: 8265104687298, category: 'Private' },
  { name: 'Buggy 2hs', shopify_product_id: 8259570761922, category: 'Adventure' },
  { name: 'Buggy Adventure Koh Samui – 2-Hour Tour (NEW FORMAT)', shopify_product_id: 8285567549634, category: 'Adventure' },
  { name: 'Buggy Adventure Koh Samui – 2‑Hour Tour', shopify_product_id: 8265147547842, category: 'Adventure' },
  { name: 'Buggy Taster Koh Samui – 1‑Hour Short Trip', shopify_product_id: 8265146761410, category: 'Adventure' },
  { name: 'Buggy Tour Koh Samui – 3‑Hour Expedition', shopify_product_id: 8265147941058, category: 'Adventure' },
  { name: 'Elephant Food Package – Morning Feeding', shopify_product_id: 8265125593282, category: 'Nature' },
  { name: 'Elephant Museum & Jungle Walk', shopify_product_id: 8265126117570, category: 'Nature' },
  { name: 'Elephant Sanctuary', shopify_product_id: 8229682053314, category: 'Nature' },
  { name: 'Elephant Sanctuary Samui – Half‑Day', shopify_product_id: 8265135390914, category: 'Nature' },
  { name: 'Enduro Dirt Bike Tour Koh Samui – 2.5‑Hour', shopify_product_id: 8265139552450, category: 'Group' },
  { name: 'Exclusive Half‑Day Boat Tour to Koh Phangan', shopify_product_id: 8265104097474, category: 'Private' },
  { name: 'Exclusive Private Half‑Day Boat to Koh Phangan', shopify_product_id: 8265102885058, category: 'Private' },
  { name: 'Express Jet Ski Tour – 3‑Hour to Pig Island', shopify_product_id: 8265150169282, category: 'Adventure' },
  { name: 'Full‑Day Fishing & Swimming Boat Trip', shopify_product_id: 8265110782146, category: 'Leisure' },
  { name: 'Half‑Day Caring Elephants Program', shopify_product_id: 8265126936770, category: 'Nature' },
  { name: 'Jet Ski Rental – 1 Hour Freedom Ride', shopify_product_id: 8285471965378, category: 'Adventure' },
  { name: 'Jet Ski Rental – 2 Hours Coastal Explorer', shopify_product_id: 8285472030914, category: 'Adventure' },
  { name: 'Jet Ski Rental – 3 Hours Adventure Ride', shopify_product_id: 8285472096450, category: 'Adventure' },
  { name: 'Jet Ski Rental – 4 Hours Epic Expedition', shopify_product_id: 8285472129218, category: 'Adventure' },
  { name: 'Jet Ski Safari – Guided Island Hopping', shopify_product_id: 8285471768770, category: 'Adventure' },
  { name: 'Jet Ski Tour – 3‑Hour Discovery Koh Tan & Pig Island', shopify_product_id: 8265149874370, category: 'Adventure' },
  { name: 'Jet Ski Tour – 4‑Hour 5‑Island Adventure', shopify_product_id: 8265148629186, category: 'Adventure' },
  { name: 'Join Koh Samui Safari Tour – Full‑Day 4x4', shopify_product_id: 8265140699330, category: 'Nature' },
  { name: 'Koh Phangan Brunch Sailing Cruise', shopify_product_id: 8265099477186, category: 'Leisure' },
  { name: 'Koh Samui Elephant Home – Half‑Day', shopify_product_id: 8265128181954, category: 'Nature' },
  { name: 'Koh Samui Jungle Safari 4x4 Jeep Tour', shopify_product_id: 8265123037378, category: 'Nature' },
  { name: 'Koh Samui Muay Thai Tickets', shopify_product_id: 8265125265602, category: 'Group' },
  { name: 'Koh Samui Safari Tour – Full‑Day 4x4 (Join & Private)', shopify_product_id: 8265139847362, category: 'Private' },
  { name: 'Koh Samui Zipline Adventure', shopify_product_id: 8265124708546, category: 'Nature' },
  { name: 'Koh Tao & Koh Nang Yuan Snorkeling Day Trip', shopify_product_id: 8265109766338, category: 'Group' },
  { name: 'Luxury Angthong Marine Park Yacht Cruise', shopify_product_id: 8265110945986, category: 'Leisure' },
  { name: 'Luxury Sunset Yacht Cruise', shopify_product_id: 8265109602498, category: 'Private' },
  { name: 'Pig Island & Koh Tan Snorkeling by Speedboat', shopify_product_id: 8265093349570, category: 'Group' },
  { name: 'Pig Island VIP Longtail Boat Tour', shopify_product_id: 8265094922434, category: 'Group' },
  { name: 'Pig Island Sunset', shopify_product_id: 8259550970050, category: 'Group' },
  { name: 'Pink Dolphin Watching Tour – Khanom Coast', shopify_product_id: 8265098854594, category: 'Group' },
  { name: 'Private Boat Excursion to Koh Tao & Koh Nang Yuan', shopify_product_id: 8265111339202, category: 'Private' },
  { name: 'Private Koh Tan & Pig Island Snorkeling Charter', shopify_product_id: 8265097183426, category: 'Private' },
  { name: 'Romantic Sunset Sailing Cruise', shopify_product_id: 8265100198082, category: 'Leisure' },
  { name: 'Round‑Trip Transfer to Elephant Shelter Sanctuary', shopify_product_id: 8265127821506, category: 'Nature' },
  { name: 'Secret Islands Longtail Boat Adventure', shopify_product_id: 8265088532674, category: 'Group' },
  { name: 'Sunset Pig Island & Koh Tan Snorkel Trip', shopify_product_id: 8265095741634, category: 'Group' },
  { name: 'Thai Cooking Class – 4‑Hour Sea‑View', shopify_product_id: 8265125068994, category: 'Group' },
  { name: 'Ultimate Buggy Adventure – 4‑Hour Tour', shopify_product_id: 8265148235970, category: 'Adventure' },
]

const PROVIDERS = [
  'TIK01','TIK30','TIK31','TIK32','TIK33','TIK34','TIK35','TIK36','TIK37','TIK38',
  'TIK39','TIK40','TIK41','TIK42','TIK43','TIK44','TIK45','TIK46','TIK47','TIK48',
  'TIK49','TIK50','TIK51','TIK52','TIK53','TIK54','TIK55','TIK56','TIK57','TIK58',
  'TIK59','TIK60','TIK61','TIK62','TIK77','TIK78'
]

const PROGRAMS = ['Morning', 'Afternoon', 'Feeding', 'Museum']
const REASONS = ['Fully Booked', 'Weather', 'Maintenance', 'Provider Unavailable', 'Holiday', 'Other']
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const WEEKDAY_LABELS: Record<string, string> = { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun' }
const CATEGORIES = [...new Set(TOURS.map(t => t.category))].sort()

// ─── Helpers ─────────────────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isDateBlocked(dateStr: string, block: TourBlock): boolean {
  if (!block.is_active) return false
  const date = new Date(dateStr + 'T00:00:00')
  const dayOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][date.getDay()]
  const dayOfMonth = date.getDate()

  switch (block.block_type) {
    case 'always':
      if (block.blocked_weekdays?.length) return block.blocked_weekdays.includes(dayOfWeek)
      if (block.blocked_days_of_month?.length) return block.blocked_days_of_month.includes(dayOfMonth)
      return true
    case 'one_day':
      return block.blocked_date === dateStr
    case 'date_range':
      if (!block.start_date || !block.end_date) return false
      if (dateStr < block.start_date || dateStr > block.end_date) return false
      if (block.blocked_weekdays?.length) return block.blocked_weekdays.includes(dayOfWeek)
      if (block.blocked_days_of_month?.length) return block.blocked_days_of_month.includes(dayOfMonth)
      return true
    case 'recurring':
      if (block.blocked_weekdays?.length) return block.blocked_weekdays.includes(dayOfWeek)
      if (block.blocked_days_of_month?.length) return block.blocked_days_of_month.includes(dayOfMonth)
      return false
    default:
      return false
  }
}

// ─── Component ───────────────────────────────────────────────────
export default function TourBlocker() {
  const { user } = useAuth()
  const [blocks, setBlocks] = useState<TourBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [tourSearch, setTourSearch] = useState('')
  const [showTourDropdown, setShowTourDropdown] = useState(false)

  // Calendar state
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())

  // Filter state
  const [filterTour, setFilterTour] = useState('')
  const [filterProvider, setFilterProvider] = useState('')
  const [filterReason, setFilterReason] = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active')
  const [searchText, setSearchText] = useState('')

  // Form state
  const [form, setForm] = useState({
    tour_name: '',
    shopify_product_id: null as number | null,
    provider_id: '',
    program: '',
    block_type: 'one_day' as TourBlock['block_type'],
    blocked_date: new Date().toISOString().split('T')[0],
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    blocked_weekdays: [] as string[],
    blocked_days_of_month: [] as number[],
    day_mode: '' as '' | 'weekday' | 'day_of_month',
    reason: 'Other',
    notes: '',
    auto_unblock: true,
    is_active: true,
  })

  // ─── Data Loading ────────────────────────────────────────────
  const fetchBlocks = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tour_blocks')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) setBlocks(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchBlocks() }, [fetchBlocks])

  // ─── Filtered Blocks ─────────────────────────────────────────
  const filteredBlocks = useMemo(() => {
    return blocks.filter(b => {
      if (filterActive === 'active' && !b.is_active) return false
      if (filterActive === 'inactive' && b.is_active) return false
      if (filterTour && b.tour_name !== filterTour) return false
      if (filterProvider && b.provider_id !== filterProvider) return false
      if (filterReason && b.reason !== filterReason) return false
      if (searchText) {
        const s = searchText.toLowerCase()
        return (
          b.tour_name.toLowerCase().includes(s) ||
          (b.provider_id || '').toLowerCase().includes(s) ||
          (b.notes || '').toLowerCase().includes(s) ||
          (b.program || '').toLowerCase().includes(s)
        )
      }
      return true
    })
  }, [blocks, filterTour, filterProvider, filterReason, filterActive, searchText])

  // ─── Calendar Data ────────────────────────────────────────────
  const calendarBlockedDates = useMemo(() => {
    const daysInMonth = getDaysInMonth(calYear, calMonth)
    const blocked: Record<string, { count: number; reasons: string[] }> = {}

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const matching = filteredBlocks.filter(b => b.is_active && isDateBlocked(dateStr, b))
      if (matching.length > 0) {
        blocked[dateStr] = {
          count: matching.length,
          reasons: [...new Set(matching.map(m => m.reason))]
        }
      }
    }
    return blocked
  }, [filteredBlocks, calMonth, calYear])

  // ─── Form Handlers ────────────────────────────────────────────
  function resetForm() {
    setForm({
      tour_name: '', shopify_product_id: null, provider_id: '', program: '',
      block_type: 'one_day', blocked_date: new Date().toISOString().split('T')[0],
      start_date: new Date().toISOString().split('T')[0], end_date: '',
      blocked_weekdays: [], blocked_days_of_month: [], day_mode: '',
      reason: 'Other', notes: '', auto_unblock: true, is_active: true,
    })
    setEditingId(null)
    setShowForm(false)
    setTourSearch('')
    setShowTourDropdown(false)
  }

  function handleTourSelect(tourName: string) {
    const tour = TOURS.find(t => t.name === tourName)
    setForm(f => ({
      ...f,
      tour_name: tourName,
      shopify_product_id: tour?.shopify_product_id || null
    }))
  }

  function toggleWeekday(day: string) {
    setForm(f => ({
      ...f,
      blocked_weekdays: f.blocked_weekdays.includes(day)
        ? f.blocked_weekdays.filter(d => d !== day)
        : [...f.blocked_weekdays, day]
    }))
  }

  function toggleDayOfMonth(day: number) {
    setForm(f => ({
      ...f,
      blocked_days_of_month: f.blocked_days_of_month.includes(day)
        ? f.blocked_days_of_month.filter(d => d !== day)
        : [...f.blocked_days_of_month, day]
    }))
  }

  function startEdit(block: TourBlock) {
    const hasDayMode = (block.blocked_weekdays?.length || 0) > 0
      ? 'weekday'
      : (block.blocked_days_of_month?.length || 0) > 0
        ? 'day_of_month'
        : ''

    setForm({
      tour_name: block.tour_name,
      shopify_product_id: block.shopify_product_id,
      provider_id: block.provider_id || '',
      program: block.program || '',
      block_type: block.block_type,
      blocked_date: block.blocked_date || new Date().toISOString().split('T')[0],
      start_date: block.start_date || new Date().toISOString().split('T')[0],
      end_date: block.end_date || '',
      blocked_weekdays: block.blocked_weekdays || [],
      blocked_days_of_month: block.blocked_days_of_month || [],
      day_mode: hasDayMode,
      reason: block.reason,
      notes: block.notes || '',
      auto_unblock: block.auto_unblock,
      is_active: block.is_active,
    })
    setEditingId(block.id)
    setShowForm(true)
  }

  async function handleDuplicate(block: TourBlock) {
    setSaving(true)
    const { error } = await supabase.from('tour_blocks').insert({
      tour_name: block.tour_name,
      shopify_product_id: block.shopify_product_id,
      provider_id: block.provider_id,
      program: block.program,
      block_type: block.block_type,
      blocked_date: block.blocked_date,
      start_date: block.start_date,
      end_date: block.end_date,
      blocked_weekdays: block.blocked_weekdays,
      blocked_days_of_month: block.blocked_days_of_month,
      reason: block.reason,
      notes: block.notes ? `${block.notes} (copy)` : '(copy)',
      auto_unblock: block.auto_unblock,
      is_active: block.is_active,
      created_by: user?.name || 'unknown',
    })
    if (!error) await fetchBlocks()
    setSaving(false)
  }

  async function toggleActive(block: TourBlock) {
    const { error } = await supabase
      .from('tour_blocks')
      .update({ is_active: !block.is_active })
      .eq('id', block.id)
    if (!error) await fetchBlocks()
  }

  async function handleSubmit() {
    if (!form.tour_name) return alert('Select a tour')

    setSaving(true)
    const payload: Partial<TourBlock> = {
      tour_name: form.tour_name,
      shopify_product_id: form.shopify_product_id,
      provider_id: form.provider_id || null,
      program: form.program || null,
      block_type: form.block_type,
      blocked_date: form.block_type === 'one_day' ? form.blocked_date : null,
      start_date: form.block_type === 'date_range' ? form.start_date : null,
      end_date: form.block_type === 'date_range' ? form.end_date : null,
      blocked_weekdays: form.day_mode === 'weekday' && form.blocked_weekdays.length > 0 ? form.blocked_weekdays : null,
      blocked_days_of_month: form.day_mode === 'day_of_month' && form.blocked_days_of_month.length > 0 ? form.blocked_days_of_month : null,
      reason: form.reason,
      notes: form.notes || null,
      auto_unblock: form.auto_unblock,
      is_active: form.is_active,
      created_by: user?.name || 'unknown',
    }

    if (editingId) {
      await supabase.from('tour_blocks').update(payload).eq('id', editingId)
    } else {
      await supabase.from('tour_blocks').insert(payload)
    }

    await fetchBlocks()
    resetForm()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('tour_blocks').delete().eq('id', id)
    setDeleteConfirm(null)
    await fetchBlocks()
  }

  // ─── Calendar click to create block ────────────────────────────
  function handleCalendarClick(dateStr: string) {
    setForm(f => ({ ...f, block_type: 'one_day', blocked_date: dateStr }))
    setEditingId(null)
    setShowForm(true)
  }

  // ─── Block type badge ──────────────────────────────────────────
  function blockTypeBadge(block: TourBlock) {
    const colors: Record<string, string> = {
      always: 'bg-red-100 text-red-700',
      one_day: 'bg-blue-100 text-blue-700',
      date_range: 'bg-purple-100 text-purple-700',
      recurring: 'bg-amber-100 text-amber-700',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors[block.block_type] || 'bg-gray-100 text-gray-700'}`}>
        {block.block_type.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  function reasonBadge(reason: string) {
    const colors: Record<string, string> = {
      'Fully Booked': 'bg-red-50 text-red-600',
      'Weather': 'bg-sky-50 text-sky-600',
      'Maintenance': 'bg-orange-50 text-orange-600',
      'Provider Unavailable': 'bg-yellow-50 text-yellow-600',
      'Holiday': 'bg-green-50 text-green-600',
      'Other': 'bg-gray-50 text-gray-500',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[reason] || 'bg-gray-100 text-gray-500'}`}>
        {reason}
      </span>
    )
  }

  function blockDateDisplay(block: TourBlock) {
    switch (block.block_type) {
      case 'always': {
        const parts: string[] = []
        if (block.blocked_weekdays?.length) parts.push(`Every ${block.blocked_weekdays.map(d => WEEKDAY_LABELS[d] || d).join(', ')}`)
        if (block.blocked_days_of_month?.length) parts.push(`Day ${block.blocked_days_of_month.join(', ')} of month`)
        return parts.length > 0 ? parts.join(' · ') : 'Permanently blocked'
      }
      case 'one_day':
        return block.blocked_date ? formatDate(block.blocked_date) : '—'
      case 'date_range': {
        const range = `${block.start_date ? formatDate(block.start_date) : '?'} → ${block.end_date ? formatDate(block.end_date) : '?'}`
        const parts: string[] = [range]
        if (block.blocked_weekdays?.length) parts.push(`(${block.blocked_weekdays.map(d => WEEKDAY_LABELS[d] || d).join(', ')} only)`)
        if (block.blocked_days_of_month?.length) parts.push(`(Day ${block.blocked_days_of_month.join(', ')} only)`)
        return parts.join(' ')
      }
      case 'recurring': {
        const parts: string[] = []
        if (block.blocked_weekdays?.length) parts.push(`Every ${block.blocked_weekdays.map(d => WEEKDAY_LABELS[d] || d).join(', ')}`)
        if (block.blocked_days_of_month?.length) parts.push(`Day ${block.blocked_days_of_month.join(', ')} of each month`)
        return parts.join(' · ') || 'Recurring'
      }
      default: return '—'
    }
  }

  // ─── Unique tour names from blocks for filter ──────────────────
  const uniqueBlockTours = useMemo(() => [...new Set(blocks.map(b => b.tour_name))].sort(), [blocks])
  const uniqueBlockProviders = useMemo(() => [...new Set(blocks.map(b => b.provider_id).filter(Boolean))].sort(), [blocks])

  // ─── Stats ─────────────────────────────────────────────────────
  const activeCount = blocks.filter(b => b.is_active).length
  const todayStr = new Date().toISOString().split('T')[0]
  const blockedTodayList = blocks.filter(b => b.is_active && isDateBlocked(todayStr, b))
  const blockedToday = blockedTodayList.length

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="fade-in lg:h-full lg:overflow-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Tour Availability Blocker</h1>
          <p className="text-gray-500 mt-1">Manage tour blocks, blackout dates & recurring restrictions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={fetchBlocks} className="neu-flat px-4 py-2 flex items-center gap-2 text-sm text-gray-600">
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={() => { resetForm(); setShowForm(true) }} className="neu-btn-accent px-4 py-2 flex items-center gap-2 text-sm">
            <Plus size={16} /> New Block
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="neu-card p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Total Blocks</p>
          <p className="text-2xl font-bold text-[#2D3748]">{blocks.length}</p>
        </div>
        <div className="neu-card p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Active Blocks</p>
          <p className="text-2xl font-bold text-[#9370DB]">{activeCount}</p>
        </div>
        <div className="neu-card p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Blocked Today</p>
          <p className="text-2xl font-bold text-[#FF6B6B]">{blockedToday}</p>
        </div>
        <div className="neu-card p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Tours Affected</p>
          <p className="text-2xl font-bold text-[#00CED1]">{new Set(blocks.filter(b => b.is_active).map(b => b.tour_name)).size}</p>
        </div>
      </div>

      {/* Calendar + Filters Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Calendar */}
        <div className="neu-card p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#2D3748] flex items-center gap-2">
              <Calendar size={20} /> Block Calendar
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }} className="p-2 rounded-lg hover:bg-gray-100">
                <ChevronLeft size={18} />
              </button>
              <span className="font-bold text-[#2D3748] min-w-[140px] text-center">
                {new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }} className="p-2 rounded-lg hover:bg-gray-100">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-bold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: getFirstDayOfWeek(calYear, calMonth) }).map((_, i) => (
              <div key={`empty-${i}`} className="h-12 lg:h-14" />
            ))}
            {Array.from({ length: getDaysInMonth(calYear, calMonth) }).map((_, i) => {
              const day = i + 1
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const info = calendarBlockedDates[dateStr]
              const isToday = dateStr === todayStr
              const isPast = dateStr < todayStr

              return (
                <button
                  key={day}
                  onClick={() => handleCalendarClick(dateStr)}
                  className={`h-12 lg:h-14 rounded-lg text-sm font-medium relative transition-all
                    ${info ? 'bg-red-50 hover:bg-red-100 border border-red-200' : 'hover:bg-gray-50 border border-transparent'}
                    ${isToday ? 'ring-2 ring-[#9370DB] ring-offset-1' : ''}
                    ${isPast && !info ? 'text-gray-300' : 'text-[#2D3748]'}
                  `}
                >
                  <span className={`${info ? 'text-red-600 font-bold' : ''}`}>{day}</span>
                  {info && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {info.count <= 3
                        ? Array.from({ length: info.count }).map((_, j) => (
                            <span key={j} className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          ))
                        : <span className="text-[10px] font-bold text-red-500">{info.count}</span>
                      }
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Blocked
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded ring-2 ring-[#9370DB]" /> Today
            </div>
            <span className="text-gray-400">Click any date to create a block</span>
          </div>
        </div>

        {/* Filters */}
        <div className="neu-card p-6">
          <h2 className="text-lg font-bold text-[#2D3748] flex items-center gap-2 mb-4">
            <Filter size={20} /> Filters
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="Tour, provider, notes..."
                  className="neu-input w-full pl-9 pr-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tour</label>
              <select value={filterTour} onChange={e => setFilterTour(e.target.value)} className="neu-input w-full px-3 py-2 text-sm">
                <option value="">All Tours</option>
                {uniqueBlockTours.map(t => <option key={t} value={t}>{t.length > 40 ? t.slice(0, 40) + '…' : t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Provider</label>
              <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)} className="neu-input w-full px-3 py-2 text-sm">
                <option value="">All Providers</option>
                {(uniqueBlockProviders as string[]).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Reason</label>
              <select value={filterReason} onChange={e => setFilterReason(e.target.value)} className="neu-input w-full px-3 py-2 text-sm">
                <option value="">All Reasons</option>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
              <div className="flex gap-1">
                {(['all', 'active', 'inactive'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterActive(s)}
                    className={`flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-colors capitalize ${
                      filterActive === s ? 'bg-[#9370DB] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >{s}</button>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setFilterTour(''); setFilterProvider(''); setFilterReason(''); setFilterActive('active'); setSearchText('') }}
              className="w-full text-center text-xs text-[#9370DB] font-semibold py-2 hover:underline"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      </div>

      {/* ─── BLOCKED RIGHT NOW ─────────────────────────────────── */}
      {blockedTodayList.length > 0 && (
        <div className="neu-card p-6 mb-6 border-l-4 border-l-red-400">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#FF6B6B] flex items-center gap-2">
              <AlertTriangle size={20} /> Blocked Right Now — {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </h2>
            <span className="text-sm font-bold text-red-500 bg-red-50 px-3 py-1 rounded-full">
              {blockedTodayList.length} tour{blockedTodayList.length > 1 ? 's' : ''} blocked
            </span>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {blockedTodayList.map(block => (
              <div key={block.id} className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl border border-red-100">
                <div className="w-2 h-10 rounded-full bg-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[#2D3748] text-sm truncate max-w-[280px]">{block.tour_name}</span>
                    {reasonBadge(block.reason)}
                    {block.program && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600">{block.program}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                    <span>{blockDateDisplay(block)}</span>
                    {block.provider_id && <span className="font-semibold text-[#9370DB]">{block.provider_id}</span>}
                    {block.notes && <span className="italic text-gray-400 truncate max-w-[150px]">"{block.notes}"</span>}
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(block)}
                  className="shrink-0 px-4 py-2 bg-white border border-red-200 text-red-600 font-bold text-xs rounded-xl hover:bg-red-500 hover:text-white hover:border-red-500 transition-all flex items-center gap-1.5"
                >
                  <PowerOff size={14} /> Unblock
                </button>
                <button
                  onClick={() => startEdit(block)}
                  className="shrink-0 p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocks List */}
      <div className="neu-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#2D3748] flex items-center gap-2">
            <ShieldBan size={20} /> Active Blocks ({filteredBlocks.length})
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="spinner w-10 h-10"></div>
          </div>
        ) : filteredBlocks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ShieldBan size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No blocks found</p>
            <p className="text-sm mt-1">Create a new block to restrict tour availability</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredBlocks.map(block => (
              <div
                key={block.id}
                className={`p-4 rounded-xl border transition-all ${
                  block.is_active
                    ? 'bg-white border-gray-100 hover:border-[#9370DB]/30 hover:shadow-sm'
                    : 'bg-gray-50 border-gray-100 opacity-60'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-[#2D3748] text-sm truncate max-w-[300px]">{block.tour_name}</span>
                      {blockTypeBadge(block)}
                      {reasonBadge(block.reason)}
                      {block.program && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600">
                          {block.program}
                        </span>
                      )}
                      {!block.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-500">INACTIVE</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>{blockDateDisplay(block)}</span>
                      {block.provider_id && (
                        <span className="text-xs font-semibold text-[#9370DB]">{block.provider_id}</span>
                      )}
                      {block.notes && (
                        <span className="text-xs text-gray-400 italic truncate max-w-[200px]">"{block.notes}"</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleActive(block)} className={`p-2 rounded-lg transition-colors ${block.is_active ? 'hover:bg-red-50 text-gray-400 hover:text-red-500' : 'hover:bg-green-50 text-gray-400 hover:text-green-500'}`} title={block.is_active ? 'Deactivate' : 'Activate'}>
                      {block.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                    </button>
                    <button onClick={() => startEdit(block)} className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors" title="Edit">
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDuplicate(block)} className="p-2 rounded-lg hover:bg-purple-50 text-gray-400 hover:text-purple-500 transition-colors" title="Duplicate">
                      <Copy size={16} />
                    </button>
                    {deleteConfirm === block.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(block.id)} className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setDeleteConfirm(null)} className="p-2 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(block.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── CREATE / EDIT MODAL ──────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-8 lg:pt-16 overflow-y-auto">
          <div className="neu-card p-6 w-full max-w-2xl mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-[#2D3748]">
                {editingId ? 'Edit Block' : 'Create New Block'}
              </h3>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Tour Selection - Searchable */}
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Tour *</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={showTourDropdown ? tourSearch : form.tour_name}
                    onChange={e => { setTourSearch(e.target.value); setShowTourDropdown(true) }}
                    onFocus={() => { setShowTourDropdown(true); setTourSearch('') }}
                    placeholder="Search tours by name..."
                    className="neu-input w-full pl-9 pr-8 py-2.5 text-sm"
                  />
                  {form.tour_name && (
                    <button
                      onClick={() => { handleTourSelect(''); setTourSearch(''); setShowTourDropdown(false) }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {showTourDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowTourDropdown(false)} />
                    <div className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
                      {(() => {
                        const q = tourSearch.toLowerCase()
                        const filtered = TOURS.filter(t => t.name.toLowerCase().includes(q))
                        if (filtered.length === 0) return (
                          <div className="px-4 py-3 text-sm text-gray-400">No tours match "{tourSearch}"</div>
                        )
                        const grouped: Record<string, TourOption[]> = {}
                        filtered.forEach(t => {
                          if (!grouped[t.category]) grouped[t.category] = []
                          grouped[t.category].push(t)
                        })
                        return Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).map(([cat, tours]) => (
                          <div key={cat}>
                            <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">{cat}</div>
                            {tours.map(t => (
                              <button
                                key={t.shopify_product_id}
                                onClick={() => { handleTourSelect(t.name); setTourSearch(''); setShowTourDropdown(false) }}
                                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#9370DB]/10 transition-colors ${
                                  form.tour_name === t.name ? 'bg-[#9370DB]/10 text-[#9370DB] font-semibold' : 'text-[#2D3748]'
                                }`}
                              >
                                {t.name}
                              </button>
                            ))}
                          </div>
                        ))
                      })()}
                    </div>
                  </>
                )}
              </div>

              {/* Provider + Program row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Provider (optional)</label>
                  <select value={form.provider_id} onChange={e => setForm(f => ({ ...f, provider_id: e.target.value }))} className="neu-input w-full px-3 py-2.5 text-sm">
                    <option value="">All Providers</option>
                    {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Program (optional)</label>
                  <select value={form.program} onChange={e => setForm(f => ({ ...f, program: e.target.value }))} className="neu-input w-full px-3 py-2.5 text-sm">
                    <option value="">All Programs</option>
                    {PROGRAMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Block Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Block Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'one_day', label: 'One Day' },
                    { value: 'date_range', label: 'Date Range' },
                    { value: 'always', label: 'Always' },
                    { value: 'recurring', label: 'Recurring' },
                  ].map(bt => (
                    <button
                      key={bt.value}
                      onClick={() => setForm(f => ({ ...f, block_type: bt.value as TourBlock['block_type'] }))}
                      className={`px-3 py-2.5 text-xs font-bold rounded-xl transition-all ${
                        form.block_type === bt.value
                          ? 'bg-[#9370DB] text-white shadow-md'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >{bt.label}</button>
                  ))}
                </div>
              </div>

              {/* Date fields based on block type */}
              {form.block_type === 'one_day' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Blocked Date</label>
                  <input
                    type="date"
                    value={form.blocked_date}
                    onChange={e => setForm(f => ({ ...f, blocked_date: e.target.value }))}
                    className="neu-input w-full px-3 py-2.5 text-sm"
                  />
                </div>
              )}

              {form.block_type === 'date_range' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Start Date</label>
                    <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="neu-input w-full px-3 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">End Date</label>
                    <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="neu-input w-full px-3 py-2.5 text-sm" />
                  </div>
                </div>
              )}

              {/* Day mode for always, date_range, recurring */}
              {(form.block_type === 'always' || form.block_type === 'date_range' || form.block_type === 'recurring') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Day Pattern {form.block_type !== 'recurring' ? '(optional)' : ''}
                  </label>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setForm(f => ({ ...f, day_mode: f.day_mode === 'weekday' ? '' : 'weekday', blocked_days_of_month: [] }))}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                        form.day_mode === 'weekday' ? 'bg-[#00CED1] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >By Weekday</button>
                    <button
                      onClick={() => setForm(f => ({ ...f, day_mode: f.day_mode === 'day_of_month' ? '' : 'day_of_month', blocked_weekdays: [] }))}
                      className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                        form.day_mode === 'day_of_month' ? 'bg-[#00CED1] text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >By Day of Month</button>
                  </div>

                  {form.day_mode === 'weekday' && (
                    <div className="flex gap-1.5 flex-wrap">
                      {WEEKDAYS.map(d => (
                        <button
                          key={d}
                          onClick={() => toggleWeekday(d)}
                          className={`w-11 h-11 rounded-lg text-xs font-bold transition-all ${
                            form.blocked_weekdays.includes(d)
                              ? 'bg-[#FF6B6B] text-white shadow-md'
                              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                          }`}
                        >{WEEKDAY_LABELS[d]}</button>
                      ))}
                    </div>
                  )}

                  {form.day_mode === 'day_of_month' && (
                    <div className="grid grid-cols-7 gap-1.5">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <button
                          key={d}
                          onClick={() => toggleDayOfMonth(d)}
                          className={`h-9 rounded-lg text-xs font-bold transition-all ${
                            form.blocked_days_of_month.includes(d)
                              ? 'bg-[#FF6B6B] text-white shadow-md'
                              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                          }`}
                        >{d}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reason + Auto Unblock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Reason</label>
                  <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} className="neu-input w-full px-3 py-2.5 text-sm">
                    {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="flex flex-col justify-end gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.auto_unblock}
                      onChange={e => setForm(f => ({ ...f, auto_unblock: e.target.checked }))}
                      className="w-4 h-4 rounded text-[#9370DB] focus:ring-[#9370DB]"
                    />
                    <span className="text-sm text-gray-600 font-medium">Auto-unblock after date</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4 rounded text-[#9370DB] focus:ring-[#9370DB]"
                    />
                    <span className="text-sm text-gray-600 font-medium">Active</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Internal notes about this block..."
                  rows={2}
                  className="neu-input w-full px-3 py-2.5 text-sm resize-none"
                />
              </div>

              {/* Conflict warning */}
              {form.tour_name && form.block_type === 'one_day' && form.blocked_date && (
                (() => {
                  const conflicts = blocks.filter(b =>
                    b.is_active && b.tour_name === form.tour_name && b.id !== editingId &&
                    isDateBlocked(form.blocked_date, b)
                  )
                  if (conflicts.length === 0) return null
                  return (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-700">
                        <span className="font-bold">Conflict detected:</span> This tour already has {conflicts.length} block(s) on this date.
                        {conflicts.map(c => (
                          <span key={c.id} className="block text-xs mt-1">• {c.reason} ({c.block_type.replace('_', ' ')}){c.provider_id ? ` — ${c.provider_id}` : ''}</span>
                        ))}
                      </div>
                    </div>
                  )
                })()
              )}

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button onClick={resetForm} className="flex-1 neu-flat px-4 py-3 text-sm font-bold text-gray-500">
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !form.tour_name}
                  className="flex-1 neu-btn-accent px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
                  {editingId ? 'Update Block' : 'Create Block'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
