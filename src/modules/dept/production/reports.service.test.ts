import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./entries.repo', () => ({
  entriesRepo: { listRange: vi.fn(), listByLsxBulk: vi.fn(), listByLsx: vi.fn() },
}))
vi.mock('./components.repo', () => ({
  componentsRepo: { listByLsxBulk: vi.fn(), listByLsx: vi.fn() },
}))
vi.mock('./production.repo', () => ({
  productionRepo: {
    listCodesByIds: vi.fn(),
    listStages: vi.fn(),
    findById: vi.fn(),
    materialStatusByLsx: vi.fn(),
  },
}))
vi.mock('./bom-snapshot.repo', () => ({
  bomSnapshotRepo: { listByOrder: vi.fn() },
}))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { list: vi.fn() },
}))

import { reportsService } from './reports.service'
import { entriesRepo } from './entries.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { bomSnapshotRepo } from './bom-snapshot.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'

const user = { id: 'u1', role: 'admin' } as unknown as User

// 2 CT/SP × 50 SP → tổng cần 100.
const COMP = {
  id: 'c1',
  name: 'TAY+TỰA',
  cluster: null,
  kind: 'part',
  sort_order: 1,
  qty_per_unit: 2,
  dm_kg: 0.5,
  pcs_per_bar: null,
  line_qty: 50,
  material_id: 'm1',
}

const entry = (over: Record<string, unknown>) => ({
  production_order_id: 'lsx1',
  component_id: 'c1',
  stage: 'han',
  team_department_id: 't1',
  entry_date: '2026-08-02',
  qty: 0,
  kg: null,
  defect_qty: 0,
  defect_reason: null,
  worker_name: null,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(entriesRepo.listRange).mockResolvedValue([])
  vi.mocked(entriesRepo.listByLsxBulk).mockResolvedValue([])
  vi.mocked(entriesRepo.listByLsx).mockResolvedValue([])
  vi.mocked(componentsRepo.listByLsxBulk).mockResolvedValue([COMP] as never)
  vi.mocked(componentsRepo.listByLsx).mockResolvedValue([COMP] as never)
  vi.mocked(productionRepo.listCodesByIds).mockResolvedValue(
    new Map([['lsx1', 'LSX-01']]),
  )
  vi.mocked(productionRepo.listStages).mockResolvedValue([
    { code: 'han', label: 'Hàn' },
    { code: 'son', label: 'Sơn' },
  ])
  vi.mocked(departmentsRepo.list).mockResolvedValue([
    { id: 't1', name: 'Tổ Hàn', workspace_id: 'production' },
    { id: 't2', name: 'Tổ Sơn', workspace_id: 'production' },
  ] as never)
})

describe('reportsService.sanLuong — ma trận kỳ tự do (GĐ4)', () => {
  it('gom theo (lệnh × chi tiết × công đoạn), by_day theo from, lũy kế MỌI kỳ', async () => {
    vi.mocked(entriesRepo.listRange).mockResolvedValue([
      entry({ qty: 30, worker_name: 'Hùng' }),
      entry({ qty: 20, kg: 10 }),
    ] as never)
    // Lũy kế gồm cả tháng trước — Thiếu/Dư so tổng cần phải lũy kế.
    vi.mocked(entriesRepo.listByLsxBulk).mockResolvedValue([
      entry({ qty: 30 }),
      entry({ qty: 20, kg: 10 }),
      entry({ qty: 10, entry_date: '2026-07-01' }),
    ] as never)

    const r = await reportsService.sanLuong(user, {
      from: '2026-08-01',
      to: '2026-08-03',
    })
    expect(r.days).toBe(3)
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]).toMatchObject({
      lsx: 'LSX-01',
      comp: 'TAY+TỰA',
      stage: 'han',
      by_day: [0, 50, 0],
      total: 50,
      kg: 10,
      total_needed: 100,
      done_all: 60,
      workers: ['Hùng'],
    })
    expect(r.total_qty).toBe(50)
  })

  it('lọc theo tổ / kỳ 1 ngày vẫn chạy', async () => {
    vi.mocked(entriesRepo.listRange).mockResolvedValue([
      entry({ qty: 30, entry_date: '2026-08-01' }),
      entry({ qty: 5, team_department_id: 't2', entry_date: '2026-08-01' }),
    ] as never)
    const r = await reportsService.sanLuong(user, {
      from: '2026-08-01',
      to: '2026-08-01',
      team: 't2',
    })
    expect(r.days).toBe(1)
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].total).toBe(5)
  })

  it('kỳ ngược / quá 92 ngày → 400', async () => {
    await expect(
      reportsService.sanLuong(user, { from: '2026-08-10', to: '2026-08-01' }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      reportsService.sanLuong(user, { from: '2026-01-01', to: '2026-12-31' }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('reportsService.phe — gộp lý do gõ tay (GĐ4)', () => {
  it('gộp lý do không phân biệt hoa thường/khoảng trắng; trống → nhóm riêng', async () => {
    vi.mocked(entriesRepo.listRange).mockResolvedValue([
      entry({ defect_qty: 5, defect_reason: 'Trầy xước' }),
      entry({ defect_qty: 3, defect_reason: '  trầy  xước ' }),
      entry({ defect_qty: 2, stage: 'son', team_department_id: 't2' }),
      entry({ qty: 100 }), // không phế → bỏ qua
    ] as never)
    const r = await reportsService.phe(user, { from: '2026-08-01', to: '2026-08-31' })
    expect(r.total_defect).toBe(10)
    expect(r.by_reason[0]).toEqual({ reason: 'Trầy xước', qty: 8 })
    expect(r.by_reason[1]).toEqual({ reason: '(không ghi lý do)', qty: 2 })
    expect(r.by_team).toContainEqual({ team_name: 'Tổ Sơn', qty: 2 })
    expect(r.by_stage[0]).toEqual({ stage_label: 'Hàn', qty: 8 })
  })
})

describe('reportsService.nangSuat — gom worker_name gõ tay (GĐ4)', () => {
  it('trim/hoa-thường gộp một người; tên trống → "(không ghi tên)"; sort SL', async () => {
    vi.mocked(entriesRepo.listRange).mockResolvedValue([
      entry({ qty: 10, defect_qty: 1, kg: 5, worker_name: 'Nguyễn Văn A' }),
      entry({
        qty: 20,
        entry_date: '2026-08-03',
        stage: 'son',
        worker_name: ' nguyễn  văn a ',
      }),
      entry({ qty: 5 }),
    ] as never)
    const r = await reportsService.nangSuat(user, {
      from: '2026-08-01',
      to: '2026-08-31',
    })
    expect(r.rows[0]).toMatchObject({
      worker: 'Nguyễn Văn A',
      qty: 30,
      defect: 1,
      kg: 5,
      days: 2,
    })
    expect(r.rows[0].stages.sort()).toEqual(['Hàn', 'Sơn'])
    expect(r.rows[1]).toMatchObject({ worker: '(không ghi tên)', qty: 5 })
  })
})

describe('reportsService.dinhMuc — hai cột thực dùng tách bạch (GĐ4)', () => {
  beforeEach(() => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      id: 'lsx1',
      code: 'LSX-01',
      customer_name: 'KH A',
    } as never)
    vi.mocked(productionRepo.materialStatusByLsx).mockResolvedValue([
      {
        material_id: 'm1',
        material_code: 'VT001',
        material_name: 'Thép hộp 25',
        unit: 'kg',
        qty_needed: 100,
        qty_issued: 80,
        qty_remaining: 20,
      },
    ])
    vi.mocked(bomSnapshotRepo.listByOrder).mockResolvedValue([
      { snapped_at: '2026-08-10T00:00:00Z' },
    ] as never)
  })

  it('kg sổ thống kê gom theo vật tư qua chi tiết, nằm CẠNH số kho', async () => {
    vi.mocked(entriesRepo.listByLsx).mockResolvedValue([
      entry({ kg: 40 }),
      entry({ kg: 15.5 }),
      entry({ kg: null }), // không kg → không cộng
    ] as never)
    const r = await reportsService.dinhMuc(user, 'lsx1')
    expect(r.snapped_at).toBe('2026-08-10T00:00:00Z')
    expect(r.rows[0]).toMatchObject({
      material_code: 'VT001',
      qty_needed: 100,
      qty_issued: 80,
      kg_logged: 55.5,
    })
  })

  it('chưa chốt định mức → snapped_at null (UI phải nói rõ, không ra 0 sạch)', async () => {
    vi.mocked(bomSnapshotRepo.listByOrder).mockResolvedValue([])
    const r = await reportsService.dinhMuc(user, 'lsx1')
    expect(r.snapped_at).toBeNull()
  })

  it('LSX không tồn tại → 404', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue(null)
    await expect(reportsService.dinhMuc(user, 'x')).rejects.toMatchObject({
      status: 404,
    })
  })
})
