import { describe, it, expect } from 'vitest'
import { buildSoTongLsx, type SoTongLsxInput } from './so-tong.service'
import type { ComponentOutputView } from './entries.service'

/** Dữ liệu thu nhỏ theo đúng khuôn lệnh 01/26-27 - YOTRIO: 2 SP, 2 công đoạn. */

const view = (over: Partial<ComponentOutputView>): ComponentOutputView => ({
  id: 'c1',
  order_line_id: 'l1',
  kind: 'part',
  cluster: null,
  name: 'Chân trước',
  unit: null,
  total_needed: 800,
  dm_kg: 0.2,
  material_type: 'Nhôm định hình',
  material_code: null,
  material_name: null,
  allowed_stages: null,
  summary: {
    stages: [
      { stage: 'phoi', done: 500, defect: 5, missing: 300, pct: 0.625 },
      { stage: 'han', done: 200, defect: 0, missing: 600, pct: 0.25, gc: 120 },
    ],
    done_final: 200,
    pct_total: 0.25,
    status: 'in_progress',
  },
  ...over,
})

const INPUT: SoTongLsxInput = {
  lsx: {
    id: 'x1',
    code: '01/26-27 - YOTRIO',
    customer_name: 'YOTRIO',
    order_ids: ['o1', 'o2'],
    order_codes: ['DH-001', 'DH-002'],
    ship_date: '2026-09-20',
  },
  components: [
    view({}),
    view({
      id: 'c2',
      order_line_id: 'l2',
      name: 'Khung ghế',
      material_type: 'Sắt hộp',
      total_needed: 400,
      summary: {
        stages: [{ stage: 'phoi', done: 0, defect: 0, missing: 400, pct: 0 }],
        done_final: 0,
        pct_total: 0,
        status: 'not_started',
      },
    }),
  ],
  synced_by_line: [
    {
      order_line_id: 'l1',
      order_id: 'o1',
      product_code: 'CH0221HG-AL',
      product_name: 'Ghế nhôm',
      qty: 400,
      synced_sets: 100,
    },
    {
      order_line_id: 'l2',
      order_id: 'o2',
      product_code: 'TB0101HG-IR',
      product_name: 'Bàn sắt',
      qty: 200,
      synced_sets: 0,
    },
  ],
  entries: [
    // Tháng 7: 300 phôi; tháng 8: 200 phôi (2 phế ghi tháng 8) + 80 hàn nội bộ.
    {
      component_id: 'c1',
      stage: 'phoi',
      entry_date: '2026-07-30',
      qty: 300,
      kg: 60,
      defect_qty: 3,
    },
    {
      component_id: 'c1',
      stage: 'phoi',
      entry_date: '2026-08-02',
      qty: 200,
      kg: 40,
      defect_qty: 2,
    },
    {
      component_id: 'c1',
      stage: 'han',
      entry_date: '2026-08-05',
      qty: 80,
      kg: null,
      defect_qty: 0,
    },
  ],
  outsource: [
    // Nhận về 120 hàn từ NCC (tháng 8) — phải vào ô hàn với cờ gc.
    {
      component_id: 'c1',
      stage: 'han',
      direction: 'receive',
      entry_date: '2026-08-06',
      qty: 120,
      kg: 24,
      defect_qty: 0,
    },
    // Giao đi + bản ghi cũ không stage: KHÔNG được cộng vào ô nào.
    {
      component_id: 'c1',
      stage: 'han',
      direction: 'send',
      entry_date: '2026-08-01',
      qty: 150,
      kg: null,
      defect_qty: 0,
    },
    {
      component_id: 'c1',
      stage: null,
      direction: 'receive',
      entry_date: '2026-08-07',
      qty: 999,
      kg: null,
      defect_qty: 0,
    },
  ],
  jobs: [
    {
      production_order_line_id: 'l1',
      stage: 'han',
      planned_start: '2026-08-01',
      planned_end: '2026-08-15',
    },
  ],
}

describe('buildSoTongLsx', () => {
  const out = buildSoTongLsx(INPUT)

  it('chia PHẦN theo vật liệu, sắt đứng trước nhôm như sổ', () => {
    expect(out.sections.map((s) => s.section)).toEqual(['sat', 'nhom'])
    expect(out.sections[1].products[0].product_code).toBe('CH0221HG-AL')
  })

  it('gắn mã đơn cho từng SP qua order_id', () => {
    const ghe = out.sections[1].products[0]
    expect(ghe.order_code).toBe('DH-001')
  })

  it('ô công đoạn mang lát cắt tháng + phần gia công', () => {
    const ghe = out.sections[1].products[0]
    const han = ghe.components[0].cells['han']
    expect(han.done).toBe(200)
    expect(han.gc).toBe(120)
    expect(han.months['2026-08']).toEqual({ done: 200, defect: 0, gc: 120 })
    expect(han.planned_end).toBe('2026-08-15')
    const phoi = ghe.components[0].cells['phoi']
    expect(phoi.months['2026-07']).toEqual({ done: 300, defect: 3, gc: 0 })
    expect(phoi.months['2026-08']).toEqual({ done: 200, defect: 2, gc: 0 })
  })

  it('bản ghi gia công không stage / chiều giao KHÔNG vào ô', () => {
    const ghe = out.sections[1].products[0]
    const cells = ghe.components[0].cells
    const allDone = Object.values(cells).reduce((s, c) => s + c.done, 0)
    expect(allDone).toBe(700) // 500 phôi + 200 hàn — không có 999/150
  })

  it('kg cộng cả nhận gia công, tách tháng', () => {
    const comp = out.sections[1].products[0].components[0]
    expect(comp.kg_total).toBe(124) // 60 + 40 + 24
    expect(comp.kg_months['2026-08']).toBe(64)
  })

  it('TỔNG chỉ trong lệnh: cần + per công đoạn + tháng', () => {
    expect(out.totals.needed).toBe(1200)
    expect(out.totals.stages['phoi'].done).toBe(500)
    expect(out.totals.stages['han'].months['2026-08'].gc).toBe(120)
    expect(out.used_stages.sort()).toEqual(['han', 'phoi'])
  })
})
