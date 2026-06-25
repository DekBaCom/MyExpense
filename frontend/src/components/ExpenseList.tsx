import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { useDeleteExpense } from '../hooks/useExpenses'
import type { Expense } from '../types'
import { api } from '../api/client'
import ExpenseForm from './ExpenseForm'
import clsx from 'clsx'

type Props = {
  expenses: Expense[]
  showDate?: boolean
}

function formatAmount(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'd MMM yyyy', { locale: th })
}

export default function ExpenseList({ expenses, showDate = true }: Props) {
  const [editing, setEditing] = useState<Expense | null>(null)
  const deleteExpense = useDeleteExpense()

  async function handleDelete(id: number) {
    if (!confirm('ลบรายการนี้?')) return
    await deleteExpense.mutateAsync(id)
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-sm">ยังไม่มีรายการค่าใช้จ่าย</p>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y divide-gray-100">
        {expenses.map(expense => (
          <div key={expense.id} className="flex items-center gap-3 py-3 group">
            {/* Category icon */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ backgroundColor: `${expense.category_color}20` }}
            >
              {expense.category_icon ?? '💰'}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {expense.category_name}
                {expense.note && (
                  <span className="text-gray-400 font-normal ml-1">— {expense.note}</span>
                )}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {showDate && (
                  <span className="text-xs text-gray-400">{formatDate(expense.date)}</span>
                )}
                {expense.member_name && (
                  <span className="text-xs text-gray-500">
                    {expense.member_emoji} {expense.member_name}
                  </span>
                )}
                <span className={clsx(
                  'text-xs px-1.5 py-0.5 rounded-full',
                  expense.payment_method === 'cash' && 'bg-green-50 text-green-700',
                  expense.payment_method === 'transfer' && 'bg-blue-50 text-blue-700',
                  expense.payment_method === 'credit' && 'bg-purple-50 text-purple-700',
                  expense.payment_method === 'qr' && 'bg-orange-50 text-orange-700',
                )}>
                  {{cash:'เงินสด',transfer:'โอน',credit:'บัตร',qr:'QR'}[expense.payment_method]}
                </span>
              </div>
            </div>

            {/* Receipt thumbnail */}
            {expense.receipt_key && (
              <a
                href={api.getReceiptUrl(expense.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
                title="ดูใบเสร็จ"
              >
                <img
                  src={api.getReceiptUrl(expense.id)}
                  alt="ใบเสร็จ"
                  className="w-10 h-10 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition-opacity"
                />
              </a>
            )}

            {/* Amount */}
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-gray-900">฿{formatAmount(expense.amount)}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditing(expense)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                title="แก้ไข"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDelete(expense.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                title="ลบ"
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">แก้ไขรายจ่าย</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <ExpenseForm expense={editing} onClose={() => setEditing(null)} />
          </div>
        </div>
      )}
    </>
  )
}
