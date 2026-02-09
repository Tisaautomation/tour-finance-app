import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase, ShopifyOrder, Booking, Transaction, Provider, LineItem } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { 
  Search, Download, Calendar, ShoppingCart, FileText, Share2, X, 
  ChevronRight, Users, MapPin, Clock, CreditCard, Package,
  AlertCircle, CheckCircle, XCircle, Edit3, Save, RefreshCw,
  DollarSign, User, Truck, Tag
} from 'lucide-react'

interface Props { orders: ShopifyOrder[] }

// Parse note field: "1A / 1Ch / 2Inf | 2026-02-19 | Afternoon | pickup address"
function parseNote(note: string | null | undefined) {
  if (!note) return { pax: '', date: '', time: '', pickup: '' }
  const parts = note.split('|').map(s => s.trim())
  return {
    pax: parts[0] || '',
    date: parts[1] || '',
    time: parts[2] || '',
    pickup: parts[3] || ''
  }
}

function getFinancialBadge(status: string) {
  switch (status) {
    case 'paid': return { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle, label: 'Paid' }
    case 'pending': return { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock, label: 'Pending' }
    case 'refunded': return { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, label: 'Refunded' }
    case 'partially_refunded': return { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertCircle, label: 'Partial Refund' }
    case 'voided': return { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: XCircle, label: 'Voided' }
    default: return { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: AlertCircle, label: status || 'Unknown' }
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'confirmed': return 'bg-green-100 text-green-700'
    case 'pending': return 'bg-yellow-100 text-yellow-700'
    case 'cancelled': return 'bg-red-100 text-red-700'
    case 'completed': return 'bg-blue-100 text-blue-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

export default function OrdersTable({ orders }: Props) {
  const { user, hasPermission } = useAuth()
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<ShopifyOrder | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [orderTransactions, setOrderTransactions] = useState<Transaction[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({ status: '', payment_status: '', payment_method: '', internal_notes: '' })
  const [saving, setSaving] = useState(false)
  const [refundMode, setRefundMode] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [auditPopup, setAuditPopup] = useState<{ id: string; by: string; date: string } | null>(null)

  const canEdit = hasPermission('canEditOrders')
  const canRefund = hasPermission('canAddRefund')

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const raw = order.raw_data || {}
      const note = (raw as Record<string, string>).note || ''
      const matchesSearch = !search || 
        order.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        order.shopify_order_number?.includes(search) || 
        order.product_title?.toLowerCase().includes(search.toLowerCase()) ||
        note.toLowerCase().includes(search.toLowerCase())
      const fin = (raw as Record<string, string>).financial_status || order.payment_status
      return matchesSearch && 
        (!dateFilter || order.tour_date === dateFilter || note.includes(dateFilter)) && 
        (!statusFilter || order.status === statusFilter) && 
        (!paymentFilter || fin === paymentFilter || order.payment_status === paymentFilter)
    })
  }, [orders, search, dateFilter, statusFilter, paymentFilter])

  const formatCurrency = (amount: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(amount)
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const formatDateTime = (date: string) => new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })

  const totalRevenue = filteredOrders.reduce((s, o) => s + o.total_amount, 0)
  const paidCount = filteredOrders.filter(o => {
    const fin = ((o.raw_data || {}) as Record<string, string>).financial_status || o.payment_status
    return fin === 'paid'
  }).length
  const pendingCount = filteredOrders.filter(o => {
    const fin = ((o.raw_data || {}) as Record<string, string>).financial_status || o.payment_status
    return fin === 'pending'
  }).length
  const refundedCount = filteredOrders.filter(o => {
    const fin = ((o.raw_data || {}) as Record<string, string>).financial_status || o.payment_status
    return fin === 'refunded' || fin === 'partially_refunded'
  }).length

  // Load order details
  const loadOrderDetail = useCallback(async (order: ShopifyOrder) => {
    setDetailLoading(true)
    setBooking(null)
    setProvider(null)
    setOrderTransactions([])

    // Load booking
    const { data: bookingData } = await supabase
      .from('bookings')
      .select('*')
      .eq('shopify_order_number', order.shopify_order_number)
      .limit(1)
    
    if (bookingData?.[0]) {
      setBooking(bookingData[0])
      // Load provider if assigned
      if (bookingData[0].provider_id) {
        const { data: provData } = await supabase
          .from('providers')
          .select('*')
          .eq('provider_id', bookingData[0].provider_id)
          .limit(1)
        if (provData?.[0]) setProvider(provData[0])
      }
    }

    // Load related transactions
    const bookingId = bookingData?.[0]?.id || `BKG%${order.shopify_order_number}`
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .or(`booking_id.eq.${bookingData?.[0]?.id || 'NONE'},description.ilike.%${order.shopify_order_number}%`)
      .order('date', { ascending: false })
    
    if (txData) setOrderTransactions(txData)

    setEditData({
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      internal_notes: bookingData?.[0]?.internal_notes || ''
    })

    setDetailLoading(false)
  }, [])

  const openDetail = (order: ShopifyOrder) => {
    setSelectedOrder(order)
    setEditing(false)
    setRefundMode(false)
    loadOrderDetail(order)
  }

  const saveEdits = async () => {
    if (!selectedOrder || !canEdit) return
    setSaving(true)

    // Build change description for audit
    const changes: string[] = []
    if (editData.status !== selectedOrder.status) changes.push(`status: ${selectedOrder.status}→${editData.status}`)
    if (editData.payment_status !== selectedOrder.payment_status) changes.push(`payment: ${selectedOrder.payment_status}→${editData.payment_status}`)
    if (editData.payment_method !== selectedOrder.payment_method) changes.push(`method: ${selectedOrder.payment_method}→${editData.payment_method}`)

    // Update shopify_orders
    await supabase.from('shopify_orders').update({
      status: editData.status,
      payment_status: editData.payment_status,
      payment_method: editData.payment_method
    }).eq('id', selectedOrder.id)

    // Update booking if exists
    if (booking) {
      await supabase.from('bookings').update({
        status: editData.status,
        payment_status: editData.payment_status,
        payment_method: editData.payment_method,
        internal_notes: editData.internal_notes,
        updated_at: new Date().toISOString()
      }).eq('id', booking.id)
    }

    // Log the edit as audit transaction
    if (changes.length > 0) {
      await supabase.from('transactions').insert({
        date: new Date().toISOString(),
        type: 'fee',
        category: 'order_edit',
        amount: 0,
        currency: 'THB',
        booking_id: booking?.id || null,
        description: `Edit #${selectedOrder.shopify_order_number}: ${changes.join(', ')}`,
        status: 'completed',
        created_by: user?.email || 'unknown'
      })
    }

    setEditing(false)
    setSaving(false)
    setSelectedOrder({ ...selectedOrder, status: editData.status, payment_status: editData.payment_status, payment_method: editData.payment_method })
    loadOrderDetail({ ...selectedOrder, status: editData.status, payment_status: editData.payment_status, payment_method: editData.payment_method })
  }

  const submitRefund = async () => {
    if (!selectedOrder || !canRefund || !refundAmount) return
    setSaving(true)
    
    const amount = parseFloat(refundAmount)
    if (isNaN(amount) || amount <= 0) { setSaving(false); return }

    // Record the refund action (money is handled manually outside the app)
    await supabase.from('transactions').insert({
      date: new Date().toISOString(),
      type: 'refund',
      category: 'refund',
      amount: -Math.abs(amount),
      currency: 'THB',
      booking_id: booking?.id || null,
      description: `Refund #${selectedOrder.shopify_order_number}: ${refundReason || 'No reason provided'}`,
      status: 'recorded',
      created_by: user?.email || 'unknown'
    })

    // Update payment status
    if (amount >= selectedOrder.total_amount) {
      await supabase.from('shopify_orders').update({ payment_status: 'refunded' }).eq('id', selectedOrder.id)
      if (booking) await supabase.from('bookings').update({ payment_status: 'refunded', updated_at: new Date().toISOString() }).eq('id', booking.id)
    } else {
      await supabase.from('shopify_orders').update({ payment_status: 'partially_refunded' }).eq('id', selectedOrder.id)
      if (booking) await supabase.from('bookings').update({ payment_status: 'partially_refunded', updated_at: new Date().toISOString() }).eq('id', booking.id)
    }

    setRefundMode(false)
    setRefundAmount('')
    setRefundReason('')
    setSaving(false)
    loadOrderDetail(selectedOrder)
  }

  const exportCSV = () => {
    if (!hasPermission('canExport')) return
    const headers = ['Order#', 'Date', 'Customer', 'Email', 'Phone', 'Product', 'Tour Date', 'Time', 'Pickup', 'Adults', 'Children', 'Infants', 'Amount', 'Currency', 'Payment Status', 'Payment Method', 'Order Status']
    const rows = filteredOrders.map(o => {
      const raw = o.raw_data || {}
      const parsed = parseNote((raw as Record<string, string>).note)
      return [o.shopify_order_number, formatDate(o.received_at), o.customer_name, o.customer_email || '', o.customer_phone || '', o.product_title || '', o.tour_date || parsed.date, parsed.time, parsed.pickup || o.pickup_location || '', o.adults, o.children, o.infants, o.total_amount, o.currency, o.payment_status, o.payment_method, o.status]
    })
    const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  // Extract data from raw_data
  const getOrderMeta = (order: ShopifyOrder) => {
    const raw = (order.raw_data || {}) as Record<string, unknown>
    const note = parseNote(raw.note as string)
    const financialStatus = (raw.financial_status as string) || order.payment_status
    const fulfillmentStatus = (raw.fulfillment_status as string) || null
    const tags = (raw.tags as string) || ''
    const gateway = (raw.payment_gateway_names as string[]) || []
    const lineItems = ((raw.line_items as unknown[]) || []) as LineItem[]
    const refunds = (raw.refunds as unknown[]) || []
    return { note, financialStatus, fulfillmentStatus, tags, gateway, lineItems, refunds }
  }

  return (
    <div className="fade-in w-full max-w-full h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold gradient-text">Orders & Finance</h1>
            <p className="text-gray-500 text-sm mt-1">Full booking & payment tracking</p>
          </div>
          {hasPermission('canExport') && (
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={exportCSV} className="neu-btn px-3 py-2 flex items-center gap-1.5 text-xs"><Download size={14} /> CSV</button>
              <button onClick={() => window.print()} className="neu-btn-accent px-3 py-2 flex items-center gap-1.5 text-xs no-print"><FileText size={14} /> Print</button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-2 lg:space-y-0 lg:flex lg:flex-wrap lg:gap-3 mb-4 no-print">
          <div className="relative flex-1 min-w-0 lg:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Search name, order#, tour..." value={search} onChange={e => setSearch(e.target.value)} className="neu-input w-full pl-9 pr-3 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-2 lg:flex lg:gap-3">
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="neu-input w-full pl-8 pr-2 py-2.5 text-xs" />
            </div>
            <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="neu-input px-2 py-2.5 text-xs">
              <option value="">Payment</option>
              <option value="paid">✅ Paid</option>
              <option value="pending">⏳ Pending</option>
              <option value="refunded">↩️ Refunded</option>
              <option value="partially_refunded">⚠️ Partial Refund</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="neu-input px-2 py-2.5 text-xs">
              <option value="">Status</option>
              <option value="confirmed">✅ Confirmed</option>
              <option value="pending">⏳ Pending</option>
              <option value="cancelled">❌ Cancelled</option>
              <option value="completed">🏁 Completed</option>
            </select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 lg:gap-3 mb-4">
          <div className="neu-card p-3">
            <p className="text-xs text-gray-500">Total Orders</p>
            <p className="text-xl font-bold text-[#2D3748]">{filteredOrders.length}</p>
          </div>
          <div className="neu-card p-3">
            <p className="text-xs text-gray-500">Revenue</p>
            <p className="text-xl font-bold text-[#9370DB]">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="neu-card p-3">
            <p className="text-xs text-gray-500">Paid</p>
            <p className="text-xl font-bold text-green-500">{paidCount}</p>
          </div>
          <div className="neu-card p-3">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-xl font-bold text-yellow-500">{pendingCount}</p>
          </div>
          <div className="neu-card p-3 col-span-2 lg:col-span-1">
            <p className="text-xs text-gray-500">Refunded</p>
            <p className="text-xl font-bold text-red-500">{refundedCount}</p>
          </div>
        </div>
      </div>

      {/* Orders List - Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pb-4">
        {filteredOrders.length === 0 ? (
          <div className="neu-card p-12 text-center text-gray-400">
            <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
            <p>No orders found</p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const meta = getOrderMeta(order)
            const badge = getFinancialBadge(meta.financialStatus)
            const BadgeIcon = badge.icon
            const tourDate = order.tour_date || meta.note.date || ''
            const tourTime = meta.note.time || order.tour_time || ''
            const totalPax = order.adults + order.children + order.infants

            return (
              <div key={order.id} onClick={() => openDetail(order)} className="neu-card p-4 cursor-pointer hover:shadow-lg transition-all active:scale-[0.99]">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Row 1: Order # + Amount */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-[#9370DB] text-sm">#{order.shopify_order_number}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${badge.color}`}>
                          <BadgeIcon size={12} />
                          {badge.label}
                        </span>
                      </div>
                      <span className="font-bold text-[#2D3748] text-sm flex-shrink-0">{formatCurrency(order.total_amount)}</span>
                    </div>
                    
                    {/* Row 2: Customer + Product */}
                    <p className="font-medium text-[#2D3748] text-sm truncate">{order.customer_name || 'No name'}</p>
                    <p className="text-xs text-gray-500 truncate">{order.product_title || 'No product'}</p>
                    
                    {/* Row 3: Tour info */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                      {tourDate && (
                        <span className="flex items-center gap-1"><Calendar size={12} className="text-purple-400" />{tourDate}</span>
                      )}
                      {tourTime && (
                        <span className="flex items-center gap-1"><Clock size={12} className="text-blue-400" />{tourTime}</span>
                      )}
                      <span className="flex items-center gap-1"><Users size={12} className="text-cyan-400" />{totalPax} pax ({order.adults}A {order.children}C {order.infants}I)</span>
                      <span className="text-gray-400">{formatDate(order.received_at)}</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 flex-shrink-0 mt-2" />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Order Detail Panel — Slide-in */}
      {selectedOrder && (
        <div className="fixed inset-0 z-[100] flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          
          {/* Panel */}
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[520px] lg:w-[600px] bg-white shadow-2xl overflow-y-auto animate-slide-in">
            {(() => {
              const meta = getOrderMeta(selectedOrder)
              const badge = getFinancialBadge(meta.financialStatus)
              const BadgeIcon = badge.icon
              const tourDate = selectedOrder.tour_date || meta.note.date
              const tourTime = meta.note.time || selectedOrder.tour_time || ''
              const pickup = meta.note.pickup || selectedOrder.pickup_location || ''
              const totalPax = selectedOrder.adults + selectedOrder.children + selectedOrder.infants
              const totalRefunded = orderTransactions.filter(t => t.type === 'refund').reduce((s, t) => s + Math.abs(t.amount), 0)

              return (
                <>
                  {/* Header */}
                  <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-[#2D3748]">Order #{selectedOrder.shopify_order_number}</h2>
                      <p className="text-xs text-gray-400">Received {formatDateTime(selectedOrder.received_at)}</p>
                    </div>
                    <button onClick={() => setSelectedOrder(null)} className="p-2 rounded-xl hover:bg-gray-100"><X size={22} /></button>
                  </div>

                  <div className="p-5 space-y-5">
                    {detailLoading ? (
                      <div className="flex items-center justify-center h-40"><RefreshCw className="animate-spin text-purple-400" size={28} /></div>
                    ) : (
                      <>
                        {/* === PAYMENT STATUS === */}
                        <div className="rounded-2xl border border-gray-100 overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2 border-b border-gray-100">
                            <CreditCard size={16} className="text-purple-500" />
                            <span className="font-semibold text-sm text-gray-700">Payment & Finance</span>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">Status</span>
                              {editing ? (
                                <select value={editData.payment_status} onChange={e => setEditData({...editData, payment_status: e.target.value})} className="text-sm border rounded-lg px-2 py-1">
                                  <option value="pending">Pending</option>
                                  <option value="paid">Paid</option>
                                  <option value="refunded">Refunded</option>
                                  <option value="partially_refunded">Partial Refund</option>
                                  <option value="voided">Voided</option>
                                </select>
                              ) : (
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-semibold border ${badge.color}`}>
                                  <BadgeIcon size={14} />{badge.label}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">Amount</span>
                              <span className="text-lg font-bold text-[#2D3748]">{formatCurrency(selectedOrder.total_amount)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">Method</span>
                              {editing ? (
                                <select value={editData.payment_method} onChange={e => setEditData({...editData, payment_method: e.target.value})} className="text-sm border rounded-lg px-2 py-1">
                                  <option value="unknown">Unknown</option>
                                  <option value="credit_card">Credit Card</option>
                                  <option value="bank_transfer">Bank Transfer</option>
                                  <option value="cash">Cash</option>
                                  <option value="promptpay">PromptPay</option>
                                  <option value="paypal">PayPal</option>
                                  <option value="stripe">Stripe</option>
                                </select>
                              ) : (
                                <span className="text-sm text-gray-700 capitalize">{meta.gateway.length > 0 ? meta.gateway.join(', ') : selectedOrder.payment_method || 'Unknown'}</span>
                              )}
                            </div>
                            {meta.tags && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Tags</span>
                                <div className="flex flex-wrap gap-1 justify-end">
                                  {meta.tags.split(',').map((t, i) => (
                                    <span key={i} className="bg-purple-50 text-purple-600 text-xs px-2 py-0.5 rounded-md">{t.trim()}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {totalRefunded > 0 && (
                              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                <span className="text-sm text-red-500 font-medium">Total Refunded</span>
                                <span className="text-sm font-bold text-red-500">{formatCurrency(totalRefunded)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* === CUSTOMER === */}
                        <div className="rounded-2xl border border-gray-100 overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2 border-b border-gray-100">
                            <User size={16} className="text-cyan-500" />
                            <span className="font-semibold text-sm text-gray-700">Customer</span>
                          </div>
                          <div className="p-4 space-y-2">
                            <div className="flex justify-between"><span className="text-sm text-gray-500">Name</span><span className="text-sm font-medium text-gray-800">{selectedOrder.customer_name || 'Not provided'}</span></div>
                            {selectedOrder.customer_email && <div className="flex justify-between"><span className="text-sm text-gray-500">Email</span><span className="text-sm text-gray-700">{selectedOrder.customer_email}</span></div>}
                            {selectedOrder.customer_phone && <div className="flex justify-between"><span className="text-sm text-gray-500">Phone</span><span className="text-sm text-gray-700">{selectedOrder.customer_phone}</span></div>}
                          </div>
                        </div>

                        {/* === TOUR / BOOKING === */}
                        <div className="rounded-2xl border border-gray-100 overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2 border-b border-gray-100">
                            <Package size={16} className="text-green-500" />
                            <span className="font-semibold text-sm text-gray-700">Tour & Booking</span>
                          </div>
                          <div className="p-4 space-y-2">
                            <div className="flex justify-between"><span className="text-sm text-gray-500">Product</span><span className="text-sm font-medium text-gray-800 text-right max-w-[60%]">{selectedOrder.product_title || 'N/A'}</span></div>
                            <div className="flex justify-between"><span className="text-sm text-gray-500">Tour Date</span><span className="text-sm font-medium text-gray-800">{tourDate || 'Not set'}</span></div>
                            <div className="flex justify-between"><span className="text-sm text-gray-500">Time</span><span className="text-sm text-gray-700">{tourTime || 'Not set'}</span></div>
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">Participants</span>
                              <span className="text-sm font-medium text-gray-800">
                                {totalPax} total — {selectedOrder.adults} Adult{selectedOrder.adults !== 1 ? 's' : ''}{selectedOrder.children > 0 ? `, ${selectedOrder.children} Child` : ''}{selectedOrder.infants > 0 ? `, ${selectedOrder.infants} Infant` : ''}
                              </span>
                            </div>
                            {pickup && (
                              <div className="flex justify-between gap-3"><span className="text-sm text-gray-500 flex-shrink-0">Pickup</span><span className="text-sm text-gray-700 text-right">{pickup}</span></div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-500">Order Status</span>
                              {editing ? (
                                <select value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})} className="text-sm border rounded-lg px-2 py-1">
                                  <option value="pending">Pending</option>
                                  <option value="confirmed">Confirmed</option>
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              ) : (
                                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${getStatusBadge(selectedOrder.status)}`}>{selectedOrder.status}</span>
                              )}
                            </div>
                            {booking && (
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-500">Booking ID</span>
                                <span className="text-xs font-mono text-purple-500">{booking.id}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* === PROVIDER === */}
                        <div className="rounded-2xl border border-gray-100 overflow-hidden">
                          <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2 border-b border-gray-100">
                            <Truck size={16} className="text-orange-500" />
                            <span className="font-semibold text-sm text-gray-700">Provider</span>
                          </div>
                          <div className="p-4">
                            {provider ? (
                              <div className="space-y-2">
                                <div className="flex justify-between"><span className="text-sm text-gray-500">Name</span><span className="text-sm font-medium">{provider.name}</span></div>
                                <div className="flex justify-between"><span className="text-sm text-gray-500">ID</span><span className="text-xs font-mono text-gray-500">{provider.provider_id}</span></div>
                                <div className="flex justify-between"><span className="text-sm text-gray-500">Commission</span><span className="text-sm">{provider.commission_rate}%</span></div>
                                {booking?.provider_confirmed ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> Confirmed</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs text-yellow-600"><Clock size={12} /> Awaiting confirmation</span>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400">No provider assigned</p>
                            )}
                          </div>
                        </div>

                        {/* === LINE ITEMS === */}
                        {meta.lineItems.length > 0 && (
                          <div className="rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2 border-b border-gray-100">
                              <Tag size={16} className="text-blue-500" />
                              <span className="font-semibold text-sm text-gray-700">Line Items</span>
                            </div>
                            <div className="divide-y divide-gray-50">
                              {meta.lineItems.map((item, i) => (
                                <div key={i} className="p-4 flex items-center justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-800 truncate">{item.variant_title || item.title}</p>
                                    <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                                  </div>
                                  <span className="text-sm font-bold text-gray-700 flex-shrink-0">{formatCurrency(parseFloat(item.price) * item.quantity)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* === TRANSACTIONS / AUDIT LOG === */}
                        {orderTransactions.length > 0 && (
                          <div className="rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2 border-b border-gray-100">
                              <DollarSign size={16} className="text-emerald-500" />
                              <span className="font-semibold text-sm text-gray-700">Transactions & Audit Log</span>
                            </div>
                            <div className="divide-y divide-gray-50">
                              {orderTransactions.map(tx => (
                                <div key={tx.id} className="p-4 flex items-center gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${tx.type === 'refund' ? 'bg-red-100 text-red-600' : tx.category === 'order_edit' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                        {tx.type === 'refund' ? '↩ Refund' : tx.category === 'order_edit' ? '✏️ Edit' : tx.type}
                                      </span>
                                      {tx.status === 'recorded' && <span className="text-[10px] text-orange-500 font-medium">(manual)</span>}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 truncate">{tx.description}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(tx.date)}</p>
                                  </div>
                                  {tx.amount !== 0 && (
                                    <span className={`text-sm font-bold flex-shrink-0 ${tx.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(tx.amount)}</span>
                                  )}
                                  {/* WHO DID IT — clickable icon */}
                                  <div className="relative flex-shrink-0">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setAuditPopup(auditPopup?.id === tx.id ? null : { id: tx.id, by: tx.created_by || 'System', date: tx.created_at || tx.date }) }}
                                      className="w-7 h-7 rounded-full bg-purple-50 hover:bg-purple-100 flex items-center justify-center transition-colors"
                                      title={tx.created_by || 'Unknown'}
                                    >
                                      <User size={13} className="text-purple-400" />
                                    </button>
                                    {auditPopup?.id === tx.id && (
                                      <div className="absolute right-0 bottom-full mb-1 bg-[#2D3748] text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap z-20">
                                        <p className="font-semibold">{auditPopup.by}</p>
                                        <p className="text-gray-300 text-[10px]">{formatDateTime(auditPopup.date)}</p>
                                        <div className="absolute bottom-0 right-3 translate-y-1/2 rotate-45 w-2 h-2 bg-[#2D3748]" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* === NOTES === */}
                        {(booking?.internal_notes || booking?.special_requests || editing) && (
                          <div className="rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2 border-b border-gray-100">
                              <FileText size={16} className="text-gray-500" />
                              <span className="font-semibold text-sm text-gray-700">Notes</span>
                            </div>
                            <div className="p-4 space-y-3">
                              {booking?.special_requests && (
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Special Requests / Order Note</p>
                                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl">{booking.special_requests}</p>
                                </div>
                              )}
                              {editing ? (
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Internal Notes</p>
                                  <textarea value={editData.internal_notes} onChange={e => setEditData({...editData, internal_notes: e.target.value})} className="w-full text-sm border rounded-xl p-3 min-h-[80px]" placeholder="Internal notes..." />
                                </div>
                              ) : booking?.internal_notes ? (
                                <div>
                                  <p className="text-xs text-gray-400 mb-1">Internal Notes</p>
                                  <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-xl">{booking.internal_notes}</p>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )}

                        {/* === REFUND FORM === */}
                        {refundMode && (
                          <div className="rounded-2xl border-2 border-red-200 overflow-hidden bg-red-50">
                            <div className="bg-red-100 px-4 py-2.5 flex items-center gap-2">
                              <XCircle size={16} className="text-red-500" />
                              <span className="font-semibold text-sm text-red-700">Record Refund</span>
                            </div>
                            <div className="p-4 space-y-3">
                              <p className="text-xs text-red-500">This only records the refund. Actual bank transfer must be done manually.</p>
                              <div>
                                <label className="text-xs text-red-600 font-medium">Amount Refunded (THB)</label>
                                <input type="number" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder={`Max: ${selectedOrder.total_amount}`} className="w-full mt-1 px-3 py-2 border border-red-200 rounded-xl text-sm" max={selectedOrder.total_amount} />
                              </div>
                              <div>
                                <label className="text-xs text-red-600 font-medium">Reason</label>
                                <input type="text" value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="Reason for refund..." className="w-full mt-1 px-3 py-2 border border-red-200 rounded-xl text-sm" />
                              </div>
                              <p className="text-[11px] text-gray-400">Recorded by: {user?.email}</p>
                              <div className="flex gap-2">
                                <button onClick={submitRefund} disabled={saving || !refundAmount} className="flex-1 bg-red-500 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-50">
                                  {saving ? 'Recording...' : 'Record Refund'}
                                </button>
                                <button onClick={() => setRefundMode(false)} className="px-4 py-2 bg-gray-100 rounded-xl text-sm">Cancel</button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* === ACTION BUTTONS === */}
                        <div className="flex flex-wrap gap-2 pt-2 pb-8">
                          {canEdit && !editing && (
                            <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2.5 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition-colors">
                              <Edit3 size={16} /> Edit Order
                            </button>
                          )}
                          {editing && (
                            <>
                              <button onClick={saveEdits} disabled={saving} className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 disabled:opacity-50">
                                <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                              </button>
                              <button onClick={() => setEditing(false)} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium">Cancel</button>
                            </>
                          )}
                          {canRefund && !refundMode && !editing && (
                            <button onClick={() => setRefundMode(true)} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 border border-red-200 transition-colors">
                              <XCircle size={16} /> Record Refund
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
