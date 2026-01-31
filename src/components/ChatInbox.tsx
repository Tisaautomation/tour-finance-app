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
    
    const conversationsChannel = supabase
      .channel('conversations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        loadConversations()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(conversationsChannel)
    }
  }, [])

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id)
      
      const messagesChannel = supabase
        .channel(`messages_${selectedConversation.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new as Message])
          scrollToBottom()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(messagesChannel)
      }
    }
  }, [selectedConversation])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function loadConversations() {
    setLoading(true)
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(100)
    
    if (data && !error) {
      const conversationsWithLastMessage = await Promise.all(
        data.map(async (conv) => {
          const { data: msgData } = await supabase
            .from('messages')
            .select('content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
          
          return {
            ...conv,
            last_message: msgData?.[0]?.content || 'No messages yet'
          }
        })
      )
      setConversations(conversationsWithLastMessage)
    }
    setLoading(false)
  }

  async function loadMessages(conversationId: string) {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    
    if (data) setMessages(data)
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConversation || sending) return
    
    setSending(true)
    const messageContent = newMessage.trim()
    setNewMessage('')

    const { error } = await supabase.from('messages').insert({
      conversation_id: selectedConversation.id,
      sender: 'staff',
      content: messageContent
    })

    if (!error) {
      await supabase
        .from('conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          status: 'human_active'
        })
        .eq('id', selectedConversation.id)

      try {
        await fetch('https://timelessconcept.app.n8n.cloud/webhook/samui-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: selectedConversation.id,
            message: messageContent,
            sender: 'staff',
            staffName: user?.name,
            customerPhone: selectedConversation.customer_phone,
            platform: selectedConversation.platform
          })
        })
      } catch (e) {
        console.log('n8n webhook not available')
      }
    }
    
    setSending(false)
  }

  async function takeOver(convId: string) {
    await supabase
      .from('conversations')
      .update({ status: 'human_active', assigned_staff: user?.id })
      .eq('id', convId)
    
    loadConversations()
    if (selectedConversation?.id === convId) {
      setSelectedConversation(prev => prev ? { ...prev, status: 'human_active' } : null)
    }
  }

  async function giveToBot(convId: string) {
    await supabase
      .from('conversations')
      .update({ status: 'active', assigned_staff: null })
      .eq('id', convId)
    
    loadConversations()
    if (selectedConversation?.id === convId) {
      setSelectedConversation(prev => prev ? { ...prev, status: 'active' } : null)
    }
  }

  async function closeConversation(convId: string) {
    await supabase
      .from('conversations')
      .update({ status: 'closed' })
      .eq('id', convId)
    
    loadConversations()
    if (selectedConversation?.id === convId) {
      setSelectedConversation(prev => prev ? { ...prev, status: 'closed' } : null)
    }
  }

  async function reopenConversation(convId: string) {
    await supabase
      .from('conversations')
      .update({ status: 'active' })
      .eq('id', convId)
    
    loadConversations()
    if (selectedConversation?.id === convId) {
      setSelectedConversation(prev => prev ? { ...prev, status: 'active' } : null)
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  function getPlatformIcon(platform: string) {
    switch (platform) {
      case 'line': return '🟢'
      case 'whatsapp': return '💬'
      case 'web': return '🌐'
      case 'email': return '📧'
      default: return '💬'
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'needs_human': return 'bg-red-500'
      case 'human_active': return 'bg-blue-500'
      case 'closed': return 'bg-gray-400'
      default: return 'bg-gray-400'
    }
  }

  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      const matchesSearch = 
        conv.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        conv.customer_phone?.includes(search) ||
        conv.customer_email?.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = !statusFilter || conv.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [conversations, search, statusFilter])

  const needsAttentionCount = conversations.filter(c => c.status === 'needs_human').length

  return (
    <div className="fade-in h-[calc(100vh-120px)] lg:h-[calc(100vh-64px)]">
      <div className="neu-card h-full overflow-hidden flex rounded-2xl">
        {/* Conversations List - Left Panel */}
        <div className={`w-full lg:w-[400px] flex-shrink-0 border-r border-gray-200/50 flex flex-col bg-gradient-to-br from-white to-[#F5F3FA] ${showMobileChat ? 'hidden lg:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-5 border-b border-gray-200/50">
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-2xl font-bold gradient-text">Chat Inbox</h1>
              <div className="flex items-center gap-3">
                {needsAttentionCount > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-400 text-white rounded-xl text-xs font-bold shadow-lg">
                    <AlertCircle size={14} /> {needsAttentionCount}
                  </span>
                )}
                <button onClick={loadConversations} className="neu-flat p-3 rounded-xl hover:bg-white/80 transition-all shadow-md">
                  <RefreshCw size={18} className="text-gray-500" />
                </button>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative mb-5">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="neu-input w-full pl-12 pr-4 py-3.5 text-sm rounded-xl"
              />
            </div>

            {/* Status Filter - Fixed Grid Layout */}
            <div className="grid grid-cols-5 gap-2">
              {[
                { value: '', label: 'All' },
                { value: 'needs_human', label: 'Help' },
                { value: 'active', label: 'Bot' },
                { value: 'human_active', label: 'Human' },
                { value: 'closed', label: 'Done' }
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all text-center ${
                    statusFilter === filter.value 
                      ? 'neu-btn text-white shadow-lg' 
                      : 'neu-flat text-gray-600 hover:bg-white/80 shadow-md'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="spinner w-10 h-10"></div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#9370DB]/20 to-[#00CED1]/20 flex items-center justify-center mb-4 shadow-lg">
                  <MessageCircle size={32} className="text-[#9370DB]" />
                </div>
                <p className="text-sm font-medium">No conversations found</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <div
                  key={conv.id}
                  className={`p-4 border-b border-gray-100/50 cursor-pointer transition-all hover:bg-white/70 ${
                    selectedConversation?.id === conv.id ? 'bg-gradient-to-r from-[#9370DB]/15 to-[#00CED1]/10 border-l-4 border-l-[#9370DB]' : ''
                  }`}
                >
                  <div onClick={() => { setSelectedConversation(conv); setShowMobileChat(true) }} className="flex items-start gap-3">
                    {/* Avatar - Circular */}
                    <div className="relative flex-shrink-0">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#9370DB]/30 to-[#00CED1]/30 flex items-center justify-center shadow-lg">
                        <span className="text-xl">{getPlatformIcon(conv.platform)}</span>
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(conv.status)} shadow-sm`}></div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-[#2D3748] truncate">
                          {conv.customer_name || conv.customer_phone || 'Unknown'}
                        </h3>
                        <span className="text-xs text-gray-400 font-medium flex-shrink-0 ml-2">
                          {conv.last_message_at ? formatTime(conv.last_message_at) : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate mb-2">{conv.last_message}</p>
                      
                      {/* Status + Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2.5 py-1 rounded-lg font-bold shadow-sm ${
                          conv.status === 'needs_human' ? 'bg-red-100 text-red-600' :
                          conv.status === 'active' ? 'bg-green-100 text-green-600' :
                          conv.status === 'human_active' ? 'bg-blue-100 text-blue-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {conv.status === 'needs_human' ? 'Needs Help' : 
                           conv.status === 'active' ? 'Bot Active' : 
                           conv.status === 'human_active' ? 'Human' : 'Closed'}
                        </span>
                        
                        {/* Take Over / Give to Bot buttons */}
                        {conv.status !== 'closed' && (
                          <>
                            {(conv.status === 'active' || conv.status === 'needs_human') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); takeOver(conv.id) }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-blue-500 to-blue-400 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all"
                              >
                                <UserCheck size={12} /> Take
                              </button>
                            )}
                            {conv.status === 'human_active' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); giveToBot(conv.id) }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-green-500 to-green-400 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all"
                              >
                                <Cpu size={12} /> Bot
                              </button>
                            )}
                          </>
                        )}
                        
                        {conv.booking_id && (
                          <span className="text-xs text-[#9370DB] font-semibold">#{conv.booking_id}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Panel - Right Panel */}
        <div className={`flex-1 flex flex-col bg-gradient-to-br from-white/80 to-[#EDE9F5]/80 ${!showMobileChat ? 'hidden lg:flex' : 'flex'}`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200/50 bg-white/80 backdrop-blur-sm flex items-center gap-3 rounded-tr-2xl">
                <button 
                  onClick={() => setShowMobileChat(false)}
                  className="lg:hidden neu-flat p-2.5 rounded-xl shadow-md"
                >
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
                
                {/* Circular Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9370DB]/30 to-[#00CED1]/30 flex items-center justify-center shadow-lg">
                  <span className="text-xl">{getPlatformIcon(selectedConversation.platform)}</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-[#2D3748] truncate">
                    {selectedConversation.customer_name || selectedConversation.customer_phone || 'Unknown'}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="font-medium">{selectedConversation.customer_phone}</span>
                    {selectedConversation.customer_email && (
                      <>
                        <span>•</span>
                        <span className="truncate">{selectedConversation.customer_email}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2">
                  {selectedConversation.status !== 'closed' ? (
                    <>
                      {(selectedConversation.status === 'active' || selectedConversation.status === 'needs_human') && (
                        <button
                          onClick={() => takeOver(selectedConversation.id)}
                          className="neu-btn px-4 py-2.5 flex items-center gap-2 text-sm rounded-xl shadow-lg"
                        >
                          <UserCheck size={16} /> Take Over
                        </button>
                      )}
                      {selectedConversation.status === 'human_active' && (
                        <button
                          onClick={() => giveToBot(selectedConversation.id)}
                          className="neu-btn-accent px-4 py-2.5 flex items-center gap-2 text-sm rounded-xl shadow-lg"
                        >
                          <Cpu size={16} /> Give to Bot
                        </button>
                      )}
                      <button
                        onClick={() => closeConversation(selectedConversation.id)}
                        className="neu-flat px-4 py-2.5 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-100 shadow-md"
                      >
                        Close
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => reopenConversation(selectedConversation.id)}
                      className="neu-btn-accent px-4 py-2.5 flex items-center gap-2 text-sm rounded-xl shadow-lg"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div 
                className="flex-1 overflow-y-auto p-5 space-y-4"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(237,233,245,0.6) 100%)' }}
              >
                {messages.map((msg, idx) => {
                  const isStaff = msg.sender === 'staff'
                  const isBot = msg.sender === 'bot'
                  const isCustomer = msg.sender === 'customer'
                  const showDate = idx === 0 || 
                    new Date(messages[idx-1].created_at).toDateString() !== new Date(msg.created_at).toDateString()

                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="px-4 py-2 neu-flat rounded-full text-xs text-gray-500 font-semibold shadow-md">
                            {new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[75%]`}>
                          <div className={`px-4 py-3 rounded-2xl shadow-lg ${
                            isCustomer 
                              ? 'bg-white rounded-tl-md' 
                              : isBot 
                                ? 'bg-gradient-to-br from-[#00CED1]/25 to-[#00CED1]/15 rounded-tr-md' 
                                : 'bg-gradient-to-br from-[#9370DB] to-[#7B68EE] text-white rounded-tr-md'
                          }`}>
                            {(isBot || isStaff) && (
                              <div className={`flex items-center gap-1.5 text-xs mb-1.5 font-bold ${isStaff ? 'text-white/80' : 'text-[#00CED1]'}`}>
                                {isBot ? <Bot size={12} /> : <User size={12} />}
                                <span>{isBot ? 'AI Assistant' : 'Staff'}</span>
                              </div>
                            )}
                            <p className={`text-sm whitespace-pre-wrap leading-relaxed ${isCustomer ? 'text-[#2D3748]' : isBot ? 'text-[#2D3748]' : ''}`}>
                              {msg.content}
                            </p>
                            <div className={`flex items-center justify-end gap-1 mt-2 ${isStaff ? 'text-white/60' : 'text-gray-400'}`}>
                              <span className="text-xs font-medium">
                                {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isStaff && <CheckCheck size={14} />}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {selectedConversation.status !== 'closed' && (
                <div className="p-4 border-t border-gray-200/50 bg-white/90 backdrop-blur-sm rounded-br-2xl">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 relative">
                      <textarea
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyPress={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            sendMessage()
                          }
                        }}
                        placeholder="Type a message..."
                        className="neu-input w-full px-4 py-3.5 pr-12 text-sm resize-none rounded-xl shadow-md"
                        rows={1}
                        style={{ minHeight: '52px', maxHeight: '120px' }}
                      />
                      <button className="absolute right-3 bottom-3.5 text-gray-400 hover:text-[#9370DB] transition-colors">
                        <Smile size={22} />
                      </button>
                    </div>
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="neu-btn p-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      {sending ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Send size={20} className="text-white" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* No conversation selected */
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#9370DB]/20 to-[#00CED1]/20 flex items-center justify-center mb-6 shadow-xl">
                <MessageCircle size={56} className="text-[#9370DB]" />
              </div>
              <h3 className="text-xl font-bold text-[#2D3748] mb-2">Select a Conversation</h3>
              <p className="text-sm">Choose a chat from the list to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
