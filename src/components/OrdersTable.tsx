import { useState } from 'react'
import { ShopifyOrder } from '../lib/supabase'
import { Search, Download, Calendar, Filter, ShoppingCart } from 'lucide-react'

interface Props {
  orders: ShopifyOrder[]
}

export default function OrdersTable({ orders }: Props) {
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      order.shopify_order_number?.includes(search) ||
      order.product_title?.toLowerCase().includes(search.toLowerCase())
    const matchesDate = !dateFilter || order.tour_date === dateFilter
    return matchesSearch && matchesDate
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(amount)
  }

  const exportToCSV = () => {
    const headers = ['Order #', 'Customer', 'Product', 'Tour Date', 'Pax', 'Amount', 'Status', 'Payment']
    const rows = filteredOrders.map(o => [
      o.shopify_order_number, o.customer_name, o.product_title || '', o.tour_date || '',
      `${o.adults}A ${o.children}C ${o.infants}I`, o.total_amount, o.status, o.payment_status
    ])
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Orders</h1>
          <p className="text-gray-500 mt-1">Manage your tour bookings</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)}
              className="neu-input pl-11 pr-4 py-3 w-full sm:w-64" />
          </div>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
              className="neu-input pl-11 pr-4 py-3" />
          </div>
          <button onClick={exportToCSV} className="neu-btn flex items-center justify-center gap-2 text-white px-5 py-3">
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="neu-card p-4">
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="text-2xl font-bold text-[#2D3748]">{filteredOrders.length}</p>
        </div>
        <div className="neu-card p-4">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-[#00CED1]">{formatCurrency(filteredOrders.reduce((s, o) => s + o.total_amount, 0))}</p>
        </div>
        <div className="neu-card p-4">
          <p className="text-sm text-gray-500">Paid</p>
          <p className="text-2xl font-bold text-green-500">{filteredOrders.filter(o => o.payment_status === 'paid').length}</p>
        </div>
        <div className="neu-card p-4">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-yellow-500">{filteredOrders.filter(o => o.payment_status !== 'paid').length}</p>
        </div>
      </div>

      <div className="neu-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-[#00CED1]/10 to-[#9370DB]/10">
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
                    <span className="font-semibold text-[#00CED1]">#{order.shopify_order_number}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-[#2D3748]">{order.customer_name}</p>
                      <p className="text-sm text-gray-400">{order.customer_email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <p className="text-gray-600 truncate max-w-[200px]">{order.product_title || '-'}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{order.tour_date || '-'}</td>
                  <td className="px-6 py-4 hidden lg:table-cell text-gray-600">
                    {order.adults}A {order.children > 0 ? `${order.children}C` : ''} {order.infants > 0 ? `${order.infants}I` : ''}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-[#2D3748]">{formatCurrency(order.total_amount)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex px-3 py-1.5 text-xs font-semibold rounded-full ${
                      order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>{order.payment_status}</span>
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
