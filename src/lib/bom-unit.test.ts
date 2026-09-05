import { describe, expect, it } from 'vitest'
import { convertPartNeed, normUnit, type PartQuantities } from './bom-unit'

const part = (over: Partial<PartQuantities> = {}): PartQuantities => ({
  qty: 2,
  unit: null,
  ...over,
})

describe('normUnit', () => {
  it('bỏ dấu, gọn khoảng trắng, không phân biệt hoa thường', () => {
    expect(normUnit('Cây')).toBe('cay')
    expect(normUnit(' KG ')).toBe('kg')
    expect(normUnit(null)).toBe('')
  })
})

describe('convertPartNeed', () => {
  it('cùng đơn vị đếm: cái ≡ con — dùng thẳng số chi tiết', () => {
    const r = convertPartNeed(part({ qty: 68, unit: 'cái' }), { unit: 'Con' })
    expect(r).toMatchObject({ ok: true, qty_per_unit: 68, basis: 'count' })
  })

  it('"bộ" KHÔNG phải đơn vị đếm tương đương cái', () => {
    const r = convertPartNeed(part({ qty: 2, unit: 'cái' }), { unit: 'Bộ' })
    expect(r.ok).toBe(false)
  })

  it('vật tư bán theo CÂY: số cây = tổng mét ÷ chiều dài cây, không phải số thanh', () => {
    // Ca thật NH-0009: 2 thanh × 1,04 m = 2,08 m/SP, cây nhôm 6 m.
    const r = convertPartNeed(part({ qty: 2, unit: null, total_length_m: 2.08 }), {
      unit: 'Cây',
      default_bar_length_m: 6,
    })
    expect(r).toMatchObject({ ok: true, basis: 'length_to_bar' })
    if (r.ok) {
      expect(r.qty_per_unit).toBeCloseTo(0.3467, 3)
      expect(r.qty_per_unit).not.toBe(2) // lỗi cũ: lấy số thanh làm số cây
      expect(r.explain).toContain('÷ 6 m mỗi Cây')
    }
  })

  it('chiều dài cây khai trên dòng thắng mặc định của vật tư', () => {
    const r = convertPartNeed(part({ qty: 1, total_length_m: 12, bar_length_m: 4 }), {
      unit: 'cây',
      default_bar_length_m: 6,
    })
    expect(r).toMatchObject({ ok: true, qty_per_unit: 3 })
  })

  it('thiếu chiều dài cây → KHÔNG đoán, nói rõ thiếu gì', () => {
    const r = convertPartNeed(part({ qty: 2, total_length_m: 2.08 }), { unit: 'Cây' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('chiều dài một Cây')
  })

  it('thiếu tổng mét → không quy đổi, không lấy số thanh thay thế', () => {
    const r = convertPartNeed(part({ qty: 2 }), { unit: 'Cây', default_bar_length_m: 6 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('tổng chiều dài')
  })

  it('vật tư theo KG dùng khối lượng, không dùng số con', () => {
    const ok = convertPartNeed(part({ qty: 2, unit: 'con', weight_kg: 0.35 }), {
      unit: 'Kg',
    })
    expect(ok).toMatchObject({ ok: true, qty_per_unit: 0.35, basis: 'weight' })
    // Ca thật BUL0335: định mức 2 con/SP, vật tư bán theo Kg, chưa có khối lượng.
    const chan = convertPartNeed(part({ qty: 2, unit: 'con' }), { unit: 'Kg' })
    expect(chan.ok).toBe(false)
  })

  it('đơn vị định mức trống + vật tư đếm chiếc → coi số chi tiết là số cái', () => {
    const r = convertPartNeed(part({ qty: 4, unit: null }), { unit: 'Cái' })
    expect(r).toMatchObject({ ok: true, qty_per_unit: 4, basis: 'count' })
  })

  it('hao hụt % cộng thêm sau khi quy đổi', () => {
    const r = convertPartNeed(part({ qty: 10, unit: 'cái', waste_pct: 5 }), {
      unit: 'cái',
    })
    expect(r).toMatchObject({ ok: true, qty_per_unit: 10.5 })
  })

  it('m² và m³ dùng số đã tính sẵn; thiếu thì chặn', () => {
    expect(convertPartNeed(part({ paint_area_m2: 1.2 }), { unit: 'm2' })).toMatchObject({
      ok: true,
      qty_per_unit: 1.2,
    })
    expect(convertPartNeed(part({ volume_m3: 0.03 }), { unit: 'm3' })).toMatchObject({
      ok: true,
      qty_per_unit: 0.03,
    })
    expect(convertPartNeed(part({}), { unit: 'm3' }).ok).toBe(false)
  })

  it('đơn vị lạ hoàn toàn → chặn kèm tên hai đơn vị', () => {
    const r = convertPartNeed(part({ qty: 3, unit: 'tờ' }), { unit: 'Lít' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('Lít')
  })
})
