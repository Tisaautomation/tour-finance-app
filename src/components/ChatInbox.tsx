import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { 
  Search, Send, ArrowLeft, User, 
  MessageCircle, RefreshCw, Smile, X,
  UserCheck, Cpu
} from 'lucide-react'

interface Conversation {
  id: string
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  platform: 'line' | 'whatsapp' | 'web' | 'email'
  language: string
  status: 'active' | 'needs_human' | 'human_active' | 'closed'
  booking_id: string | null
  escalation_reason: string | null
  assigned_staff: string | null
  last_message_at: string | null
  created_at: string
  updated_at: string
  last_message?: string
  unread_count?: number
}

interface Message {
  id: string
  conversation_id: string
  sender: 'customer' | 'bot' | 'staff'
  content: string
  ai_model: string | null
  ai_confidence: number | null
  created_at: string
}

// Emoji categories
const EMOJI_DATA: Record<string, string[]> = {
  '😊 Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐'],
  '👋 Gestures': ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪','🦾'],
  '❤️ Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🫶'],
  '🌴 Travel': ['🌴','🏖️','🌊','🚤','⛵','🛥️','🚢','✈️','🗺️','🧳','🌅','🌄','🏝️','🐠','🐬','🐋','🦈','🐙','🐚','🪸','🏄','🤿','🎣','🌺','🌸','☀️','🌤️','⛅','🌈'],
  '🎉 Celebrate': ['🎉','🎊','🎈','🎁','🎀','🎂','🍰','🥂','🍾','🎆','🎇','✨','🌟','⭐','💫','🔥','💥','🎵','🎶','🎤','📸','📷','🎬','🏆','🥇','🏅','💰','💵'],
  '👤 People': ['👶','👧','🧒','👦','👩','🧑','👨','👩‍🦱','🧑‍🦱','👨‍🦱','👩‍🦰','🧑‍🦰','👨‍🦰','👱‍♀️','👱','👱‍♂️','👩‍🦳','🧑‍🦳','👨‍🦳','👩‍🦲','🧑‍🦲','👨‍🦲','🧔','👵','🧓','👴','👲','👳‍♀️','👳','👳‍♂️','🧕','🤰','🫄'],
  '✅ Symbols': ['✅','❌','⭕','❗','❓','💯','🔔','🔕','📌','📍','🏷️','💬','💭','🗯️','⏰','⏳','📅','📆','🔑','🔒','🔓','📩','📨','📧','💻','📱','☎️','🔗','⚡','🆗','🆕','🆙','🔜','🔚']
}

// Sound helpers — respect global mute in localStorage
function isMuted(): boolean {
  try { return localStorage.getItem('satp_sound_muted') === 'true' } catch { return false }
}

function playSound(type: 'notification' | 'received' | 'sent') {
  if (isMuted()) return
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const now = ctx.currentTime

    if (type === 'notification') {
      // Two-tone ding — new message when not viewing
      const o1 = ctx.createOscillator(), g1 = ctx.createGain()
      o1.connect(g1); g1.connect(ctx.destination)
      o1.frequency.value = 830; o1.type = 'sine'
      g1.gain.setValueAtTime(0.5, now); g1.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      o1.start(now); o1.stop(now + 0.15)
      const o2 = ctx.createOscillator(), g2 = ctx.createGain()
      o2.connect(g2); g2.connect(ctx.destination)
      o2.frequency.value = 1100; o2.type = 'sine'
      g2.gain.setValueAtTime(0.5, now + 0.12); g2.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
      o2.start(now + 0.12); o2.stop(now + 0.3)
    } else if (type === 'received') {
      // Soft pop
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.setValueAtTime(1200, now); o.frequency.exponentialRampToValueAtTime(600, now + 0.06)
      o.type = 'sine'; g.gain.setValueAtTime(0.25, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.08)
      o.start(now); o.stop(now + 0.1)
    } else {
      // Sent tick
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.setValueAtTime(500, now); o.frequency.exponentialRampToValueAtTime(1400, now + 0.07)
      o.type = 'sine'; g.gain.setValueAtTime(0.2, now); g.gain.exponentialRampToValueAtTime(0.01, now + 0.09)
      o.start(now); o.stop(now + 0.1)
    }
  } catch { /* ignore */ }
}

const getReadConversations = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem('readConversations') || '{}') } catch { return {} }
}
const markConversationRead = (convId: string) => {
  try {
    const r = getReadConversations(); r[convId] = new Date().toISOString()
    localStorage.setItem('readConversations', JSON.stringify(r))
  } catch { /* */ }
}

// Emoji Picker Component
function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [category, setCategory] = useState(Object.keys(EMOJI_DATA)[0])
  const categories = Object.keys(EMOJI_DATA)

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden" style={{ maxHeight: '320px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} className={`px-2 py-1 rounded-lg text-xs whitespace-nowrap transition-colors ${category === cat ? 'bg-purple-500 text-white' : 'hover:bg-gray-200 text-gray-600'}`}>
              {cat.split(' ')[0]}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 ml-2 flex-shrink-0"><X size={16} /></button>
      </div>
      {/* Grid */}
      <div className="p-2 overflow-y-auto" style={{ maxHeight: '260px' }}>
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_DATA[category].map((emoji, i) => (
            <button key={i} onClick={() => onSelect(emoji)} className="w-9 h-9 flex items-center justify-center text-xl hover:bg-gray-100 rounded-lg transition-colors">
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ChatInbox() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [blinkingId, setBlinkingId] = useState<string | null>(null)
  const [unreadConvs, setUnreadConvs] = useState<Set<string>>(new Set())
  const [showEmoji, setShowEmoji] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const knownConvIds = useRef<Set<string>>(new Set())
  const knownMsgIds = useRef<Set<string>>(new Set())
  const selectedConvRef = useRef<string | null>(null)

  useEffect(() => { selectedConvRef.current = selectedConversation?.id || null }, [selectedConversation])

  const insertEmoji = useCallback((emoji: string) => {
    setNewMessage(prev => prev + emoji)
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    loadConversations()
    const channel = supabase.channel('conversations_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, 
        (payload: { new: Conversation }) => {
          const conv = payload.new
          if (!knownConvIds.current.has(conv.id)) {
            playSound('notification')
            setBlinkingId(conv.id)
            setUnreadConvs(prev => new Set([...prev, conv.id]))
            setTimeout(() => setBlinkingId(null), 5000)
            knownConvIds.current.add(conv.id)
          }
          loadConversations()
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => loadConversations())
      .subscribe()
    
    const msgChannel = supabase.channel('global_msg_unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: { new: Message }) => {
          const msg = payload.new
          if (msg.sender === 'customer') {
            if (selectedConvRef.current !== msg.conversation_id) {
              setUnreadConvs(prev => new Set([...prev, msg.conversation_id]))
              playSound('notification')
            } else {
              playSound('received')
            }
          }
        })
      .subscribe()
    
    return () => { 
      supabase.removeChannel(channel)
      supabase.removeChannel(msgChannel)
    }
  }, [])

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id)
      markConversationRead(selectedConversation.id)
      setUnreadConvs(prev => { const next = new Set(prev); next.delete(selectedConversation.id); return next })
      
      const channel = supabase.channel(`messages_${selectedConversation.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConversation.id}` }, 
          (payload: { new: Message }) => { 
            const msg = payload.new
            if (!knownMsgIds.current.has(msg.id)) {
              if (msg.sender === 'customer') playSound('received')
              knownMsgIds.current.add(msg.id)
            }
            setMessages(prev => [...prev, msg])
            scrollToBottom() 
          })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
  }, [selectedConversation])

  useEffect(() => { scrollToBottom() }, [messages])

  async function loadConversations() {
    setLoading(true)
    const { data } = await supabase.from('conversations').select('*').order('last_message_at', { ascending: false, nullsFirst: false }).limit(100)
    if (data) {
      data.forEach((c: Conversation) => knownConvIds.current.add(c.id))
      const readTimes = getReadConversations()
      const newUnread = new Set<string>()
      
      const withMsg = await Promise.all(data.map(async (conv: Conversation) => {
        const { data: msgData } = await supabase.from('messages').select('content, sender, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1)
        
        // Count unread messages since last read
        const lastRead = readTimes[conv.id]
        let unreadCount = 0
        if (lastRead) {
          const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conv.id).eq('sender', 'customer').gt('created_at', lastRead)
          unreadCount = count || 0
        } else if (msgData?.[0]?.sender === 'customer') {
          unreadCount = 1 // At least 1 if never read
        }
        
        if (unreadCount > 0) newUnread.add(conv.id)
        return { ...conv, last_message: msgData?.[0]?.content || '', unread_count: unreadCount }
      }))
      
      setUnreadConvs(newUnread)
      setConversations(withMsg)
    }
    setLoading(false)
  }

  async function loadMessages(conversationId: string) {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true })
    if (data) {
      data.forEach((m: Message) => knownMsgIds.current.add(m.id))
      setMessages(data)
    }
  }

  function scrollToBottom() { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation || sending) return
    setSending(true)
    setShowEmoji(false)
    await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender: 'staff', content: newMessage.trim() })
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString(), status: 'human_active' }).eq('id', selectedConversation.id)
    playSound('sent')
    setNewMessage('')
    setSending(false)
    inputRef.current?.focus()
  }

  async function takeOverConversation() {
    if (!selectedConversation) return
    await supabase.from('conversations').update({ status: 'human_active', assigned_staff: user?.email }).eq('id', selectedConversation.id)
    setSelectedConversation(prev => prev ? {...prev, status: 'human_active'} : null)
    loadConversations()
  }

  async function giveToBot() {
    if (!selectedConversation) return
    await supabase.from('conversations').update({ status: 'active', assigned_staff: null }).eq('id', selectedConversation.id)
    setSelectedConversation(prev => prev ? {...prev, status: 'active'} : null)
    loadConversations()
  }

  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      const matchesSearch = !search || conv.customer_name?.toLowerCase().includes(search.toLowerCase()) || conv.customer_phone?.includes(search) || conv.last_message?.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = !statusFilter || conv.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [conversations, search, statusFilter])

  const totalUnread = unreadConvs.size

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'needs_human': return 'bg-yellow-500'
      case 'human_active': return 'bg-purple-500'
      default: return 'bg-gray-400'
    }
  }

  const getSenderInfo = (sender: string) => {
    switch (sender) {
      case 'customer': return { bg: 'bg-gradient-to-r from-purple-100 to-purple-50', border: 'border-l-4 border-purple-500', align: 'self-start', icon: User, label: selectedConversation?.customer_name || 'Customer' }
      case 'bot': return { bg: 'bg-gradient-to-r from-cyan-400 to-teal-400', border: '', align: 'self-end', icon: Cpu, label: 'Niran' }
      case 'staff': return { bg: 'bg-gradient-to-r from-fuchsia-500 to-pink-500', border: '', align: 'self-end', icon: UserCheck, label: user?.email?.split('@')[0] || 'Staff' }
      default: return { bg: 'bg-gray-100', border: '', align: 'self-start', icon: User, label: 'Unknown' }
    }
  }

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv)
    setShowMobileChat(true)
    setShowEmoji(false)
    setBlinkingId(null)
    markConversationRead(conv.id)
    setUnreadConvs(prev => { const next = new Set(prev); next.delete(conv.id); return next })
  }

  return (
    <div className="h-[calc(100vh-60px)] flex rounded-3xl mx-auto w-full overflow-hidden shadow-xl" style={{ background: 'linear-gradient(145deg, #e6e9ef, #f5f7fa)' }}>
      {/* Conversations List */}
      <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 border-r border-gray-200`} style={{ background: 'linear-gradient(180deg, #f0f2f5 0%, #e4e7eb 100%)' }}>
        <div className="p-4 space-y-3">
          {/* Header with unread badge */}
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-700 text-lg flex items-center gap-2">
              💬 Chats
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">{totalUnread}</span>
              )}
            </h2>
            <button onClick={() => loadConversations()} className="p-2 rounded-xl hover:bg-white/50 transition-colors"><RefreshCw size={18} className="text-gray-500" /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search conversations..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-2xl border-none" style={{ background: '#fff', boxShadow: 'inset 3px 3px 6px #d1d5db, inset -3px -3px 6px #ffffff' }} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full py-2 px-4 rounded-xl border-none text-sm" style={{ background: '#fff', boxShadow: '3px 3px 6px #d1d5db, -3px -3px 6px #ffffff' }}>
            <option value="">All Status</option>
            <option value="active">🤖 Bot Active</option>
            <option value="needs_human">⚠️ Needs Human</option>
            <option value="human_active">👤 Human Active</option>
            <option value="closed">✓ Closed</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-3">
          {loading ? (
            <div className="flex items-center justify-center h-32"><RefreshCw className="animate-spin text-cyan-500" size={24} /></div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No conversations</div>
          ) : (
            filteredConversations.map((conv) => {
              const isUnread = unreadConvs.has(conv.id)
              const unreadN = conv.unread_count || 0
              const isSelected = selectedConversation?.id === conv.id
              return (
                <div key={conv.id} onClick={() => handleSelectConversation(conv)} className={`p-4 rounded-2xl cursor-pointer transition-all ${isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'} ${blinkingId === conv.id ? 'animate-pulse ring-2 ring-cyan-400' : ''}`} style={{ background: isSelected ? 'linear-gradient(145deg, #0CC0DF, #38bdf8)' : '#fff', boxShadow: isSelected ? '5px 5px 15px rgba(12, 192, 223, 0.3), -5px -5px 15px #ffffff' : '5px 5px 10px #d1d5db, -5px -5px 10px #ffffff' }}>
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSelected ? 'bg-white/20' : 'bg-gradient-to-br from-cyan-400 to-purple-500'}`}>
                        <MessageCircle className="text-white" size={20} />
                      </div>
                      <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(conv.status)}`} />
                      {/* Unread badge with count */}
                      {isUnread && unreadN > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse px-1">
                          <span className="text-white text-[10px] font-bold">{unreadN > 9 ? '9+' : unreadN}</span>
                        </span>
                      )}
                      {isUnread && unreadN === 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className={`font-semibold truncate ${isSelected ? 'text-white' : isUnread ? 'text-gray-900 font-bold' : 'text-gray-800'}`}>{conv.customer_name || 'Web Visitor'}</span>
                        <span className={`text-xs flex-shrink-0 ml-2 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>{conv.last_message_at ? formatTime(conv.last_message_at) : ''}</span>
                      </div>
                      <p className={`text-sm truncate mt-1 ${isSelected ? 'text-white/80' : isUnread ? 'text-gray-700 font-semibold' : 'text-gray-500'}`}>{conv.last_message || 'No messages yet'}</p>
                      <div className="flex gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${conv.status === 'active' ? 'bg-green-100 text-green-700' : conv.status === 'human_active' ? 'bg-purple-100 text-purple-700' : conv.status === 'needs_human' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                          {conv.status === 'active' ? '🤖 Bot' : conv.status === 'human_active' ? '👤 Agent' : conv.status === 'needs_human' ? '⚠️ Help' : '✓ Closed'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Chat Panel */}
      <div className={`${showMobileChat ? 'flex' : 'hidden md:flex'} flex-col flex-1`} style={{ background: 'linear-gradient(180deg, #e8f4f8 0%, #f0e6f6 100%)' }}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 flex items-center gap-4 border-b border-white/50 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)' }}>
              <button onClick={() => setShowMobileChat(false)} className="md:hidden p-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center"><User className="text-white" size={18} /></div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 truncate">{selectedConversation.customer_name || 'Web Visitor'}</h3>
                <p className="text-xs text-gray-500">{selectedConversation.customer_phone || selectedConversation.platform}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {selectedConversation.status !== 'human_active' ? (
                  <button onClick={takeOverConversation} className="px-3 py-2 rounded-xl text-white text-xs sm:text-sm font-medium" style={{ background: 'linear-gradient(135deg, #8b5cf6, #a855f7)', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)' }}>👤 Take Over</button>
                ) : (
                  <button onClick={giveToBot} className="px-3 py-2 rounded-xl text-white text-xs sm:text-sm font-medium" style={{ background: 'linear-gradient(135deg, #0CC0DF, #38bdf8)', boxShadow: '0 4px 15px rgba(12, 192, 223, 0.3)' }}>🤖 Give to Bot</button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {messages.map((msg) => {
                const info = getSenderInfo(msg.sender)
                const Icon = info.icon
                return (
                  <div key={msg.id} className={`flex flex-col ${info.align} max-w-[80%]`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={14} className={msg.sender === 'customer' ? 'text-purple-600' : 'text-cyan-600'} />
                      <span className={`text-xs font-medium ${msg.sender === 'customer' ? 'text-purple-600' : 'text-cyan-600'}`}>{info.label}</span>
                    </div>
                    <div className={`p-4 rounded-2xl ${info.bg} ${info.border} ${msg.sender !== 'customer' ? 'text-white' : 'text-gray-800'}`} style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.08)' }}>
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                    <span className="text-xs text-gray-400 mt-1 px-1">{formatTime(msg.created_at)}</span>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area with Emoji Picker */}
            <div className="p-4 border-t border-white/50 flex-shrink-0 relative" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)' }}>
              {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}
              <div className="flex gap-2 sm:gap-3 items-center">
                <button onClick={() => setShowEmoji(!showEmoji)} className={`p-3 rounded-2xl flex-shrink-0 transition-colors ${showEmoji ? 'bg-purple-100' : ''}`} style={showEmoji ? {} : { background: '#f0f2f5', boxShadow: '3px 3px 6px #d1d5db, -3px -3px 6px #ffffff' }}>
                  {showEmoji ? <X className="text-purple-500" size={20} /> : <Smile className="text-gray-400" size={20} />}
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  onFocus={() => setShowEmoji(false)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 sm:px-5 py-3 rounded-2xl border-none outline-none min-w-0"
                  style={{ background: '#fff', boxShadow: 'inset 3px 3px 6px #d1d5db, inset -3px -3px 6px #ffffff' }}
                />
                <button onClick={sendMessage} disabled={sending || !newMessage.trim()} className="p-3 rounded-2xl text-white disabled:opacity-50 flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0CC0DF, #7c3aed)', boxShadow: '0 4px 15px rgba(12, 192, 223, 0.3)' }}>
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(145deg, #f0f2f5, #e4e7eb)', boxShadow: '10px 10px 20px #d1d5db, -10px -10px 20px #ffffff' }}><MessageCircle className="text-cyan-500" size={32} /></div>
              <h3 className="text-lg font-semibold text-gray-600">Select a conversation</h3>
              <p className="text-sm text-gray-400">Choose from the list to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
