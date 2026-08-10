import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE = 'session'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET missing or too short (need ≥32 chars)')
  }
  return new TextEncoder().encode(s)
}

/**
 * `pv` = "password version": mốc `users.password_changed_at` lúc cấp token
 * (chuỗi rỗng nếu chưa từng đổi). `currentUser()` so lại với DB — lệch thì phiên
 * chết. Nhờ vậy ĐỔI MẬT KHẨU = đăng xuất khỏi mọi thiết bị khác, và admin đặt
 * lại mật khẩu cho ai thì phiên đang mở của người đó tắt luôn.
 *
 * Token cũ (trước 08/2026) không có `pv` → verify trả null → phải đăng nhập lại
 * một lần. Cố ý: coi token thiếu claim là không hợp lệ thay vì cho đi tiếp, để
 * không có cửa sau tồn tại tới 7 ngày.
 */
export type SessionPayload = { sub: string; email: string; pv: string }

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ email: payload.email, pv: payload.pv })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret())

  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export async function destroySession() {
  const store = await cookies()
  store.delete(COOKIE)
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.pv !== 'string'
    ) {
      return null
    }
    return { sub: payload.sub, email: payload.email, pv: payload.pv }
  } catch {
    return null
  }
}
