import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./jobs.repo', () => ({
  jobsRepo: {
    findById: vi.fn(),
    listByLsx: vi.fn(),
    listByLsxBulk: vi.fn(),
    listByTeam: vi.fn(),
    patch: vi.fn(),
    markDoing: vi.fn(),
  },
}))
vi.mock('./production.repo', () => ({
  productionRepo: {
    findById: vi.fn(),
    listActive: vi.fn(),
    listStages: vi.fn(),
  },
}))
vi.mock('./components.repo', () => ({
  componentsRepo: { listByLsxBulk: vi.fn() },
}))
vi.mock('./entries.repo', () => ({
  entriesRepo: { listByLsxBulk: vi.fn() },
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: { listLines: vi.fn() },
}))
vi.mock('@/modules/core/users/users.repo', () => ({ usersRepo: { list: vi.fn() } }))
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  assertAction: vi.fn(),
  hasPermission: vi.fn(),
}))
vi.mock('@/events/register', () => ({}))
vi.mock('@/events/bus', () => ({ emit: vi.fn() }))

import { assessJobProgress, jobsService, lateByShipDate } from './jobs.service'
import { jobsRepo, type Job } from './jobs.repo'
import { productionRepo } from './production.repo'
import { componentsRepo } from './components.repo'
import { entriesRepo } from './entries.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { HttpError } from '@/server/http'

const admin = { id: 'u-adm', role: 'admin', department_id: null } as unknown as User
const manager = { id: 'u-mgr', role: 'manager', department_id: null } as unknown as User
const toTruong = {
  id: 'u-tt',
  role: 'employee',
  department_id: 'dept-han',
} as unknown as User

const JOB: Job = {
  id: 'j1',
  production_order_id: 'lsx1',
  order_line_id: 'line1',
  stage: 'han',
  seq: 1,
  team_department_id: 'dept-han',
  planned_start: null,
  planned_end: null,
  status: 'doing',
  done_by: null,
  done_at: null,
  note: null,
  created_at: '2026-07-01',
  updated_at: '2026-07-01',
  team_name: 'Tổ Hàn',
}

const LSX = {
  id: 'lsx1',
  code: 'LSX-01',
  sales_order_id: 'o1',
  status: 'in_progress',
  priority: 0,
  ship_date: null,
  order_code: 'DH-01',
  customer_name: 'KH A',
  materials_received_at: null,
  note: null,
}

// Chi tiết: 2 CT/SP × 50 SP = cần 100 mỗi công đoạn.
const COMP = {
  id: 'c1',
  order_line_id: 'line1',
  name: 'TAY+TỰA',
  qty_per_unit: 2,
  dm_kg: null,
  pcs_per_bar: null,
  final_stage: null,
  line_qty: 50,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.listActive).mockResolvedValue([LSX] as never)
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(productionRepo.listStages).mockResolvedValue([
    { code: 'phoi', label: 'Phôi' },
    { code: 'han', label: 'Hàn' },
    { code: 'son', label: 'Sơn' },
  ])
  vi.mocked(jobsRepo.findById).mockResolvedValue(JOB)
  vi.mocked(jobsRepo.listByLsxBulk).mockResolvedValue([
    { ...JOB, id: 'j0', stage: 'phoi', seq: 0, status: 'done' },
    JOB,
    { ...JOB, id: 'j2', stage: 'son', seq: 2, status: 'todo', team_department_id: 'dept-son' },
  ])
  vi.mocked(componentsRepo.listByLsxBulk).mockResolvedValue([COMP] as never)
  vi.mocked(entriesRepo.listByLsxBulk).mockResolvedValue([])
  vi.mocked(jobsRepo.patch).mockImplementation(
    async (_id, p) => ({ ...JOB, ...p }) as Job,
  )
  vi.mocked(usersRepo.list).mockResolvedValue([
    { id: 'u-son-1', role: 'employee', department_id: 'dept-son' },
    { id: 'u-mgr', role: 'manager', department_id: null },
  ] as never)
})

describe('assessJobProgress — đối chiếu số vs bảng chi tiết (thuần)', () => {
  it('đủ số → ready', () => {
    const p = assessJobProgress(
      { order_line_id: 'line1', stage: 'han' },
      ['phoi', 'han', 'son'],
      [COMP],
      new Map([['c1|han', 100]]),
    )
    expect(p.ready).toBe(true)
    expect(p.shortfalls).toEqual([])
  })

  it('thiếu số → not ready + liệt kê thiếu', () => {
    const p = assessJobProgress(
      { order_line_id: 'line1', stage: 'han' },
      ['phoi', 'han', 'son'],
      [COMP],
      new Map([['c1|han', 30]]),
    )
    expect(p.ready).toBe(false)
    expect(p.shortfalls[0]).toMatchObject({ name: 'TAY+TỰA', missing: 70 })
  })

  it('chi tiết dừng ở final_stage không tính vào công đoạn SAU đó', () => {
    const cut = { ...COMP, id: 'c2', name: 'ỐC VÍT', final_stage: 'han' }
    const p = assessJobProgress(
      { order_line_id: 'line1', stage: 'son' },
      ['phoi', 'han', 'son'],
      [COMP, cut],
      new Map([['c1|son', 100]]),
    )
    // c2 (final=han) không cần ở sơn → chỉ c1 tính, và c1 đủ.
    expect(p.ready).toBe(true)
  })

  it('dòng chưa có bảng chi tiết → has_components=false, không ready', () => {
    const p = assessJobProgress(
      { order_line_id: 'line1', stage: 'han' },
      ['han'],
      [],
      new Map(),
    )
    expect(p.has_components).toBe(false)
    expect(p.ready).toBe(false)
  })
})

describe('jobsService.confirmDone — gate MỘT nguồn sự thật', () => {
  it('thiếu số → 400 JOB_NOT_READY, không patch', async () => {
    vi.mocked(entriesRepo.listByLsxBulk).mockResolvedValue([
      { component_id: 'c1', stage: 'han', qty: 30 } as never,
    ])
    await expect(jobsService.confirmDone(toTruong, 'j1')).rejects.toMatchObject({
      status: 400,
      code: 'JOB_NOT_READY',
    })
    expect(jobsRepo.patch).not.toHaveBeenCalled()
  })

  it('đủ số → done + emit bàn giao báo tổ công đoạn kế (sơn)', async () => {
    vi.mocked(entriesRepo.listByLsxBulk).mockResolvedValue([
      { component_id: 'c1', stage: 'han', qty: 100 } as never,
    ])
    const job = await jobsService.confirmDone(toTruong, 'j1')
    expect(job.status).toBe('done')
    expect(jobsRepo.patch).toHaveBeenCalledWith(
      'j1',
      expect.objectContaining({ status: 'done', done_by: 'u-tt' }),
    )
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'production.stage.done',
        stage: 'han',
        next_stages: ['son'],
        notify_next_ids: ['u-son-1'],
      }),
    )
  })

  it('tổ trưởng KHÔNG override được — chỉ Ban quản lý', async () => {
    await expect(
      jobsService.confirmDone(toTruong, 'j1', { override: true, note: 'lý do' }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('manager override thiếu số + có lý do → done, note gắn [ép xác nhận]', async () => {
    const job = await jobsService.confirmDone(manager, 'j1', {
      override: true,
      note: 'khách giục, cho qua',
    })
    expect(job.status).toBe('done')
    expect(jobsRepo.patch).toHaveBeenCalledWith(
      'j1',
      expect.objectContaining({ note: expect.stringContaining('[ép xác nhận]') }),
    )
  })

  it('override không lý do → 400', async () => {
    await expect(
      jobsService.confirmDone(admin, 'j1', { override: true }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('NV xưởng thao tác việc tổ KHÁC → 403', async () => {
    vi.mocked(jobsRepo.findById).mockResolvedValue({
      ...JOB,
      team_department_id: 'dept-son',
    })
    await expect(jobsService.confirmDone(toTruong, 'j1')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('job đã done → trả nguyên, không patch lại (idempotent)', async () => {
    vi.mocked(jobsRepo.findById).mockResolvedValue({ ...JOB, status: 'done' })
    const job = await jobsService.confirmDone(admin, 'j1')
    expect(job.status).toBe('done')
    expect(jobsRepo.patch).not.toHaveBeenCalled()
  })

  it('LSX không đang chạy → 400', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'completed',
    } as never)
    await expect(jobsService.confirmDone(admin, 'j1')).rejects.toBeInstanceOf(HttpError)
  })
})

describe('lateByShipDate', () => {
  it('quá hạn / sát hạn / an toàn', () => {
    expect(lateByShipDate('2026-07-20', '2026-07-24')).toBe('overdue')
    expect(lateByShipDate('2026-07-28', '2026-07-24')).toBe('at_risk')
    expect(lateByShipDate('2026-09-01', '2026-07-24')).toBeNull()
    expect(lateByShipDate(null, '2026-07-24')).toBeNull()
  })
})
