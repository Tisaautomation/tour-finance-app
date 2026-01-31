import { useState, useMemo, useEffect } from 'react'
import { ShopifyOrder, Transaction, supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { 
  DollarSign, TrendingUp, TrendingDown, ShoppingCart, Calendar,
  ArrowUpRight, ArrowDownRight, Filter, BarChart3,
  TrendingUp as LineIcon, Mail, RefreshCw, X, Plus, Send
} from 'lucide-react'
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

interface Props {
  orders: ShopifyOrder[]
  transactions: Transaction[]
  onRefresh: () => void
}

type ChartType = 'area' | 'bar' | 'line'
type TimeRange = '7d' | '30d' | '90d' | 'all'

export default function Dashboard({ orders, transactions, onRefresh }: Props) {
  const { hasPermission } = useAuth()
  const [chartType, setChartType] = useState<ChartType>('area')
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailRecipients, setEmailRecipients] = useState<string[]>([])
  const [newEmail, setNewEmail] = useState('')

  // Load saved email recipients
  useEffect(() => {
    loadEmailRecipients()
  }, [])

  async function loadEmailRecipients() {
    const { data } = await supabase
      .from('email_recipients')
      .select('email')
      .order('created_at', { ascending: true })
    
    if (data) {
      setEmailRecipients(data.map(r => r.email))
    }
  }

  async function addEmailRecipient() {
    if (!newEmail || !newEmail.includes('@')) return
    
    const { error } = await supabase.from('email_recipients').insert({ email: newEmail })
    if (!error) {
      setEmailRecipients([...emailRecipients, newEmail])
      setNewEmail('')
    }
  }

  async function removeEmailRecipient(email: string) {
    await supabase.from('email_recipients').delete().eq('email', email)
    setEmailRecipients(emailRecipients.filter(e => e !== email))
  }

  // Filter data by time range
  const filteredOrders = useMemo(() => {
    const now = new Date()
    const cutoff = new Date()
    
    switch(timeRange) {
      case '7d': cutoff.setDate(now.getDate() - 7); break
      case '30d': cutoff.setDate(now.getDate() - 30); break
      case '90d': cutoff.setDate(now.getDate() - 90); break
      default: cutoff.setTime(0)
    }
    
    return orders.filter(o => new Date(o.received_at) >= cutoff)
  }, [orders, timeRange])

  const filteredTransactions = useMemo(() => {
    const now = new Date()
    const cutoff = new Date()
    
    switch(timeRange) {
      case '7d': cutoff.setDate(now.getDate() - 7); break
      case '30d': cutoff.setDate(now.getDate() - 30); break
      case '90d': cutoff.setDate(now.getDate() - 90); break
      default: cutoff.setTime(0)
    }
    
    return transactions.filter(t => new Date(t.date) >= cutoff)
  }, [transactions, timeRange])

  // KPIs
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
  const totalExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const netProfit = totalRevenue - totalExpenses
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0'
  
  // Today's data
  const today = new Date().toISOString().split('T')[0]
  const todayOrders = orders.filter(o => o.received_at?.startsWith(today))
  const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
  const yesterdayOrders = orders.filter(o => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return o.received_at?.startsWith(d.toISOString().split('T')[0])
  })
  const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
  const revenueChange = yesterdayRevenue > 0 ? (((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(0) : '0'

  // Chart data by day
  const dailyData = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 30
    const data: Record<string, { revenue: number; expenses: number; orders: number }> = {}
    
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      data[key] = { revenue: 0, expenses: 0, orders: 0 }
    }
    
    filteredOrders.forEach(o => {
      const date = o.received_at?.split('T')[0]
      if (date && data[date]) {
        data[date].revenue += o.total_amount || 0
        data[date].orders += 1
      }
    })
    
    filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
      const date = t.date
      if (date && data[date]) {
        data[date].expenses += Math.abs(t.amount)
      }
    })
    
    return Object.entries(data).map(([date, values]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ...values
    }))
  }, [filteredOrders, filteredTransactions, timeRange])

  // Payment methods pie
  const paymentData = useMemo(() => {
    const methods: Record<string, number> = {}
    filteredOrders.forEach(o => {
      const method = o.payment_method || 'Other'
      methods[method] = (methods[method] || 0) + (o.total_amount || 0)
    })
    return Object.entries(methods).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredOrders])

  // Expense categories
  const expenseData = useMemo(() => {
    const cats: Record<string, number> = {}
    filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.category || 'Other'
      cats[cat] = (cats[cat] || 0) + Math.abs(t.amount)
    })
    return Object.entries(cats).map(([name, value]) => ({ 
      name: name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()), 
      value 
    })).sort((a, b) => b.value - a.value)
  }, [filteredTransactions])

  const COLORS = ['#9370DB', '#00CED1', '#B19CD9', '#40E0D0', '#7B68EE', '#008B8B']

  const formatCurrency = (n: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(n)

  // Send summary email via n8n
  const sendSummaryEmail = async () => {
    if (!hasPermission('canSendEmails') || emailRecipients.length === 0) return
    setSendingEmail(true)
    try {
      await fetch('https://timelessconcept.app.n8n.cloud/webhook/finance-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: emailRecipients,
          date: today,
          totalRevenue,
          totalExpenses,
          netProfit,
          ordersCount: filteredOrders.length,
          topProducts: [...new Set(filteredOrders.map(o => o.product_title))].slice(0, 5)
        })
      })
      alert('Summary email sent to ' + emailRecipients.length + ' recipients!')
      setShowEmailModal(false)
    } catch {
      alert('Failed to send email')
    }
    setSendingEmail(false)
  }

  // Render chart based on type
  const renderChart = () => {
    const commonProps = { data: dailyData }
    
    if (chartType === 'bar') {
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="date" stroke="#A0AEC0" fontSize={12} />
          <YAxis stroke="#A0AEC0" fontSize={12} />
          <Tooltip formatter={(v) => formatCurrency(v as number)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
          <Legend />
          <Bar dataKey="revenue" name="Revenue" fill="#9370DB" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill="#00CED1" radius={[4, 4, 0, 0]} />
        </BarChart>
      )
    }
    
    if (chartType === 'line') {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="date" stroke="#A0AEC0" fontSize={12} />
          <YAxis stroke="#A0AEC0" fontSize={12} />
          <Tooltip formatter={(v) => formatCurrency(v as number)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
          <Legend />
          <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#9370DB" strokeWidth={3} dot={{ fill: '#9370DB' }} />
          <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#00CED1" strokeWidth={3} dot={{ fill: '#00CED1' }} />
        </LineChart>
      )
    }
    
    return (
      <AreaChart {...commonProps}>
        <defs>
          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#9370DB" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="#9370DB" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00CED1" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="#00CED1" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="date" stroke="#A0AEC0" fontSize={12} />
        <YAxis stroke="#A0AEC0" fontSize={12} />
        <Tooltip formatter={(v) => formatCurrency(v as number)} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
        <Legend />
        <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#9370DB" strokeWidth={2} fill="url(#colorRev)" />
        <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#00CED1" strokeWidth={2} fill="url(#colorExp)" />
      </AreaChart>
    )
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Dashboard</h1>
          <p className="text-gray-500 mt-1">Business overview & analytics</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onRefresh} className="neu-btn-accent px-4 py-2 flex items-center gap-2 text-sm">
            <RefreshCw size={16} /> Refresh
          </button>
          {hasPermission('canSendEmails') && (
            <button onClick={() => setShowEmailModal(true)} className="neu-btn px-4 py-2 flex items-center gap-2 text-sm">
              <Mail size={16} /> Email Summary
            </button>
          )}
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="neu-card p-6 w-full max-w-md fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#2D3748]">Email Summary</h2>
              <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            {/* Add email */}
            <div className="flex gap-2 mb-4">
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="Add email recipient..."
                className="neu-input flex-1 px-4 py-2 text-sm"
                onKeyDown={e => e.key === 'Enter' && addEmailRecipient()}
              />
              <button onClick={addEmailRecipient} className="neu-btn-accent px-3 py-2">
                <Plus size={18} />
              </button>
            </div>

            {/* Recipients list */}
            <div className="max-h-40 overflow-y-auto mb-4 space-y-2">
              {emailRecipients.map(email => (
                <div key={email} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-600">{email}</span>
                  <button onClick={() => removeEmailRecipient(email)} className="p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-600">
                    <X size={16} />
                  </button>
                </div>
              ))}
              {emailRecipients.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No recipients added yet</p>
              )}
            </div>

            {/* Send button */}
            <button
              onClick={sendSummaryEmail}
              disabled={sendingEmail || emailRecipients.length === 0}
              className="neu-btn w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sendingEmail ? 'Sending...' : <><Send size={18} /> Send Summary</>}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 neu-flat px-4 py-2 rounded-xl">
          <Filter size={16} className="text-gray-500" />
          <span className="text-sm font-bold text-gray-600">Period:</span>
          <select value={timeRange} onChange={e => setTimeRange(e.target.value as TimeRange)} className="bg-transparent text-sm font-bold focus:outline-none text-[#9370DB]">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <div className="neu-card p-5 relative overflow-hidden">
          <div className="flex justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-500 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-[#2D3748] truncate">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl icon-primary flex items-center justify-center flex-shrink-0">
              <DollarSign className="text-white" size={22} />
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-[#9370DB] opacity-10" />
        </div>

        <div className="neu-card p-5 relative overflow-hidden">
          <div className="flex justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-500 mb-1">Total Expenses</p>
              <p className="text-2xl font-bold text-[#2D3748] truncate">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl icon-accent flex items-center justify-center flex-shrink-0">
              <TrendingDown className="text-white" size={22} />
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-[#00CED1] opacity-10" />
        </div>

        <div className="neu-card p-5 relative overflow-hidden">
          <div className="flex justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-500 mb-1">Net Profit</p>
              <p className={`text-2xl font-bold truncate ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(netProfit)}</p>
              <p className="text-xs font-semibold text-gray-400 mt-1">{profitMargin}% margin</p>
            </div>
            <div className={`w-12 h-12 rounded-2xl ${netProfit >= 0 ? 'icon-green' : 'icon-red'} flex items-center justify-center flex-shrink-0`}>
              <TrendingUp className="text-white" size={22} />
            </div>
          </div>
        </div>

        <div className="neu-card p-5 relative overflow-hidden">
          <div className="flex justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-500 mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-[#2D3748]">{filteredOrders.length}</p>
              <p className="text-xs font-semibold text-gray-400 mt-1">Avg: {formatCurrency(filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0)}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl icon-primary flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="text-white" size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* Today Card */}
      <div className="neu-card p-6 mb-6 today-gradient text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={20} />
            <span className="font-bold text-lg">Today's Performance</span>
            {parseInt(revenueChange) !== 0 && (
              <span className={`ml-auto flex items-center gap-1 text-sm font-semibold ${parseInt(revenueChange) > 0 ? 'text-green-200' : 'text-red-200'}`}>
                {parseInt(revenueChange) > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {Math.abs(parseInt(revenueChange))}% vs yesterday
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div><p className="text-white/70 text-sm font-semibold">Orders</p><p className="text-3xl font-bold">{todayOrders.length}</p></div>
            <div><p className="text-white/70 text-sm font-semibold">Revenue</p><p className="text-3xl font-bold">{formatCurrency(todayRevenue)}</p></div>
            <div><p className="text-white/70 text-sm font-semibold">Avg. Order</p><p className="text-3xl font-bold">{formatCurrency(todayOrders.length > 0 ? todayRevenue / todayOrders.length : 0)}</p></div>
            <div><p className="text-white/70 text-sm font-semibold">Paid</p><p className="text-3xl font-bold">{todayOrders.filter(o => o.payment_status === 'paid').length}/{todayOrders.length}</p></div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Main Chart */}
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#2D3748]">Revenue vs Expenses</h2>
            <div className="flex gap-1">
              <button onClick={() => setChartType('area')} className={`p-2 rounded-lg ${chartType === 'area' ? 'bg-[#9370DB]/20 text-[#9370DB]' : 'text-gray-400 hover:bg-gray-100'}`}><TrendingUp size={18} /></button>
              <button onClick={() => setChartType('bar')} className={`p-2 rounded-lg ${chartType === 'bar' ? 'bg-[#9370DB]/20 text-[#9370DB]' : 'text-gray-400 hover:bg-gray-100'}`}><BarChart3 size={18} /></button>
              <button onClick={() => setChartType('line')} className={`p-2 rounded-lg ${chartType === 'line' ? 'bg-[#9370DB]/20 text-[#9370DB]' : 'text-gray-400 hover:bg-gray-100'}`}><LineIcon size={18} /></button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            {renderChart()}
          </ResponsiveContainer>
        </div>

        {/* Payment Methods */}
        <div className="neu-card p-6">
          <h2 className="text-lg font-bold text-[#2D3748] mb-4">Revenue by Payment Method</h2>
          {paymentData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v as number)} contentStyle={{ borderRadius: 12, border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {paymentData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-medium text-gray-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="flex items-center justify-center h-[250px] text-gray-400">No data</div>}
        </div>

        {/* Expenses by Category */}
        <div className="neu-card p-6">
          <h2 className="text-lg font-bold text-[#2D3748] mb-4">Expenses by Category</h2>
          {expenseData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={expenseData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" stroke="#A0AEC0" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#A0AEC0" fontSize={12} width={100} />
                <Tooltip formatter={(v) => formatCurrency(v as number)} contentStyle={{ borderRadius: 12, border: 'none' }} />
                <Bar dataKey="value" fill="#00CED1" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-[280px] text-gray-400">No expenses recorded</div>}
        </div>

        {/* Recent Orders */}
        <div className="neu-card p-6">
          <h2 className="text-lg font-bold text-[#2D3748] mb-4">Recent Orders</h2>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {orders.slice(0, 6).map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 hover:bg-gray-100/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9370DB]/20 to-[#00CED1]/20 flex items-center justify-center flex-shrink-0">
                    <ShoppingCart size={18} className="text-[#9370DB]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#2D3748]">#{order.shopify_order_number}</p>
                    <p className="text-sm text-gray-500 truncate">{order.customer_name}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="font-bold text-[#2D3748]">{formatCurrency(order.total_amount)}</p>
                  <span className={`badge ${order.payment_status === 'paid' ? 'badge-paid' : 'badge-pending'}`}>{order.payment_status}</span>
                </div>
              </div>
            ))}
            {orders.length === 0 && <div className="text-center py-8 text-gray-400"><ShoppingCart size={40} className="mx-auto mb-2 opacity-30" /><p>No orders yet</p></div>}
          </div>
        </div>
      </div>
    </div>
  )
}
