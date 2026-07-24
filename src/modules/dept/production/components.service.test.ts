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
  ordersRepo: { listLines: vi.fn() },
}))
vi.mock('@/modules/dept/technical/technical.repo', () => ({
  bomLinesRepo: { replaceAll: vi.fn(), listWithMaterials: vi.fn() },
  productsRepo: { patch: vi.fn() },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  assertAction: vi.fn(),
  hasPermission: vi.fn(),
}))

import { componentsService } from './components.service'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { bomLinesRepo, productsRepo } from '@/modules/dept/technical/technical.repo'
import type { User } from '@/modules/core/users/users.repo'

const thongKe = { id: 'u-tk', role: 'employee' } as unknown as User

const LSX = { id: 'lsx1', code: 'LSX-01', sales_order_id: 'o1', status: 'in_progress' }
const LINE = {
  id: 'line1',
  product_id: 'p1',
  product_code: 'SP1',
  product_name: 'Ghế A',
  qty: 10,
}

const comp = (over: Record<string, unknown>) => ({
  id: 'c?',
  production_order_id: 'lsx1',
  order_line_id: 'line1',
  cluster: null,
  name: '?',
  material_id: null,
  qty_per_unit: 1,
  dm_kg: null,
  pcs_per_bar: null,
  final_stage: null,
  note: null,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(ordersRepo.listLines).mockResolvedValue([LINE] as never)
})

describe('componentsService.saveAsBom — định hình → BOM kỹ thuật', () => {
  it('gộp chi tiết cùng vật tư, ghi đè BOM, bom_status → done', async () => {
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([
      comp({ id: 'c1', name: 'KHUNG CHÂN', material_id: 'm-sat', qty_per_unit: 2 }),
      comp({ id: 'c2', name: 'THANH GIẰNG', material_id: 'm-sat', qty_per_unit: 4 }),
      comp({ id: 'c3', name: 'TỰA LƯNG', material_id: 'm-nhom', qty_per_unit: 1 }),
      comp({ id: 'c4', name: 'NỆM (chưa gắn VT)', material_id: null }),
    ] as never)

    const out = await componentsService.saveAsBom(thongKe, 'lsx1', 'line1')

    expect(out).toEqual({ product_code: 'SP1', bom_lines: 2, skipped_no_material: 1 })
    expect(bomLinesRepo.replaceAll).toHaveBeenCalledWith('p1', [
      expect.objectContaining({
        material_id: 'm-sat',
        qty_per_unit: 6, // 2 + 4 gộp
        note: expect.stringContaining('KHUNG CHÂN ×2'),
      }),
      expect.objectContaining({ material_id: 'm-nhom', qty_per_unit: 1 }),
    ])
    expect(productsRepo.patch).toHaveBeenCalledWith('p1', { bom_status: 'done' })
  })

  it('SP không có dòng chi tiết → 400', async () => {
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([] as never)
    await expect(
      componentsService.saveAsBom(thongKe, 'lsx1', 'line1'),
    ).rejects.toMatchObject({ status: 400 })
    expect(bomLinesRepo.replaceAll).not.toHaveBeenCalled()
  })

  it('không dòng nào gắn vật tư → 400 (BOM = định mức vật tư)', async () => {
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([
      comp({ id: 'c1', name: 'KHUNG', material_id: null }),
    ] as never)
    await expect(
      componentsService.saveAsBom(thongKe, 'lsx1', 'line1'),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('dòng SP không thuộc lệnh → 400', async () => {
    await expect(
      componentsService.saveAsBom(thongKe, 'lsx1', 'line-la'),
    ).rejects.toMatchObject({ status: 400 })
  })
})
