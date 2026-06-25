import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useCategories } from '../hooks/useCategories'
import { useMembers } from '../hooks/useExpenses'
import { useCreateRecurring, useUpdateRecurring } from '../hooks/useRecurring'
import type { RecurringPayment, RecurringFormData } from '../types'
import { PAYMENT_METHODS } from '../types'
import clsx from 'clsx'

type Props = {
  recurring?: RecurringPayment
  onClose: () => void
}

export default function RecurringForm({ recurring, onClose }: Props) {
  const { data: categoriesTree = [] } = useCategories()
  const { data: members = [] } = useMembers()
  const create = useCreateRecurring()
  const update = useUpdateRecurring()

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<RecurringFormData>({
    defaultValues: {
      name: recurring?.name ?? '',
      amount: recurring?.amount ?? 0,
      category_id: recurring?.category_id ?? 0,
      due_day: recurring?.due_day ?? 1,
      member_id: recurring?.member_id ?? null,
      payment_method: recurring?.payment_method ?? 'transfer',
      notify_days_before: recurring?.notify_days_before ?? 3,
      is_active: recurring ? !!recurring.is_active : true,
    },
  })

  useEffect(() => { if (recurring) reset({ ...recurring, is_active: !!recurring.is_active }) }, [recurring, reset])

  async function onSubmit(data: RecurringFormData) {
    const payload = {
      ...data,
      amount: Number(data.amount),
      category_id: Number(data.category_id),
      due_day: Number(data.due_day),
      notify_days_before: Number(data.notify_days_before),
    }
    if (recurring) {
      await update.mutateAsync({ id: recurring.id, data: payload })
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  const isPending = create.isPending || update.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อบิล</label>
        <input
          type="text"
          {...register('name', { required: true, minLength: 1 })}
          className={clsx(
            'w-full px-3 py-2.5 border rounded-xl',
            errors.name ? 'border-red-300' : 'border-gray-300'
          )}
          placeholder="เช่น ค่าผ่อนคอนโด, 3BB Internet"
          maxLength={100}
        />
      </div>

      {/* Amount + Due day */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">฿</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              {...register('amount', { required: true, min: 0.01, valueAsNumber: true })}
              className={clsx(
                'w-full pl-7 pr-3 py-2.5 border rounded-xl text-right font-semibold',
                errors.amount ? 'border-red-300' : 'border-gray-300'
              )}
              placeholder="0.00"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ครบกำหนด</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">ทุกวันที่</span>
            <input
              type="number"
              min="1"
              max="31"
              {...register('due_day', { required: true, min: 1, max: 31, valueAsNumber: true })}
              className={clsx(
                'flex-1 px-3 py-2.5 border rounded-xl text-center font-semibold',
                errors.due_day ? 'border-red-300' : 'border-gray-300'
              )}
            />
          </div>
        </div>
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
                        <option key={child.id} value={child.id}>{child.icon} {child.name}</option>
                      ))
                    : <option value={parent.id}>{parent.icon} {parent.name}</option>
                  }
                </optgroup>
              ))}
            </select>
          )}
        />
      </div>

      {/* Payment method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ช่องทางชำระ</label>
        <div className="grid grid-cols-4 gap-2">
          {PAYMENT_METHODS.map(pm => (
            <label key={pm.value} className="cursor-pointer">
              <input type="radio" value={pm.value} {...register('payment_method')} className="sr-only" />
              <div className={clsx(
                'flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs text-center',
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

      {/* Member */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ผู้รับผิดชอบ (ไม่บังคับ)</label>
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

      {/* Notify days before */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">แจ้งเตือนล่วงหน้า (วัน)</label>
        <div className="flex gap-2">
          {[0, 1, 3, 5, 7].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => reset({ ...watch(), notify_days_before: d })}
              className={clsx(
                'px-3 py-1.5 rounded-lg border text-sm flex-1',
                Number(watch('notify_days_before')) === d
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              {d === 0 ? 'วันนั้น' : `${d} วัน`}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-gray-400">ส่ง LINE แจ้งเตือนก่อนถึงวันครบกำหนด</p>
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-800">เปิดใช้งาน</p>
          <p className="text-xs text-gray-500">ปิดเพื่อหยุดแจ้งเตือนชั่วคราว</p>
        </div>
        <Controller
          name="is_active"
          control={control}
          render={({ field }) => (
            <button
              type="button"
              onClick={() => field.onChange(!field.value)}
              className={clsx(
                'relative w-11 h-6 rounded-full transition-colors',
                field.value ? 'bg-indigo-600' : 'bg-gray-300'
              )}
            >
              <span className={clsx(
                'absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transform transition-transform',
                field.value && 'translate-x-5'
              )} />
            </button>
          )}
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
          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? 'กำลังบันทึก...' : recurring ? 'บันทึกการแก้ไข' : 'เพิ่มบิลรายเดือน'}
        </button>
      </div>
    </form>
  )
}
