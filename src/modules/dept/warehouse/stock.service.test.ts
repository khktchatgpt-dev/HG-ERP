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
  // Khu ảo (0193): mặc định trả null = "kho chưa khai khu nào". Luồng nhận hàng
  // PHẢI vẫn chạy trong trạng thái đó — ca `khu mặc định` dưới canh chính điều ấy.
  binsRepo: {
    byKind: vi.fn(async () => null),
    list: vi.fn(async () => []),
    findById: vi.fn(async () => null),
    insert: vi.fn(),
    patch: vi.fn(),
    materialCountByBin: vi.fn(async () => new Map()),
  },
  stockByBin: vi.fn(async () => []),
  stocktakeRepo: { insertLines: vi.fn(), listByDoc: vi.fn() },
  insertMovements: vi.fn(),
  onHandMany: vi.fn(),
  stockInfoMany: vi.fn(),
  inspectionGroups: vi.fn(async () => new Set()),
  issuedByLsx: vi.fn(),
  issuedByLsxIds: vi.fn(),
  lsxRemainingByIds: vi.fn(),
  lsxNeeds: vi.fn(),
}))
vi.mock('@/modules/dept/supply/lsx-bom-needs.repo', () => ({
  lsxBomNeeds: vi.fn(),
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
  // Giá vốn dòng nhập lấy từ dòng đơn mua — mặc định rỗng để các ca cũ giữ
  // nguyên hành vi (`unit_cost` NULL); ca nào cần giá thì tự mockResolvedValue.
  poLineUnitCosts: vi.fn(async () => new Map<string, number>()),
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

import { stockService, smartLsxNeeds, createTransferDoc } from './stock.service'
import {
  binsRepo,
  docsRepo,
  insertMovements,
  issuedByLsx,
  issuedByLsxIds,
  lsxRemainingByIds,
  lsxNeeds as lsxNeedsRepo,
  onHandMany,
  stockByBin,
  stockInfoMany,
  inspectionGroups,
  stocktakeRepo,
  warehousesRepo,
} from './stock.repo'
import { componentsRepo } from '@/modules/dept/production/components.repo'
import { computeReservedByMaterial } from '@/lib/reserved-stock'
import { componentMaterialNeeds } from '@/modules/dept/production/components.service'
import { lsxBomNeeds } from '@/modules/dept/supply/lsx-bom-needs.repo'
import { materialsRepo } from './warehouse.repo'
import { isWarehouseUser } from './warehouse.service'
import { supplyRepo, poLineUnitCosts } from '@/modules/dept/supply/supply.repo'
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
  /*
    TỒN SAU KHI GHI (0193) — trả lời câu người giữ kho hỏi ngay sau khi bấm:
    "tồn đã cộng vào chưa?". Số này đọc lại từ sổ SAU khi ghi movement, nên nó
    vừa là câu trả lời vừa là phép kiểm. Ba thứ dễ sai, canh cả ba.
  */
  describe('stock_after — tồn sau khi ghi phiếu', () => {
    it('trả về tồn ĐỌC LẠI TỪ SỔ, không phải số tự cộng nhẩm', async () => {
      vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0090')
      vi.mocked(supplyRepo.refreshStatusFromReceipts).mockResolvedValue('partial')
      vi.mocked(stockInfoMany).mockResolvedValue([
        { material_id: 'm1', code: 'VT-01', name: 'Nút chân', unit: 'Cái', qty_ok: 2400, on_hand: 2400, min_stock: 0 }, // prettier-ignore
      ])

      const r = await stockService.createReceiptDoc(admin, {
        po_id: 'po1',
        lines: [{ material_id: 'm1', qty: 600, po_line_id: 'pl1' }],
      })

      expect(r.stock_after).toEqual([
        { material_id: 'm1', code: 'VT-01', name: 'Nút chân', unit: 'Cái', on_hand: 2400, received: 600 }, // prettier-ignore
      ])
    })

    it('MỘT VẬT TƯ NHIỀU DÒNG thì cộng lại — không bày hai dòng cùng mã', async () => {
      vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0091')
      vi.mocked(supplyRepo.refreshStatusFromReceipts).mockResolvedValue('partial')
      vi.mocked(stockInfoMany).mockResolvedValue([
        { material_id: 'm1', code: 'VT-01', name: 'Nút chân', unit: 'Cái', qty_ok: 500, on_hand: 500, min_stock: 0 }, // prettier-ignore
      ])
      // Cùng một MÃ VẬT TƯ nằm ở hai dòng đơn khác nhau — ca thật khi Cung ứng
      // tách dòng theo lệnh sản xuất.
      vi.mocked(supplyRepo.lineStatus).mockResolvedValue([
        { id: 'pl1', po_id: 'po1', material_id: 'm1', qty_ordered: 1000, qty_received: 0, qty_rejected: 0, qty_missing: 1000, qty_open: 1000, closed_short_at: null, over_tolerance_pct: 0, material_code: 'VT-001', material_name: 'Nút chân', material_unit: 'Cái' }, // prettier-ignore
        { id: 'pl2', po_id: 'po1', material_id: 'm1', qty_ordered: 1000, qty_received: 0, qty_rejected: 0, qty_missing: 1000, qty_open: 1000, closed_short_at: null, over_tolerance_pct: 0, material_code: 'VT-001', material_name: 'Nút chân', material_unit: 'Cái' }, // prettier-ignore
      ] as never)

      const r = await stockService.createReceiptDoc(admin, {
        po_id: 'po1',
        lines: [
          { material_id: 'm1', qty: 200, po_line_id: 'pl1' },
          { material_id: 'm1', qty: 300, po_line_id: 'pl2' },
        ],
      })

      expect(r.stock_after).toHaveLength(1)
      expect(r.stock_after[0].received).toBe(500)
    })

    it('QC LOẠI không cộng vào "vừa nhập" — nó không vào tồn (BR-10)', async () => {
      vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0092')
      vi.mocked(supplyRepo.refreshStatusFromReceipts).mockResolvedValue('partial')
      vi.mocked(stockInfoMany).mockResolvedValue([
        { material_id: 'm1', code: 'VT-01', name: 'Nút chân', unit: 'Cái', qty_ok: 60, on_hand: 60, min_stock: 0 }, // prettier-ignore
      ])

      const r = await stockService.createReceiptDoc(admin, {
        po_id: 'po1',
        lines: [{ material_id: 'm1', qty: 60, qty_rejected: 5, po_line_id: 'pl1' }],
      })

      // 60 đạt vào tồn; 5 loại tính là "NCC đã giao" nhưng KHÔNG vào sổ tồn.
      expect(r.stock_after[0].received).toBe(60)
      expect(r.stock_after[0].on_hand).toBe(60)
    })
  })

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

  /**
   * GIÁ VỐN phải đi theo phiếu nhập. Thiếu nó thì giá trị tồn kho bằng 0 và
   * công nợ tính theo phiếu nhập cũng bằng 0 — đo 11/09/2026: 139/142 movement
   * gắn dòng PO không có giá, vì chưa nơi nào từng ghi cột này.
   */
  it('nhập theo PO: ghi unit_cost lấy từ dòng đơn mua', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0003')
    vi.mocked(poLineUnitCosts).mockResolvedValue(new Map([['pl1', 52_000]]))

    await stockService.createReceiptDoc(admin, {
      po_id: 'po1',
      lines: [{ material_id: 'm1', qty: 60, po_line_id: 'pl1' }],
    })
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0].unit_cost).toBe(52_000)
  })

  /** NULL = "chưa biết giá", khác hẳn 0 = "hàng cho không". Màn công nợ đếm
   *  "phiếu chưa có giá" dựa đúng vào phân biệt này, nên không được thay bằng 0. */
  it('dòng đơn chưa có giá → unit_cost NULL, không phải 0', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0004')
    vi.mocked(poLineUnitCosts).mockResolvedValue(new Map())

    await stockService.createReceiptDoc(admin, {
      po_id: 'po1',
      lines: [{ material_id: 'm1', qty: 10, po_line_id: 'pl1' }],
    })
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0].unit_cost).toBeNull()
  })

  it('mua ngoài không tra giá đơn mua — không có đơn nào để tra', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0005')
    await stockService.createReceiptDoc(admin, {
      lines: [{ material_id: 'm1', qty: 10 }],
    })
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0].unit_cost).toBeNull()
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
      // qty_ok là nền tính "dưới mức" từ 0198 — on_hand giữ để thấy rõ hai số
      // có thể khác nhau (ở đây 3 dùng được / 5 tổng, 2 đang khoá).
      {
        material_id: 'm1',
        code: 'VT-01',
        name: 'Nhôm',
        unit: 'Kg',
        qty_ok: 3,
        on_hand: 5,
        min_stock: 20,
      },
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
      qty_ok: number
      notify_ids: string[]
    }
    expect(evt).toBeTruthy()
    expect(evt.qty_ok).toBe(3)
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

  it('bảng chi tiết CÓ dòng nhưng chưa gắn mã vật tư (trả []) → vẫn rơi về BOM', async () => {
    // Đo 05/09/2026: 8/15 lệnh có định hình mà 0 dòng có material_id — coi [] là
    // "đã có bảng" thì mọi màn nhu cầu trống dù định mức có mã cho 7 lệnh.
    vi.mocked(componentMaterialNeeds).mockResolvedValue([])
    vi.mocked(lsxBomNeeds).mockResolvedValue({
      lines: [
        {
          product_id: 'p1',
          product_code: 'SP-1',
          product_name: 'Bàn',
          product_qty: 80,
          bom_confirmed: false,
          material_id: 'm9',
          material_code: 'NK-0049',
          material_name: 'Nhôm khung',
          unit: 'cây',
          group_name: null,
          kind: null,
          part_names: [],
          // 2,08 m/SP ÷ 6 m mỗi cây — số đã QUY ĐỔI, không phải số thanh.
          qty_per_unit: 0.3467,
          qty_needed: 27.736,
          basis: 'length_to_bar',
          explain: '2,08 m/SP ÷ 6 m mỗi Cây',
          part_count: 1,
        },
      ],
      blocked: [],
      products: [],
    })
    vi.mocked(issuedByLsx).mockResolvedValue(new Map())

    const out = await smartLsxNeeds('lsx1')

    expect(lsxBomNeeds).toHaveBeenCalledWith('lsx1')
    expect(lsxNeedsRepo).not.toHaveBeenCalled() // view cũ tính sai đơn vị
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      material_code: 'NK-0049',
      qty_needed: 27.736,
      qty_remaining: 27.736,
      source: 'bom',
      unconfirmed: true,
    })
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

  it('chưa nhập bảng chi tiết → định mức đã quy đổi ĐVT, trừ đã xuất', async () => {
    vi.mocked(componentMaterialNeeds).mockResolvedValue(null)
    vi.mocked(lsxBomNeeds).mockResolvedValue({
      lines: [
        {
          product_id: 'p1',
          product_code: 'SP-1',
          product_name: 'x',
          product_qty: 3,
          bom_confirmed: true,
          material_id: 'm1',
          material_code: 'VT-01',
          material_name: 'x',
          unit: 'kg',
          group_name: null,
          kind: null,
          part_names: [],
          qty_per_unit: 4,
          qty_needed: 12,
          basis: 'weight',
          explain: '4 kg/SP',
          part_count: 1,
        },
      ],
      blocked: [],
      products: [],
    })
    // Đã xuất kho cho lệnh thì trừ ra — nhánh BOM trước đây bỏ qua phần này.
    vi.mocked(issuedByLsx).mockResolvedValue(new Map([['m1', 5]]))

    const out = await smartLsxNeeds('lsx1')
    expect(out[0]).toMatchObject({
      qty_needed: 12,
      qty_issued: 5,
      qty_remaining: 7,
      source: 'bom',
      unconfirmed: false,
    })
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

/**
 * NƠI CHỐN + TRẠNG THÁI CỦA LƯỢNG (0193/0194 — Đợt 2).
 *
 * Bốn ca dưới đây canh đúng bốn quyết định của đợt này, và mỗi ca là một lối
 * mòn đã đo được chứ không phải một nhánh if cho đủ:
 *
 *  1. Hàng không đạt VẪN VÀO SỔ ở trạng thái khoá, không biến mất khỏi hệ thống
 *     trong khi nằm thật ngoài sân (lối mòn ⑤ của docs/thiet-ke-kho.md).
 *  2. Khoá BẮT BUỘC kèm lý do — "blocked" trần thì Cung ứng không quyết được gì.
 *  3. Khu mặc định tra theo LOẠI, và THIẾU khu ảo thì KHÔNG chặn nhận hàng:
 *     đổi một thiếu sót danh mục thành một sự cố dây chuyền là sai người sai việc.
 *  4. Khai thẳng kệ thật = nhận một bước, bỏ qua bước cất.
 */
describe('createReceiptDoc — nơi chốn & trạng thái của lượng (0193/0194)', () => {
  it('mặc định: trạng thái ok, hàng vào KHU TIẾP NHẬN để còn đi qua bước cất', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0101')
    vi.mocked(binsRepo.byKind).mockImplementation(async (_wh, kind) =>
      kind === 'receiving'
        ? ({
            id: 'bin-recv',
            code: 'TIEP-NHAN',
            name: null,
            kind,
            is_active: true,
          } as never)
        : ({
            id: 'bin-lock',
            code: 'KHOA-01',
            name: null,
            kind,
            is_active: true,
          } as never),
    )

    await stockService.createReceiptDoc(admin, {
      po_id: 'po1',
      lines: [{ material_id: 'm1', qty: 60, po_line_id: 'pl1' }],
    })

    const rows = vi.mocked(insertMovements).mock.calls.at(-1)![0]
    expect(rows[0]).toMatchObject({ stock_status: 'ok', bin_id: 'bin-recv' })
  })

  it('dòng khoá: vào SỔ với qty > 0 ở kệ hàng khoá, không biến mất', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0102')
    vi.mocked(binsRepo.byKind).mockImplementation(async (_wh, kind) =>
      kind === 'receiving'
        ? ({
            id: 'bin-recv',
            code: 'TIEP-NHAN',
            name: null,
            kind,
            is_active: true,
          } as never)
        : ({
            id: 'bin-lock',
            code: 'KHOA-01',
            name: null,
            kind,
            is_active: true,
          } as never),
    )

    await stockService.createReceiptDoc(admin, {
      po_id: 'po1',
      lines: [
        { material_id: 'm1', qty: 40, po_line_id: 'pl1' },
        {
          material_id: 'm1',
          qty: 20,
          po_line_id: 'pl1',
          stock_status: 'blocked',
          note: 'Giao sai mã hợp kim — hồ sơ 6063 T5, hàng về dập 6061',
        },
      ],
    })

    const rows = vi.mocked(insertMovements).mock.calls.at(-1)![0]
    // Cả hai dòng đều direction 'in' với qty > 0 — nên "NCC đã chở tới" vẫn đếm
    // đủ 60, đúng như trước khi có trạng thái lượng.
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ stock_status: 'ok', bin_id: 'bin-recv', qty: 40 })
    expect(rows[1]).toMatchObject({
      direction: 'in',
      stock_status: 'blocked',
      bin_id: 'bin-lock',
      qty: 20,
    })
  })

  it('khoá mà không ghi lý do → chặn, kèm mã vật tư trong câu lỗi', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0103')

    await expect(
      stockService.createReceiptDoc(admin, {
        po_id: 'po1',
        lines: [
          { material_id: 'm1', qty: 20, po_line_id: 'pl1', stock_status: 'blocked' },
        ],
      }),
    ).rejects.toThrow(/lý do/i)
    // Chặn TRƯỚC khi ghi bất cứ dòng sổ nào — nửa phiếu vào sổ là sổ nói dối.
    expect(docsRepo.insert).not.toHaveBeenCalled()
  })

  it('kho CHƯA khai khu ảo nào → vẫn nhận được, bin_id để null', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0104')
    vi.mocked(binsRepo.byKind).mockResolvedValue(null)

    await stockService.createReceiptDoc(admin, {
      po_id: 'po1',
      lines: [{ material_id: 'm1', qty: 60, po_line_id: 'pl1' }],
    })

    const rows = vi.mocked(insertMovements).mock.calls.at(-1)![0]
    expect(rows[0]).toMatchObject({ bin_id: null, stock_status: 'ok' })
  })

  it('khai thẳng kệ thật → nhận một bước, không đi qua khu tiếp nhận', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0105')
    vi.mocked(binsRepo.byKind).mockImplementation(async (_wh, kind) =>
      kind === 'receiving'
        ? ({
            id: 'bin-recv',
            code: 'TIEP-NHAN',
            name: null,
            kind,
            is_active: true,
          } as never)
        : null,
    )

    await stockService.createReceiptDoc(admin, {
      po_id: 'po1',
      lines: [{ material_id: 'm1', qty: 60, po_line_id: 'pl1', bin_id: 'bin-nhom-a1' }],
    })

    const rows = vi.mocked(insertMovements).mock.calls.at(-1)![0]
    expect(rows[0]).toMatchObject({ bin_id: 'bin-nhom-a1' })
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
/**
 * MÃ LÝ DO TRÊN DÒNG SỔ (0197, Đợt 3 §2.1).
 *
 * Canh MỌI đường ghi dòng sổ đều gắn mã — vì một đường bị bỏ sót không làm
 * test nào đỏ, chỉ làm báo cáo kế toán thiếu im lặng. Đó đúng là hạng lỗi mà
 * cột `reason_code` sinh ra để dẹp, nên nó phải có hàng rào tự động.
 */
describe('mã lý do trên dòng sổ (0197)', () => {
  const maCua = (call = 0) =>
    vi.mocked(insertMovements).mock.calls[call][0].map((r) => r.reason_code)

  it('nhập theo PO → N1', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0100')
    await stockService.createReceiptDoc(admin, {
      po_id: 'po1',
      lines: [{ material_id: 'm1', qty: 10, po_line_id: 'pl1' }],
    })
    expect(maCua()).toEqual(['N1'])
  })

  it('mua ngoài đơn → N2', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0101')
    await stockService.createReceiptDoc(admin, {
      lines: [{ material_id: 'm1', qty: 10 }],
    })
    expect(maCua()).toEqual(['N2'])
  })

  it('hoàn kho từ LSX → N3', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0102')
    await stockService.createReceiptDoc(admin, {
      production_order_id: 'lsx1',
      lines: [{ material_id: 'm1', qty: 4 }],
    })
    expect(maCua()).toEqual(['N3'])
  })

  /**
   * ĐÍNH CHÍNH một lập luận sai (15/09/2026). Khi chốt đặt mã trên DÒNG, lý do
   * đưa ra là "phiếu nhập hôm nay đã trộn được dòng N1 và N2". SAI: hai guard
   * đối xứng ở `createReceiptDoc` chặn đúng việc đó — có `po_id` thì MỌI dòng
   * phải gắn dòng PO, không có `po_id` thì KHÔNG dòng nào được gắn. Trên đường
   * nhập, một phiếu chỉ mang một mã.
   *
   * Ca này canh chính cái guard ấy, để lần sau không ai lập luận lại từ một
   * khả năng không tồn tại. Bằng chứng THẬT cho "mã nằm trên dòng" là phiếu
   * KIỂM KÊ — xem ca N4/X5 dưới: một phiếu, hai mã, và hai HƯỚNG ngược nhau.
   */
  it('phiếu nhập KHÔNG trộn được N1 với N2 — guard chặn từ trước khi ghi dòng nào', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0103')
    await expect(
      stockService.createReceiptDoc(admin, {
        po_id: 'po1',
        lines: [
          { material_id: 'm1', qty: 10, po_line_id: 'pl1' },
          { material_id: 'm1', qty: 3 }, // mua thêm ngoài đơn, cùng chuyến xe
        ],
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('xuất theo lệnh → X1', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 100]]))
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PXK-2026-0100')
    await stockService.createIssueDoc(admin, {
      kind: 'lsx',
      production_order_id: 'lsx1',
      lines: [{ material_id: 'm1', qty: 5 }],
    })
    expect(maCua()).toEqual(['X1'])
  })

  it('xuất theo lệnh BỎ QUA mã người gửi — đường này luôn là X1', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 100]]))
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PXK-2026-0101')
    await stockService.createIssueDoc(admin, {
      kind: 'lsx',
      production_order_id: 'lsx1',
      reason_code: 'X4',
      lines: [{ material_id: 'm1', qty: 5 }],
    })
    expect(maCua()).toEqual(['X1'])
  })

  it('xuất lẻ có chọn mã → ghi đúng mã đó', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 100]]))
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PXK-2026-0102')
    await stockService.createIssueDoc(admin, {
      kind: 'daily',
      reason_code: 'X6',
      lines: [{ material_id: 'm1', qty: 2 }],
    })
    expect(maCua()).toEqual(['X6'])
  })

  /**
   * KHÔNG bịa mã cho xuất lẻ chưa chọn. "daily" chỉ nói xuất ngoài lệnh,
   * không nói xuất cho việc gì — mà sửa máy, làm mẫu và huỷ đi về ba đầu chi
   * phí khác nhau. Dán X7 lên là cho kế toán một con số không ai kiểm được.
   */
  it('xuất lẻ CHƯA chọn mã → để null, không bịa X7', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 100]]))
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PXK-2026-0103')
    await stockService.createIssueDoc(admin, {
      kind: 'daily',
      lines: [{ material_id: 'm1', qty: 2 }],
    })
    expect(maCua()).toEqual([null])
  })

  it('trả hàng NCC → X3', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PXK-2026-0104')
    // Trả hàng đòi PO ĐÃ CÓ HÀNG VỀ — beforeEach chung để 'ordered'.
    vi.mocked(supplyRepo.poStatus).mockResolvedValue({
      code: 'PO-2026-0001',
      status: 'partial',
      assigned_to: 'u-mua',
      created_by: 'u-mua',
    })
    vi.mocked(docsRepo.insert).mockResolvedValue({
      id: 'doc9',
      code: 'PXK-2026-0104',
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
    await stockService.createReturnDoc(admin, {
      po_id: 'po1',
      reason: 'Kính trầy mặt',
      lines: [{ material_id: 'm1', po_line_id: 'pl1', qty: 4 }],
    })
    expect(maCua()).toEqual(['X3'])
  })

  it('kiểm kê: thừa → N4, thiếu → X5 (hai chiều trong cùng một đợt)', async () => {
    const manager = {
      id: 'u-qlkho',
      role: 'manager',
      department_id: 'd-kho',
    } as never
    vi.mocked(docsRepo.findById).mockResolvedValue({
      id: 'doc-kk',
      code: 'KK-2026-0009',
      kind: 'stocktake',
      status: 'pending',
      created_by: 'u-staff',
    } as never)
    vi.mocked(stocktakeRepo.listByDoc).mockResolvedValue([
      { id: 's1', material_id: 'm1', system_qty: 10, counted_qty: 14, diff: 4 }, // thừa
      { id: 's2', material_id: 'm2', system_qty: 10, counted_qty: 7, diff: -3 }, // thiếu
    ] as never)
    vi.mocked(onHandMany).mockResolvedValue(
      new Map([
        ['m1', 10],
        ['m2', 10],
      ]),
    )
    await stockService.approveStocktake(manager, 'doc-kk')
    expect(maCua()).toEqual(['N4', 'X5'])
  })

  it('chuyển kệ → C1 trên CẢ HAI chân của cặp', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('DCK-2026-0001')
    vi.mocked(docsRepo.insert).mockResolvedValue({
      id: 'doc-dc',
      code: 'DCK-2026-0001',
    })
    vi.mocked(stockByBin).mockResolvedValue([
      { material_id: 'm1', bin_id: 'b1', stock_status: 'ok', qty: 50 },
    ] as never)
    await createTransferDoc(admin, {
      lines: [
        {
          material_id: 'm1',
          qty: 10,
          from_bin_id: 'b1',
          to_bin_id: 'b2',
          stock_status: 'ok',
        },
      ],
    })
    expect(maCua()).toEqual(['C1', 'C1'])
  })

  /**
   * Dòng đảo mang ĐÚNG mã của dòng gốc, không một mã "đảo" riêng: báo cáo phải
   * NET được. Huỷ 100 rồi đảo thì con số huỷ của tháng bằng 0 — cho dòng đảo
   * mã khác là báo cáo vẫn thấy 100 đã huỷ và thêm 100 ở một rổ khác.
   */
  it('phiếu đảo: mang lại mã của dòng gốc, direction lật', async () => {
    vi.mocked(docsRepo.findById).mockResolvedValue({
      id: 'doc-g',
      code: 'PNK-2026-0009',
      kind: 'receipt',
      status: 'posted',
      reversal_of_doc_id: null,
      created_by: 'u-kho',
    } as never)
    vi.mocked(docsRepo.findReversalOf).mockResolvedValue(null)
    vi.mocked(docsRepo.listLines).mockResolvedValue([
      {
        id: 'mv1',
        material_id: 'm1',
        direction: 'in',
        qty: 100,
        qty_rejected: 0,
        reason_code: 'N1',
        po_line_id: 'pl1',
        production_order_id: null,
      },
    ] as never)
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PXK-2026-0199')
    vi.mocked(docsRepo.insert).mockResolvedValue({
      id: 'doc-rev',
      code: 'PXK-2026-0199',
    })
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 100]]))
    vi.mocked(supplyRepo.poIdsByLineIds).mockResolvedValue([])

    await stockService.reverseDoc(admin, 'doc-g', 'Gõ nhầm 100 thay vì 10')
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0]).toMatchObject({ direction: 'out', reason_code: 'N1' })
  })

  it('phiếu đảo của dòng KHÔNG có mã (dữ liệu trước 0197) → vẫn null, không bịa', async () => {
    vi.mocked(docsRepo.findById).mockResolvedValue({
      id: 'doc-g2',
      code: 'PXK-2026-0005',
      kind: 'issue',
      status: 'posted',
      reversal_of_doc_id: null,
      created_by: 'u-kho',
    } as never)
    vi.mocked(docsRepo.findReversalOf).mockResolvedValue(null)
    vi.mocked(docsRepo.listLines).mockResolvedValue([
      {
        id: 'mv9',
        material_id: 'm1',
        direction: 'out',
        qty: 5,
        qty_rejected: 0,
        reason_code: null,
        po_line_id: null,
        production_order_id: null,
      },
    ] as never)
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0199')
    vi.mocked(docsRepo.insert).mockResolvedValue({
      id: 'doc-rev2',
      code: 'PNK-2026-0199',
    })
    vi.mocked(supplyRepo.poIdsByLineIds).mockResolvedValue([])

    await stockService.reverseDoc(admin, 'doc-g2', 'Xuất nhầm')
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0]).toMatchObject({ direction: 'in', reason_code: null })
  })
})
/**
 * CỜ "CẦN KIỂM" THEO NHÓM (0194 khai, 0198-đợt nối vào — sổ §4.4).
 *
 * Trước đây cờ được khai trong header migration rồi để đó: một lời hứa treo.
 * Ba ca dưới canh đúng ba điều khiến nó đáng giữ — mặc định vô hình, bật được
 * bằng dữ liệu, và ý người nhận thắng cờ cấu hình.
 */
describe('cờ cần kiểm theo nhóm vật tư (§4.4)', () => {
  it('không nhóm nào bật → mọi dòng vào "dùng được", y hệt trước', async () => {
    vi.mocked(inspectionGroups).mockResolvedValue(new Set())
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0201')
    await stockService.createReceiptDoc(admin, {
      lines: [{ material_id: 'm1', qty: 10 }],
    })
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0].stock_status).toBe('ok')
  })

  it('nhóm của vật tư có bật cờ → dòng chưa khai vào "chờ kiểm"', async () => {
    vi.mocked(materialsRepo.findById).mockResolvedValue({
      ...MAT,
      group_name: 'Nhôm định hình - tấm',
    } as never)
    vi.mocked(inspectionGroups).mockResolvedValue(new Set(['Nhôm định hình - tấm']))
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0202')
    await stockService.createReceiptDoc(admin, {
      lines: [{ material_id: 'm1', qty: 10 }],
    })
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0].stock_status).toBe('qc')
  })

  /**
   * Người nhận đang đứng trước lô hàng, cờ cấu hình thì không. Khai rồi thì ý
   * họ thắng — nếu không, thủ kho thấy hàng đạt mà hệ thống vẫn nhốt vào chờ
   * kiểm, và lần sau họ thôi khai.
   */
  it('dòng ĐÃ KHAI trạng thái → cờ không đè lên', async () => {
    vi.mocked(materialsRepo.findById).mockResolvedValue({
      ...MAT,
      group_name: 'Nhôm định hình - tấm',
    } as never)
    vi.mocked(inspectionGroups).mockResolvedValue(new Set(['Nhôm định hình - tấm']))
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PNK-2026-0203')
    await stockService.createReceiptDoc(admin, {
      lines: [{ material_id: 'm1', qty: 10, stock_status: 'ok' }],
    })
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0].stock_status).toBe('ok')
  })
})

/**
 * DƯỚI MỨC đo trên hàng DÙNG ĐƯỢC (0198, sổ §5.3). Ba nơi phải cùng công thức
 * — view, cron quét sáng, và chỗ này. Ca dưới canh chỗ thứ ba.
 */
describe('cảnh báo dưới mức tính trên qty_ok (§5.3)', () => {
  it('tổng còn nhiều nhưng DÙNG ĐƯỢC dưới min → vẫn cảnh báo', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 100]]))
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PXK-2026-0301')
    vi.mocked(stockInfoMany).mockResolvedValue([
      // 50 tổng nhưng chỉ 3 dùng được (47 đang khoá chờ trả NCC) — mua thay
      // được chỉ là 3, nên đây PHẢI là cảnh báo.
      {
        material_id: 'm1',
        code: 'VT-01',
        name: 'Nhôm',
        unit: 'Kg',
        qty_ok: 3,
        on_hand: 50,
        min_stock: 20,
      },
    ])
    vi.mocked(usersRepo.list).mockResolvedValue([
      { id: 'boss', role: 'manager', department_id: null },
    ] as never)
    await stockService.createIssueDoc(admin, {
      kind: 'daily',
      lines: [{ material_id: 'm1', qty: 1 }],
    })
    const lowEvents = vi
      .mocked(emit)
      .mock.calls.map((c) => c[0])
      .filter((e) => e.name === 'warehouse.stock.low')
    expect(lowEvents.length).toBeGreaterThan(0)
  })

  it('dùng được vẫn trên min dù tổng thấp hơn trước → KHÔNG cảnh báo', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 100]]))
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PXK-2026-0302')
    vi.mocked(stockInfoMany).mockResolvedValue([
      {
        material_id: 'm1',
        code: 'VT-01',
        name: 'Nhôm',
        unit: 'Kg',
        qty_ok: 30,
        on_hand: 30,
        min_stock: 20,
      },
    ])
    await stockService.createIssueDoc(admin, {
      kind: 'daily',
      lines: [{ material_id: 'm1', qty: 1 }],
    })
    const lowEvents = vi
      .mocked(emit)
      .mock.calls.map((c) => c[0])
      .filter((e) => e.name === 'warehouse.stock.low')
    expect(lowEvents).toHaveLength(0)
  })
})
