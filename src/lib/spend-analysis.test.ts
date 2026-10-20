import { describe, expect, it } from 'vitest'
import { pareto, paretoCount, singleSource, type SpendLine } from './spend-analysis'

const L = (o: Partial<SpendLine> & { key: string; amount: number }): SpendLine => ({
  label: o.key,
  currency: 'VND',
  ...o,
})

describe('pareto — gộp, xếp, và LUỸ KẾ', () => {
  it('xếp giảm dần và tính đúng tỉ lệ', () => {
    const rows = pareto([
      L({ key: 'Nhôm', amount: 600 }),
      L({ key: 'Sơn', amount: 300 }),
      L({ key: 'Ốc vít', amount: 100 }),
    ])
    expect(rows.map((r) => r.key)).toEqual(['Nhôm', 'Sơn', 'Ốc vít'])
    expect(rows[0].share).toBe(60)
    expect(rows[1].share).toBe(30)
  })

  /**
   * Luỹ kế là thứ làm bảng này khác bảng tổng thường: nhìn cột đó là biết ngay
   * "mấy dòng đầu đã chiếm bao nhiêu %", tức biết chỗ đáng bỏ công đàm phán.
   */
  it('luỹ kế cộng dồn từ trên xuống, dòng cuối là 100%', () => {
    const rows = pareto([
      L({ key: 'a', amount: 600 }),
      L({ key: 'b', amount: 300 }),
      L({ key: 'c', amount: 100 }),
    ])
    expect(rows.map((r) => r.cumulative)).toEqual([60, 90, 100])
  })

  it('cộng dồn nhiều dòng cùng nhóm và đếm số MÃ riêng', () => {
    const rows = pareto([
      L({ key: 'Nhôm', amount: 100, material_id: 'm1' }),
      L({ key: 'Nhôm', amount: 200, material_id: 'm1' }),
      L({ key: 'Nhôm', amount: 300, material_id: 'm2' }),
    ])
    expect(rows[0].amount).toBe(600)
    expect(rows[0].line_count).toBe(3)
    expect(rows[0].material_count).toBe(2)
  })

  it('TÁCH THEO TIỀN TỆ — luỹ kế tính riêng từng loại, không cộng chéo', () => {
    const rows = pareto([
      L({ key: 'a', amount: 900, currency: 'VND' }),
      L({ key: 'b', amount: 100, currency: 'VND' }),
      L({ key: 'c', amount: 50, currency: 'USD' }),
    ])
    const usd = rows.filter((r) => r.currency === 'USD')
    expect(usd).toHaveLength(1)
    expect(usd[0].share).toBe(100) // 100% của USD, không phải 5% của tổng gộp
    expect(rows.filter((r) => r.currency === 'VND').at(-1)!.cumulative).toBe(100)
  })

  /** Dòng chưa khai giá làm mẫu số sai, và nhóm 0 đồng không nói lên điều gì. */
  it('bỏ khoản 0 và âm', () => {
    const rows = pareto([
      L({ key: 'a', amount: 100 }),
      L({ key: 'b', amount: 0 }),
      L({ key: 'c', amount: -50 }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].share).toBe(100)
  })

  it('không có gì thì trả mảng rỗng, không trả hàng 0', () => {
    expect(pareto([])).toEqual([])
  })
})

describe('paretoCount — câu tóm tắt của bảng', () => {
  it('đếm đúng số dòng đầu chiếm 80%', () => {
    const rows = pareto([
      L({ key: 'a', amount: 500 }),
      L({ key: 'b', amount: 300 }),
      L({ key: 'c', amount: 150 }),
      L({ key: 'd', amount: 50 }),
    ])
    // a=50% · a+b=80% → hai dòng đầu
    expect(paretoCount(rows, 'VND', 80)).toEqual({ count: 2, of: 4 })
  })

  /** "0 nhà cung cấp chiếm 80%" là câu vô nghĩa — người đọc hiểu thành không ai. */
  it('không có dữ liệu thì trả null, KHÔNG trả 0', () => {
    expect(paretoCount([], 'VND')).toBeNull()
    expect(paretoCount(pareto([L({ key: 'a', amount: 1 })]), 'USD')).toBeNull()
  })
})

describe('singleSource — rủi ro một nguồn cung', () => {
  const b = (material_id: string, supplier_id: string, amount: number) => ({
    material_id,
    code: material_id.toUpperCase(),
    name: `VT ${material_id}`,
    supplier_id,
    supplier_name: `NCC ${supplier_id}`,
    currency: 'VND',
    amount,
  })

  it('chỉ giữ mã mua từ ĐÚNG một NCC', () => {
    const r = singleSource([b('m1', 's1', 100), b('m2', 's1', 50), b('m2', 's2', 50)])
    expect(r.map((x) => x.material_id)).toEqual(['m1'])
    expect(r[0].supplier_names).toEqual(['NCC s1'])
  })

  /**
   * Một mã ốc vít 200.000đ chỉ có một nguồn thì không sao; một mã nhôm 3 tỷ chỉ
   * có một nguồn là chuyện khác hẳn. Xếp theo số lần mua sẽ đẩy đúng mã vặt lên.
   */
  it('xếp theo TIỀN giảm dần, không theo số lần mua', () => {
    const r = singleSource([
      b('vat', 's1', 200_000),
      b('vat', 's1', 200_000),
      b('vat', 's1', 200_000),
      b('nhom', 's2', 3_000_000_000),
    ])
    expect(r[0].material_id).toBe('nhom')
    expect(r[0].amount).toBe(3_000_000_000)
  })

  it('cộng dồn tiền của nhiều lần mua cùng mã', () => {
    const r = singleSource([b('m1', 's1', 100), b('m1', 's1', 250)])
    expect(r[0].amount).toBe(350)
  })

  it('bỏ khoản 0 — chưa khai giá thì chưa nói được gì về rủi ro tiền', () => {
    expect(singleSource([b('m1', 's1', 0)])).toEqual([])
  })
})
