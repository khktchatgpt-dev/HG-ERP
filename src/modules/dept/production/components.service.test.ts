import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./components.repo', () => ({
  componentsRepo: { listByLsx: vi.fn(), replaceAll: vi.fn() },
}))
vi.mock('./entries.repo', () => ({
  entriesRepo: { existsForLsx: vi.fn() },
}))
vi.mock('./jobs.repo', () => ({
  jobsRepo: { listByLsx: vi.fn() },
}))
vi.mock('./production.repo', () => ({
  productionRepo: { findById: vi.fn() },
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: { listLines: vi.fn(), listLinesByOrders: vi.fn() },
}))
vi.mock('@/modules/dept/technical/technical.repo', () => ({
  productProfileRepo: { parts: vi.fn(), clusters: vi.fn() },
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
import { componentsService } from './components.service'
import { productionRepo } from './production.repo'
import { productProfileRepo } from '@/modules/dept/technical/technical.repo'
import type { User } from '@/modules/core/users/users.repo'

const thongKe = { id: 'u-tk', role: 'employee' } as unknown as User

const LSX = {
  id: 'lsx1',
  code: 'LSX-01',
  customer_id: 'c1',
  order_ids: ['o1'],
  order_codes: ['DH-01'],
  status: 'in_progress',
}
const LINE = {
  id: 'line1',
  group_id: 'g1',
  product_id: 'p1',
  product_code: 'SP1',
  name_vi: 'Ghế A',
  unit: 'cái',
  qty: 10,
  specs: {},
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([LINE] as never)
  vi.mocked(lsxLinesRepo.listGroups).mockResolvedValue([{ id: 'g1' }] as never)
  vi.mocked(productProfileRepo.clusters).mockResolvedValue([
    { id: 'cl1', name: 'Cụm khung' },
  ] as never)
})

describe('componentsService.suggest("bom") — gợi ý từ ĐỊNH MỨC (0096/0097)', () => {
  it('map quy cách phôi sang cột spec_*, KHÔNG gắn material_id', async () => {
    vi.mocked(productProfileRepo.parts).mockResolvedValue([
      {
        part_name: 'Chân bàn',
        cluster_id: 'cl1',
        material_kind: 'AL',
        material_code: 'VT-AL-TRON-60',
        dim_a_mm: 60,
        dim_b_mm: null,
        wall_thickness_mm: 1.1,
        cut_length_mm: 570,
        qty: 4,
        unit: 'Cái',
      },
    ] as never)

    const out = await componentsService.suggest(thongKe, 'lsx1', 'bom')

    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      production_order_line_id: 'line1',
      cluster: 'Cụm khung',
      name: 'Chân bàn', // tên chi tiết thật, không phải tên vật tư kho
      spec_thickness_mm: 60,
      spec_length_mm: 570,
      wall_thickness_mm: 1.1,
      qty_per_unit: 4,
      unit: 'Cái',
    })
    // Định mức KHÔNG gắn danh mục kho — người nhập tự chọn vật tư nếu cần.
    expect(out[0].material_id).toBeNull()
  })

  it('SP chưa có định mức → không gợi ý dòng nào', async () => {
    vi.mocked(productProfileRepo.parts).mockResolvedValue([] as never)
    await expect(componentsService.suggest(thongKe, 'lsx1', 'bom')).resolves.toEqual([])
  })
})
