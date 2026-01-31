import { useState, useMemo } from 'react'
import { ShopifyOrder } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Search, Download, Calendar, Filter, ShoppingCart, FileText, Share2 } from 'lucide-react'

interface Props {
  orders: ShopifyOrder[]
}

export default function OrdersTable({ orders }: Props) {
  const { hasPermission } = useAuth()
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        order.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        order.shopify_order_number?.includes(search) ||
        order.product_title?.toLowerCase().includes(search.toLowerCase()) ||
        order.customer_email?.toLowerCase().includes(search.toLowerCase())
      const matchesDate = !dateFilter || order.tour_date === dateFilter
      const matchesStatus = !statusFilter || order.status === statusFilter
      const matchesPayment = !paymentFilter || order.payment_status === paymentFilter
      return matchesSearch && matchesDate && matchesStatus && matchesPayment
    })
  }, [orders, search, dateFilter, statusFilter, paymentFilter])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const totalRevenue = filteredOrders.reduce((s, o) => s + o.total_amount, 0)
  const paidCount = filteredOrders.filter(o => o.payment_status === 'paid').length
  const pendingCount = filteredOrders.filter(o => o.payment_status === 'pending').length

  // Export CSV
  const exportCSV = () => {
    if (!hasPermission('canExport')) return
    const headers = ['Order #', 'Date', 'Customer', 'Email', 'Phone', 'Product', 'Tour Date', 'Pax', 'Amount', 'Payment', 'Status']
    const rows = filteredOrders.map(o => [
      o.shopify_order_number,
      formatDate(o.received_at),
      o.customer_name,
      o.customer_email || '',
      o.customer_phone || '',
      o.product_title || '',
      o.tour_date || '',
      `${o.adults}A ${o.children}C ${o.infants}I`,
      o.total_amount,
      o.payment_status,
      o.status
    ])
    const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Export for print/PDF
  const exportPDF = () => {
    window.print()
  }

  // Share via Web Share API
  const shareData = async () => {
    const text = `Tour Orders Summary\n\nTotal: ${filteredOrders.length} orders\nRevenue: ${formatCurrency(totalRevenue)}\nPaid: ${paidCount}\nPending: ${pendingCount}`
    if (navigator.share) {
      await navigator.share({ title: 'Tour Orders', text })
    } else {
      navigator.clipboard.writeText(text)
      alert('Summary copied to clipboard!')
    }
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Orders</h1>
          <p className="text-gray-500 mt-1">Manage tour bookings</p>
        </div>
        
        {hasPermission('canExport') && (
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCSV} className="neu-btn px-4 py-2 flex items-center gap-2 text-sm">
              <Download size={16} /> CSV
            </button>
            <button onClick={exportPDF} className="neu-btn-accent px-4 py-2 flex items-center gap-2 text-sm no-print">
              <FileText size={16} /> Print
            </button>
            <button onClick={shareData} className="neu-flat px-4 py-2 flex items-center gap-2 text-sm text-gray-600 no-print">
              <Share2 size={16} /> Share
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 no-print">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)}
            className="neu-input w-full pl-11 pr-4 py-3" />
        </div>
        <div className="relative">
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="neu-input pl-11 pr-4 py-3" />
        </div>
        <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="neu-input px-4 py-3">
          <option value="">All Payments</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="neu-card p-4">
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="text-2xl font-bold text-[#2D3748]">{filteredOrders.length}</p>
        </div>
        <div className="neu-card p-4">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-[#9370DB]">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="neu-card p-4">
          <p className="text-sm text-gray-500">Paid</p>
          <p className="text-2xl font-bold text-green-500">{paidCount}</p>
        </div>
        <div className="neu-card p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-500">{pendingCount}</p>
        </div>
      </div>

      {/* Table */}
      <div className="neu-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="table-header">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-[#2D3748]">Order #</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-[#2D3748]">Customer</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-[#2D3748] hidden md:table-cell">Product</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-[#2D3748]">Tour Date</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-[#2D3748] hidden lg:table-cell">Pax</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-[#2D3748]">Amount</th>
                <th className="text-center px-6 py-4 text-sm font-semibold text-[#2D3748]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-[#9370DB]">#{order.shopify_order_number}</span>
                    <p className="text-xs text-gray-400">{formatDate(order.received_at)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-[#2D3748]">{order.customer_name}</p>
                    <p className="text-sm text-gray-400 truncate max-w-[180px]">{order.customer_email}</p>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <p className="text-gray-600 truncate max-w-[200px]">{order.product_title || '-'}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{order.tour_date || '-'}</td>
                  <td className="px-6 py-4 hidden lg:table-cell text-gray-600">
                    <span className="text-sm">{order.adults}A {order.children > 0 && `${order.children}C `}{order.infants > 0 && `${order.infants}I`}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-[#2D3748]">{formatCurrency(order.total_amount)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`badge ${order.payment_status === 'paid' ? 'badge-paid' : 'badge-pending'}`}>
                      {order.payment_status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  <ShoppingCart size={48} className="mx-auto mb-3 opacity-30" />
                  <p>No orders found</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
