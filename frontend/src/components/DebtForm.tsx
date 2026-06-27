import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import type { Debt, DebtFormData } from '../types'
import { PAYMENT_METHODS } from '../types'
import { useCreateDebt, useUpdateDebt } from '../hooks/useDebts'
import { useMembers } from '../hooks/useExpenses'
import { useCategories } from '../hooks/useCategories'
import { api } from '../api/client'

type Props = {
  debt?: Debt
  onClose: () => void
}

export default function DebtForm({ debt, onClose }: Props) {
  const { data: members = [] } = useMembers()
  const { data: categoriesTree = [] } = useCategories()
  const allCategories = categoriesTree.flatMap(p => [p, ...(p.children ?? [])])
  const create = useCreateDebt()
  const update = useUpdateDebt()
  const invoiceRef = useRef<HTMLInputElement>(null)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoicePreview, setInvoicePreview] = useState<string | null>(
    debt?.invoice_key ? api.getDebtInvoiceUrl(debt.id) : null
  )
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<DebtFormData>({
    defaultValues: {
      debtor_name: debt?.debtor_name ?? '',
      amount: debt?.amount ?? 0,
      due_date: debt?.due_date ?? format(new Date(), 'yyyy-MM-dd'),
      description: debt?.description ?? '',
      member_id: debt?.member_id ?? null,
      category_id: debt?.category_id ?? null,
      payment_method: debt?.payment_method ?? 'transfer',
    },
  })

  function handleInvoiceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setUploadError('ไฟล์ใหญ่เกิน 10 MB'); return }
    setUploadError(null)
    setInvoiceFile(file)
    setInvoicePreview(URL.createObjectURL(file))
  }

  function clearInvoice() {
    setInvoiceFile(null)
    setInvoicePreview(null)
    if (invoiceRef.current) invoiceRef.current.value = ''
  }

  async function onSubmit(data: DebtFormData) {
    setUploadError(null)
    const payload = {
      ...data,
      amount: Number(data.amount),
      member_id: data.member_id ? Number(data.member_id) : null,
      category_id: data.category_id ? Number(data.category_id) : null,
    }
    let debtId: number

    if (debt) {
      await update.mutateAsync({ id: debt.id, data: payload })
      debtId = debt.id
    } else {
      const res = await create.mutateAsync(payload)
      debtId = res.id
    }

    if (invoiceFile) {
      try {
        await api.uploadDebtInvoice(debtId, invoiceFile)
      } catch (e) {
        setUploadError(`อัปโหลดใบแจ้งหนี้ไม่สำเร็จ: ${(e as Error).message}`)
        return
      }
    }

    onClose()
  }

  const isPending = create.isPending || update.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Debtor name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อลูกหนี้ / ผู้ค้างชำระ</label>
        <input
          {...register('debtor_name', { required: 'กรุณาระบุชื่อ' })}
          placeholder="ชื่อลูกหนี้..."
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        {errors.debtor_name && <p className="mt-1 text-xs text-red-500">{errors.debtor_name.message}</p>}
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน (บาท)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">฿</span>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('amount', { required: 'กรุณาระบุจำนวน', min: { value: 0.01, message: 'ต้องมากกว่า 0' } })}
            className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
      </div>

      {/* Due date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">วันครบกำหนด (ไม่บังคับ)</label>
        <input
          type="date"
          {...register('due_date')}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      {/* Category — used for auto-creating expense on payment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่รายจ่าย (สำหรับบันทึกรายจ่ายเมื่อชำระ)</label>
        <select
          {...register('category_id')}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        >
          <option value="">ไม่ระบุ (ไม่บันทึกรายจ่าย)</option>
          {allCategories.map(c => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}{c.parent_id ? '' : ' ▸'}
            </option>
          ))}
        </select>
      </div>

      {/* Payment method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">วิธีชำระเงิน</label>
        <div className="grid grid-cols-4 gap-2">
          {PAYMENT_METHODS.map(m => (
            <label key={m.value} className="relative">
              <input type="radio" value={m.value} {...register('payment_method')} className="sr-only peer" />
              <div className="flex flex-col items-center gap-0.5 p-2 rounded-xl border-2 border-gray-200 peer-checked:border-indigo-500 peer-checked:bg-indigo-50 cursor-pointer transition-colors">
                <span className="text-xl">{m.icon}</span>
                <span className="text-xs text-gray-600">{m.label}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Member */}
      {members.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ผู้รับเงิน (ไม่บังคับ)</label>
          <select
            {...register('member_id')}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">ไม่ระบุ</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด (ไม่บังคับ)</label>
        <textarea
          {...register('description')}
          rows={2}
          placeholder="รายละเอียดหนี้..."
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
        />
      </div>

      {/* Invoice image */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ใบแจ้งหนี้ / หลักฐาน (ไม่บังคับ)</label>
        {invoicePreview ? (
          <div className="relative w-full">
            <img
              src={invoicePreview}
              alt="ใบแจ้งหนี้"
              onClick={() => setLightboxOpen(true)}
              className="w-full max-h-48 object-contain rounded-xl border border-gray-200 bg-gray-50 cursor-zoom-in"
            />
            <button
              type="button"
              onClick={clearInvoice}
              className="absolute top-2 right-2 bg-white/90 rounded-full w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-500 border border-gray-200 shadow-sm text-sm"
            >✕</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => invoiceRef.current?.click()}
            className="w-full py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors flex flex-col items-center gap-1"
          >
            <span className="text-2xl">🧾</span>
            <span className="text-xs">แตะเพื่อเลือกรูปใบแจ้งหนี้</span>
          </button>
        )}
        <input ref={invoiceRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={handleInvoiceChange} className="hidden" />
        {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50">
          ยกเลิก
        </button>
        <button type="submit" disabled={isPending} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-60">
          {isPending ? 'กำลังบันทึก...' : debt ? 'บันทึกการแก้ไข' : 'บันทึก'}
        </button>
      </div>

      {lightboxOpen && invoicePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxOpen(false)}>
          <img src={invoicePreview} alt="ใบแจ้งหนี้" className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
          <button type="button" onClick={() => setLightboxOpen(false)} className="absolute top-4 right-4 bg-white/90 rounded-full w-9 h-9 flex items-center justify-center text-gray-600 hover:text-red-500 border border-gray-200 shadow text-lg">✕</button>
        </div>
      )}
    </form>
  )
}
