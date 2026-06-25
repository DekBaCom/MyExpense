import { useState } from 'react'
import { format } from 'date-fns'
import { useExpenses } from '../hooks/useExpenses'
import { useCategories } from '../hooks/useCategories'
import ExpenseList from '../components/ExpenseList'
import ExpenseForm from '../components/ExpenseForm'

export default function ExpensesPage() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [categoryId, setCategoryId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 30

  const { data, isLoading } = useExpenses({
    month,
    ...(categoryId ? { category: categoryId } : {}),
    limit: String(limit),
    offset: String(offset),
  })

  const { data: categories = [] } = useCategories()

  function handleMonthChange(e: React.ChangeEvent<HTMLInputElement>) {
    setMonth(e.target.value)
    setOffset(0)
  }

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setCategoryId(e.target.value)
    setOffset(0)
  }

  const total = data?.data.reduce((s, e) => s + e.amount, 0) ?? 0
  const hasMore = (data?.total ?? 0) > offset + limit

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">รายจ่าย</h1>
          <p className="text-gray-500 text-sm mt-0.5">ดูและจัดการรายการค่าใช้จ่าย</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-700 shadow-sm"
        >
          <span className="text-lg">+</span> เพิ่ม
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="month"
          value={month}
          onChange={handleMonthChange}
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm"
        />
        <select
          value={categoryId}
          onChange={handleCategoryChange}
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm"
        >
          <option value="">ทุกหมวดหมู่</option>
          {categories.map(parent => (
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
      </div>

      {/* Summary */}
      {data && data.data.length > 0 && (
        <div className="bg-indigo-50 rounded-xl px-4 py-3 flex justify-between items-center">
          <span className="text-sm text-indigo-700">{data.total} รายการ</span>
          <span className="font-bold text-indigo-900">
            รวม ฿{total.toLocaleString('th-TH', { maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        {isLoading ? (
          <div className="text-center py-16 text-gray-400 animate-pulse">กำลังโหลด...</div>
        ) : (
          <ExpenseList expenses={data?.data ?? []} />
        )}

        {/* Pagination */}
        {(offset > 0 || hasMore) && (
          <div className="flex justify-center gap-3 pt-4 mt-4 border-t border-gray-100">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              ‹ ก่อนหน้า
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={!hasMore}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              ถัดไป ›
            </button>
          </div>
        )}
      </div>

      {/* Add modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">บันทึกรายจ่าย</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <ExpenseForm onClose={() => setShowForm(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
