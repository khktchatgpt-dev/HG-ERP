import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./production.repo', () => ({
  productionRepo: {
    findById: vi.fn(),
    patch: vi.fn(),
    insert: vi.fn(),
    existsByCode: vi.fn(),
    attachOrders: vi.fn(),
    detachOrders: vi.fn(),
    insertChange: vi.fn(),
    listChanges: vi.fn(async () => []),
    deleteLsx: vi.fn(),
  },
  saveLsxLineSpecs: vi.fn(),
}))
// Lô xuất của Sale (0222) — D1: hạn xuất đầu lệnh theo lô; mock rỗng mặc định.
vi.mock('@/modules/dept/sales/ship-plan.repo', () => ({
  shipPlanRepo: { lotsOf: vi.fn(async () => []) },
}))
vi.mock('./jobs.repo', () => ({
  jobsRepo: { listByLsx: vi.fn(), replaceForLine: vi.fn() },
}))
vi.mock('./entries.repo', () => ({ entriesRepo: { listByLsx: vi.fn() } }))
// Chụp định mức lúc duyệt lệnh (0142) — mock để test duyệt không chạm DB.
vi.mock('./bom-snapshot.repo', () => ({
  bomSnapshotRepo: {
    ensureForOrder: vi.fn().mockResolvedValue(0),
    snapProducts: vi.fn().mockResolvedValue(0),
    listByOrder: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('./components.repo', () => ({
  componentsRepo: { listByLsx: vi.fn(), deleteByLines: vi.fn() },
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: {
    findById: vi.fn(),
    patch: vi.fn(),
    insertChange: vi.fn(),
    listLines: vi.fn(),
    listLinesByOrders: vi.fn(),
    listByProductionOrder: vi.fn(),
  },
}))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { list: vi.fn() },
}))
vi.mock('@/modules/core/users/users.repo', () => ({ usersRepo: { list: vi.fn() } }))
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  assertAction: vi.fn(),
  hasPermission: vi.fn(),
}))
vi.mock('@/events/register', () => ({}))
vi.mock('@/events/bus', () => ({ emit: vi.fn() }))

vi.mock('./lsx-lines.repo', () => ({
  lsxLinesRepo: {
    listLines: vi.fn(),
    listGroups: vi.fn(),
    listLinesBulk: vi.fn(),
    findLine: vi.fn(),
    replaceAll: vi.fn(),
    deleteGroups: vi.fn(),
    markChanged: vi.fn(),
  },
}))
import { lsxLinesRepo } from './lsx-lines.repo'
import { lsxLinesService } from './lsx-lines.service'
import { shipPlanRepo } from '@/modules/dept/sales/ship-plan.repo'
import { emit } from '@/events/bus'
import { lsxService } from './lsx.service'
import { productionRepo } from './production.repo'
import { jobsRepo } from './jobs.repo'
import { entriesRepo } from './entries.repo'
import { componentsRepo } from './components.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import type { User } from '@/modules/core/users/users.repo'

const quanDoc = { id: 'u-qd', role: 'employee', department_id: 'd-vp' } as unknown as User
const manager = { id: 'u-mgr', role: 'manager', department_id: null } as unknown as User

const LSX = {
  id: 'lsx1',
  code: 'LSX-01',
  // Người LẬP lệnh = chính quanDoc đang thao tác (0119): của ai người đó sửa.
  created_by: 'u-qd',
  customer_id: 'c1',
  order_ids: ['o1'],
  order_codes: ['DH-01'],
  status: 'in_progress',
  note: null,
  customer_name: 'KH A',
}

/** Đơn đã xác nhận, chưa thuộc lệnh nào — ứng viên gộp hợp lệ. */
const freeOrder = (id: string, code: string, customerId = 'c1') => ({
  id,
  code,
  customer_id: customerId,
  customer_name: 'KH A',
  status: 'confirmed',
  production_order_id: null,
})

const doneJob = (id: string, stage: string) => ({
  id,
  production_order_id: 'lsx1',
  production_order_line_id: 'line1',
  stage,
  seq: 0,
  status: 'done',
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(productionRepo.patch).mockImplementation(
    async (_id, p) => ({ ...LSX, ...p }) as never,
  )
})

describe('lsxService.complete — gate mọi việc đã xong', () => {
  it('còn job chưa done → 400 LSX_NOT_READY', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      doneJob('j1', 'phoi'),
      { ...doneJob('j2', 'han'), status: 'doing' },
    ] as never)
    await expect(lsxService.complete(quanDoc, 'lsx1')).rejects.toMatchObject({
      status: 400,
      code: 'LSX_NOT_READY',
    })
    expect(productionRepo.patch).not.toHaveBeenCalled()
  })

  it('chưa có kế hoạch (0 job) → 400', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([])
    await expect(lsxService.complete(quanDoc, 'lsx1')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('mọi job done → completed + đơn completed + ghi lịch sử; đơn đã xuất KHÔNG bị kéo về', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      doneJob('j1', 'phoi'),
      doneJob('j2', 'han'),
    ] as never)
    // Lệnh gộp: o1 còn ở nền, o2 đã xuất một đợt (D4) — chỉ o1 sang completed.
    vi.mocked(ordersRepo.listByProductionOrder).mockResolvedValue([
      { id: 'o1', status: 'lsx_issued' },
      { id: 'o2', status: 'partially_shipped' },
    ] as never)
    const out = await lsxService.complete(quanDoc, 'lsx1')
    expect(out.status).toBe('completed')
    expect(ordersRepo.patch).toHaveBeenCalledWith('o1', { status: 'completed' })
    expect(ordersRepo.patch).not.toHaveBeenCalledWith('o2', expect.anything())
    expect(ordersRepo.insertChange).toHaveBeenCalledWith(
      expect.objectContaining({
        change: expect.objectContaining({ type: 'production_completed' }),
      }),
    )
  })

  it('override còn việc dở: employee → 403; manager không lý do → 400; manager + lý do → ok', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      { ...doneJob('j1', 'phoi'), status: 'todo' },
    ] as never)
    await expect(
      lsxService.complete(quanDoc, 'lsx1', { override: true, note: 'x' }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      lsxService.complete(manager, 'lsx1', { override: true }),
    ).rejects.toMatchObject({ status: 400 })
    const out = await lsxService.complete(manager, 'lsx1', {
      override: true,
      note: 'khách lấy hàng gấp',
    })
    expect(out.status).toBe('completed')
  })

  it('đã completed → idempotent trả nguyên', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'completed',
    } as never)
    const out = await lsxService.complete(quanDoc, 'lsx1')
    expect(out.status).toBe('completed')
    expect(productionRepo.patch).not.toHaveBeenCalled()
  })
})

describe('lsxService.issue — một lệnh gộp nhiều đơn (0113)', () => {
  beforeEach(() => {
    vi.mocked(productionRepo.existsByCode).mockResolvedValue(false)
    vi.mocked(productionRepo.insert).mockResolvedValue({
      order: { ...LSX, id: 'lsx9', code: 'LSX-09', status: 'draft' },
      duplicate: false,
    } as never)
    vi.mocked(ordersRepo.listLinesByOrders).mockResolvedValue([])
    vi.mocked(usersRepo.list).mockResolvedValue([])
  })

  /**
   * 0117: tạo lệnh = NHÁP. Đơn được GẮN vào lệnh ngay (khỏi bị đề xuất phát
   * lệnh lần hai) nhưng CHƯA đổi trạng thái và CHƯA làm phiền GĐ — hai việc đó
   * thuộc về `submit()`.
   */
  it('nhiều đơn cùng khách → lệnh NHÁP, gắn hết đơn, chưa đụng trạng thái đơn', async () => {
    vi.mocked(ordersRepo.findById).mockImplementation(
      async (id) => freeOrder(id, id === 'o1' ? 'DH-01' : 'DH-02') as never,
    )
    await lsxService.issue(quanDoc, { code: 'LSX-09', order_ids: ['o1', 'o2'] })
    expect(productionRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: 'c1', status: 'draft' }),
    )
    expect(productionRepo.attachOrders).toHaveBeenCalledWith('lsx9', ['o1', 'o2'])
    expect(ordersRepo.patch).not.toHaveBeenCalled()
  })

  it('đơn khác khách → 400, không tạo lệnh', async () => {
    vi.mocked(ordersRepo.findById).mockImplementation(
      async (id) => freeOrder(id, 'DH-0x', id === 'o1' ? 'c1' : 'c-khac') as never,
    )
    await expect(
      lsxService.issue(quanDoc, { code: 'LSX-09', order_ids: ['o1', 'o2'] }),
    ).rejects.toMatchObject({ status: 400 })
    expect(productionRepo.insert).not.toHaveBeenCalled()
  })

  it('đơn đã thuộc lệnh khác → 409', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue({
      ...freeOrder('o1', 'DH-01'),
      production_order_id: 'lsx-cu',
    } as never)
    await expect(
      lsxService.issue(quanDoc, { code: 'LSX-09', order_ids: ['o1'] }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('đơn chưa xác nhận → 400', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue({
      ...freeOrder('o1', 'DH-01'),
      status: 'lsx_issued',
    } as never)
    await expect(
      lsxService.issue(quanDoc, { code: 'LSX-09', order_ids: ['o1'] }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

/** 0117: chỉ bước GỬI DUYỆT mới đẩy đơn sang lsx_pending + gọi người duyệt. */
describe('lsxService.submit — nháp → chờ GĐ duyệt (0117)', () => {
  beforeEach(() => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'draft',
    } as never)
    vi.mocked(ordersRepo.findById).mockImplementation(
      async (id) => freeOrder(id, 'DH-01') as never,
    )
    vi.mocked(ordersRepo.listLinesByOrders).mockResolvedValue([])
    vi.mocked(usersRepo.list).mockResolvedValue([])
    vi.mocked(lsxLinesRepo.listGroups).mockResolvedValue([
      { id: 'g1', production_order_id: 'lsx1' },
    ] as never)
    vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([
      {
        id: 'l1',
        group_id: 'g1',
        product_code: 'SP1',
        unit: 'cái',
        qty: 10,
        cbm: null,
        specs: {},
        checks: {},
        extras: {},
      },
    ] as never)
  })

  it('lệnh nháp có dòng → pending_approval + đơn sang lsx_pending', async () => {
    const out = await lsxService.submit(quanDoc, 'lsx1')
    expect(productionRepo.patch).toHaveBeenCalledWith('lsx1', {
      status: 'pending_approval',
    })
    expect(out.status).toBe('pending_approval')
    expect(ordersRepo.patch).toHaveBeenCalledWith('o1', { status: 'lsx_pending' })
  })

  it('lệnh chưa có dòng nào → 400, không gửi đi', async () => {
    vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([] as never)
    await expect(lsxService.submit(quanDoc, 'lsx1')).rejects.toMatchObject({
      status: 400,
    })
    expect(productionRepo.patch).not.toHaveBeenCalled()
  })

  it('dòng thiếu Mã SP / SL / ĐVT → 400 dù lệnh có dòng (gate mức A ở server)', async () => {
    vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([
      { id: 'l1', group_id: 'g1', product_code: 'SP1', unit: 'cái', qty: 0 },
    ] as never)
    await expect(lsxService.submit(quanDoc, 'lsx1')).rejects.toMatchObject({
      status: 400,
    })
    expect(productionRepo.patch).not.toHaveBeenCalled()
  })

  it('lệnh đã gửi rồi → 400 (không gửi hai lần)', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'pending_approval',
    } as never)
    await expect(lsxService.submit(quanDoc, 'lsx1')).rejects.toMatchObject({
      status: 400,
    })
  })
})

/** 0117: sửa đầu lệnh mọi lúc trước khi lệnh kết thúc, không cần bị từ chối. */
describe('lsxService.updateHeader — sửa thông tin đầu lệnh (0117)', () => {
  beforeEach(() => {
    vi.mocked(productionRepo.existsByCode).mockResolvedValue(false)
    vi.mocked(departmentsRepo.list).mockResolvedValue([] as never)
    vi.mocked(usersRepo.list).mockResolvedValue([] as never)
  })

  it('đổi số lệnh + hạn xuất + ghi chú → patch đúng field', async () => {
    await lsxService.updateHeader(quanDoc, 'lsx1', {
      code: 'LSX-01-B',
      ship_date: '2027-01-11',
      note: 'Dời hạn theo khách',
    })
    expect(productionRepo.patch).toHaveBeenCalledWith('lsx1', {
      code: 'LSX-01-B',
      ship_date: '2027-01-11',
      note: 'Dời hạn theo khách',
    })
  })

  it('số lệnh trùng lệnh khác → 409, không ghi', async () => {
    vi.mocked(productionRepo.existsByCode).mockResolvedValue(true)
    await expect(
      lsxService.updateHeader(quanDoc, 'lsx1', { code: 'LSX-TRUNG' }),
    ).rejects.toMatchObject({ status: 409 })
    expect(productionRepo.patch).not.toHaveBeenCalled()
  })

  it('giữ nguyên số lệnh cũ → không coi là trùng', async () => {
    vi.mocked(productionRepo.existsByCode).mockResolvedValue(true)
    await lsxService.updateHeader(quanDoc, 'lsx1', { code: 'LSX-01', priority: 3 })
    expect(productionRepo.patch).toHaveBeenCalledWith('lsx1', { priority: 3 })
  })

  it('lệnh đã hoàn thành → 400 (phiếu đã thành hồ sơ)', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'completed',
    } as never)
    await expect(
      lsxService.updateHeader(quanDoc, 'lsx1', { note: 'x' }),
    ).rejects.toMatchObject({ status: 400 })
  })

  // 07/10/2026: đổi đầu lệnh SAU duyệt → ghi vết + báo xưởng/Cung ứng.
  it('lệnh đang SX đổi hạn xuất → vết header_changed + emit lsx.header.changed', async () => {
    vi.mocked(departmentsRepo.list).mockResolvedValue([] as never)
    vi.mocked(usersRepo.list).mockResolvedValue([] as never)
    await lsxService.updateHeader(quanDoc, 'lsx1', { ship_date: '2027-01-11' })
    expect(productionRepo.insertChange).toHaveBeenCalledWith(
      expect.objectContaining({
        change: expect.objectContaining({
          type: 'header_changed',
          fields: { ship_date: { from: undefined, to: '2027-01-11' } },
        }),
      }),
    )
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'lsx.header.changed' }),
    )
  })

  it('đổi ghi chú (không phải cam kết) → vết nhưng KHÔNG báo', async () => {
    await lsxService.updateHeader(quanDoc, 'lsx1', { note: 'x' })
    expect(emit).not.toHaveBeenCalled()
  })

  it('D1: lệnh đã chia lô có ngày → không gõ tay hạn xuất được (400)', async () => {
    vi.mocked(shipPlanRepo.lotsOf).mockResolvedValue([
      {
        id: 'lot1',
        production_order_id: 'lsx1',
        seq: 1,
        po_no: null,
        po_ref: null,
        order_no: null,
        ship_date: '2026-12-01',
        note: null,
        lines: [],
      },
    ] as never)
    await expect(
      lsxService.updateHeader(quanDoc, 'lsx1', { ship_date: '2027-01-11' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(productionRepo.patch).not.toHaveBeenCalled()
  })
})

describe('lsxService.deleteDraft / cancel (07/10/2026)', () => {
  beforeEach(() => {
    vi.mocked(departmentsRepo.list).mockResolvedValue([] as never)
    vi.mocked(usersRepo.list).mockResolvedValue([] as never)
    vi.mocked(ordersRepo.listByProductionOrder).mockResolvedValue([
      { id: 'o1', code: 'DH-01', status: 'lsx_pending' },
    ] as never)
  })

  it('xoá lệnh NHÁP → đơn về confirmed (vết lsx_deleted), gỡ khỏi lệnh, xoá hẳn', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'draft',
    } as never)
    const out = await lsxService.deleteDraft(quanDoc, 'lsx1')
    expect(out.order_codes).toEqual(['DH-01'])
    expect(productionRepo.detachOrders).toHaveBeenCalledWith(['o1'])
    expect(ordersRepo.patch).toHaveBeenCalledWith('o1', { status: 'confirmed' })
    expect(ordersRepo.insertChange).toHaveBeenCalledWith(
      expect.objectContaining({
        change: expect.objectContaining({ type: 'lsx_deleted' }),
      }),
    )
    expect(productionRepo.deleteLsx).toHaveBeenCalledWith('lsx1')
  })

  it('xoá lệnh đã duyệt → 400 (phải Huỷ lệnh)', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'approved',
    } as never)
    await expect(lsxService.deleteDraft(quanDoc, 'lsx1')).rejects.toMatchObject({
      status: 400,
    })
    expect(productionRepo.deleteLsx).not.toHaveBeenCalled()
  })

  it('huỷ lệnh đã duyệt (chưa chạy) → cancelled, đơn về confirmed, vết + emit lsx.cancelled', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'approved',
    } as never)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([])
    const out = await lsxService.cancel(quanDoc, 'lsx1', 'Khách huỷ PO')
    expect(out.status).toBe('cancelled')
    expect(productionRepo.detachOrders).toHaveBeenCalledWith(['o1'])
    expect(ordersRepo.patch).toHaveBeenCalledWith('o1', { status: 'confirmed' })
    expect(productionRepo.insertChange).toHaveBeenCalledWith(
      expect.objectContaining({
        change: expect.objectContaining({ type: 'cancelled' }),
        note: 'Khách huỷ PO',
      }),
    )
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'lsx.cancelled', reason: 'Khách huỷ PO' }),
    )
  })

  it('lệnh đã có công đoạn chạy: nhân viên → 400; quản lý → huỷ được', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'in_progress',
    } as never)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      { ...doneJob('j1', 'phoi'), status: 'doing' },
    ] as never)
    await expect(lsxService.cancel(quanDoc, 'lsx1', 'x')).rejects.toMatchObject({
      status: 400,
    })
    await lsxService.cancel(manager, 'lsx1', 'Dừng theo GĐ')
    expect(productionRepo.patch).toHaveBeenCalledWith(
      'lsx1',
      expect.objectContaining({ status: 'cancelled' }),
    )
  })

  it('lệnh nháp → không huỷ được (phải Xoá)', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'draft',
    } as never)
    await expect(lsxService.cancel(quanDoc, 'lsx1', 'x')).rejects.toMatchObject({
      status: 400,
    })
  })
})

describe('lsxService.syncFromOrders — đồng bộ dòng lệnh từ đơn (07/10/2026)', () => {
  beforeEach(() => {
    vi.mocked(ordersRepo.listByProductionOrder).mockResolvedValue([
      { id: 'o1', code: 'DH-01', status: 'lsx_issued' },
    ] as never)
    vi.mocked(lsxLinesRepo.listGroups).mockResolvedValue([
      { id: 'g1', sales_order_id: 'o1' },
    ] as never)
    vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([
      { id: 'pl1', group_id: 'g1', product_id: 'p1', product_code: 'SP1', qty: 100 },
      { id: 'pl2', group_id: 'g1', product_id: 'p3', product_code: 'SP3', qty: 5 },
    ] as never)
    vi.mocked(ordersRepo.listLinesByOrders).mockResolvedValue([
      { order_id: 'o1', product_id: 'p1', product_code: 'SP1', qty: 120 },
      { order_id: 'o1', product_id: 'p2', product_code: 'SP2', qty: 7 },
    ] as never)
  })

  it('xem trước: đổi SL · thêm SP · bỏ SP, chưa ghi gì', async () => {
    const out = await lsxService.syncFromOrders(quanDoc, 'lsx1', { apply: false })
    expect(out.items.map((i) => i.kind).sort()).toEqual(['add', 'qty', 'remove'])
    expect(out.applied).toBe(0)
    expect(lsxLinesRepo.replaceAll).not.toHaveBeenCalled()
  })

  it('áp: gọi save với SL mới, bỏ dòng, thêm dòng từ bản nháp đơn; ghi vết synced_from_orders', async () => {
    const save = vi.spyOn(lsxLinesService, 'save').mockResolvedValue({} as never)
    vi.spyOn(lsxLinesService, 'draftFromOrders').mockResolvedValue([
      {
        sales_order_id: 'o1',
        lines: [
          { product_id: 'p1', product_code: 'SP1', qty: 120 },
          { product_id: 'p2', product_code: 'SP2', qty: 7, unit: 'cái' },
        ],
      },
    ] as never)
    const out = await lsxService.syncFromOrders(quanDoc, 'lsx1', {
      apply: true,
      revision_note: 'Khách đổi',
    })
    expect(out.applied).toBe(3)
    const [, , input] = save.mock.calls[0]
    const lines = input.groups[0].lines
    expect(lines.find((l) => l.product_code === 'SP1')?.qty).toBe(120)
    expect(lines.find((l) => l.product_code === 'SP3')).toBeUndefined()
    expect(lines.find((l) => l.product_code === 'SP2')?.qty).toBe(7)
    expect(input.revision_note).toBe('Khách đổi')
    expect(productionRepo.insertChange).toHaveBeenCalledWith(
      expect.objectContaining({
        change: expect.objectContaining({ type: 'synced_from_orders' }),
      }),
    )
    save.mockRestore()
  })
})

describe('lsxService.addOrders / removeOrders (0113)', () => {
  beforeEach(() => {
    vi.mocked(usersRepo.list).mockResolvedValue([])
    vi.mocked(departmentsRepo.list).mockResolvedValue([])
  })

  it('gộp thêm vào lệnh ĐANG CHẠY → đơn sang lsx_issued', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue(freeOrder('o2', 'DH-02') as never)
    await lsxService.addOrders(quanDoc, 'lsx1', ['o2'])
    expect(productionRepo.attachOrders).toHaveBeenCalledWith('lsx1', ['o2'])
    expect(ordersRepo.patch).toHaveBeenCalledWith('o2', { status: 'lsx_issued' })
  })

  it('lệnh đã hoàn thành → 400', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'completed',
    } as never)
    await expect(lsxService.addOrders(quanDoc, 'lsx1', ['o2'])).rejects.toMatchObject({
      status: 400,
    })
  })

  it('lệnh CHƯA duyệt: gỡ đơn → detach + đơn về confirmed + xoá job/định hình của nó', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      // Từ 07/08/2026 chỉ gỡ được khi lệnh chưa qua tay GĐ.
      status: 'draft',
      order_ids: ['o1', 'o2'],
      order_codes: ['DH-01', 'DH-02'],
    } as never)
    vi.mocked(ordersRepo.listByProductionOrder).mockResolvedValue([
      { id: 'o1', code: 'DH-01' },
      { id: 'o2', code: 'DH-02' },
    ] as never)
    vi.mocked(lsxLinesRepo.listGroups).mockResolvedValue([
      { id: 'g1', sales_order_id: 'o1' },
      { id: 'g2', sales_order_id: 'o2' },
    ] as never)
    vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([
      { id: 'line2', group_id: 'g2' },
    ] as never)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      { id: 'j1', production_order_line_id: 'line2', status: 'todo' },
    ] as never)
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([])
    vi.mocked(entriesRepo.listByLsx).mockResolvedValue([])

    await lsxService.removeOrders(quanDoc, 'lsx1', ['o2'])
    // Xoá nhóm của đơn → cascade dòng + job/định hình của riêng nó.
    expect(lsxLinesRepo.deleteGroups).toHaveBeenCalledWith(['g2'])
    expect(productionRepo.detachOrders).toHaveBeenCalledWith(['o2'])
    expect(ordersRepo.patch).toHaveBeenCalledWith('o2', { status: 'confirmed' })
  })

  it('đơn đã có công đoạn chạy → 400, không gỡ', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      order_ids: ['o1', 'o2'],
      order_codes: ['DH-01', 'DH-02'],
    } as never)
    vi.mocked(ordersRepo.listByProductionOrder).mockResolvedValue([
      { id: 'o1', code: 'DH-01' },
      { id: 'o2', code: 'DH-02' },
    ] as never)
    vi.mocked(lsxLinesRepo.listGroups).mockResolvedValue([
      { id: 'g1', sales_order_id: 'o1' },
      { id: 'g2', sales_order_id: 'o2' },
    ] as never)
    vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([
      { id: 'line2', group_id: 'g2' },
    ] as never)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      { id: 'j1', production_order_line_id: 'line2', status: 'doing' },
    ] as never)
    await expect(lsxService.removeOrders(quanDoc, 'lsx1', ['o2'])).rejects.toMatchObject({
      status: 400,
    })
    expect(productionRepo.detachOrders).not.toHaveBeenCalled()
  })

  it('gỡ đơn cuối cùng → 400 (lệnh phải còn ít nhất một đơn)', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'draft',
    } as never)
    vi.mocked(ordersRepo.listByProductionOrder).mockResolvedValue([
      { id: 'o1', code: 'DH-01' },
    ] as never)
    await expect(lsxService.removeOrders(quanDoc, 'lsx1', ['o1'])).rejects.toMatchObject({
      status: 400,
    })
  })

  it('lệnh ĐÃ DUYỆT → 400, không gỡ đơn nữa (chỉ sửa/cập nhật)', async () => {
    // Chốt 07/08/2026: duyệt rồi thì nội dung lệnh là cam kết với xưởng.
    for (const status of ['approved', 'in_progress']) {
      vi.mocked(productionRepo.findById).mockResolvedValue({
        ...LSX,
        status,
        order_ids: ['o1', 'o2'],
        order_codes: ['DH-01', 'DH-02'],
      } as never)
      await expect(
        lsxService.removeOrders(quanDoc, 'lsx1', ['o2']),
      ).rejects.toMatchObject({ status: 400 })
    }
    expect(productionRepo.detachOrders).not.toHaveBeenCalled()
  })

  it('lệnh của NGƯỜI KHÁC → 403 ở mọi cửa ghi', async () => {
    // Của ai người đó sửa (07/08/2026): quanDoc là chủ lệnh, nguoiLa thì không.
    const nguoiLa = { id: 'u-khac', role: 'employee', department_id: 'd-vp' } as never
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'draft',
    } as never)
    for (const call of [
      () => lsxService.submit(nguoiLa, 'lsx1'),
      () => lsxService.updateHeader(nguoiLa, 'lsx1', { note: 'x' }),
      () => lsxService.addOrders(nguoiLa, 'lsx1', ['o2']),
      () => lsxService.removeOrders(nguoiLa, 'lsx1', ['o2']),
    ]) {
      await expect(call()).rejects.toMatchObject({ status: 403 })
    }
  })
})

describe('lsxService.confirmMaterialsReceived', () => {
  it('ghi mốc nhận vật tư trên header', async () => {
    await lsxService.confirmMaterialsReceived(quanDoc, 'lsx1')
    expect(productionRepo.patch).toHaveBeenCalledWith(
      'lsx1',
      expect.objectContaining({ materials_received_by: 'u-qd' }),
    )
  })

  it('LSX chưa duyệt → 400', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'pending_approval',
    } as never)
    await expect(
      lsxService.confirmMaterialsReceived(quanDoc, 'lsx1'),
    ).rejects.toMatchObject({ status: 400 })
  })
})
