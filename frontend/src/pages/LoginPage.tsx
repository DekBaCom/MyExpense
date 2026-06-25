import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const { data: user, isLoading } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const error = params.get('error')

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-lg animate-pulse">กำลังโหลด...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-10 w-full max-w-sm text-center">
        {/* Logo */}
        <div className="mb-6">
          <div className="text-6xl mb-4">💸</div>
          <h1 className="text-2xl font-bold text-gray-900">MyExpense</h1>
          <p className="text-gray-500 mt-2 text-sm">บันทึกค่าใช้จ่ายในบ้านอย่างง่ายดาย</p>
        </div>

        {/* Features */}
        <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-left space-y-2">
          {[
            ['📊', 'Dashboard สรุปค่าใช้จ่าย'],
            ['💰', 'ตั้งงบประมาณแต่ละหมวด'],
            ['👨‍👩‍👧', 'รองรับหลายคนในครอบครัว'],
            ['📈', 'ดูแนวโน้มย้อนหลัง 6 เดือน'],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-2 text-sm text-gray-600">
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง
          </div>
        )}

        {/* Google Login */}
        <a
          href="/api/auth/login"
          className="flex items-center justify-center gap-3 w-full py-3 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          เข้าสู่ระบบด้วย Google
        </a>

        <p className="mt-4 text-xs text-gray-400">
          ข้อมูลของคุณปลอดภัย ไม่มีการแชร์ให้ใคร
        </p>
      </div>
    </div>
  )
}
