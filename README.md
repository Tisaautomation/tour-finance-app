# 🌴 Tour in Koh Samui - Finance Dashboard

Beautiful neumorphic finance dashboard for managing tour booking revenue and expenses.

## ✨ Features

- 📊 **Dashboard** - KPIs, revenue trends, expense breakdown charts
- 🛒 **Orders** - View all Shopify orders synced automatically  
- 💰 **Transactions** - Track income and expenses
- ➕ **Add Expense** - Record advertising, provider payouts, operational costs
- 📥 **Export** - Download data as CSV
- 📱 **Responsive** - Works on mobile, tablet, desktop (PWA ready)

## 🎨 Design

- Neumorphic UI with soft shadows
- Brand colors: Turquoise (#00CED1) + Purple (#9370DB)
- Clean, modern, professional look

## 🛠️ Tech Stack

- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS
- Supabase (database)
- Recharts (charts)
- Lucide React (icons)

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## 🌐 Deploy to Vercel

1. Push to GitHub
2. Go to vercel.com
3. Import repo → Deploy

## 📊 Data Flow

```
Shopify Orders → Webhook → n8n → Supabase → This App
                                    ↑
                          Manual expenses added here
```

## 🔐 Environment

Supabase credentials in `src/lib/supabase.ts`

---
© 2026 Tour in Koh Samui
