import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./production.repo', () => ({
  productionRepo: { findById: vi.fn(), listStages: vi.fn(), patch: vi.fn() },
}))
vi.mock('./jobs.repo', () => ({
  jobsRepo: {
    listByLsx: vi.fn(),
    replaceForLine: vi.fn(),
    findById: vi.fn(),
    patch: vi.fn(),
  },
}))
vi.mock('./plan.repo', () => ({
  planRepo: {
    defaultRoutesByProducts: vi.fn(),
    saveDefaultRoute: vi.fn(),
    insertChange: vi.fn(),
    listChanges: vi.fn(),
  },
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: { listLines: vi.fn(), listLinesByOrders: vi.fn() },
}))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { list: vi.fn() },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  assertAction: vi.fn(),
  hasPermission: vi.fn(),
}))

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
import { planService } from './plan.service'
import { productionRepo } from './production.repo'
import { jobsRepo } from './jobs.repo'
import { planRepo } from './plan.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'

const planner = { id: 'u-kh', role: 'employee', department_id: 'd-kh' } as unknown as User

const LSX = {
  id: 'lsx1',
  code: 'LSX-01',
  customer_id: 'c1',
  order_ids: ['o1'],
  order_codes: ['DH-01'],
  status: 'approved',
  priority: 0,
  ship_date: null,
  order_code: 'DH-01',
  customer_name: 'KH A',
}

const LINE = {
  id: 'line1',
  group_id: 'g1',
  product_id: 'p1',
  product_code: 'SP1',
  name_vi: 'Ghế A',
  unit: 'cái',
  qty: 50,
  specs: {},
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(productionRepo.listStages).mockResolvedValue([
    { code: 'phoi', label: 'Phôi' },
    { code: 'han', label: 'Hàn' },
    { code: 'son', label: 'Sơn' },
  ])
  vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([LINE] as never)
  vi.mocked(lsxLinesRepo.listGroups).mockResolvedValue([
    { id: 'g1', title: 'Đơn DH-01' },
  ] as never)
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
    await planService.saveLinePlan(
      planner,
      'lsx1',
      input([{ stage: 'phoi' }, { stage: 'han' }]),
    )
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
      planService.saveLinePlan(
        planner,
        'lsx1',
        input([{ stage: 'han' }, { stage: 'han' }]),
      ),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('bỏ công đoạn ĐÃ CHẠY (doing) khỏi lộ trình → 400 chặn', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      {
        id: 'j1',
        production_order_id: 'lsx1',
        production_order_line_id: 'line1',
        stage: 'han',
        seq: 1,
        status: 'doing',
      } as never,
    ])
    await expect(
      planService.saveLinePlan(
        planner,
        'lsx1',
        input([{ stage: 'phoi' }, { stage: 'son' }]),
      ),
    ).rejects.toMatchObject({ status: 400 })
    expect(jobsRepo.replaceForLine).not.toHaveBeenCalled()
  })

  it('bỏ công đoạn còn todo → cho phép (job bị xoá)', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      {
        id: 'j1',
        production_order_id: 'lsx1',
        production_order_line_id: 'line1',
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

describe('saveLinePlan — nhật ký điều chỉnh + lý do (0169)', () => {
  const doingJob = {
    id: 'j1',
    production_order_id: 'lsx1',
    production_order_line_id: 'line1',
    stage: 'han',
    seq: 0,
    status: 'doing',
    team_department_id: 'd-han',
    planned_start: '2026-08-20',
    planned_end: '2026-08-25',
    note: null,
  }
  const save = (stages: unknown[], reason?: string | null) =>
    planService.saveLinePlan(planner, 'lsx1', {
      order_line_id: 'line1',
      stages: stages as never,
      save_as_default: false,
      reason: reason ?? null,
    })

  it('lập lần đầu → ghi log "added", KHÔNG đòi lý do', async () => {
    await save([{ stage: 'phoi' }, { stage: 'han' }])
    expect(planRepo.insertChange).toHaveBeenCalledWith(
      expect.objectContaining({
        production_order_id: 'lsx1',
        production_order_line_id: 'line1',
        reason: null,
        changes: expect.objectContaining({ added: ['phoi', 'han'], removed: [] }),
      }),
    )
  })

  it('dòng ĐÃ CHẠY đổi hạn mà thiếu lý do → 400 PLAN_REASON_REQUIRED, không ghi', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([doingJob] as never)
    await expect(
      save([
        {
          stage: 'han',
          team_department_id: 'd-han',
          planned_start: '2026-08-20',
          planned_end: '2026-08-28',
        },
      ]),
    ).rejects.toMatchObject({ status: 400, code: 'PLAN_REASON_REQUIRED' })
    expect(jobsRepo.replaceForLine).not.toHaveBeenCalled()
    expect(planRepo.insertChange).not.toHaveBeenCalled()
  })

  it('kèm lý do → lưu + log diff đổi hạn với from/to', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([doingJob] as never)
    await save(
      [
        {
          stage: 'han',
          team_department_id: 'd-han',
          planned_start: '2026-08-20',
          planned_end: '2026-08-28',
        },
      ],
      'Tổ thiếu người, lùi hạn',
    )
    expect(jobsRepo.replaceForLine).toHaveBeenCalled()
    expect(planRepo.insertChange).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'Tổ thiếu người, lùi hạn',
        changes: expect.objectContaining({
          changed: [
            { stage: 'han', field: 'planned_end', from: '2026-08-25', to: '2026-08-28' },
          ],
        }),
      }),
    )
  })

  it('lưu y nguyên (không diff) → KHÔNG log, không đòi lý do dù đang chạy', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([doingJob] as never)
    await save([
      {
        stage: 'han',
        team_department_id: 'd-han',
        planned_start: '2026-08-20',
        planned_end: '2026-08-25',
      },
    ])
    expect(planRepo.insertChange).not.toHaveBeenCalled()
  })
})

describe('planService.saveLsxPlan — kế hoạch CẢ LỆNH rải xuống dòng (24/08)', () => {
  const LINE2 = {
    id: 'line2',
    group_id: 'g1',
    product_id: 'p2',
    product_code: 'SP2',
    name_vi: 'Ghế B',
    unit: 'cái',
    qty: 30,
    specs: {},
  }
  const save = (
    stages: {
      stage: string
      team_department_id?: string | null
      planned_start?: string | null
      planned_end?: string | null
    }[],
    opts?: { reason?: string | null; overwrite?: boolean },
  ) =>
    planService.saveLsxPlan(planner, 'lsx1', {
      scope: 'lsx',
      stages: stages as never,
      overwrite: opts?.overwrite ?? false,
      reason: opts?.reason ?? null,
    })

  beforeEach(() => {
    vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([LINE, LINE2] as never)
  })

  it('rải theo lộ trình riêng: p1 chỉ phoi+han, p2 không lộ trình nhận đủ', async () => {
    vi.mocked(planRepo.defaultRoutesByProducts).mockResolvedValue(
      new Map([['p1', ['phoi', 'han']]]),
    )
    const r = await save([{ stage: 'phoi' }, { stage: 'han' }, { stage: 'son' }])
    expect(r.lines_planned).toBe(2)
    expect(jobsRepo.replaceForLine).toHaveBeenCalledWith('lsx1', 'line1', [
      expect.objectContaining({ stage: 'phoi' }),
      expect.objectContaining({ stage: 'han', team_department_id: 'd-han' }),
    ])
    expect(jobsRepo.replaceForLine).toHaveBeenCalledWith('lsx1', 'line2', [
      expect.objectContaining({ stage: 'phoi' }),
      expect.objectContaining({ stage: 'han' }),
      expect.objectContaining({ stage: 'son' }),
    ])
    expect(planRepo.insertChange).toHaveBeenCalledWith(
      expect.objectContaining({
        production_order_line_id: null,
        changes: expect.objectContaining({ added: ['phoi', 'han', 'son'] }),
      }),
    )
  })

  it('client gửi lộn thứ tự → server sắp lại theo danh mục', async () => {
    await save([{ stage: 'son' }, { stage: 'phoi' }])
    expect(jobsRepo.replaceForLine).toHaveBeenCalledWith('lsx1', 'line1', [
      expect.objectContaining({ stage: 'phoi' }),
      expect.objectContaining({ stage: 'son' }),
    ])
  })

  it('một dòng có việc ĐÃ CHẠY ở công đoạn bị loại → 400 chặn CẢ LƯỢT', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      {
        id: 'j1',
        production_order_id: 'lsx1',
        production_order_line_id: 'line2',
        stage: 'son',
        seq: 0,
        status: 'doing',
        team_department_id: null,
        planned_start: null,
        planned_end: null,
      } as never,
    ])
    await expect(
      save([{ stage: 'phoi' }, { stage: 'han' }], { overwrite: true }),
    ).rejects.toMatchObject({ status: 400 })
    expect(jobsRepo.replaceForLine).not.toHaveBeenCalled()
  })

  it('lệnh đã chạy + có diff + thiếu lý do → PLAN_REASON_REQUIRED', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      {
        id: 'j1',
        production_order_id: 'lsx1',
        production_order_line_id: 'line1',
        stage: 'phoi',
        seq: 0,
        status: 'doing',
        team_department_id: null,
        planned_start: null,
        planned_end: null,
      } as never,
    ])
    await expect(
      save([{ stage: 'phoi' }, { stage: 'han' }], { overwrite: true }),
    ).rejects.toMatchObject({ status: 400, code: 'PLAN_REASON_REQUIRED' })
  })

  it('áp y nguyên kế hoạch cũ → không log, không đòi lý do', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      {
        id: 'j1',
        production_order_id: 'lsx1',
        production_order_line_id: 'line1',
        stage: 'han',
        seq: 0,
        status: 'doing',
        team_department_id: 'd-han',
        planned_start: null,
        planned_end: null,
      } as never,
      {
        id: 'j2',
        production_order_id: 'lsx1',
        production_order_line_id: 'line2',
        stage: 'han',
        seq: 0,
        status: 'todo',
        team_department_id: 'd-han',
        planned_start: null,
        planned_end: null,
      } as never,
    ])
    await save([{ stage: 'han', team_department_id: 'd-han' }], { overwrite: true })
    expect(jobsRepo.replaceForLine).toHaveBeenCalledTimes(2)
    expect(planRepo.insertChange).not.toHaveBeenCalled()
  })

  it('MẶC ĐỊNH không ghi đè: dòng đã có kế hoạch giữ nguyên, chỉ dòng trống nhận', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      {
        id: 'j1',
        production_order_id: 'lsx1',
        production_order_line_id: 'line1',
        stage: 'son',
        seq: 0,
        status: 'todo',
        team_department_id: null,
        planned_start: null,
        planned_end: null,
      } as never,
    ])
    const r = await save([{ stage: 'phoi' }, { stage: 'han' }])
    expect(r).toEqual({ lines_planned: 1, lines_kept: 1 })
    expect(jobsRepo.replaceForLine).toHaveBeenCalledTimes(1)
    expect(jobsRepo.replaceForLine).toHaveBeenCalledWith('lsx1', 'line2', [
      expect.objectContaining({ stage: 'phoi' }),
      expect.objectContaining({ stage: 'han' }),
    ])
    // Dòng giữ nguyên không cần lý do dù kế hoạch nó khác bản lệnh.
  })

  it('mọi dòng đã có kế hoạch + không ghi đè → 400 chỉ đường bật Ghi đè', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      {
        id: 'j1',
        production_order_id: 'lsx1',
        production_order_line_id: 'line1',
        stage: 'son',
        seq: 0,
        status: 'todo',
        team_department_id: null,
        planned_start: null,
        planned_end: null,
      } as never,
      {
        id: 'j2',
        production_order_id: 'lsx1',
        production_order_line_id: 'line2',
        stage: 'son',
        seq: 0,
        status: 'todo',
        team_department_id: null,
        planned_start: null,
        planned_end: null,
      } as never,
    ])
    await expect(save([{ stage: 'phoi' }])).rejects.toMatchObject({ status: 400 })
    expect(jobsRepo.replaceForLine).not.toHaveBeenCalled()
  })

  it('công đoạn ngoài danh mục → 400', async () => {
    await expect(save([{ stage: 'bay' }])).rejects.toMatchObject({ status: 400 })
  })
})

describe('planService.patchJob — sửa job lẻ cũng vào nhật ký (0169)', () => {
  const job = (status: string) => ({
    id: 'j1',
    production_order_id: 'lsx1',
    production_order_line_id: 'line1',
    stage: 'han',
    seq: 0,
    status,
    team_department_id: 'd-han',
    planned_start: '2026-08-20',
    planned_end: '2026-08-25',
    note: null,
  })

  beforeEach(() => {
    vi.mocked(jobsRepo.patch).mockImplementation(
      async (_id, patch) => ({ ...job('todo'), ...patch }) as never,
    )
  })

  it('đổi hạn job todo → patch + log diff, không đòi lý do', async () => {
    vi.mocked(jobsRepo.findById).mockResolvedValue(job('todo') as never)
    await planService.patchJob(planner, 'j1', { planned_end: '2026-08-28' })
    expect(jobsRepo.patch).toHaveBeenCalledWith('j1', { planned_end: '2026-08-28' })
    expect(planRepo.insertChange).toHaveBeenCalledWith(
      expect.objectContaining({
        production_order_id: 'lsx1',
        production_order_line_id: 'line1',
        reason: null,
        changes: {
          added: [],
          removed: [],
          changed: [
            { stage: 'han', field: 'planned_end', from: '2026-08-25', to: '2026-08-28' },
          ],
        },
      }),
    )
  })

  it('job ĐÃ CHẠY đổi tổ mà thiếu lý do → 400 PLAN_REASON_REQUIRED, không patch', async () => {
    vi.mocked(jobsRepo.findById).mockResolvedValue(job('doing') as never)
    await expect(
      planService.patchJob(planner, 'j1', { team_department_id: null }),
    ).rejects.toMatchObject({ status: 400, code: 'PLAN_REASON_REQUIRED' })
    expect(jobsRepo.patch).not.toHaveBeenCalled()
    expect(planRepo.insertChange).not.toHaveBeenCalled()
  })

  it('job ĐÃ CHẠY đổi tổ kèm lý do → patch + log, reason KHÔNG lọt vào patch DB', async () => {
    vi.mocked(jobsRepo.findById).mockResolvedValue(job('doing') as never)
    await planService.patchJob(planner, 'j1', {
      team_department_id: null,
      reason: 'Tổ Hàn quá tải, trả về chờ giao lại',
    })
    expect(jobsRepo.patch).toHaveBeenCalledWith('j1', { team_department_id: null })
    expect(planRepo.insertChange).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'Tổ Hàn quá tải, trả về chờ giao lại',
        changes: expect.objectContaining({
          changed: [{ stage: 'han', field: 'team', from: 'd-han', to: null }],
        }),
      }),
    )
  })

  it('chỉ sửa ghi chú → KHÔNG log (ghi chú không phải kế hoạch)', async () => {
    vi.mocked(jobsRepo.findById).mockResolvedValue(job('doing') as never)
    await planService.patchJob(planner, 'j1', { note: 'chờ sơn' })
    expect(jobsRepo.patch).toHaveBeenCalledWith('j1', { note: 'chờ sơn' })
    expect(planRepo.insertChange).not.toHaveBeenCalled()
  })

  it('gửi lại giá trị y cũ → KHÔNG log', async () => {
    vi.mocked(jobsRepo.findById).mockResolvedValue(job('doing') as never)
    await planService.patchJob(planner, 'j1', {
      team_department_id: 'd-han',
      planned_end: '2026-08-25',
    })
    expect(planRepo.insertChange).not.toHaveBeenCalled()
  })
})
