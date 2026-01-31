import { ShopifyOrder, Transaction } from '../lib/supabase'
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts'

interface Props {
  orders: ShopifyOrder[]
  transactions: Transaction[]
}

export default function Dashboard({ orders, transactions }: Props) {
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const netProfit = totalRevenue - totalExpenses
  const totalOrders = orders.length
  
  const today = new Date().toISOString().split('T')[0]
  const todayOrders = orders.filter(o => o.received_at?.startsWith(today))
  const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)

  const paymentMethods: Record<string, number> = {}
  orders.forEach(o => {
    const method = o.payment_method || 'unknown'
    paymentMethods[method] = (paymentMethods[method] || 0) + (o.total_amount || 0)
  })
  const paymentData = Object.entries(paymentMethods).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }))

  const last7Days: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    last7Days[date.toISOString().split('T')[0]] = 0
  }
  orders.forEach(o => {
    const date = o.received_at?.split('T')[0]
    if (date && last7Days.hasOwnProperty(date)) {
      last7Days[date] += o.total_amount || 0
    }
  })
  const dailyData = Object.entries(last7Days).map(([date, revenue]) => ({
    date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
    revenue
  }))

  const expenseCategories: Record<string, number> = {}
  transactions.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category || 'other'
    expenseCategories[cat] = (expenseCategories[cat] || 0) + Math.abs(t.amount)
  })
  const expenseData = Object.entries(expenseCategories).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value
  }))

  const COLORS = ['#00CED1', '#9370DB', '#40E0D0', '#B19CD9', '#008B8B', '#7B68EE']

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const KPICard = ({ title, value, icon: Icon, gradient }: { 
    title: string; value: string; icon: any; gradient: string 
  }) => (
    <div className="neu-card p-6 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="relative z-10">
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-[#2D3748]">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${gradient}`}>
          <Icon className="text-white" size={24} />
        </div>
      </div>
      <div className={`absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-10 ${gradient}`} />
    </div>
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold gradient-text">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your tour business finances</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} gradient="bg-gradient-to-br from-[#00CED1] to-[#008B8B]" />
        <KPICard title="Total Expenses" value={formatCurrency(totalExpenses)} icon={TrendingDown} gradient="bg-gradient-to-br from-[#9370DB] to-[#7B68EE]" />
        <KPICard title="Net Profit" value={formatCurrency(netProfit)} icon={TrendingUp} gradient={netProfit >= 0 ? "bg-gradient-to-br from-green-400 to-green-600" : "bg-gradient-to-br from-red-400 to-red-600"} />
        <KPICard title="Total Orders" value={totalOrders.toString()} icon={ShoppingCart} gradient="bg-gradient-to-br from-[#40E0D0] to-[#00CED1]" />
      </div>

      <div className="neu-card p-6 mb-8 bg-gradient-to-r from-[#00CED1] to-[#9370DB] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={20} />
            <span className="font-semibold text-lg">Today's Performance</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div><p className="text-white/70 text-sm">Orders</p><p className="text-4xl font-bold">{todayOrders.length}</p></div>
            <div><p className="text-white/70 text-sm">Revenue</p><p className="text-4xl font-bold">{formatCurrency(todayRevenue)}</p></div>
            <div><p className="text-white/70 text-sm">Avg. Order</p><p className="text-4xl font-bold">{todayOrders.length > 0 ? formatCurrency(todayRevenue / todayOrders.length) : '฿0'}</p></div>
            <div><p className="text-white/70 text-sm">Paid</p><p className="text-4xl font-bold">{todayOrders.filter(o => o.payment_status === 'paid').length}/{todayOrders.length}</p></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="neu-card p-6">
          <h2 className="text-lg font-semibold text-[#2D3748] mb-4">Revenue Trend (7 Days)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00CED1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00CED1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" stroke="#A0AEC0" />
              <YAxis stroke="#A0AEC0" />
              <Tooltip formatter={(value) => formatCurrency(value as number)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Area type="monotone" dataKey="revenue" stroke="#00CED1" strokeWidth={3} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="neu-card p-6">
          <h2 className="text-lg font-semibold text-[#2D3748] mb-4">Revenue by Payment Method</h2>
          {paymentData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value">
                    {paymentData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center">
                {paymentData.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-sm text-gray-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (<div className="flex items-center justify-center h-[280px] text-gray-400">No data yet</div>)}
        </div>

        <div className="neu-card p-6">
          <h2 className="text-lg font-semibold text-[#2D3748] mb-4">Expenses by Category</h2>
          {expenseData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={expenseData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" stroke="#A0AEC0" />
                <YAxis dataKey="name" type="category" stroke="#A0AEC0" width={100} />
                <Tooltip formatter={(value) => formatCurrency(value as number)} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Bar dataKey="value" fill="#9370DB" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (<div className="flex items-center justify-center h-[280px] text-gray-400">No expenses recorded</div>)}
        </div>

        <div className="neu-card p-6">
          <h2 className="text-lg font-semibold text-[#2D3748] mb-4">Recent Orders</h2>
          <div className="space-y-3">
            {orders.slice(0, 5).map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00CED1]/20 to-[#9370DB]/20 flex items-center justify-center">
                    <ShoppingCart size={18} className="text-[#00CED1]" />
                  </div>
                  <div>
                    <p className="font-medium text-[#2D3748]">#{order.shopify_order_number}</p>
                    <p className="text-sm text-gray-500">{order.customer_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[#2D3748]">{formatCurrency(order.total_amount)}</p>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{order.payment_status}</span>
                </div>
              </div>
            ))}
            {orders.length === 0 && (<div className="text-center py-8 text-gray-400"><ShoppingCart size={40} className="mx-auto mb-2 opacity-50" /><p>No orders yet</p></div>)}
          </div>
        </div>
      </div>
    </div>
  )
}
