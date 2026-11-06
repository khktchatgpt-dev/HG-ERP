import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./transfer-docs.repo', () => ({
  transferDocsRepo: {
    listByLsxBulk: vi.fn(),
    nextDocNo: vi.fn(),
    insert: vi.fn(),
    insertLines: vi.fn(),
    findById: vi.fn(),
    listLines: vi.fn(),
    patch: vi.fn(),
    setReceived: vi.fn(),
  },
}))
vi.mock('./transfers.repo', () => ({
  transfersRepo: { listRawByLsx: vi.fn(), listRawByLsxBulk: vi.fn() },
}))
vi.mock('./components.repo', () => ({
  componentsRepo: {
    listByLsx: vi.fn(),
    listByLsxBulk: vi.fn(),
    insertOne: vi.fn(),
    setFinalStages: vi.fn(),
  },
}))
vi.mock('./production.repo', () => ({
  productionRepo: { findById: vi.fn(), listActive: vi.fn(), listStages: vi.fn() },
}))
vi.mock('./entries.repo', () => ({
  entriesRepo: { listByLsxWithStatusBulk: vi.fn() },
}))
vi.mock('./jobs.repo', () => ({ jobsRepo: { listByLsx: vi.fn() } }))
vi.mock('./lsx-lines.repo', () => ({
  lsxLinesRepo: { listLines: vi.fn(), listLinesBulk: vi.fn() },
}))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { list: vi.fn() },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ assertAction: vi.fn() }))

import { transferDocsService } from './transfer-docs.service'
import { transferDocsRepo } from './transfer-docs.repo'
import { transfersRepo } from './transfers.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { entriesRepo } from './entries.repo'
import { jobsRepo } from './jobs.repo'
import { lsxLinesRepo } from './lsx-lines.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { DEFAULT_ASSEMBLY_NAME, defaultAssemblyId } from '@/lib/default-assembly'
import type { User } from '@/modules/core/users/users.repo'

const tk = { id: 'u-tk', role: 'employee', department_id: 'd-han' } as unknown as User

const U = {
  lsx: '11111111-1111-4111-8111-111111111111',
  line: '22222222-2222-4222-8222-222222222222',
  p1: '33333333-3333-4333-8333-333333333333',
  p2: '44444444-4444-4444-8444-444444444444',
  dHan: '55555555-5555-4555-8555-555555555555',
  dNguoi: '66666666-6666-4666-8666-666666666666',
}
const VIRTUAL = defaultAssemblyId(U.line)

const LSX = { id: U.lsx, code: 'LSX-01', status: 'approved' }
const LINE = { id: U.line, product_code: 'GH-01', qty: 10, unit: 'bộ' }
// BOM PHẲNG nhóm khung: p1 cần 4/SP, p2 cần 2/SP; không kế hoạch → lộ trình
// FRAME = phôi → hàn → nguội → sơn; cụm mặc nhiên phủ hàn → sơn.
const part = (id: string, name: string, qty_per_unit: number) => ({
  id,
  production_order_id: U.lsx,
  production_order_line_id: U.line,
  kind: 'part' as const,
  cluster: null,
  name,
  group_code: 'FRAME',
  unit: 'cái',
  qty_per_unit,
  dm_kg: null,
  pcs_per_bar: null,
  first_stage: null,
  final_stage: null,
  stages: null,
})
const official = (component_id: string, stage: string, qty: number) => ({
  component_id,
  stage,
  qty,
  doc_status: 'da_xac_nhan',
})

const createInput = (lines: { component_id: string; qty: number }[]) => ({
  production_order_id: U.lsx,
  from_stage: 'han',
  from_team_id: U.dHan,
  to_stage: 'nguoi',
  to_team_id: U.dNguoi,
  entry_date: '2026-11-06',
  note: null,
  lines,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(productionRepo.listStages).mockResolvedValue([
    { code: 'phoi', label: 'Phôi' },
    { code: 'han', label: 'Hàn' },
    { code: 'nguoi', label: 'Nguội' },
    { code: 'son', label: 'Sơn' },
  ] as never)
  vi.mocked(componentsRepo.listByLsx).mockResolvedValue([
    part(U.p1, 'Chân', 4),
    part(U.p2, 'Mê', 2),
  ] as never)
  vi.mocked(lsxLinesRepo.listLines).mockResolvedValue([LINE] as never)
  vi.mocked(jobsRepo.listByLsx).mockResolvedValue([])
  // Tổ Hàn đã ghi: 40 chân (= 10 bộ), 10 mê (= 5 bộ) → cụm suy 5 bộ.
  vi.mocked(entriesRepo.listByLsxWithStatusBulk).mockResolvedValue([
    official(U.p1, 'phoi', 40),
    official(U.p2, 'phoi', 20),
    official(U.p1, 'han', 40),
    official(U.p2, 'han', 10),
  ] as never)
  vi.mocked(transferDocsRepo.listByLsxBulk).mockResolvedValue([])
  vi.mocked(transfersRepo.listRawByLsx).mockResolvedValue([])
  vi.mocked(departmentsRepo.list).mockResolvedValue([
    { id: U.dHan, name: 'Tổ Hàn', workspace_id: 'production' },
    { id: U.dNguoi, name: 'Tổ Nguội', workspace_id: 'production' },
  ] as never)
  vi.mocked(transferDocsRepo.nextDocNo).mockResolvedValue('PGT-0001')
  vi.mocked(transferDocsRepo.insert).mockResolvedValue({
    id: 'doc1',
    doc_no: 'PGT-0001',
  } as never)
  vi.mocked(componentsRepo.insertOne).mockResolvedValue('asm-new')
})

describe('transferDocsService.source — cụm mặc nhiên giao được trước lượt ghi đầu (06/11/2026)', () => {
  it('tại hàn: bày cụm mặc nhiên với xong SUY từ sổ chi tiết (min chi tiết chậm nhất)', async () => {
    const rows = await transferDocsService.source(tk, U.lsx, 'han')
    expect(rows).toEqual([
      expect.objectContaining({
        component_id: VIRTUAL,
        name: DEFAULT_ASSEMBLY_NAME,
        kind: 'assembly',
        unit: 'bộ',
        product_code: 'GH-01',
        done: 5,
        shipped: 0,
        on_hand: 5,
        next_stage: 'nguoi',
        virtual: true,
      }),
    ])
  })

  it('tại phôi: chi tiết bị gộp có "đến" = hàn (lộ trình riêng bị cắt không có nghĩa là hết)', async () => {
    const rows = await transferDocsService.source(tk, U.lsx, 'phoi')
    expect(rows.map((r) => [r.component_id, r.done, r.next_stage])).toEqual([
      [U.p1, 40, 'han'],
      [U.p2, 20, 'han'],
    ])
  })
})

describe('transferDocsService.create — vật chất hoá cụm mặc nhiên lúc lập phiếu', () => {
  it('giao cụm ảo: sinh dòng thật, phiếu trỏ id thật, cảnh báo vượt tồn tính trên số SUY', async () => {
    const r = await transferDocsService.create(
      tk,
      createInput([{ component_id: VIRTUAL, qty: 6 }]),
    )
    expect(r.doc_no).toBe('PGT-0001')
    expect(r.warnings).toEqual([
      `${DEFAULT_ASSEMBLY_NAME}: giao 6 nhưng tồn tại Hàn chỉ 5 (xong 5 − đã giao 0)`,
    ])
    expect(componentsRepo.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        production_order_line_id: U.line,
        kind: 'assembly',
        first_stage: 'han',
        final_stage: 'son',
      }),
    )
    expect(componentsRepo.setFinalStages).toHaveBeenCalledWith([
      { id: U.p1, final_stage: 'phoi' },
      { id: U.p2, final_stage: 'phoi' },
    ])
    expect(transferDocsRepo.insertLines).toHaveBeenCalledWith([
      expect.objectContaining({
        component_id: 'asm-new',
        stage: 'nguoi',
        team_department_id: U.dNguoi,
        direction: 'issue',
        qty: 6,
        doc_id: 'doc1',
      }),
    ])
  })

  it('dòng thật không qua công đoạn giao → 400 nói tên dòng; id lạ → 400', async () => {
    await expect(
      transferDocsService.create(tk, createInput([{ component_id: U.p1, qty: 1 }])),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('"Chân"') })
    await expect(
      transferDocsService.create(
        tk,
        createInput([{ component_id: '77777777-7777-4777-8777-777777777777', qty: 1 }]),
      ),
    ).rejects.toMatchObject({ status: 400 })
    expect(transferDocsRepo.insert).not.toHaveBeenCalled()
  })
})
