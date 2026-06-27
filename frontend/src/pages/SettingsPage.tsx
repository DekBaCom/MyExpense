import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { useMembers } from '../hooks/useExpenses'
import type { LineRecipient } from '../types'
import clsx from 'clsx'

type FormData = {
  member_id: number | null
  label: string
  channel_token: string
  line_user_id: string
  notify_on_add: boolean
  notify_on_budget_alert: boolean
  notify_on_recurring: boolean
  notify_on_summary: boolean
}

const emptyForm: FormData = {
  member_id: null,
  label: '',
  channel_token: '',
  line_user_id: '',
  notify_on_add: true,
  notify_on_budget_alert: true,
  notify_on_recurring: true,
  notify_on_summary: true,
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data: user } = useAuth()
  const { data: members = [] } = useMembers()
  const [editing, setEditing] = useState<LineRecipient | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [error, setError] = useState('')
  const [testStatus, setTestStatus] = useState<{ id: number; ok: boolean; msg: string } | null>(null)

  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ['line-recipients'],
    queryFn: api.getLineRecipients,
  })

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        return api.updateLineRecipient(editing.id, form)
      }
      return api.createLineRecipient(form)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['line-recipients'] })
      setShowAdd(false)
      setEditing(null)
      setForm(emptyForm)
      setError('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteLineRecipient(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['line-recipients'] }),
  })

  async function handleTest(r: LineRecipient) {
    setTestStatus({ id: r.id, ok: false, msg: 'กำลังส่ง...' })
    try {
      await api.testLineRecipient(r.id)
      setTestStatus({ id: r.id, ok: true, msg: 'ส่งสำเร็จ! ตรวจสอบ LINE' })
    } catch (e) {
      setTestStatus({ id: r.id, ok: false, msg: (e as Error).message })
    }
  }

  function openEdit(r: LineRecipient) {
    setEditing(r)
    setShowAdd(false)
    setForm({
      member_id: r.member_id,
      label: r.label,
      channel_token: r.channel_token,
      line_user_id: r.line_user_id,
      notify_on_add: r.notify_on_add,
      notify_on_budget_alert: r.notify_on_budget_alert,
      notify_on_recurring: r.notify_on_recurring,
      notify_on_summary: r.notify_on_summary,
    })
    setError('')
  }

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setShowAdd(true)
    setError('')
  }

  const isModalOpen = showAdd || editing !== null

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ตั้งค่า</h1>
        <p className="text-gray-500 text-sm mt-0.5">การแจ้งเตือนและการเชื่อมต่อ LINE</p>
      </div>

      {/* Profile */}
      {user && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">โปรไฟล์ของคุณ</h2>
          <div className="flex items-center gap-3">
            {user.picture ? (
              <img src={user.picture} alt="" className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                {user.name[0]}
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{user.member_name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <span className={clsx(
              'text-xs px-2.5 py-1 rounded-full font-medium',
              user.role === 'owner' && 'bg-indigo-100 text-indigo-700',
              user.role === 'admin' && 'bg-purple-100 text-purple-700',
              user.role === 'member' && 'bg-gray-100 text-gray-600',
            )}>
              {user.role === 'owner' ? '👑 เจ้าของ' : user.role === 'admin' ? '⚙️ Admin' : '👤 Member'}
            </span>
          </div>
        </div>
      )}

      {/* LINE Recipients */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
              <svg viewBox="0 0 48 48" className="w-6 h-6" fill="white">
                <path d="M24 4C12.95 4 4 11.89 4 21.6c0 5.78 3.2 10.91 8.2 14.28-.37 1.36-1.32 4.93-1.52 5.7-.24.97.35 1.6 1.16 1.05l6.73-4.43C19.9 38.47 21.93 38.7 24 38.7c11.05 0 20-7.89 20-17.1C44 11.89 35.05 4 24 4z"/>
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">LINE แจ้งเตือน</h2>
              <p className="text-xs text-gray-500">{recipients.length} ผู้รับ</p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-xl font-medium hover:bg-indigo-700"
          >
            + เพิ่ม
          </button>
        </div>

        <div className="p-5 space-y-3">
          {isLoading ? (
            <p className="text-center py-6 text-sm text-gray-400 animate-pulse">กำลังโหลด...</p>
          ) : recipients.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">📱</p>
              <p className="text-sm text-gray-500">ยังไม่มีผู้รับการแจ้งเตือน</p>
              <p className="text-xs text-gray-400 mt-1">เพิ่มผู้รับเพื่อให้ระบบส่งข้อความผ่าน LINE</p>
            </div>
          ) : (
            recipients.map(r => (
              <div key={r.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 flex items-center gap-2">
                      {r.member_emoji && <span>{r.member_emoji}</span>}
                      {r.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">User: {r.line_user_id.slice(0, 12)}...</p>
                    <div className="flex gap-2 mt-2 text-xs flex-wrap">
                      {r.notify_on_add && <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">บันทึก</span>}
                      {r.notify_on_budget_alert && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">เกินงบ</span>}
                      {r.notify_on_recurring && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">บิลรายเดือน</span>}
                      {r.notify_on_summary && <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full">สรุปรายวัน</span>}
                    </div>
                    {testStatus?.id === r.id && (
                      <p className={clsx(
                        'mt-2 text-xs',
                        testStatus.ok ? 'text-green-600' : 'text-red-600'
                      )}>
                        {testStatus.ok ? '✅ ' : '❌ '}{testStatus.msg}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleTest(r)}
                      className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600"
                      title="ทดสอบส่ง"
                    >
                      📨
                    </button>
                    <button
                      onClick={() => openEdit(r)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => confirm(`ลบ "${r.label}"?`) && remove.mutate(r.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Setup guide */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm space-y-2">
        <p className="font-semibold text-blue-900">📚 วิธีตั้งค่า LINE Messaging API</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-800">
          <li>ไปที่ <a className="underline font-medium" href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer">LINE Developers Console</a></li>
          <li>สร้าง Channel (Messaging API) → ออก <strong>Channel access token</strong></li>
          <li>เพิ่ม Bot เป็นเพื่อนใน LINE ของแต่ละคน → ส่งข้อความใดก็ได้ 1 ครั้ง</li>
          <li>ดึง <strong>User ID</strong> ของแต่ละคนจาก Webhook event</li>
          <li>เพิ่มแต่ละคนเป็นผู้รับการแจ้งเตือนด้านบน</li>
        </ol>
        <p className="text-xs text-blue-700">💡 เคล็ดลับ: ทุกคนใช้ Channel Access Token เดียวกันได้ — แตกต่างกันแค่ User ID</p>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'แก้ไขผู้รับ' : 'เพิ่มผู้รับ LINE'}
              </h2>
              <button onClick={() => { setShowAdd(false); setEditing(null) }} className="text-gray-400 text-xl">✕</button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อเรียก</label>
              <input
                type="text"
                value={form.label}
                onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
                placeholder="เช่น เลย์, ภรรยา, แม่"
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ผูกกับสมาชิก (ไม่บังคับ)</label>
              <select
                value={form.member_id ?? ''}
                onChange={e => setForm(p => ({ ...p, member_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
              >
                <option value="">ไม่ผูก</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel Access Token</label>
              <input
                type={editing ? 'text' : 'password'}
                value={form.channel_token}
                onChange={e => setForm(p => ({ ...p, channel_token: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl font-mono text-xs"
                placeholder="วาง token ที่นี่"
                autoComplete="off"
              />
              {editing && <p className="text-xs text-gray-400 mt-1">ขึ้น *** = ใช้ token เดิม ลบทิ้งและพิมพ์ใหม่เพื่อเปลี่ยน</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LINE User ID</label>
              <input
                type="text"
                value={form.line_user_id}
                onChange={e => setForm(p => ({ ...p, line_user_id: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl font-mono text-xs"
                placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>

            <div className="space-y-2 bg-gray-50 rounded-xl p-3">
              <p className="text-sm font-medium text-gray-700 mb-1">รับแจ้งเตือนเมื่อ</p>
              {[
                { key: 'notify_on_add' as const,           label: 'บันทึกรายจ่ายใหม่' },
                { key: 'notify_on_budget_alert' as const,  label: 'ใช้เกินงบประมาณ' },
                { key: 'notify_on_recurring' as const,     label: 'บิลรายเดือนใกล้ครบกำหนด/เกินกำหนด' },
                { key: 'notify_on_summary' as const,       label: 'สรุปยอดรายวัน (ทุกคืน 21:00) และรายเดือน' },
              ].map(opt => (
                <label key={opt.key} className="flex items-center justify-between text-sm cursor-pointer">
                  <span className="text-gray-700">{opt.label}</span>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, [opt.key]: !p[opt.key] }))}
                    className={clsx(
                      'relative w-10 h-5 rounded-full transition-colors',
                      form[opt.key] ? 'bg-indigo-600' : 'bg-gray-300'
                    )}
                  >
                    <span className={clsx(
                      'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transform transition-transform',
                      form[opt.key] && 'translate-x-5'
                    )} />
                  </button>
                </label>
              ))}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              onClick={() => save.mutate()}
              disabled={!form.label || !form.channel_token || !form.line_user_id || save.isPending}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {save.isPending ? 'กำลังบันทึก...' : editing ? 'บันทึก' : 'เพิ่มผู้รับ'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
