import { useState, useEffect } from 'react'
import { supabase, ShopifyOrder, Transaction } from './lib/supabase'
import Dashboard from './components/Dashboard'
import OrdersTable from './components/OrdersTable'
import ExpenseForm from './components/ExpenseForm'
import TransactionsTable from './components/TransactionsTable'
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Receipt, 
  PlusCircle,
  Menu,
  X
} from 'lucide-react'

type View = 'dashboard' | 'orders' | 'transactions' | 'add-expense'

// Logo component - using real TIK branding
const Logo = () => (
  <div className="flex items-center gap-3">
    <img src="/images/compass.png" alt="TIK" className="w-12 h-12 object-contain" />
    <div>
      <h1 className="text-xl font-bold gradient-text">Tour in Koh Samui</h1>
      <p className="text-xs text-gray-400">Finance Dashboard</p>
    </div>
  </div>
)

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [orders, setOrders] = useState<ShopifyOrder[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    
    const { data: ordersData } = await supabase
      .from('shopify_orders')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(100)
    
    if (ordersData) setOrders(ordersData)

    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .limit(100)
    
    if (txData) setTransactions(txData)
    
    setLoading(false)
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'add-expense', label: 'Add Expense', icon: PlusCircle },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #F7FAFC 0%, #EDF2F7 100%)' }}>
      {/* Mobile header */}
      <div className="lg:hidden neu-card m-4 p-4 flex items-center justify-between">
        <Logo />
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
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
          lg:min-h-screen p-4
        `}>
          <div className="neu-card h-full p-6">
            {/* Logo */}
            <div className="hidden lg:block mb-8">
              <Logo />
            </div>
            
            {/* Navigation */}
            <nav className="space-y-2">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setView(item.id as View)
                    setSidebarOpen(false)
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                    transition-all duration-300 font-medium
                    ${view === item.id 
                      ? 'sidebar-active text-white' 
                      : 'text-[#2D3748] hover:bg-gray-50'}
                  `}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Footer info */}
            <div className="mt-auto pt-8 border-t border-gray-100 mt-8">
              <p className="text-xs text-gray-400 text-center">
                © 2026 Tour in Koh Samui
              </p>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-8 lg:pl-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-[#00CED1]/20"></div>
                <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-transparent border-t-[#00CED1] animate-spin"></div>
              </div>
            </div>
          ) : (
            <>
              {view === 'dashboard' && (
                <Dashboard orders={orders} transactions={transactions} />
              )}
              {view === 'orders' && (
                <OrdersTable orders={orders} />
              )}
              {view === 'transactions' && (
                <TransactionsTable transactions={transactions} />
              )}
              {view === 'add-expense' && (
                <ExpenseForm onSuccess={() => {
                  fetchData()
                  setView('transactions')
                }} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
