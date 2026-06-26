import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { format } from 'date-fns'
import { useCategories } from '../hooks/useCategories'
import { useMembers } from '../hooks/useExpenses'
import { useCreateExpense, useUpdateExpense } from '../hooks/useExpenses'
import type { Expense, ExpenseFormData } from '../types'
import { PAYMENT_METHODS } from '../types'
import { api } from '../api/client'
import clsx from 'clsx'

type Props = {
  expense?: Expense
  onClose: () => void
}

export default function ExpenseForm({ expense, onClose }: Props) {
  const { data: categoriesTree = [] } = useCategories()
  const { data: members = [] } = useMembers()
  const create = useCreateExpense()
  const update = useUpdateExpense()
  const fileRef = useRef<HTMLInputElement>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(
    expense?.receipt_key ? api.getReceiptUrl(expense.id) : null
  )
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<ExpenseFormData>({
    defaultValues: {
      amount: expense?.amount ?? 0,
      date: expense?.date ?? format(new Date(), 'yyyy-MM-dd'),
      category_id: expense?.category_id ?? 0,
      member_id: expense?.member_id ?? null,
      payment_method: expense?.payment_method ?? 'cash',
      note: expense?.note ?? '',
    },
  })

  useEffect(() => { if (expense) reset({ ...expense, note: expense.note ?? '' }) }, [expense, reset])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('ไฟล์ใหญ่เกิน 10 MB')
      return
    }
    setUploadError(null)
    setReceiptFile(file)
    setReceiptPreview(URL.createObjectURL(file))
  }

  function clearReceipt() {
    setReceiptFile(null)
    setReceiptPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const selectedCategoryId = watch('category_id')
  const allCategories = categoriesTree.flatMap(p => [p, ...(p.children ?? [])])
  const selectedCategory = allCategories.find(c => c.id === Number(selectedCategoryId))

  async function onSubmit(data: ExpenseFormData) {
    setUploadError(null)
    const payload = { ...data, amount: Number(data.amount), category_id: Number(data.category_id) }
    let expenseId: number

    if (expense) {
      await update.mutateAsync({ id: expense.id, data: payload })
      expenseId = expense.id
    } else {
      const res = await create.mutateAsync(payload)
      expenseId = res.id
    }

    // Upload receipt if selected
    if (receiptFile) {
      try {
        await api.uploadReceipt(expenseId, receiptFile)
      } catch (e) {
        setUploadError(`อัปโหลดใบเสร็จไม่สำเร็จ: ${(e as Error).message}`)
        return
      }
    }

    onClose()
  }

  const isPending = create.isPending || update.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน (บาท)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">฿</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            {...register('amount', { required: true, min: 0.01, valueAsNumber: true })}
            className={clsx(
              'w-full pl-8 pr-4 py-2.5 border rounded-xl text-right text-lg font-semibold',
              errors.amount ? 'border-red-300' : 'border-gray-300'
            )}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
        <input
          type="date"
          {...register('date', { required: true })}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่</label>
        <Controller
          name="category_id"
          control={control}
          rules={{ required: true, min: 1 }}
          render={({ field }) => (
            <select
              {...field}
              onChange={e => field.onChange(Number(e.target.value))}
              className={clsx(
                'w-full px-3 py-2.5 border rounded-xl',
                errors.category_id ? 'border-red-300' : 'border-gray-300'
              )}
            >
              <option value="0">-- เลือกหมวดหมู่ --</option>
              {categoriesTree.map(parent => (
                <optgroup key={parent.id} label={`${parent.icon} ${parent.name}`}>
                  {(parent.children ?? []).length > 0
                    ? (parent.children ?? []).map(child => (
                        <option key={child.id} value={child.id}>
                          {child.icon} {child.name}
                        </option>
                      ))
                    : <option value={parent.id}>{parent.icon} {parent.name}</option>
                  }
                </optgroup>
              ))}
            </select>
          )}
        />
        {selectedCategory && (
          <p className="mt-1 text-xs text-gray-500">
            <span>{selectedCategory.icon}</span> {selectedCategory.name}
          </p>
        )}
      </div>

      {/* Member */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ใครจ่าย</label>
        <div className="flex gap-2 flex-wrap">
          <Controller
            name="member_id"
            control={control}
            render={({ field }) => (
              <>
                <button
                  type="button"
                  onClick={() => field.onChange(null)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg border text-sm',
                    field.value === null
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  ไม่ระบุ
                </button>
                {members.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => field.onChange(m.id)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1',
                      field.value === m.id
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    <span>{m.emoji}</span> {m.name}
                  </button>
                ))}
              </>
            )}
          />
        </div>
      </div>

      {/* Payment method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ช่องทางชำระ</label>
        <div className="grid grid-cols-4 gap-2">
          {PAYMENT_METHODS.map(pm => (
            <label key={pm.value} className="cursor-pointer">
              <input type="radio" value={pm.value} {...register('payment_method')} className="sr-only" />
              <div className={clsx(
                'flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs text-center transition-colors',
                watch('payment_method') === pm.value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}>
                <span className="text-xl">{pm.icon}</span>
                {pm.label}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Note */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ (ไม่บังคับ)</label>
        <input
          type="text"
          {...register('note')}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl"
          placeholder="เพิ่มรายละเอียด..."
        />
      </div>

      {/* Receipt */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ใบเสร็จ / รูปภาพ (ไม่บังคับ)</label>
        {receiptPreview ? (
          <div className="relative w-full">
            <img
              src={receiptPreview}
              alt="ใบเสร็จ"
              onClick={() => setLightboxOpen(true)}
              className="w-full max-h-48 object-contain rounded-xl border border-gray-200 bg-gray-50 cursor-zoom-in"
            />
            <button
              type="button"
              onClick={clearReceipt}
              className="absolute top-2 right-2 bg-white/90 rounded-full w-7 h-7 flex items-center justify-center text-gray-500 hover:text-red-500 border border-gray-200 shadow-sm text-sm"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors flex flex-col items-center gap-1"
          >
            <span className="text-2xl">📷</span>
            <span className="text-xs">แตะเพื่อเลือกรูป (JPEG, PNG, WebP)</span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          onChange={handleFileChange}
          className="hidden"
        />
        {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? 'กำลังบันทึก...' : expense ? 'บันทึกการแก้ไข' : 'บันทึก'}
        </button>
      </div>

      {lightboxOpen && receiptPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <img
            src={receiptPreview}
            alt="ใบเสร็จ"
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 bg-white/90 rounded-full w-9 h-9 flex items-center justify-center text-gray-600 hover:text-red-500 border border-gray-200 shadow text-lg"
          >
            ✕
          </button>
        </div>
      )}
    </form>
  )
}
