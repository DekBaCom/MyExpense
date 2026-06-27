import { useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import type { Debt } from '../types'
import { useQueryClient } from '@tanstack/react-query'
import { useCategories } from '../hooks/useCategories'
import { api } from '../api/client'

type Props = {
  debt: Debt
  onClose: () => void
}

function fmt(n: number) {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

export default function PayDebtModal({ debt, onClose }: Props) {
  const qc = useQueryClient()
  const { data: categoriesTree = [] } = useCategories()
  const allCategories = categoriesTree.flatMap(p => [p, ...(p.children ?? [])])

  const slipRef = useRef<HTMLInputElement>(null)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [amount, setAmount] = useState(String(debt.amount))
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = useState('')
  const [categoryId, setCategoryId] = useState<string>(debt.category_id ? String(debt.category_id) : '')

  function handleSlipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('ไฟล์ใหญ่เกิน 10 MB'); return }
    setError(null)
    setSlipFile(file)
    setSlipPreview(URL.createObjectURL(file))
  }

  async function handleConfirm() {
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) { setError('กรุณาระบุจำนวนเงิน'); return }
    setIsPending(true)
    setError(null)
    try {
      const opts = {
        amount: parsedAmount,
        date: date || undefined,
        note: note.trim() || undefined,
        category_id: categoryId ? Number(categoryId) : null,
      }
      if (slipFile) {
        await api.uploadDebtSlip(debt.id, slipFile, opts)
      } else {
        await api.payDebt(debt.id, opts)
      }
      qc.invalidateQueries({ queryKey: ['debts'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsPending(false)
    }
  }

  const amountDelta = (() => {
    const a = parseFloat(amount)
    if (!a) return 0
    return a - debt.amount
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">บันทึกการชำระหนี้</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>

        {/* Debt summary */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">ลูกหนี้</span>
            <span className="font-medium text-gray-900">{debt.debtor_name}</span>
          </div>
          {debt.due_date && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">วันครบกำหนด</span>
              <span className="text-gray-700">{format(parseISO(debt.due_date), 'd MMM yyyy', { locale: th })}</span>
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงินที่จ่ายจริง</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">฿</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-xl text-right text-xl font-bold"
              autoFocus
            />
          </div>
          {amountDelta !== 0 && amount && (
            <p className={`mt-1 text-xs font-medium ${amountDelta > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {amountDelta > 0
                ? `↑ เพิ่ม ฿${fmt(amountDelta)} จากยอดหนี้`
                : `↓ ลด ฿${fmt(-amountDelta)} จากยอดหนี้`}
            </p>
          )}
          <div className="flex gap-1.5 mt-2">
            <button
              type="button"
              onClick={() => setAmount(String(debt.amount))}
              className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              ยอดหนี้ ฿{fmt(debt.amount)}
            </button>
            {[100, 500, 1000].map(d => (
              <div key={d} className="flex">
                <button
                  type="button"
                  onClick={() => setAmount(p => String(Math.max(0, (parseFloat(p) || 0) - d)))}
                  className="px-2 py-1.5 text-xs rounded-l-lg border border-r-0 border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  −{d}
                </button>
                <button
                  type="button"
                  onClick={() => setAmount(p => String((parseFloat(p) || 0) + d))}
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
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl"
          />
        </div>

        {/* Category — always show so user can pick category at payment time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            หมวดหมู่รายจ่าย
            {categoryId
              ? <span className="ml-1 text-xs text-emerald-600 font-normal">✓ จะบันทึกเป็นรายจ่าย</span>
              : <span className="ml-1 text-xs text-gray-400 font-normal">(ไม่เลือก = ไม่บันทึกรายจ่าย)</span>
            }
          </label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="">ไม่บันทึกเป็นรายจ่าย</option>
            {allCategories.map(c => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}{c.parent_id ? '' : ' ▸'}
              </option>
            ))}
          </select>
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ (ไม่บังคับ)</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
            placeholder="หมายเหตุ..."
            maxLength={500}
          />
        </div>

        {/* Slip upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">อัปโหลดสลิ๊ป (ไม่บังคับ)</label>
          {slipPreview ? (
            <div className="relative w-full">
              <img src={slipPreview} alt="สลิ๊ป" onClick={() => setLightboxOpen(true)} className="w-full max-h-40 object-contain rounded-xl border border-gray-200 bg-gray-50 cursor-zoom-in" />
              <button type="button" onClick={() => { setSlipFile(null); setSlipPreview(null); if (slipRef.current) slipRef.current.value = '' }}
                className="absolute top-2 right-2 bg-white/90 rounded-full w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-500 border border-gray-200 shadow-sm text-sm">✕</button>
            </div>
          ) : (
            <button type="button" onClick={() => slipRef.current?.click()}
              className="w-full py-5 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-green-300 hover:text-green-500 transition-colors flex flex-col items-center gap-1">
              <span className="text-2xl">📸</span>
              <span className="text-xs">แตะเพื่อเลือกรูปสลิ๊ป</span>
            </button>
          )}
          <input ref={slipRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={handleSlipChange} className="hidden" />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-3 pb-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50">ยกเลิก</button>
          <button type="button" onClick={handleConfirm} disabled={isPending || !parseFloat(amount)}
            className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-60">
            {isPending ? 'กำลังบันทึก...' : 'ยืนยันชำระแล้ว'}
          </button>
        </div>
      </div>

      {lightboxOpen && slipPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxOpen(false)}>
          <img src={slipPreview} alt="สลิ๊ป" className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
          <button type="button" onClick={() => setLightboxOpen(false)} className="absolute top-4 right-4 bg-white/90 rounded-full w-9 h-9 flex items-center justify-center text-gray-600 hover:text-red-500 border border-gray-200 shadow text-lg">✕</button>
        </div>
      )}
    </div>
  )
}
