import { useState } from 'react'
import { format, subMonths, addMonths, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useDashboard } from '../hooks/useDashboard'
import { api } from '../api/client'
import BudgetCard from '../components/BudgetCard'
import ExpenseList from '../components/ExpenseList'
import IncomeList from '../components/IncomeList'
import ExpenseForm from '../components/ExpenseForm'
import IncomeForm from '../components/IncomeForm'
import UpcomingPaymentsCard from '../components/UpcomingPaymentsCard'
import DebtSummaryCard from '../components/DebtSummaryCard'
import clsx from 'clsx'

function fmt(n: number) {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function fmtMonth(m: string) {
  return format(parseISO(`${m}-01`), 'MMM yy', { locale: th })
}

type Tab = 'expense' | 'income'

export default function DashboardPage() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [tab, setTab] = useState<Tab>('expense')
  const [showExpForm, setShowExpForm] = useState(false)
  const [showIncForm, setShowIncForm] = useState(false)
  const [showBudgetCards, setShowBudgetCards] = useState(false)
  const [sendingLine, setSendingLine] = useState(false)
  const [lineSendResult, setLineSendResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const { data, isLoading } = useDashboard(month)

  async function handleSendSummary() {
    setSendingLine(true)
    setLineSendResult(null)
    try {
      const res = await api.sendSummary(month)
      setLineSendResult({ ok: true, msg: `ส่งสำเร็จ ${res.sent} คน` })
    } catch (e) {
      setLineSendResult({ ok: false, msg: (e as Error).message })
    } finally {
      setSendingLine(false)
      setTimeout(() => setLineSendResult(null), 4000)
    }
  }

  const prevMonth = () => setMonth(format(subMonths(parseISO(`${month}-01`), 1), 'yyyy-MM'))
  const nextMonth = () => {
    const next = format(addMonths(parseISO(`${month}-01`), 1), 'yyyy-MM')
    if (next <= format(new Date(), 'yyyy-MM')) setMonth(next)
  }

  const isCurrentMonth = month === format(new Date(), 'yyyy-MM')
  const budgetPct = data?.total_budget
    ? Math.round((data.total_spent / data.total_budget) * 100)
    : 0
  const netPositive = (data?.net_balance ?? 0) >= 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">ภาพรวมการเงินของบ้าน</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <button
              onClick={handleSendSummary}
              disabled={sendingLine}
              className="flex items-center gap-1.5 bg-green-500 text-white px-3 sm:px-4 py-2.5 rounded-xl font-medium hover:bg-green-600 shadow-sm text-sm disabled:opacity-60"
              title="ส่งสรุปไป LINE"
            >
              {sendingLine ? '⏳' : '📊'} <span className="hidden sm:inline">LINE</span>
            </button>
            {lineSendResult && (
              <div className={clsx(
                'absolute right-0 top-11 z-10 whitespace-nowrap text-xs px-3 py-1.5 rounded-lg shadow',
                lineSendResult.ok ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
              )}>
                {lineSendResult.ok ? '✅ ' : '❌ '}{lineSendResult.msg}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowIncForm(true)}
            className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 sm:px-4 py-2.5 rounded-xl font-medium hover:bg-emerald-700 shadow-sm text-sm"
          >
            <span>+</span> รายรับ
          </button>
          <button
            onClick={() => setShowExpForm(true)}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 sm:px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-700 shadow-sm text-sm"
          >
            <span>+</span> รายจ่าย
          </button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50">‹</button>
        <span className="text-base font-semibold text-gray-800 min-w-[140px] text-center">
          {format(parseISO(`${month}-01`), 'MMMM yyyy', { locale: th })}
        </span>
        <button onClick={nextMonth} disabled={isCurrentMonth} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-30">›</button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 animate-pulse">กำลังโหลด...</div>
      ) : data ? (
        <>
          {/* Summary: Available (prev month income) / Expense / Net / This month income */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* Available = previous month income (funds available for this month's bills) */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-base">🏦</div>
                <p className="text-xs text-gray-500">เงินตั้งต้น</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-sky-700">
                ฿{fmt(data.prev_month_income)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">รายรับเดือนก่อน</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-base">📤</div>
                <p className="text-xs text-gray-500">รายจ่าย</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-red-600">
                −฿{fmt(data.total_spent)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">เดือนนี้</p>
            </div>

            <div className={clsx(
              'rounded-2xl p-4 border-2',
              netPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
            )}>
              <div className="flex items-center gap-2 mb-1">
                <div className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-base',
                  netPositive ? 'bg-emerald-200' : 'bg-red-200'
                )}>
                  {netPositive ? '💰' : '⚠️'}
                </div>
                <p className="text-xs text-gray-700 font-medium">คงเหลือ</p>
              </div>
              <p className={clsx(
                'text-xl sm:text-2xl font-bold',
                netPositive ? 'text-emerald-700' : 'text-red-700'
              )}>
                {netPositive ? '' : '−'}฿{fmt(Math.abs(data.net_balance))}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">ตั้งต้น − จ่าย</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-base">📥</div>
                <p className="text-xs text-gray-500">รายรับเข้า</p>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600">
                +฿{fmt(data.total_income)}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">สำหรับเดือนหน้า</p>
            </div>
          </div>

          {/* Budget bar */}
          {data.total_budget > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-600 font-medium">งบประมาณรายจ่าย</p>
                <p className="text-sm font-semibold text-gray-900">
                  ฿{fmt(data.total_spent)} <span className="text-gray-400">/ ฿{fmt(data.total_budget)}</span>
                </p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all',
                    budgetPct > 100 ? 'bg-red-500' : budgetPct > 80 ? 'bg-amber-400' : 'bg-indigo-500'
                  )}
                  style={{ width: `${Math.min(budgetPct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-xs">
                <span className={budgetPct > 100 ? 'text-red-500' : 'text-gray-400'}>
                  {budgetPct}% ใช้ไป
                </span>
                <span className="text-gray-400">
                  เหลือ ฿{fmt(Math.max(0, data.total_budget - data.total_spent))}
                </span>
              </div>
            </div>
          )}

          {/* Upcoming bills + Debt summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UpcomingPaymentsCard month={month} />
            <DebtSummaryCard />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut: spending by category */}
            {data.by_category.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">สัดส่วนรายจ่าย</h2>
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

            {/* Bar chart trend: income vs expense */}
            {data.monthly_trend.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700 mb-4">รายรับ vs รายจ่าย (6 เดือน)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.monthly_trend} barSize={14}>
                    <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `฿${Math.round(v/1000)}k`} />
                    <Tooltip
                      formatter={(v: number, name: string) => [`฿${fmt(v)}`, name === 'income' ? 'รายรับ' : 'รายจ่าย']}
                      labelFormatter={fmtMonth}
                    />
                    <Legend formatter={(v) => v === 'income' ? 'รายรับ' : 'รายจ่าย'} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Income breakdown */}
          {data.by_income_category.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">รายรับแต่ละประเภท</h2>
              <div className="space-y-3">
                {data.by_income_category.map(item => {
                  const pct = data.total_income ? Math.round((item.received / data.total_income) * 100) : 0
                  return (
                    <div key={item.category_id} className="flex items-center gap-3">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                        style={{ backgroundColor: `${item.category_color}25` }}
                      >
                        {item.category_icon}
                      </span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{item.category_name}</span>
                          <span className="text-emerald-600 font-semibold">+฿{fmt(item.received)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: item.category_color }}
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

          {/* Budget by category — collapsible */}
          {data.by_category.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => setShowBudgetCards(v => !v)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
              >
                <h2 className="text-sm font-semibold text-gray-700">งบประมาณแต่ละหมวด</h2>
                <span className={clsx('text-gray-400 transition-transform duration-200 text-lg leading-none', showBudgetCards ? 'rotate-180' : '')}>
                  ⌄
                </span>
              </button>
              {showBudgetCards && (
                <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.by_category.map(cat => (
                    <BudgetCard key={cat.category_id} category={cat} />
                  ))}
                </div>
              )}
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

          {/* Tabs: recent expenses / incomes */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100">
              <button
                onClick={() => setTab('expense')}
                className={clsx(
                  'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  tab === 'expense' ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                รายจ่ายล่าสุด
              </button>
              <button
                onClick={() => setTab('income')}
                className={clsx(
                  'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  tab === 'income' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                รายรับล่าสุด
              </button>
            </div>
            {tab === 'expense' ? (
              <ExpenseList expenses={data.recent_expenses} />
            ) : (
              <IncomeList incomes={data.recent_incomes} />
            )}
          </div>
        </>
      ) : null}

      {showExpForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">บันทึกรายจ่าย</h2>
              <button onClick={() => setShowExpForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <ExpenseForm onClose={() => setShowExpForm(false)} />
          </div>
        </div>
      )}

      {showIncForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">บันทึกรายรับ</h2>
              <button onClick={() => setShowIncForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <IncomeForm onClose={() => setShowIncForm(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
