import { describe, expect, it } from 'vitest'
import { normalizeRow, orderQty, requiredQty, statusFromLabel } from './lsx-plan.calc'
import type { PlanRowInput } from './lsx-plan.schema'

const row = (over: Partial<PlanRowInput>): PlanRowInput => ({
  material_name: 'Vít 4x15, 7 màu',
  ...over,
})

describe('requiredQty — SL đặt hàng = đm/sp × SL sản phẩm', () => {
  it('nhân đúng theo dòng thật của BKVT LSX 04', () => {
    // "Nút nhựa vuông 76 · đm/sp 4 · SL 50 → 200"
    expect(requiredQty({ qty_per_product: 4, product_qty: 50 })).toBe(200)
    // "Vít 4x15, 7 màu · đm/sp 24 · SL 50 → 1200"
    expect(requiredQty({ qty_per_product: 24, product_qty: 50 })).toBe(1200)
  })

  it('người dùng gõ tay SL đặt thì giữ nguyên, không tính lại', () => {
    expect(requiredQty({ qty_per_product: 4, product_qty: 50, qty_required: 180 })).toBe(
      180,
    )
  })

  it('thiếu một vế thì trả null chứ không đoán bằng 0', () => {
    expect(requiredQty({ qty_per_product: 4, product_qty: null })).toBeNull()
    expect(requiredQty({ qty_per_product: null, product_qty: 50 })).toBeNull()
  })
})

describe('orderQty — SL cần đặt sau hao và trừ tồn', () => {
  it('hao 3% khớp con số phòng Cung ứng đang dùng', () => {
    expect(orderQty({ qty_required: 200, waste_pct: 3 })).toBe(206)
    expect(orderQty({ qty_required: 400, waste_pct: 3 })).toBe(412)
    expect(orderQty({ qty_required: 1200, waste_pct: 3 })).toBe(1236)
  })

  it('làm tròn LÊN — 205,4 con vít thì phải mua 206, không phải 205', () => {
    expect(orderQty({ qty_required: 199, waste_pct: 3 })).toBe(205) // 204,97 → 205
    expect(orderQty({ qty_required: 101, waste_pct: 3 })).toBe(105) // 104,03 → 105
  })

  it('trừ tồn khi có khai, không âm', () => {
    expect(orderQty({ qty_required: 200, waste_pct: 3, qty_on_hand: 50 })).toBe(156)
    expect(orderQty({ qty_required: 200, waste_pct: 3, qty_on_hand: 500 })).toBe(0)
  })

  it('bỏ trống cột tồn = CHƯA TRA tồn, không phải tồn 0 — vẫn đặt đủ', () => {
    expect(orderQty({ qty_required: 200, waste_pct: 3, qty_on_hand: null })).toBe(206)
  })

  it('không khai hao thì đặt đúng số cần', () => {
    expect(orderQty({ qty_required: 700 })).toBe(700)
  })
})

describe('normalizeRow', () => {
  it('điền nốt hai cột dẫn xuất từ đm/sp và SL', () => {
    const r = normalizeRow(row({ qty_per_product: 4, product_qty: 50, waste_pct: 3 }))
    expect(r.qty_required).toBe(200)
    expect(r.qty_to_order).toBe(206)
  })

  it('số người dùng gõ tay thắng số tự tính', () => {
    const r = normalizeRow(
      row({ qty_per_product: 4, product_qty: 50, waste_pct: 3, qty_to_order: 210 }),
    )
    expect(r.qty_to_order).toBe(210)
  })
})

describe('statusFromLabel — cột NCC không phải lúc nào cũng là nhà cung cấp', () => {
  it('HGIA = xưởng tự làm, không lập đơn', () => {
    expect(statusFromLabel('HGIA')).toBe('self_make')
  })

  it('ĐỦ = tồn đủ khỏi mua (chịu được cả có dấu lẫn không dấu)', () => {
    expect(statusFromLabel('ĐỦ')).toBe('enough')
    expect(statusFromLabel('du')).toBe('enough')
  })

  it('TQ / CHƯA MUA = mua ngoài hoặc chưa chốt', () => {
    expect(statusFromLabel('TQ')).toBe('other')
    expect(statusFromLabel('CHƯA MUA')).toBe('other')
  })

  it('mã NCC thật thì trả null để service đi dò nhà cung cấp', () => {
    expect(statusFromLabel('TTL')).toBeNull()
    expect(statusFromLabel('')).toBeNull()
    expect(statusFromLabel(null)).toBeNull()
  })
})
