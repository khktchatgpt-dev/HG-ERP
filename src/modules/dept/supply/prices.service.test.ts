import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./prices.repo', () => ({
  pricesRepo: {
    list: vi.fn(),
    findById: vi.fn(),
    insert: vi.fn(),
    bulkUpsert: vi.fn(),
    patch: vi.fn(),
    remove: vi.fn(),
    listEffective: vi.fn(),
    lastPurchases: vi.fn(),
  },
}))
vi.mock('./supply.repo', () => ({ suppliersRepo: { findById: vi.fn() } }))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ assertAction: vi.fn() }))

import { pricesService, pickCurrentPrices } from './prices.service'
import { pricesRepo } from './prices.repo'
import { suppliersRepo } from './supply.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { Forbidden } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'

const supply = { id: 'u-cu', role: 'employee' } as unknown as User
const outsider = { id: 'u-x', role: 'employee' } as unknown as User

const row = (
  supplier_id: string,
  material_id: string,
  valid_from: string,
  price = 0,
) => ({ supplier_id, material_id, valid_from, price })

describe('pickCurrentPrices — giá hiện hành = valid_from lớn nhất ≤ ngày tra', () => {
  it('chọn bản ghi mới nhất đã hiệu lực, bỏ giá tương lai', () => {
    const rows = [
      row('s1', 'm1', '2026-01-01', 100),
      row('s1', 'm1', '2026-06-01', 120), // hiện hành
      row('s1', 'm1', '2026-08-01', 150), // tương lai — bỏ
    ]
    const out = pickCurrentPrices(rows, '2026-07-09')
    expect(out).toHaveLength(1)
    expect(out[0].price).toBe(120)
  })

  it('tách riêng từng cặp (NCC, vật tư)', () => {
    const rows = [
      row('s1', 'm1', '2026-01-01', 100),
      row('s2', 'm1', '2026-02-01', 90),
      row('s1', 'm2', '2026-03-01', 500),
    ]
    const out = pickCurrentPrices(rows, '2026-07-09')
    expect(out).toHaveLength(3)
  })

  it('giá hiệu lực đúng hôm nay được tính; toàn bộ tương lai → rỗng', () => {
    expect(pickCurrentPrices([row('s1', 'm1', '2026-07-09')], '2026-07-09')).toHaveLength(
      1,
    )
    expect(pickCurrentPrices([row('s1', 'm1', '2026-07-10')], '2026-07-09')).toHaveLength(
      0,
    )
  })
})

describe('pricesService — quyền + ràng buộc', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('NV ngoài phòng KH-CƯ không thêm được giá → 403', async () => {
    vi.mocked(assertAction).mockRejectedValue(Forbidden('x'))
    await expect(
      pricesService.create(outsider, {
        supplier_id: 's1',
        material_id: 'm1',
        price: 100,
        currency: 'VND',
      }),
    ).rejects.toMatchObject({ status: 403 })
    expect(pricesRepo.insert).not.toHaveBeenCalled()
  })

  it('NCC ngừng giao dịch → 400', async () => {
    vi.mocked(assertAction).mockResolvedValue(undefined)
    vi.mocked(suppliersRepo.findById).mockResolvedValue({ is_active: false } as never)
    await expect(
      pricesService.create(supply, {
        supplier_id: 's1',
        material_id: 'm1',
        price: 100,
        currency: 'VND',
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('trùng (NCC, vật tư, ngày) → 409 PRICE_EXISTS', async () => {
    vi.mocked(assertAction).mockResolvedValue(undefined)
    vi.mocked(suppliersRepo.findById).mockResolvedValue({ is_active: true } as never)
    vi.mocked(pricesRepo.insert).mockResolvedValue({ price: null, duplicate: true })
    await expect(
      pricesService.create(supply, {
        supplier_id: 's1',
        material_id: 'm1',
        price: 100,
        currency: 'VND',
        valid_from: '2026-07-01',
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('compare: chỉ NCC còn giao dịch, sort rẻ trước cùng tiền tệ, kèm mua gần nhất', async () => {
    vi.mocked(pricesRepo.listEffective).mockResolvedValue([
      { ...row('s1', 'm1', '2026-01-01', 120), supplier_active: true },
      { ...row('s2', 'm1', '2026-02-01', 90), supplier_active: true },
      { ...row('s3', 'm1', '2026-03-01', 50), supplier_active: false }, // NCC ngừng — loại
    ] as never)
    vi.mocked(pricesRepo.lastPurchases).mockResolvedValue([
      {
        material_id: 'm1',
        unit_price: 95,
        currency: 'VND',
        po_code: 'PO-2026-0001',
        supplier_name: 'NCC 2',
        at: '2026-06-01',
      },
    ])

    const [entry] = await pricesService.compare(supply, ['m1'])
    expect(entry.offers.map((o) => o.price)).toEqual([90, 120])
    expect(entry.last_purchase?.po_code).toBe('PO-2026-0001')
  })
})

describe('pricesService.bulkCreate — nhập báo giá hàng loạt', () => {
  it('chặn người không thuộc Cung ứng', async () => {
    vi.mocked(assertAction).mockRejectedValue(Forbidden('x'))
    await expect(
      pricesService.bulkCreate(outsider, {
        supplier_id: 's1',
        currency: 'VND',
        lines: [{ material_id: 'm1', price: 100 }],
      }),
    ).rejects.toThrow()
    expect(pricesRepo.bulkUpsert).not.toHaveBeenCalled()
  })

  it('chặn khi NCC đã ngừng giao dịch', async () => {
    vi.mocked(assertAction).mockResolvedValue(undefined)
    vi.mocked(suppliersRepo.findById).mockResolvedValue({ is_active: false } as never)
    await expect(
      pricesService.bulkCreate(supply, {
        supplier_id: 's1',
        currency: 'VND',
        lines: [{ material_id: 'm1', price: 100 }],
      }),
    ).rejects.toThrow()
    expect(pricesRepo.bulkUpsert).not.toHaveBeenCalled()
  })

  it('upsert các dòng với ngày hiệu lực + tệ chung, trả count', async () => {
    vi.mocked(assertAction).mockResolvedValue(undefined)
    vi.mocked(suppliersRepo.findById).mockResolvedValue({ is_active: true } as never)
    vi.mocked(pricesRepo.bulkUpsert).mockResolvedValue(2)

    const res = await pricesService.bulkCreate(supply, {
      supplier_id: 's1',
      currency: 'USD',
      valid_from: '2026-07-01',
      lines: [
        { material_id: 'm1', price: 100 },
        { material_id: 'm2', price: 200, note: 'MOQ 50' },
      ],
    })

    expect(res.count).toBe(2)
    const rows = vi.mocked(pricesRepo.bulkUpsert).mock.calls[0][0]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      supplier_id: 's1',
      material_id: 'm1',
      price: 100,
      currency: 'USD',
      valid_from: '2026-07-01',
      created_by: 'u-cu',
    })
    expect(rows[1]).toMatchObject({ material_id: 'm2', note: 'MOQ 50' })
  })
})
