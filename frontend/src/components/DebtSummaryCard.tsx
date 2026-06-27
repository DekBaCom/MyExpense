import { Link } from 'react-router-dom'
import { useDebts } from '../hooks/useDebts'

function fmt(n: number) {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function isOverdue(due_date: string | null) {
  if (!due_date) return false
  return due_date < new Date().toISOString().slice(0, 10)
}

export default function DebtSummaryCard() {
  const { data, isLoading } = useDebts('pending')
  const debts = data?.data ?? []

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <div className="text-center py-4 text-gray-400 animate-pulse text-sm">กำลังโหลด...</div>
      </div>
    )
  }

  const totalAmount = debts.reduce((s, d) => s + d.amount, 0)
  const overdueDebts = debts.filter(d => isOverdue(d.due_date))
  const overdueCount = overdueDebts.length
  const overdueAmount = overdueDebts.reduce((s, d) => s + d.amount, 0)
  const previewDebts = debts.slice(0, 4)

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">💳</span>
          <h2 className="text-sm font-semibold text-gray-700">ยอดค้างชำระ</h2>
        </div>
        <Link to="/debts" className="text-xs text-indigo-600 hover:underline">จัดการ ›</Link>
      </div>

      {debts.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-sm text-emerald-600 font-medium">ไม่มียอดค้างชำระ</p>
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-2xl font-bold text-orange-600">฿{fmt(totalAmount)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{debts.length} รายการที่รอชำระ</p>
            </div>
            {overdueCount > 0 && (
              <div className="text-right">
                <p className="text-sm font-bold text-red-600">฿{fmt(overdueAmount)}</p>
                <p className="text-xs text-red-500">🚨 เกินกำหนด {overdueCount} รายการ</p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 mb-3" />

          {/* Top debtors */}
          <div className="space-y-2">
            {previewDebts.map(debt => {
              const overdue = isOverdue(debt.due_date)
              return (
                <div key={debt.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${overdue ? 'bg-red-400' : 'bg-orange-300'}`} />
                    <p className="text-sm text-gray-700 truncate">{debt.debtor_name}</p>
                    {overdue && <span className="text-[10px] text-red-500 flex-shrink-0">เกินกำหนด</span>}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 flex-shrink-0">฿{fmt(debt.amount)}</p>
                </div>
              )
            })}
            {debts.length > 4 && (
              <p className="text-xs text-gray-400 text-center pt-1">+{debts.length - 4} รายการอื่น</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
