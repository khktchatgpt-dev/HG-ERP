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
  insertMovements: vi.fn(),
  onHandMany: vi.fn(),
  stockInfoMany: vi.fn(),
  lsxNeeds: vi.fn(),
}))
vi.mock('./warehouse.repo', () => ({ materialsRepo: { findById: vi.fn() } }))
vi.mock('./warehouse.service', () => ({ isWarehouseUser: vi.fn() }))
vi.mock('@/modules/dept/supply/supply.repo', () => ({
  supplyRepo: {
    listOpenPos: vi.fn(),
    lineStatus: vi.fn(),
    refreshStatusFromReceipts: vi.fn(),
    findPoCode: vi.fn(),
  },
}))
vi.mock('@/modules/core/users/users.repo', () => ({ usersRepo: { list: vi.fn() } }))
vi.mock('@/events/bus', () => ({ emit: vi.fn() }))

import { stockService } from './stock.service'
import {
  docsRepo,
  insertMovements,
  onHandMany,
  stockInfoMany,
  warehousesRepo,
} from './stock.repo'
import { materialsRepo } from './warehouse.repo'
import { isWarehouseUser } from './warehouse.service'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
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
  vi.mocked(stockInfoMany).mockResolvedValue([])
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

  it('FR-WMS-08: tồn rơi dưới min sau xuất → emit warehouse.stock.low', async () => {
    vi.mocked(onHandMany).mockResolvedValue(new Map([['m1', 100]]))
    vi.mocked(stockInfoMany).mockResolvedValue([
      { material_id: 'm1', code: 'VT-01', name: 'Nhôm', on_hand: 3, min_stock: 20 },
    ])
    vi.mocked(usersRepo.list).mockResolvedValue([
      { id: 'boss', role: 'manager' },
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
    expect(evt.notify_ids).toEqual(['boss'])
  })
})
