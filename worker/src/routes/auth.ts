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
    redirect_uri: `${c.env.FRONTEND_URL}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  })
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

auth.get('/callback', async (c) => {
  const code = c.req.query('code')

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
      redirect_uri: `${c.env.FRONTEND_URL}/api/auth/callback`,
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

  // Check if this email matches a member from ANOTHER user's household
  const invitedMember = await c.env.DB.prepare(
    `SELECT id, user_id, role FROM members
     WHERE email = ? AND user_id != ?
     ORDER BY (role = 'owner') DESC, created_at ASC
     LIMIT 1`
  )
    .bind(googleUser.email, user.id)
    .first<{ id: number; user_id: number; role: 'owner' | 'admin' | 'member' }>()

  let householdUserId: number
  let memberId: number | null
  let role: 'owner' | 'admin' | 'member'

  if (invitedMember) {
    householdUserId = invitedMember.user_id
    memberId = invitedMember.id
    role = invitedMember.role
  } else {
    householdUserId = user.id
    role = 'owner'

    const existingOwner = await c.env.DB.prepare(
      'SELECT id FROM members WHERE user_id = ? AND role = ? LIMIT 1'
    )
      .bind(user.id, 'owner')
      .first<{ id: number }>()

    if (existingOwner) {
      memberId = existingOwner.id
    } else {
      const inserted = await c.env.DB.prepare(
        `INSERT INTO members (user_id, name, email, color, emoji, is_owner, role)
         VALUES (?, ?, ?, '#6366f1', '👤', 1, 'owner')
         RETURNING id`
      )
        .bind(user.id, googleUser.name.split(' ')[0], googleUser.email)
        .first<{ id: number }>()
      memberId = inserted?.id ?? null
    }
  }

  const sessionId = generateSessionId()
  const sessionData: SessionData = {
    userId: householdUserId,
    memberId,
    email: user.email,
    name: user.name,
    picture: user.picture ?? '',
    isOwner: role === 'owner',
    role,
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
  const memberId = c.get('memberId')
  const userEmail = c.get('userEmail')
  const userName = c.get('userName')
  const userPicture = c.get('userPicture')
  const isOwner = c.get('isOwner')

  let memberInfo: { name?: string; emoji?: string; color?: string } = {}
  if (memberId) {
    const m = await c.env.DB.prepare(
      'SELECT name, emoji, color FROM members WHERE id = ?'
    )
      .bind(memberId)
      .first<{ name: string; emoji: string; color: string }>()
    if (m) memberInfo = m
  }

  return c.json({
    email: userEmail,
    name: userName,
    picture: userPicture,
    member_id: memberId,
    member_name: memberInfo.name ?? userName,
    member_emoji: memberInfo.emoji ?? '👤',
    member_color: memberInfo.color ?? '#6366f1',
    is_owner: isOwner,
    role: c.get('role'),
  })
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
