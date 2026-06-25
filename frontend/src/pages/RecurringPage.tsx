import { useState } from 'react'
import { format } from 'date-fns'
import { useRecurring, useDeleteRecurring, useUpdateRecurring } from '../hooks/useRecurring'
import UpcomingPaymentsCard from '../components/UpcomingPaymentsCard'
import RecurringForm from '../components/RecurringForm'
import type { RecurringPayment } from '../types'
import { api } from '../api/client'
import clsx from 'clsx'

function fmt(n: number) {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

export default function RecurringPage() {
  const [month] = useState(format(new Date(), 'yyyy-MM'))
  const [editing, setEditing] = useState<RecurringPayment | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [testStatus, setTestStatus] = useState<{ msg: string; ok: boolean } | null>(null)

  const { data: recurring = [], isLoading } = useRecurring()
  const remove = useDeleteRecurring()
  const update = useUpdateRecurring()

  async function handleDelete(r: RecurringPayment) {
    if (!confirm(`ลบ "${r.name}"? (จะลบ log การจ่ายทั้งหมด)`)) return
    await remove.mutateAsync(r.id)
  }

  async function toggleActive(r: RecurringPayment) {
    await update.mutateAsync({ id: r.id, data: { is_active: !r.is_active } })
  }

  async function testReminder() {
    setTestStatus(null)
    try {
      const res = await api.checkRecurringNow()
      setTestStatus({
        msg: `ตรวจสอบเรียบร้อย — ส่ง LINE ${res.messages_sent} ข้อความ (${res.users_processed} households)`,
        ok: true,
      })
    } catch (e) {
      setTestStatus({ msg: (e as Error).message, ok: false })
    }
  }

  const active = recurring.filter(r => r.is_active === 1)
  const inactive = recurring.filter(r => r.is_active === 0)
  const monthlyTotal = active.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">บิลรายเดือน</h1>
          <p className="text-gray-500 text-sm mt-0.5">รายการที่ต้องชำระทุกเดือน พร้อมแจ้งเตือนทาง LINE</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowAdd(true) }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-700 shadow-sm"
        >
          <span className="text-lg">+</span> เพิ่มบิล
        </button>
      </div>

      {/* Summary */}
      {active.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-5 border border-indigo-100">
          <p className="text-sm text-indigo-700">บิลที่เปิดใช้งาน</p>
          <div className="flex items-end justify-between mt-1">
            <p className="text-3xl font-bold text-gray-900">฿{fmt(monthlyTotal)}</p>
            <p className="text-sm text-gray-500">{active.length} รายการ/เดือน</p>
          </div>
        </div>
      )}

      {/* Upcoming */}
      <UpcomingPaymentsCard month={month} />

      {/* Recurring list */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">รายการบิลทั้งหมด</h2>

        {isLoading ? (
          <div className="text-center py-8 text-gray-400 animate-pulse">กำลังโหลด...</div>
        ) : recurring.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-2">📋</p>
            <p className="text-sm">ยังไม่มีบิลรายเดือน</p>
            <p className="text-xs mt-1">แตะ "+ เพิ่มบิล" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...active, ...inactive].map(r => (
              <div
                key={r.id}
                className={clsx(
                  'flex items-center gap-3 p-3 rounded-xl border',
                  r.is_active ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'
                )}
              >
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: `${r.category_color}20` }}
                >
                  {r.category_icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span>ทุกวันที่ {r.due_day}</span>
                    <span>•</span>
                    <span>{r.category_name}</span>
                    {r.member_name && <><span>•</span><span>{r.member_emoji} {r.member_name}</span></>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-900">฿{fmt(r.amount)}</p>
                  <p className="text-xs text-gray-400">แจ้งล่วงหน้า {r.notify_days_before} วัน</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleActive(r)}
                    className={clsx(
                      'p-2 rounded-lg text-xs',
                      r.is_active ? 'hover:bg-amber-50 text-gray-400 hover:text-amber-600' : 'hover:bg-emerald-50 text-gray-400 hover:text-emerald-600'
                    )}
                    title={r.is_active ? 'หยุดแจ้งเตือนชั่วคราว' : 'เปิดใช้งาน'}
                  >
                    {r.is_active ? '⏸️' : '▶️'}
                  </button>
                  <button
                    onClick={() => { setEditing(r); setShowAdd(false) }}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(r)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test LINE reminder */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">ทดสอบแจ้งเตือน LINE</h2>
            <p className="text-xs text-gray-400 mt-0.5">รัน cron ทันที (ปกติทำงานทุก 9:00 น.)</p>
          </div>
          <button
            onClick={testReminder}
            className="px-4 py-2 border border-green-500 text-green-600 rounded-xl text-sm font-medium hover:bg-green-50"
          >
            ▶️ ทดสอบ
          </button>
        </div>
        {testStatus && (
          <div className={clsx(
            'mt-3 p-3 rounded-xl text-sm',
            testStatus.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          )}>
            {testStatus.ok ? '✅ ' : '❌ '}{testStatus.msg}
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {(showAdd || editing) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'แก้ไขบิลรายเดือน' : 'เพิ่มบิลรายเดือน'}
              </h2>
              <button onClick={() => { setShowAdd(false); setEditing(null) }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <RecurringForm
              recurring={editing ?? undefined}
              onClose={() => { setShowAdd(false); setEditing(null) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
