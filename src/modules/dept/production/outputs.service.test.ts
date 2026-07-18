import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./outputs.repo', () => ({
  outputsRepo: {
    listByLsx: vi.fn(),
    insertMany: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
    existsForLsx: vi.fn(),
  },
}))
vi.mock('./components.repo', () => ({
  componentsRepo: { listByLsx: vi.fn() },
}))
vi.mock('./production.repo', () => ({
  productionRepo: { findById: vi.fn(), listStages: vi.fn() },
}))
vi.mock('./production.service', () => ({ isProductionStaff: vi.fn() }))
vi.mock('./routes.repo', () => ({
  routesRepo: {
    listByLsx: vi.fn(),
    replaceAll: vi.fn(),
    productDefaults: vi.fn(),
    countsByLsx: vi.fn(),
    saveProductDefault: vi.fn(),
  },
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: { listLines: vi.fn() },
}))
vi.mock('@/modules/dept/supply/suppliers.service', () => ({ isSupplyStaff: vi.fn() }))

import { outputsService } from './outputs.service'
import { outputsRepo } from './outputs.repo'
import { routesRepo } from './routes.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { isProductionStaff } from './production.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import type { User } from '@/modules/core/users/users.repo'

const worker = {
  id: 'u-to',
  role: 'employee',
  department_id: 'd-to-phoi',
} as unknown as User
const outsider = {
  id: 'u-x',
  role: 'employee',
  department_id: 'd-sales',
} as unknown as User

const LSX = { id: 'lsx1', code: 'LSX-01', sales_order_id: 'o1', status: 'in_progress' }
// Ghế 48 chiếc: TAY+TỰA 2 CT/SP → tổng cần 96.
const COMPONENT = {
  id: 'c1',
  order_line_id: 'ol1',
  cluster: 'CỤM TỰA',
  name: 'TAY+TỰA',
  qty_per_unit: 2,
  dm_kg: 0.85,
  pcs_per_bar: 6,
}
const ORDER_LINES = [
  { id: 'ol1', product_id: 'p1', product_code: 'SP1', product_name: 'Ghế Hali', qty: 48 },
]
const STAGES = [
  { code: 'phoi', label: 'Phôi' },
  { code: 'han', label: 'Hàn' },
  { code: 'nguoi', label: 'Nguội' },
  { code: 'son', label: 'Sơn' },
]

const RECORD = {
  stage: 'phoi',
  entry_date: '2026-07-11',
  entries: [{ component_id: 'c1', qty: 40, defect_qty: 1 }],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isProductionStaff).mockResolvedValue(true)
  vi.mocked(isSupplyStaff).mockResolvedValue(false)
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(productionRepo.listStages).mockResolvedValue(STAGES as never)
  vi.mocked(componentsRepo.listByLsx).mockResolvedValue([COMPONENT] as never)
  vi.mocked(ordersRepo.listLines).mockResolvedValue(ORDER_LINES as never)
  vi.mocked(outputsRepo.listByLsx).mockResolvedValue([] as never)
  // Mặc định: lệnh CHƯA định hình lộ trình → nhập tự do (tương thích lệnh cũ).
  vi.mocked(routesRepo.listByLsx).mockResolvedValue([])
})

describe('outputsService.record — nhập sản lượng theo lô (FR-PR-02/03/07)', () => {
  it('thống kê tổ nhập được — tổ mặc định = phòng của người nhập', async () => {
    const { warnings } = await outputsService.record(worker, 'lsx1', RECORD)
    expect(warnings).toEqual([])
    const rows = vi.mocked(outputsRepo.insertMany).mock.calls[0][0]
    expect(rows[0]).toMatchObject({
      production_order_id: 'lsx1',
      component_id: 'c1',
      stage: 'phoi',
      team_department_id: 'd-to-phoi',
      qty: 40,
      defect_qty: 1,
      created_by: worker.id,
    })
  })

  it('lộ trình đã định hình (0063): chặn nhập giai đoạn NGOÀI lộ trình của SP', async () => {
    // SP chỉ đi Phôi→Hàn — nhập Sơn phải bị chặn với lỗi chỉ đường sửa.
    vi.mocked(routesRepo.listByLsx).mockResolvedValue([
      { order_line_id: 'ol1', stages: ['phoi', 'han'] },
    ])
    await expect(
      outputsService.record(worker, 'lsx1', { ...RECORD, stage: 'son' }),
    ).rejects.toThrow(/lộ trình/)
    // Giai đoạn thuộc lộ trình thì vẫn nhập bình thường.
    const { warnings } = await outputsService.record(worker, 'lsx1', RECORD)
    expect(warnings).toEqual([])
  })

  it('FR-PR-07: nhập vượt tổng cần → KHÔNG chặn, trả warning nêu số vượt', async () => {
    vi.mocked(outputsRepo.listByLsx).mockResolvedValue([
      { component_id: 'c1', stage: 'phoi', qty: 90, defect_qty: 0 },
    ] as never)
    const { warnings } = await outputsService.record(worker, 'lsx1', {
      ...RECORD,
      entries: [{ component_id: 'c1', qty: 10 }],
    })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('VƯỢT 4') // 90+10=100 > 96
    expect(outputsRepo.insertMany).toHaveBeenCalled() // vẫn ghi
  })

  it('NV ngoài xưởng/KH-CƯ/QL → 403', async () => {
    vi.mocked(isProductionStaff).mockResolvedValue(false)
    await expect(outputsService.record(outsider, 'lsx1', RECORD)).rejects.toMatchObject({
      status: 403,
    })
  })

  it.each(['pending_approval', 'rejected', 'completed', 'cancelled'])(
    'LSX %s → 400',
    async (status) => {
      vi.mocked(productionRepo.findById).mockResolvedValue({
        ...LSX,
        status,
      } as never)
      await expect(outputsService.record(worker, 'lsx1', RECORD)).rejects.toMatchObject({
        status: 400,
      })
      expect(outputsRepo.insertMany).not.toHaveBeenCalled()
    },
  )

  it('chi tiết không thuộc lệnh → 400', async () => {
    await expect(
      outputsService.record(worker, 'lsx1', {
        ...RECORD,
        entries: [{ component_id: 'c-la', qty: 1 }],
      }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('outputsService.summary — thiếu/dư, %HT, đồng bộ (FR-PR-04/05/06)', () => {
  it('gộp sổ theo chi tiết×công đoạn; đồng bộ theo chi tiết chậm nhất', async () => {
    vi.mocked(outputsRepo.listByLsx).mockResolvedValue([
      { component_id: 'c1', stage: 'phoi', qty: 96, defect_qty: 2 },
      { component_id: 'c1', stage: 'son', qty: 50, defect_qty: 0 },
    ] as never)

    const out = await outputsService.summary(worker, 'lsx1')

    const c1 = out.components[0]
    expect(c1.total_needed).toBe(96)
    expect(c1.summary.stages[0]).toMatchObject({ stage: 'phoi', done: 96, missing: 0 })
    expect(c1.summary.done_final).toBe(50) // sơn = công đoạn cuối
    expect(c1.summary.status).toBe('in_progress')
    // Đồng bộ: floor(50 sơn / 2 CT-per-SP) = 25 bộ trên 48 cần.
    expect(out.synced_by_line[0]).toMatchObject({ product_code: 'SP1', synced_sets: 25 })
  })
})

describe('outputsService.deleteEntry — xoá nhập nhầm (append-only)', () => {
  const ENTRY = { id: 'e1', production_order_id: 'lsx1', created_by: 'u-to' }

  it('người tạo xoá được; người khác (không QL) → 403', async () => {
    vi.mocked(outputsRepo.findById).mockResolvedValue(ENTRY as never)
    await outputsService.deleteEntry(worker, 'e1')
    expect(outputsRepo.delete).toHaveBeenCalledWith('e1')

    await expect(outputsService.deleteEntry(outsider, 'e1')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('LSX đã kết thúc → sổ khoá (400)', async () => {
    vi.mocked(outputsRepo.findById).mockResolvedValue(ENTRY as never)
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'completed',
    } as never)
    await expect(outputsService.deleteEntry(worker, 'e1')).rejects.toMatchObject({
      status: 400,
    })
  })
})
