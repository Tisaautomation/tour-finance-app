-- =============================================
-- CHAT INBOX TABLES FOR FINANCE APP
-- Run this in Supabase SQL Editor
-- =============================================

-- CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    platform TEXT CHECK (platform IN ('line', 'whatsapp', 'web', 'email')) DEFAULT 'web',
    language TEXT DEFAULT 'en',
    status TEXT CHECK (status IN ('active', 'needs_human', 'human_active', 'closed')) DEFAULT 'active',
    booking_id TEXT,
    escalation_reason TEXT,
    assigned_staff UUID,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    sender TEXT CHECK (sender IN ('customer', 'bot', 'staff')) NOT NULL,
    content TEXT NOT NULL,
    ai_model TEXT,
    ai_confidence DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for service role / anon for now)
DROP POLICY IF EXISTS "Allow all conversations" ON conversations;
CREATE POLICY "Allow all conversations" ON conversations FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all messages" ON messages;
CREATE POLICY "Allow all messages" ON messages FOR ALL USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Insert some test data
INSERT INTO conversations (customer_name, customer_phone, customer_email, platform, status, last_message_at)
VALUES 
    ('John Smith', '+66812345678', 'john@example.com', 'line', 'active', NOW() - INTERVAL '5 minutes'),
    ('Maria Garcia', '+66823456789', 'maria@example.com', 'whatsapp', 'needs_human', NOW() - INTERVAL '2 hours'),
    ('David Chen', '+66834567890', 'david@example.com', 'web', 'human_active', NOW() - INTERVAL '30 minutes')
ON CONFLICT DO NOTHING;

-- Insert test messages
INSERT INTO messages (conversation_id, sender, content, created_at)
SELECT 
    c.id,
    'customer',
    'Hello! I want to book a tour to Ang Thong National Park',
    NOW() - INTERVAL '10 minutes'
FROM conversations c WHERE c.customer_name = 'John Smith'
ON CONFLICT DO NOTHING;

INSERT INTO messages (conversation_id, sender, content, ai_model, created_at)
SELECT 
    c.id,
    'bot',
    'Hi John! 🌴 Great choice! Ang Thong National Park is beautiful. What date are you looking to visit?',
    'claude-3',
    NOW() - INTERVAL '9 minutes'
FROM conversations c WHERE c.customer_name = 'John Smith'
ON CONFLICT DO NOTHING;

INSERT INTO messages (conversation_id, sender, content, created_at)
SELECT 
    c.id,
    'customer',
    'I need to change my booking for tomorrow. Can you help?',
    NOW() - INTERVAL '2 hours'
FROM conversations c WHERE c.customer_name = 'Maria Garcia'
ON CONFLICT DO NOTHING;

SELECT 'SUCCESS! Chat tables created with test data.' as result;
