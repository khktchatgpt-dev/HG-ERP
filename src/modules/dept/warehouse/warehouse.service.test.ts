import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./warehouse.repo', () => ({
  materialsRepo: {
    findById: vi.fn(),
    findByCode: vi.fn(),
    namesInGroup: vi.fn(),
    maxCodeNo: vi.fn(),
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
  vi.mocked(materialsRepo.namesInGroup).mockResolvedValue([])
  vi.mocked(materialsRepo.maxCodeNo).mockResolvedValue(0)
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
    // Gỡ cờ "chờ Kho rà" (0136) là việc của KHO — Cung ứng tự gỡ cờ cho vật tư
    // mình vừa khai vội thì cái cờ vô nghĩa.
    ['needs_review', { needs_review: false }],
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

  /*
   * CỜ "CHỜ KHO RÀ" (0136): form khai nhanh trong đơn gửi needs_review=true —
   * người khai đang vội, Kho rà lại sau. Form danh mục không gửi → false.
   * created_by ghi vết để Kho biết hỏi ai.
   */
  it('khai nhanh từ form đơn: needs_review=true + ghi vết người khai', async () => {
    await materialsService.create(cungUng, {
      name: 'Kính trắng 605x539x5mm',
      unit: 'Tấm',
      min_stock: 0,
      needs_review: true,
    })
    expect(materialsRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ needs_review: true, created_by: cungUng.id }),
    )
  })

  it('khai từ danh mục (không gửi cờ) → needs_review=false', async () => {
    await materialsService.create(cungUng, {
      name: 'Vít 5x30',
      unit: 'con',
      min_stock: 0,
    })
    expect(materialsRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ needs_review: false }),
    )
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

/*
 * HAI CHỐT CHẶN LÚC KHAI VẬT TƯ (02/08).
 *
 * Trước đó chỉ chặn trùng MÃ, còn mã thì gõ tay và tên trùng chỉ cảnh báo mềm.
 * Kết quả là cùng một con long đền có bốn mã — `scripts/materials-dedupe.mjs`
 * viết ra chính để đi dọn hậu quả đó.
 */
describe('materialsService.create — tự cấp mã theo nếp của nhóm', () => {
  beforeEach(() => {
    vi.mocked(assertAction).mockResolvedValue(undefined)
    vi.mocked(materialsRepo.insert).mockResolvedValue(MAT as never)
  })

  const NEW = { name: 'Vít 4x15 bảy màu', unit: 'con', min_stock: 0 }

  it('bỏ trống mã → suy tiền tố từ mã ĐANG DÙNG trong nhóm, số nối tiếp', async () => {
    vi.mocked(materialsRepo.namesInGroup).mockResolvedValue([
      { code: 'NK-0001', name: 'Vít 3x10' },
      { code: 'NK-0002', name: 'Bulon 6x75' },
      { code: 'XX-0009', name: 'Hàng lạc' }, // thiểu số, không thắng
    ] as never)
    vi.mocked(materialsRepo.maxCodeNo).mockResolvedValue(124)

    await materialsService.create(cungUng, { ...NEW, group_name: 'Ngũ kim - phụ kiện' })

    expect(materialsRepo.maxCodeNo).toHaveBeenCalledWith('NK')
    expect(materialsRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NK-0125' }),
    )
  })

  it('nhóm chưa có mã nào → tra bảng theo tên nhóm', async () => {
    await materialsService.create(cungUng, { ...NEW, group_name: 'Inox' })
    expect(materialsRepo.maxCodeNo).toHaveBeenCalledWith('IX')
    expect(materialsRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'IX-0001' }),
    )
  })

  it('nhóm lạ, không suy được gì → VT', async () => {
    await materialsService.create(cungUng, { ...NEW, group_name: 'Hàng linh tinh' })
    expect(materialsRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VT-0001' }),
    )
  })

  it('người dùng khai mã thì TÔN TRỌNG, không tự cấp đè', async () => {
    // Kho vẫn cần gõ tay khi bám mã cũ / mã theo NCC.
    await materialsService.create(kho, { ...NEW, code: 'LEGACY-77' })
    expect(materialsRepo.maxCodeNo).not.toHaveBeenCalled()
    expect(materialsRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'LEGACY-77' }),
    )
  })
})

describe('materialsService.create — chặn cứng trùng tên mức "chắc chắn"', () => {
  beforeEach(() => {
    vi.mocked(assertAction).mockResolvedValue(undefined)
    vi.mocked(materialsRepo.insert).mockResolvedValue(MAT as never)
    vi.mocked(materialsRepo.namesInGroup).mockResolvedValue([
      { code: 'NK-0007', name: 'LĐN 6x16x2 đen' },
    ] as never)
  })

  it.each(['LĐN 6x16x2, màu đen', 'lđn 6x16x2  đen', 'LĐN 6x16x2 đen'])(
    '"%s" → 409, chỉ tên mã cũ ra',
    async (name) => {
      await expect(
        materialsService.create(cungUng, {
          name,
          unit: 'con',
          min_stock: 0,
          group_name: 'Ngũ kim - phụ kiện',
        }),
      ).rejects.toMatchObject({
        status: 409,
        message: expect.stringContaining('NK-0007'),
      })
      expect(materialsRepo.insert).not.toHaveBeenCalled()
    },
  )

  it('KHÁC MÀU vẫn tạo được — chặn nhầm là không khai được hàng mới', async () => {
    await materialsService.create(cungUng, {
      name: 'LĐN 6x16x2 xám',
      unit: 'con',
      min_stock: 0,
      group_name: 'Ngũ kim - phụ kiện',
    })
    expect(materialsRepo.insert).toHaveBeenCalled()
  })

  it('so trùng TRONG NHÓM, không so chéo vật liệu', async () => {
    // namesInGroup đã lọc theo nhóm — nhóm khác thì không thấy nhau.
    vi.mocked(materialsRepo.namesInGroup).mockResolvedValue([] as never)
    await materialsService.create(cungUng, {
      name: 'LĐN 6x16x2 đen',
      unit: 'con',
      min_stock: 0,
      group_name: 'Nhôm',
    })
    expect(materialsRepo.namesInGroup).toHaveBeenCalledWith('Nhôm')
    expect(materialsRepo.insert).toHaveBeenCalled()
  })

  it('tên quá ngắn thì bỏ qua chặn, không chặn bừa', async () => {
    vi.mocked(materialsRepo.namesInGroup).mockResolvedValue([
      { code: 'NK-0001', name: 'Ốc' },
    ] as never)
    await materialsService.create(cungUng, {
      name: 'Ốc',
      unit: 'con',
      min_stock: 0,
      group_name: 'Ngũ kim - phụ kiện',
    })
    expect(materialsRepo.insert).toHaveBeenCalled()
  })
})
