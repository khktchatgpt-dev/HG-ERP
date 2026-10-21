import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { User } from '@/modules/core/users/users.repo'

const quyen = new Set<string>()
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  assertAction: vi.fn(async (_u: unknown, k: string) => {
    if (!quyen.has(k)) throw Object.assign(new Error('403'), { status: 403 })
  }),
  canAction: vi.fn(async (_u: unknown, k: string) => quyen.has(k)),
}))
vi.mock('./hop-dong.repo', () => ({
  hopDongRepo: {
    cuaNguoi: vi.fn(),
    mot: vi.fn(),
    them: vi.fn(),
    sua: vi.fn(),
    huy: vi.fn(),
  },
}))
vi.mock('./bien-dong.repo', () => ({ bienDongRepo: { ghi: vi.fn() } }))
vi.mock('@/modules/core/files/files.repo', () => ({ filesRepo: { getById: vi.fn() } }))

import { hopDongRepo } from './hop-dong.repo'
import { hopDongService } from './hop-dong.service'

const u = { id: 'u1', role: 'employee' } as unknown as User
const hd = {
  so: 'HĐ-01',
  loai: 'indefinite' as const,
  tuNgay: '2026-09-16',
  denNgay: null,
  chucDanh: 'Công nhân',
  luong: 6_000_000,
  ghiChu: null,
  fileId: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  quyen.clear()
  vi.mocked(hopDongRepo.cuaNguoi).mockResolvedValue([])
})

// Lương là bí mật (0255, 20/10/2026): Nhân sự làm hợp đồng nhưng không thấy / ghi ô lương.
describe('lương ghi trên hợp đồng theo quyền lương mật', () => {
  it('Nhân sự thêm HĐ: mức lương gửi lên bị bỏ (không ghi)', async () => {
    quyen.add('hr.employee.private')
    await hopDongService.them(u, 'e1', { ...hd })
    expect(vi.mocked(hopDongRepo.them).mock.calls[0][0]).toMatchObject({ luong: null })
  })

  it('Nhân sự sửa HĐ: giữ nguyên mức lương đang ghi', async () => {
    quyen.add('hr.employee.private')
    vi.mocked(hopDongRepo.mot).mockResolvedValue({
      id: 'h1',
      employeeId: 'e1',
      so: 'HĐ-01',
      loai: 'indefinite',
      tuNgay: '2026-09-16',
      denNgay: null,
      chucDanh: 'Công nhân',
      luong: 7_500_000,
      huy: false,
    } as never)
    await hopDongService.sua(u, 'h1', { ...hd, luong: null })
    expect(vi.mocked(hopDongRepo.sua).mock.calls[0][1]).toMatchObject({
      salary: 7_500_000,
    })
  })

  it('người có quyền lương: ghi đúng mức lương nhập', async () => {
    quyen.add('hr.employee.private')
    quyen.add('hr.payroll.profile')
    await hopDongService.them(u, 'e1', { ...hd })
    expect(vi.mocked(hopDongRepo.them).mock.calls[0][0]).toMatchObject({
      luong: 6_000_000,
    })
  })
})
