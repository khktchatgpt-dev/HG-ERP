import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { User } from '@/modules/core/users/users.repo'

vi.mock('@/modules/core/rbac/rbac.service', () => ({
  assertAction: vi.fn(async () => {}),
}))
vi.mock('../cham-cong/cham-cong.repo', () => ({ chamCongRepo: { employees: vi.fn() } }))
vi.mock('./ho-so-luong.repo', () => ({
  hoSoLuongRepo: {
    kyChotCuoi: vi.fn(async () => null),
    banTatCa: vi.fn(async () => []),
    luuBan: vi.fn(async () => 'b1'),
    luuRieng: vi.fn(async () => {}),
  },
}))

import { hoSoLuongRepo } from './ho-so-luong.repo'
import { hoSoLuongService } from './ho-so-luong.service'

const u = { id: 'phung', role: 'employee' } as unknown as User

beforeEach(() => vi.clearAllMocks())

// Sổ lương T9 ghi số TIỀN trừ BH chứ không ghi mức đóng (20/10/2026).
describe('nạp sổ lương: cột Trừ BH', () => {
  it('trừ 415.800 → lương đóng BH 3.960.000, có đóng', async () => {
    await hoSoLuongService.napGhi(u, '2026-10', [
      { employeeId: 'e1', giaTri: { donGia: '350000', truBh: '415800' } },
    ])
    expect(vi.mocked(hoSoLuongRepo.luuBan).mock.calls[0][0]).toMatchObject({
      cachTra: 'daily',
      donGia: 350000,
      luongBh: 3_960_000,
      coBh: true,
    })
  })

  it('trừ 0 → không đóng BH', async () => {
    await hoSoLuongService.napGhi(u, '2026-10', [
      { employeeId: 'e1', giaTri: { luongThang: '7700000', truBh: '0' } },
    ])
    expect(vi.mocked(hoSoLuongRepo.luuBan).mock.calls[0][0]).toMatchObject({
      cachTra: 'monthly',
      luongThang: 7_700_000,
      luongBh: null,
      coBh: false,
    })
  })
})
