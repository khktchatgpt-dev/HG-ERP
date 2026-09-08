import { describe, expect, it } from 'vitest'
import { splitBangKe, type BangKeRow } from './lsx-bang-ke'

/**
 * TÁCH VIỆC PHẢI LÀM khỏi việc đã xong — xem `splitBangKe`.
 *
 * Ca đo thật: LSX 06/26-27 có 68 mã mà chỉ 16 mã còn phải mua.
 */

function row(p: Partial<BangKeRow>): BangKeRow {
  return {
    material_id: 'm1',
    material_code: 'VT-001',
    material_name: 'Vật tư',
    unit: 'Con',
    group_name: null,
    source: 'bom',
    deviates: false,
    auto_needed: null,
    draft_needed: 0,
    edited_by: null,
    edited_at: null,
    from_products: [],
    incomplete: false,
    qty_needed: 0,
    qty_issued: 0,
    qty_remaining: 0,
    on_hand: 0,
    reserved_others: 0,
    available: 0,
    ordered: 0,
    pending: 0,
    draft: 0,
    received: 0,
    suggest: 0,
    status: 'done',
    note: null,
    pos: [],
    ...p,
  }
}

describe('splitBangKe', () => {
  it('mã còn phải đặt thì vào nhóm phải mua', () => {
    const { phaiMua, khongPhaiMua } = splitBangKe([
      row({ material_code: 'A', suggest: 160, status: 'none' }),
    ])
    expect(phaiMua.map((r) => r.material_code)).toEqual(['A'])
    expect(khongPhaiMua).toHaveLength(0)
  })

  it('mã đã đủ hoặc đang về thì hết việc, sang nhóm không phải mua', () => {
    const { phaiMua, khongPhaiMua } = splitBangKe([
      row({ material_code: 'DU', suggest: 0, status: 'done' }),
      row({ material_code: 'VE', suggest: 0, status: 'inflight' }),
    ])
    expect(phaiMua).toHaveLength(0)
    expect(khongPhaiMua.map((r) => r.material_code)).toEqual(['DU', 'VE'])
  })

  it('mã ngoài định mức (chỉ có trên đơn) không phải việc của người mua', () => {
    const { phaiMua, khongPhaiMua } = splitBangKe([
      row({ material_code: 'BAO0081', suggest: 0, status: 'extra', source: 'none' }),
    ])
    expect(phaiMua).toHaveLength(0)
    expect(khongPhaiMua).toHaveLength(1)
  })

  it('BOM chưa xác nhận VẪN là việc phải làm dù chưa được mua', () => {
    // Đây là việc đang mắc ở Kỹ thuật — đẩy sang tờ "không phải mua" thì người
    // mua tưởng đã xong và lệnh trễ vì không ai đi giục.
    const { phaiMua } = splitBangKe([
      row({ material_code: 'NK-0133', suggest: 0, status: 'unconfirmed' }),
    ])
    expect(phaiMua.map((r) => r.material_code)).toEqual(['NK-0133'])
  })

  it('"đặt chưa đủ" còn việc, không tính là xong', () => {
    const { phaiMua } = splitBangKe([
      row({ material_code: 'SHORT', suggest: 40, status: 'short' }),
    ])
    expect(phaiMua).toHaveLength(1)
  })

  it('giữ nguyên thứ tự và không làm mất dòng nào', () => {
    const rows = [
      row({ material_code: 'A', suggest: 10, status: 'none' }),
      row({ material_code: 'B', suggest: 0, status: 'done' }),
      row({ material_code: 'C', suggest: 5, status: 'short' }),
      row({ material_code: 'D', suggest: 0, status: 'extra' }),
    ]
    const { phaiMua, khongPhaiMua } = splitBangKe(rows)
    expect(phaiMua.length + khongPhaiMua.length).toBe(rows.length)
    expect(phaiMua.map((r) => r.material_code)).toEqual(['A', 'C'])
    expect(khongPhaiMua.map((r) => r.material_code)).toEqual(['B', 'D'])
  })
})
