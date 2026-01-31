import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tippsaxknexjelbnpryy.supabase.co'
const supabaseKey = 'sb_secret_8eu94kcJ-2AvOGpYawHs4g_tfALvv5Z'

export const supabase = createClient(supabaseUrl, supabaseKey)

export interface ShopifyOrder {
  id: string
  shopify_order_id: string
  shopify_order_number: string
  customer_name: string
  customer_email: string | null
  total_amount: number
  currency: string
  payment_status: string
  payment_method: string
  status: string
  product_title: string | null
  tour_date: string | null
  adults: number
  children: number
  infants: number
  received_at: string
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
  status: string
}
