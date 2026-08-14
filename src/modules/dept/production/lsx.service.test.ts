import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./production.repo', () => ({
  productionRepo: {
    findById: vi.fn(),
    patch: vi.fn(),
    insert: vi.fn(),
    existsByCode: vi.fn(),
    attachOrders: vi.fn(),
    detachOrders: vi.fn(),
  },
  saveLsxLineSpecs: vi.fn(),
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
  order_line_id: 'line1',
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

  it('mọi job done → completed + đơn completed + ghi lịch sử', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      doneJob('j1', 'phoi'),
      doneJob('j2', 'han'),
    ] as never)
    const out = await lsxService.complete(quanDoc, 'lsx1')
    expect(out.status).toBe('completed')
    expect(ordersRepo.patch).toHaveBeenCalledWith('o1', { status: 'completed' })
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
