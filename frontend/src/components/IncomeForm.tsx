import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { format } from 'date-fns'
import { useIncomeCategories, useCreateIncome, useUpdateIncome } from '../hooks/useIncomes'
import { useMembers } from '../hooks/useExpenses'
import type { Income, IncomeFormData } from '../types'
import clsx from 'clsx'

type Props = {
  income?: Income
  onClose: () => void
}

export default function IncomeForm({ income, onClose }: Props) {
  const { data: categories = [] } = useIncomeCategories()
  const { data: members = [] } = useMembers()
  const create = useCreateIncome()
  const update = useUpdateIncome()

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<IncomeFormData>({
    defaultValues: {
      amount: income?.amount ?? 0,
      date: income?.date ?? format(new Date(), 'yyyy-MM-dd'),
      category_id: income?.category_id ?? 0,
      member_id: income?.member_id ?? null,
      note: income?.note ?? '',
    },
  })

  useEffect(() => {
    if (income) reset({ ...income, note: income.note ?? '' })
  }, [income, reset])

  async function onSubmit(data: IncomeFormData) {
    const payload = { ...data, amount: Number(data.amount), category_id: Number(data.category_id) }
    if (income) {
      await update.mutateAsync({ id: income.id, data: payload })
    } else {
      await create.mutateAsync(payload)
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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 font-medium">+฿</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            {...register('amount', { required: true, min: 0.01, valueAsNumber: true })}
            className={clsx(
              'w-full pl-10 pr-4 py-2.5 border rounded-xl text-right text-lg font-semibold',
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
        <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทรายรับ</label>
        <Controller
          name="category_id"
          control={control}
          rules={{ required: true, min: 1 }}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => field.onChange(cat.id)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors',
                    Number(field.value) === cat.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* Member */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ใครได้รับ</label>
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
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
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
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
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

      {/* Note */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ (ไม่บังคับ)</label>
        <input
          type="text"
          {...register('note')}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl"
          placeholder="เช่น เงินเดือนเดือนนี้, OT, ค่าคอมฯ"
        />
      </div>

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
          className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-60"
        >
          {isPending ? 'กำลังบันทึก...' : income ? 'บันทึกการแก้ไข' : 'บันทึก'}
        </button>
      </div>
    </form>
  )
}
