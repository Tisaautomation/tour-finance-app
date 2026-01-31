import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Save, Loader2, DollarSign, Calendar, FileText } from 'lucide-react'

interface Props { onSuccess: () => void }

export default function ExpenseForm({ onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    type: 'expense',
    category: 'advertising',
    amount: '',
    currency: 'THB',
    description: '',
    ad_platform: '',
    date: new Date().toISOString().split('T')[0]
  })

  const categories = [
    { value: 'advertising', label: 'Advertising', icon: '📣' },
    { value: 'provider_payout', label: 'Provider Payout', icon: '💸' },
    { value: 'operational', label: 'Operational', icon: '⚙️' },
    { value: 'platform_fee', label: 'Platform Fee', icon: '🏷️' },
    { value: 'refund', label: 'Customer Refund', icon: '↩️' },
    { value: 'other', label: 'Other', icon: '📦' },
  ]

  const adPlatforms = ['Google Ads', 'Facebook/Meta', 'TikTok', 'Instagram', 'LINE', 'Other']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.amount || !formData.description) return
    setLoading(true)
    
    const { error } = await supabase.from('transactions').insert({
      type: formData.type,
      category: formData.category,
      amount: -Math.abs(parseFloat(formData.amount)),
      currency: formData.currency,
      description: formData.description,
      ad_platform: formData.ad_platform || null,
      date: formData.date,
      status: 'completed'
    })

    setLoading(false)
    if (error) {
      alert('Error: ' + error.message)
    } else {
      setFormData({ ...formData, amount: '', description: '', ad_platform: '' })
      onSuccess()
    }
  }

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold gradient-text">Add Expense</h1>
        <p className="text-gray-500 mt-1">Record business expenses and costs</p>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="neu-card p-8 space-y-6">
          {/* Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Transaction Type</label>
            <div className="flex gap-4">
              {['expense', 'refund'].map(type => (
                <button key={type} type="button"
                  onClick={() => setFormData({ ...formData, type })}
                  className={`flex-1 py-4 px-6 rounded-xl font-medium transition-all ${
                    formData.type === type 
                      ? 'today-gradient text-white shadow-lg' 
                      : 'neu-input text-gray-600 hover:bg-gray-50'
                  }`}>
                  {type === 'expense' ? '💸 Expense' : '↩️ Refund'}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categories.map(cat => (
                <button key={cat.value} type="button"
                  onClick={() => setFormData({ ...formData, category: cat.value })}
                  className={`p-4 rounded-xl font-medium text-left transition-all ${
                    formData.category === cat.value 
                      ? 'bg-gradient-to-r from-[#9370DB]/20 to-[#00CED1]/20 border-2 border-[#9370DB]' 
                      : 'neu-flat hover:shadow-lg'
                  }`}>
                  <span className="text-2xl mb-1 block">{cat.icon}</span>
                  <span className="text-sm text-[#2D3748]">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Ad Platform (conditional) */}
          {formData.category === 'advertising' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Ad Platform</label>
              <div className="flex flex-wrap gap-2">
                {adPlatforms.map(p => (
                  <button key={p} type="button"
                    onClick={() => setFormData({ ...formData, ad_platform: p })}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      formData.ad_platform === p 
                        ? 'bg-[#9370DB] text-white' 
                        : 'neu-flat text-gray-600 hover:bg-gray-100'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Amount</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="number" step="0.01" value={formData.amount} placeholder="0.00"
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="neu-input w-full pl-12 pr-4 py-4 text-lg font-semibold" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">Currency</label>
              <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })}
                className="neu-input w-full px-4 py-4">
                <option value="THB">🇹🇭 THB</option>
                <option value="USD">🇺🇸 USD</option>
                <option value="EUR">🇪🇺 EUR</option>
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Date</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="neu-input w-full pl-12 pr-4 py-4" required />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Description</label>
            <div className="relative">
              <FileText className="absolute left-4 top-4 text-gray-400" size={20} />
              <textarea value={formData.description} placeholder="e.g., Facebook ads for January campaign"
                onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3}
                className="neu-input w-full pl-12 pr-4 py-4" required />
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="neu-btn w-full flex items-center justify-center gap-3 py-4 text-lg font-semibold disabled:opacity-50">
            {loading ? (<><Loader2 size={22} className="animate-spin" /> Saving...</>) : (<><Save size={22} /> Save Expense</>)}
          </button>
        </form>
      </div>
    </div>
  )
}
