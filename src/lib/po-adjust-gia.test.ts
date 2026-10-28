import { describe, expect, it } from 'vitest'
import {
  canAdjust,
  giaPhieuNhap,
  locChiGia,
  loiChiGia,
  planAdjustment,
  theoBuocDon,
  type AdjAfterLine,
  type AdjBeforeLine,
} from './po-adjust'

/*
 * ĐIỀU CHỈNH GIÁ ĐƠN ĐÃ VỀ ĐỦ (0280). Số liệu = đơn thật PO-2026-0109 (Minh Thắng,
 * 4 dòng, VAT 8% cộng thêm, về đủ 09/10 qua PNK-2026-0117). Giá mới là ví dụ của
 * bản vẽ: vít 4x30 120 → 115, bulon 6x50 1.000 → 950.
 */
const b = (over: Partial<AdjBeforeLine> & { id: string }): AdjBeforeLine => ({
  material_id: `m-${over.id}`,
  code: 'X',
  name: 'x',
  unit: 'Con',
  qty_ordered: 1,
  unit_price: 1,
  price_basis: 'unit',
  qty2: null,
  received: 0,
  planned: 0,
  invoiced: false,
  ...over,
})
const BEFORE: AdjBeforeLine[] = [
  b({ id: 'l1', code: 'VIT0210', name: 'Vít 4x30 sắt xi đen', qty_ordered: 11_240, unit_price: 120, received: 11_240 }), // prettier-ignore
  b({ id: 'l2', code: 'NK-0210', name: 'Bulon 6x50 tai côn lục giác, xi đen', qty_ordered: 2_328, unit_price: 1000, received: 2_328 }), // prettier-ignore
  b({ id: 'l3', code: 'NK-0211', name: 'Bulon 6x25 tai côn lục giác, xi đen', qty_ordered: 2_328, unit_price: 500, received: 2_328 }), // prettier-ignore
  b({ id: 'l4', code: 'BUL0022', name: 'Bulon 6x25x13,xi đen', qty_ordered: 657, unit_price: 280, received: 657 }), // prettier-ignore
]
const keep = (l: AdjBeforeLine, over: Partial<AdjAfterLine> = {}): AdjAfterLine => {
  const { received: _r, planned: _p, invoiced: _i, ...rest } = l
  return { ...rest, ...over }
}
const H = { vatRate: 8, discount: null }
const plan = (after: AdjAfterLine[], before = BEFORE, hA = H) =>
  planAdjustment({
    currency: 'VND',
    priceIncludesVat: false,
    before: { lines: before, header: H },
    after: { lines: after, header: hA },
  })

describe('canAdjust — đơn về đủ chuyển sang chế độ chỉ giá', () => {
  it('về đủ: điều chỉnh được, chỉ giá', () => {
    expect(canAdjust('received')).toEqual({ ok: true, chiGia: true })
  })
  it('đơn đang chạy: điều chỉnh đầy đủ như cũ; nháp / huỷ vẫn chặn', () => {
    expect(canAdjust('partial')).toEqual({ ok: true, chiGia: false })
    expect(canAdjust('draft').ok).toBe(false)
    expect(canAdjust('cancelled').ok).toBe(false)
  })
})

describe('loiChiGia — PO-2026-0109', () => {
  it('chỉ đổi giá hai dòng: không lỗi, phát sinh đúng số bản vẽ (−186.408)', () => {
    const p = plan([keep(BEFORE[0], { unit_price: 115 }), keep(BEFORE[1], { unit_price: 950 }), keep(BEFORE[2]), keep(BEFORE[3])]) // prettier-ignore
    expect(p.errors).toEqual([])
    expect(loiChiGia(p, BEFORE)).toEqual([])
    expect(p.delta.byPrice).toBe(-172_600)
    expect(p.delta.total).toBe(-186_408)
  })

  it('đổi SL → chặn, nói lệch số lượng là việc của Kho', () => {
    const p = plan([keep(BEFORE[0], { qty_ordered: 11_500 }), keep(BEFORE[1]), keep(BEFORE[2]), keep(BEFORE[3])]) // prettier-ignore
    expect(loiChiGia(p, BEFORE)).toEqual([
      'Dòng 1 (VIT0210): đơn đã về đủ — SL giữ theo phiếu nhập; lệch số lượng xử lý ở Kho (phiếu điều chỉnh / trả hàng)',
    ])
  })

  it('thêm / bỏ dòng → chặn', () => {
    const them = plan([...BEFORE.map((l) => keep(l)), { material_id: 'm-x', code: 'NK-9', name: 'Tán', unit: 'Con', qty_ordered: 10, unit_price: 5, price_basis: 'unit', qty2: null }]) // prettier-ignore
    expect(loiChiGia(them, BEFORE)[0]).toContain('không thêm dòng')
    const bo = plan(BEFORE.slice(0, 3).map((l) => keep(l)))
    expect(loiChiGia(bo, BEFORE).join(' ')).toContain('không bỏ dòng')
  })

  it('lệch ô phụ (ghi chú, cột ẩn carton_basis của mẫu kính) → gạt đi, không chặn, không vào sổ', () => {
    // PO-2026-0065 (mẫu kính): cả 10 dòng lệch carton_basis dù không ai sửa.
    const p = plan([keep(BEFORE[0], { note: 'đổi', carton_basis: 'm2' }), keep(BEFORE[1], { carton_basis: 'm2', unit_price: 950 }), keep(BEFORE[2]), keep(BEFORE[3])]) // prettier-ignore
    expect(p.changes).toHaveLength(2)
    const loc = locChiGia(p)
    expect(loc.changes.map((c) => [c.code, c.fields])).toEqual([['NK-0210', []]])
    expect(loiChiGia(loc, BEFORE)).toEqual([])
    // Chỉ lệch ô phụ, không đổi giá → không có gì để lưu.
    const chiPhu = locChiGia(plan([keep(BEFORE[0], { note: 'đổi' }), keep(BEFORE[1]), keep(BEFORE[2]), keep(BEFORE[3])])) // prettier-ignore
    expect(chiPhu.changes).toEqual([])
    expect(loiChiGia(chiPhu, BEFORE)).toEqual(['Chưa đổi giá dòng nào — gõ giá mới vào ô Đơn giá của dòng NCC tính lại']) // prettier-ignore
  })

  it('dòng đã lên hoá đơn NCC → không đổi giá ở đây, chỉ đường gỡ', () => {
    const before = BEFORE.map((l) => (l.id === 'l2' ? { ...l, invoiced: true } : l))
    const p = plan([keep(before[0]), keep(before[1], { unit_price: 950 }), keep(before[2]), keep(before[3])], before) // prettier-ignore
    expect(loiChiGia(p, before)[0]).toContain(
      'đã lên hoá đơn NCC — sửa giá ở hoá đơn trong Tài chính',
    )
  })

  it('không đổi gì → nói gõ giá vào đâu; chỉ đổi VAT thì được', () => {
    expect(loiChiGia(plan(BEFORE.map((l) => keep(l))), BEFORE)).toEqual([
      'Chưa đổi giá dòng nào — gõ giá mới vào ô Đơn giá của dòng NCC tính lại',
    ])
    const vat = plan(
      BEFORE.map((l) => keep(l)),
      BEFORE,
      { vatRate: 10, discount: null },
    )
    expect(loiChiGia(vat, BEFORE)).toEqual([])
  })

  it('đổi cách tính giá (theo cái → theo kg) → chặn', () => {
    const p = plan([keep(BEFORE[0], { price_basis: 'unit2', qty2: 50, unit_price: 27_000 }), keep(BEFORE[1]), keep(BEFORE[2]), keep(BEFORE[3])]) // prettier-ignore
    expect(loiChiGia(p, BEFORE).join(' ')).toContain('không đổi cách tính giá')
  })
})

describe('giaPhieuNhap — cùng công thức lúc ghi phiếu (poLineUnitCosts) và hàm DB 0280', () => {
  it('theo ĐVT: đúng đơn giá', () => {
    expect(giaPhieuNhap({ qty_ordered: 2_328, unit_price: 950, price_basis: 'unit', qty2: null })).toBe(950) // prettier-ignore
  })
  it('theo kg: tiền dòng ÷ SL đặt, 2 số lẻ (nhôm 210 cây, 1.146,6 kg × 19.500)', () => {
    expect(giaPhieuNhap({ qty_ordered: 210, unit_price: 19_500, price_basis: 'unit2', qty2: 1146.6 })).toBe(106_470) // prettier-ignore
  })
  it('không giá / SL 0 → null', () => {
    expect(
      giaPhieuNhap({ qty_ordered: 0, unit_price: 10, price_basis: 'unit', qty2: null }),
    ).toBeNull()
    expect(
      giaPhieuNhap({ qty_ordered: 5, unit_price: null, price_basis: 'unit', qty2: null }),
    ).toBeNull()
  })
})

describe('theoBuocDon — bản điều chỉnh trên màn theo bước của đơn', () => {
  const sua = [keep(BEFORE[0], { qty_ordered: 11_500, carton_basis: 'm2' }), keep(BEFORE[1], { carton_basis: 'm2' }), keep(BEFORE[2]), keep(BEFORE[3])] // prettier-ignore
  it('đơn đang chạy: giữ nguyên bản điều chỉnh đầy đủ', () => {
    const p = plan(sua)
    expect(theoBuocDon('partial', BEFORE, p)).toBe(p)
  })
  it('đơn về đủ: gạt dòng chỉ lệch ô phụ, chặn đổi SL tại chỗ', () => {
    const r = theoBuocDon('received', BEFORE, plan(sua))
    expect(r.changes.map((c) => c.code)).toEqual(['VIT0210'])
    expect(r.errors.join(' ')).toContain('SL giữ theo phiếu nhập')
  })
  it('đơn về đủ, chỉ lệch ô phụ: không có gì để lưu, không bày lỗi', () => {
    const r = theoBuocDon('received', BEFORE, plan([keep(BEFORE[0], { carton_basis: 'm2' }), keep(BEFORE[1]), keep(BEFORE[2]), keep(BEFORE[3])])) // prettier-ignore
    expect(r.changes).toEqual([])
    expect(r.errors).toEqual([])
  })
})
