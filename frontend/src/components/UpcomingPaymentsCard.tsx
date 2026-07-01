import { useState } from 'react'
import { format, parseISO, differenceInCalendarDays, addMonths } from 'date-fns'
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

function nextMonthStr(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return format(addMonths(new Date(y, m - 1, 1), 1), 'yyyy-MM')
}

function daysFromToday(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return differenceInCalendarDays(parseISO(dateStr), today)
}

type Props = { month: string }

export default function UpcomingPaymentsCard({ month }: Props) {
  const nextMonth = nextMonthStr(month)
  const { data, isLoading } = useUpcomingPayments(month)
  const { data: nextData } = useUpcomingPayments(nextMonth)
  const pay = usePayRecurring()
  const unpay = useUnpayRecurring()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [payTarget, setPayTarget] = useState<{ item: UpcomingPaymentItem; targetMonth: string } | null>(null)
  const [payForm, setPayForm] = useState({ amount: '', date: '', note: '' })
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  function openPayModal(item: UpcomingPaymentItem, targetMonth: string) {
    setPayTarget({ item, targetMonth })
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
    setBusyId(payTarget.item.id)
    try {
      const itemName = payTarget.item.name
      await pay.mutateAsync({
        id: payTarget.item.id,
        month: payTarget.targetMonth,
        amount,
        date: payForm.date || undefined,
        note: payForm.note.trim() || undefined,
      })
      setPayTarget(null)
      setSuccessMsg(`✅ ชำระ "${itemName}" เรียบร้อย — เพิ่มเป็นรายจ่ายอัตโนมัติแล้ว`)
      setTimeout(() => setSuccessMsg(null), 4000)
    } finally {
      setBusyId(null)
    }
  }

  async function handleUnpay(item: UpcomingPaymentItem) {
    if (!confirm(`ยกเลิกการชำระ "${item.name}"?`)) return
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

  // Split current month: only show unpaid in list
  const unpaidItems = data.items.filter(i => i.status !== 'paid' && i.status !== 'skipped')
  const allPaid = unpaidItems.length === 0

  const pct = data.total_due ? Math.round((data.total_paid / data.total_due) * 100) : 0

  // Next month preview: items within notify_days_before window and not yet paid for next month
  const previewItems = (nextData?.items ?? []).filter(i => {
    if (i.status === 'paid' || i.status === 'skipped') return false
    const days = daysFromToday(i.due_date)
    return days >= 0 && days <= (i.notify_days_before ?? 3)
  })

  const amountDelta = (() => {
    if (!payTarget) return 0
    const a = parseFloat(payForm.amount)
    if (!a) return 0
    return a - payTarget.item.amount
  })()

  return (
    <>
      {successMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium whitespace-nowrap">
          {successMsg}
        </div>
      )}
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

        {/* All paid state */}
        {allPaid ? (
          <div className="text-center py-4">
            <p className="text-2xl mb-1">🎉</p>
            <p className="text-sm font-medium text-emerald-600">ชำระครบทุกบิลเดือนนี้แล้ว</p>
            <p className="text-xs text-gray-400 mt-0.5">รวม ฿{fmt(data.total_paid)}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {unpaidItems.map(item => {
              const isOverdue = item.status === 'overdue'
              const isBusy = busyId === item.id
              return (
                <div
                  key={item.id}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-xl border',
                    isOverdue ? 'bg-red-50/50 border-red-200' : 'bg-white border-gray-100'
                  )}
                >
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: `${item.category_color}20` }}
                  >
                    {item.category_icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-gray-900">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs">
                      <span className={isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}>
                        📅 {formatDueDate(item.due_date)}
                      </span>
                      {isOverdue && <span className="text-red-500 font-medium">เกินกำหนด</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">฿{fmt(item.amount)}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => openPayModal(item, month)}
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
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Next month preview */}
        {previewItems.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-400 mb-2">📋 บิลเดือนหน้าที่กำลังจะถึง</p>
            <div className="space-y-2">
              {previewItems.map(item => {
                const days = daysFromToday(item.due_date)
                const isBusy = busyId === item.id
                return (
                  <div key={`preview-${item.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-amber-100 bg-amber-50/40">
                    <span
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: `${item.category_color}20` }}
                    >
                      {item.category_icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-gray-800">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-amber-600">
                        <span>📅 {formatDueDate(item.due_date)}</span>
                        <span>· อีก {days} วัน</span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 flex-shrink-0">฿{fmt(item.amount)}</p>
                    <button
                      onClick={() => openPayModal(item, nextMonth)}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-xs rounded-lg font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 flex-shrink-0"
                    >
                      {isBusy ? '...' : 'จ่ายแล้ว'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pay modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">บันทึกการชำระ</h2>
              <button onClick={() => setPayTarget(null)} className="text-gray-400 text-xl">✕</button>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <span
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: `${payTarget.item.category_color}20` }}
              >
                {payTarget.item.category_icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{payTarget.item.name}</p>
                <p className="text-xs text-gray-400">
                  ครบกำหนด {formatDueDate(payTarget.item.due_date)} • บิลปกติ ฿{fmt(payTarget.item.amount)}
                  {payTarget.targetMonth !== month && (
                    <span className="ml-1 text-amber-600">(เดือนหน้า)</span>
                  )}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงินที่จ่ายจริง</label>
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
                <p className={clsx('mt-1 text-xs font-medium', amountDelta > 0 ? 'text-red-500' : 'text-emerald-600')}>
                  {amountDelta > 0
                    ? `↑ เพิ่ม ฿${fmt(amountDelta)} จากปกติ`
                    : `↓ ลด ฿${fmt(-amountDelta)} จากปกติ`}
                </p>
              )}
              <div className="flex gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => setPayForm(p => ({ ...p, amount: String(payTarget.item.amount) }))}
                  className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  ปกติ ฿{fmt(payTarget.item.amount)}
                </button>
                {[100, 500, 1000].map(d => (
                  <div key={d} className="flex">
                    <button
                      type="button"
                      onClick={() => setPayForm(p => ({ ...p, amount: String(Math.max(0, (parseFloat(p.amount) || 0) - d) ) }))}
                      className="px-2 py-1.5 text-xs rounded-l-lg border border-r-0 border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      −{d}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayForm(p => ({ ...p, amount: String((parseFloat(p.amount) || 0) + d) }))}
                      className="px-2 py-1.5 text-xs rounded-r-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      +{d}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่จ่าย</label>
              <input
                type="date"
                value={payForm.date}
                onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl"
              />
            </div>

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

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setPayTarget(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmPay}
                disabled={busyId === payTarget.item.id || !parseFloat(payForm.amount)}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {busyId === payTarget.item.id ? 'กำลังบันทึก...' : 'ยืนยันการชำระ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
