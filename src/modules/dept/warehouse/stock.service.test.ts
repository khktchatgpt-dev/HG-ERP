import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./stock.repo', () => ({
  stockRepo: { list: vi.fn(), onHand: vi.fn() },
  movementsRepo: { insert: vi.fn(), list: vi.fn() },
  docsRepo: {
    nextCode: vi.fn(),
    insert: vi.fn(),
    list: vi.fn(),
    findById: vi.fn(),
    listLines: vi.fn(),
  },
  warehousesRepo: { mainId: vi.fn() },
  stocktakeRepo: { insertLines: vi.fn(), listByDoc: vi.fn() },
  insertMovements: vi.fn(),
  onHandMany: vi.fn(),
  stockInfoMany: vi.fn(),
  issuedByLsx: vi.fn(),
  issuedByLsxIds: vi.fn(),
  lsxRemainingByIds: vi.fn(),
  lsxNeeds: vi.fn(),
}))
vi.mock('@/modules/dept/production/components.service', () => ({
  componentMaterialNeeds: vi.fn(),
}))
vi.mock('@/modules/dept/production/components.repo', () => ({
  componentsRepo: { listForReserve: vi.fn() },
}))
vi.mock('./warehouse.repo', () => ({ materialsRepo: { findById: vi.fn() } }))
vi.mock('./warehouse.service', () => ({ isWarehouseUser: vi.fn() }))
vi.mock('@/modules/dept/supply/supply.repo', () => ({
  RECEIVABLE: ['approved', 'ordered', 'confirmed', 'in_transit', 'partial'],
  supplyRepo: {
    listOpenPos: vi.fn(),
    lineStatus: vi.fn(),
    refreshStatusFromReceipts: vi.fn(),
    findPoCode: vi.fn(),
    poStatus: vi.fn(),
  },
}))
vi.mock('@/modules/dept/production/production.repo', () => ({
  productionRepo: { findById: vi.fn(), listCommittedIds: vi.fn() },
}))
vi.mock('@/modules/core/users/users.repo', () => ({ usersRepo: { list: vi.fn() } }))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { list: vi.fn() },
}))
vi.mock('@/modules/dept/supply/suppliers.service', () => ({
  SUPPLY_DEPT_NAMES: new Set(['Kế Hoạch Sản Xuất-cung ứng', 'Cung Ứng - Mua Hàng']),
}))
vi.mock('@/lib/reserved-stock', () => ({ computeReservedByMaterial: vi.fn() }))
vi.mock('@/events/bus', () => ({ emit: vi.fn() }))

import { stockService, smartLsxNeeds } from './stock.service'
import {
  docsRepo,
  insertMovements,
  issuedByLsx,
  issuedByLsxIds,
  lsxRemainingByIds,
  lsxNeeds as lsxNeedsRepo,
  onHandMany,
  stockInfoMany,
  stocktakeRepo,
  warehousesRepo,
} from './stock.repo'
import { componentsRepo } from '@/modules/dept/production/components.repo'
import { computeReservedByMaterial } from '@/lib/reserved-stock'
import { componentMaterialNeeds } from '@/modules/dept/production/components.service'
import { materialsRepo } from './warehouse.repo'
import { isWarehouseUser } from './warehouse.service'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { emit } from '@/events/bus'
import type { User } from '@/modules/core/users/users.repo'

const admin = { id: 'u1', role: 'admin', department_id: null } as unknown as User
const MAT = { id: 'm1', name: 'Nhôm 25x50', is_active: true, shelf_location: 'A-01' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isWarehouseUser).mockResolvedValue(true)
  vi.mocked(materialsRepo.findById).mockResolvedValue(MAT as never)
  vi.mocked(warehousesRepo.mainId).mockResolvedValue('wh-main')
  vi.mocked(docsRepo.insert).mockResolvedValue({ id: 'doc1', code: 'PNK-2026-0001' })
  vi.mocked(usersRepo.list).mockResolvedValue([])
  vi.mocked(departmentsRepo.list).mockResolvedValue([])
  vi.mocked(stockInfoMany).mockResolvedValue([])
  // Mặc định KHÔNG có LSX nào đang giữ chỗ → guard khả dụng không chặn.
  vi.mocked(productionRepo.listCommittedIds).mockResolvedValue([])
  vi.mocked(computeReservedByMaterial).mockReturnValue(new Map())
  // Mặc định: PO đang mở + LSX đang SX — case hợp lệ; test guard override riêng.
  vi.mocked(supplyRepo.poStatus).mockResolvedValue({
    code: 'PO-2026-0001',
    status: 'ordered',
  })
  vi.mocked(productionRepo.findById).mockResolvedValue({
    id: 'lsx1',
    code: 'LSX-2026-01',
    status: 'in_progress',
  } as never)
})

describe('createReceiptDoc — phiếu nhập (FR-WMS-02/03, BR-08/10)', () => {
  it('nhập theo PO: gắn po_line_id, ref_type=po, tính lại trạng thái PO', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0001')
    vi.mocked(supplyRepo.refreshStatusFromReceipts).mockResolvedValue('received')
    vi.mocked(supplyRepo.findPoCode).mockResolvedValue('PO-2026-0001')

    const r = await stockService.createReceiptDoc(admin, {
      po_id: 'po1',
      lines: [
        {
          material_id: 'm1',
          qty: 60,
          qty_rejected: 5,
          qc_status: 'partial',
          po_line_id: 'pl1',
        },
      ],
    })

    expect(r.po_status).toBe('received')
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0]).toMatchObject({
      direction: 'in',
      qty: 60, // số ĐẠT vào tồn
      qty_rejected: 5, // QC loại — không vào tồn (BR-10, view stock chỉ cộng qty)
      ref_type: 'po',
      po_line_id: 'pl1',
      warehouse_id: 'wh-main',
      doc_id: 'doc1',
    })
    expect(supplyRepo.refreshStatusFromReceipts).toHaveBeenCalledWith('po1')
  })

  it('nhập theo PO mà dòng thiếu po_line_id → chặn', async () => {
    await expect(
      stockService.createReceiptDoc(admin, {
        po_id: 'po1',
        lines: [{ material_id: 'm1', qty: 10 }],
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('mua ngoài: ref_type=external, không đụng PO', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0002')
    await stockService.createReceiptDoc(admin, {
      lines: [{ material_id: 'm1', qty: 10 }],
    })
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0].ref_type).toBe('external')
    expect(supplyRepo.refreshStatusFromReceipts).not.toHaveBeenCalled()
  })

  it('vật tư ngừng sử dụng → chặn', async () => {
    vi.mocked(materialsRepo.findById).mockResolvedValue({
      ...MAT,
      is_active: false,
    } as never)
    await expect(
      stockService.createReceiptDoc(admin, { lines: [{ material_id: 'm1', qty: 1 }] }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it.each(['pending_approval', 'cancelled', 'received'])(
    'PO ở trạng thái %s → chặn nhập (vòng đời theo thực tế)',
    async (status) => {
      vi.mocked(supplyRepo.poStatus).mockResolvedValue({ code: 'PO-X', status })
      await expect(
        stockService.createReceiptDoc(admin, {
          po_id: 'po1',
          lines: [{ material_id: 'm1', qty: 10, po_line_id: 'pl1' }],
        }),
      ).rejects.toMatchObject({ status: 400 })
      expect(insertMovements).not.toHaveBeenCalled()
    },
  )

  it('PO không tồn tại → 404', async () => {
    vi.mocked(supplyRepo.poStatus).mockResolvedValue(null)
    await expect(
      stockService.createReceiptDoc(admin, {
        po_id: 'po-x',
        lines: [{ material_id: 'm1', qty: 10, po_line_id: 'pl1' }],
      }),
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('createIssueDoc — phiếu xuất (FR-WMS-05/06/08, BR-09)', () => {
  beforeEach(() => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PXK-2026-0001')
    vi.mocked(docsRepo.insert).mockResolvedValue({ id: 'doc2', code: 'PXK-2026-0001' })
  })

  it('BR-09: xuất theo LSX thiếu production_order_id → chặn', async () => {
    await expect(
      stockService.createIssueDoc(admin, {
        kind: 'lsx',
        lines: [{ material_id: 'm1', qty: 1 }],
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it.each(['pending_approval', 'rejected', 'completed', 'cancelled'])(
    'LSX ở trạng thái %s → chặn xuất (chỉ đã duyệt / đang SX)',
    async (status) => {
      vi.mocked(productionRepo.findById).mockResolvedValue({
        id: 'lsx1',
        code: 'LSX-2026-01',
        status,
      } as never)
      await expect(
        stockService.createIssueDoc(admin, {
          kind: 'lsx',
          production_order_id: 'lsx1',
          lines: [{ material_id: 'm1', qty: 1 }],
        }),
      ).rejects.toMatchObject({ status: 400 })
      expect(insertMovements).not.toHaveBeenCalled()
    },
  )

  it('LSX approved (chưa vào SX) vẫn xuất được — xưởng nhận VT trước khi bắt đầu', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      id: 'lsx1',
      code: 'LSX-2026-01',
      status: 'approved',
    } as never)
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 100]]))
    await expect(
      stockService.createIssueDoc(admin, {
        kind: 'lsx',
        production_order_id: 'lsx1',
        lines: [{ material_id: 'm1', qty: 5 }],
      }),
    ).resolves.toMatchObject({ code: 'PXK-2026-0001' })
  })

  it('xuất tự do (daily) không đụng guard LSX', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue(null)
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 100]]))
    await expect(
      stockService.createIssueDoc(admin, {
        kind: 'daily',
        lines: [{ material_id: 'm1', qty: 5 }],
      }),
    ).resolves.toMatchObject({ code: 'PXK-2026-0001' })
  })

  it('guard tồn: cộng dồn nhiều dòng cùng vật tư, vượt tồn → chặn', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 10]]))
    await expect(
      stockService.createIssueDoc(admin, {
        kind: 'daily',
        lines: [
          { material_id: 'm1', qty: 6 },
          { material_id: 'm1', qty: 5 }, // tổng 11 > tồn 10
        ],
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('xuất theo LSX: movement gắn production_order_id + ref_type=lsx', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 100]]))
    await stockService.createIssueDoc(admin, {
      kind: 'lsx',
      production_order_id: 'lsx1',
      lines: [{ material_id: 'm1', qty: 40 }],
    })
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0]).toMatchObject({
      direction: 'out',
      ref_type: 'lsx',
      production_order_id: 'lsx1',
    })
  })

  it('FR-WMS-08: tồn rơi dưới min sau xuất → emit warehouse.stock.low cho admin/manager + phòng Cung ứng', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 100]]))
    vi.mocked(stockInfoMany).mockResolvedValue([
      { material_id: 'm1', code: 'VT-01', name: 'Nhôm', on_hand: 3, min_stock: 20 },
    ])
    vi.mocked(departmentsRepo.list).mockResolvedValue([
      { id: 'd-sup', name: 'Cung Ứng - Mua Hàng' },
      { id: 'd-kho', name: 'Kho' },
    ] as never)
    vi.mocked(usersRepo.list).mockResolvedValue([
      { id: 'boss', role: 'manager', department_id: null },
      { id: 'sup1', role: 'employee', department_id: 'd-sup' }, // NV Cung ứng
      { id: 'kho1', role: 'employee', department_id: 'd-kho' }, // NV Kho — không nhận
    ] as never)

    await stockService.createIssueDoc(admin, {
      kind: 'daily',
      lines: [{ material_id: 'm1', qty: 97 }],
    })

    const evt = vi
      .mocked(emit)
      .mock.calls.map((c) => c[0])
      .find((e) => e.name === 'warehouse.stock.low') as {
      on_hand: number
      notify_ids: string[]
    }
    expect(evt).toBeTruthy()
    expect(evt.on_hand).toBe(3)
    // manager + nhân viên phòng Cung ứng; NV phòng khác bị loại. Không dùng excludeId.
    expect(evt.notify_ids).toEqual(['boss', 'sup1'])
  })
})

describe('smartLsxNeeds — ưu tiên bảng chi tiết, fallback BOM (plan-lsx-components P3)', () => {
  it('có bảng chi tiết → source=components, qty theo số cây, trừ đã xuất', async () => {
    vi.mocked(componentMaterialNeeds).mockResolvedValue([
      {
        material_id: 'm1',
        material_code: 'VT-01',
        material_name: 'Ống sắt tròn 25',
        unit: 'cây',
        total_components: 144,
        kg_needed: 94,
        bars_needed: 21,
        incomplete: false,
      },
    ])
    vi.mocked(issuedByLsx).mockResolvedValue(new Map([['m1', 5]]))

    const out = await smartLsxNeeds('lsx1')

    expect(out[0]).toMatchObject({
      material_id: 'm1',
      qty_needed: 21, // ưu tiên số cây
      qty_issued: 5,
      qty_remaining: 16,
      kg_needed: 94,
      bars_needed: 21,
      source: 'components',
    })
    expect(lsxNeedsRepo).not.toHaveBeenCalled()
  })

  it('thiếu hệ số cây → qty rơi về kg; thiếu cả hai → số chi tiết', async () => {
    vi.mocked(componentMaterialNeeds).mockResolvedValue([
      {
        material_id: 'm1',
        material_code: 'VT-01',
        material_name: 'x',
        unit: 'kg',
        total_components: 100,
        kg_needed: 40,
        bars_needed: null,
        incomplete: true,
      },
      {
        material_id: 'm2',
        material_code: 'VT-02',
        material_name: 'y',
        unit: 'cai',
        total_components: 10,
        kg_needed: null,
        bars_needed: null,
        incomplete: true,
      },
    ])
    vi.mocked(issuedByLsx).mockResolvedValue(new Map())

    const out = await smartLsxNeeds('lsx1')
    expect(out[0].qty_needed).toBe(40) // kg
    expect(out[1].qty_needed).toBe(10) // số chi tiết
    expect(out[0].incomplete).toBe(true)
  })

  it('chưa nhập bảng chi tiết → fallback BOM×SL (view) như cũ', async () => {
    vi.mocked(componentMaterialNeeds).mockResolvedValue(null)
    vi.mocked(lsxNeedsRepo).mockResolvedValue([
      {
        production_order_id: 'lsx1',
        material_id: 'm1',
        material_code: 'VT-01',
        material_name: 'x',
        unit: 'kg',
        qty_needed: 12,
        qty_issued: 0,
        qty_remaining: 12,
      },
    ])

    const out = await smartLsxNeeds('lsx1')
    expect(out[0].qty_needed).toBe(12)
    expect(out[0].source).toBeUndefined() // nhánh BOM giữ nguyên shape cũ
    expect(issuedByLsx).not.toHaveBeenCalled()
  })
})

describe('createStocktakeDoc — phiếu kiểm kê (0077)', () => {
  beforeEach(() => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('KK-2026-0001')
    vi.mocked(docsRepo.insert).mockResolvedValue({ id: 'doc-kk', code: 'KK-2026-0001' })
  })

  it('tồn sổ đọc server-side; biên bản đủ mọi dòng; movement adjust CHỈ dòng lệch', async () => {
    // m1: sổ 10 đếm 7 (thiếu 3 → out); m2: sổ 5 đếm 8 (thừa 3 → in); m3: khớp 20.
    vi.mocked(onHandMany).mockResolvedValue(
      new Map([
        ['m1', 10],
        ['m2', 5],
        ['m3', 20],
      ]),
    )

    const r = await stockService.createStocktakeDoc(admin, {
      reason: 'Kiểm kê định kỳ',
      lines: [
        { material_id: 'm1', counted_qty: 7 },
        { material_id: 'm2', counted_qty: 8 },
        { material_id: 'm3', counted_qty: 20 },
      ],
    })

    expect(r).toMatchObject({ code: 'KK-2026-0001', diff_count: 2 })

    // Biên bản: đủ 3 dòng, kể cả dòng khớp — diff lưu thẳng.
    const bienBan = vi.mocked(stocktakeRepo.insertLines).mock.calls[0][0]
    expect(bienBan).toHaveLength(3)
    expect(bienBan[0]).toMatchObject({ system_qty: 10, counted_qty: 7, diff: -3 })
    expect(bienBan[2]).toMatchObject({ system_qty: 20, counted_qty: 20, diff: 0 })

    // Sổ cái: chỉ 2 movement điều chỉnh — out cho thiếu, in cho thừa.
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      material_id: 'm1',
      direction: 'out',
      qty: 3,
      ref_type: 'adjust',
      doc_id: 'doc-kk',
    })
    expect(rows[1]).toMatchObject({ material_id: 'm2', direction: 'in', qty: 3 })
  })

  it('tất cả khớp sổ → không sinh movement, diff_count = 0', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 10]]))
    const r = await stockService.createStocktakeDoc(admin, {
      lines: [{ material_id: 'm1', counted_qty: 10 }],
    })
    expect(r.diff_count).toBe(0)
    expect(insertMovements).not.toHaveBeenCalled()
    expect(stocktakeRepo.insertLines).toHaveBeenCalled() // biên bản vẫn ghi
  })

  it('vật tư chưa từng có movement → tồn sổ coi là 0 (đếm = thừa toàn bộ)', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map())
    const r = await stockService.createStocktakeDoc(admin, {
      lines: [{ material_id: 'm1', counted_qty: 4 }],
    })
    expect(r.diff_count).toBe(1)
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0]).toMatchObject({ direction: 'in', qty: 4 })
  })
})

describe('createIssueDoc — guard TỒN KHẢ DỤNG (đã giữ cho LSX khác)', () => {
  /** on_hand 5, LSX khác đang giữ 5 → khả dụng 0. */
  function reservedByOther(qtyReserved: number) {
    vi.mocked(productionRepo.listCommittedIds).mockResolvedValue(['lsx-other'])
    vi.mocked(componentsRepo.listForReserve).mockResolvedValue([] as never)
    vi.mocked(issuedByLsxIds).mockResolvedValue([] as never)
    vi.mocked(lsxRemainingByIds).mockResolvedValue([] as never)
    vi.mocked(computeReservedByMaterial).mockReturnValue(new Map([['m1', qtyReserved]]))
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 5]]))
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PXK-2026-0001')
  }

  it('lấn phần đang giữ → 409 RESERVED_CONFLICT, KHÔNG ghi phiếu', async () => {
    reservedByOther(5)

    await expect(
      stockService.createIssueDoc(admin, {
        kind: 'daily',
        lines: [{ material_id: 'm1', qty: 3 }],
      }),
    ).rejects.toMatchObject({ status: 409, code: 'RESERVED_CONFLICT' })

    expect(insertMovements).not.toHaveBeenCalled()
    expect(docsRepo.insert).not.toHaveBeenCalled()
  })

  it('vẫn chặn CỨNG khi vượt tồn thực tế (không phải chỉ khả dụng)', async () => {
    reservedByOther(0)

    await expect(
      stockService.createIssueDoc(admin, {
        kind: 'daily',
        lines: [{ material_id: 'm1', qty: 99 }],
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('override kèm lý do → xuất được, ghi vết "[Vượt khả dụng]" vào ghi chú', async () => {
    reservedByOther(5)

    await stockService.createIssueDoc(admin, {
      kind: 'daily',
      note: 'Xuất gấp',
      override_reserved: true,
      override_reason: 'Sếp duyệt ưu tiên đơn A',
      lines: [{ material_id: 'm1', qty: 3 }],
    })

    expect(insertMovements).toHaveBeenCalled()
    const doc = vi.mocked(docsRepo.insert).mock.calls[0][0]
    expect(doc.note).toContain('[Vượt khả dụng]')
    expect(doc.note).toContain('Sếp duyệt ưu tiên đơn A')
    expect(doc.note).toContain('Xuất gấp')
  })

  it('xuất cho CHÍNH LSX đang giữ → không bị chặn (loại chính nó khỏi phần giữ)', async () => {
    // Chỉ có lsx1 đang cam kết; xuất cho lsx1 → exclude → giữ = 0, khả dụng = 5.
    vi.mocked(productionRepo.listCommittedIds).mockResolvedValue(['lsx1'])
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 5]]))
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PXK-2026-0002')

    await stockService.createIssueDoc(admin, {
      kind: 'lsx',
      production_order_id: 'lsx1',
      lines: [{ material_id: 'm1', qty: 5 }],
    })

    expect(insertMovements).toHaveBeenCalled()
  })
})
