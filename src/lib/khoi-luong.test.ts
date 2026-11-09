import { describe, expect, it } from 'vitest'
import {
  byUnitText,
  khoiLuongOf,
  principalUnit,
  teamText,
  type KlLineIn,
} from './khoi-luong'
import type { TallyComponent } from './line-stage-tally'

/**
 * Khối lượng theo công đoạn (bước 2, 09/11/2026) — cộng dọc dòng SP theo bậc
 * đếm, không cộng ngang; tổ & hạn gộp từ jobs; chi tiết chưa gán cụm (Q5).
 */

const CAT = [
  { code: 'phoi', label: 'Phôi' },
  { code: 'han', label: 'Hàn' },
  { code: 'nguoi', label: 'Nguội' },
  { code: 'mai', label: 'Mài' },
  { code: 'son', label: 'Sơn' },
  { code: 'may', label: 'May' },
  { code: 'lap_rap', label: 'Lắp ráp' },
  { code: 'bao_bi', label: 'Bao bì' },
  { code: 'dong_goi', label: 'Đóng gói' },
  { code: 'hoan_thien', label: 'Hoàn thiện' },
]

const part = (
  line: string,
  lineQty: number,
  over: Partial<TallyComponent> & { id: string; name: string },
): TallyComponent => ({
  production_order_line_id: line,
  kind: 'part',
  group_code: 'FRAME',
  first_stage: null,
  final_stage: null,
  qty_per_unit: 1,
  dm_kg: null,
  pcs_per_bar: null,
  line_qty: lineQty,
  ...over,
})

const line = (
  id: string,
  code: string,
  qty: number,
  comps: TallyComponent[],
): KlLineIn => ({
  id,
  product_id: `p-${id}`,
  product_code: code,
  product_name: code,
  qty,
  unit: 'cái',
  comps,
})

describe('khoiLuongOf — BOM phẳng hai dòng SP (như 13/26-27 - MX)', () => {
  const lines = [
    line('L1', 'CH0119', 300, [
      part('L1', 300, { id: 'a', name: 'Chân', qty_per_unit: 30 }),
      part('L1', 300, { id: 'g', name: 'Ván', group_code: 'WOOD', qty_per_unit: 3 }),
    ]),
    line('L2', 'CH0292', 250, [
      part('L2', 250, { id: 'b', name: 'Chân', qty_per_unit: 17 }),
    ]),
  ]

  it('cộng DỌC theo bậc đếm: phôi chi tiết, hàn cái, sơn hai đơn vị không cộng', () => {
    const k = khoiLuongOf(lines, new Map(), CAT, new Map(), [])
    const by = Object.fromEntries(k.stages.map((s) => [s.code, s]))
    expect(by.phoi.by_unit).toEqual([
      { level: 'part', unit: 'chi tiết', needed: 13250, done: 0 },
    ])
    expect(by.han.by_unit).toEqual([
      { level: 'cluster', unit: 'cái', needed: 550, done: 0 },
    ])
    expect(by.son.by_unit).toEqual([
      { level: 'cluster', unit: 'cái', needed: 550, done: 0 },
      { level: 'part', unit: 'chi tiết', needed: 900, done: 0 },
    ])
    expect(byUnitText(by.son.by_unit)).toBe('550 cái · 900 chi tiết')
    expect(principalUnit(by.son.by_unit)?.unit).toBe('cái')
    expect(by.hoan_thien.by_unit[0]).toMatchObject({ level: 'unit', needed: 550 })
  })

  it('chỉ công đoạn lệnh đi qua, theo thứ tự danh mục; còn lại kể ở not_traversed', () => {
    const k = khoiLuongOf(lines, new Map(), CAT, new Map(), [])
    expect(k.stages.map((s) => `${s.index}.${s.code}`)).toEqual([
      '1.phoi',
      '2.han',
      '3.nguoi',
      '5.son',
      '7.lap_rap',
      '8.bao_bi',
      '9.dong_goi',
      '10.hoan_thien',
    ])
    expect(k.not_traversed).toEqual(['Mài', 'May'])
    expect(k.unassigned).toEqual({ parts: 0, qty: 0 })
    expect(k.lines[0].cells.son.map((u) => u.needed)).toEqual([300, 900])
  })

  it('tổ & hạn gộp từ jobs: chưa giao · tổ chưa hạn · 2 tổ có khung · thiếu tổ', () => {
    const jobs = [
      {
        production_order_line_id: 'L1',
        stage: 'phoi',
        team_name: 'Tổ Phôi',
        planned_start: '2026-11-12',
        planned_end: '2026-11-20',
      },
      {
        production_order_line_id: 'L2',
        stage: 'phoi',
        team_name: 'Tổ Phôi 2',
        planned_start: '2026-11-14',
        planned_end: '2026-11-25',
      },
      {
        production_order_line_id: 'L1',
        stage: 'han',
        team_name: 'Tổ Hàn',
        planned_start: null,
        planned_end: null,
      },
      {
        production_order_line_id: 'L1',
        stage: 'nguoi',
        team_name: null,
        planned_start: null,
        planned_end: null,
      },
    ]
    const k = khoiLuongOf(lines, new Map(), CAT, new Map(), jobs)
    const by = Object.fromEntries(k.stages.map((s) => [s.code, s]))
    expect(teamText(by.phoi)).toEqual({ text: '2 tổ · 12/11→25/11', tone: null })
    expect(teamText(by.han)).toEqual({ text: 'Tổ Hàn · chưa hạn', tone: 'warn' })
    expect(teamText(by.nguoi)).toEqual({ text: 'chưa có tổ cho nguội', tone: 'warn' })
    expect(teamText(by.son)).toEqual({ text: 'chưa giao tổ & hạn', tone: 'warn' })
  })

  it('dòng SP chưa có bảng chi tiết → không góp số, đếm vào unshaped', () => {
    const k = khoiLuongOf(
      [...lines, line('L3', 'TB0001', 100, [])],
      new Map(),
      CAT,
      new Map(),
      [],
    )
    expect(k.unshaped).toBe(1)
    expect(k.stages.find((s) => s.code === 'han')?.needed).toBe(550)
    expect(k.lines[2]).toMatchObject({ has_components: false, cells: {} })
  })
})

describe('khoiLuongOf — cụm thật (JAWOLL) với chi tiết chưa gán cụm (Q5)', () => {
  const comps: TallyComponent[] = [
    part('L1', 557, {
      id: 'tay',
      name: 'Tay vịn',
      qty_per_unit: 2,
      final_stage: 'phoi',
      cluster: 'Cụm khung',
    }),
    part('L1', 557, {
      id: 'asm',
      name: 'Cụm khung',
      kind: 'assembly',
      first_stage: 'han',
      qty_per_unit: 1,
    }),
    // Hai chi tiết khung KHÔNG thuộc cụm nào, lộ trình FRAME qua hàn.
    part('L1', 557, { id: 'giang', name: 'Thanh giằng', qty_per_unit: 3 }),
    part('L1', 557, { id: 'pat', name: 'Pát', qty_per_unit: 2 }),
    // Ván gỗ chỉ qua sơn — không phải "chưa gán cụm".
    part('L1', 557, { id: 'van', name: 'Ván', group_code: 'WOOD', qty_per_unit: 1 }),
  ]
  const lines = [line('L1', 'BN0228', 557, comps)]

  it('hàn = cụm + chi tiết chưa gán (bày riêng, không gộp); sơn thêm tấm gỗ là hợp lệ', () => {
    const k = khoiLuongOf(lines, new Map(), CAT, new Map(), [])
    const by = Object.fromEntries(k.stages.map((s) => [s.code, s]))
    expect(by.han.by_unit).toEqual([
      { level: 'cluster', unit: 'cụm', needed: 557, done: 0 },
      { level: 'part', unit: 'chi tiết', needed: 2785, done: 0 },
    ])
    expect(by.han.unassigned_qty).toBe(2785)
    expect(by.nguoi.unassigned_qty).toBe(2785)
    // Sơn: 2.785 chưa gán + 557 ván; chỉ 2.785 là "chưa gán cụm".
    expect(by.son.unassigned_qty).toBe(2785)
    expect(by.son.by_unit.find((u) => u.level === 'part')?.needed).toBe(3342)
    expect(by.phoi.unassigned_qty).toBe(0)
    expect(k.unassigned).toEqual({ parts: 2, qty: 2785 })
  })
})
