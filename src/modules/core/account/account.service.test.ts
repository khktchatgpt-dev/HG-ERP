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
  usersRepo: {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    getPasswordHash: vi.fn(),
    setPasswordHash: vi.fn(),
    updateSelf: vi.fn(),
    touchLastLogin: vi.fn(),
  },
  userAuditRepo: { insert: vi.fn() },
}))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { findById: vi.fn() },
}))

import { createSession } from '@/modules/core/auth/session'
import { hashPassword, verifyPassword } from '@/modules/core/auth/password'
import { usersRepo, userAuditRepo } from '@/modules/core/users/users.repo'
import { accountService } from './account.service'

const me = {
  id: 'u1',
  email: 'nv@hg.com',
  name: 'Nguyễn Văn A',
  phone: null,
  department_id: null,
} as unknown as User

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(usersRepo.getPasswordHash).mockResolvedValue('$hash-cu')
  vi.mocked(usersRepo.setPasswordHash).mockResolvedValue('2026-08-10T00:00:00.000Z')
  vi.mocked(hashPassword).mockResolvedValue('$hash-moi')
  vi.mocked(verifyPassword).mockResolvedValue(true)
})

describe('changePassword', () => {
  const input = { current_password: 'cu-rich-123', new_password: 'moi-toanh-456' }

  it('sai mật khẩu hiện tại → 400, không ghi hash mới', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false)
    await expect(accountService.changePassword(me, input)).rejects.toMatchObject({
      status: 400,
      code: 'WRONG_PASSWORD',
    })
    expect(usersRepo.setPasswordHash).not.toHaveBeenCalled()
  })

  it('đổi xong cấp lại cookie theo đời mật khẩu MỚI', async () => {
    await accountService.changePassword(me, input)
    expect(usersRepo.setPasswordHash).toHaveBeenCalledWith('u1', '$hash-moi')
    // pv phải là mốc vừa ghi, không phải mốc cũ — sai chỗ này là người vừa đổi
    // mật khẩu bị chính hệ thống đá về /login.
    expect(createSession).toHaveBeenCalledWith({
      sub: 'u1',
      email: 'nv@hg.com',
      pv: '2026-08-10T00:00:00.000Z',
    })
  })

  it('ghi nhật ký password_change', async () => {
    await accountService.changePassword(me, input)
    expect(userAuditRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        target_user_id: 'u1',
        actor_id: 'u1',
        action: 'password_change',
      }),
    )
  })
})

describe('updateProfile', () => {
  it('không có gì đổi → không đụng DB, không ghi nhật ký', async () => {
    const out = await accountService.updateProfile(me, { name: 'Nguyễn Văn A' })
    expect(out).toBe(me)
    expect(usersRepo.updateSelf).not.toHaveBeenCalled()
    expect(userAuditRepo.insert).not.toHaveBeenCalled()
  })

  it('chỉ gửi những trường thật sự đổi', async () => {
    vi.mocked(usersRepo.updateSelf).mockResolvedValue({
      ...me,
      phone: '0905123456',
    } as User)
    await accountService.updateProfile(me, {
      name: 'Nguyễn Văn A',
      phone: '0905123456',
    })
    expect(usersRepo.updateSelf).toHaveBeenCalledWith('u1', { phone: '0905123456' })
    expect(userAuditRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'profile_update',
        before: { phone: null },
        after: { phone: '0905123456' },
      }),
    )
  })
})
