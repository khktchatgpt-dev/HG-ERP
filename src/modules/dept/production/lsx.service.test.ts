import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./production.repo', () => ({
  productionRepo: {
    findById: vi.fn(),
    patch: vi.fn(),
    insert: vi.fn(),
    existsByCode: vi.fn(),
  },
  saveLsxLineSpecs: vi.fn(),
}))
vi.mock('./jobs.repo', () => ({
  jobsRepo: { listByLsx: vi.fn() },
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: {
    findById: vi.fn(),
    patch: vi.fn(),
    insertChange: vi.fn(),
    listLines: vi.fn(),
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

import { lsxService } from './lsx.service'
import { productionRepo } from './production.repo'
import { jobsRepo } from './jobs.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import type { User } from '@/modules/core/users/users.repo'

const quanDoc = { id: 'u-qd', role: 'employee', department_id: 'd-vp' } as unknown as User
const manager = { id: 'u-mgr', role: 'manager', department_id: null } as unknown as User

const LSX = {
  id: 'lsx1',
  code: 'LSX-01',
  sales_order_id: 'o1',
  status: 'in_progress',
  note: null,
  order_code: 'DH-01',
  customer_name: 'KH A',
}

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
