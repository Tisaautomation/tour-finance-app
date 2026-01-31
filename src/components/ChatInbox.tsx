import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { 
  Search, Send, Phone, MoreVertical, ArrowLeft, User, Bot, 
  MessageCircle, Clock, CheckCheck, Filter, RefreshCw, Smile,
  Paperclip, Mic, X, Circle, AlertCircle
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
    
    // Subscribe to realtime updates
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
      
      // Subscribe to messages for selected conversation
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
      // Get last message for each conversation
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

    // Insert message as staff
    const { error } = await supabase.from('messages').insert({
      conversation_id: selectedConversation.id,
      sender: 'staff',
      content: messageContent
    })

    if (!error) {
      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          status: 'human_active'
        })
        .eq('id', selectedConversation.id)

      // Optionally send to n8n for AI processing or external messaging
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

  async function updateConversationStatus(convId: string, status: string) {
    await supabase
      .from('conversations')
      .update({ status, assigned_staff: user?.id })
      .eq('id', convId)
    
    loadConversations()
    if (selectedConversation?.id === convId) {
      setSelectedConversation(prev => prev ? { ...prev, status: status as any } : null)
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
      <div className="neu-card h-full overflow-hidden flex">
        {/* Conversations List - Left Panel */}
        <div className={`w-full lg:w-96 flex-shrink-0 border-r border-gray-100 flex flex-col ${showMobileChat ? 'hidden lg:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold gradient-text">Chat Inbox</h1>
              <div className="flex items-center gap-2">
                {needsAttentionCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 rounded-lg text-xs font-semibold">
                    <AlertCircle size={14} /> {needsAttentionCount}
                  </span>
                )}
                <button onClick={loadConversations} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <RefreshCw size={18} className="text-gray-500" />
                </button>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="neu-input w-full pl-10 pr-4 py-2.5 text-sm"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {['', 'needs_human', 'active', 'human_active', 'closed'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    statusFilter === status 
                      ? 'bg-[#9370DB] text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status === '' ? 'All' : status === 'needs_human' ? '🔴 Needs Help' : status === 'active' ? '🤖 Bot' : status === 'human_active' ? '👤 Human' : '✓ Closed'}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="spinner w-8 h-8"></div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <MessageCircle size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No conversations found</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversation(conv)
                    setShowMobileChat(true)
                  }}
                  className={`p-4 border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${
                    selectedConversation?.id === conv.id ? 'bg-[#9370DB]/10 border-l-4 border-l-[#9370DB]' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9370DB]/30 to-[#00CED1]/30 flex items-center justify-center">
                        <span className="text-lg">{getPlatformIcon(conv.platform)}</span>
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(conv.status)}`}></div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-[#2D3748] truncate">
                          {conv.customer_name || conv.customer_phone || 'Unknown'}
                        </h3>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                          {conv.last_message_at ? formatTime(conv.last_message_at) : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{conv.last_message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          conv.status === 'needs_human' ? 'bg-red-100 text-red-600' :
                          conv.status === 'active' ? 'bg-green-100 text-green-600' :
                          conv.status === 'human_active' ? 'bg-blue-100 text-blue-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {conv.status === 'needs_human' ? 'Needs Help' : conv.status === 'human_active' ? 'In Progress' : conv.status}
                        </span>
                        {conv.booking_id && (
                          <span className="text-xs text-[#9370DB]">#{conv.booking_id}</span>
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
        <div className={`flex-1 flex flex-col ${!showMobileChat ? 'hidden lg:flex' : 'flex'}`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <button 
                  onClick={() => setShowMobileChat(false)}
                  className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
                
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9370DB]/30 to-[#00CED1]/30 flex items-center justify-center">
                  <span className="text-lg">{getPlatformIcon(selectedConversation.platform)}</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-[#2D3748] truncate">
                    {selectedConversation.customer_name || selectedConversation.customer_phone || 'Unknown'}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{selectedConversation.customer_phone}</span>
                    {selectedConversation.customer_email && (
                      <>
                        <span>•</span>
                        <span className="truncate">{selectedConversation.customer_email}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Actions */}
                <div className="flex items-center gap-2">
                  {selectedConversation.status !== 'closed' && (
                    <>
                      {selectedConversation.status === 'needs_human' && (
                        <button
                          onClick={() => updateConversationStatus(selectedConversation.id, 'human_active')}
                          className="px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          Take Over
                        </button>
                      )}
                      <button
                        onClick={() => updateConversationStatus(selectedConversation.id, 'closed')}
                        className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Close
                      </button>
                    </>
                  )}
                  {selectedConversation.status === 'closed' && (
                    <button
                      onClick={() => updateConversationStatus(selectedConversation.id, 'active')}
                      className="px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 transition-colors"
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div 
                className="flex-1 overflow-y-auto p-4 space-y-3"
                style={{ background: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)' }}
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
                          <span className="px-3 py-1 bg-white/80 rounded-full text-xs text-gray-500 shadow-sm">
                            {new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[75%] ${isCustomer ? 'order-2' : 'order-1'}`}>
                          <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                            isCustomer 
                              ? 'bg-white rounded-tl-sm' 
                              : isBot 
                                ? 'bg-[#00CED1]/20 rounded-tr-sm' 
                                : 'bg-[#9370DB] text-white rounded-tr-sm'
                          }`}>
                            {(isBot || isStaff) && (
                              <div className={`flex items-center gap-1 text-xs mb-1 ${isStaff ? 'text-white/70' : 'text-[#00CED1]'}`}>
                                {isBot ? <Bot size={12} /> : <User size={12} />}
                                <span>{isBot ? 'AI Assistant' : 'Staff'}</span>
                              </div>
                            )}
                            <p className={`text-sm whitespace-pre-wrap ${isCustomer ? 'text-[#2D3748]' : isBot ? 'text-[#2D3748]' : ''}`}>
                              {msg.content}
                            </p>
                            <div className={`flex items-center justify-end gap-1 mt-1 ${isStaff ? 'text-white/60' : 'text-gray-400'}`}>
                              <span className="text-xs">
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
                <div className="p-4 border-t border-gray-100 bg-white">
                  <div className="flex items-end gap-2">
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
                        className="neu-input w-full px-4 py-3 pr-12 text-sm resize-none"
                        rows={1}
                        style={{ minHeight: '48px', maxHeight: '120px' }}
                      />
                      <button className="absolute right-3 bottom-3 text-gray-400 hover:text-gray-600">
                        <Smile size={20} />
                      </button>
                    </div>
                    <button
                      onClick={sendMessage}
                      disabled={!newMessage.trim() || sending}
                      className="neu-btn-accent p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#9370DB]/20 to-[#00CED1]/20 flex items-center justify-center mb-4">
                <MessageCircle size={40} className="text-[#9370DB]" />
              </div>
              <h3 className="text-lg font-semibold text-[#2D3748] mb-1">Select a Conversation</h3>
              <p className="text-sm">Choose a chat from the list to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
