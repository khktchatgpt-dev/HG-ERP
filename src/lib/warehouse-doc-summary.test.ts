import { describe, expect, it } from 'vitest'
import { summariseDoc, type MovementLite } from './warehouse-doc-summary'

const mv = (p: Partial<MovementLite> = {}): MovementLite => ({
  direction: 'in',
  material_id: 'm1',
  qty: 10,
  ...p,
})

describe('summariseDoc — đếm', () => {
  it('cộng số lượng và đếm dòng', () => {
    const r = summariseDoc([mv({ qty: 1950 }), mv({ material_id: 'm2', qty: 8504 })])
    expect(r.dong).toBe(2)
    expect(r.sl).toBe(1950 + 8504)
  })

  it('BA DÒNG CÙNG MỘT MÃ vẫn là một mã — Cung ứng tách dòng theo lệnh', () => {
    const r = summariseDoc([mv({ qty: 100 }), mv({ qty: 200 }), mv({ qty: 300 })])
    expect(r.dong).toBe(3)
    expect(r.ma).toBe(1)
    expect(r.sl).toBe(600)
  })

  it('QC loại đếm riêng, KHÔNG cộng vào số lượng vào tồn (BR-10)', () => {
    const r = summariseDoc([mv({ qty: 60, qty_rejected: 5 })])
    expect(r.sl).toBe(60)
    expect(r.loai).toBe(5)
  })

  it('phiếu rỗng không vỡ', () => {
    expect(summariseDoc([])).toEqual({
      dong: 0,
      ma: 0,
      sl: 0,
      loai: 0,
      tien: null,
      thieuGia: false,
    })
  })
})

describe('summariseDoc — tiền', () => {
  it('nhân giá vốn từng dòng rồi cộng', () => {
    const r = summariseDoc([
      mv({ qty: 1950, unit_cost: 1750 }),
      mv({ material_id: 'm2', qty: 8504, unit_cost: 650 }),
    ])
    expect(r.tien).toBe(1950 * 1750 + 8504 * 650)
    expect(r.thieuGia).toBe(false)
  })

  it('CHƯA BIẾT GIÁ trả null, KHÔNG trả 0 — hai thứ đó khác nhau', () => {
    // Bịa ra số 0 là nói "phiếu này không đáng đồng nào", sai hẳn nghĩa.
    const r = summariseDoc([mv({ qty: 100 }), mv({ qty: 200 })])
    expect(r.tien).toBeNull()
    expect(r.thieuGia).toBe(false)
  })

  it('MỘT PHẦN có giá thì trả phần tính được và BẬT CỜ thiếu giá', () => {
    const r = summariseDoc([
      mv({ qty: 100, unit_cost: 50 }),
      mv({ material_id: 'm2', qty: 200 }),
    ])
    expect(r.tien).toBe(5_000)
    expect(r.thieuGia).toBe(true)
  })

  it('giá 0 khai TƯỜNG MINH vẫn là có giá — không lẫn với chưa biết', () => {
    const r = summariseDoc([mv({ qty: 100, unit_cost: 0 })])
    expect(r.tien).toBe(0)
    expect(r.thieuGia).toBe(false)
  })

  it('QC loại không được tính tiền — hàng lỗi trả lại NCC', () => {
    const r = summariseDoc([mv({ qty: 60, qty_rejected: 5, unit_cost: 1000 })])
    expect(r.tien).toBe(60_000)
  })
})
