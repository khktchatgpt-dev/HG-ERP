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
    materialShortagesByLsx: vi.fn(),
  },
}))
vi.mock('./components.repo', () => ({
  componentsRepo: { listByLsxBulk: vi.fn() },
}))
vi.mock('./entries.repo', () => ({
  entriesRepo: { listByLsxBulk: vi.fn(), listByDate: vi.fn() },
}))
vi.mock('./day-locks.repo', () => ({
  dayLocksRepo: { listByDate: vi.fn() },
}))
vi.mock('./transfers.repo', () => ({
  transfersRepo: { listRawByLsxBulk: vi.fn() },
}))
vi.mock('./targets.repo', () => ({
  targetsRepo: { listByDate: vi.fn() },
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: { listLines: vi.fn(), listLinesByOrders: vi.fn() },
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
import {
  assessJobProgress,
  jobsService,
  lateByShipDate,
  overdueDays,
} from './jobs.service'
import { jobsRepo, type Job } from './jobs.repo'
import { productionRepo } from './production.repo'
import { componentsRepo } from './components.repo'
import { entriesRepo } from './entries.repo'
import { dayLocksRepo } from './day-locks.repo'
import { transfersRepo } from './transfers.repo'
import { targetsRepo } from './targets.repo'
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
  production_order_line_id: 'line1',
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
  customer_id: 'c1',
  order_ids: ['o1'],
  order_codes: ['DH-01'],
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
  production_order_line_id: 'line1',
  name: 'TAY+TỰA',
  qty_per_unit: 2,
  dm_kg: null,
  pcs_per_bar: null,
  first_stage: null,
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
    {
      ...JOB,
      id: 'j2',
      stage: 'son',
      seq: 2,
      status: 'todo',
      team_department_id: 'dept-son',
    },
  ])
  vi.mocked(componentsRepo.listByLsxBulk).mockResolvedValue([COMP] as never)
  vi.mocked(entriesRepo.listByLsxBulk).mockResolvedValue([])
  vi.mocked(entriesRepo.listByDate).mockResolvedValue([])
  vi.mocked(dayLocksRepo.listByDate).mockResolvedValue([])
  vi.mocked(productionRepo.materialShortagesByLsx).mockResolvedValue(new Map())
  vi.mocked(transfersRepo.listRawByLsxBulk).mockResolvedValue([])
  vi.mocked(targetsRepo.listByDate).mockResolvedValue([])
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
      { production_order_line_id: 'line1', stage: 'han' },
      ['phoi', 'han', 'son'],
      [COMP],
      new Map([['c1|han', 100]]),
    )
    expect(p.ready).toBe(true)
    expect(p.shortfalls).toEqual([])
  })

  it('thiếu số → not ready + liệt kê thiếu', () => {
    const p = assessJobProgress(
      { production_order_line_id: 'line1', stage: 'han' },
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
      { production_order_line_id: 'line1', stage: 'son' },
      ['phoi', 'han', 'son'],
      [COMP, cut],
      new Map([['c1|son', 100]]),
    )
    // c2 (final=han) không cần ở sơn → chỉ c1 tính, và c1 đủ.
    expect(p.ready).toBe(true)
  })

  it('CỤM (first_stage=han) KHÔNG bị tính ở công đoạn phôi (0088)', () => {
    const cum = {
      ...COMP,
      id: 'asm',
      name: 'CỤM TỰA',
      first_stage: 'han',
      final_stage: 'son',
    }
    // Ở PHÔI: chỉ chi tiết c1 tính (cụm chưa xuất hiện) → c1 đủ 100 là ready.
    const atPhoi = assessJobProgress(
      { production_order_line_id: 'line1', stage: 'phoi' },
      ['phoi', 'han', 'son'],
      [COMP, cum],
      new Map([['c1|phoi', 100]]),
    )
    expect(atPhoi.ready).toBe(true)
    expect(atPhoi.shortfalls).toEqual([])
    // Ở HÀN: cụm được tính (và c1 cũng, vì final=null tới cuối) → cần cả hai.
    const atHan = assessJobProgress(
      { production_order_line_id: 'line1', stage: 'han' },
      ['phoi', 'han', 'son'],
      [COMP, cum],
      new Map([['c1|han', 100]]),
    )
    expect(atHan.shortfalls.map((s) => s.name)).toContain('CỤM TỰA')
  })

  it('dòng chưa có bảng chi tiết → has_components=false, không ready', () => {
    const p = assessJobProgress(
      { production_order_line_id: 'line1', stage: 'han' },
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

describe('overdueDays — trễ hẹn vật tư (thuần)', () => {
  it('không hẹn / chưa tới hẹn / đúng hôm nay → null', () => {
    expect(overdueDays(null, '2026-08-23')).toBeNull()
    expect(overdueDays('2026-08-25', '2026-08-23')).toBeNull()
    expect(overdueDays('2026-08-23', '2026-08-23')).toBeNull()
  })

  it('quá hẹn → số ngày dương; nhận cả timestamptz', () => {
    expect(overdueDays('2026-08-20', '2026-08-23')).toBe(3)
    expect(overdueDays('2026-08-20T07:15:00+00:00', '2026-08-23')).toBe(3)
  })
})

describe('jobsService.overview — nhịp hôm nay + vật tư thiếu (GĐ1)', () => {
  it('gom pulse từ sổ hôm nay, đếm tổ hoạt động/chốt sổ, kèm vật tư thiếu', async () => {
    vi.mocked(entriesRepo.listByDate).mockResolvedValue([
      { qty: 10, kg: 5, defect_qty: 1, team_department_id: 'dept-han' },
      { qty: 20, kg: null, defect_qty: 0, team_department_id: 'dept-son' },
      // Dòng không gắn tổ vẫn vào tổng toàn xưởng.
      { qty: 5, kg: 2.5, defect_qty: 0, team_department_id: null },
    ] as never)
    vi.mocked(dayLocksRepo.listByDate).mockResolvedValue([
      { team_department_id: 'dept-han' },
    ] as never)
    vi.mocked(productionRepo.materialShortagesByLsx).mockResolvedValue(
      new Map([
        ['lsx1', { missing_count: 3, missing_names: ['Thép hộp 25', 'Sơn đen'] }],
      ]),
    )

    const { rows, workload, pulse } = await jobsService.overview(admin)

    expect(pulse).toMatchObject({ qty: 35, kg: 7.5, defect: 1 })
    // dept-han (1 doing) + dept-son (1 todo) đều đang hoạt động; chỉ han đã chốt.
    expect(pulse.teams_active).toBe(2)
    expect(pulse.teams_locked).toBe(1)

    const han = workload.find((w) => w.department_id === 'dept-han')
    expect(han).toMatchObject({ today_qty: 10, today_defect: 1, locked_today: true })
    const son = workload.find((w) => w.department_id === 'dept-son')
    expect(son).toMatchObject({ today_qty: 20, locked_today: false })

    // LSX chưa nhận vật tư → khối materials định lượng.
    expect(rows[0].materials).toMatchObject({ missing_count: 3 })
    expect(rows[0].materials?.missing_names).toContain('Thép hộp 25')
    // Chỉ hỏi vật tư cho lệnh CHƯA nhận (tránh query thừa).
    expect(productionRepo.materialShortagesByLsx).toHaveBeenCalledWith(['lsx1'])
  })

  it('lệnh ĐÃ nhận vật tư → materials = null, không hỏi view thiếu', async () => {
    vi.mocked(productionRepo.listActive).mockResolvedValue([
      { ...LSX, materials_received_at: '2026-08-01T00:00:00Z' },
    ] as never)
    const { rows } = await jobsService.overview(admin)
    expect(rows[0].materials).toBeNull()
    expect(productionRepo.materialShortagesByLsx).toHaveBeenCalledWith([])
  })

  it('chỉ tiêu hôm nay SUY từ lộ trình: hạn = hôm nay → dồn phần còn lại (GĐ2)', async () => {
    const today = new Date().toISOString().slice(0, 10)
    // Việc HÀN hạn chót hôm nay; đã làm 40/100 tính đến hết hôm qua.
    vi.mocked(jobsRepo.listByLsxBulk).mockResolvedValue([
      { ...JOB, planned_end: today },
      // Việc SƠN chưa lên hạn → không có chỉ tiêu, không vào mẫu số.
      {
        ...JOB,
        id: 'j2',
        stage: 'son',
        seq: 2,
        status: 'todo',
        team_department_id: 'dept-son',
      },
    ])
    vi.mocked(entriesRepo.listByLsxBulk).mockResolvedValue([
      {
        component_id: 'c1',
        stage: 'han',
        team_department_id: 'dept-han',
        entry_date: '2000-01-01', // trước hôm nay → tính vào doneQty
        qty: 40,
        defect_qty: 0,
        kg: null,
      },
    ] as never)

    const { workload, pulse } = await jobsService.overview(admin)
    expect(pulse.target).toBe(60) // 100 cần − 40 đã làm, dồn cả vào hạn chót
    expect(workload.find((w) => w.department_id === 'dept-han')?.today_target).toBe(60)
    expect(workload.find((w) => w.department_id === 'dept-son')?.today_target).toBe(0)
  })

  it('chỉ tiêu THẬT (0168) đè số suy cho đúng (tổ × công đoạn) đó (GĐ 2.2)', async () => {
    const today = new Date().toISOString().slice(0, 10)
    vi.mocked(jobsRepo.listByLsxBulk).mockResolvedValue([
      { ...JOB, planned_end: today }, // suy: 100 cần → 100/hạn chót
    ])
    // Kế hoạch giao 250 cho (dept-han, han) → số thật thắng số suy.
    vi.mocked(targetsRepo.listByDate).mockResolvedValue([
      {
        team_department_id: 'dept-han',
        stage: 'han',
        qty: 250,
      },
    ] as never)
    const { workload, pulse } = await jobsService.overview(admin)
    expect(pulse.target).toBe(250)
    expect(workload.find((w) => w.department_id === 'dept-han')?.today_target).toBe(250)
  })

  it('tồn WIP + nghẽn từ sổ bàn giao: tồn vượt 3 ngày nhịp → badge nghẽn (GĐ3)', async () => {
    vi.mocked(entriesRepo.listByLsxBulk).mockResolvedValue([
      // Nhịp tổ hàn: 1 ngày có sổ, 40/ngày; đã dùng 40.
      {
        component_id: 'c1',
        stage: 'han',
        team_department_id: 'dept-han',
        entry_date: '2000-01-01',
        qty: 40,
        defect_qty: 0,
        kg: null,
      },
    ] as never)
    vi.mocked(transfersRepo.listRawByLsxBulk).mockResolvedValue([
      {
        team_department_id: 'dept-han',
        stage: 'han',
        direction: 'issue',
        qty: 500,
        entry_date: '2000-01-01',
      },
    ] as never)

    const { workload } = await jobsService.overview(admin)
    const han = workload.find((w) => w.department_id === 'dept-han')
    expect(han?.wip).toBe(460) // 500 giao − 40 đã dùng
    // 460 / nhịp 40 = 11,5 ngày > ngưỡng 3 → nghẽn, nhãn theo danh mục.
    expect(han?.bottleneck_stages).toEqual(['Hàn'])
  })
})
