import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./production.repo', () => ({
  productionRepo: {
    listTracking: vi.fn(),
    listProgressBulk: vi.fn(),
    listStages: vi.fn(),
  },
}))
vi.mock('./routes.repo', () => ({ routesRepo: { stageUnionsByLsx: vi.fn() } }))
vi.mock('./production.service', () => ({
  isProductionStaff: vi.fn(),
  productionService: { updateStage: vi.fn() },
}))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { findById: vi.fn(), list: vi.fn() },
}))

import { deriveCardStatus, teamService } from './team.service'
import { productionRepo } from './production.repo'
import { routesRepo } from './routes.repo'
import { isProductionStaff, productionService } from './production.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'

describe('deriveCardStatus — suy trạng thái thẻ từ sổ production_progress', () => {
  const at = (i: number) => `2026-07-0${i}T00:00:00Z`

  it('không bản ghi nào của công đoạn → todo', () => {
    expect(deriveCardStatus([], 'han')).toBe('todo')
    expect(
      deriveCardStatus([{ stage: 'son', action: 'done', created_at: at(1) }], 'han'),
    ).toBe('todo')
  })

  it("bản ghi 'start' → doing; 'done' → done", () => {
    expect(
      deriveCardStatus([{ stage: 'han', action: 'start', created_at: at(1) }], 'han'),
    ).toBe('doing')
    expect(
      deriveCardStatus(
        [
          { stage: 'han', action: 'start', created_at: at(1) },
          { stage: 'han', action: 'done', created_at: at(2) },
        ],
        'han',
      ),
    ).toBe('done')
  })

  it('done rồi start lại (làm lại) → doing — bản ghi mới nhất thắng', () => {
    expect(
      deriveCardStatus(
        [
          { stage: 'han', action: 'done', created_at: at(1) },
          { stage: 'han', action: 'start', created_at: at(2) },
        ],
        'han',
      ),
    ).toBe('doing')
  })

  it('received / cancelled không ảnh hưởng trạng thái thẻ', () => {
    expect(
      deriveCardStatus(
        [
          { stage: 'han', action: 'done', created_at: at(1) },
          { stage: 'han', action: 'received', created_at: at(2) },
          { stage: 'han', action: 'cancelled', created_at: at(3) },
        ],
        'han',
      ),
    ).toBe('done')
  })
})

// ── board / markStage / workload ─────────────────────────────────────────

const STAGES = [
  { code: 'phoi', label: 'Phôi' },
  { code: 'han', label: 'Hàn' },
  { code: 'son', label: 'Sơn' },
]

const toHan = { id: 'u-th', role: 'employee', department_id: 'd-han' } as unknown as User
const manager = { id: 'u-gd', role: 'manager', department_id: null } as unknown as User
const outsider = {
  id: 'u-x',
  role: 'employee',
  department_id: 'd-sales',
} as unknown as User

function mockDepts() {
  vi.mocked(departmentsRepo.findById).mockImplementation(async (id: string) =>
    id === 'd-han'
      ? ({ id, name: 'Tổ Hàn', workspace_id: 'production', stage_code: 'han' } as never)
      : id === 'd-sales'
        ? ({ id, name: 'Sales', workspace_id: 'sales', stage_code: null } as never)
        : null,
  )
}

/** 2 lệnh đang chạy: lsx1 có route chứa hàn, lsx2 chưa định hình. */
function mockBoardData() {
  vi.mocked(productionRepo.listTracking).mockResolvedValue([
    {
      production_order_id: 'lsx1',
      lsx_code: 'LSX-01',
      lsx_status: 'in_progress',
      code: 'DH-01',
      customer_name: 'ACME',
      ship_date: null,
      status: 'in_production',
      due_date: null,
      lines_bom_pending: 0,
      pos_open: 0,
      current_stage: 'han',
    },
    {
      production_order_id: 'lsx2',
      lsx_code: 'LSX-02',
      lsx_status: 'approved',
      code: 'DH-02',
      customer_name: 'BMB',
      ship_date: null,
      status: 'lsx_issued',
      due_date: null,
      lines_bom_pending: 0,
      pos_open: 0,
      current_stage: null,
    },
    {
      production_order_id: 'lsx3',
      lsx_code: 'LSX-03',
      lsx_status: 'completed',
      code: 'DH-03',
      customer_name: 'C',
      ship_date: null,
      status: 'completed',
      due_date: null,
      lines_bom_pending: 0,
      pos_open: 0,
      current_stage: null,
    },
  ] as never)
  vi.mocked(routesRepo.stageUnionsByLsx).mockResolvedValue(
    new Map([['lsx1', new Set(['phoi', 'han', 'son'])]]),
  )
  vi.mocked(productionRepo.listProgressBulk).mockResolvedValue([
    {
      production_order_id: 'lsx1',
      stage: 'han',
      action: 'start',
      created_at: '2026-07-10T00:00:00Z',
    },
  ])
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.listStages).mockResolvedValue(STAGES)
  vi.mocked(isProductionStaff).mockImplementation(
    async (u: User) => u.department_id === 'd-han',
  )
  mockDepts()
  mockBoardData()
})

describe('teamService.board', () => {
  it('NV tổ Hàn: khoá đúng công đoạn tổ mình, thẻ gồm lệnh routed + lệnh chưa định hình', async () => {
    const board = await teamService.board(toHan, { stage: 'son' }) // cố lách ?stage
    expect(board.stage).toBe('han') // vẫn bị khoá về công đoạn tổ mình
    expect(board.team).toEqual({ id: 'd-han', name: 'Tổ Hàn' })
    expect(board.cards).toHaveLength(2) // lsx3 completed bị loại
    const c1 = board.cards.find((c) => c.lsx_id === 'lsx1')!
    expect(c1).toMatchObject({ status: 'doing', routed: true })
    const c2 = board.cards.find((c) => c.lsx_id === 'lsx2')!
    expect(c2).toMatchObject({ status: 'todo', routed: false })
  })

  it('manager chọn tổ qua ?stage=son — lsx1 không có progress sơn → todo', async () => {
    const board = await teamService.board(manager, { stage: 'son' })
    expect(board.stage).toBe('son')
    expect(board.team).toBe(null)
    expect(board.cards.find((c) => c.lsx_id === 'lsx1')!.status).toBe('todo')
  })

  it('NV ngoài xưởng (không manager) → 403', async () => {
    await expect(teamService.board(outsider, {})).rejects.toMatchObject({ status: 403 })
  })

  it('stage lạ → 400', async () => {
    await expect(teamService.board(manager, { stage: 'la_gi' })).rejects.toMatchObject({
      status: 400,
    })
  })
})

describe('teamService.markStage — quyền mềm theo TỔ', () => {
  it('NV tổ Hàn đánh dấu đúng công đoạn hàn → delegate updateStage', async () => {
    await teamService.markStage(toHan, 'lsx1', { stage: 'han', action: 'done' })
    expect(productionService.updateStage).toHaveBeenCalledWith(toHan, 'lsx1', {
      stage: 'han',
      action: 'done',
    })
  })

  it('NV tổ Hàn đánh dấu công đoạn sơn → 403', async () => {
    await expect(
      teamService.markStage(toHan, 'lsx1', { stage: 'son', action: 'done' }),
    ).rejects.toMatchObject({ status: 403 })
    expect(productionService.updateStage).not.toHaveBeenCalled()
  })

  it('NV ngoài xưởng → 403', async () => {
    await expect(
      teamService.markStage(outsider, 'lsx1', { stage: 'han', action: 'done' }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('manager đánh dấu công đoạn bất kỳ — guard sâu ở updateStage', async () => {
    await teamService.markStage(manager, 'lsx1', { stage: 'son', action: 'start' })
    expect(productionService.updateStage).toHaveBeenCalled()
  })
})

describe('teamService.workloadByTeam — dải tải việc cho quản đốc', () => {
  it('đếm thẻ theo trạng thái per tổ đã gán công đoạn', async () => {
    vi.mocked(departmentsRepo.list).mockResolvedValue([
      { id: 'd-han', name: 'Tổ Hàn', workspace_id: 'production', stage_code: 'han' },
      { id: 'd-son', name: 'Tổ Sơn', workspace_id: 'production', stage_code: 'son' },
      { id: 'd-kh', name: 'Kế Hoạch', workspace_id: 'planning', stage_code: null },
    ] as never)
    const rows = await teamService.workloadByTeam()
    expect(rows).toHaveLength(2) // phòng planning bị loại
    const han = rows.find((r) => r.department_id === 'd-han')!
    // lsx1 đang hàn (doing), lsx2 chưa định hình (todo).
    expect(han).toMatchObject({ stage: 'han', todo: 1, doing: 1, done: 0 })
    const son = rows.find((r) => r.department_id === 'd-son')!
    expect(son).toMatchObject({ stage: 'son', todo: 2, doing: 0, done: 0 })
  })
})
