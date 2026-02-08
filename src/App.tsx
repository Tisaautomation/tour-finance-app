import { useState, useEffect, useRef } from 'react'
import { supabase, ShopifyOrder, Transaction, ROLE_PERMISSIONS } from './lib/supabase'
import { useAuth, AuthProvider } from './context/AuthContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import OrdersTable from './components/OrdersTable'
import ExpenseForm from './components/ExpenseForm'
import TransactionsTable from './components/TransactionsTable'
import UserManagement from './components/UserManagement'
import ChatInbox from './components/ChatInbox'
import TourBlocker from './components/TourBlocker'
import { 
  LayoutDashboard, ShoppingCart, Receipt, PlusCircle, Menu, X, LogOut, User, Users, MessageCircle, Bell, ShieldBan
} from 'lucide-react'

type View = 'dashboard' | 'orders' | 'transactions' | 'add-expense' | 'users' | 'chat' | 'blocker'

function AppContent() {
  const { user, logout, hasPermission } = useAuth()
  const [view, setView] = useState<View>('dashboard')
  const [orders, setOrders] = useState<ShopifyOrder[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  
  const audioCtxRef = useRef<AudioContext | null>(null)
  const soundEnabledRef = useRef(false)
  const viewRef = useRef<View>('dashboard')
  const knownMsgIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    viewRef.current = view
  }, [view])

  const playSound = (soft: boolean) => {
    try {
      if (!audioCtxRef.current || !soundEnabledRef.current) return
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()
      
      const now = ctx.currentTime
      const volume = soft ? 0.2 : 0.5
      
      if (!soft) {
        const osc1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        osc1.connect(gain1)
        gain1.connect(ctx.destination)
        osc1.frequency.value = 800
        osc1.type = 'sine'
        gain1.gain.setValueAtTime(volume, now)
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
        osc1.start(now)
        osc1.stop(now + 0.2)
        
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.frequency.value = 1000
        osc2.type = 'sine'
        gain2.gain.setValueAtTime(volume, now + 0.15)
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35)
        osc2.start(now + 0.15)
        osc2.stop(now + 0.35)
      } else {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(1200, now)
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.06)
        osc.type = 'sine'
        gain.gain.setValueAtTime(volume, now)
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08)
        osc.start(now)
        osc.stop(now + 0.1)
      }
    } catch (e) {
      console.log('Sound error:', e)
    }
  }

  const showNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/images/compass.png',
        tag: 'chat-message'
      })
    }
  }

  const enableNotifications = async () => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtxRef.current = new AC()
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume()
      }
      soundEnabledRef.current = true
      
      if ('Notification' in window && Notification.permission !== 'granted') {
        await Notification.requestPermission()
      }
      
      setNotificationsEnabled(true)
      playSound(false)
    } catch (e) {
      console.log('Enable error:', e)
      setNotificationsEnabled(true)
    }
  }

  useEffect(() => {
    if (!user) return

    const loadExisting = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(500)
      if (data) {
        data.forEach((m: { id: string }) => knownMsgIds.current.add(m.id))
      }
    }
    loadExisting()

    const channel = supabase.channel('global_messages')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' }, 
        (payload: { new: { id: string; sender: string; content: string } }) => {
          const msg = payload.new
          
          if (msg.sender === 'customer' && !knownMsgIds.current.has(msg.id)) {
            knownMsgIds.current.add(msg.id)
            
            const isInChat = viewRef.current === 'chat'
            
            playSound(isInChat)
            showNotification('💬 New Message', msg.content?.substring(0, 50) || 'New message')
            
            if (!isInChat) {
              setUnreadCount(prev => prev + 1)
            }
          }
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    if (view === 'chat') {
      setUnreadCount(0)
    }
  }, [view])

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

  // NEW SIDEBAR ORDER: Dashboard, Chat, Blocker, Add Expense, Orders, Users
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'canViewDashboard' },
    { id: 'chat', label: 'Chat Inbox', icon: MessageCircle, permission: 'canViewDashboard', badge: unreadCount },
    { id: 'blocker', label: 'Tour Blocker', icon: ShieldBan, permission: 'canManageBlocks' },
    { id: 'add-expense', label: 'Add Expense', icon: PlusCircle, permission: 'canAddExpense' },
    { id: 'orders', label: 'Manage Orders', icon: ShoppingCart, permission: 'canViewOrders' },
    { id: 'transactions', label: 'Transactions', icon: Receipt, permission: 'canViewTransactions' },
    { id: 'users', label: 'Users', icon: Users, permission: 'canManageUsers' },
  ].filter(item => hasPermission(item.permission as keyof typeof ROLE_PERMISSIONS.admin))

  return (
    <div className="min-h-screen lg:h-screen w-full lg:overflow-hidden flex flex-col" style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 25%, #E8EEF5 50%, #DDD6F3 75%, #C4B5E0 100%)' }}>
      {/* Notification Banner - only if not enabled */}
      {!notificationsEnabled && (
        <div className="fixed top-0 left-0 right-0 z-[100] p-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center">
          <button onClick={enableNotifications} className="flex items-center justify-center gap-2 w-full font-medium text-sm">
            <Bell size={16} />
            🔔 Tap to enable notifications
          </button>
        </div>
      )}
      
      {/* Mobile header */}
      <div className={`lg:hidden neu-card mx-3 mt-3 p-3 flex items-center justify-between no-print ${!notificationsEnabled ? 'mt-12' : ''}`}>
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

      <div className={`flex flex-1 lg:min-h-0 ${!notificationsEnabled ? 'lg:pt-10' : ''}`}>
        {/* Sidebar */}
        <aside className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          fixed lg:static inset-y-0 left-0 z-50
          w-64 lg:w-72 transition-transform duration-300
          h-full p-3 lg:p-4 no-print
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
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                      {item.badge}
                    </span>
                  )}
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
        <main className="flex-1 min-w-0 p-3 lg:p-4 lg:pr-4 w-full flex flex-col lg:min-h-0">
          <div className="w-full flex-1 lg:min-h-0 flex flex-col">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="spinner w-12 h-12 lg:w-16 lg:h-16"></div>
              </div>
            ) : (
              <>
                {view === 'dashboard' && <Dashboard orders={orders} transactions={transactions} onRefresh={fetchData} />}
                {view === 'chat' && <ChatInbox />}
                {view === 'blocker' && <TourBlocker />}
                {view === 'orders' && <OrdersTable orders={orders} />}
                {view === 'transactions' && <TransactionsTable transactions={transactions} />}
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
