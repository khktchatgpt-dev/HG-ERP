import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./transfers.repo', () => ({
  transfersRepo: {
    findById: vi.fn(),
    listByLsx: vi.fn(),
    listRawByLsx: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('./entries.repo', () => ({
  entriesRepo: { listByLsx: vi.fn() },
}))
vi.mock('./components.repo', () => ({
  componentsRepo: { listByLsx: vi.fn() },
}))
vi.mock('./production.repo', () => ({
  productionRepo: { findById: vi.fn() },
}))
vi.mock('./jobs.repo', () => ({
  jobsRepo: { listByLsx: vi.fn() },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  assertAction: vi.fn(),
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
import { transfersService } from './transfers.service'
import { transfersRepo } from './transfers.repo'
import { entriesRepo } from './entries.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { jobsRepo } from './jobs.repo'
import type { User } from '@/modules/core/users/users.repo'

const thongKe = {
  id: 'u-tk',
  role: 'employee',
  department_id: 'd-tk',
} as unknown as User

const LSX = {
  id: 'lsx1',
  code: 'LSX-01',
  customer_id: 'c1',
  order_ids: ['o1'],
  order_codes: ['DH-01'],
  status: 'in_progress',
}
const COMP = { id: 'c1', production_order_line_id: 'line1', name: 'TAY+TỰA' }
const JOB_HAN = { id: 'j1', production_order_line_id: 'line1', stage: 'han', seq: 0 }

const input = (over: Record<string, unknown> = {}) => ({
  component_id: 'c1',
  stage: 'han',
  team_department_id: 'd-han',
  direction: 'issue' as const,
  entry_date: '2026-07-25',
  qty: 100,
  reason: null,
  note: null,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(componentsRepo.listByLsx).mockResolvedValue([COMP] as never)
  vi.mocked(jobsRepo.listByLsx).mockResolvedValue([JOB_HAN] as never)
  vi.mocked(transfersRepo.listRawByLsx).mockResolvedValue([])
  vi.mocked(entriesRepo.listByLsx).mockResolvedValue([])
})

describe('transfersService.record', () => {
  it('giao vào tổ hợp lệ → insert, không warning', async () => {
    const { warnings } = await transfersService.record(thongKe, 'lsx1', input())
    expect(warnings).toEqual([])
    expect(transfersRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        component_id: 'c1',
        stage: 'han',
        direction: 'issue',
        qty: 100,
        reason: null, // issue không mang lý do
      }),
    )
  })

  it('công đoạn không thuộc kế hoạch dòng SP → 400', async () => {
    await expect(
      transfersService.record(thongKe, 'lsx1', input({ stage: 'phoi' })),
    ).rejects.toMatchObject({ status: 400 })
    expect(transfersRepo.insert).not.toHaveBeenCalled()
  })

  it('trả lại NHIỀU hơn số đã giao → KHÔNG chặn, trả warning', async () => {
    vi.mocked(transfersRepo.listRawByLsx).mockResolvedValue([
      {
        component_id: 'c1',
        stage: 'han',
        team_department_id: 'd-han',
        direction: 'issue',
        qty: 50,
      } as never,
    ])
    const { warnings } = await transfersService.record(
      thongKe,
      'lsx1',
      input({ direction: 'return', qty: 60, reason: 'phôi móp' }),
    )
    expect(warnings.length).toBe(1)
    expect(transfersRepo.insert).toHaveBeenCalled()
  })

  it('LSX chưa duyệt → 400; chi tiết lạ → 400', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'pending_approval',
    } as never)
    await expect(transfersService.record(thongKe, 'lsx1', input())).rejects.toMatchObject(
      { status: 400 },
    )
    vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
    await expect(
      transfersService.record(thongKe, 'lsx1', input({ component_id: 'c-la' })),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('transfersService.list — đối chiếu giao − trả − đã dùng per bộ ba', () => {
  it('gộp đúng theo (chi tiết × công đoạn × tổ), phế cũng tính đã dùng', async () => {
    vi.mocked(transfersRepo.listByLsx).mockResolvedValue([
      {
        id: 't1',
        component_id: 'c1',
        stage: 'han',
        team_department_id: 'd-han',
        direction: 'issue',
        qty: 300,
        component_name: 'TAY+TỰA',
        component_cluster: null,
        team_name: 'Tổ hàn',
      },
      {
        id: 't2',
        component_id: 'c1',
        stage: 'han',
        team_department_id: 'd-han',
        direction: 'return',
        qty: 2,
        component_name: 'TAY+TỰA',
        component_cluster: null,
        team_name: 'Tổ hàn',
      },
    ] as never)
    vi.mocked(entriesRepo.listByLsx).mockResolvedValue([
      {
        component_id: 'c1',
        stage: 'han',
        team_department_id: 'd-han',
        qty: 240,
        defect_qty: 10,
      } as never,
    ])
    const { triples } = await transfersService.list(thongKe, 'lsx1')
    expect(triples).toHaveLength(1)
    expect(triples[0].wip).toEqual({
      issued: 300,
      returned: 2,
      used: 250,
      available: 48,
    })
  })
})

describe('transfersService.deleteEntry', () => {
  it('người tạo xoá được; người khác 403; lệnh kết thúc 400', async () => {
    vi.mocked(transfersRepo.findById).mockResolvedValue({
      id: 't1',
      production_order_id: 'lsx1',
      created_by: 'u-tk',
    } as never)
    await transfersService.deleteEntry(thongKe, 't1')
    expect(transfersRepo.delete).toHaveBeenCalledWith('t1')

    vi.mocked(transfersRepo.findById).mockResolvedValue({
      id: 't1',
      production_order_id: 'lsx1',
      created_by: 'ai-do',
    } as never)
    await expect(transfersService.deleteEntry(thongKe, 't1')).rejects.toMatchObject({
      status: 403,
    })

    vi.mocked(transfersRepo.findById).mockResolvedValue({
      id: 't1',
      production_order_id: 'lsx1',
      created_by: 'u-tk',
    } as never)
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'completed',
    } as never)
    await expect(transfersService.deleteEntry(thongKe, 't1')).rejects.toMatchObject({
      status: 400,
    })
  })
})
