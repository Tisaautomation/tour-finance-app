import { useState, useEffect, useRef, useCallback } from 'react'
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
import ProvidersTable from './components/ProvidersTable'
import PaymentsTable from './components/PaymentsTable'
import { 
  LayoutDashboard, ShoppingCart, Receipt, PlusCircle, Menu, X, LogOut, User, Users, MessageCircle, ShieldBan, Volume2, VolumeX, Truck, Banknote
} from 'lucide-react'

type View = 'dashboard' | 'orders' | 'transactions' | 'add-expense' | 'users' | 'chat' | 'blocker' | 'providers' | 'payments'

function AppContent() {
  const { user, logout, hasPermission } = useAuth()
  const [view, setView] = useState<View>('dashboard')
  const [orders, setOrders] = useState<ShopifyOrder[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [soundMuted, setSoundMuted] = useState(() => {
    try { return localStorage.getItem('satp_sound_muted') === 'true' } catch { return false }
  })
  const [unreadCount, setUnreadCount] = useState(0)
  
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioInitialized = useRef(false)
  const soundMutedRef = useRef(false)
  const viewRef = useRef<View>('dashboard')
  const knownMsgIds = useRef<Set<string>>(new Set())

  useEffect(() => { viewRef.current = view }, [view])
  useEffect(() => { 
    soundMutedRef.current = soundMuted
    try { localStorage.setItem('satp_sound_muted', String(soundMuted)) } catch {}
  }, [soundMuted])

  // Auto-initialize AudioContext on first user interaction
  const initAudio = useCallback(() => {
    if (audioInitialized.current) return
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtxRef.current = new AC()
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
      audioInitialized.current = true
      // Remove listeners after init
      document.removeEventListener('click', initAudio)
      document.removeEventListener('touchstart', initAudio)
      document.removeEventListener('keydown', initAudio)
    } catch (e) {
      console.log('AudioContext init error:', e)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('click', initAudio)
    document.addEventListener('touchstart', initAudio)
    document.addEventListener('keydown', initAudio)
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    // Register Service Worker for background notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    return () => {
      document.removeEventListener('click', initAudio)
      document.removeEventListener('touchstart', initAudio)
      document.removeEventListener('keydown', initAudio)
    }
  }, [initAudio])

  // Sound: new message notification (not in chat) — two-tone ding like WhatsApp
  const playSoundNotification = useCallback(() => {
    if (soundMutedRef.current || !audioCtxRef.current) return
    try {
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()
      const now = ctx.currentTime

      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.connect(gain1); gain1.connect(ctx.destination)
      osc1.frequency.value = 830
      osc1.type = 'sine'
      gain1.gain.setValueAtTime(0.5, now)
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      osc1.start(now); osc1.stop(now + 0.15)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2); gain2.connect(ctx.destination)
      osc2.frequency.value = 1100
      osc2.type = 'sine'
      gain2.gain.setValueAtTime(0.5, now + 0.12)
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
      osc2.start(now + 0.12); osc2.stop(now + 0.3)
    } catch (e) { console.log('Sound error:', e) }
  }, [])

  // Sound: message received while in chat — soft pop
  const playSoundReceived = useCallback(() => {
    if (soundMutedRef.current || !audioCtxRef.current) return
    try {
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(1200, now)
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.06)
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08)
      osc.start(now); osc.stop(now + 0.1)
    } catch (e) { console.log('Sound error:', e) }
  }, [])

  // Sound: message sent — quick ascending tick
  const playSoundSent = useCallback(() => {
    if (soundMutedRef.current || !audioCtxRef.current) return
    try {
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume()
      const now = ctx.currentTime

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(500, now)
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.07)
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09)
      osc.start(now); osc.stop(now + 0.1)
    } catch (e) { console.log('Sound error:', e) }
  }, [])

  const showNotification = useCallback((title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/images/compass.png', tag: 'chat-' + Date.now() })
    }
  }, [])

  // Realtime listener for new messages
  useEffect(() => {
    if (!user) return

    const loadExisting = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(500)
      if (data) data.forEach((m: { id: string }) => knownMsgIds.current.add(m.id))
    }
    loadExisting()

    const channel = supabase.channel('global_messages')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' }, 
        (payload: { new: { id: string; sender: string; content: string } }) => {
          const msg = payload.new
          if (knownMsgIds.current.has(msg.id)) return
          knownMsgIds.current.add(msg.id)

          if (msg.sender === 'customer') {
            const isInChat = viewRef.current === 'chat'
            if (isInChat) {
              playSoundReceived()
            } else {
              playSoundNotification()
              setUnreadCount(prev => prev + 1)
            }
            showNotification('💬 New Message', msg.content?.substring(0, 50) || 'New message')
          }
          
          // Staff/bot sent message sound when in chat
          if ((msg.sender === 'staff' || msg.sender === 'bot') && viewRef.current === 'chat') {
            playSoundSent()
          }
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, playSoundNotification, playSoundReceived, playSoundSent, showNotification])

  useEffect(() => {
    if (view === 'chat') setUnreadCount(0)
  }, [view])

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  async function fetchData() {
    setLoading(true)
    const { data: ordersData } = await supabase
      .from('shopify_orders').select('*')
      .order('received_at', { ascending: false }).limit(500)
    if (ordersData) setOrders(ordersData)

    const { data: txData } = await supabase
      .from('transactions').select('*')
      .order('date', { ascending: false }).limit(500)
    if (txData) setTransactions(txData)
    setLoading(false)
  }

  if (!user) return <Login />

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'canViewDashboard' },
    { id: 'chat', label: 'Chat Inbox', icon: MessageCircle, permission: 'canViewDashboard', badge: unreadCount },
    { id: 'blocker', label: 'Tour Blocker', icon: ShieldBan, permission: 'canManageBlocks' },
    { id: 'add-expense', label: 'Add Expense', icon: PlusCircle, permission: 'canAddExpense' },
    { id: 'orders', label: 'Manage Orders', icon: ShoppingCart, permission: 'canViewOrders' },
    { id: 'payments', label: 'Payments', icon: Banknote, permission: 'canManagePayments' },
    { id: 'transactions', label: 'Transactions', icon: Receipt, permission: 'canViewTransactions' },
    { id: 'providers', label: 'Providers', icon: Truck, permission: 'canManageProviders' },
    { id: 'users', label: 'Users', icon: Users, permission: 'canManageUsers' },
  ].filter(item => hasPermission(item.permission as keyof typeof ROLE_PERMISSIONS.admin))

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col" style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 25%, #E8EEF5 50%, #DDD6F3 75%, #C4B5E0 100%)' }}>
      {/* Top Bar — always visible */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-white/80 backdrop-blur-sm border-b border-gray-200/50 z-30">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            {sidebarOpen ? <X size={22} className="text-[#2D3748]" /> : <Menu size={22} className="text-[#2D3748]" />}
          </button>
          <div className="logo-circle-sm">
            <img src="/images/compass.png" alt="SATP" />
          </div>
          <span className="font-bold gradient-text text-sm hidden sm:inline">SATP App</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound toggle */}
          <button
            onClick={() => {
              initAudio()
              setSoundMuted(!soundMuted)
            }}
            className={`p-2 rounded-xl transition-colors ${soundMuted ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}
            title={soundMuted ? 'Sound off — tap to unmute' : 'Sound on — tap to mute'}
          >
            {soundMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {/* Sidebar — collapsible on ALL devices */}
        <aside className={`
          absolute inset-y-0 left-0 z-50
          w-72 transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          h-full p-3 no-print
        `}>
          <div className="neu-card h-full p-5 flex flex-col overflow-y-auto">
            {/* Logo header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="logo-circle">
                <img src="/images/compass.png" alt="SATP" />
              </div>
              <div>
                <h1 className="text-lg font-bold gradient-text">SATP App</h1>
                <p className="text-xs text-gray-400">Tour Management</p>
              </div>
            </div>
            
            {/* Navigation */}
            <nav className="space-y-1 flex-1">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setView(item.id as View); setSidebarOpen(false) }}
                  className={`sidebar-item w-full flex items-center gap-3 px-4 py-3 font-medium transition-all text-sm ${
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
              <div className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-gray-50/50">
                <div className="w-9 h-9 rounded-xl icon-primary flex items-center justify-center">
                  <User size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#2D3748] text-sm truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                </div>
              </div>
              <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors font-medium text-sm">
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Sidebar backdrop overlay */}
        {sidebarOpen && (
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main content — always full width */}
        <main className="flex-1 min-w-0 p-3 lg:p-4 w-full flex flex-col min-h-0">
          <div className="w-full flex-1 min-h-0 flex flex-col">
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
                {view === 'providers' && <ProvidersTable />}
                {view === 'payments' && <PaymentsTable />}
                {view === 'add-expense' && <ExpenseForm onSuccess={() => { fetchData(); setView('transactions') }} />}
                {view === 'users' && <UserManagement />}
              </>
            )}
          </div>
        </main>
      </div>
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
