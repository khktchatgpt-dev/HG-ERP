import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./jobs.service', () => ({ jobsService: { overview: vi.fn() } }))
vi.mock('./jobs.repo', () => ({ jobsRepo: { listByLsxBulk: vi.fn() } }))
vi.mock('./lsx-lines.repo', () => ({ lsxLinesRepo: { listLinesBulk: vi.fn() } }))
vi.mock('./entries.repo', () => ({ entriesRepo: { listRange: vi.fn() } }))
vi.mock('./targets.repo', () => ({ targetsRepo: { listRange: vi.fn() } }))
vi.mock('./production.repo', () => ({ productionRepo: { listStages: vi.fn() } }))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { list: vi.fn() },
}))

import { weekService } from './week.service'
import { jobsService } from './jobs.service'
import { jobsRepo } from './jobs.repo'
import { lsxLinesRepo } from './lsx-lines.repo'
import { entriesRepo } from './entries.repo'
import { targetsRepo } from './targets.repo'
import { productionRepo } from './production.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'

const user = { id: 'u1', role: 'admin' } as unknown as User
const WEEK = '2026-08-24' // thứ 2

const row = (over: Record<string, unknown>) => ({
  qty_needed: 100,
  qty_done: 40,
  forecast_date: null,
  lsx: {
    id: 'lsx1',
    code: 'LSX-01',
    customer_name: 'KH A',
    ship_date: '2026-08-26',
    ...((over.lsx as object) ?? {}),
  },
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(jobsService.overview).mockResolvedValue({ rows: [] } as never)
  vi.mocked(jobsRepo.listByLsxBulk).mockResolvedValue([])
  vi.mocked(lsxLinesRepo.listLinesBulk).mockResolvedValue([] as never)
  vi.mocked(entriesRepo.listRange).mockResolvedValue([] as never)
  vi.mocked(targetsRepo.listRange).mockResolvedValue([])
  vi.mocked(productionRepo.listStages).mockResolvedValue([{ code: 'han', label: 'Hàn' }])
  vi.mocked(departmentsRepo.list).mockResolvedValue([
    { id: 't1', name: 'Tổ Hàn', workspace_id: 'production' },
    { id: 't2', name: 'Tổ Sơn', workspace_id: 'production' },
    { id: 'kh', name: 'Kế hoạch', workspace_id: 'planning' },
  ] as never)
})

describe('weekService.board — tuần là lăng kính đọc (24/08)', () => {
  it('lọc lệnh xuất TRONG tuần + cờ dự kiến trễ so ngày xuất', async () => {
    vi.mocked(jobsService.overview).mockResolvedValue({
      rows: [
        row({ forecast_date: '2026-08-28' }), // xuất 26/8, dự kiến 28/8 → TRỄ
        row({
          lsx: { id: 'lsx2', code: 'LSX-02', ship_date: '2026-09-05' }, // ngoài tuần
        }),
        row({
          lsx: { id: 'lsx3', code: 'LSX-03', ship_date: '2026-08-30' },
          forecast_date: '2026-08-29', // kịp
        }),
      ],
    } as never)
    const b = await weekService.board(user, WEEK)
    expect(b.days).toHaveLength(7)
    expect(b.days[0]).toBe('2026-08-24')
    expect(b.ships.map((s) => s.lsx_code)).toEqual(['LSX-01', 'LSX-03'])
    expect(b.ships[0].forecast_late).toBe(true)
    expect(b.ships[1].forecast_late).toBe(false)
  })

  it('việc đến hạn: chỉ job CHƯA xong có hạn trong tuần, gộp theo ngày', async () => {
    vi.mocked(jobsService.overview).mockResolvedValue({ rows: [row({})] } as never)
    vi.mocked(jobsRepo.listByLsxBulk).mockResolvedValue([
      {
        production_order_id: 'lsx1',
        production_order_line_id: 'l1',
        stage: 'han',
        status: 'doing',
        planned_end: '2026-08-25',
        team_name: 'Tổ Hàn',
      },
      {
        production_order_id: 'lsx1',
        production_order_line_id: 'l1',
        stage: 'han',
        status: 'done',
        planned_end: '2026-08-25',
        team_name: 'Tổ Hàn',
      },
      {
        production_order_id: 'lsx1',
        production_order_line_id: 'l1',
        stage: 'han',
        status: 'todo',
        planned_end: '2026-09-10',
        team_name: null,
      },
    ] as never)
    vi.mocked(lsxLinesRepo.listLinesBulk).mockResolvedValue([
      { id: 'l1', product_code: 'SP1' },
    ] as never)
    const b = await weekService.board(user, WEEK)
    expect(b.due_by_day).toHaveLength(1)
    expect(b.due_by_day[0]).toMatchObject({ date: '2026-08-25' })
    expect(b.due_by_day[0].jobs[0]).toMatchObject({
      lsx_code: 'LSX-01',
      product_code: 'SP1',
      stage: 'Hàn',
    })
  })

  it('ma trận tổ × ngày: đạt từ sổ, chỉ tiêu thật (null = chưa giao); tổ trống xếp cuối', async () => {
    vi.mocked(entriesRepo.listRange).mockResolvedValue([
      { team_department_id: 't1', entry_date: '2026-08-24', qty: 80 },
      { team_department_id: 't1', entry_date: '2026-08-24', qty: 20 },
      { team_department_id: 't1', entry_date: '2026-08-26', qty: 50 },
    ] as never)
    vi.mocked(targetsRepo.listRange).mockResolvedValue([
      { team_department_id: 't1', target_date: '2026-08-24', stage: 'han', qty: 120 },
    ] as never)
    const b = await weekService.board(user, WEEK)
    const han = b.teams[0]
    expect(han.team_name).toBe('Tổ Hàn')
    expect(han.cells[0]).toMatchObject({ date: '2026-08-24', done: 100, target: 120 })
    expect(han.cells[2]).toMatchObject({ date: '2026-08-26', done: 50, target: null })
    expect(han.week_done).toBe(150)
    expect(han.week_target).toBe(120)
    // Tổ Sơn không có gì → xếp sau nhưng vẫn hiện đủ 7 ô.
    expect(b.teams[1].team_name).toBe('Tổ Sơn')
    expect(b.teams[1].cells).toHaveLength(7)
  })
})
