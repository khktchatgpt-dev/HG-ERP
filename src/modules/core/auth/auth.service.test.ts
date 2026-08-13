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

import { getSession } from '@/modules/core/auth/session'
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
  vi.mocked(getSession).mockResolvedValue({ sub: 'u1', email: 'nv@hg.com', pv: PV })
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
    vi.mocked(getSession).mockResolvedValue({ sub: 'u1', email: 'nv@hg.com', pv: '' })
    vi.mocked(usersRepo.findById).mockResolvedValue(user({ password_changed_at: null }))
    expect(await authService.currentUser()).toMatchObject({ id: 'u1' })
  })
})

describe('passwordVersion', () => {
  it('null → chuỗi rỗng, để claim luôn là string', () => {
    expect(passwordVersion(null)).toBe('')
    expect(passwordVersion(PV)).toBe(PV)
  })
})
