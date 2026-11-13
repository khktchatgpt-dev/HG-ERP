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
  productionRepo: { findById: vi.fn(), listStages: vi.fn() },
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: { listLines: vi.fn(), listLinesByOrders: vi.fn() },
}))
vi.mock('@/modules/dept/technical/technical.repo', () => ({
  productProfileRepo: { parts: vi.fn(), clusters: vi.fn() },
}))
vi.mock('@/modules/dept/technical/technical.service', () => ({
  productsService: {
    seedPartsFromShaping: vi.fn(),
    syncClusterRoutesFromShaping: vi.fn(),
    syncClusterQtyFromShaping: vi.fn(),
  },
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

describe('componentsService.save — ghi ngược LỘ TRÌNH CỤM lên hồ sơ SP (04/11/2026)', () => {
  const cumKhung = {
    production_order_line_id: 'line1',
    kind: 'assembly' as const,
    cluster: 'Cụm khung',
    name: 'CỤM KHUNG',
    qty_per_unit: 1,
    stages: ['han', 'nguoi', 'son'],
  }
  const cumTheoHoSo = { ...cumKhung, cluster: 'Cụm tựa', name: 'CỤM TỰA', stages: null }
  const chiTiet = {
    production_order_line_id: 'line1',
    kind: 'part' as const,
    cluster: 'Cụm khung',
    name: 'Chân',
    qty_per_unit: 2,
    stages: ['phoi'],
  }

  beforeEach(() => {
    vi.mocked(entriesRepo.existsForLsx).mockResolvedValue(false)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([])
    vi.mocked(productsService.syncClusterRoutesFromShaping).mockReset()
  })

  it('mặc định BẬT: chỉ dòng CỤM có stages đi lên hồ sơ, khớp theo tên cụm; chi tiết và cụm null không gửi', async () => {
    vi.mocked(productsService.syncClusterRoutesFromShaping).mockResolvedValue({
      updated: 1,
      missing: [],
    })
    const r = await componentsService.save(thongKe, 'lsx1', [
      cumKhung,
      cumTheoHoSo,
      chiTiet,
    ] as never)
    expect(productsService.syncClusterRoutesFromShaping).toHaveBeenCalledTimes(1)
    expect(productsService.syncClusterRoutesFromShaping).toHaveBeenCalledWith(
      thongKe,
      'p1',
      'LSX-01',
      [{ name: 'Cụm khung', stages: ['han', 'nguoi', 'son'] }],
    )
    expect(r.routes_synced).toEqual([{ product_code: 'SP1', updated: 1 }])
    expect(r.routes_missing).toEqual([])
  })

  it('tắt syncProfileRoutes (lệnh ngoại lệ một lần) → không đụng hồ sơ', async () => {
    await componentsService.save(thongKe, 'lsx1', [cumKhung] as never, {
      syncProfileRoutes: false,
    })
    expect(productsService.syncClusterRoutesFromShaping).not.toHaveBeenCalled()
  })

  it('cụm chỉ có trên lệnh → routes_missing; hồ sơ khoá → routes_skipped', async () => {
    vi.mocked(productsService.syncClusterRoutesFromShaping).mockResolvedValueOnce({
      updated: 0,
      missing: ['Cụm khung'],
    })
    const r1 = await componentsService.save(thongKe, 'lsx1', [cumKhung] as never)
    expect(r1.routes_synced).toEqual([])
    expect(r1.routes_missing).toEqual([{ product_code: 'SP1', cluster: 'Cụm khung' }])

    vi.mocked(productsService.syncClusterRoutesFromShaping).mockResolvedValueOnce({
      skipped: 'locked',
    })
    const r2 = await componentsService.save(thongKe, 'lsx1', [cumKhung] as never)
    expect(r2.routes_skipped).toEqual([{ product_code: 'SP1', reason: 'locked' }])
  })

  it('kế hoạch tổ & hạn KHÔNG chặn định hình: công đoạn cuối ngoài kế hoạch vẫn lưu được', async () => {
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      { production_order_line_id: 'line1', stage: 'phoi', seq: 1 },
      { production_order_line_id: 'line1', stage: 'han', seq: 2 },
    ] as never)
    vi.mocked(productsService.syncClusterRoutesFromShaping).mockResolvedValue({
      updated: 1,
      missing: [],
    })
    await expect(
      componentsService.save(thongKe, 'lsx1', [
        { ...cumKhung, final_stage: 'son' },
      ] as never),
    ).resolves.toBeTruthy()
  })
})

describe('componentsService.suggest("bom") — lộ trình KHAI theo cụm (0288, B2)', () => {
  it('cụm nhôm khai phôi → nguội → sơn: chi tiết [phôi], cụm [nguội, sơn] — không cần hàn', async () => {
    vi.mocked(productionRepo.listStages).mockResolvedValue([
      { code: 'phoi', label: 'Phôi', meta: { count_level: 'part' } },
      { code: 'han', label: 'Hàn', meta: { count_level: 'cluster' } },
      { code: 'nguoi', label: 'Nguội', meta: { count_level: 'cluster' } },
      { code: 'son', label: 'Sơn', meta: { count_level: 'cluster' } },
    ] as never)
    vi.mocked(productProfileRepo.clusters).mockResolvedValue([
      {
        id: 'cl1',
        name: 'Cụm khung',
        qty_per_product: 1,
        first_stage: null,
        final_stage: null,
        stages: ['phoi', 'nguoi', 'son'],
        note: null,
      },
    ] as never)
    vi.mocked(productProfileRepo.parts).mockResolvedValue([
      { part_name: 'Chân', cluster_id: 'cl1', group_code: 'FRAME', qty: 4, unit: 'Cái' },
      {
        part_name: 'Pát rời',
        cluster_id: null,
        group_code: 'FRAME',
        qty: 2,
        unit: 'Cái',
        stages: ['phoi', 'son'],
      },
    ] as never)

    const out = await componentsService.suggest(thongKe, 'lsx1', 'bom')
    const chan = out.find((r) => r.name === 'Chân')!
    const cum = out.find((r) => r.kind === 'assembly')!
    const pat = out.find((r) => r.name === 'Pát rời')!
    expect(chan.stages).toEqual(['phoi'])
    expect(chan.final_stage).toBe('phoi')
    expect(cum.stages).toEqual(['nguoi', 'son'])
    expect(cum.first_stage).toBe('nguoi')
    expect(cum.final_stage).toBe('son')
    // Dòng rời khai riêng → chụp nguyên văn, không qua cụm.
    expect(pat.stages).toEqual(['phoi', 'son'])
  })

  it('cụm chưa khai (stages null) → y hệt cách cũ: cụm bắt đầu ở hàn, chi tiết dừng ở phôi', async () => {
    vi.mocked(productionRepo.listStages).mockResolvedValue([] as never)
    vi.mocked(productProfileRepo.clusters).mockResolvedValue([
      {
        id: 'cl1',
        name: 'Cụm khung',
        qty_per_product: 1,
        first_stage: null,
        final_stage: null,
        stages: null,
        note: null,
      },
    ] as never)
    vi.mocked(productProfileRepo.parts).mockResolvedValue([
      { part_name: 'Chân', cluster_id: 'cl1', group_code: 'FRAME', qty: 4, unit: 'Cái' },
    ] as never)
    const out = await componentsService.suggest(thongKe, 'lsx1', 'bom')
    const cum = out.find((r) => r.kind === 'assembly')!
    expect(cum.first_stage).toBe('han')
    expect(cum.stages).toBeNull()
    expect(out.find((r) => r.name === 'Chân')!.stages).toBeNull()
  })
})

describe('componentsService.save — ghi ngược SỐ CỤM / SP lên hồ sơ SP (13/11/2026)', () => {
  const cum = {
    production_order_line_id: 'line1',
    kind: 'assembly' as const,
    cluster: 'Cụm chân',
    name: 'CỤM CHÂN',
    qty_per_unit: 2,
    stages: null,
  }

  beforeEach(() => {
    vi.mocked(entriesRepo.existsForLsx).mockResolvedValue(false)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([])
    vi.mocked(productsService.syncClusterQtyFromShaping).mockReset()
  })

  it('chỉ cụm thống kê KHAI (clusterQty) đi lên hồ sơ, theo SP của dòng lệnh', async () => {
    vi.mocked(productsService.syncClusterQtyFromShaping).mockResolvedValue({
      updated: 1,
      missing: [],
    })
    const r = await componentsService.save(thongKe, 'lsx1', [cum] as never, {
      clusterQty: [{ production_order_line_id: 'line1', cluster: 'Cụm chân', qty: 2 }],
    })
    expect(productsService.syncClusterQtyFromShaping).toHaveBeenCalledWith('p1', [
      { name: 'Cụm chân', qty: 2 },
    ])
    expect(r.qty_synced).toEqual([{ product_code: 'SP1', updated: 1 }])
  })

  it('không khai (ô "chưa có" để trống) → không đụng hồ sơ; số tạm 1 không thành số đã khai', async () => {
    const r = await componentsService.save(thongKe, 'lsx1', [{ ...cum, qty_per_unit: 1 }] as never)
    expect(productsService.syncClusterQtyFromShaping).not.toHaveBeenCalled()
    expect(r.qty_synced).toEqual([])
  })

  it('bỏ tick ghi ngược hồ sơ → không đụng; hồ sơ khoá → routes_skipped', async () => {
    const q = [{ production_order_line_id: 'line1', cluster: 'Cụm chân', qty: 2 }]
    await componentsService.save(thongKe, 'lsx1', [cum] as never, {
      clusterQty: q,
      syncProfileRoutes: false,
    })
    expect(productsService.syncClusterQtyFromShaping).not.toHaveBeenCalled()

    vi.mocked(productsService.syncClusterQtyFromShaping).mockResolvedValueOnce({
      skipped: 'locked',
    })
    const r = await componentsService.save(thongKe, 'lsx1', [cum] as never, { clusterQty: q })
    expect(r.routes_skipped).toContainEqual({ product_code: 'SP1', reason: 'locked' })
  })
})
