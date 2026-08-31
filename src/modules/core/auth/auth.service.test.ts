import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from '@/modules/core/users/users.repo'

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/modules/core/auth/session', () => ({
  createSession: vi.fn(),
  destroySession: vi.fn(),
  getSession: vi.fn(),
}))
vi.mock('@/modules/core/auth/password', () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}))
vi.mock('@/modules/core/users/users.repo', () => ({
  usersRepo: { findById: vi.fn(), findByEmail: vi.fn(), touchLastLogin: vi.fn() },
}))

import { createSession, getSession } from '@/modules/core/auth/session'
import { verifyPassword } from '@/modules/core/auth/password'
import { usersRepo } from '@/modules/core/users/users.repo'
import { authService, passwordVersion } from './auth.service'

const PV = '2026-08-10T00:00:00.000Z'

function user(over: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'nv@hg.com',
    is_active: true,
    deleted_at: null,
    password_changed_at: PV,
    ...over,
  } as User
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSession).mockResolvedValue({
    sub: 'u1',
    email: 'nv@hg.com',
    pv: PV,
    mc: false,
  })
  vi.mocked(usersRepo.findById).mockResolvedValue(user())
})

describe('currentUser', () => {
  it('phiên hợp lệ → trả user', async () => {
    expect(await authService.currentUser()).toMatchObject({ id: 'u1' })
  })

  it('không có cookie → null', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    expect(await authService.currentUser()).toBeNull()
  })

  // Ba ca dưới đây trước 08/2026 đều LỌT: cookie còn hạn 7 ngày là còn dùng
  // được cả hệ thống, vì is_active chỉ được kiểm lúc login.
  it('tài khoản bị khoá giữa phiên → null', async () => {
    vi.mocked(usersRepo.findById).mockResolvedValue(user({ is_active: false }))
    expect(await authService.currentUser()).toBeNull()
  })

  it('tài khoản bị xoá mềm giữa phiên → null', async () => {
    vi.mocked(usersRepo.findById).mockResolvedValue(
      user({ deleted_at: '2026-08-10T01:00:00.000Z' }),
    )
    expect(await authService.currentUser()).toBeNull()
  })

  it('mật khẩu đã đổi sau khi cấp token → null (đăng xuất mọi thiết bị)', async () => {
    vi.mocked(usersRepo.findById).mockResolvedValue(
      user({ password_changed_at: '2026-08-11T00:00:00.000Z' }),
    )
    expect(await authService.currentUser()).toBeNull()
  })

  it('người chưa từng đổi mật khẩu vẫn vào được (pv = chuỗi rỗng)', async () => {
    vi.mocked(getSession).mockResolvedValue({
      sub: 'u1',
      email: 'nv@hg.com',
      pv: '',
      mc: false,
    })
    vi.mocked(usersRepo.findById).mockResolvedValue(user({ password_changed_at: null }))
    expect(await authService.currentUser()).toMatchObject({ id: 'u1' })
  })
})

describe('login — cờ mật khẩu tạm vào token', () => {
  beforeEach(() => {
    vi.mocked(verifyPassword).mockResolvedValue(true)
  })

  it('tài khoản admin vừa cấp → token mang mc=true (proxy giữ ở /doi-mat-khau)', async () => {
    vi.mocked(usersRepo.findByEmail).mockResolvedValue({
      ...user({ must_change_password: true }),
      password_hash: '$hash',
    } as never)
    await authService.login({ email: 'nv@hg.com', password: 'tam1234' })
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ mc: true }))
  })

  it('tài khoản bình thường → mc=false', async () => {
    vi.mocked(usersRepo.findByEmail).mockResolvedValue({
      ...user({ must_change_password: false }),
      password_hash: '$hash',
    } as never)
    await authService.login({ email: 'nv@hg.com', password: 'rieng1234' })
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ mc: false }))
  })
})

describe('passwordVersion', () => {
  it('null → chuỗi rỗng, để claim luôn là string', () => {
    expect(passwordVersion(null)).toBe('')
    expect(passwordVersion(PV)).toBe(PV)
  })

  // Lỗi thật 31/08/2026: đổi mật khẩu xong là bị đá về /login. Mốc lúc GHI do
  // JS sinh (`…Z`), mốc lúc ĐỌC LẠI do Postgres trả (`…+00:00`) — cùng một
  // khoảnh khắc mà so chuỗi thô thì lệch.
  it('hai cách viết cùng một mốc phải ra cùng một claim', () => {
    expect(passwordVersion('2026-08-31T13:01:10.478+00:00')).toBe(
      passwordVersion('2026-08-31T13:01:10.478Z'),
    )
  })

  it('chuỗi không parse được thì giữ nguyên (không gộp mọi token làm một)', () => {
    expect(passwordVersion('rác')).toBe('rác')
  })
})

describe('currentUser — mốc mật khẩu khác cách viết', () => {
  it('token ký theo giờ JS vẫn khớp mốc Postgres đọc lại', async () => {
    vi.mocked(getSession).mockResolvedValue({
      sub: 'u1',
      email: 'nv@hg.com',
      pv: '2026-08-10T00:00:00.000Z',
      mc: false,
    })
    vi.mocked(usersRepo.findById).mockResolvedValue(
      user({ password_changed_at: '2026-08-10T00:00:00+00:00' }),
    )
    expect(await authService.currentUser()).toMatchObject({ id: 'u1' })
  })
})
