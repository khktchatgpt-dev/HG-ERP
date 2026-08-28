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
vi.mock('@/modules/dept/technical/technical.service', () => ({
  productsService: { seedPartsFromShaping: vi.fn() },
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
import { entriesRepo } from './entries.repo'
import { jobsRepo } from './jobs.repo'
import { productProfileRepo } from '@/modules/dept/technical/technical.repo'
import { productsService } from '@/modules/dept/technical/technical.service'
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

  it('kg định mức đi theo gợi ý làm dm_kg (user chốt 23/08 — BOM là nguồn)', async () => {
    vi.mocked(productProfileRepo.parts).mockResolvedValue([
      { part_name: 'Chân bàn', cluster_id: null, qty: 4, weight_kg: 0.82 },
    ] as never)
    const out = await componentsService.suggest(thongKe, 'lsx1', 'bom')
    expect(out[0].dm_kg).toBe(0.82)
  })

  it('SP chưa có định mức → không gợi ý dòng nào', async () => {
    vi.mocked(productProfileRepo.parts).mockResolvedValue([] as never)
    await expect(componentsService.suggest(thongKe, 'lsx1', 'bom')).resolves.toEqual([])
  })

  it('cụm CHUẨN (0097) → sinh dòng assembly + chi tiết trong cụm dừng trước hàn (27/08)', async () => {
    vi.mocked(productProfileRepo.clusters).mockResolvedValue([
      {
        id: 'cl1',
        name: 'Cụm khung',
        qty_per_product: 2,
        first_stage: null,
        final_stage: null,
        note: null,
      },
    ] as never)
    vi.mocked(productProfileRepo.parts).mockResolvedValue([
      { part_name: 'Chân', cluster_id: 'cl1', group_code: 'FRAME', qty: 4, unit: 'Cái' },
      // Pát RỜI không thuộc cụm → giữ nguyên, không bị chốt khoảng.
      {
        part_name: 'Pát rời',
        cluster_id: null,
        group_code: 'FRAME',
        qty: 2,
        unit: 'Cái',
      },
    ] as never)

    const out = await componentsService.suggest(thongKe, 'lsx1', 'bom')
    expect(out).toHaveLength(3)
    const chan = out.find((r) => r.name === 'Chân')!
    // 4 chân/SP ÷ 2 cụm/SP = 2 chân/cụm; dừng ngay trước công đoạn ghép.
    expect(chan.final_stage).toBe('phoi')
    expect(chan.qty_per_assembly).toBe(2)
    const pat = out.find((r) => r.name === 'Pát rời')!
    expect(pat.final_stage).toBeUndefined()
    const asm = out.find((r) => r.kind === 'assembly')!
    expect(asm).toMatchObject({
      cluster: 'Cụm khung',
      name: 'Cụm khung',
      group_code: 'FRAME',
      qty_per_unit: 2,
      first_stage: 'han',
      final_stage: null,
      unit: 'cụm',
    })
  })

  it('cụm không định vị được công đoạn ghép (nhóm không qua hàn) → để phẳng', async () => {
    vi.mocked(productProfileRepo.clusters).mockResolvedValue([
      {
        id: 'cl1',
        name: 'Cụm gỗ',
        qty_per_product: null,
        first_stage: null,
        final_stage: null,
        note: null,
      },
    ] as never)
    vi.mocked(productProfileRepo.parts).mockResolvedValue([
      { part_name: 'Nan gỗ', cluster_id: 'cl1', group_code: 'WOOD', qty: 6, unit: 'Cái' },
    ] as never)
    const out = await componentsService.suggest(thongKe, 'lsx1', 'bom')
    expect(out).toHaveLength(1)
    expect(out[0].final_stage).toBeUndefined()
  })
})

describe('componentsService.save + seed_profile — nhập ngược lên hồ sơ SP (23/08)', () => {
  const partLine = {
    production_order_line_id: 'line1',
    kind: 'part' as const,
    cluster: 'Cụm khung',
    name: 'Chân bàn',
    material_type: 'AL',
    spec_thickness_mm: 60,
    spec_width_mm: null,
    spec_length_mm: 570,
    wall_thickness_mm: 1.1,
    unit: 'Cái',
    qty_per_unit: 4,
    dm_kg: 0.82,
  }
  const assemblyLine = {
    production_order_line_id: 'line1',
    kind: 'assembly' as const,
    cluster: 'Cụm khung',
    name: 'CỤM KHUNG',
    qty_per_unit: 1,
  }

  beforeEach(() => {
    vi.mocked(entriesRepo.existsForLsx).mockResolvedValue(false)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([])
  })

  it('seedProfile: gọi seed per SP với dòng CHI TIẾT (bỏ cụm), trả kết quả', async () => {
    vi.mocked(productsService.seedPartsFromShaping).mockResolvedValue({ added: 1 })
    const result = await componentsService.save(
      thongKe,
      'lsx1',
      [partLine, assemblyLine] as never,
      { seedProfile: true },
    )
    expect(productsService.seedPartsFromShaping).toHaveBeenCalledTimes(1)
    expect(productsService.seedPartsFromShaping).toHaveBeenCalledWith(
      'u-tk',
      'p1',
      'LSX-01',
      [
        {
          cluster_name: 'Cụm khung',
          part_name: 'Chân bàn',
          material_kind: 'AL',
          dim_a_mm: 60,
          dim_b_mm: null,
          wall_thickness_mm: 1.1,
          cut_length_mm: 570,
          unit: 'Cái',
          qty: 4,
          weight_kg: 0.82,
        },
      ],
    )
    expect(result.seeded).toEqual([{ product_code: 'SP1', added: 1 }])
  })

  it('SP đã có định mức (has_parts) → bỏ qua IM LẶNG, không báo lỗi', async () => {
    vi.mocked(productsService.seedPartsFromShaping).mockResolvedValue({
      skipped: 'has_parts',
    })
    const result = await componentsService.save(thongKe, 'lsx1', [partLine] as never, {
      seedProfile: true,
    })
    expect(result.seeded).toEqual([])
    expect(result.seed_skipped).toEqual([])
  })

  it('hồ sơ khoá → báo trong seed_skipped', async () => {
    vi.mocked(productsService.seedPartsFromShaping).mockResolvedValue({
      skipped: 'locked',
    })
    const result = await componentsService.save(thongKe, 'lsx1', [partLine] as never, {
      seedProfile: true,
    })
    expect(result.seed_skipped).toEqual([{ product_code: 'SP1', reason: 'locked' }])
  })

  it('không bật seedProfile → không đụng hồ sơ SP', async () => {
    await componentsService.save(thongKe, 'lsx1', [partLine] as never)
    expect(productsService.seedPartsFromShaping).not.toHaveBeenCalled()
  })
})
