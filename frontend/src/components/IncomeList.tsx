import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { useDeleteIncome } from '../hooks/useIncomes'
import type { Income } from '../types'
import IncomeForm from './IncomeForm'

type Props = {
  incomes: Income[]
  showDate?: boolean
}

function formatAmount(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'd MMM yyyy', { locale: th })
}

export default function IncomeList({ incomes, showDate = true }: Props) {
  const [editing, setEditing] = useState<Income | null>(null)
  const deleteIncome = useDeleteIncome()

  async function handleDelete(id: number) {
    if (!confirm('ลบรายรับนี้?')) return
    await deleteIncome.mutateAsync(id)
  }

  if (incomes.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">💰</p>
        <p className="text-sm">ยังไม่มีรายการรายรับ</p>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y divide-gray-100">
        {incomes.map(income => (
          <div key={income.id} className="flex items-center gap-3 py-3 group">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ backgroundColor: `${income.category_color}20` }}
            >
              {income.category_icon ?? '💰'}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {income.category_name}
                {income.note && (
                  <span className="text-gray-400 font-normal ml-1">— {income.note}</span>
                )}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {showDate && (
                  <span className="text-xs text-gray-400">{formatDate(income.date)}</span>
                )}
                {income.member_name && (
                  <span className="text-xs text-gray-500">
                    {income.member_emoji} {income.member_name}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-emerald-600">+฿{formatAmount(income.amount)}</p>
            </div>

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditing(income)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                title="แก้ไข"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDelete(income.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                title="ลบ"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">แก้ไขรายรับ</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <IncomeForm income={editing} onClose={() => setEditing(null)} />
          </div>
        </div>
      )}
    </>
  )
}
