import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'CONFIGURE_IN_ENV'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'CONFIGURE_IN_ENV'

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
  webhook_topic: string | null
  raw_data: Record<string, unknown> | null
  received_at: string
  created_at: string
}

export interface Booking {
  id: string
  shopify_order_id: string
  shopify_order_number: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  tour_id: string | null
  provider_id: string | null
  tour_date: string | null
  tour_time: string | null
  pickup_location: string | null
  adults: number
  children: number
  infants: number
  total_amount: number
  currency: string
  status: string
  payment_status: string
  payment_method: string | null
  provider_confirmed: boolean
  special_requests: string | null
  internal_notes: string | null
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  transaction_id: string | null
  date: string
  type: 'income' | 'expense' | 'refund' | 'fee'
  category: string
  amount: number
  currency: string
  booking_id: string | null
  provider_id: string | null
  payment_method: string | null
  ad_platform: string | null
  description: string | null
  status: string
  created_by: string | null
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

export interface LineItem {
  name: string
  title: string
  variant_title: string | null
  quantity: number
  price: string
  product_id: number
  variant_id: number
}

// Role permissions — granular for audit compliance
export const ROLE_PERMISSIONS = {
  admin: {
    canViewDashboard: true,
    canViewOrders: true,
    canViewTransactions: true,
    canAddExpense: true,
    canAddRefund: true,
    canEditOrders: true,
    canEditTransactions: true,
    canExport: true,
    canManageUsers: true,
    canSendEmails: true,
    canViewAllProviders: true,
    canManageBlocks: true,
  },
  manager: {
    canViewDashboard: true,
    canViewOrders: true,
    canViewTransactions: true,
    canAddExpense: true,
    canAddRefund: true,
    canEditOrders: false,
    canEditTransactions: false,
    canExport: true,
    canManageUsers: false,
    canSendEmails: true,
    canViewAllProviders: true,
    canManageBlocks: true,
  },
  staff: {
    canViewDashboard: true,
    canViewOrders: true,
    canViewTransactions: false,
    canAddExpense: false,
    canAddRefund: false,
    canEditOrders: false,
    canEditTransactions: false,
    canExport: false,
    canManageUsers: false,
    canSendEmails: false,
    canViewAllProviders: false,
    canManageBlocks: false,
  },
  provider: {
    canViewDashboard: true,
    canViewOrders: true,
    canViewTransactions: true,
    canAddExpense: false,
    canAddRefund: false,
    canEditOrders: false,
    canEditTransactions: false,
    canExport: true,
    canManageUsers: false,
    canSendEmails: false,
    canViewAllProviders: false,
    canManageBlocks: false,
  },
}
