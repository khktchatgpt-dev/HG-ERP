import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./components.repo', () => ({
  componentsRepo: { insertOne: vi.fn(), setFinalStages: vi.fn() },
}))

import { componentsRepo, type ComponentRow } from './components.repo'
import {
  materializeDefaultAssembly,
  findDefaultAssembly,
} from './default-assembly.materialize'
import { DEFAULT_COUNTING } from '@/lib/stage-config'
import { DEFAULT_ASSEMBLY_NAME } from '@/lib/default-assembly'

const part = (id: string, over: Partial<ComponentRow> = {}): ComponentRow =>
  ({
    id,
    production_order_id: 'lsx1',
    production_order_line_id: 'line1',
    kind: 'part',
    cluster: null,
    name: id,
    group_code: 'FRAME',
    material_id: null,
    material_type: null,
    spec_thickness_mm: null,
    spec_width_mm: null,
    spec_length_mm: null,
    wall_thickness_mm: null,
    unit: 'cái',
    qty_per_unit: 2,
    dm_kg: null,
    pcs_per_bar: null,
    qty_per_assembly: null,
    first_stage: null,
    final_stage: null,
    stages: null,
    sort_order: 0,
    note: null,
    material_code: null,
    material_name: null,
    material_unit: null,
    ...over,
  }) as ComponentRow

const LINE = { id: 'line1', qty: 10, unit: 'bộ' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(componentsRepo.insertOne).mockResolvedValue('asm-new')
  vi.mocked(componentsRepo.setFinalStages).mockResolvedValue()
})

describe('materializeDefaultAssembly — một hàm cho Ghi sản lượng và Phiếu giao tổ', () => {
  it('BOM phẳng: sinh dòng cụm (hàn→sơn), chốt chi tiết dừng ở phôi, sửa tại chỗ', async () => {
    const comps = [part('p1'), part('p2')]
    const r = await materializeDefaultAssembly({
      lsxId: 'lsx1',
      line: LINE,
      lineComps: comps,
      plannedRoute: null,
      counting: DEFAULT_COUNTING,
    })
    expect(r.created).toBe(true)
    expect(r.real).toMatchObject({
      id: 'asm-new',
      kind: 'assembly',
      cluster: null,
      name: DEFAULT_ASSEMBLY_NAME,
      group_code: 'FRAME',
      unit: 'bộ',
      qty_per_unit: 1,
      first_stage: 'han',
      final_stage: 'son',
    })
    expect(componentsRepo.setFinalStages).toHaveBeenCalledWith([
      { id: 'p1', final_stage: 'phoi' },
      { id: 'p2', final_stage: 'phoi' },
    ])
    // Ngữ cảnh người gọi đang cầm đi tiếp đúng — không phải đọc lại DB.
    expect(comps.map((c) => c.final_stage)).toEqual(['phoi', 'phoi'])
    // Dòng mới KHÔNG tự chen vào mảng — người gọi quyết định thêm vào đâu.
    expect(comps).toHaveLength(2)
  })

  it('đã vật chất hoá (lượt trước) → dùng lại, không insert; bỏ qua dòng thành phẩm', async () => {
    const finish = part('tp', {
      kind: 'assembly',
      first_stage: 'lap_rap',
      final_stage: 'hoan_thien',
    })
    const asm = part('asm-old', {
      kind: 'assembly',
      first_stage: 'han',
      final_stage: 'son',
    })
    const comps = [part('p1', { final_stage: 'phoi' }), finish, asm]
    expect(findDefaultAssembly(comps, DEFAULT_COUNTING)?.id).toBe('asm-old')
    const r = await materializeDefaultAssembly({
      lsxId: 'lsx1',
      line: LINE,
      lineComps: comps,
      plannedRoute: null,
      counting: DEFAULT_COUNTING,
    })
    expect(r).toEqual({ real: asm, created: false })
    expect(componentsRepo.insertOne).not.toHaveBeenCalled()
  })

  it('dòng không có cụm mặc nhiên (lộ trình không qua hàn) → 400, không ghi gì', async () => {
    const comps = [part('w1', { group_code: 'WOOD' })]
    await expect(
      materializeDefaultAssembly({
        lsxId: 'lsx1',
        line: LINE,
        lineComps: comps,
        plannedRoute: null,
        counting: DEFAULT_COUNTING,
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(componentsRepo.insertOne).not.toHaveBeenCalled()
  })
})
