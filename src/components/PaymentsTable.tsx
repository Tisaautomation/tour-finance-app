import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, ShopifyOrder, OrderPayment, PAYMENT_METHODS } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Search, Download, RefreshCw, DollarSign, Plus, X,
  ChevronDown, ChevronUp, Clock, CheckCircle, AlertCircle, XCircle,
  Receipt, ArrowDownCircle, ArrowUpCircle, Percent, FileText, Calendar,
  Banknote, TrendingUp
} from 'lucide-react'

interface OrderWithPayments {
  order: ShopifyOrder
  payments: OrderPayment[]
  totalPaid: number
  totalRefunded: number
  totalDiscounts: number
  totalAdjustments: number
  balanceDue: number
  paymentStatus: 'unpaid' | 'deposit' | 'paid' | 'overpaid' | 'refunded' | 'partial_refund'
}

const STATUS_CONFIG = {
  unpaid: { label: 'Unpaid', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  deposit: { label: 'Deposit', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  overpaid: { label: 'Overpaid', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: AlertCircle },
  refunded: { label: 'Refunded', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: XCircle },
  partial_refund: { label: 'Partial Refund', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertCircle },
}

function calcPaymentStatus(order: ShopifyOrder, payments: OrderPayment[]): OrderWithPayments {
  const byType = (t: string) => payments.filter(p => p.type === t).reduce((s, p) => s + Number(p.amount), 0)
  const totalPaid = byType('payment')
  const totalRefunded = byType('refund')
  const totalDiscounts = byType('discount')
  const totalAdjustments = byType('adjustment')
  const effectivePaid = totalPaid - totalRefunded
  const orderTotal = Number(order.total_amount) - totalDiscounts + totalAdjustments
  const balanceDue = Math.max(0, orderTotal - effectivePaid)

  let paymentStatus: OrderWithPayments['paymentStatus'] = 'unpaid'
  if (totalRefunded > 0 && effectivePaid <= 0) paymentStatus = 'refunded'
  else if (totalRefunded > 0 && effectivePaid > 0) paymentStatus = 'partial_refund'
  else if (effectivePaid >= orderTotal && orderTotal > 0) paymentStatus = effectivePaid > orderTotal ? 'overpaid' : 'paid'
  else if (effectivePaid > 0) paymentStatus = 'deposit'

  return { order, payments, totalPaid, totalRefunded, totalDiscounts, totalAdjustments, balanceDue, paymentStatus }
}

function fmtTHB(n: number) { return `฿${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` }
function fmtDateTime(d: string) { return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }

export default function PaymentsTable() {
  const { user, hasPermission } = useAuth()
  const [orders, setOrders] = useState<ShopifyOrder[]>([])
  const [allPayments, setAllPayments] = useState<OrderPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Form state
  const [formType, setFormType] = useState<'payment' | 'refund' | 'discount' | 'adjustment'>('payment')
  const [formAmount, setFormAmount] = useState('')
  const [formMethod, setFormMethod] = useState('revolut')
  const [formRef, setFormRef] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const canEdit = hasPermission('canManagePayments' as 'canEditOrders')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: od }, { data: pd }] = await Promise.all([
      supabase.from('shopify_orders').select('*').order('received_at', { ascending: false }).limit(1000),
      supabase.from('order_payments').select('*').order('created_at', { ascending: false }),
    ])
    if (od) setOrders(od)
    if (pd) setAllPayments(pd)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Build enriched orders with payment data
  const enrichedOrders = useMemo(() => {
    const payMap = new Map<string, OrderPayment[]>()
    allPayments.forEach(p => {
      const key = p.shopify_order_number
      if (!payMap.has(key)) payMap.set(key, [])
      payMap.get(key)!.push(p)
    })
    return orders.map(o => calcPaymentStatus(o, payMap.get(o.shopify_order_number) || []))
  }, [orders, allPayments])

  // Filtered
  const filtered = useMemo(() => {
    return enrichedOrders.filter(eo => {
      const raw = eo.order.raw_data || {}
      const note = (raw as Record<string, string>).note || ''
      const matchSearch = !search ||
        eo.order.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        eo.order.shopify_order_number?.includes(search) ||
        eo.order.product_title?.toLowerCase().includes(search.toLowerCase()) ||
        note.toLowerCase().includes(search.toLowerCase())
      const matchStatus = !statusFilter || eo.paymentStatus === statusFilter
      const matchDate = !dateFilter || eo.order.tour_date === dateFilter ||
        note.includes(dateFilter) ||
        eo.order.received_at?.startsWith(dateFilter)
      return matchSearch && matchStatus && matchDate
    })
  }, [enrichedOrders, search, statusFilter, dateFilter])

  // Summary stats
  const stats = useMemo(() => {
    const total = enrichedOrders.reduce((s, eo) => s + Number(eo.order.total_amount), 0)
    const collected = enrichedOrders.reduce((s, eo) => s + eo.totalPaid - eo.totalRefunded, 0)
    const outstanding = enrichedOrders.reduce((s, eo) => s + eo.balanceDue, 0)
    const unpaidCount = enrichedOrders.filter(eo => eo.paymentStatus === 'unpaid').length
    const depositCount = enrichedOrders.filter(eo => eo.paymentStatus === 'deposit').length
    const paidCount = enrichedOrders.filter(eo => eo.paymentStatus === 'paid' || eo.paymentStatus === 'overpaid').length
    // Today's collections
    const today = new Date().toISOString().split('T')[0]
    const todayCollected = allPayments
      .filter(p => p.type === 'payment' && p.created_at.startsWith(today))
      .reduce((s, p) => s + Number(p.amount), 0)
    return { total, collected, outstanding, unpaidCount, depositCount, paidCount, todayCollected }
  }, [enrichedOrders, allPayments])

  const handleSubmit = async (orderNumber: string) => {
    if (!formAmount || Number(formAmount) <= 0) return
    setSaving(true); setMsg('')
    try {
      const { error } = await supabase.from('order_payments').insert({
        shopify_order_number: orderNumber,
        type: formType,
        amount: Number(formAmount),
        method: formType === 'payment' ? formMethod : null,
        reference: formRef.trim() || null,
        notes: formNotes.trim() || null,
        recorded_by: user?.name || user?.email || 'admin',
      })
      if (error) throw error
      setMsg(`✅ ${formType} of ${fmtTHB(Number(formAmount))} recorded`)
      setFormAmount(''); setFormRef(''); setFormNotes(''); setFormType('payment')
      // Refresh payments only
      const { data: pd } = await supabase.from('order_payments').select('*').order('created_at', { ascending: false })
      if (pd) setAllPayments(pd)
      setTimeout(() => setMsg(''), 3000)
    } catch (e: unknown) {
      setMsg('❌ ' + (e instanceof Error ? e.message : 'Error'))
    }
    setSaving(false)
  }

  const deletePayment = async (id: string) => {
    if (!confirm('Delete this transaction? This cannot be undone.')) return
    const { error } = await supabase.from('order_payments').delete().eq('id', id)
    if (!error) {
      setAllPayments(prev => prev.filter(p => p.id !== id))
      setMsg('✅ Transaction deleted')
      setTimeout(() => setMsg(''), 3000)
    }
  }

  const exportCSV = () => {
    if (!hasPermission('canExport')) return
    const csv = [
      ['Order #', 'Customer', 'Product', 'Tour Date', 'Total', 'Paid', 'Refunded', 'Discounts', 'Balance', 'Status'],
      ...filtered.map(eo => {
        const raw = eo.order.raw_data || {}
        const note = (raw as Record<string, string>).note || ''
        const tourDate = eo.order.tour_date || note.split('|')[1]?.trim() || ''
        return [
          eo.order.shopify_order_number, eo.order.customer_name, eo.order.product_title || '',
          tourDate, eo.order.total_amount, eo.totalPaid, eo.totalRefunded, eo.totalDiscounts,
          eo.balanceDue, eo.paymentStatus,
        ]
      })
    ].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  return (
    <div className="fade-in lg:h-full lg:overflow-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Payments</h1>
          <p className="text-gray-500 mt-1">{enrichedOrders.length} orders &middot; {allPayments.length} transactions recorded</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="neu-btn px-3 py-2"><RefreshCw size={16} className="text-gray-500" /></button>
          {hasPermission('canExport') && <button onClick={exportCSV} className="neu-btn px-4 py-2 flex items-center gap-2 text-sm"><Download size={16} /> Export</button>}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="neu-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}>
            <TrendingUp className="text-white" size={18} /></div>
          <div><p className="text-xs text-gray-500">Today Collected</p>
            <p className="text-lg font-bold text-green-600">{fmtTHB(stats.todayCollected)}</p></div>
        </div>
        <div className="neu-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500">
            <Banknote className="text-white" size={18} /></div>
          <div><p className="text-xs text-gray-500">Outstanding</p>
            <p className="text-lg font-bold text-red-600">{fmtTHB(stats.outstanding)}</p></div>
        </div>
        <div className="neu-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00b4d8, #9b5de5)' }}>
            <DollarSign className="text-white" size={18} /></div>
          <div><p className="text-xs text-gray-500">Total Collected</p>
            <p className="text-lg font-bold text-gray-800">{fmtTHB(stats.collected)}</p></div>
        </div>
        <div className="neu-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-500">
            <Clock className="text-white" size={18} /></div>
          <div><p className="text-xs text-gray-500">Unpaid / Deposit</p>
            <p className="text-lg font-bold text-amber-600">{stats.unpaidCount} / {stats.depositCount}</p></div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
          <input type="text" placeholder="Search order, customer, product..." value={search} onChange={e => setSearch(e.target.value)}
            className="neu-input w-full pl-11 pr-4 py-3" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="neu-input px-4 py-3">
          <option value="">All Status</option>
          <option value="unpaid">Unpaid</option>
          <option value="deposit">Deposit</option>
          <option value="paid">Paid</option>
          <option value="overpaid">Overpaid</option>
          <option value="refunded">Refunded</option>
          <option value="partial_refund">Partial Refund</option>
        </select>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-400" />
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="neu-input px-4 py-3" />
          {dateFilter && <button onClick={() => setDateFilter('')} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>}
        </div>
      </div>

      {/* Quick Filter Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['unpaid', 'deposit', 'paid', 'refunded'] as const).map(s => {
          const count = enrichedOrders.filter(eo => eo.paymentStatus === s).length
          if (!count) return null
          const cfg = STATUS_CONFIG[s]
          const active = statusFilter === s
          return (
            <button key={s} onClick={() => setStatusFilter(active ? '' : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${active ? cfg.color + ' ring-2 ring-offset-1 ring-gray-300' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
              {cfg.label} ({count})
            </button>
          )
        })}
        {statusFilter && <button onClick={() => setStatusFilter('')} className="px-3 py-1.5 rounded-full text-xs text-red-500 hover:bg-red-50 border border-red-200">Clear filter</button>}
      </div>

      {msg && <div className={`mb-4 px-4 py-2 rounded-xl text-sm font-semibold ${msg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</div>}

      {/* Orders List */}
      {loading ? <div className="text-center py-12 text-gray-400">Loading payments...</div>
      : filtered.length === 0 ? <div className="text-center py-12"><Receipt className="mx-auto text-gray-300 mb-3" size={48} /><p className="text-gray-400">No orders found</p></div>
      : <div className="space-y-3">
          {/* Results count */}
          <p className="text-xs text-gray-400 px-1">{filtered.length} order{filtered.length !== 1 ? 's' : ''} shown</p>

          {filtered.map(eo => {
            const isExp = expandedId === eo.order.id
            const cfg = STATUS_CONFIG[eo.paymentStatus]
            const StatusIcon = cfg.icon
            const raw = eo.order.raw_data || {}
            const note = (raw as Record<string, string>).note || ''
            const noteParts = note.split('|').map((s: string) => s.trim())
            const tourDate = eo.order.tour_date || noteParts[1] || ''
            const pax = noteParts[0] || `${eo.order.adults}A/${eo.order.children}C`

            return (
              <div key={eo.order.id} className="neu-card overflow-hidden">
                {/* Order Row */}
                <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpandedId(isExp ? null : eo.order.id)}>
                  {/* Status indicator */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${cfg.color}`}>
                    <StatusIcon size={18} />
                  </div>

                  {/* Order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800">#TIK{eo.order.shopify_order_number}</span>
                      <span className="text-sm text-gray-600 truncate">{eo.order.customer_name}</span>
                      {eo.payments.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600">{eo.payments.length} tx</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                      {eo.order.product_title && <span className="truncate max-w-[200px]">{eo.order.product_title}</span>}
                      {tourDate && <span className="flex items-center gap-1"><Calendar size={10} />{tourDate}</span>}
                      {pax && <span>{pax}</span>}
                    </div>
                  </div>

                  {/* Amount + Balance */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-800">{fmtTHB(Number(eo.order.total_amount))}</p>
                    {eo.balanceDue > 0 && (
                      <p className="text-xs font-semibold text-red-500">Due: {fmtTHB(eo.balanceDue)}</p>
                    )}
                    {eo.paymentStatus === 'paid' && (
                      <p className="text-xs font-semibold text-green-600">Paid in full</p>
                    )}
                  </div>

                  {/* Status badge + chevron */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium border hidden sm:inline-block ${cfg.color}`}>{cfg.label}</span>
                    {isExp ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded Panel */}
                {isExp && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    {/* Payment Summary Bar */}
                    <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-5 gap-3 border-b border-gray-100">
                      <div><p className="text-[10px] text-gray-400 uppercase tracking-wide">Order Total</p>
                        <p className="text-sm font-bold text-gray-800">{fmtTHB(Number(eo.order.total_amount))}</p></div>
                      <div><p className="text-[10px] text-gray-400 uppercase tracking-wide">Paid</p>
                        <p className="text-sm font-bold text-green-600">{fmtTHB(eo.totalPaid)}</p></div>
                      <div><p className="text-[10px] text-gray-400 uppercase tracking-wide">Refunded</p>
                        <p className="text-sm font-bold text-red-500">{eo.totalRefunded > 0 ? fmtTHB(eo.totalRefunded) : '—'}</p></div>
                      <div><p className="text-[10px] text-gray-400 uppercase tracking-wide">Discounts</p>
                        <p className="text-sm font-bold text-orange-500">{eo.totalDiscounts > 0 ? fmtTHB(eo.totalDiscounts) : '—'}</p></div>
                      <div><p className="text-[10px] text-gray-400 uppercase tracking-wide">Balance Due</p>
                        <p className={`text-sm font-bold ${eo.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {eo.balanceDue > 0 ? fmtTHB(eo.balanceDue) : '✓ Settled'}</p></div>
                    </div>

                    {/* Transaction History */}
                    <div className="px-4 py-3">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <FileText size={12} /> Transaction History
                      </p>
                      {eo.payments.length > 0 ? (
                        <div className="space-y-1.5 mb-3">
                          {eo.payments.map(p => {
                            const isPayment = p.type === 'payment'
                            const isRefund = p.type === 'refund'
                            const isDiscount = p.type === 'discount'
                            const methodLabel = PAYMENT_METHODS.find(m => m.value === p.method)?.label || p.method || ''
                            return (
                              <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
                                isRefund ? 'bg-red-50/50' : isDiscount ? 'bg-orange-50/50' : 'bg-green-50/50'}`}>
                                {isPayment && <ArrowDownCircle size={14} className="text-green-500 flex-shrink-0" />}
                                {isRefund && <ArrowUpCircle size={14} className="text-red-500 flex-shrink-0" />}
                                {isDiscount && <Percent size={14} className="text-orange-500 flex-shrink-0" />}
                                {!isPayment && !isRefund && !isDiscount && <Receipt size={14} className="text-gray-500 flex-shrink-0" />}

                                <span className={`font-bold ${isRefund ? 'text-red-600' : isDiscount ? 'text-orange-600' : 'text-green-600'}`}>
                                  {isRefund ? '-' : isDiscount ? '-' : '+'}{fmtTHB(Number(p.amount))}
                                </span>
                                <span className="text-gray-500 capitalize">{p.type}</span>
                                {methodLabel && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-xs">{methodLabel}</span>}
                                {p.reference && <span className="text-xs text-gray-400 truncate max-w-[120px]" title={p.reference}>ref: {p.reference}</span>}
                                <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{fmtDateTime(p.created_at)}</span>
                                {p.recorded_by && <span className="text-[10px] text-gray-300">{p.recorded_by}</span>}
                                {canEdit && (
                                  <button onClick={e => { e.stopPropagation(); deletePayment(p.id) }}
                                    className="w-6 h-6 rounded flex items-center justify-center text-red-300 hover:text-red-500 hover:bg-red-50 flex-shrink-0">
                                    <X size={12} />
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic mb-3">No transactions recorded yet</p>
                      )}

                      {/* Record Transaction Form */}
                      {canEdit && (
                        <div className="rounded-2xl p-4" style={{ background: '#e8e8ed', boxShadow: 'inset 2px 2px 5px #c8c8cd, inset -2px -2px 5px #fff' }}
                          onClick={e => e.stopPropagation()}>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <Plus size={12} /> Record Transaction
                          </p>

                          {/* Type selector */}
                          <div className="flex gap-1.5 mb-3">
                            {(['payment', 'refund', 'discount', 'adjustment'] as const).map(t => {
                              const active = formType === t
                              const colors: Record<string, string> = {
                                payment: 'bg-green-500', refund: 'bg-red-500', discount: 'bg-orange-500', adjustment: 'bg-gray-500'
                              }
                              return (
                                <button key={t} onClick={() => setFormType(t)}
                                  className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                                    active ? `${colors[t]} text-white shadow-md` : 'text-gray-500'
                                  }`}
                                  style={!active ? { background: '#e0e0e5', boxShadow: '3px 3px 6px #b8b8bd, -3px -3px 6px #fff' } : undefined}>
                                  {t}
                                </button>
                              )
                            })}
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-3">
                            {/* Amount */}
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Amount (THB) *</label>
                              <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)}
                                placeholder={eo.balanceDue > 0 ? String(eo.balanceDue) : '0'}
                                className="neu-input w-full px-3 py-2.5 text-lg font-bold text-center" min="0" step="1" />
                            </div>

                            {/* Method (only for payments) */}
                            {formType === 'payment' ? (
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Payment Method</label>
                                <select value={formMethod} onChange={e => setFormMethod(e.target.value)} className="neu-input w-full px-3 py-2.5">
                                  {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Reference / Reason</label>
                                <input type="text" value={formRef} onChange={e => setFormRef(e.target.value)}
                                  placeholder={formType === 'refund' ? 'Reason for refund' : 'Reference'} className="neu-input w-full px-3 py-2.5" />
                              </div>
                            )}
                          </div>

                          {formType === 'payment' && (
                            <input type="text" value={formRef} onChange={e => setFormRef(e.target.value)}
                              placeholder="Reference / Transfer ID (optional)" className="neu-input w-full px-3 py-2.5 mb-3 text-sm" />
                          )}

                          <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
                            placeholder="Notes (optional)" className="neu-input w-full px-3 py-2.5 mb-3 text-sm" />

                          {/* Quick amount buttons */}
                          {formType === 'payment' && eo.balanceDue > 0 && (
                            <div className="flex gap-2 mb-3">
                              <button onClick={() => setFormAmount(String(eo.balanceDue))}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-green-600 bg-green-50 hover:bg-green-100 border border-green-200">
                                Full: {fmtTHB(eo.balanceDue)}
                              </button>
                              {eo.balanceDue > 500 && (
                                <button onClick={() => setFormAmount(String(Math.round(eo.balanceDue / 2)))}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200">
                                  Half: {fmtTHB(Math.round(eo.balanceDue / 2))}
                                </button>
                              )}
                            </div>
                          )}

                          <button onClick={() => handleSubmit(eo.order.shopify_order_number)} disabled={saving || !formAmount || Number(formAmount) <= 0}
                            className="w-full py-3 rounded-2xl font-bold text-white disabled:opacity-40 transition-all text-sm"
                            style={{ background: formType === 'refund' ? 'linear-gradient(135deg, #ef4444, #dc2626)' :
                              formType === 'discount' ? 'linear-gradient(135deg, #f59e0b, #d97706)' :
                              formType === 'adjustment' ? 'linear-gradient(135deg, #6b7280, #4b5563)' :
                              'linear-gradient(135deg, #22C55E, #16a34a)',
                              boxShadow: '4px 4px 12px #b8b8bd, -4px -4px 12px #fff' }}>
                            {saving ? 'Recording...' : `Record ${formType} ${formAmount ? fmtTHB(Number(formAmount)) : ''}`}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      }
    </div>
  )
}
