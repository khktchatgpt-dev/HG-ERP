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
    findReversalOf: vi.fn(async () => null),
    findShipmentId: vi.fn(async () => null),
    patchStatus: vi.fn(),
    countPending: vi.fn(),
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
    poIdsByLineIds: vi.fn(async () => []),
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
// 0157: notifyStocktake tra người có quyền duyệt; test không cần RBAC thật.
vi.mock('@/modules/core/rbac/rbac.service', () => ({ assertAction: vi.fn() }))
vi.mock('@/modules/core/rbac/rbac.repo', () => ({
  rbacRepo: { userIdsWithPermission: vi.fn(async () => []) },
}))

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
import { rbacRepo } from '@/modules/core/rbac/rbac.repo'
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
    assigned_to: 'u-mua',
    created_by: 'u-mua',
  })
  // Dòng PO để đối chiếu — mặc định còn thiếu rộng rãi để test cũ không
  // vướng guard nhận vượt; test guard tự siết lại.
  vi.mocked(supplyRepo.lineStatus).mockResolvedValue([
    {
      id: 'pl1',
      po_id: 'po1',
      material_id: 'm1',
      qty_ordered: 1000,
      qty_received: 0,
      qty_rejected: 0,
      qty_missing: 1000,
      qty_open: 1000,
      closed_short_at: null,
      over_tolerance_pct: 0,
      material_code: 'VT-001',
      material_name: 'Nhôm 25x50',
      material_unit: 'cây',
    },
  ])
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
      vi.mocked(supplyRepo.poStatus).mockResolvedValue({
        code: 'PO-X',
        status,
        assigned_to: null,
        created_by: null,
      })
      await expect(
        stockService.createReceiptDoc(admin, {
          po_id: 'po1',
          lines: [{ material_id: 'm1', qty: 10, po_line_id: 'pl1' }],
        }),
      ).rejects.toMatchObject({ status: 400 })
      expect(insertMovements).not.toHaveBeenCalled()
    },
  )

  // ── Đối chiếu dòng phiếu với dòng PO ─────────────────────────────────────
  // Logic thuần có test riêng ở @/lib/po-receipt; ở đây chỉ chốt là service
  // gọi nó và dịch ra đúng mã lỗi HTTP.

  it('gắn dòng của PO KHÁC → chặn 400 (trước đây lọt, ghi có cho PO kia)', async () => {
    await expect(
      stockService.createReceiptDoc(admin, {
        po_id: 'po1',
        lines: [{ material_id: 'm1', qty: 10, po_line_id: 'pl-cua-po-khac' }],
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('nhập vật tư khác vào dòng PO → chặn 400', async () => {
    await expect(
      stockService.createReceiptDoc(admin, {
        po_id: 'po1',
        lines: [{ material_id: 'm-go', qty: 10, po_line_id: 'pl1' }],
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('mua ngoài mà vẫn kèm po_line_id → chặn 400', async () => {
    await expect(
      stockService.createReceiptDoc(admin, {
        lines: [{ material_id: 'm1', qty: 10, po_line_id: 'pl1' }],
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('nhận vượt số còn thiếu → 409 OVER_RECEIPT, chưa ghi gì', async () => {
    await expect(
      stockService.createReceiptDoc(admin, {
        po_id: 'po1',
        lines: [{ material_id: 'm1', qty: 1500, po_line_id: 'pl1' }],
      }),
    ).rejects.toMatchObject({ status: 409, code: 'OVER_RECEIPT' })
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('xác nhận allow_over → vẫn ghi, lý do vào ghi chú phiếu', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0009')
    vi.mocked(supplyRepo.refreshStatusFromReceipts).mockResolvedValue('received')

    await stockService.createReceiptDoc(admin, {
      po_id: 'po1',
      note: 'Giao đợt 2',
      allow_over: true,
      over_reason: 'NCC giao dư bù hao',
      lines: [{ material_id: 'm1', qty: 1500, po_line_id: 'pl1' }],
    })

    const doc = vi.mocked(docsRepo.insert).mock.calls[0][0]
    expect(doc.note).toBe('Giao đợt 2 · [Nhận vượt] NCC giao dư bù hao')
  })

  it('báo hàng về cho NGƯỜI PHỤ TRÁCH đơn, không chỉ admin/quản lý', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0010')
    vi.mocked(supplyRepo.refreshStatusFromReceipts).mockResolvedValue('partial')

    await stockService.createReceiptDoc(admin, {
      po_id: 'po1',
      lines: [{ material_id: 'm1', qty: 10, po_line_id: 'pl1' }],
    })

    const evt = vi.mocked(emit).mock.calls[0][0] as {
      name: string
      notify_ids: string[]
      po_code: string | null
    }
    expect(evt.name).toBe('warehouse.receipt.created')
    expect(evt.notify_ids).toContain('u-mua')
    expect(evt.po_code).toBe('PO-2026-0001')
  })

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

/*
 * KIỂM KÊ CÓ DUYỆT (0077 + vòng duyệt 0157): lập biên bản KHÔNG đụng tồn;
 * quản lý Kho duyệt mới áp — chênh tính theo tồn LÚC DUYỆT, chặn tự duyệt.
 */
describe('createStocktakeDoc — lập biên bản (0157: pending, tồn CHƯA đổi)', () => {
  beforeEach(() => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('KK-2026-0001')
    vi.mocked(docsRepo.insert).mockResolvedValue({ id: 'doc-kk', code: 'KK-2026-0001' })
  })

  it('biên bản đủ mọi dòng (snapshot tồn lúc đếm), status=pending, KHÔNG movement', async () => {
    // m1: sổ 10 đếm 7 (thiếu 3); m2: sổ 5 đếm 8 (thừa 3); m3: khớp 20.
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
    const doc = vi.mocked(docsRepo.insert).mock.calls[0][0] as Record<string, unknown>
    expect(doc.status).toBe('pending')

    // Biên bản: đủ 3 dòng, kể cả dòng khớp — diff lưu thẳng.
    const bienBan = vi.mocked(stocktakeRepo.insertLines).mock.calls[0][0]
    expect(bienBan).toHaveLength(3)
    expect(bienBan[0]).toMatchObject({ system_qty: 10, counted_qty: 7, diff: -3 })
    expect(bienBan[2]).toMatchObject({ system_qty: 20, counted_qty: 20, diff: 0 })

    // 0157: LẬP không đụng sổ cái — duyệt mới áp.
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('lập xong báo người có quyền duyệt (trừ chính người lập)', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 10]]))
    vi.mocked(rbacRepo.userIdsWithPermission).mockResolvedValue(['u-qlkho', admin.id])
    await stockService.createStocktakeDoc(admin, {
      lines: [{ material_id: 'm1', counted_qty: 7 }],
    })
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'warehouse.stocktake.pending',
        notify_ids: ['u-qlkho'],
      }),
    )
  })
})

describe('approveStocktake / rejectStocktake — duyệt kiểm kê (0157)', () => {
  const manager = { id: 'u-qlkho', role: 'manager', department_id: 'd-kho' } as never
  const PENDING_DOC = {
    id: 'doc-kk',
    code: 'KK-2026-0001',
    kind: 'stocktake',
    status: 'pending',
    created_by: 'u-staff',
  }

  beforeEach(() => {
    vi.mocked(docsRepo.findById).mockResolvedValue(PENDING_DOC as never)
    vi.mocked(stocktakeRepo.listByDoc).mockResolvedValue([
      // Lúc đếm: sổ 10, đếm 7. Từ đó tới lúc duyệt có phiếu xuất 1 → tồn hiện tại 9.
      { id: 'st1', material_id: 'm1', system_qty: 10, counted_qty: 7, diff: -3 },
    ] as never)
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 9]]))
  })

  it('duyệt: áp SỐ ĐẾM theo tồn LÚC DUYỆT (9→7 = out 2, không phải -3 lúc đếm)', async () => {
    const r = await stockService.approveStocktake(manager, 'doc-kk')
    expect(r.applied).toBe(1)

    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0]).toMatchObject({
      material_id: 'm1',
      direction: 'out',
      qty: 2, // đếm 7 − tồn lúc duyệt 9
      ref_type: 'adjust',
      doc_id: 'doc-kk',
    })
    expect(String(rows[0].note)).toContain('lúc đếm 10')
    const patch = vi.mocked(docsRepo.patchStatus).mock.calls[0]
    expect(patch[0]).toBe('doc-kk')
    expect(patch[1]).toMatchObject({ status: 'posted', approved_by: 'u-qlkho' })
    // Người lập được báo kết quả.
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'warehouse.stocktake.decided',
        decision: 'approved',
        recipient_id: 'u-staff',
      }),
    )
  })

  it('tồn lúc duyệt ĐÃ ĐÚNG số đếm → posted nhưng không sinh movement thừa', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 7]]))
    const r = await stockService.approveStocktake(manager, 'doc-kk')
    expect(r.applied).toBe(0)
    expect(insertMovements).not.toHaveBeenCalled()
    expect(docsRepo.patchStatus).toHaveBeenCalled()
  })

  it('TỰ DUYỆT biên bản mình lập → 403 (trừ admin)', async () => {
    vi.mocked(docsRepo.findById).mockResolvedValue({
      ...PENDING_DOC,
      created_by: 'u-qlkho',
    } as never)
    await expect(stockService.approveStocktake(manager, 'doc-kk')).rejects.toMatchObject({
      status: 403,
    })
    expect(insertMovements).not.toHaveBeenCalled()

    // admin thì được — cty nhỏ có ngày chỉ một người có quyền.
    vi.mocked(docsRepo.findById).mockResolvedValue({
      ...PENDING_DOC,
      created_by: admin.id,
    } as never)
    await expect(stockService.approveStocktake(admin, 'doc-kk')).resolves.toBeTruthy()
  })

  it('biên bản đã posted / rejected → 400, không áp lại lần hai', async () => {
    vi.mocked(docsRepo.findById).mockResolvedValue({
      ...PENDING_DOC,
      status: 'posted',
    } as never)
    await expect(stockService.approveStocktake(manager, 'doc-kk')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('từ chối: bắt lý do, KHÔNG đụng tồn, báo người lập', async () => {
    await expect(
      stockService.rejectStocktake(manager, 'doc-kk', '  '),
    ).rejects.toMatchObject({ status: 400 })

    await stockService.rejectStocktake(manager, 'doc-kk', 'Đếm sai khu B')
    expect(insertMovements).not.toHaveBeenCalled()
    const patch = vi.mocked(docsRepo.patchStatus).mock.calls[0][1]
    expect(patch).toMatchObject({ status: 'rejected', reject_reason: 'Đếm sai khu B' })
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'rejected', recipient_id: 'u-staff' }),
    )
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

/*
 * PHIẾU TRẢ HÀNG NCC (⑤, 0080) — nợ test từ backlog 23/07: guard trả ≤ đã về,
 * ≤ tồn, PO phải có hàng về; movement out + po_line_id để view 0080 trừ "đã về".
 */
describe('createReturnDoc — trả hàng NCC (0080)', () => {
  const RETURN_INPUT = {
    po_id: 'po1',
    reason: 'Kính trầy mặt, NCC nhận lại',
    lines: [{ material_id: 'm1', po_line_id: 'pl1', qty: 4 }],
  }

  beforeEach(() => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PXK-2026-0009')
    vi.mocked(docsRepo.insert).mockResolvedValue({ id: 'doc9', code: 'PXK-2026-0009' })
    vi.mocked(supplyRepo.poStatus).mockResolvedValue({
      code: 'PO-2026-0001',
      status: 'partial',
      assigned_to: 'u-mua',
      created_by: 'u-mua',
    })
    vi.mocked(supplyRepo.lineStatus).mockResolvedValue([
      {
        id: 'pl1',
        po_id: 'po1',
        material_id: 'm1',
        qty_ordered: 100,
        qty_received: 10,
        qty_rejected: 0,
        qty_missing: 90,
        qty_open: 90,
        closed_short_at: null,
        over_tolerance_pct: 0,
        material_code: 'VT-001',
        material_name: 'Kính 5mm',
        material_unit: 'tấm',
      },
    ])
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 50]]))
    vi.mocked(supplyRepo.refreshStatusFromReceipts).mockResolvedValue('partial')
  })

  it('trả hợp lệ: phiếu XUẤT kind=issue, movement out ref=po gắn po_line_id, tính lại PO, notify', async () => {
    const out = await stockService.createReturnDoc(admin, RETURN_INPUT)

    expect(out.code).toBe('PXK-2026-0009')
    const doc = vi.mocked(docsRepo.insert).mock.calls[0][0] as Record<string, unknown>
    expect(doc.kind).toBe('issue')
    expect(String(doc.reason)).toContain('Trả hàng NCC — PO-2026-0001')

    const mv = (
      vi.mocked(insertMovements).mock.calls[0][0] as Record<string, unknown>[]
    )[0]
    expect(mv).toMatchObject({
      direction: 'out',
      ref_type: 'po',
      po_line_id: 'pl1',
      qty: 4,
    })
    expect(supplyRepo.refreshStatusFromReceipts).toHaveBeenCalledWith('po1')
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'warehouse.return.created' }),
    )
  })

  it('trả VƯỢT số đã về → 400 (view 0080 đã trừ các lần trả trước)', async () => {
    await expect(
      stockService.createReturnDoc(admin, {
        ...RETURN_INPUT,
        lines: [{ material_id: 'm1', po_line_id: 'pl1', qty: 11 }],
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('trả VƯỢT tồn hiện có → 400 (hàng đã xuất cho SX thì không còn để trả)', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 2]]))
    await expect(stockService.createReturnDoc(admin, RETURN_INPUT)).rejects.toMatchObject(
      { status: 400 },
    )
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('PO chưa có hàng về (ordered) → 400, không có gì để trả', async () => {
    vi.mocked(supplyRepo.poStatus).mockResolvedValue({
      code: 'PO-2026-0001',
      status: 'ordered',
      assigned_to: 'u-mua',
      created_by: 'u-mua',
    })
    await expect(stockService.createReturnDoc(admin, RETURN_INPUT)).rejects.toMatchObject(
      { status: 400 },
    )
  })

  it('dòng trả không thuộc PO / lệch vật tư → 400', async () => {
    await expect(
      stockService.createReturnDoc(admin, {
        ...RETURN_INPUT,
        lines: [{ material_id: 'm1', po_line_id: 'pl-la', qty: 1 }],
      }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      stockService.createReturnDoc(admin, {
        ...RETURN_INPUT,
        lines: [{ material_id: 'm-khac', po_line_id: 'pl1', qty: 1 }],
      }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

/*
 * PHIẾU ĐẢO (0161 — K1 go-live): ghi ngược movement phiếu sai, có vết; không
 * sửa đè. HOÀN KHO TỪ LSX (K2): xưởng trả vật tư thừa, issuedByLsx net tự trừ.
 */
describe('reverseDoc — phiếu đảo (K1)', () => {
  const RECEIPT_DOC = {
    id: 'doc-g',
    code: 'PNK-2026-0009',
    kind: 'receipt',
    status: 'posted',
    reversal_of_doc_id: null,
    created_by: 'u-kho',
  }
  const LINES = [
    {
      id: 'mv1',
      material_id: 'm1',
      direction: 'in',
      qty: 100,
      qty_rejected: 0,
      po_line_id: 'pl1',
      production_order_id: null,
      shelf_location: 'A-01',
    },
  ]

  beforeEach(() => {
    vi.mocked(docsRepo.findById).mockResolvedValue(RECEIPT_DOC as never)
    vi.mocked(docsRepo.findReversalOf).mockResolvedValue(null)
    vi.mocked(docsRepo.listLines).mockResolvedValue(LINES as never)
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PXK-2026-0022')
    vi.mocked(docsRepo.insert).mockResolvedValue({ id: 'doc-rev', code: 'PXK-2026-0022' })
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 100]]))
    vi.mocked(supplyRepo.poIdsByLineIds).mockResolvedValue(['po1'])
  })

  it('đảo PNK: sinh phiếu XUẤT ref adjust, giữ po_line_id, refresh PO, notify', async () => {
    const out = await stockService.reverseDoc(admin, 'doc-g', 'Gõ nhầm 100 thay vì 10')
    expect(out.code).toBe('PXK-2026-0022')

    const doc = vi.mocked(docsRepo.insert).mock.calls[0][0] as Record<string, unknown>
    expect(doc.kind).toBe('issue')
    expect(doc.reversal_of_doc_id).toBe('doc-g')
    expect(String(doc.reason)).toContain('Đảo PNK-2026-0009')

    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0]).toMatchObject({
      material_id: 'm1',
      direction: 'out', // ngược chiều gốc
      qty: 100,
      ref_type: 'adjust',
      po_line_id: 'pl1', // giữ để view đối chiếu BR-08 tự trừ
      doc_id: 'doc-rev',
    })
    expect(supplyRepo.refreshStatusFromReceipts).toHaveBeenCalledWith('po1')
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'warehouse.doc.reversed',
        original_code: 'PNK-2026-0009',
        reversal_code: 'PXK-2026-0022',
      }),
    )
  })

  it('đảo PXK theo LSX: movement IN giữ production_order_id (issuedByLsx net tự trừ)', async () => {
    vi.mocked(docsRepo.findById).mockResolvedValue({
      ...RECEIPT_DOC,
      kind: 'issue',
      code: 'PXK-2026-0003',
    } as never)
    vi.mocked(docsRepo.listLines).mockResolvedValue([
      {
        ...LINES[0],
        direction: 'out',
        po_line_id: null,
        production_order_id: 'lsx1',
      },
    ] as never)
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0033')

    await stockService.reverseDoc(admin, 'doc-g', 'Xuất nhầm lệnh')
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0]).toMatchObject({
      direction: 'in',
      production_order_id: 'lsx1',
      ref_type: 'adjust',
    })
    // Đảo phiếu xuất không cần guard tồn (hàng quay VỀ kho)
    expect(supplyRepo.refreshStatusFromReceipts).not.toHaveBeenCalled()
  })

  it('phiếu đã bị đảo → 400, không đảo lần hai', async () => {
    vi.mocked(docsRepo.findReversalOf).mockResolvedValue({
      id: 'x',
      code: 'PXK-2026-0021',
    })
    await expect(
      stockService.reverseDoc(admin, 'doc-g', 'thử lần 2'),
    ).rejects.toMatchObject({ status: 400 })
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('phiếu đảo không đảo tiếp (chống chuỗi vô hạn)', async () => {
    vi.mocked(docsRepo.findById).mockResolvedValue({
      ...RECEIPT_DOC,
      reversal_of_doc_id: 'doc-truoc',
    } as never)
    await expect(stockService.reverseDoc(admin, 'doc-g', 'x')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('phiếu có QC loại → 400 (phần loại trong đối chiếu NCC nhưng chưa vào tồn)', async () => {
    vi.mocked(docsRepo.listLines).mockResolvedValue([
      { ...LINES[0], qty_rejected: 5 },
    ] as never)
    await expect(stockService.reverseDoc(admin, 'doc-g', 'x')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('đảo PNK mà hàng đã xuất đi (tồn thiếu) → 409 REVERSAL_STOCK_SHORT', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 30]]))
    await expect(
      stockService.reverseDoc(admin, 'doc-g', 'gõ nhầm'),
    ).rejects.toMatchObject({ status: 409, code: 'REVERSAL_STOCK_SHORT' })
    expect(insertMovements).not.toHaveBeenCalled()
  })
})

describe('createReceiptDoc — HOÀN KHO từ LSX (K2)', () => {
  beforeEach(() => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0044')
    vi.mocked(issuedByLsx).mockResolvedValue(new Map([['m1', 100]]))
  })

  it('hoàn hợp lệ: movement IN ref=lsx gắn production_order_id, không đụng PO', async () => {
    await stockService.createReceiptDoc(admin, {
      production_order_id: 'lsx1',
      lines: [{ material_id: 'm1', qty: 5 }],
    })
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0]).toMatchObject({
      direction: 'in',
      qty: 5,
      ref_type: 'lsx',
      production_order_id: 'lsx1',
    })
    expect(supplyRepo.refreshStatusFromReceipts).not.toHaveBeenCalled()
  })

  it('hoàn VƯỢT phần đã cấp còn lại → 400 (trả thứ chưa lĩnh là nhầm nguồn)', async () => {
    vi.mocked(issuedByLsx).mockResolvedValue(new Map([['m1', 3]]))
    await expect(
      stockService.createReceiptDoc(admin, {
        production_order_id: 'lsx1',
        lines: [{ material_id: 'm1', qty: 5 }],
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('trộn po_id + production_order_id → 400', async () => {
    await expect(
      stockService.createReceiptDoc(admin, {
        po_id: 'po1',
        production_order_id: 'lsx1',
        lines: [{ material_id: 'm1', qty: 5, po_line_id: 'pl1' }],
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('LSX chưa duyệt → 400', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      id: 'lsx1',
      code: 'LSX-2026-01',
      status: 'pending_approval',
    } as never)
    await expect(
      stockService.createReceiptDoc(admin, {
        production_order_id: 'lsx1',
        lines: [{ material_id: 'm1', qty: 1 }],
      }),
    ).rejects.toMatchObject({ status: 400 })
  })
})
