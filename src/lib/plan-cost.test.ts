import { describe, expect, it } from 'vitest'
import {
  matchPlanRows,
  parsePlanBlock,
  parsePlanPaste,
  planCheck,
  planDeviationPct,
  planPct,
} from './plan-cost'

describe('planCheck / planPct — đúng số trong file Halston và MERXX', () => {
  it('Halston Corner: 144 + 28,80 + 15,55 = 188,34 (lệch 1 cent vì làm tròn)', () => {
    const r = planCheck({ direct: 144, overhead: 28.8, profit: 15.55, price: 188.34 })
    expect(r.ok).toBe(true)
    expect(Math.abs(r.diff)).toBeLessThanOrEqual(0.05)
    expect(planPct({ direct: 144, overhead: 28.8, profit: 15.55 })).toEqual({
      a: 20,
      b: 9,
    })
  })
  it('MERXX 21604-217: a 20%, b 6%', () => {
    expect(planPct({ direct: 65.71, overhead: 13.14, profit: 4.73 })).toEqual({
      a: 20,
      b: 6,
    })
    expect(
      planCheck({ direct: 65.71, overhead: 13.14, profit: 4.73, price: 83.58 }).ok,
    ).toBe(true)
  })
  it('dán nhầm FOB → không khớp, diff nói rõ chiều', () => {
    const r = planCheck({ direct: 65.71, overhead: 13.14, profit: 4.73, price: 83 })
    expect(r.ok).toBe(false)
    expect(r.diff).toBe(-0.58)
  })
  it('VND dung sai 1 đồng', () => {
    expect(planCheck({ direct: 1000000, overhead: 100000, profit: 50000, price: 1150001 }, 'VND').ok).toBe(true) // prettier-ignore
  })
  it('trực tiếp 0 thì % là null, không NaN', () => {
    expect(planPct({ direct: 0, overhead: 0, profit: 0 })).toEqual({ a: null, b: null })
  })
  it('lệch so số cũ', () => {
    expect(planDeviationPct(58.75, 188.34)).toBe(-68.8)
    expect(planDeviationPct(10, null)).toBeNull()
  })
})

describe('parsePlanPaste — 5 cột, trực tiếp để trống được', () => {
  it('đọc dòng đủ và dòng thiếu trực tiếp, bỏ dòng tiêu đề', () => {
    const r = parsePlanPaste(
      'Mã\tTrực tiếp\tCPC\tLN\tFOB\nHalston Corner\t144.00\t28.80\t15.55\t188.34\n21604-217\t\t13.14\t4.73\t83.58\n',
      '.',
    )
    expect(r.errors).toEqual([])
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({ code: 'Halston Corner', derived_direct: false })
    expect(r.rows[1].plan).toEqual({
      direct: 65.71,
      overhead: 13.14,
      profit: 4.73,
      price: 83.58,
    })
    expect(r.rows[1].derived_direct).toBe(true)
  })
  it('thiếu cột thì báo đúng số dòng', () => {
    const r = parsePlanPaste('A\t1\t2\n', '.')
    expect(r.rows).toHaveLength(0)
    expect(r.errors[0].line).toBe(1)
  })
  it('số kiểu Việt với dấu phẩy thập phân', () => {
    const r = parsePlanPaste('X\t144,00\t28,80\t15,55\t188,34', ',')
    expect(r.rows[0].plan.price).toBe(188.34)
  })
})

describe('matchPlanRows — mã HG thắng mã khách, mã khách trùng thì không đoán', () => {
  const targets = [
    { product_id: 'a', code: 'S0087HG-AL', customer_code: 'Halston Corner' },
    { product_id: 'b', code: 'C0084HG-AL', customer_code: '26006-309' },
    { product_id: 'c', code: 'C0085HG-AL', customer_code: '26006-309' },
    { product_id: 'd', code: '26006-309', customer_code: null },
  ]
  it('khớp theo mã HG, rồi mã khách; không phân biệt hoa thường', () => {
    const r = matchPlanRows(targets, [
      { line: 1, code: 'halston corner ' },
      { line: 2, code: 's0087hg-al' },
      { line: 3, code: 'XYZ' },
    ])
    expect(r.matched.map((m) => m.target.product_id)).toEqual(['a', 'a'])
    expect(r.unmatched.map((u) => u.line)).toEqual([3])
  })
  it('chuỗi vừa là mã HG của SP d vừa là mã khách của b, c → mã HG thắng', () => {
    const r = matchPlanRows(targets, [{ line: 1, code: '26006-309' }])
    expect(r.matched[0].target.product_id).toBe('d')
  })
  it('mã khách gắn 2 SP và không có SP HG trùng → ambiguous', () => {
    const r = matchPlanRows(targets.slice(0, 3), [{ line: 1, code: '26006-309' }])
    expect(r.ambiguous[0].codes).toEqual(['C0084HG-AL', 'C0085HG-AL'])
  })
})

describe('parsePlanBlock — khối chi phí chép nguyên từ file', () => {
  const block = [
    'nhôm\t$18.48',
    'tiền công\t$4.86 ',
    'đóng+kiểm\t$0.38 ',
    'xuất hàng\t$0.43 ',
    'bao bì, đóng gói\t$4.59',
    'vật tư\t$3.17',
    'sơn\t$1.25',
    'euka FSC\t$11.36',
    'chi phí chung\t$4.45',
    'Lợi nhuận\t$3.43',
    'Total\t$52.40',
    'Giá cũ\t$48.00',
    '9.17%',
  ].join('\n')

  it('gom dòng trực tiếp, tách chung / lợi nhuận / Total / Giá cũ', () => {
    const b = parsePlanBlock(block, '.')!
    expect(b.breakdown).toHaveLength(8)
    expect(b.breakdown[4]).toEqual({ label: 'bao bì, đóng gói', amount: 4.59 })
    expect(b.plan).toEqual({ direct: 44.52, overhead: 4.45, profit: 3.43, price: 52.4 })
    expect(b.old_price).toBe(48)
    expect(planCheck(b.plan).ok).toBe(true)
  })
  it('thiếu Total thì null', () => {
    expect(parsePlanBlock('nhôm\t$1\nchi phí chung\t$1\nLợi nhuận\t$1', '.')).toBeNull()
  })
  it('chịu được cột trống xen giữa nhãn và số (chép từ sheet nhiều cột)', () => {
    const b = parsePlanBlock('sắt\t\t$25.60\nchi phí chung\t\t$28.80\nLợi nhuận\t\t$15.55\nTotal\t\t$188.34', '.')! // prettier-ignore
    expect(b.plan.direct).toBe(25.6)
    expect(b.plan.price).toBe(188.34)
  })
})
