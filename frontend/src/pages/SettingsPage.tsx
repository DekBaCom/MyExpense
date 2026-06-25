import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data: lineSettings, isLoading } = useQuery({
    queryKey: ['settings', 'line'],
    queryFn: api.getLineSettings,
  })

  const [token, setToken] = useState('')
  const [userId, setUserId] = useState('')
  const [notifyOnAdd, setNotifyOnAdd] = useState(true)
  const [notifyOnBudget, setNotifyOnBudget] = useState(true)
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [testMsg, setTestMsg] = useState('')
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    if (lineSettings) {
      setToken(lineSettings.channel_token ?? '')
      setUserId(lineSettings.line_user_id ?? '')
      setNotifyOnAdd(lineSettings.notify_on_add)
      setNotifyOnBudget(lineSettings.notify_on_budget_alert)
    }
  }, [lineSettings])

  const save = useMutation({
    mutationFn: () =>
      api.saveLineSettings({
        channel_token: token || null,
        line_user_id: userId || null,
        notify_on_add: notifyOnAdd,
        notify_on_budget_alert: notifyOnBudget,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'line'] })
      setSaveMsg('บันทึกแล้ว ✓')
      setTimeout(() => setSaveMsg(''), 2500)
    },
  })

  async function handleTest() {
    setTestStatus('loading')
    setTestMsg('')
    try {
      await api.testLineNotification()
      setTestStatus('ok')
      setTestMsg('ส่งข้อความทดสอบสำเร็จ! ตรวจสอบ LINE ของคุณ')
    } catch (e) {
      setTestStatus('error')
      setTestMsg((e as Error).message)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ตั้งค่า</h1>
        <p className="text-gray-500 text-sm mt-0.5">จัดการการแจ้งเตือนและการเชื่อมต่อ</p>
      </div>

      {/* LINE Notification Card */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
            <svg viewBox="0 0 48 48" className="w-6 h-6" fill="white">
              <path d="M24 4C12.95 4 4 11.89 4 21.6c0 5.78 3.2 10.91 8.2 14.28-.37 1.36-1.32 4.93-1.52 5.7-.24.97.35 1.6 1.16 1.05l6.73-4.43C19.9 38.47 21.93 38.7 24 38.7c11.05 0 20-7.89 20-17.1C44 11.89 35.05 4 24 4z"/>
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">LINE Notification</h2>
            <p className="text-xs text-gray-500">รับแจ้งเตือนค่าใช้จ่ายผ่าน LINE</p>
          </div>
          {lineSettings?.configured && (
            <span className="ml-auto text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
              เชื่อมต่อแล้ว
            </span>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400 animate-pulse">กำลังโหลด...</div>
          ) : (
            <>
              {/* Setup Guide */}
              <div className="bg-green-50 rounded-xl p-4 text-sm text-green-800 space-y-1.5">
                <p className="font-semibold">วิธีตั้งค่า LINE Messaging API</p>
                <ol className="list-decimal list-inside space-y-1 text-green-700">
                  <li>ไปที่ <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="underline font-medium">LINE Developers Console</a></li>
                  <li>สร้าง Provider → สร้าง Channel (Messaging API)</li>
                  <li>ไปที่ Channel → Messaging API → ออก <strong>Channel access token</strong></li>
                  <li>เพิ่ม Bot เป็นเพื่อน แล้วส่งข้อความอะไรก็ได้ 1 ครั้ง</li>
                  <li>ดึง <strong>User ID</strong> จาก Webhook หรือ LINE Official Account Manager</li>
                </ol>
              </div>

              {/* Token */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel Access Token
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder={lineSettings?.configured ? '••••••••••••••••' : 'วาง token ที่นี่'}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl font-mono text-sm"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {lineSettings?.configured
                    ? 'Token ถูกตั้งค่าแล้ว ล้างค่าและพิมพ์ใหม่เพื่อเปลี่ยน'
                    : 'ได้จาก LINE Developers Console → Channel → Messaging API'}
                </p>
              </div>

              {/* User ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  LINE User ID
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  placeholder="Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl font-mono text-sm"
                />
                <p className="mt-1 text-xs text-gray-400">
                  ขึ้นต้นด้วย "U" ความยาว 33 ตัวอักษร
                </p>
              </div>

              {/* Toggle: notify on add */}
              <div className="space-y-3 pt-1">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">แจ้งเตือนทุกครั้งที่บันทึกรายจ่าย</p>
                    <p className="text-xs text-gray-400">ส่งข้อความสรุปรายการทันที</p>
                  </div>
                  <Toggle value={notifyOnAdd} onChange={setNotifyOnAdd} />
                </label>

                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-700">แจ้งเตือนเมื่อเกินงบประมาณ</p>
                    <p className="text-xs text-gray-400">แจ้งเมื่อค่าใช้จ่ายหมวดใดหมวดหนึ่งเกิน 100%</p>
                  </div>
                  <Toggle value={notifyOnBudget} onChange={setNotifyOnBudget} />
                </label>
              </div>

              {/* Test result */}
              {testMsg && (
                <div className={`px-4 py-3 rounded-xl text-sm ${
                  testStatus === 'ok'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {testStatus === 'ok' ? '✅ ' : '❌ '}{testMsg}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleTest}
                  disabled={testStatus === 'loading' || !lineSettings?.configured}
                  className="flex-1 py-2.5 border border-green-500 text-green-600 rounded-xl font-medium hover:bg-green-50 disabled:opacity-40 transition-colors text-sm"
                >
                  {testStatus === 'loading' ? 'กำลังส่ง...' : '📨 ทดสอบส่งข้อความ'}
                </button>
                <button
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors text-sm"
                >
                  {save.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
              {saveMsg && (
                <p className="text-center text-sm text-green-600 font-medium">{saveMsg}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sample notification preview */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">ตัวอย่างข้อความที่จะได้รับ</h3>
        <div className="bg-[#06C755]/10 rounded-xl p-4 font-mono text-sm text-gray-700 whitespace-pre-line leading-relaxed">
          {`💸 บันทึกรายจ่ายใหม่
━━━━━━━━━━━━━━━
🍔 อาหารนอกบ้าน
💰 ฿250.00
📅 25 มิ.ย. 2569
💵 เงินสด
👤 สมชาย
📝 ข้าวกลางวัน
━━━━━━━━━━━━━━━
📊 ยอดรวมเดือนนี้: ฿8,450.00`}
        </div>
      </div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        value ? 'bg-indigo-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform mt-1 ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
