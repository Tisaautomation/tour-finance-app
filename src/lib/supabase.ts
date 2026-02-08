import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tippsaxknexjelbnpryy.supabase.co'
const supabaseKey = 'sb_publishable_5RQtGuGgDGBGrho7wh-hsw_qJathHTX'

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
    canManageBlocks: true,
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
    canManageBlocks: true,
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
    canManageBlocks: false,
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
    canManageBlocks: false,
  },
}
