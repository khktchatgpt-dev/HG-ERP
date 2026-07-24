import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./entries.repo', () => ({
  entriesRepo: {
    findById: vi.fn(),
    listByLsx: vi.fn(),
    listByDate: vi.fn(),
    insertMany: vi.fn(),
    delete: vi.fn(),
    existsForLsx: vi.fn(),
  },
}))
vi.mock('./components.repo', () => ({
  componentsRepo: { listByLsx: vi.fn() },
}))
vi.mock('./production.repo', () => ({
  productionRepo: { findById: vi.fn(), listStages: vi.fn(), patch: vi.fn() },
}))
vi.mock('./jobs.repo', () => ({
  jobsRepo: { listByLsx: vi.fn(), markDoing: vi.fn() },
}))
vi.mock('./day-locks.repo', () => ({
  dayLocksRepo: {
    find: vi.fn(),
    listByDate: vi.fn(),
    insert: vi.fn(),
    deleteByTeamDate: vi.fn(),
  },
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: { listLines: vi.fn(), patch: vi.fn() },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  assertAction: vi.fn(),
  hasPermission: vi.fn(),
}))

import { entriesService } from './entries.service'
import { entriesRepo } from './entries.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { jobsRepo } from './jobs.repo'
import { dayLocksRepo } from './day-locks.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import type { User } from '@/modules/core/users/users.repo'

const thongKe = {
  id: 'u-tk',
  role: 'employee',
  department_id: 'd-tk',
} as unknown as User
const admin = { id: 'u-adm', role: 'admin', department_id: null } as unknown as User

const LSX = {
  id: 'lsx1',
  code: 'LSX-01',
  sales_order_id: 'o1',
  status: 'approved',
  note: null,
}

const COMP = {
  id: 'c1',
  production_order_id: 'lsx1',
  order_line_id: 'line1',
  cluster: null,
  name: 'TAY+TỰA',
  qty_per_unit: 2,
  dm_kg: null,
  pcs_per_bar: null,
  final_stage: null,
}

const JOB_HAN = {
  id: 'j1',
  production_order_id: 'lsx1',
  order_line_id: 'line1',
  stage: 'han',
  seq: 0,
  status: 'todo',
}

const record = (over: Record<string, unknown> = {}) => ({
  stage: 'han',
  entry_date: '2026-07-24',
  team_department_id: 'd-han',
  entries: [{ component_id: 'c1', qty: 30, defect_qty: 0 }],
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(productionRepo.listStages).mockResolvedValue([
    { code: 'phoi', label: 'Phôi' },
    { code: 'han', label: 'Hàn' },
  ])
  vi.mocked(componentsRepo.listByLsx).mockResolvedValue([COMP] as never)
  vi.mocked(ordersRepo.listLines).mockResolvedValue([
    { id: 'line1', qty: 50, product_code: 'SP1', product_name: 'Ghế A' },
  ] as never)
  vi.mocked(jobsRepo.listByLsx).mockResolvedValue([JOB_HAN] as never)
  vi.mocked(entriesRepo.listByLsx).mockResolvedValue([])
  vi.mocked(dayLocksRepo.find).mockResolvedValue(null)
})

describe('entriesService.record', () => {
  it('ghi sổ hợp lệ → insert + job tự nhích doing + lệnh approved→in_progress', async () => {
    const { warnings } = await entriesService.record(thongKe, 'lsx1', record())
    expect(warnings).toEqual([])
    expect(entriesRepo.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ component_id: 'c1', stage: 'han', qty: 30 }),
    ])
    expect(jobsRepo.markDoing).toHaveBeenCalledWith('lsx1', 'line1', 'han')
    expect(productionRepo.patch).toHaveBeenCalledWith('lsx1', { status: 'in_progress' })
    expect(ordersRepo.patch).toHaveBeenCalledWith('o1', { status: 'in_production' })
  })

  it('công đoạn KHÔNG thuộc kế hoạch dòng SP → 400', async () => {
    await expect(
      entriesService.record(thongKe, 'lsx1', record({ stage: 'phoi' })),
    ).rejects.toMatchObject({ status: 400 })
    expect(entriesRepo.insertMany).not.toHaveBeenCalled()
  })

  it('dòng CHƯA lên kế hoạch → nhập tự do (không chặn)', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([])
    await entriesService.record(thongKe, 'lsx1', record({ stage: 'phoi' }))
    expect(entriesRepo.insertMany).toHaveBeenCalled()
  })

  it('tổ đã chốt sổ ngày → 400', async () => {
    vi.mocked(dayLocksRepo.find).mockResolvedValue({ id: 'lock1' } as never)
    await expect(entriesService.record(thongKe, 'lsx1', record())).rejects.toMatchObject(
      { status: 400 },
    )
  })

  it('nhập vượt tổng cần → KHÔNG chặn, trả warning', async () => {
    // Cần 100 (2 CT/SP × 50); đã có 90, nhập thêm 30 → vượt.
    vi.mocked(entriesRepo.listByLsx).mockResolvedValue([
      { component_id: 'c1', stage: 'han', qty: 90, defect_qty: 0 } as never,
    ])
    const { warnings } = await entriesService.record(thongKe, 'lsx1', record())
    expect(warnings.length).toBe(1)
    expect(entriesRepo.insertMany).toHaveBeenCalled()
  })

  it('chi tiết không thuộc lệnh → 400', async () => {
    await expect(
      entriesService.record(
        thongKe,
        'lsx1',
        record({ entries: [{ component_id: 'c-la', qty: 1, defect_qty: 0 }] }),
      ),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('LSX chưa duyệt → 400', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'pending_approval',
    } as never)
    await expect(entriesService.record(thongKe, 'lsx1', record())).rejects.toMatchObject(
      { status: 400 },
    )
  })
})

describe('entriesService.deleteEntry', () => {
  const ENTRY = {
    id: 'e1',
    production_order_id: 'lsx1',
    team_department_id: 'd-han',
    entry_date: '2026-07-24',
    created_by: 'u-tk',
  }

  it('người tạo xoá được khi chưa chốt sổ', async () => {
    vi.mocked(entriesRepo.findById).mockResolvedValue(ENTRY as never)
    await entriesService.deleteEntry(thongKe, 'e1')
    expect(entriesRepo.delete).toHaveBeenCalledWith('e1')
  })

  it('ngày đã chốt → 400 kể cả admin', async () => {
    vi.mocked(entriesRepo.findById).mockResolvedValue(ENTRY as never)
    vi.mocked(dayLocksRepo.find).mockResolvedValue({ id: 'lock1' } as never)
    await expect(entriesService.deleteEntry(admin, 'e1')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('người khác (không phải QL) → 403', async () => {
    vi.mocked(entriesRepo.findById).mockResolvedValue({
      ...ENTRY,
      created_by: 'ai-do',
    } as never)
    await expect(entriesService.deleteEntry(thongKe, 'e1')).rejects.toMatchObject({
      status: 403,
    })
  })
})

describe('entriesService.lockDay / unlockDay', () => {
  it('NV xưởng bị ép tổ mình', async () => {
    vi.mocked(dayLocksRepo.insert).mockResolvedValue({
      lock: { id: 'l1' },
      duplicate: false,
    } as never)
    await entriesService.lockDay(thongKe, {
      entry_date: '2026-07-24',
      team_department_id: 'd-khac',
    })
    expect(dayLocksRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ team_department_id: 'd-tk' }),
    )
  })

  it('đã chốt rồi → 409', async () => {
    vi.mocked(dayLocksRepo.insert).mockResolvedValue({
      lock: null,
      duplicate: true,
    } as never)
    await expect(
      entriesService.lockDay(admin, {
        entry_date: '2026-07-24',
        team_department_id: 'd-han',
      }),
    ).rejects.toMatchObject({ status: 409 })
  })
})
