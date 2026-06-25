import { useState } from 'react'
import { format, subMonths, addMonths, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useDashboard } from '../hooks/useDashboard'
import BudgetCard from '../components/BudgetCard'
import ExpenseList from '../components/ExpenseList'
import ExpenseForm from '../components/ExpenseForm'

function fmt(n: number) {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function fmtMonth(m: string) {
  return format(parseISO(`${m}-01`), 'MMM yy', { locale: th })
}

export default function DashboardPage() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [showForm, setShowForm] = useState(false)
  const { data, isLoading } = useDashboard(month)

  const prevMonth = () => setMonth(format(subMonths(parseISO(`${month}-01`), 1), 'yyyy-MM'))
  const nextMonth = () => {
    const next = format(addMonths(parseISO(`${month}-01`), 1), 'yyyy-MM')
    if (next <= format(new Date(), 'yyyy-MM')) setMonth(next)
  }

  const isCurrentMonth = month === format(new Date(), 'yyyy-MM')
  const budgetPct = data?.total_budget
    ? Math.round((data.total_spent / data.total_budget) * 100)
    : 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">ภาพรวมค่าใช้จ่าย</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <span className="text-lg">+</span> บันทึกรายจ่าย
        </button>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50">‹</button>
        <span className="text-base font-semibold text-gray-800 min-w-[120px] text-center">
          {format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: th })}
        </span>
        <button onClick={nextMonth} disabled={isCurrentMonth} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30">›</button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 animate-pulse">กำลังโหลด...</div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="text-sm text-gray-500">ใช้ไปทั้งหมด</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">฿{fmt(data.total_spent)}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="text-sm text-gray-500">งบประมาณ</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                ฿{fmt(data.total_budget)}
              </p>
              {data.total_budget > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{budgetPct}% ใช้ไป</span>
                    <span>เหลือ ฿{fmt(Math.max(0, data.total_budget - data.total_spent))}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div
                      className={`h-full rounded-full ${budgetPct > 100 ? 'bg-red-500' : budgetPct > 80 ? 'bg-amber-400' : 'bg-indigo-500'}`}
                      style={{ width: `${Math.min(budgetPct, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="text-sm text-gray-500">จำนวนรายการ</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{data.recent_expenses.length > 9 ? '10+' : data.recent_expenses.length}</p>
              <p className="text-xs text-gray-400 mt-1">รายการล่าสุด</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut chart */}
            {data.by_category.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">สัดส่วนค่าใช้จ่าย</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.by_category}
                      dataKey="spent"
                      nameKey="category_name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {data.by_category.map((entry, i) => (
                        <Cell key={i} fill={entry.category_color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`฿${fmt(v)}`, '']} />
                    <Legend
                      formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Bar chart trend */}
            {data.monthly_trend.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">แนวโน้ม 6 เดือน</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.monthly_trend} barSize={28}>
                    <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `฿${Math.round(v/1000)}k`} />
                    <Tooltip formatter={(v: number) => [`฿${fmt(v)}`, 'รายจ่าย']} labelFormatter={fmtMonth} />
                    <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Budget by category */}
          {data.by_category.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">งบประมาณแต่ละหมวด</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.by_category.map(cat => (
                  <BudgetCard key={cat.category_id} category={cat} />
                ))}
              </div>
            </div>
          )}

          {/* Members */}
          {data.by_member.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">ค่าใช้จ่ายแต่ละคน</h2>
              <div className="space-y-3">
                {data.by_member.map(m => {
                  const pct = data.total_spent ? Math.round((m.spent / data.total_spent) * 100) : 0
                  return (
                    <div key={m.member_id ?? 'unknown'} className="flex items-center gap-3">
                      <span className="text-xl">{m.member_emoji}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{m.member_name}</span>
                          <span className="text-gray-900 font-semibold">฿{fmt(m.spent)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: m.member_color }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent expenses */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">รายการล่าสุด</h2>
            <ExpenseList expenses={data.recent_expenses} />
          </div>
        </>
      ) : null}

      {/* Add expense modal */}
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
