import type { CategorySummary } from '../types'
import clsx from 'clsx'

type Props = {
  category: CategorySummary
}

function fmt(n: number) {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

export default function BudgetCard({ category }: Props) {
  const pct = Math.min(category.percentage, 100)
  const isOver = category.spent > category.budget && category.budget > 0
  const isNearLimit = pct >= 80 && !isOver

  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{ backgroundColor: `${category.category_color}20` }}
          >
            {category.category_icon}
          </span>
          <span className="text-sm font-medium text-gray-800">{category.category_name}</span>
        </div>
        <div className="text-right">
          <span className={clsx('text-sm font-semibold', isOver ? 'text-red-600' : 'text-gray-900')}>
            ฿{fmt(category.spent)}
          </span>
          {category.budget > 0 && (
            <span className="text-xs text-gray-400 ml-1">/ ฿{fmt(category.budget)}</span>
          )}
        </div>
      </div>

      {category.budget > 0 ? (
        <>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all',
                isOver ? 'bg-red-500' : isNearLimit ? 'bg-amber-400' : 'bg-indigo-500'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className={clsx('text-xs', isOver ? 'text-red-500' : 'text-gray-400')}>
              {isOver ? `เกินงบ ฿${fmt(category.spent - category.budget)}` : `${pct}%`}
            </span>
            <span className="text-xs text-gray-400">
              เหลือ ฿{fmt(Math.max(0, category.budget - category.spent))}
            </span>
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-400 mt-1">ยังไม่ได้ตั้งงบประมาณ</p>
      )}
    </div>
  )
}
