import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { 
  Search, Send, ArrowLeft, User, 
  MessageCircle, RefreshCw, Smile,
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

function playNewChatSound() {
  try {
    if (typeof window === 'undefined') return
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const now = ctx.currentTime
    
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.frequency.value = 880
    osc1.type = 'sine'
    gain1.gain.setValueAtTime(0.5, now)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
    osc1.start(now)
    osc1.stop(now + 0.3)
    
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.frequency.value = 1100
    osc2.type = 'sine'
    gain2.gain.setValueAtTime(0.5, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.45)
  } catch (e) { console.log('Sound error') }
}

function playMessageSound() {
  try {
    if (typeof window === 'undefined') return
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const now = ctx.currentTime
    
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(1200, now)
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.08)
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
    osc.start(now)
    osc.stop(now + 0.12)
  } catch (e) { console.log('Sound error') }
}

const getReadConversations = (): Record<string, string> => {
  try {
    const stored = localStorage.getItem('readConversations')
    return stored ? JSON.parse(stored) : {}
  } catch { return {} }
}

const markConversationRead = (convId: string) => {
  try {
    const read = getReadConversations()
    read[convId] = new Date().toISOString()
    localStorage.setItem('readConversations', JSON.stringify(read))
  } catch { /* ignore */ }
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const knownConvIds = useRef<Set<string>>(new Set())
  const knownMsgIds = useRef<Set<string>>(new Set())
  const selectedConvRef = useRef<string | null>(null)

  useEffect(() => {
    selectedConvRef.current = selectedConversation?.id || null
  }, [selectedConversation])

  useEffect(() => {
    loadConversations()
    const channel = supabase.channel('conversations_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, 
        (payload: { new: Conversation }) => {
          const conv = payload.new
          if (!knownConvIds.current.has(conv.id)) {
            playNewChatSound()
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
              playMessageSound()
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
      setUnreadConvs(prev => {
        const next = new Set(prev)
        next.delete(selectedConversation.id)
        return next
      })
      
      const channel = supabase.channel(`messages_${selectedConversation.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConversation.id}` }, 
          (payload: { new: Message }) => { 
            const msg = payload.new
            if (!knownMsgIds.current.has(msg.id)) {
              if (msg.sender === 'customer') playMessageSound()
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
        
        const lastRead = readTimes[conv.id]
        if (msgData && msgData[0] && msgData[0].sender === 'customer') {
          if (!lastRead || new Date(msgData[0].created_at) > new Date(lastRead)) {
            newUnread.add(conv.id)
          }
        }
        return { ...conv, last_message: msgData?.[0]?.content || '' }
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
    await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender: 'staff', content: newMessage.trim() })
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString(), status: 'human_active' }).eq('id', selectedConversation.id)
    setNewMessage('')
    setSending(false)
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
    setBlinkingId(null)
    markConversationRead(conv.id)
    setUnreadConvs(prev => { const next = new Set(prev); next.delete(conv.id); return next })
  }

  return (
    <div className="h-full flex rounded-3xl overflow-hidden shadow-xl" style={{ background: 'linear-gradient(145deg, #e6e9ef, #f5f7fa)' }}>
      <div className={`${showMobileChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 border-r border-gray-200`} style={{ background: 'linear-gradient(180deg, #f0f2f5 0%, #e4e7eb 100%)' }}>
        <div className="p-4 space-y-3">
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
        <div className="flex-1 overflow-y-auto px-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-32"><RefreshCw className="animate-spin text-cyan-500" size={24} /></div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No conversations</div>
          ) : (
            filteredConversations.map((conv) => {
              const isUnread = unreadConvs.has(conv.id)
              return (
                <div key={conv.id} onClick={() => handleSelectConversation(conv)} className={`p-4 rounded-2xl cursor-pointer transition-all ${selectedConversation?.id === conv.id ? 'scale-[1.02]' : 'hover:scale-[1.01]'} ${blinkingId === conv.id ? 'animate-pulse ring-2 ring-cyan-400' : ''}`} style={{ background: selectedConversation?.id === conv.id ? 'linear-gradient(145deg, #0CC0DF, #38bdf8)' : '#fff', boxShadow: selectedConversation?.id === conv.id ? '5px 5px 15px rgba(12, 192, 223, 0.3), -5px -5px 15px #ffffff' : '5px 5px 10px #d1d5db, -5px -5px 10px #ffffff' }}>
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedConversation?.id === conv.id ? 'bg-white/20' : 'bg-gradient-to-br from-cyan-400 to-purple-500'}`}>
                        <MessageCircle className="text-white" size={20} />
                      </div>
                      <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(conv.status)}`} />
                      {isUnread && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-pulse"><span className="w-2 h-2 bg-white rounded-full"></span></span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className={`font-semibold truncate ${selectedConversation?.id === conv.id ? 'text-white' : isUnread ? 'text-gray-900 font-bold' : 'text-gray-800'}`}>{conv.customer_name || 'Web Visitor'}</span>
                        <span className={`text-xs ${selectedConversation?.id === conv.id ? 'text-white/70' : 'text-gray-400'}`}>{conv.last_message_at ? formatTime(conv.last_message_at) : ''}</span>
                      </div>
                      <p className={`text-sm truncate mt-1 ${selectedConversation?.id === conv.id ? 'text-white/80' : isUnread ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>{conv.last_message || 'No messages yet'}</p>
                      <div className="flex gap-2 mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${conv.status === 'active' ? 'bg-green-100 text-green-700' : conv.status === 'human_active' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{conv.status === 'active' ? 'Bot' : conv.status === 'human_active' ? '👤 Take' : conv.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
      <div className={`${showMobileChat ? 'flex' : 'hidden md:flex'} flex-col flex-1`} style={{ background: 'linear-gradient(180deg, #e8f4f8 0%, #f0e6f6 100%)' }}>
        {selectedConversation ? (
          <>
            <div className="p-4 flex items-center gap-4 border-b border-white/50" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)' }}>
              <button onClick={() => setShowMobileChat(false)} className="md:hidden p-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center"><User className="text-white" size={18} /></div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">{selectedConversation.customer_name || 'Web Visitor'}</h3>
                <p className="text-xs text-gray-500">{selectedConversation.customer_phone || selectedConversation.platform}</p>
              </div>
              <div className="flex gap-2">
                {selectedConversation.status !== 'human_active' ? (
                  <button onClick={takeOverConversation} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'linear-gradient(135deg, #8b5cf6, #a855f7)', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)' }}>👤 Take Over</button>
                ) : (
                  <button onClick={giveToBot} className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'linear-gradient(135deg, #0CC0DF, #38bdf8)', boxShadow: '0 4px 15px rgba(12, 192, 223, 0.3)' }}>🤖 Give to Bot</button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <span className="text-xs text-gray-400 mt-1 px-1">{formatTime(msg.created_at)}</span>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-white/50" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)' }}>
              <div className="flex gap-3">
                <button className="p-3 rounded-2xl" style={{ background: '#f0f2f5', boxShadow: '3px 3px 6px #d1d5db, -3px -3px 6px #ffffff' }}><Smile className="text-gray-400" size={20} /></button>
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="Type a message..." className="flex-1 px-5 py-3 rounded-2xl border-none outline-none" style={{ background: '#fff', boxShadow: 'inset 3px 3px 6px #d1d5db, inset -3px -3px 6px #ffffff' }} />
                <button onClick={sendMessage} disabled={sending || !newMessage.trim()} className="p-3 rounded-2xl text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #0CC0DF, #7c3aed)', boxShadow: '0 4px 15px rgba(12, 192, 223, 0.3)' }}><Send size={20} /></button>
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
