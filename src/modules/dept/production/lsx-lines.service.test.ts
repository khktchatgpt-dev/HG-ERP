import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./production.repo', () => ({
  productionRepo: { findById: vi.fn(), patch: vi.fn() },
}))
vi.mock('./lsx-lines.repo', () => ({
  lsxLinesRepo: {
    listLines: vi.fn(),
    listGroups: vi.fn(),
    replaceAll: vi.fn(),
    markChanged: vi.fn(),
    deleteGroups: vi.fn(),
  },
}))
vi.mock('./jobs.repo', () => ({ jobsRepo: { listByLsx: vi.fn() } }))
// Chụp bù định mức khi lưu dòng lệnh đã phát (0142) — mock, không chạm DB.
vi.mock('./bom-snapshot.repo', () => ({
  bomSnapshotRepo: { ensureForOrder: vi.fn().mockResolvedValue(0) },
}))
vi.mock('./notify-targets', () => ({ lsxAudienceIds: vi.fn(async () => []) }))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: {
    findById: vi.fn(),
    listByProductionOrder: vi.fn(),
    listLinesByOrders: vi.fn(),
  },
}))
vi.mock('@/modules/dept/sales/sales.repo', () => ({
  customersRepo: { findById: vi.fn() },
}))
vi.mock('@/modules/dept/technical/technical.repo', () => ({
  productsRepo: { listByIds: vi.fn(async () => []) },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ assertAction: vi.fn() }))
vi.mock('@/events/bus', () => ({ emit: vi.fn() }))

import { lsxLinesService, profileSnapshot } from './lsx-lines.service'
import { lsxLinesRepo } from './lsx-lines.repo'
import { productionRepo } from './production.repo'
import { jobsRepo } from './jobs.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import { customersRepo } from '@/modules/dept/sales/sales.repo'
import { emit } from '@/events/bus'
import type { User } from '@/modules/core/users/users.repo'

const sales = { id: 'u-sales', role: 'employee' } as unknown as User

const LSX = {
  id: 'lsx1',
  code: 'LSX-01',
  customer_id: 'c1',
  // Người LẬP lệnh = chính `sales` đang thao tác (0119): của ai người đó sửa.
  created_by: 'u-sales',
  status: 'approved',
  revision: 1,
}

const line = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  production_order_id: 'lsx1',
  group_id: 'g1',
  product_id: 'p1',
  sales_order_line_id: 'ol1',
  product_code: 'SP1',
  name_foreign: null,
  name_vi: 'Ghế A',
  name_customs: null,
  barcode: null,
  unit: 'cái',
  qty: 100,
  packing: null,
  cbm: null,
  ship_date: null,
  ship_label: null,
  specs: {},
  checks: {},
  extras: {},
  note: null,
  important_note: null,
  image_file_id: null,
  sort_order: 0,
  changed_in_rev: null,
  ...over,
})

/** Payload lưu: một nhóm, một dòng — tiện đổi số lượng để thử revision. */
const payload = (qty: number) => ({
  groups: [
    {
      id: 'g1',
      lines: [{ id: 'l1', product_code: 'SP1', unit: 'cái', qty, specs: {} }],
    },
  ],
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(productionRepo.patch).mockResolvedValue(LSX as never)
  vi.mocked(customersRepo.findById).mockResolvedValue({
    id: 'c1',
    lsx_template: { preset: 'merxx' },
  } as never)
  vi.mocked(lsxLinesRepo.listGroups).mockResolvedValue([{ id: 'g1' }] as never)
  vi.mocked(jobsRepo.listByLsx).mockResolvedValue([])
})

describe('lsxLinesService.save — bản chỉnh sửa (0114)', () => {
  it('lệnh ĐÃ DUYỆT + dòng đổi số lượng → revision +1, đánh dấu dòng, báo xưởng', async () => {
    vi.mocked(lsxLinesRepo.listLines)
      .mockResolvedValueOnce([line({ qty: 100 })] as never) // trước khi lưu
      .mockResolvedValue([line({ qty: 80 })] as never) // sau khi lưu

    await lsxLinesService.save(sales, 'lsx1', payload(80))

    expect(productionRepo.patch).toHaveBeenCalledWith(
      'lsx1',
      expect.objectContaining({ revision: 2 }),
    )
    expect(lsxLinesRepo.markChanged).toHaveBeenCalledWith(['l1'], 2)
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'lsx.revised', changed_lines: 1 }),
    )
  })

  it('không có gì đổi → KHÔNG tăng revision, không báo', async () => {
    vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([line({ qty: 100 })] as never)
    await lsxLinesService.save(sales, 'lsx1', payload(100))
    expect(productionRepo.patch).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('lệnh CHƯA DUYỆT → Sales còn đang soạn, sửa không tính là bản chỉnh sửa', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'pending_approval',
    } as never)
    vi.mocked(lsxLinesRepo.listLines)
      .mockResolvedValueOnce([line({ qty: 100 })] as never)
      .mockResolvedValue([line({ qty: 60 })] as never)

    await lsxLinesService.save(sales, 'lsx1', payload(60))
    expect(productionRepo.patch).not.toHaveBeenCalled()
  })

  it('xoá dòng đã vào sản xuất → 400, không ghi đè', async () => {
    vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([line()] as never)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      { id: 'j1', production_order_line_id: 'l1', status: 'doing' },
    ] as never)
    await expect(
      lsxLinesService.save(sales, 'lsx1', {
        groups: [
          {
            id: 'g1',
            lines: [{ product_code: 'SP-moi', unit: 'cái', qty: 5, specs: {} }],
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(lsxLinesRepo.replaceAll).not.toHaveBeenCalled()
  })

  it('lệnh không còn dòng nào → 400', async () => {
    vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([])
    await expect(
      lsxLinesService.save(sales, 'lsx1', { groups: [{ id: 'g1', lines: [] }] }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('lệnh đã hoàn thành → 400', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'completed',
    } as never)
    await expect(lsxLinesService.save(sales, 'lsx1', payload(10))).rejects.toMatchObject({
      status: 400,
    })
  })
})

describe('lsxLinesService.seedFromOrders', () => {
  it('chỉ nạp đơn CHƯA có nhóm — không đụng nhóm đã soạn', async () => {
    vi.mocked(lsxLinesRepo.listGroups).mockResolvedValue([
      { id: 'g1', sales_order_id: 'o1' },
    ] as never)
    vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([line()] as never)
    vi.mocked(ordersRepo.listByProductionOrder).mockResolvedValue([
      { id: 'o1', code: 'DH-01' },
      { id: 'o2', code: 'DH-02', customer_po_no: 'PO-2', due_date: '2026-09-01' },
    ] as never)
    vi.mocked(ordersRepo.findById).mockResolvedValue({
      id: 'o2',
      code: 'DH-02',
      customer_po_no: 'PO-2',
      due_date: '2026-09-01',
    } as never)
    vi.mocked(ordersRepo.listLinesByOrders).mockResolvedValue([
      {
        id: 'ol2',
        order_id: 'o2',
        product_id: 'p2',
        product_code: 'SP2',
        product_name: 'Bàn B',
        product_unit: 'cái',
        qty: 20,
        note: null,
        image_file_id: null,
      },
    ] as never)

    await lsxLinesService.seedFromOrders('lsx1')

    const [, groups] = vi.mocked(lsxLinesRepo.replaceAll).mock.calls[0]
    expect(groups).toHaveLength(2) // nhóm cũ giữ nguyên + nhóm mới của o2
    expect(groups[1].sales_order_id).toBe('o2')
    expect(groups[1].lines[0]).toMatchObject({ product_code: 'SP2', qty: 20 })
  })

  it('mọi đơn đã có nhóm → không ghi gì', async () => {
    vi.mocked(lsxLinesRepo.listGroups).mockResolvedValue([
      { id: 'g1', sales_order_id: 'o1' },
    ] as never)
    vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([])
    vi.mocked(ordersRepo.listByProductionOrder).mockResolvedValue([
      { id: 'o1', code: 'DH-01' },
    ] as never)
    await lsxLinesService.seedFromOrders('lsx1')
    expect(lsxLinesRepo.replaceAll).not.toHaveBeenCalled()
  })
})

/**
 * 0117 — CHỐNG TRÔI LỆCH: dữ liệu NẠP vào dòng và ẢNH CHỤP hồ sơ mà màn soạn
 * dùng để đối chiếu phải ra cùng một giá trị. Lệch nhau là mọi ô hiện "khác hồ
 * sơ SP" trong khi Sales chưa đụng vào gì.
 */
describe('profileSnapshot ≡ dữ liệu draftFromOrders nạp vào dòng', () => {
  const PRODUCT = {
    id: 'p1',
    code: 'SP1',
    name_foreign: 'Alicante Chair',
    barcode: '893850',
    customer_item_code: 'RS-889',
    tech_spec: { machine: 'Dây dù kem', paint: 'PT-7476' },
    packing: {
      qty_per_carton: 4,
      pack_unit_label: 'thùng',
      carton_l_cm: 120,
      carton_w_cm: 80,
      carton_h_cm: 60,
    },
  }

  it('packing / cbm / specs của snapshot khớp đúng dòng vừa nạp', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue({
      id: 'o1',
      code: 'DH-01',
      customer_po_no: 'PO-1',
      due_date: '2026-11-20',
    } as never)
    vi.mocked(ordersRepo.listLinesByOrders).mockResolvedValue([
      {
        id: 'ol1',
        order_id: 'o1',
        product_id: 'p1',
        product_code: 'SP1',
        product_name: 'Ghế Alicante',
        product_unit: 'cái',
        qty: 10,
        note: null,
        image_file_id: null,
      },
    ] as never)
    vi.mocked(productsRepo.listByIds).mockResolvedValue([PRODUCT] as never)

    const [group] = await lsxLinesService.draftFromOrders(['o1'])
    const line = group.lines[0]
    const snap = profileSnapshot(PRODUCT as never, 'cái')

    expect(line.packing).toBe(snap.packing)
    expect(line.cbm).toBe(snap.cbm)
    expect(line.specs).toEqual(snap.specs)
    expect(line.name_foreign).toBe(snap.name_foreign)
    expect(line.barcode).toBe(snap.barcode)
    expect(line.customer_item_code).toBe(snap.customer_item_code)
  })

  it('gap mang đúng tab hồ sơ để dẫn Sales tới chỗ sửa', () => {
    const snap = profileSnapshot(
      { ...PRODUCT, barcode: null, packing: {} } as never,
      'cái',
    )
    const byKey = Object.fromEntries(snap.gaps.map((g) => [g.key, g.tab]))
    expect(byKey.barcode).toBe('thong-so')
    // Đóng gói đã gộp vào tab Hồ sơ (13/08/2026) — chip dẫn về route gốc của SP.
    expect(byKey.packing).toBe('ho-so')
    expect(byKey.cbm).toBe('ho-so')
    expect(byKey.nem).toBe('thong-so')
  })
})
