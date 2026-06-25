import { Hono } from 'hono'
import type { Bindings, Variables, SessionData, User } from '../types'
import {
  generateSessionId,
  buildSetCookieHeader,
  buildClearCookieHeader,
  authMiddleware,
} from '../middleware/auth'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

auth.get('/login', (c) => {
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${new URL(c.req.url).origin}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  })
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

auth.get('/callback', async (c) => {
  const code = c.req.query('code')
  const origin = new URL(c.req.url).origin

  if (!code) {
    return c.redirect(`${c.env.FRONTEND_URL}?error=no_code`)
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/api/auth/callback`,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return c.redirect(`${c.env.FRONTEND_URL}?error=token_exchange_failed`)
  }

  const tokens = await tokenRes.json<{ access_token: string }>()

  // Get user info from Google
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })

  if (!userRes.ok) {
    return c.redirect(`${c.env.FRONTEND_URL}?error=userinfo_failed`)
  }

  const googleUser = await userRes.json<{
    sub: string
    email: string
    name: string
    picture: string
  }>()

  // Upsert user in D1
  await c.env.DB.prepare(
    `INSERT INTO users (google_id, email, name, picture)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(google_id) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       picture = excluded.picture`
  )
    .bind(googleUser.sub, googleUser.email, googleUser.name, googleUser.picture)
    .run()

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE google_id = ?')
    .bind(googleUser.sub)
    .first<User>()

  if (!user) {
    return c.redirect(`${c.env.FRONTEND_URL}?error=db_error`)
  }

  // Create default member (owner) if first login
  const memberCount = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM members WHERE user_id = ?'
  )
    .bind(user.id)
    .first<{ count: number }>()

  if (memberCount?.count === 0) {
    await c.env.DB.prepare(
      `INSERT INTO members (user_id, name, color, emoji, is_owner)
       VALUES (?, ?, '#6366f1', '👤', 1)`
    )
      .bind(user.id, googleUser.name.split(' ')[0])
      .run()
  }

  // Create session
  const sessionId = generateSessionId()
  const sessionData: SessionData = {
    userId: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture ?? '',
  }

  await c.env.SESSIONS.put(`session:${sessionId}`, JSON.stringify(sessionData), {
    expirationTtl: 60 * 60 * 24 * 7, // 7 days
  })

  const isSecure = new URL(c.req.url).protocol === 'https:'
  const response = c.redirect(c.env.FRONTEND_URL)
  response.headers.set('Set-Cookie', buildSetCookieHeader(sessionId, isSecure))
  return response
})

auth.get('/me', authMiddleware, async (c) => {
  const user = await c.env.DB.prepare('SELECT id, email, name, picture FROM users WHERE id = ?')
    .bind(c.get('userId'))
    .first<Omit<User, 'google_id' | 'created_at'>>()

  if (!user) return c.json({ error: 'User not found' }, 404)
  return c.json(user)
})

auth.post('/logout', async (c) => {
  const sessionId = getCookieValue(c.req.raw.headers.get('cookie') ?? '', 'session_id')
  if (sessionId) {
    await c.env.SESSIONS.delete(`session:${sessionId}`)
  }
  const response = c.json({ ok: true })
  response.headers.set('Set-Cookie', buildClearCookieHeader())
  return response
})

function getCookieValue(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export default auth
