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

  it('Cung ứng khai được mẫu đơn + kg/m — quyết định bộ cột và cách tính tiền', async () => {
    vi.mocked(canAction).mockResolvedValue(false)
    vi.mocked(assertAction).mockResolvedValue(undefined)

    await materialsService.update(cungUng, 'm1', {
      po_template: 'aluminium',
      kg_per_m: 0.248,
      default_bar_length_m: 5.65,
    })
    expect(materialsRepo.patch).toHaveBeenCalled()
  })
})

/*
 * HỒI QUY: create() từng NUỐT po_template / kg_per_m / default_bar_length_m.
 * Schema nhận, form "Vật tư mới" trong đơn đặt vẫn gửi po_template lên, nhưng
 * CreateInput không khai nên chúng rơi ở service và DB nhận null — vật tư vừa
 * khai xong đã mang nhãn "chưa khai mẫu", chỉ lộ ra ở lần đặt sau.
 */
describe('materialsService.create — không được rơi trường nào xuống repo', () => {
  beforeEach(() => {
    vi.mocked(assertAction).mockResolvedValue(undefined)
    vi.mocked(materialsRepo.insert).mockResolvedValue(MAT as never)
  })

  it('chuyển nguyên mẫu đơn + thông số nhôm xuống repo', async () => {
    await materialsService.create(cungUng, {
      code: 'NH-999',
      name: 'La nhôm 22x2',
      unit: 'cây',
      min_stock: 0,
      po_template: 'aluminium',
      kg_per_m: 0.119,
      default_bar_length_m: 6,
    })

    expect(materialsRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        po_template: 'aluminium',
        kg_per_m: 0.119,
        default_bar_length_m: 6,
      }),
    )
  })

  it('không khai thì về null, không phải undefined (cột vẫn được ghi rõ)', async () => {
    await materialsService.create(cungUng, {
      code: 'NK-01',
      name: 'Vít 4x15',
      unit: 'con',
      min_stock: 0,
    })

    const row = vi.mocked(materialsRepo.insert).mock.calls[0][0]
    expect(row).toMatchObject({
      po_template: null,
      kg_per_m: null,
      default_bar_length_m: null,
    })
  })

  it('trùng mã → 409, không insert', async () => {
    vi.mocked(materialsRepo.findByCode).mockResolvedValue(MAT as never)

    await expect(
      materialsService.create(cungUng, {
        code: 'VT-01',
        name: 'Ống sắt',
        unit: 'cây',
        min_stock: 0,
      }),
    ).rejects.toMatchObject({ status: 409 })
    expect(materialsRepo.insert).not.toHaveBeenCalled()
  })
})
