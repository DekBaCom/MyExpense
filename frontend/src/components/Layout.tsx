import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api/client'
import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'

const navItems = [
  { to: '/',         icon: '📊', label: 'Dashboard' },
  { to: '/incomes',  icon: '📥', label: 'รายรับ' },
  { to: '/expenses', icon: '📝', label: 'รายจ่าย' },
  { to: '/budget',   icon: '💰', label: 'งบประมาณ' },
  { to: '/members',  icon: '👨‍👩‍👧', label: 'สมาชิก' },
  { to: '/settings', icon: '⚙️', label: 'ตั้งค่า' },
]

export default function Layout() {
  const { data: user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogout() {
    await api.logout()
    qc.clear()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-30 flex flex-col transition-transform duration-300',
          'lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💸</span>
            <div>
              <h1 className="font-bold text-gray-900 text-lg leading-none">MyExpense</h1>
              <p className="text-xs text-gray-500 mt-0.5">บันทึกค่าใช้จ่าย</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
              }
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        {user && (
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              {user.picture ? (
                <img src={user.picture} alt="" className="w-9 h-9 rounded-full" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                  {user.name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                  {user.is_owner ? (
                    <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">เจ้าของ</span>
                  ) : (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">สมาชิก</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            {!user.is_owner && (
              <div className="mb-2 px-2 py-1.5 bg-emerald-50 rounded-lg text-xs text-emerald-700 flex items-center gap-1">
                <span>{user.member_emoji}</span>
                เข้าใช้งานในฐานะ <strong>{user.member_name}</strong>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="w-full text-sm text-gray-500 hover:text-red-500 text-left px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              ออกจากระบบ
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            ☰
          </button>
          <span className="font-semibold text-gray-900">💸 MyExpense</span>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
