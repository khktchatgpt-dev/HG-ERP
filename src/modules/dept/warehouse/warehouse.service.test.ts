import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./warehouse.repo', () => ({
  materialsRepo: {
    findById: vi.fn(),
    findByCode: vi.fn(),
    insert: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  hasPermission: vi.fn(),
  assertAction: vi.fn(),
  canAction: vi.fn(),
}))

import { materialsService } from './warehouse.service'
import { materialsRepo } from './warehouse.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { Forbidden } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'

const kho = { id: 'u-kho', role: 'employee' } as unknown as User
const cungUng = { id: 'u-cu', role: 'employee' } as unknown as User

const MAT = { id: 'm1', code: 'VT-01', name: 'Ống sắt', is_active: true }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(materialsRepo.findById).mockResolvedValue(MAT as never)
  vi.mocked(materialsRepo.findByCode).mockResolvedValue(null)
  vi.mocked(materialsRepo.patch).mockResolvedValue(MAT as never)
})

describe('materialsService.update — chia chủ quyền theo nhóm trường (view Material Master)', () => {
  it('Kho (full): sửa được cả trường tồn trữ', async () => {
    vi.mocked(canAction).mockResolvedValue(true) // warehouse.material.update

    await materialsService.update(kho, 'm1', {
      min_stock: 20,
      shelf_location: 'A-02',
      barcode: '893456',
    })
    expect(materialsRepo.patch).toHaveBeenCalled()
    expect(assertAction).not.toHaveBeenCalled() // không cần rơi xuống nhánh purchasing
  })

  it('Cung ứng: sửa trường MUA HÀNG + nền → OK', async () => {
    vi.mocked(canAction).mockResolvedValue(false)
    vi.mocked(assertAction).mockResolvedValue(undefined) // update_purchasing pass

    await materialsService.update(cungUng, 'm1', {
      name: 'Ống sắt tròn Ø25',
      default_supplier_id: 's1',
      vat_rate: 10,
      conversion_profile: 'C',
      last_purchase_price: 77000,
    })
    expect(assertAction).toHaveBeenCalledWith(
      cungUng,
      'warehouse.material.update_purchasing',
    )
    expect(materialsRepo.patch).toHaveBeenCalled()
  })

  it.each([
    ['min_stock', { min_stock: 5 }],
    ['shelf_location', { shelf_location: 'B-01' }],
    ['barcode', { barcode: 'x' }],
    ['is_active', { is_active: false }],
  ])('Cung ứng đụng trường tồn trữ "%s" → 403, không patch', async (_k, patch) => {
    vi.mocked(canAction).mockResolvedValue(false)
    vi.mocked(assertAction).mockResolvedValue(undefined)

    await expect(materialsService.update(cungUng, 'm1', patch)).rejects.toMatchObject({
      status: 403,
    })
    expect(materialsRepo.patch).not.toHaveBeenCalled()
  })

  it('không có quyền nào → 403 từ assertAction', async () => {
    vi.mocked(canAction).mockResolvedValue(false)
    vi.mocked(assertAction).mockRejectedValue(Forbidden('x'))

    await expect(
      materialsService.update(cungUng, 'm1', { name: 'y' }),
    ).rejects.toMatchObject({ status: 403 })
  })
})
