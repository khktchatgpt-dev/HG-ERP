import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { User } from '@/modules/core/users/users.repo'

const quyen = new Set<string>()
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  canAction: vi.fn(async (_u: unknown, k: string) => quyen.has(k)),
}))

import { assertXemLuong, suaLuong, xemLuong } from './quyen-luong'

const nguoi = (role: string) => ({ id: 'u', role }) as unknown as User

beforeEach(() => quyen.clear())

// 20/10/2026: lương chỉ người quản lý lương LÀM; quản trị viên được XEM (chỉ đọc).
describe('ai xem / sửa lương', () => {
  it('quản trị viên: xem được, không sửa được', async () => {
    expect(await xemLuong(nguoi('admin'))).toBe(true)
    expect(await suaLuong(nguoi('admin'))).toBe(false)
  })

  it('người quản lý lương: xem và sửa', async () => {
    quyen.add('hr.payroll.profile')
    expect(await xemLuong(nguoi('employee'))).toBe(true)
    expect(await suaLuong(nguoi('employee'))).toBe(true)
  })

  it('nhân viên / trưởng phòng khác: không xem', async () => {
    expect(await xemLuong(nguoi('employee'))).toBe(false)
    expect(await xemLuong(nguoi('manager'))).toBe(false)
    await expect(assertXemLuong(nguoi('manager'))).rejects.toThrow(/quản lý lương/)
  })
})
