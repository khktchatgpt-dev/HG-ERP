import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./production.repo', () => ({
  productionRepo: {
    findById: vi.fn(),
    patch: vi.fn(),
    insertProgress: vi.fn(),
    insert: vi.fn(),
    existsByCode: vi.fn(),
    list: vi.fn(),
    listProgress: vi.fn(),
    listTracking: vi.fn(),
  },
  saveLsxLineSpecs: vi.fn(),
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: {
    findById: vi.fn(),
    patch: vi.fn(),
    insertChange: vi.fn(),
    listLines: vi.fn(),
  },
}))
vi.mock('@/modules/dept/sales/quotes.service', () => ({ isSalesStaff: vi.fn() }))
vi.mock('@/modules/dept/supply/suppliers.service', () => ({ isSupplyStaff: vi.fn() }))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { list: vi.fn(), findById: vi.fn() },
}))
vi.mock('@/modules/core/users/users.repo', () => ({ usersRepo: { list: vi.fn() } }))
vi.mock('@/events/bus', () => ({ emit: vi.fn() }))

import { productionService } from './production.service'
import { productionRepo } from './production.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { isSalesStaff } from '@/modules/dept/sales/quotes.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import type { User } from '@/modules/core/users/users.repo'

const manager = { id: 'u-gd', role: 'manager' } as unknown as User
const supply = {
  id: 'u-cu',
  role: 'employee',
  department_id: 'd-supply',
} as unknown as User
const outsider = {
  id: 'u-x',
  role: 'employee',
  department_id: 'd-other',
} as unknown as User
const worker = {
  id: 'u-to',
  role: 'employee',
  department_id: 'd-to-han',
} as unknown as User
/** Cho `worker` thành nhân sự Xưởng: phòng gán workspace 'production'. */
function mockWorkerDept() {
  vi.mocked(departmentsRepo.findById).mockImplementation(async (id: string) =>
    id === 'd-to-han'
      ? ({ id, name: 'Tổ Hàn', workspace_id: 'production' } as never)
      : null,
  )
}

const LSX = {
  id: 'lsx1',
  code: 'LSX-2026-01',
  sales_order_id: 'o1',
  status: 'approved',
  current_stage: null,
  issued_by: 'u-sales',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(productionRepo.patch).mockImplementation(
    async (_id, p) => ({ ...LSX, ...p }) as never,
  )
})

describe('updateStage — GĐ/QL hoặc Xưởng (Cung ứng hết quyền — siết 07/2026)', () => {
  it('NV Xưởng cập nhật được giai đoạn: LSX approved → in_progress, đơn → in_production', async () => {
    mockWorkerDept()
    const out = await productionService.updateStage(worker, 'lsx1', {
      stage: 'han',
      action: 'done',
    })
    expect(productionRepo.insertProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'han', updated_by: worker.id }),
    )
    expect(ordersRepo.patch).toHaveBeenCalledWith('o1', { status: 'in_production' })
    expect(out.status).toBe('in_progress')
  })

  it('NV Cung ứng → 403 (planner chỉ định hình, không thao tác tiến độ)', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(true)
    await expect(
      productionService.updateStage(supply, 'lsx1', { stage: 'han', action: 'done' }),
    ).rejects.toMatchObject({ status: 403 })
    expect(productionRepo.insertProgress).not.toHaveBeenCalled()
  })

  it('NV phòng khác → 403, không ghi tiến độ', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(false)
    await expect(
      productionService.updateStage(outsider, 'lsx1', { stage: 'han', action: 'done' }),
    ).rejects.toMatchObject({ status: 403 })
    expect(productionRepo.insertProgress).not.toHaveBeenCalled()
  })

  it('LSX chưa duyệt → 400 kể cả với GĐ/QL', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'pending_approval',
    } as never)
    await expect(
      productionService.updateStage(manager, 'lsx1', { stage: 'han', action: 'done' }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('complete — GĐ/QL hoặc Xưởng', () => {
  it('NV Xưởng báo hoàn thành được: LSX + đơn → completed', async () => {
    mockWorkerDept()
    const out = await productionService.complete(worker, 'lsx1')
    expect(out.status).toBe('completed')
    expect(ordersRepo.patch).toHaveBeenCalledWith('o1', { status: 'completed' })
  })

  it('NV Cung ứng → 403 (siết 07/2026)', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(true)
    await expect(productionService.complete(supply, 'lsx1')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('NV phòng khác → 403', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(false)
    await expect(productionService.complete(outsider, 'lsx1')).rejects.toMatchObject({
      status: 403,
    })
  })
})

describe('confirmMaterialsReceived — xác nhận nhận vật tư (G-3, FR-PROD-02)', () => {
  it('NV Xưởng xác nhận được: log action received, KHÔNG đổi trạng thái/giai đoạn', async () => {
    mockWorkerDept()
    await productionService.confirmMaterialsReceived(worker, 'lsx1', 'Đủ theo PXK-0001')
    expect(productionRepo.insertProgress).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'received', note: 'Đủ theo PXK-0001' }),
    )
    expect(productionRepo.patch).not.toHaveBeenCalled()
  })

  it('LSX chưa duyệt → 400', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'pending_approval',
    } as never)
    await expect(
      productionService.confirmMaterialsReceived(manager, 'lsx1'),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('NV phòng khác → 403', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(false)
    await expect(
      productionService.confirmMaterialsReceived(outsider, 'lsx1'),
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe('canTrackProgress — nới cho Xưởng (plan-production-workspace P1)', () => {
  const worker = {
    id: 'u-xuong',
    role: 'employee',
    department_id: 'd-prod',
  } as unknown as User

  beforeEach(() => {
    vi.mocked(isSupplyStaff).mockResolvedValue(false)
    vi.mocked(departmentsRepo.findById).mockResolvedValue({
      id: 'd-prod',
      name: 'Sản Xuất',
      workspace_id: 'production',
    } as never)
  })

  it('nhân sự Xưởng cập nhật được giai đoạn (check workspace_id, không so tên)', async () => {
    const out = await productionService.updateStage(worker, 'lsx1', {
      stage: 'han',
      action: 'done',
    })
    expect(out.status).toBe('in_progress')
    expect(productionRepo.insertProgress).toHaveBeenCalledWith(
      expect.objectContaining({ updated_by: worker.id }),
    )
  })

  it('nhân sự Xưởng xác nhận nhận VT + báo hoàn thành được', async () => {
    await productionService.confirmMaterialsReceived(worker, 'lsx1', 'đủ')
    expect(productionRepo.insertProgress).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'received' }),
    )
    const out = await productionService.complete(worker, 'lsx1')
    expect(out.status).toBe('completed')
  })

  it('Xưởng KHÔNG duyệt được LSX — vẫn chỉ GĐ/QL', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'pending_approval',
    } as never)
    await expect(productionService.approve(worker, 'lsx1')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('phòng thuộc workspace khác → vẫn 403', async () => {
    vi.mocked(departmentsRepo.findById).mockResolvedValue({
      id: 'd-other',
      name: 'Kho',
      workspace_id: 'warehouse',
    } as never)
    await expect(
      productionService.updateStage(worker, 'lsx1', { stage: 'han', action: 'done' }),
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe('LSX đã huỷ theo đơn (P3) — mọi thao tác tiến độ bị chặn', () => {
  beforeEach(() => {
    vi.mocked(isSupplyStaff).mockResolvedValue(true)
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'cancelled',
    } as never)
  })

  it('updateStage → 400', async () => {
    await expect(
      productionService.updateStage(manager, 'lsx1', { stage: 'han', action: 'done' }),
    ).rejects.toMatchObject({ status: 400 })
    expect(productionRepo.insertProgress).not.toHaveBeenCalled()
  })

  it('complete → 400', async () => {
    await expect(productionService.complete(manager, 'lsx1')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('confirmMaterialsReceived → 400', async () => {
    await expect(
      productionService.confirmMaterialsReceived(manager, 'lsx1'),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('resubmit — Sales gửi duyệt lại LSX bị từ chối (plan-order-lsx-lifecycle P1)', () => {
  const sales = {
    id: 'u-sales',
    role: 'employee',
    department_id: 'd-sales',
  } as unknown as User

  beforeEach(() => {
    vi.mocked(isSalesStaff).mockResolvedValue(true)
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'rejected',
      rejected_reason: 'Sai ngày xuất',
    } as never)
    vi.mocked(ordersRepo.findById).mockResolvedValue({
      id: 'o1',
      code: 'DH-2026-0001',
      status: 'confirmed',
      customer_name: 'ACME',
    } as never)
    vi.mocked(ordersRepo.listLines).mockResolvedValue([] as never)
    vi.mocked(usersRepo.list).mockResolvedValue([] as never)
  })

  it('rejected → pending_approval, xoá lý do, đơn → lsx_pending, emit resubmitted', async () => {
    const out = await productionService.resubmit(sales, 'lsx1', {
      ship_date: '2026-09-01',
    })
    expect(productionRepo.patch).toHaveBeenCalledWith(
      'lsx1',
      expect.objectContaining({
        status: 'pending_approval',
        rejected_reason: null,
        ship_date: '2026-09-01',
        issued_by: sales.id,
      }),
    )
    expect(ordersRepo.patch).toHaveBeenCalledWith('o1', { status: 'lsx_pending' })
    expect(vi.mocked(ordersRepo.insertChange).mock.calls[0][0].change).toMatchObject({
      type: 'lsx_resubmitted',
    })
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'lsx.submitted', resubmitted: true }),
    )
    expect(out.status).toBe('pending_approval')
  })

  it('LSX không ở trạng thái rejected → 400', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never) // approved
    await expect(productionService.resubmit(sales, 'lsx1', {})).rejects.toMatchObject({
      status: 400,
    })
    expect(productionRepo.patch).not.toHaveBeenCalled()
  })

  it('NV ngoài Sales → 403', async () => {
    vi.mocked(isSalesStaff).mockResolvedValue(false)
    await expect(productionService.resubmit(outsider, 'lsx1', {})).rejects.toMatchObject({
      status: 403,
    })
  })

  it('đơn đã huỷ trong lúc chờ → 400, không đụng LSX', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue({
      id: 'o1',
      code: 'DH-2026-0001',
      status: 'cancelled',
    } as never)
    await expect(productionService.resubmit(sales, 'lsx1', {})).rejects.toMatchObject({
      status: 400,
    })
    expect(productionRepo.patch).not.toHaveBeenCalled()
  })

  it('field không gửi thì giữ nguyên — patch không chứa key thừa', async () => {
    await productionService.resubmit(sales, 'lsx1', {})
    const patch = vi.mocked(productionRepo.patch).mock.calls[0][1]
    expect(patch).not.toHaveProperty('ship_date')
    expect(patch).not.toHaveProperty('container_summary')
  })
})

describe('approve/reject — vẫn chỉ GĐ/Ban quản lý (không nới cho Cung ứng)', () => {
  it('NV Cung ứng duyệt LSX → 403', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(true)
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'pending_approval',
    } as never)
    await expect(productionService.approve(supply, 'lsx1')).rejects.toMatchObject({
      status: 403,
    })
    await expect(productionService.reject(supply, 'lsx1', 'lý do')).rejects.toMatchObject(
      { status: 403 },
    )
  })
})
