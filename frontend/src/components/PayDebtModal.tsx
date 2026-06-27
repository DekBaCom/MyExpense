import { useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import type { Debt } from '../types'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

type Props = {
  debt: Debt
  onClose: () => void
}

export default function PayDebtModal({ debt, onClose }: Props) {
  const qc = useQueryClient()
  const slipRef = useRef<HTMLInputElement>(null)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  function handleSlipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('ไฟล์ใหญ่เกิน 10 MB'); return }
    setError(null)
    setSlipFile(file)
    setSlipPreview(URL.createObjectURL(file))
  }

  async function handleConfirm() {
    setIsPending(true)
    setError(null)
    try {
      if (slipFile) {
        await api.uploadDebtSlip(debt.id, slipFile)
      } else {
        await api.payDebt(debt.id)
      }
      qc.invalidateQueries({ queryKey: ['debts'] })
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsPending(false)
    }
  }

  const amountStr = debt.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
        <div className="text-center">
          <div className="text-4xl mb-2">✅</div>
          <h2 className="text-lg font-semibold text-gray-900">ยืนยันการชำระหนี้</h2>
        </div>

        {/* Debt summary */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">ลูกหนี้</span>
            <span className="font-medium text-gray-900">{debt.debtor_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">จำนวนเงิน</span>
            <span className="font-semibold text-indigo-600">฿{amountStr}</span>
          </div>
          {debt.due_date && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">วันครบกำหนด</span>
              <span className="text-gray-700">{format(parseISO(debt.due_date), 'd MMM yyyy', { locale: th })}</span>
            </div>
          )}
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

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50">ยกเลิก</button>
          <button type="button" onClick={handleConfirm} disabled={isPending}
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
