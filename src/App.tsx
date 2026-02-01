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
import { 
  LayoutDashboard, ShoppingCart, Receipt, PlusCircle, Menu, X, LogOut, User, Users, MessageCircle, Volume2, Bell
} from 'lucide-react'

type View = 'dashboard' | 'orders' | 'transactions' | 'add-expense' | 'users' | 'chat'

interface Conversation {
  id: string
  customer_name: string | null
  status: string
}

function AppContent() {
  const { user, logout, hasPermission } = useAuth()
  const [view, setView] = useState<View>('dashboard')
  const [orders, setOrders] = useState<ShopifyOrder[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [unreadChats, setUnreadChats] = useState(0)
  
  const audioCtxRef = useRef<AudioContext | null>(null)
  const soundEnabledRef = useRef(false)
  const knownConvIds = useRef<Set<string>>(new Set())
  const viewRef = useRef<View>('dashboard')

  useEffect(() => {
    viewRef.current = view
  }, [view])

  // Play notification sound - normal volume, soft when in chat
  const playSound = (soft: boolean) => {
    try {
      if (!audioCtxRef.current || !soundEnabledRef.current) return
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()
      
      const now = ctx.currentTime
      const volume = soft ? 0.1 : 0.25 // Normal volume, not loud
      
      if (!soft) {
        // Two-tone notification (normal volume)
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
        // Soft water drop
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

  // Show browser notification
  const showNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/images/compass.png',
        badge: '/images/compass.png',
        tag: 'new-chat',
        renotify: true,
        requireInteraction: false
      })
    }
  }

  // Enable notifications (sound + browser notifications)
  const enableNotifications = async () => {
    try {
      // Enable sound
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtxRef.current = new AC()
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume()
      }
      soundEnabledRef.current = true
      
      // Request browser notification permission
      if ('Notification' in window) {
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          // Test notification
          new Notification('SATP App', {
            body: '✓ Notifications enabled!',
            icon: '/images/compass.png'
          })
        }
      }
      
      setNotificationsEnabled(true)
      // Test sound
      playSound(false)
    } catch (e) {
      console.log('Enable error:', e)
    }
  }

  // Global realtime subscription
  useEffect(() => {
    if (!user) return

    const loadExisting = async () => {
      const { data } = await supabase.from('conversations').select('id').limit(500)
      if (data) {
        data.forEach((c: { id: string }) => knownConvIds.current.add(c.id))
      }
    }
    loadExisting()

    const channel = supabase.channel('global_chat_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, 
        (payload: { new: Conversation }) => {
          const conv = payload.new
          if (!knownConvIds.current.has(conv.id)) {
            knownConvIds.current.add(conv.id)
            const isInChat = viewRef.current === 'chat'
            
            // Play sound: normal if not in chat, soft if in chat
            playSound(isInChat)
            
            // Show browser notification (works even when app is in background)
            showNotification(
              '💬 New Chat',
              `${conv.customer_name || 'Web Visitor'} started a conversation`
            )
            
            if (!isInChat) {
              setUnreadChats(prev => prev + 1)
            }
          }
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    if (view === 'chat') {
      setUnreadChats(0)
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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'canViewDashboard' },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, permission: 'canViewOrders' },
    { id: 'transactions', label: 'Transactions', icon: Receipt, permission: 'canViewTransactions' },
    { id: 'chat', label: 'Chat Inbox', icon: MessageCircle, permission: 'canViewDashboard', badge: unreadChats },
    { id: 'add-expense', label: 'Add Expense', icon: PlusCircle, permission: 'canAddExpense' },
    { id: 'users', label: 'Users', icon: Users, permission: 'canManageUsers' },
  ].filter(item => hasPermission(item.permission as keyof typeof ROLE_PERMISSIONS.admin))

  return (
    <div className="min-h-screen h-screen w-full overflow-hidden flex flex-col" style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 25%, #E8EEF5 50%, #DDD6F3 75%, #C4B5E0 100%)' }}>
      {/* Notification Enable Banner */}
      {!notificationsEnabled && (
        <div className="flex-shrink-0 p-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center z-50">
          <button onClick={enableNotifications} className="flex items-center justify-center gap-2 w-full font-medium">
            <Bell size={18} />
            🔔 Tap to enable notifications
          </button>
        </div>
      )}
      
      {/* Mobile header */}
      <div className="lg:hidden neu-card mx-3 mt-3 p-3 flex items-center justify-between no-print flex-shrink-0">
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

      <div className="flex flex-1 overflow-hidden">
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
            <div className="hidden lg:flex items-center gap-3 mb-8 flex-shrink-0">
              <div className="logo-circle">
                <img src="/images/compass.png" alt="SATP" />
              </div>
              <div>
                <h1 className="text-lg font-bold gradient-text">SATP App</h1>
                <p className="text-xs text-gray-400">Tour Management</p>
              </div>
            </div>
            
            {/* Navigation */}
            <nav className="space-y-1 lg:space-y-2 flex-1 overflow-y-auto">
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
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Notification Status */}
            {notificationsEnabled && (
              <div className="mb-3 p-2 rounded-xl bg-green-50 text-green-700 text-xs text-center flex items-center justify-center gap-1 flex-shrink-0">
                <Volume2 size={14} /> Notifications ON
              </div>
            )}

            {/* User Info */}
            <div className="pt-4 border-t border-gray-100 flex-shrink-0">
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

        {/* Main content - fills remaining space */}
        <main className="flex-1 min-w-0 p-3 lg:p-6 lg:pl-4 overflow-hidden flex flex-col">
          <div className="w-full h-full flex flex-col">
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="spinner w-12 h-12 lg:w-16 lg:h-16"></div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto">
                {view === 'dashboard' && <Dashboard orders={orders} transactions={transactions} onRefresh={fetchData} />}
                {view === 'orders' && <OrdersTable orders={orders} />}
                {view === 'transactions' && <TransactionsTable transactions={transactions} />}
                {view === 'chat' && <ChatInbox />}
                {view === 'add-expense' && <ExpenseForm onSuccess={() => { fetchData(); setView('transactions') }} />}
                {view === 'users' && <UserManagement />}
              </div>
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
