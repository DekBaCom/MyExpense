import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import type { Member, MemberRole } from '../types'
import clsx from 'clsx'

const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#ec4899','#8b5cf6','#f97316']
const EMOJIS = ['👤','👨','👩','👦','👧','👴','👵','🐱','🐶','⭐']

type FormData = { name: string; email: string; color: string; emoji: string; role: MemberRole }

const defaultForm: FormData = { name: '', email: '', color: COLORS[0], emoji: EMOJIS[0], role: 'member' }

export default function MembersPage() {
  const qc = useQueryClient()
  const { data: currentUser } = useAuth()
  const isOwner = currentUser?.role === 'owner'
  const [form, setForm] = useState<FormData>(defaultForm)
  const [editing, setEditing] = useState<Member | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: api.getMembers,
  })

  const createMember = useMutation({
    mutationFn: (data: FormData) => api.createMember({
      name: data.name,
      email: data.email.trim() || null,
      color: data.color,
      emoji: data.emoji,
      role: data.role,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] })
      setShowAdd(false)
      setForm(defaultForm)
      setErrorMsg('')
    },
    onError: (e: Error) => setErrorMsg(e.message),
  })

  const updateMember = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => api.updateMember(id, {
      name: data.name,
      email: data.email.trim() || null,
      color: data.color,
      emoji: data.emoji,
      ...(editing?.role !== 'owner' ? { role: data.role } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] })
      setEditing(null)
      setErrorMsg('')
    },
    onError: (e: Error) => setErrorMsg(e.message),
  })

  const deleteMember = useMutation({
    mutationFn: (id: number) => api.deleteMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
  })

  function openEdit(m: Member) {
    setEditing(m)
    setForm({
      name: m.name,
      email: m.email ?? '',
      color: m.color,
      emoji: m.emoji,
      role: (m.role === 'owner' ? 'admin' : m.role) as MemberRole,
    })
    setErrorMsg('')
  }

  function handleDelete(m: Member) {
    if (m.role === 'owner') return alert('ไม่สามารถลบเจ้าของบัญชีได้')
    if (confirm(`ลบสมาชิก "${m.name}"?`)) deleteMember.mutate(m.id)
  }

  const isModal = showAdd || editing !== null
  const modalTitle = editing ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิกใหม่'

  function handleSubmit() {
    if (!form.name.trim()) return
    if (editing) {
      updateMember.mutate({ id: editing.id, data: form })
    } else {
      createMember.mutate(form)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">สมาชิก</h1>
          <p className="text-gray-500 text-sm mt-0.5">คนในครอบครัวและสิทธิ์การเข้าใช้งาน</p>
        </div>
        {isOwner && (
          <button
            onClick={() => { setForm(defaultForm); setEditing(null); setShowAdd(true) }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-indigo-700"
          >
            + เพิ่มสมาชิก
          </button>
        )}
      </div>

      {!isOwner && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          เฉพาะเจ้าของบัญชีเท่านั้นที่สามารถเพิ่ม/แก้ไขสมาชิกได้
        </div>
      )}

      {/* Members list */}
      <div className="space-y-3">
        {members.map(m => (
          <div key={m.id} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: `${m.color}25` }}
            >
              {m.emoji}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900">{m.name}</span>
                {m.role === 'owner' && (
                  <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">👑 เจ้าของ</span>
                )}
                {m.role === 'admin' && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">⚙️ Admin</span>
                )}
                {m.role === 'member' && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">👤 Member</span>
                )}
                {m.email && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                    🔑 Login ได้
                  </span>
                )}
              </div>
              {m.email ? (
                <p className="text-xs text-gray-500 mt-0.5 truncate">📧 {m.email}</p>
              ) : (
                <p className="text-xs text-gray-400 mt-0.5">ยังไม่ได้ผูกอีเมล</p>
              )}
            </div>
            {isOwner && (
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(m)}
                  className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  ✏️
                </button>
                {m.role !== 'owner' && (
                  <button
                    onClick={() => handleDelete(m)}
                    className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500"
                  >
                    🗑️
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {members.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">👨‍👩‍👧</p>
          <p>ยังไม่มีสมาชิก</p>
        </div>
      )}

      {/* Modal */}
      {isModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{modalTitle}</h2>
              <button onClick={() => { setShowAdd(false); setEditing(null) }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* Preview */}
            <div className="flex justify-center">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                style={{ backgroundColor: `${form.color}25` }}
              >
                {form.emoji}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl"
                placeholder="ชื่อสมาชิก"
                maxLength={50}
              />
            </div>

            {/* Email (for login) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                อีเมล (สำหรับ Login) <span className="text-gray-400 font-normal">— ไม่บังคับ</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm"
                placeholder="member@gmail.com"
                disabled={!!editing && editing.role === 'owner'}
              />
              <p className="mt-1 text-xs text-gray-400">
                {editing?.role === 'owner'
                  ? 'อีเมลเจ้าของบัญชีแก้ไขไม่ได้'
                  : 'สมาชิกจะ Login ได้ด้วย Google account ที่ใช้อีเมลนี้'}
              </p>
            </div>

            {/* Role (not for owner) */}
            {(!editing || editing.role !== 'owner') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สิทธิ์การใช้งาน</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'admin' as MemberRole,  icon: '⚙️', label: 'Admin',  desc: 'จัดการได้ทุกอย่าง ยกเว้นเปลี่ยน owner' },
                    { value: 'member' as MemberRole, icon: '👤', label: 'Member', desc: 'ดูข้อมูล + เพิ่มรายการตัวเอง' },
                  ].map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, role: r.value }))}
                      className={clsx(
                        'px-3 py-2.5 rounded-xl border text-left transition-colors',
                        form.role === r.value
                          ? r.value === 'admin'
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-500 bg-gray-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span>{r.icon}</span>
                        <span className="text-sm font-medium text-gray-800">{r.label}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-tight">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Emoji */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">อิโมจิ</label>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, emoji: e }))}
                    className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 transition-colors ${form.emoji === e ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">สี</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, color: c }))}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {errorMsg}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!form.name.trim() || createMember.isPending || updateMember.isPending}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {editing ? 'บันทึกการแก้ไข' : 'เพิ่มสมาชิก'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
