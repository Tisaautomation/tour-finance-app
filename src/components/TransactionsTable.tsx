import { useState, useMemo } from 'react'
import { Transaction } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Search, Download, ArrowUpRight, ArrowDownRight, Receipt } from 'lucide-react'

interface Props { transactions: Transaction[] }

export default function TransactionsTable({ transactions }: Props) {
  const { hasPermission } = useAuth()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const categories = useMemo(() => [...new Set(transactions.map(t => t.category))].filter(Boolean), [transactions])

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      const matchesSearch = tx.description?.toLowerCase().includes(search.toLowerCase()) || tx.category?.toLowerCase().includes(search.toLowerCase())
      const matchesType = !typeFilter || tx.type === typeFilter
      const matchesCat = !categoryFilter || tx.category === categoryFilter
      return matchesSearch && matchesType && matchesCat
    })
  }, [transactions, search, typeFilter, categoryFilter])

  const formatCurrency = (amount: number, currency: string = 'THB') => new Intl.NumberFormat('th-TH', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)
  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = filtered.filter(t => t.type === 'expense' || t.type === 'refund').reduce((s, t) => s + Math.abs(t.amount), 0)

  const exportCSV = () => {
    if (!hasPermission('canExport')) return
    const csv = [['Date', 'Type', 'Category', 'Description', 'Amount', 'Currency'],
      ...filtered.map(t => [formatDate(t.date), t.type, t.category, t.description || '', t.amount, t.currency])
    ].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div className="fade-in h-full overflow-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Transactions</h1>
          <p className="text-gray-500 mt-1">Track income & expenses</p>
        </div>
        {hasPermission('canExport') && (
          <div className="flex gap-2">
            <button onClick={exportCSV} className="neu-btn px-4 py-2 flex items-center gap-2 text-sm">
              <Download size={16} /> Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="neu-input w-full pl-11 pr-4 py-3" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="neu-input px-4 py-3">
          <option value="">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="refund">Refund</option>
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="neu-input px-4 py-3">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c?.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="neu-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl icon-green flex items-center justify-center">
            <ArrowUpRight className="text-white" size={22} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Income</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          </div>
        </div>
        <div className="neu-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl icon-red flex items-center justify-center">
            <ArrowDownRight className="text-white" size={22} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Expenses</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
          </div>
        </div>
        <div className="neu-card p-5 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${totalIncome - totalExpenses >= 0 ? 'icon-primary' : 'icon-red'}`}>
            <Receipt className="text-white" size={22} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Net Balance</p>
            <p className={`text-xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-[#9370DB]' : 'text-red-600'}`}>{formatCurrency(totalIncome - totalExpenses)}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="neu-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="table-header">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-[#2D3748]">Date</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-[#2D3748]">Type</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-[#2D3748]">Category</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-[#2D3748]">Description</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-[#2D3748]">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-gray-600">{formatDate(tx.date)}</td>
                  <td className="px-6 py-4">
                    <span className={`badge ${tx.type === 'income' ? 'badge-paid' : tx.type === 'refund' ? 'badge-pending' : 'badge-cancelled'}`}>
                      {tx.type === 'income' ? <ArrowUpRight size={12} className="inline mr-1" /> : <ArrowDownRight size={12} className="inline mr-1" />}
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 capitalize">{tx.category?.replace('_', ' ')}{tx.ad_platform && <span className="text-xs text-gray-400 ml-1">({tx.ad_platform})</span>}</td>
                  <td className="px-6 py-4 text-gray-600">{tx.description || '-'}</td>
                  <td className={`px-6 py-4 text-right font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount, tx.currency)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  <Receipt size={48} className="mx-auto mb-3 opacity-30" /><p>No transactions found</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
