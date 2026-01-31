import { useState } from 'react'
import { Transaction } from '../lib/supabase'
import { Search, Download, ArrowUpRight, ArrowDownRight, Receipt } from 'lucide-react'

interface Props { transactions: Transaction[] }

export default function TransactionsTable({ transactions }: Props) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.description?.toLowerCase().includes(search.toLowerCase()) || tx.category?.toLowerCase().includes(search.toLowerCase())
    const matchesType = !typeFilter || tx.type === typeFilter
    return matchesSearch && matchesType
  })

  const formatCurrency = (amount: number, currency: string = 'THB') => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount)
  }

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = filteredTransactions.filter(t => t.type === 'expense' || t.type === 'refund').reduce((s, t) => s + Math.abs(t.amount), 0)

  const exportToCSV = () => {
    const csv = [['Date', 'Type', 'Category', 'Description', 'Amount', 'Currency'],
      ...filteredTransactions.map(t => [formatDate(t.date), t.type, t.category, t.description || '', t.amount, t.currency])
    ].map(row => row.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Transactions</h1>
          <p className="text-gray-500 mt-1">Track all income and expenses</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
              className="neu-input pl-11 pr-4 py-3 w-full sm:w-48" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="neu-input px-4 py-3">
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="refund">Refund</option>
          </select>
          <button onClick={exportToCSV} className="neu-btn flex items-center justify-center gap-2 text-white px-5 py-3">
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="neu-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
            <ArrowUpRight className="text-green-600" size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Income</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          </div>
        </div>
        <div className="neu-card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
            <ArrowDownRight className="text-red-600" size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Expenses</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
          </div>
        </div>
        <div className="neu-card p-5 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${totalIncome - totalExpenses >= 0 ? 'bg-[#00CED1]/20' : 'bg-red-100'}`}>
            <Receipt className={totalIncome - totalExpenses >= 0 ? 'text-[#00CED1]' : 'text-red-600'} size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500">Net Balance</p>
            <p className={`text-xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-[#00CED1]' : 'text-red-600'}`}>{formatCurrency(totalIncome - totalExpenses)}</p>
          </div>
        </div>
      </div>

      <div className="neu-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-[#00CED1]/10 to-[#9370DB]/10">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-[#2D3748]">Date</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-[#2D3748]">Type</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-[#2D3748]">Category</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-[#2D3748]">Description</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-[#2D3748]">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 text-gray-600">{formatDate(tx.date)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full ${
                      tx.type === 'income' ? 'bg-green-100 text-green-700' : tx.type === 'refund' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {tx.type === 'income' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {tx.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600 capitalize">{tx.category?.replace('_', ' ')}</span>
                    {tx.ad_platform && <span className="text-xs text-gray-400 ml-2">({tx.ad_platform})</span>}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{tx.description || '-'}</td>
                  <td className={`px-6 py-4 text-right font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount, tx.currency)}
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
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
