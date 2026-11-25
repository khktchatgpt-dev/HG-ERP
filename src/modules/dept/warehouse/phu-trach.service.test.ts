import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./phu-trach.repo', () => ({
  phuTrachRepo: {
    phanCong: vi.fn(),
    nguoiKho: vi.fn(),
    luu: vi.fn(),
    nhomTheoDon: vi.fn(),
  },
}))
vi.mock('./material-groups.repo', () => ({ materialGroupsRepo: { counts: vi.fn() } }))
vi.mock('@/modules/dept/supply/watch-pos', () => ({ loadWatchPos: vi.fn() }))
vi.mock('./warehouse.service', () => ({
  canViewWarehouse: vi.fn().mockResolvedValue(true),
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  canAction: vi.fn(),
  assertAction: vi.fn(),
}))

import { assertAction } from '@/modules/core/rbac/rbac.service'
import { HttpError } from '@/server/http'
import { phuTrachRepo } from './phu-trach.repo'
import { nguoiGiuTheoDon, phuTrachService } from './phu-trach.service'
import type { User } from '@/modules/core/users/users.repo'

/**
 * Phụ trách nhóm vật tư (0305): chỉ thủ kho lưu được, và chỉ gán cho người phòng
 * Kho — gán nhầm người ngoài là "Của tôi" của Kho mất đơn mà không ai thấy.
 */
const U = { id: 'hao', role: 'manager' } as unknown as User
const NV = { id: 'ha', role: 'employee' } as unknown as User
const NGUOI = [
  { id: 'hao', name: 'Lê Khắc Hào', thu_kho: true },
  { id: 'ha', name: 'Hà Nguyễn Nữ', thu_kho: false },
]
const HA = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.mocked(phuTrachRepo.nguoiKho).mockResolvedValue([...NGUOI, { id: HA, name: 'Hà', thu_kho: false }]) // prettier-ignore
  vi.mocked(phuTrachRepo.luu).mockReset()
  vi.mocked(assertAction).mockReset()
})

describe('phuTrachService.luu', () => {
  it('không có quyền thủ kho → ném, không ghi gì', async () => {
    vi.mocked(assertAction).mockRejectedValue(new HttpError(403, 'Không có quyền'))
    await expect(phuTrachService.luu(U, { items: [{ group_name: 'Bao bì', user_id: HA }] })).rejects.toThrow() // prettier-ignore
    expect(assertAction).toHaveBeenCalledWith(U, 'warehouse.keeper.manage')
    expect(phuTrachRepo.luu).not.toHaveBeenCalled()
  })

  it('có quyền action nhưng không phải thủ kho (trưởng Cung ứng, nhân viên) → 403, không ghi', async () => {
    await expect(
      phuTrachService.luu(NV, { items: [{ group_name: 'Bao bì', user_id: HA }] }),
    ).rejects.toThrow(/thủ kho/)
    expect(phuTrachRepo.luu).not.toHaveBeenCalled()
  })

  it('gán người ngoài phòng Kho → 400 nói nhóm nào, không ghi', async () => {
    const la = '22222222-2222-4222-8222-222222222222'
    await expect(
      phuTrachService.luu(U, { items: [{ group_name: 'Mút - xốp', user_id: la }] }),
    ).rejects.toThrow(/Mút - xốp/)
    expect(phuTrachRepo.luu).not.toHaveBeenCalled()
  })

  it('gán + bỏ gán hợp lệ → ghi một lượt kèm người sửa', async () => {
    const items = [
      { group_name: 'Bao bì', user_id: HA },
      { group_name: 'Gỗ', user_id: null },
    ]
    expect(await phuTrachService.luu(U, { items })).toEqual({ changed: 2 })
    expect(phuTrachRepo.luu).toHaveBeenCalledWith(items, 'hao')
  })
})

describe('nguoiGiuTheoDon', () => {
  it('đơn theo nhóm của dòng; mã không nhóm / đơn không dòng về thủ kho', async () => {
    vi.mocked(phuTrachRepo.nhomTheoDon).mockResolvedValue(
      new Map([
        ['po1', ['Bao bì', 'Gỗ']],
        ['po2', [null]],
      ]),
    )
    const m = await nguoiGiuTheoDon(['po1', 'po2', 'po3'], { 'Bao bì': 'ha' }, 'hao')
    expect(m.get('po1')).toEqual({ giu: ['ha', 'hao'], nhom: ['Bao bì', 'Gỗ'] })
    expect(m.get('po2')).toEqual({ giu: ['hao'], nhom: [] })
    expect(m.get('po3')).toEqual({ giu: ['hao'], nhom: [] })
  })
})
