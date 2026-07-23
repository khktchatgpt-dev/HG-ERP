import { describe, it, expect } from 'vitest'
import { computeReservedByMaterial } from './reserved-stock'

const comp = (
  lsx: string,
  mat: string | null,
  qtyPerUnit: number,
  orderQty: number,
  opts: { dm_kg?: number | null; pcs_per_bar?: number | null } = {},
) => ({
  production_order_id: lsx,
  material_id: mat,
  qty_per_unit: qtyPerUnit,
  dm_kg: opts.dm_kg ?? null,
  pcs_per_bar: opts.pcs_per_bar ?? null,
  order_qty: orderQty,
})

describe('computeReservedByMaterial — tồn đặt trước theo LSX cam kết', () => {
  it('LSX có bảng chi tiết: cần (số cây ưu tiên) − đã xuất, chặn dưới 0', () => {
    // 2 chi tiết × 10 SP = 20 chi tiết; hệ số 4 chi tiết/cây → cần 5 cây.
    const r = computeReservedByMaterial(
      [comp('lsx1', 'm1', 2, 10, { pcs_per_bar: 4 })],
      [{ production_order_id: 'lsx1', material_id: 'm1', qty: 2 }],
      [],
    )
    expect(r.get('m1')).toBe(3) // 5 cây − 2 đã xuất
  })

  it('không hệ số cây → dùng kg; không ĐM kg → dùng số chi tiết', () => {
    const kg = computeReservedByMaterial(
      [comp('l1', 'mKg', 2, 10, { dm_kg: 1.5 })],
      [],
      [],
    )
    expect(kg.get('mKg')).toBe(30) // 20 chi tiết × 1.5 kg

    const raw = computeReservedByMaterial([comp('l2', 'mRaw', 2, 10)], [], [])
    expect(raw.get('mRaw')).toBe(20) // fallback số chi tiết
  })

  it('xuất đủ/quá nhu cầu → không giữ chỗ (không âm)', () => {
    const r = computeReservedByMaterial(
      [comp('lsx1', 'm1', 1, 5)],
      [{ production_order_id: 'lsx1', material_id: 'm1', qty: 9 }],
      [],
    )
    expect(r.get('m1')).toBeUndefined()
  })

  it('cộng dồn nhiều LSX trên cùng vật tư; dòng chưa gắn vật tư bị bỏ qua', () => {
    const r = computeReservedByMaterial(
      [comp('lsx1', 'm1', 1, 5), comp('lsx2', 'm1', 1, 7), comp('lsx2', null, 1, 99)],
      [],
      [],
    )
    expect(r.get('m1')).toBe(12)
  })

  it('LSX chưa có bảng chi tiết → lấy qty_remaining từ BOM view', () => {
    const r = computeReservedByMaterial(
      [],
      [],
      [
        { production_order_id: 'lsxA', material_id: 'm1', qty_remaining: 4 },
        { production_order_id: 'lsxB', material_id: 'm1', qty_remaining: 6 },
        { production_order_id: 'lsxB', material_id: 'm2', qty_remaining: 0 },
      ],
    )
    expect(r.get('m1')).toBe(10)
    expect(r.get('m2')).toBeUndefined() // remaining 0 không giữ chỗ
  })

  it('LSX có bảng chi tiết thì BỎ dòng BOM của chính nó (không đếm đôi)', () => {
    const r = computeReservedByMaterial(
      [comp('lsx1', 'm1', 1, 5)],
      [],
      [{ production_order_id: 'lsx1', material_id: 'm1', qty_remaining: 99 }],
    )
    expect(r.get('m1')).toBe(5) // chỉ theo bảng chi tiết
  })
})
