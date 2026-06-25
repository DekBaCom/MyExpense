import { createMiddleware } from 'hono/factory'
import type { Bindings, Variables, SessionData } from '../types'

export const authMiddleware = createMiddleware<{
  Bindings: Bindings
  Variables: Variables
}>(async (c, next) => {
  const sessionId = getCookieValue(c.req.raw.headers.get('cookie') ?? '', 'session_id')

  if (!sessionId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const sessionRaw = await c.env.SESSIONS.get(`session:${sessionId}`)
  if (!sessionRaw) {
    return c.json({ error: 'Session expired' }, 401)
  }

  const session: SessionData = JSON.parse(sessionRaw)
  c.set('userId', session.userId)
  c.set('memberId', session.memberId ?? null)
  c.set('userEmail', session.email)
  c.set('userName', session.name)
  c.set('userPicture', session.picture ?? '')
  c.set('isOwner', session.isOwner ?? true)

  await next()
})

function getCookieValue(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function generateSessionId(): string {
  return crypto.randomUUID()
}

export function buildSetCookieHeader(sessionId: string, secure: boolean): string {
  // SameSite=None required for cross-site cookies (Worker and Pages on different domains)
  // Must be paired with Secure (only sent over HTTPS)
  const parts = [
    `session_id=${encodeURIComponent(sessionId)}`,
    'HttpOnly',
    secure ? 'SameSite=None' : 'SameSite=Lax',
    'Path=/',
    'Max-Age=604800',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function buildClearCookieHeader(): string {
  return 'session_id=; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0'
}
