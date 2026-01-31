import { useState, useEffect } from 'react'
import { supabase, ShopifyOrder, Transaction, ROLE_PERMISSIONS } from './lib/supabase'
import { useAuth, AuthProvider } from './context/AuthContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import OrdersTable from './components/OrdersTable'
import ExpenseForm from './components/ExpenseForm'
import TransactionsTable from './components/TransactionsTable'
import UserManagement from './components/UserManagement'
import ChatInbox from './components/ChatInbox'
import { 
  LayoutDashboard, ShoppingCart, Receipt, PlusCircle, Menu, X, LogOut, User, Users, MessageCircle
} from 'lucide-react'

type View = 'dashboard' | 'orders' | 'transactions' | 'add-expense' | 'users' | 'chat'

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
    { id: 'chat', label: 'Chat Inbox', icon: MessageCircle, permission: 'canViewDashboard' },
    { id: 'add-expense', label: 'Add Expense', icon: PlusCircle, permission: 'canAddExpense' },
    { id: 'users', label: 'Users', icon: Users, permission: 'canManageUsers' },
  ].filter(item => hasPermission(item.permission as keyof typeof ROLE_PERMISSIONS.admin))

  return (
    <div className="min-h-screen w-full overflow-x-hidden" style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 25%, #E8EEF5 50%, #DDD6F3 75%, #C4B5E0 100%)' }}>
      {/* Mobile header */}
      <div className="lg:hidden neu-card mx-3 mt-3 p-3 flex items-center justify-between no-print">
        <div className="flex items-center gap-2">
          <div className="logo-circle-sm">
            <img src="/images/compass.png" alt="SATP" />
          </div>
          <span className="font-bold gradient-text text-sm">SATP App</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-xl hover:bg-gray-100">
          {sidebarOpen ? <X size={22} className="text-[#2D3748]" /> : <Menu size={22} className="text-[#2D3748]" />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          fixed lg:static inset-y-0 left-0 z-50
          w-64 lg:w-72 transition-transform duration-300
          lg:min-h-screen p-3 lg:p-4 no-print
        `}>
          <div className="neu-card h-full p-4 lg:p-6 flex flex-col">
            {/* Logo */}
            <div className="hidden lg:flex items-center gap-3 mb-8">
              <div className="logo-circle">
                <img src="/images/compass.png" alt="SATP" />
              </div>
              <div>
                <h1 className="text-lg font-bold gradient-text">SATP App</h1>
                <p className="text-xs text-gray-400">Tour Management</p>
              </div>
            </div>
            
            {/* Navigation */}
            <nav className="space-y-1 lg:space-y-2 flex-1">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setView(item.id as View); setSidebarOpen(false) }}
                  className={`sidebar-item w-full flex items-center gap-3 px-3 lg:px-4 py-3 font-medium transition-all text-sm lg:text-base ${
                    view === item.id ? 'sidebar-active text-white' : 'text-[#2D3748] hover:bg-gray-50'
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </button>
              ))}
            </nav>

            {/* User Info */}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 lg:gap-3 mb-3 p-2 lg:p-3 rounded-xl bg-gray-50/50">
                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl icon-primary flex items-center justify-center">
                  <User size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#2D3748] text-xs lg:text-sm truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                </div>
              </div>
              <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-3 py-2 lg:py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors font-medium text-sm">
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-3 lg:p-6 lg:pl-4 w-full">
          <div className="w-full max-w-full overflow-x-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="spinner w-12 h-12 lg:w-16 lg:h-16"></div>
              </div>
            ) : (
              <>
                {view === 'dashboard' && <Dashboard orders={orders} transactions={transactions} onRefresh={fetchData} />}
                {view === 'orders' && <OrdersTable orders={orders} />}
                {view === 'transactions' && <TransactionsTable transactions={transactions} />}
                {view === 'chat' && <ChatInbox />}
                {view === 'add-expense' && <ExpenseForm onSuccess={() => { fetchData(); setView('transactions') }} />}
                {view === 'users' && <UserManagement />}
              </>
            )}
          </div>
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
