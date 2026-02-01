import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { 
  Search, Send, ArrowLeft, User, Bot, 
  MessageCircle, CheckCheck, RefreshCw, Smile,
  AlertCircle, UserCheck, Cpu
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadConversations()
    const channel = supabase.channel('conversations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadConversations())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id)
      const channel = supabase.channel(`messages_${selectedConversation.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConversation.id}` }, 
          (payload) => { setMessages(prev => [...prev, payload.new as Message]); scrollToBottom() })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
  }, [selectedConversation])

  useEffect(() => { scrollToBottom() }, [messages])

  async function loadConversations() {
    setLoading(true)
    const { data } = await supabase.from('conversations').select('*').order('last_message_at', { ascending: false, nullsFirst: false }).limit(100)
    if (data) {
      const withMsg = await Promise.all(data.map(async (conv) => {
        const { data: msgData } = await supabase.from('messages').select('content').eq('conversation_id', conv.id).order('created_at', { ascending: false }).limit(1)
        return { ...conv, last_message: msgData?.[0]?.content || 'No messages yet' }
      }))
      setConversations(withMsg)
    }
    setLoading(false)
  }

  async function loadMessages(conversationId: string) {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation || sending) return
    setSending(true)
    const content = newMessage.trim()
    setNewMessage('')
    await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender: 'staff', content })
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString(), status: 'human_active' }).eq('id', selectedConversation.id)
    try { await fetch('https://timelessconcept.app.n8n.cloud/webhook/samui-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: selectedConversation.id, message: content, sender: 'staff', staffName: user?.name, customerPhone: selectedConversation.customer_phone, platform: selectedConversation.platform }) }) } catch {}
    setSending(false)
  }

  async function takeOver(convId: string) {
    await supabase.from('conversations').update({ status: 'human_active', assigned_staff: user?.id }).eq('id', convId)
    loadConversations()
    if (selectedConversation?.id === convId) setSelectedConversation(prev => prev ? { ...prev, status: 'human_active' } : null)
  }

  async function giveToBot(convId: string) {
    await supabase.from('conversations').update({ status: 'active', assigned_staff: null }).eq('id', convId)
    loadConversations()
    if (selectedConversation?.id === convId) setSelectedConversation(prev => prev ? { ...prev, status: 'active' } : null)
  }

  async function closeConversation(convId: string) {
    await supabase.from('conversations').update({ status: 'closed' }).eq('id', convId)
    loadConversations()
    if (selectedConversation?.id === convId) setSelectedConversation(prev => prev ? { ...prev, status: 'closed' } : null)
  }

  async function reopenConversation(convId: string) {
    await supabase.from('conversations').update({ status: 'active' }).eq('id', convId)
    loadConversations()
    if (selectedConversation?.id === convId) setSelectedConversation(prev => prev ? { ...prev, status: 'active' } : null)
  }

  function scrollToBottom() { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
    if (days === 0) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    if (days === 1) return 'Yesterday'
    if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' })
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function getPlatformIcon(p: string) { return p === 'line' ? '🟢' : p === 'whatsapp' ? '💬' : p === 'web' ? '🌐' : '📧' }
  function getStatusColor(s: string) { return s === 'active' ? 'bg-green-500' : s === 'needs_human' ? 'bg-red-500' : s === 'human_active' ? 'bg-blue-500' : 'bg-gray-400' }

  const filteredConversations = useMemo(() => conversations.filter(c => {
    const matchSearch = c.customer_name?.toLowerCase().includes(search.toLowerCase()) || c.customer_phone?.includes(search) || c.customer_email?.toLowerCase().includes(search.toLowerCase())
    return matchSearch && (!statusFilter || c.status === statusFilter)
  }), [conversations, search, statusFilter])

  const needsAttentionCount = conversations.filter(c => c.status === 'needs_human').length

  const filters = [
    { value: '', label: 'All', icon: '📋' },
    { value: 'needs_human', label: 'Help', icon: '🔴' },
    { value: 'active', label: 'Bot', icon: '🤖' },
    { value: 'human_active', label: 'Agent', icon: '👤' },
    { value: 'closed', label: 'Done', icon: '✅' }
  ]

  return (
    <div className="fade-in h-[calc(100vh-120px)] lg:h-[calc(100vh-64px)]">
      <div className="neu-card h-full overflow-hidden flex rounded-2xl">
        {/* Left Panel - Conversations List */}
        <div className={`w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 border-r border-gray-200/50 flex flex-col bg-gradient-to-br from-white to-[#F5F3FA] ${showMobileChat ? 'hidden lg:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-4 lg:p-5 border-b border-gray-200/50">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl lg:text-2xl font-bold gradient-text">Chat Inbox</h1>
              <div className="flex items-center gap-2">
                {needsAttentionCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-red-500 to-red-400 text-white rounded-lg text-xs font-bold shadow-lg">
                    <AlertCircle size={12} /> {needsAttentionCount}
                  </span>
                )}
                <button onClick={loadConversations} className="neu-flat p-2.5 rounded-xl hover:bg-white/80 transition-all">
                  <RefreshCw size={18} className="text-gray-500" />
                </button>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                className="neu-input w-full pl-10 pr-4 py-3 text-sm rounded-xl" />
            </div>

            {/* Filter Buttons - Wrap on small screens */}
            <div className="flex flex-wrap gap-2">
              {filters.map(f => (
                <button key={f.value} onClick={() => setStatusFilter(f.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    statusFilter === f.value ? 'neu-btn text-white shadow-lg' : 'neu-flat text-gray-600 hover:bg-white/80'
                  }`}>
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40"><div className="spinner w-10 h-10"></div></div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#9370DB]/20 to-[#00CED1]/20 flex items-center justify-center mb-3 shadow-lg">
                  <MessageCircle size={28} className="text-[#9370DB]" />
                </div>
                <p className="text-sm font-medium">No conversations found</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <div key={conv.id} onClick={() => { setSelectedConversation(conv); setShowMobileChat(true) }}
                  className={`p-4 border-b border-gray-100/50 cursor-pointer transition-all hover:bg-white/70 ${
                    selectedConversation?.id === conv.id ? 'bg-gradient-to-r from-[#9370DB]/15 to-[#00CED1]/10 border-l-4 border-l-[#9370DB]' : ''
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9370DB]/30 to-[#00CED1]/30 flex items-center justify-center shadow-md">
                        <span className="text-lg">{getPlatformIcon(conv.platform)}</span>
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${getStatusColor(conv.status)}`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-[#2D3748] text-sm truncate">{conv.customer_name || conv.customer_phone || 'Unknown'}</h3>
                        <span className="text-xs text-gray-400 ml-2">{conv.last_message_at ? formatTime(conv.last_message_at) : ''}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mb-2">{conv.last_message}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                          conv.status === 'needs_human' ? 'bg-red-100 text-red-600' :
                          conv.status === 'active' ? 'bg-green-100 text-green-600' :
                          conv.status === 'human_active' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {conv.status === 'needs_human' ? 'Help' : conv.status === 'active' ? 'Bot' : conv.status === 'human_active' ? 'Agent' : 'Done'}
                        </span>
                        {conv.status !== 'closed' && (
                          <>
                            {(conv.status === 'active' || conv.status === 'needs_human') && (
                              <button onClick={(e) => { e.stopPropagation(); takeOver(conv.id) }}
                                className="flex items-center gap-1 px-2 py-0.5 bg-blue-500 text-white text-xs font-semibold rounded-md hover:bg-blue-600">
                                <UserCheck size={10} /> Take
                              </button>
                            )}
                            {conv.status === 'human_active' && (
                              <button onClick={(e) => { e.stopPropagation(); giveToBot(conv.id) }}
                                className="flex items-center gap-1 px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded-md hover:bg-green-600">
                                <Cpu size={10} /> Bot
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Chat */}
        <div className={`flex-1 flex flex-col bg-gradient-to-br from-white/80 to-[#EDE9F5]/80 ${!showMobileChat ? 'hidden lg:flex' : 'flex'}`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200/50 bg-white/80 backdrop-blur-sm flex items-center gap-3">
                <button onClick={() => setShowMobileChat(false)} className="lg:hidden neu-flat p-2 rounded-xl">
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9370DB]/30 to-[#00CED1]/30 flex items-center justify-center shadow-md">
                  <span className="text-lg">{getPlatformIcon(selectedConversation.platform)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-[#2D3748] text-sm truncate">{selectedConversation.customer_name || selectedConversation.customer_phone || 'Unknown'}</h2>
                  <p className="text-xs text-gray-400 truncate">{selectedConversation.customer_phone} {selectedConversation.customer_email && `• ${selectedConversation.customer_email}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedConversation.status !== 'closed' ? (
                    <>
                      {(selectedConversation.status === 'active' || selectedConversation.status === 'needs_human') && (
                        <button onClick={() => takeOver(selectedConversation.id)} className="neu-btn px-3 py-2 text-xs rounded-xl flex items-center gap-1">
                          <UserCheck size={14} /> Take Over
                        </button>
                      )}
                      {selectedConversation.status === 'human_active' && (
                        <button onClick={() => giveToBot(selectedConversation.id)} className="neu-btn-accent px-3 py-2 text-xs rounded-xl flex items-center gap-1">
                          <Cpu size={14} /> Give to Bot
                        </button>
                      )}
                      <button onClick={() => closeConversation(selectedConversation.id)} className="neu-flat px-3 py-2 text-xs rounded-xl text-gray-600 font-semibold">Close</button>
                    </>
                  ) : (
                    <button onClick={() => reopenConversation(selectedConversation.id)} className="neu-btn-accent px-3 py-2 text-xs rounded-xl">Reopen</button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(237,233,245,0.6) 100%)' }}>
                {messages.map((msg, idx) => {
                  const isStaff = msg.sender === 'staff', isBot = msg.sender === 'bot', isCustomer = msg.sender === 'customer'
                  const showDate = idx === 0 || new Date(messages[idx-1].created_at).toDateString() !== new Date(msg.created_at).toDateString()
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-3">
                          <span className="px-3 py-1 neu-flat rounded-full text-xs text-gray-500 font-medium">
                            {new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                        <div className="max-w-[80%]">
                          <div className={`px-3 py-2 rounded-2xl shadow-md ${
                            isCustomer ? 'bg-white border-l-4 border-[#7c3aed] rounded-tl-sm' : isBot ? 'bg-gradient-to-br from-[#00CED1]/25 to-[#00CED1]/15 rounded-tr-sm' : 'bg-gradient-to-br from-[#9370DB] to-[#7B68EE] text-white rounded-tr-sm'
                          }`}>
                            <div className={`flex items-center gap-1 text-xs mb-1 font-semibold ${isCustomer ? 'text-[#7c3aed]' : isStaff ? 'text-white/80' : 'text-[#00CED1]'}`}>
                              {isBot ? <Bot size={10} /> : isCustomer ? <MessageCircle size={10} /> : <User size={10} />}
                              <span>{isBot ? 'Niran' : isCustomer ? (selectedConversation?.customer_name || 'Customer') : (user?.name || 'Staff')}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <div className={`flex items-center justify-end gap-1 mt-1 ${isStaff ? 'text-white/60' : 'text-gray-400'}`}>
                              <span className="text-xs">{new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                              {isStaff && <CheckCheck size={12} />}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {selectedConversation.status !== 'closed' && (
                <div className="p-4 border-t border-gray-200/50 bg-white/90">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                      <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
                        onKeyPress={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                        placeholder="Type a message..." className="neu-input w-full px-4 py-3 pr-10 text-sm resize-none rounded-xl" rows={1} style={{ minHeight: '48px', maxHeight: '100px' }} />
                      <button className="absolute right-3 bottom-3 text-gray-400 hover:text-[#9370DB]"><Smile size={20} /></button>
                    </div>
                    <button onClick={sendMessage} disabled={!newMessage.trim() || sending} className="neu-btn p-3 rounded-xl disabled:opacity-50">
                      {sending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={18} className="text-white" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#9370DB]/20 to-[#00CED1]/20 flex items-center justify-center mb-4 shadow-xl">
                <MessageCircle size={40} className="text-[#9370DB]" />
              </div>
              <h3 className="text-lg font-bold text-[#2D3748] mb-1">Select a Conversation</h3>
              <p className="text-sm">Choose a chat from the list</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
