import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useCategories } from '../hooks/useCategories'
import type { Category } from '../types'

export default function BudgetPage() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [budgets, setBudgets] = useState<Record<number, string>>({})
  const [saved, setSaved] = useState(false)
  const qc = useQueryClient()

  const { data: categories = [] } = useCategories()
  const { data: existing = [] } = useQuery({
    queryKey: ['budgets', month],
    queryFn: () => api.getBudgets(month),
  })

  const save = useMutation({
    mutationFn: (items: { category_id: number; amount: number }[]) =>
      api.saveBudgets(month, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets', month] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  // Populate form from existing budgets
  useEffect(() => {
    const map: Record<number, string> = {}
    existing.forEach(b => { map[b.category_id] = String(b.amount) })
    setBudgets(map)
  }, [existing])

  function handleChange(catId: number, value: string) {
    setBudgets(prev => ({ ...prev, [catId]: value }))
  }

  function handleSave() {
    const items = Object.entries(budgets)
      .map(([id, amount]) => ({
        category_id: parseInt(id),
        amount: parseFloat(amount) || 0,
      }))
      .filter(item => item.amount > 0)
    save.mutate(items)
  }

  const totalBudget = Object.values(budgets).reduce((s, v) => s + (parseFloat(v) || 0), 0)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">งบประมาณ</h1>
        <p className="text-gray-500 text-sm mt-0.5">ตั้งงบค่าใช้จ่ายแต่ละหมวดรายเดือน</p>
      </div>

      {/* Month */}
      <div className="flex items-center gap-3">
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm"
        />
        {totalBudget > 0 && (
          <div className="text-sm text-gray-600">
            รวม <span className="font-bold text-gray-900">
              ฿{totalBudget.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
            </span>
          </div>
        )}
      </div>

      {/* Category budget inputs */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {categories.map((parent: Category) => (
          <div key={parent.id}>
            {/* Parent category header */}
            <div
              className="px-5 py-3 flex items-center gap-3 border-b border-gray-100"
              style={{ backgroundColor: `${parent.color}08` }}
            >
              <span className="text-xl">{parent.icon}</span>
              <span className="font-semibold text-gray-800 text-sm">{parent.name}</span>
              <div className="flex-1" />
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">฿</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={budgets[parent.id] ?? ''}
                  onChange={e => handleChange(parent.id, e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right"
                />
              </div>
            </div>

            {/* Children */}
            {(parent.children ?? []).map(child => (
              <div key={child.id} className="px-5 py-2.5 flex items-center gap-3 border-b border-gray-50 bg-gray-50/50">
                <span className="w-5" />
                <span className="text-base">{child.icon}</span>
                <span className="text-sm text-gray-600 flex-1">{child.name}</span>
                <div className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">฿</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={budgets[child.id] ?? ''}
                    onChange={e => handleChange(child.id, e.target.value)}
                    placeholder="0"
                    className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={save.isPending}
          className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {save.isPending ? 'กำลังบันทึก...' : 'บันทึกงบประมาณ'}
        </button>
        {saved && (
          <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
            <span>✓</span> บันทึกแล้ว
          </div>
        )}
      </div>
    </div>
  )
}
