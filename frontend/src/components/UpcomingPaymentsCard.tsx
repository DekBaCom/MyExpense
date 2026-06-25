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
  const [payTarget, setPayTarget] = useState<UpcomingPaymentItem | null>(null)
  const [payForm, setPayForm] = useState({
    amount: '',
    date: '',
    note: '',
  })

  function openPayModal(item: UpcomingPaymentItem) {
    setPayTarget(item)
    setPayForm({
      amount: String(item.amount),
      date: format(new Date(), 'yyyy-MM-dd'),
      note: '',
    })
  }

  async function confirmPay() {
    if (!payTarget) return
    const amount = parseFloat(payForm.amount)
    if (!amount || amount <= 0) return
    setBusyId(payTarget.id)
    try {
      await pay.mutateAsync({
        id: payTarget.id,
        month,
        amount,
        date: payForm.date || undefined,
        note: payForm.note.trim() || undefined,
      })
      setPayTarget(null)
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
  const amountDelta = (() => {
    if (!payTarget) return 0
    const a = parseFloat(payForm.amount)
    if (!a) return 0
    return a - payTarget.amount
  })()

  return (
    <>
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
                      onClick={() => openPayModal(item)}
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

      {/* Pay modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">บันทึกการชำระ</h2>
              <button onClick={() => setPayTarget(null)} className="text-gray-400 text-xl">✕</button>
            </div>

            {/* Bill preview */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <span
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: `${payTarget.category_color}20` }}
              >
                {payTarget.category_icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{payTarget.name}</p>
                <p className="text-xs text-gray-400">
                  ครบกำหนด {formatDueDate(payTarget.due_date)} • บิลปกติ ฿{fmt(payTarget.amount)}
                </p>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                จำนวนเงินที่จ่ายจริง
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">฿</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={payForm.amount}
                  onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                  className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-xl text-right text-xl font-bold"
                  autoFocus
                />
              </div>
              {amountDelta !== 0 && payForm.amount && (
                <p className={clsx(
                  'mt-1 text-xs font-medium',
                  amountDelta > 0 ? 'text-red-500' : 'text-emerald-600'
                )}>
                  {amountDelta > 0
                    ? `↑ เพิ่ม ฿${fmt(amountDelta)} จากปกติ`
                    : `↓ ลด ฿${fmt(-amountDelta)} จากปกติ`}
                </p>
              )}

              {/* Quick adjust buttons */}
              <div className="flex gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => setPayForm(p => ({ ...p, amount: String(payTarget.amount) }))}
                  className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  ปกติ ฿{fmt(payTarget.amount)}
                </button>
                {[100, 500, 1000].map(d => (
                  <div key={d} className="flex">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(payForm.amount) || 0
                        setPayForm(p => ({ ...p, amount: String(Math.max(0, cur - d)) }))
                      }}
                      className="px-2 py-1.5 text-xs rounded-l-lg border border-r-0 border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      −{d}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseFloat(payForm.amount) || 0
                        setPayForm(p => ({ ...p, amount: String(cur + d) }))
                      }}
                      className="px-2 py-1.5 text-xs rounded-r-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      +{d}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่จ่าย</label>
              <input
                type="date"
                value={payForm.date}
                onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl"
              />
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ (ไม่บังคับ)</label>
              <input
                type="text"
                value={payForm.note}
                onChange={e => setPayForm(p => ({ ...p, note: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
                placeholder="เช่น ค่าไฟเดือนนี้สูงเพราะใช้แอร์เยอะ"
                maxLength={500}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setPayTarget(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmPay}
                disabled={busyId === payTarget.id || !parseFloat(payForm.amount)}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {busyId === payTarget.id ? 'กำลังบันทึก...' : 'ยืนยันการชำระ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
