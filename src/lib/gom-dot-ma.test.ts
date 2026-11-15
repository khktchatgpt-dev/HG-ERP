import { describe, expect, it } from 'vitest'
import { nhanTheoDot, nhomGomTheoMa } from './gom-dot-ma'

type R = { production_order_line_id: string; name: string; qty: number }
const r = (line: string, name: string, qty = 1): R => ({
  production_order_line_id: line,
  name,
  qty,
})
const chuKy = (x: R) => `${x.name}|${x.qty}`

describe('nhomGomTheoMa', () => {
  const lines = [
    { id: 'd1', product_code: 'CH0212HG-IR' },
    { id: 'd2', product_code: 'CH0212HG-IR' },
    { id: 'd3', product_code: 'CH0212HG-IR' },
    { id: 'x1', product_code: 'TB0228HG-IR' },
  ]

  it('mọi đợt cùng trống → gom về dòng đầu (lệnh LAURA chưa có định mức)', () => {
    const gom = nhomGomTheoMa(lines, () => [], chuKy)
    expect([...gom]).toEqual([['d1', ['d2', 'd3']]])
  })

  it('mọi đợt cùng bộ chi tiết → gom; một đợt khác → không gom mã đó', () => {
    const rows = [r('d1', 'Chân', 2), r('d2', 'Chân', 2), r('d3', 'Chân', 2)]
    const by = (id: string) => rows.filter((x) => x.production_order_line_id === id)
    expect(nhomGomTheoMa(lines, by, chuKy).get('d1')).toEqual(['d2', 'd3'])
    const lech = [...rows.slice(0, 2), r('d3', 'Chân', 4)]
    const by2 = (id: string) => lech.filter((x) => x.production_order_line_id === id)
    expect(nhomGomTheoMa(lines, by2, chuKy).size).toBe(0)
  })

  it('mã chỉ một đợt thì không có trong bảng gom', () => {
    expect(
      nhomGomTheoMa([{ id: 'x1', product_code: 'TB0228HG-IR' }], () => [], chuKy).size,
    ).toBe(0)
  })
})

describe('nhanTheoDot', () => {
  it('lưu: dòng của đại diện chép sang mọi đợt, dòng cũ của đợt đi theo bị thay', () => {
    const gom = new Map([['d1', ['d2', 'd3']]])
    const rows = [
      r('d1', 'Chân trước', 2),
      r('d1', 'Chân sau', 2),
      r('d2', 'cũ'),
      r('x1', 'Mặt'),
    ]
    const out = nhanTheoDot(rows, gom)
    expect(out.map((x) => `${x.production_order_line_id}:${x.name}`)).toEqual([
      'd1:Chân trước',
      'd1:Chân sau',
      'x1:Mặt',
      'd2:Chân trước',
      'd2:Chân sau',
      'd3:Chân trước',
      'd3:Chân sau',
    ])
  })
})
