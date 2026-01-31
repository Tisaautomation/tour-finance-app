import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tippsaxknexjelbnpryy.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpcHBzYXhrbmV4amVsYm5wcnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NjY1MzIsImV4cCI6MjA4NTQ0MjUzMn0.KPSzBLwNkOMNZvyGCpNTvPGwPjLSPP6kLJPnxb8B7Uw'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Types
export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'manager' | 'staff' | 'provider'
  is_active: boolean
}

export interface ShopifyOrder {
  id: string
  shopify_order_id: string
  shopify_order_number: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  total_amount: number
  currency: string
  payment_status: string
  payment_method: string
  status: string
  product_title: string | null
  tour_date: string | null
  tour_time: string | null
  pickup_location: string | null
  adults: number
  children: number
  infants: number
  received_at: string
  created_at: string
}

export interface Transaction {
  id: string
  date: string
  type: 'income' | 'expense' | 'refund' | 'fee'
  category: string
  amount: number
  currency: string
  description: string | null
  ad_platform: string | null
  provider_id: string | null
  status: string
  created_at: string
}

export interface Provider {
  id: string
  provider_id: string
  name: string
  email: string | null
  phone: string | null
  commission_rate: number
  is_active: boolean
  is_available: boolean
}

// Role permissions
export const ROLE_PERMISSIONS = {
  admin: {
    canViewDashboard: true,
    canViewOrders: true,
    canViewTransactions: true,
    canAddExpense: true,
    canExport: true,
    canManageUsers: true,
    canSendEmails: true,
    canViewAllProviders: true,
  },
  manager: {
    canViewDashboard: true,
    canViewOrders: true,
    canViewTransactions: true,
    canAddExpense: true,
    canExport: true,
    canManageUsers: false,
    canSendEmails: true,
    canViewAllProviders: true,
  },
  staff: {
    canViewDashboard: true,
    canViewOrders: true,
    canViewTransactions: false,
    canAddExpense: false,
    canExport: false,
    canManageUsers: false,
    canSendEmails: false,
    canViewAllProviders: false,
  },
  provider: {
    canViewDashboard: true,
    canViewOrders: true,
    canViewTransactions: true,
    canAddExpense: false,
    canExport: true,
    canManageUsers: false,
    canSendEmails: false,
    canViewAllProviders: false,
  },
}
