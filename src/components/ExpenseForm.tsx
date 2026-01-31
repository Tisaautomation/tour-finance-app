import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Save, Loader2, DollarSign, Tag, Calendar, FileText } from 'lucide-react'

interface Props { onSuccess: () => void }

export default function ExpenseForm({ onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    type: 'expense', category: 'advertising', amount: '', currency: 'THB',
    description: '', ad_platform: '', date: new Date().toISOString().split('T')[0]
  })

  const categories = [
    { value: 'advertising', label: 'Advertising', icon: '📣' },
    { value: 'provider_payout', label: 'Provider Payout', icon: '💸' },
    { value: 'operational', label: 'Operational', icon: '⚙️' },
    { value: 'platform_fee', label: 'Platform Fee', icon: '🏷️' },
    { value: 'other', label: 'Other', icon: '📦' },
  ]

  const adPlatforms = [
    { value: '', label: 'Select platform' },
    { value: 'google', label: 'Google Ads' },
    { value: 'facebook', label: 'Facebook/Meta' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'other', label: 'Other' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.amount || !formData.description) return
    setLoading(true)
    
    const { error } = await supabase.from('transactions').insert({
      type: formData.type, category: formData.category,
      amount: -Math.abs(parseFloat(formData.amount)),
      currency: formData.currency, description: formData.description,
      ad_platform: formData.ad_platform || null, date: formData.date, status: 'completed'
    })

    setLoading(false)
    if (error) alert('Error: ' + error.message)
    else onSuccess()
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold gradient-text">Add Expense</h1>
        <p className="text-gray-500 mt-1">Record business expenses and costs</p>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="neu-card p-8 space-y-6">
          {/* Type */}
          <div>
            <label className="block text-sm font-semibold text-[#2D3748] mb-3">Transaction Type</label>
            <div className="flex gap-4">
              {['expense', 'refund'].map(type => (
                <button key={type} type="button"
                  onClick={() => setFormData({ ...formData, type })}
                  className={`flex-1 py-4 px-6 rounded-xl font-medium transition-all ${
                    formData.type === type 
                      ? 'bg-gradient-to-r from-[#00CED1] to-[#9370DB] text-white shadow-lg' 
                      : 'neu-input text-gray-600 hover:bg-gray-50'
                  }`}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-[#2D3748] mb-3">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {categories.map(cat => (
                <button key={cat.value} type="button"
                  onClick={() => setFormData({ ...formData, category: cat.value })}
                  className={`p-4 rounded-xl font-medium text-left transition-all ${
                    formData.category === cat.value 
                      ? 'bg-gradient-to-r from-[#00CED1]/20 to-[#9370DB]/20 border-2 border-[#00CED1]' 
                      : 'neu-input hover:bg-gray-50'
                  }`}>
                  <span className="text-2xl mb-1 block">{cat.icon}</span>
                  <span className="text-sm text-[#2D3748]">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Ad Platform */}
          {formData.category === 'advertising' && (
            <div>
              <label className="block text-sm font-semibold text-[#2D3748] mb-3">Ad Platform</label>
              <select value={formData.ad_platform} onChange={e => setFormData({ ...formData, ad_platform: e.target.value })}
                className="neu-input w-full px-4 py-3">
                {adPlatforms.map(p => (<option key={p.value} value={p.value}>{p.label}</option>))}
              </select>
            </div>
          )}

          {/* Amount */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-[#2D3748] mb-3">Amount</label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="number" step="0.01" value={formData.amount} placeholder="0.00"
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  className="neu-input w-full pl-12 pr-4 py-3 text-lg font-semibold" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#2D3748] mb-3">Currency</label>
              <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })}
                className="neu-input w-full px-4 py-3">
                <option value="THB">THB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-[#2D3748] mb-3">Date</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="neu-input w-full pl-12 pr-4 py-3" required />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-[#2D3748] mb-3">Description</label>
            <div className="relative">
              <FileText className="absolute left-4 top-4 text-gray-400" size={20} />
              <textarea value={formData.description} placeholder="e.g., Facebook ads for January campaign"
                onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3}
                className="neu-input w-full pl-12 pr-4 py-3" required />
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="neu-btn w-full flex items-center justify-center gap-3 text-white py-4 text-lg font-semibold disabled:opacity-50">
            {loading ? (<><Loader2 size={24} className="animate-spin" /> Saving...</>) : (<><Save size={24} /> Save Expense</>)}
          </button>
        </form>
      </div>
    </div>
  )
}
