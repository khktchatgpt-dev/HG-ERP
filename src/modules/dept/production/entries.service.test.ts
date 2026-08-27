import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./entries.repo', () => ({
  entriesRepo: {
    findById: vi.fn(),
    listByLsx: vi.fn(),
    listByDate: vi.fn(),
    listByDoc: vi.fn(),
    insertMany: vi.fn(),
    delete: vi.fn(),
    deleteByDoc: vi.fn(),
    existsForLsx: vi.fn(),
  },
}))
vi.mock('./components.repo', () => ({
  componentsRepo: { listByLsx: vi.fn(), insertOne: vi.fn(), setFinalStages: vi.fn() },
}))
vi.mock('./production.repo', () => ({
  productionRepo: {
    findById: vi.fn(),
    listStages: vi.fn(),
    listActive: vi.fn(),
    patch: vi.fn(),
  },
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
vi.mock('./transfers.repo', () => ({
  transfersRepo: { listRawByLsx: vi.fn() },
}))
vi.mock('./outsource.repo', () => ({
  outsourceRepo: { listByLsx: vi.fn() },
}))
vi.mock('./entry-docs.repo', () => ({
  entryDocsRepo: {
    nextDocNo: vi.fn(),
    insert: vi.fn(),
    findById: vi.fn(),
    listByDate: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: {
    listLines: vi.fn(),
    listLinesByOrders: vi.fn(),
    listByProductionOrder: vi.fn(),
    patch: vi.fn(),
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
import { entriesService } from './entries.service'
import { entriesRepo } from './entries.repo'
import { transfersRepo } from './transfers.repo'
import { outsourceRepo } from './outsource.repo'
import { entryDocsRepo } from './entry-docs.repo'
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
  customer_id: 'c1',
  order_ids: ['o1'],
  order_codes: ['DH-01'],
  status: 'approved',
  note: null,
}

const COMP = {
  id: 'c1',
  production_order_id: 'lsx1',
  production_order_line_id: 'line1',
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
  production_order_line_id: 'line1',
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
  vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([
    {
      id: 'line1',
      group_id: 'g1',
      qty: 50,
      product_code: 'SP1',
      name_vi: 'Ghế A',
      unit: 'cái',
      specs: {},
    },
  ] as never)
  vi.mocked(lsxLinesRepo.listGroups).mockResolvedValue([
    { id: 'g1', sales_order_id: 'o1', title: 'Đơn DH-01' },
  ] as never)
  vi.mocked(ordersRepo.listByProductionOrder).mockResolvedValue([
    { id: 'o1', code: 'DH-01', status: 'lsx_issued' },
  ] as never)
  vi.mocked(jobsRepo.listByLsx).mockResolvedValue([JOB_HAN] as never)
  vi.mocked(entriesRepo.listByLsx).mockResolvedValue([])
  vi.mocked(transfersRepo.listRawByLsx).mockResolvedValue([])
  vi.mocked(outsourceRepo.listByLsx).mockResolvedValue([])
  vi.mocked(dayLocksRepo.find).mockResolvedValue(null)
  vi.mocked(entryDocsRepo.nextDocNo).mockResolvedValue('PBS-2026-0001')
  vi.mocked(entryDocsRepo.insert).mockResolvedValue({
    id: 'doc1',
    doc_no: 'PBS-2026-0001',
  } as never)
  vi.mocked(entryDocsRepo.listByDate).mockResolvedValue([])
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

  it('dòng CHỈ CÓ PHẾ (qty 0, defect > 0) → vẫn ghi được (0173)', async () => {
    await entriesService.record(
      thongKe,
      'lsx1',
      record({
        entries: [
          { component_id: 'c1', qty: 0, defect_qty: 3, defect_reason: 'móp cạnh' },
        ],
      }),
    )
    expect(entriesRepo.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ qty: 0, defect_qty: 3, defect_reason: 'móp cạnh' }),
    ])
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
    await expect(entriesService.record(thongKe, 'lsx1', record())).rejects.toMatchObject({
      status: 400,
    })
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

  it('WIP liên cấp: hàn cụm vượt số chi tiết con đã xong → warning (0088)', async () => {
    const part = {
      id: 'chan',
      production_order_id: 'lsx1',
      production_order_line_id: 'line1',
      kind: 'part',
      cluster: 'CỤM TỰA',
      name: 'CHÂN',
      qty_per_unit: 2,
      qty_per_assembly: 2,
      first_stage: null,
      final_stage: 'phoi',
      dm_kg: null,
      pcs_per_bar: null,
    }
    const asm = {
      id: 'asm',
      production_order_id: 'lsx1',
      production_order_line_id: 'line1',
      kind: 'assembly',
      cluster: 'CỤM TỰA',
      name: 'CỤM TỰA',
      qty_per_unit: 3, // cần 150 (không vướng cảnh báo vượt tổng)
      qty_per_assembly: null,
      first_stage: 'han',
      final_stage: 'son',
      dm_kg: null,
      pcs_per_bar: null,
    }
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([part, asm] as never)
    // Chi tiết CHÂN mới xong 150 ở phôi; cần 200 cho 100 cụm.
    vi.mocked(entriesRepo.listByLsx).mockResolvedValue([
      { component_id: 'chan', stage: 'phoi', qty: 150, defect_qty: 0 } as never,
    ])
    const { warnings } = await entriesService.record(
      thongKe,
      'lsx1',
      record({ entries: [{ component_id: 'asm', qty: 100, defect_qty: 0 }] }),
    )
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toContain('CHÂN cần 200 nhưng mới xong 150')
    expect(entriesRepo.insertMany).toHaveBeenCalled()
  })

  // ── CỤM MẶC NHIÊN (lib/default-assembly) — bậc 2 thang đơn vị đếm, 27/08 ──
  const FLAT_PARTS = [
    {
      id: 'p1',
      production_order_id: 'lsx1',
      production_order_line_id: 'line1',
      kind: 'part',
      cluster: null,
      name: 'CHÂN',
      group_code: 'FRAME',
      qty_per_unit: 4,
      qty_per_assembly: null,
      first_stage: null,
      final_stage: null,
      dm_kg: null,
      pcs_per_bar: null,
    },
    {
      id: 'p2',
      production_order_id: 'lsx1',
      production_order_line_id: 'line1',
      kind: 'part',
      cluster: null,
      name: 'TỰA',
      group_code: 'FRAME',
      qty_per_unit: 2,
      qty_per_assembly: null,
      first_stage: null,
      final_stage: null,
      dm_kg: null,
      pcs_per_bar: null,
    },
  ]

  it('ghi id ảo default-asm → VẬT CHẤT HOÁ cụm + chốt final_stage chi tiết, sổ ghi vào dòng thật', async () => {
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue(FLAT_PARTS as never)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([]) // chưa lên kế hoạch
    vi.mocked(componentsRepo.insertOne).mockResolvedValue('asm-real')
    await entriesService.record(
      thongKe,
      'lsx1',
      record({
        entries: [{ component_id: 'default-asm:line1', qty: 10, defect_qty: 0 }],
      }),
    )
    expect(componentsRepo.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        production_order_line_id: 'line1',
        kind: 'assembly',
        cluster: null,
        group_code: 'FRAME',
        qty_per_unit: 1,
        first_stage: 'han',
        final_stage: 'son',
      }),
    )
    expect(componentsRepo.setFinalStages).toHaveBeenCalledWith([
      { id: 'p1', final_stage: 'phoi' },
      { id: 'p2', final_stage: 'phoi' },
    ])
    expect(entriesRepo.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ component_id: 'asm-real', stage: 'han', qty: 10 }),
    ])
    expect(jobsRepo.markDoing).toHaveBeenCalledWith('lsx1', 'line1', 'han')
  })

  it('đã có cụm cả dòng (vật chất hoá trước đó) → dùng lại, KHÔNG tạo thêm', async () => {
    const asm = {
      id: 'asm-cu',
      production_order_id: 'lsx1',
      production_order_line_id: 'line1',
      kind: 'assembly',
      cluster: null,
      name: 'Cụm khung (mặc nhiên)',
      group_code: 'FRAME',
      qty_per_unit: 1,
      qty_per_assembly: null,
      first_stage: 'han',
      final_stage: 'son',
      dm_kg: null,
      pcs_per_bar: null,
    }
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([
      { ...FLAT_PARTS[0], final_stage: 'phoi' },
      asm,
    ] as never)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([])
    await entriesService.record(
      thongKe,
      'lsx1',
      record({ entries: [{ component_id: 'default-asm:line1', qty: 5, defect_qty: 0 }] }),
    )
    expect(componentsRepo.insertOne).not.toHaveBeenCalled()
    expect(entriesRepo.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ component_id: 'asm-cu', qty: 5 }),
    ])
  })

  it('BOM phẳng: ghi CHI TIẾT ở hàn bị chặn — từ hàn trở đi đếm theo cụm/bộ', async () => {
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue(FLAT_PARTS as never)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([])
    await expect(
      entriesService.record(
        thongKe,
        'lsx1',
        record({ entries: [{ component_id: 'p1', qty: 10, defect_qty: 0 }] }),
      ),
    ).rejects.toMatchObject({ status: 400 })
    expect(entriesRepo.insertMany).not.toHaveBeenCalled()
    // Ở PHÔI thì chi tiết vẫn ghi bình thường.
    await entriesService.record(
      thongKe,
      'lsx1',
      record({
        stage: 'phoi',
        entries: [{ component_id: 'p1', qty: 10, defect_qty: 0 }],
      }),
    )
    expect(entriesRepo.insertMany).toHaveBeenCalled()
  })

  it('ghi vượt số được BÀN GIAO cho tổ → KHÔNG chặn, trả warning (0090)', async () => {
    // Tổ d-han được giao 60, đã dùng 50 → còn 10; ghi thêm 30 là vượt 20.
    // (Tổng cần 100, sau khi ghi = 80 → không dính cảnh báo vượt tổng cần.)
    vi.mocked(transfersRepo.listRawByLsx).mockResolvedValue([
      {
        component_id: 'c1',
        stage: 'han',
        team_department_id: 'd-han',
        direction: 'issue',
        qty: 60,
      } as never,
    ])
    vi.mocked(entriesRepo.listByLsx).mockResolvedValue([
      {
        component_id: 'c1',
        stage: 'han',
        team_department_id: 'd-han',
        qty: 50,
        defect_qty: 0,
      } as never,
    ])
    const { warnings } = await entriesService.record(thongKe, 'lsx1', record())
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toContain('VƯỢT 20')
    expect(entriesRepo.insertMany).toHaveBeenCalled()
  })

  it('công đoạn SAU vượt số công đoạn TRƯỚC → KHÔNG chặn, trả warning (WIP âm)', async () => {
    // Lộ trình dòng: phôi → hàn. Phôi mới xong 20 mà ghi hàn 30.
    // final_stage do NGƯỜI khai → chi tiết không bị gộp vào cụm mặc nhiên,
    // vẫn được ghi ở hàn (27/08 — lib/default-assembly).
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([
      { ...COMP, final_stage: 'han' },
    ] as never)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      { ...JOB_HAN, id: 'j0', stage: 'phoi', seq: 0 },
      { ...JOB_HAN, seq: 1 },
    ] as never)
    vi.mocked(entriesRepo.listByLsx).mockResolvedValue([
      {
        component_id: 'c1',
        stage: 'phoi',
        team_department_id: 'd-phoi',
        qty: 20,
        defect_qty: 0,
      } as never,
    ])
    const { warnings } = await entriesService.record(thongKe, 'lsx1', record())
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toContain('Hàn sẽ thành 30 mà Phôi mới xong 20')
    expect(entriesRepo.insertMany).toHaveBeenCalled()
  })

  it('công đoạn sau ≤ công đoạn trước → im lặng', async () => {
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([
      { ...COMP, final_stage: 'han' },
    ] as never)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([
      { ...JOB_HAN, id: 'j0', stage: 'phoi', seq: 0 },
      { ...JOB_HAN, seq: 1 },
    ] as never)
    vi.mocked(entriesRepo.listByLsx).mockResolvedValue([
      {
        component_id: 'c1',
        stage: 'phoi',
        team_department_id: 'd-phoi',
        qty: 30,
        defect_qty: 0,
      } as never,
    ])
    const { warnings } = await entriesService.record(thongKe, 'lsx1', record())
    expect(warnings).toEqual([])
  })

  it('kg bỏ trống → backflush ĐM × SL; ghi đè thì giữ nguyên (0090)', async () => {
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([
      { ...COMP, dm_kg: 0.6 },
    ] as never)
    await entriesService.record(thongKe, 'lsx1', record())
    expect(entriesRepo.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ kg: 18 }), // 0.6 × 30
    ])
    await entriesService.record(
      thongKe,
      'lsx1',
      record({ entries: [{ component_id: 'c1', qty: 30, defect_qty: 0, kg: 20 }] }),
    )
    expect(entriesRepo.insertMany).toHaveBeenLastCalledWith([
      expect.objectContaining({ kg: 20 }),
    ])
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
    await expect(entriesService.record(thongKe, 'lsx1', record())).rejects.toMatchObject({
      status: 400,
    })
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

describe('entriesService.board — bảng nhập toàn xưởng theo công đoạn (GĐ2)', () => {
  it('gom LỆNH → SP → chi tiết theo khoảng công đoạn + số đã ghi trong NGÀY', async () => {
    vi.mocked(productionRepo.listActive).mockResolvedValue([
      { ...LSX, customer_name: 'KH TEST', ship_date: null },
    ] as never)
    vi.mocked(entriesRepo.listByLsx).mockResolvedValue([
      {
        component_id: 'c1',
        stage: 'han',
        entry_date: '2026-07-24',
        qty: 5,
        defect_qty: 1,
        kg: null,
      },
      {
        component_id: 'c1',
        stage: 'han',
        entry_date: '2026-07-23',
        qty: 7,
        defect_qty: 0,
        kg: null,
      },
    ] as never)
    const b = await entriesService.board(admin, '2026-07-24')
    expect(b.lsx).toHaveLength(1)
    const p = b.lsx[0].products[0]
    expect(p.product_code).toBe('SP1')
    const c = p.components[0]
    // Lộ trình dòng = jobs ([han]) → chỉ công đoạn đó xuất hiện.
    expect(Object.keys(c.stages)).toEqual(['han'])
    expect(c.stages['han'].done).toBe(12)
    expect(c.total_needed).toBe(100)
    // "Hôm nay" chỉ đếm đúng ngày đang mở.
    expect(c.today['han']).toEqual({ qty: 5, defect: 1 })
  })

  it('SP chưa định hình chi tiết → không chiếm dòng trong bảng nhập', async () => {
    vi.mocked(productionRepo.listActive).mockResolvedValue([
      { ...LSX, customer_name: 'KH TEST', ship_date: null },
    ] as never)
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([] as never)
    const b = await entriesService.board(admin, '2026-07-24')
    expect(b.lsx[0].products).toHaveLength(0)
  })
})

describe('entriesService.record — guard ngày + tổ (25/08)', () => {
  it('ngày TƯƠNG LAI → 400', async () => {
    await expect(
      entriesService.record(thongKe, 'lsx1', record({ entry_date: '2999-01-01' })),
    ).rejects.toMatchObject({ status: 400 })
    expect(entriesRepo.insertMany).not.toHaveBeenCalled()
  })

  it('không tổ (và người ghi không thuộc phòng nào) → 400', async () => {
    await expect(
      entriesService.record(admin, 'lsx1', record({ team_department_id: null })),
    ).rejects.toMatchObject({ status: 400 })
    expect(entriesRepo.insertMany).not.toHaveBeenCalled()
  })

  it('không truyền tổ nhưng người ghi CÓ phòng → rơi về phòng của họ (như cũ)', async () => {
    await entriesService.record(thongKe, 'lsx1', record({ team_department_id: null }))
    expect(entriesRepo.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ team_department_id: 'd-tk' }),
    ])
  })
})

describe('entriesService — PHIẾU BÁO SẢN LƯỢNG (0172)', () => {
  it('record: lập phiếu trước, dòng gắn doc_id, trả số phiếu', async () => {
    const res = await entriesService.record(thongKe, 'lsx1', record())
    expect(res.doc_no).toBe('PBS-2026-0001')
    expect(entryDocsRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        doc_no: 'PBS-2026-0001',
        production_order_id: 'lsx1',
        stage: 'han',
        team_department_id: 'd-han',
        entry_date: '2026-07-24',
      }),
    )
    expect(entriesRepo.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ doc_id: 'doc1' }),
    ])
  })

  it('deleteDoc: người lập xoá được — xoá DÒNG trước rồi HEADER', async () => {
    vi.mocked(entryDocsRepo.findById).mockResolvedValue({
      id: 'doc1',
      doc_no: 'PBS-2026-0001',
      production_order_id: 'lsx1',
      team_department_id: 'd-han',
      entry_date: '2026-07-24',
      created_by: 'u-tk',
    } as never)
    await entriesService.deleteDoc(thongKe, 'doc1')
    expect(entriesRepo.deleteByDoc).toHaveBeenCalledWith('doc1')
    expect(entryDocsRepo.delete).toHaveBeenCalledWith('doc1')
  })

  it('deleteDoc: không phải người lập / QL → 403', async () => {
    vi.mocked(entryDocsRepo.findById).mockResolvedValue({
      id: 'doc1',
      team_department_id: null,
      created_by: 'ai-do-khac',
    } as never)
    await expect(entriesService.deleteDoc(thongKe, 'doc1')).rejects.toMatchObject({
      status: 403,
    })
    expect(entryDocsRepo.delete).not.toHaveBeenCalled()
  })

  it('deleteDoc: tổ đã chốt ngày của phiếu → 400', async () => {
    vi.mocked(entryDocsRepo.findById).mockResolvedValue({
      id: 'doc1',
      team_department_id: 'd-han',
      entry_date: '2026-07-24',
      created_by: 'u-tk',
    } as never)
    vi.mocked(dayLocksRepo.find).mockResolvedValue({ id: 'lock1' } as never)
    await expect(entriesService.deleteDoc(thongKe, 'doc1')).rejects.toMatchObject({
      status: 400,
    })
    expect(entriesRepo.deleteByDoc).not.toHaveBeenCalled()
  })
})

describe('entriesService.summary — cụm mặc nhiên (27/08, lib/default-assembly)', () => {
  const flat = (id: string, name: string, qtyPerUnit: number) => ({
    id,
    production_order_id: 'lsx1',
    production_order_line_id: 'line1',
    kind: 'part',
    cluster: null,
    name,
    group_code: 'FRAME',
    qty_per_unit: qtyPerUnit,
    qty_per_assembly: null,
    first_stage: null,
    final_stage: null,
    dm_kg: null,
    pcs_per_bar: null,
  })

  it('BOM phẳng: chi tiết dừng ở phôi, dòng cụm ảo đếm theo BỘ từ hàn trở đi', async () => {
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([
      flat('p1', 'CHÂN', 4),
      flat('p2', 'TỰA', 2),
    ] as never)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([]) // chưa lên kế hoạch
    const en = (comp: string, stage: string, qty: number, defect = 0) => ({
      component_id: comp,
      stage,
      entry_date: '2026-07-24',
      qty,
      defect_qty: defect,
      kg: null,
    })
    // Sổ cũ ghi theo CHI TIẾT ở hàn (dữ liệu chuyển tiếp) — cụm ảo phải suy
    // được từ số đó: min(floor(40×50/200)=10, floor(30×50/100)=15) = 10 bộ.
    vi.mocked(entriesRepo.listByLsx).mockResolvedValue([
      en('p1', 'phoi', 200),
      en('p1', 'han', 40),
      en('p2', 'han', 30, 2),
    ] as never)

    const s = await entriesService.summary(admin, 'lsx1')
    const p1 = s.components.find((c) => c.id === 'p1')!
    expect(p1.allowed_stages).toEqual(['phoi'])
    expect(p1.summary.stages.map((x) => x.stage)).toEqual(['phoi'])

    const asm = s.components.find((c) => c.id === 'default-asm:line1')!
    expect(asm.is_virtual).toBe(true)
    expect(asm.kind).toBe('assembly')
    expect(asm.total_needed).toBe(50)
    expect(asm.allowed_stages).toEqual(['han', 'nguoi', 'mai', 'son'])
    const han = asm.summary.stages.find((x) => x.stage === 'han')!
    expect(han.done).toBe(10)
    expect(han.defect).toBe(2)

    // Đồng bộ SP: cụm chưa qua SƠN → 0 bộ; phôi xong không được đếm là xong SP.
    expect(s.synced_by_line[0].synced_sets).toBe(0)
  })

  it('lệnh có cụm THẬT → không sinh cụm ảo, mọi thứ theo 0088', async () => {
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([
      { ...flat('p1', 'CHÂN', 4), final_stage: 'phoi' },
      {
        ...flat('asm1', 'CỤM KHUNG', 1),
        kind: 'assembly',
        first_stage: 'han',
        final_stage: 'son',
      },
    ] as never)
    vi.mocked(jobsRepo.listByLsx).mockResolvedValue([])
    const s = await entriesService.summary(admin, 'lsx1')
    expect(s.components.some((c) => c.is_virtual)).toBe(false)
    const asm = s.components.find((c) => c.id === 'asm1')!
    // Cụm thật kế thừa nhóm FRAME → lộ trình suy được, cắt từ hàn.
    expect(asm.summary.stages.map((x) => x.stage)).toEqual(['han', 'nguoi', 'mai', 'son'])
  })
})
