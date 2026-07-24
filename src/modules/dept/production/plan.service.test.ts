import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./production.repo', () => ({
  productionRepo: { findById: vi.fn(), listStages: vi.fn(), patch: vi.fn() },
}))
vi.mock('./jobs.repo', () => ({
  jobsRepo: { listByLsx: vi.fn(), replaceForLine: vi.fn(), findById: vi.fn(), patch: vi.fn() },
}))
vi.mock('./plan.repo', () => ({
  planRepo: { defaultRoutesByProducts: vi.fn(), saveDefaultRoute: vi.fn() },
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: { listLines: vi.fn() },
}))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { list: vi.fn() },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  assertAction: vi.fn(),
  hasPermission: vi.fn(),
}))

import { planService } from './plan.service'
import { productionRepo } from './production.repo'
import { jobsRepo } from './jobs.repo'
import { planRepo } from './plan.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'

const planner = { id: 'u-kh', role: 'employee', department_id: 'd-kh' } as unknown as User

const LSX = {
  id: 'lsx1',
  code: 'LSX-01',
  sales_order_id: 'o1',
  status: 'approved',
  priority: 0,
  ship_date: null,
  order_code: 'DH-01',
  customer_name: 'KH A',
}

const LINE = {
  id: 'line1',
  product_id: 'p1',
  product_code: 'SP1',
  product_name: 'Ghế A',
  qty: 50,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(productionRepo.listStages).mockResolvedValue([
    { code: 'phoi', label: 'Phôi' },
    { code: 'han', label: 'Hàn' },
    { code: 'son', label: 'Sơn' },
  ])
  vi.mocked(ordersRepo.listLines).mockResolvedValue([LINE] as never)
  vi.mocked(jobsRepo.listByLsx).mockResolvedValue([])
  vi.mocked(departmentsRepo.list).mockResolvedValue([
    { id: 'd-han', name: 'Tổ Hàn', workspace_id: 'production', stage_code: 'han' },
    { id: 'd-kh', name: 'Kế Hoạch Sản Xuất', workspace_id: 'planning', stage_code: null },
  ] as never)
  vi.mocked(planRepo.defaultRoutesByProducts).mockResolvedValue(new Map())
})

describe('planService.saveLinePlan', () => {
  const input = (stages: { stage: string; team_department_id?: string | null }[]) => ({
    order_line_id: 'line1',
    stages: stages as never,
    save_as_default: false,
  })

  it('lộ trình hợp lệ → replaceForLine với tổ mặc định theo stage_code', async () => {
    await planService.saveLinePlan(planner, 'lsx1', input([{ stage: 'phoi' }, { stage: 'han' }]))
    expect(jobsRepo.replaceForLine).toHaveBeenCalledWith('lsx1', 'line1', [
      expect.objectContaining({ stage: 'phoi', team_department_id: null }),
      expect.objectContaining({ stage: 'han', team_department_id: 'd-han' }),
    ])
  })

  it('công đoạn ngoài danh mục → 400', async () => {
    await expect(
      planService.saveLinePlan(planner, 'lsx1', input([{ stage: 'bay' }])),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('công đoạn lặp → 400', async () => {
    await expect(
      planService.saveLinePlan(planner, 'lsx1', input([{ stage: 'han' }, { stage: 'han' }])),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('bỏ công đoạn ĐÃ CHẠY (doing) khỏi lộ trình → 400 chặn', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      {
        id: 'j1',
        production_order_id: 'lsx1',
        order_line_id: 'line1',
        stage: 'han',
        seq: 1,
        status: 'doing',
      } as never,
    ])
    await expect(
      planService.saveLinePlan(planner, 'lsx1', input([{ stage: 'phoi' }, { stage: 'son' }])),
    ).rejects.toMatchObject({ status: 400 })
    expect(jobsRepo.replaceForLine).not.toHaveBeenCalled()
  })

  it('bỏ công đoạn còn todo → cho phép (job bị xoá)', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      {
        id: 'j1',
        production_order_id: 'lsx1',
        order_line_id: 'line1',
        stage: 'han',
        seq: 1,
        status: 'todo',
      } as never,
    ])
    await planService.saveLinePlan(planner, 'lsx1', input([{ stage: 'phoi' }]))
    expect(jobsRepo.replaceForLine).toHaveBeenCalled()
  })

  it('save_as_default → ghi lộ trình mặc định lên SP', async () => {
    await planService.saveLinePlan(planner, 'lsx1', {
      order_line_id: 'line1',
      stages: [{ stage: 'phoi' }, { stage: 'han' }] as never,
      save_as_default: true,
    })
    expect(planRepo.saveDefaultRoute).toHaveBeenCalledWith('p1', ['phoi', 'han'])
  })

  it('LSX chưa duyệt → 400', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'pending_approval',
    } as never)
    await expect(
      planService.saveLinePlan(planner, 'lsx1', input([{ stage: 'phoi' }])),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('dòng SP không thuộc lệnh → 400', async () => {
    await expect(
      planService.saveLinePlan(planner, 'lsx1', {
        order_line_id: 'line-la',
        stages: [{ stage: 'phoi' }] as never,
        save_as_default: false,
      }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('planService.setPriority', () => {
  it('patch priority trên header', async () => {
    await planService.setPriority(planner, 'lsx1', 5)
    expect(productionRepo.patch).toHaveBeenCalledWith('lsx1', { priority: 5 })
  })
})
