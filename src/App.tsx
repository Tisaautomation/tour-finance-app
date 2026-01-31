import { useState, useEffect } from 'react'
import { supabase, ShopifyOrder, Transaction, ROLE_PERMISSIONS } from './lib/supabase'
import { useAuth, AuthProvider } from './context/AuthContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import OrdersTable from './components/OrdersTable'
import ExpenseForm from './components/ExpenseForm'
import TransactionsTable from './components/TransactionsTable'
import { 
  LayoutDashboard, ShoppingCart, Receipt, PlusCircle, Menu, X, LogOut, User, Settings
} from 'lucide-react'

type View = 'dashboard' | 'orders' | 'transactions' | 'add-expense'

function AppContent() {
  const { user, logout, hasPermission } = useAuth()
  const [view, setView] = useState<View>('dashboard')
  const [orders, setOrders] = useState<ShopifyOrder[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  async function fetchData() {
    setLoading(true)
    
    const { data: ordersData } = await supabase
      .from('shopify_orders')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(500)
    
    if (ordersData) setOrders(ordersData)

    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .limit(500)
    
    if (txData) setTransactions(txData)
    
    setLoading(false)
  }

  if (!user) {
    return <Login />
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'canViewDashboard' },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, permission: 'canViewOrders' },
    { id: 'transactions', label: 'Transactions', icon: Receipt, permission: 'canViewTransactions' },
    { id: 'add-expense', label: 'Add Expense', icon: PlusCircle, permission: 'canAddExpense' },
  ].filter(item => hasPermission(item.permission as keyof typeof ROLE_PERMISSIONS.admin))

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145deg, #E8EEF5 0%, #F0F4F8 50%, #E4EAF1 100%)' }}>
      {/* Mobile header */}
      <div className="lg:hidden neu-card m-4 p-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <img src="/images/compass.png" alt="TIK" className="w-10 h-10" />
          <span className="font-bold gradient-text">TIK Finance</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-xl hover:bg-gray-100">
          {sidebarOpen ? <X size={24} className="text-[#2D3748]" /> : <Menu size={24} className="text-[#2D3748]" />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          fixed lg:static inset-y-0 left-0 z-50
          w-72 transition-transform duration-300
          lg:min-h-screen p-4 no-print
        `}>
          <div className="neu-card h-full p-6 flex flex-col">
            {/* Logo */}
            <div className="hidden lg:flex items-center gap-3 mb-8">
              <img src="/images/compass.png" alt="TIK" className="w-12 h-12" />
              <div>
                <h1 className="text-lg font-bold gradient-text">Tour in Koh Samui</h1>
                <p className="text-xs text-gray-400">Finance Dashboard</p>
              </div>
            </div>
            
            {/* Navigation */}
            <nav className="space-y-2 flex-1">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setView(item.id as View); setSidebarOpen(false) }}
                  className={`sidebar-item w-full flex items-center gap-3 px-4 py-3.5 font-medium transition-all ${
                    view === item.id ? 'sidebar-active text-white' : 'text-[#2D3748] hover:bg-gray-50'
                  }`}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
              ))}
            </nav>

            {/* User Info */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-gray-50/50">
                <div className="w-10 h-10 rounded-xl icon-primary flex items-center justify-center">
                  <User size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#2D3748] text-sm truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                </div>
              </div>
              <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors font-medium">
                <LogOut size={18} /> Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-8 lg:pl-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner w-16 h-16"></div>
            </div>
          ) : (
            <>
              {view === 'dashboard' && <Dashboard orders={orders} transactions={transactions} onRefresh={fetchData} />}
              {view === 'orders' && <OrdersTable orders={orders} />}
              {view === 'transactions' && <TransactionsTable transactions={transactions} />}
              {view === 'add-expense' && <ExpenseForm onSuccess={() => { fetchData(); setView('transactions') }} />}
            </>
          )}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
