import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { useUpcomingPayments, usePayRecurring, useUnpayRecurring } from '../hooks/useRecurring'
import type { UpcomingPaymentItem } from '../types'
import clsx from 'clsx'

function fmt(n: number) {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function formatDueDate(s: string) {
  return format(parseISO(s), 'd MMM', { locale: th })
}

type Props = { month: string }

export default function UpcomingPaymentsCard({ month }: Props) {
  const { data, isLoading } = useUpcomingPayments(month)
  const pay = usePayRecurring()
  const unpay = useUnpayRecurring()
  const [busyId, setBusyId] = useState<number | null>(null)

  async function handlePay(item: UpcomingPaymentItem) {
    setBusyId(item.id)
    try {
      await pay.mutateAsync({ id: item.id, month })
    } finally {
      setBusyId(null)
    }
  }

  async function handleUnpay(item: UpcomingPaymentItem) {
    if (!confirm(`ยกเลิกการชำระ "${item.name}"? (จะลบ expense ที่สร้างไว้)`)) return
    setBusyId(item.id)
    try {
      await unpay.mutateAsync({ id: item.id, month })
    } finally {
      setBusyId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <div className="text-center py-6 text-gray-400 animate-pulse text-sm">กำลังโหลด...</div>
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">บิลที่ต้องจ่ายเดือนนี้</h2>
          <Link to="/recurring" className="text-xs text-indigo-600 hover:underline">+ ตั้งค่า</Link>
        </div>
        <p className="text-sm text-gray-400 text-center py-6">ยังไม่ได้ตั้งบิลรายเดือน</p>
      </div>
    )
  }

  const pct = data.total_due ? Math.round((data.total_paid / data.total_due) * 100) : 0

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">บิลที่ต้องจ่ายเดือนนี้</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            จ่ายแล้ว {data.paid_count}/{data.items.length} รายการ
            {data.overdue_count > 0 && (
              <span className="text-red-500 font-medium ml-1">• ค้าง {data.overdue_count}</span>
            )}
          </p>
        </div>
        <Link to="/recurring" className="text-xs text-indigo-600 hover:underline">จัดการ ›</Link>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-emerald-600 font-medium">฿{fmt(data.total_paid)}</span>
          <span className="text-gray-400">฿{fmt(data.total_due)}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {data.items.map(item => {
          const isPaid = item.status === 'paid'
          const isOverdue = item.status === 'overdue'
          const isBusy = busyId === item.id

          return (
            <div
              key={item.id}
              className={clsx(
                'flex items-center gap-3 p-3 rounded-xl border',
                isPaid ? 'bg-emerald-50/50 border-emerald-100'
                  : isOverdue ? 'bg-red-50/50 border-red-200'
                  : 'bg-white border-gray-100'
              )}
            >
              <span
                className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                style={{ backgroundColor: `${item.category_color}20` }}
              >
                {item.category_icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className={clsx(
                  'text-sm font-medium truncate',
                  isPaid ? 'text-gray-500 line-through' : 'text-gray-900'
                )}>
                  {item.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs">
                  <span className={isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}>
                    📅 {formatDueDate(item.due_date)}
                  </span>
                  {isOverdue && <span className="text-red-500 font-medium">เกินกำหนด</span>}
                  {isPaid && <span className="text-emerald-600">✓ ชำระแล้ว</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={clsx(
                  'text-sm font-semibold',
                  isPaid ? 'text-gray-400' : 'text-gray-900'
                )}>
                  ฿{fmt(item.amount)}
                </p>
              </div>
              <div className="flex-shrink-0">
                {isPaid ? (
                  <button
                    onClick={() => handleUnpay(item)}
                    disabled={isBusy}
                    className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                ) : (
                  <button
                    onClick={() => handlePay(item)}
                    disabled={isBusy}
                    className={clsx(
                      'px-3 py-1.5 text-xs rounded-lg font-medium disabled:opacity-50',
                      isOverdue
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    )}
                  >
                    {isBusy ? '...' : 'จ่ายแล้ว'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
