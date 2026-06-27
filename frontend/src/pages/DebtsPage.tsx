import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { useDebts, useDeleteDebt, useUnpayDebt, useRemindDebt } from '../hooks/useDebts'
import type { Debt } from '../types'
import { api } from '../api/client'
import DebtForm from '../components/DebtForm'
import PayDebtModal from '../components/PayDebtModal'

function formatAmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2 })
}

function formatDate(s: string) {
  return format(parseISO(s), 'd MMM yyyy', { locale: th })
}

function isOverdue(due_date: string | null) {
  if (!due_date) return false
  return new Date(due_date) < new Date(new Date().toISOString().slice(0, 10))
}

export default function DebtsPage() {
  const [tab, setTab] = useState<'pending' | 'paid'>('pending')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Debt | null>(null)
  const [paying, setPaying] = useState<Debt | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const { data, isLoading } = useDebts(tab)
  const deleteDebt = useDeleteDebt()
  const unpayDebt = useUnpayDebt()
  const remindDebt = useRemindDebt()

  const debts = data?.data ?? []

  async function handleDelete(id: number) {
    if (!confirm('ลบรายการนี้?')) return
    await deleteDebt.mutateAsync(id)
  }

  async function handleRemind(id: number) {
    const res = await remindDebt.mutateAsync(id)
    alert(res.sent > 0 ? `ส่งการแจ้งเตือนทาง LINE แล้ว (${res.sent} คน)` : 'ไม่มีผู้รับการแจ้งเตือน LINE')
  }

  const pendingCount = tab === 'pending' ? debts.length : undefined

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ทวงหนี้ / ค้างชำระ</h1>
          <p className="text-sm text-gray-500 mt-0.5">จัดการรายการหนี้และการชำระเงิน</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 text-sm"
        >
          <span>+</span> เพิ่มรายการ
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 bg-gray-100 p-1 rounded-xl">
        {(['pending', 'paid'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'pending' ? '⏳ ค้างชำระ' : '✅ ชำระแล้ว'}
            {t === 'pending' && pendingCount != null && pendingCount > 0 && (
              <span className="ml-1.5 bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400 animate-pulse">กำลังโหลด...</div>
      ) : debts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">{tab === 'pending' ? '🎉' : '📋'}</p>
          <p className="text-sm">{tab === 'pending' ? 'ไม่มีรายการค้างชำระ' : 'ยังไม่มีรายการที่ชำระแล้ว'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {debts.map(debt => {
            const overdue = tab === 'pending' && isOverdue(debt.due_date)
            return (
              <div key={debt.id} className={`bg-white rounded-2xl border p-4 shadow-sm ${overdue ? 'border-red-200' : 'border-gray-100'}`}>
                <div className="flex items-start gap-3">
                  {/* Invoice thumbnail or icon */}
                  <div className="flex-shrink-0">
                    {debt.invoice_key ? (
                      <button onClick={() => setLightboxUrl(api.getDebtInvoiceUrl(debt.id))}>
                        <img
                          src={api.getDebtInvoiceUrl(debt.id)}
                          alt="ใบแจ้งหนี้"
                          className="w-12 h-12 rounded-xl object-cover border border-gray-200 hover:opacity-80 transition-opacity cursor-zoom-in"
                        />
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-2xl">
                        🧾
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 truncate">{debt.debtor_name}</p>
                        {debt.member_name && (
                          <p className="text-xs text-gray-400">{debt.member_emoji} {debt.member_name}</p>
                        )}
                      </div>
                      <p className="font-bold text-lg text-indigo-600 flex-shrink-0">฿{formatAmt(debt.amount)}</p>
                    </div>

                    {/* Due date & status */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {debt.due_date && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${overdue ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                          {overdue ? '🚨 เกินกำหนด' : '📅'} {formatDate(debt.due_date)}
                        </span>
                      )}
                      {tab === 'paid' && debt.paid_at && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          ✅ ชำระ {formatDate(debt.paid_at)}
                        </span>
                      )}
                      {tab === 'paid' && debt.expense_id && (
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                          📊 บันทึกรายจ่ายแล้ว
                        </span>
                      )}
                      {debt.slip_key && (
                        <button
                          onClick={() => setLightboxUrl(api.getDebtSlipUrl(debt.id))}
                          className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-100"
                        >
                          🧾 ดูสลิ๊ป
                        </button>
                      )}
                    </div>

                    {debt.description && (
                      <p className="text-xs text-gray-400 mt-1 truncate">{debt.description}</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                  {tab === 'pending' && (
                    <>
                      <button
                        onClick={() => setPaying(debt)}
                        className="flex-1 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600"
                      >
                        ✅ ชำระแล้ว
                      </button>
                      <button
                        onClick={() => handleRemind(debt.id)}
                        disabled={remindDebt.isPending}
                        className="py-1.5 px-3 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-medium hover:bg-yellow-100 border border-yellow-200"
                      >
                        🔔 LINE
                      </button>
                    </>
                  )}
                  {tab === 'paid' && (
                    <button
                      onClick={() => unpayDebt.mutate(debt.id)}
                      className="py-1.5 px-3 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200"
                    >
                      ↩ ยกเลิกการชำระ
                    </button>
                  )}
                  <button
                    onClick={() => setEditing(debt)}
                    className="py-1.5 px-3 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => handleDelete(debt.id)}
                    className="py-1.5 px-3 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">เพิ่มรายการทวงหนี้</h2>
              <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <DebtForm onClose={() => setCreating(false)} />
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">แก้ไขรายการ</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <DebtForm debt={editing} onClose={() => setEditing(null)} />
          </div>
        </div>
      )}

      {/* Pay modal */}
      {paying && <PayDebtModal debt={paying} onClose={() => setPaying(null)} />}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
          <button type="button" onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 bg-white/90 rounded-full w-9 h-9 flex items-center justify-center text-gray-600 hover:text-red-500 border border-gray-200 shadow text-lg">✕</button>
        </div>
      )}
    </div>
  )
}
