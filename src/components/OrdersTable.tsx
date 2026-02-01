import { useState, useMemo } from 'react'
import { ShopifyOrder } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Search, Download, Calendar, ShoppingCart, FileText, Share2 } from 'lucide-react'

interface Props { orders: ShopifyOrder[] }

export default function OrdersTable({ orders }: Props) {
  const { hasPermission } = useAuth()
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = order.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        order.shopify_order_number?.includes(search) || order.product_title?.toLowerCase().includes(search.toLowerCase())
      return matchesSearch && (!dateFilter || order.tour_date === dateFilter) && 
        (!statusFilter || order.status === statusFilter) && (!paymentFilter || order.payment_status === paymentFilter)
    })
  }, [orders, search, dateFilter, statusFilter, paymentFilter])

  const formatCurrency = (amount: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(amount)
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const totalRevenue = filteredOrders.reduce((s, o) => s + o.total_amount, 0)
  const paidCount = filteredOrders.filter(o => o.payment_status === 'paid').length
  const pendingCount = filteredOrders.filter(o => o.payment_status === 'pending').length

  const exportCSV = () => {
    if (!hasPermission('canExport')) return
    const headers = ['Order', 'Date', 'Customer', 'Product', 'Tour Date', 'Amount', 'Payment']
    const rows = filteredOrders.map(o => [o.shopify_order_number, formatDate(o.received_at), o.customer_name, o.product_title || '', o.tour_date || '', o.total_amount, o.payment_status])
    const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  const shareData = async () => {
    const text = `Orders: ${filteredOrders.length}\nRevenue: ${formatCurrency(totalRevenue)}\nPaid: ${paidCount} | Pending: ${pendingCount}`
    if (navigator.share) await navigator.share({ title: 'Tour Orders', text })
    else { navigator.clipboard.writeText(text); alert('Copied!') }
  }

  return (
    <div className="fade-in w-full max-w-full lg:h-full lg:overflow-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold gradient-text">Orders</h1>
          <p className="text-gray-500 text-sm mt-1">Tour bookings</p>
        </div>
        {hasPermission('canExport') && (
          <div className="flex gap-2">
            <button onClick={exportCSV} className="neu-btn px-3 py-2 flex items-center gap-1.5 text-xs"><Download size={14} /> CSV</button>
            <button onClick={() => window.print()} className="neu-btn-accent px-3 py-2 flex items-center gap-1.5 text-xs no-print"><FileText size={14} /> Print</button>
            <button onClick={shareData} className="neu-flat px-3 py-2 flex items-center gap-1.5 text-xs text-gray-600 no-print"><Share2 size={14} /> Share</button>
          </div>
        )}
      </div>

      {/* Filters - Stacked on mobile */}
      <div className="space-y-2 lg:space-y-0 lg:flex lg:flex-wrap lg:gap-3 mb-4 no-print">
        <div className="relative flex-1 min-w-0 lg:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="neu-input w-full pl-9 pr-3 py-2.5 text-sm" />
        </div>
        <div className="grid grid-cols-3 gap-2 lg:flex lg:gap-3">
          <div className="relative">
            <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="neu-input w-full pl-8 pr-2 py-2.5 text-xs" />
          </div>
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="neu-input px-2 py-2.5 text-xs">
            <option value="">Payment</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="neu-input px-2 py-2.5 text-xs">
            <option value="">Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4 mb-4">
        <div className="neu-card p-3 lg:p-4">
          <p className="text-xs text-gray-500">Orders</p>
          <p className="text-lg lg:text-2xl font-bold text-[#2D3748]">{filteredOrders.length}</p>
        </div>
        <div className="neu-card p-3 lg:p-4">
          <p className="text-xs text-gray-500">Revenue</p>
          <p className="text-lg lg:text-2xl font-bold text-[#9370DB]">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="neu-card p-3 lg:p-4">
          <p className="text-xs text-gray-500">Paid</p>
          <p className="text-lg lg:text-2xl font-bold text-green-500">{paidCount}</p>
        </div>
        <div className="neu-card p-3 lg:p-4">
          <p className="text-xs text-gray-500">Pending</p>
          <p className="text-lg lg:text-2xl font-bold text-yellow-500">{pendingCount}</p>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filteredOrders.map(order => (
          <div key={order.id} className="neu-card p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-[#9370DB] text-sm">#{order.shopify_order_number}</span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${order.payment_status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                {order.payment_status}
              </span>
            </div>
            <p className="font-medium text-[#2D3748] text-sm">{order.customer_name}</p>
            <p className="text-xs text-gray-400 truncate">{order.product_title || 'No product'}</p>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-400">{order.tour_date || 'No date'}</span>
              <span className="font-bold text-[#2D3748]">{formatCurrency(order.total_amount)}</span>
            </div>
          </div>
        ))}
        {filteredOrders.length === 0 && (
          <div className="neu-card p-8 text-center text-gray-400">
            <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No orders found</p>
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block neu-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="table-header">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#2D3748]">Order</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#2D3748]">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#2D3748]">Tour Date</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-[#2D3748]">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-[#2D3748]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-[#9370DB] text-sm">#{order.shopify_order_number}</span>
                    <p className="text-xs text-gray-400">{formatDate(order.received_at)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#2D3748] text-sm">{order.customer_name}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[150px]">{order.customer_email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{order.tour_date || '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#2D3748] text-sm">{formatCurrency(order.total_amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${order.payment_status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                      {order.payment_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
