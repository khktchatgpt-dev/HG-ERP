import { describe, expect, it } from 'vitest'
import {
  guessDecimalSep,
  matchPasteRows,
  parsePricePaste,
  parsePriceText,
  type MatchTarget,
} from './price-paste'

describe('parsePriceText — dấu thập phân do người chọn, không đoán', () => {
  it('chuẩn Anh–Mỹ: phẩy là hàng nghìn', () => {
    expect(parsePriceText('1,234.56', '.')).toBe(1234.56)
    expect(parsePriceText('1,200', '.')).toBe(1200)
    expect(parsePriceText('12.5', '.')).toBe(12.5)
  })

  it('chuẩn Việt: chấm là hàng nghìn', () => {
    expect(parsePriceText('1.234,56', ',')).toBe(1234.56)
    expect(parsePriceText('1.200', ',')).toBe(1200)
    expect(parsePriceText('12,5', ',')).toBe(12.5)
  })

  it('CÙNG MỘT CHUỖI ra hai số khác nhau tuỳ dấu đã chọn — đây là lý do phải hỏi người dùng', () => {
    expect(parsePriceText('1.200', '.')).toBe(1.2)
    expect(parsePriceText('1.200', ',')).toBe(1200)
  })

  it('bỏ ký hiệu tiền tệ và khoảng trắng Excel', () => {
    expect(parsePriceText('$12.50', '.')).toBe(12.5)
    expect(parsePriceText(' 12 500 ', ',')).toBe(12500)
    expect(parsePriceText('12 500', ',')).toBe(12500) // no-break space
    expect(parsePriceText('1200 VND', '.')).toBe(1200)
  })

  it('không phải số → null (để gọi lên thành lỗi, không thành 0)', () => {
    expect(parsePriceText('', '.')).toBeNull()
    expect(parsePriceText('Đơn giá', '.')).toBeNull()
    expect(parsePriceText('12abc', '.')).toBeNull()
    expect(parsePriceText('.', '.')).toBeNull()
    expect(parsePriceText('1.2.3', '.')).toBeNull() // nhiều dấu thập phân
  })

  it('số 0 là giá HỢP LỆ, không được lẫn với null', () => {
    expect(parsePriceText('0', '.')).toBe(0)
    expect(parsePriceText('0.00', '.')).toBe(0)
  })

  it('ngoặc kế toán đọc thành số âm để tầng trên chặn, không đọc thành dương', () => {
    expect(parsePriceText('(1,200)', '.')).toBe(-1200)
    expect(parsePriceText('-12.5', '.')).toBe(-12.5)
  })
})

describe('guessDecimalSep — chỉ tin khi có đủ cả hai dấu', () => {
  it('có cả hai: dấu sau cùng là thập phân', () => {
    expect(guessDecimalSep('SP1\t1,234.56')).toBe('.')
    expect(guessDecimalSep('SP1\t1.234,56')).toBe(',')
  })

  it('không có bằng chứng → mặc định chấm (đơn xuất khẩu USD)', () => {
    expect(guessDecimalSep('SP1\t1200')).toBe('.')
    expect(guessDecimalSep('SP1\t1,200')).toBe('.')
    expect(guessDecimalSep('')).toBe('.')
  })
})

describe('parsePricePaste — tách khối dán', () => {
  it('2 cột = mã SP + giá', () => {
    const r = parsePricePaste('SP-01\t12.5\nSP-02\t8', '.')
    expect(r.errors).toEqual([])
    expect(r.rows).toEqual([
      { line: 1, order_code: null, product_code: 'SP-01', price: 12.5 },
      { line: 2, order_code: null, product_code: 'SP-02', price: 8 },
    ])
  })

  it('3 cột = mã đơn + mã SP + giá; cột thừa bị bỏ qua', () => {
    const r = parsePricePaste('DH-1\tSP-01\t12.5\tGhế gỗ\t100', '.')
    expect(r.rows).toEqual([
      { line: 1, order_code: 'DH-1', product_code: 'SP-01', price: 12.5 },
    ])
  })

  it('tách được cả dấu chấm phẩy khi không có tab', () => {
    const r = parsePricePaste('SP-01;12.5', '.')
    expect(r.rows[0]).toMatchObject({ product_code: 'SP-01', price: 12.5 })
  })

  it('KHÔNG tách theo dấu phẩy — "1,200" phải còn nguyên là một ô', () => {
    const r = parsePricePaste('SP-01\t1,200', '.')
    expect(r.rows[0].price).toBe(1200)
  })

  it('dòng tiêu đề, dòng thiếu cột, giá rác → errors có số dòng + lý do', () => {
    const r = parsePricePaste('Mã SP\tĐơn giá\nSP-01\nSP-02\txxx\n\nSP-03\t5', '.')
    expect(r.rows).toEqual([
      { line: 5, order_code: null, product_code: 'SP-03', price: 5 },
    ])
    expect(r.errors.map((e) => e.line)).toEqual([1, 2, 3])
    expect(r.errors[1].reason).toContain('2 cột')
  })

  it('giá âm bị chặn ở đây, không lọt xuống DB', () => {
    const r = parsePricePaste('SP-01\t(1,200)', '.')
    expect(r.rows).toEqual([])
    expect(r.errors[0].reason).toBe('Đơn giá âm')
  })

  it('dòng trống bị bỏ im lặng (Excel luôn kèm dòng trống cuối)', () => {
    const r = parsePricePaste('SP-01\t5\n\n\n', '.')
    expect(r.rows).toHaveLength(1)
    expect(r.errors).toEqual([])
  })
})

describe('matchPasteRows — khớp về dòng đơn thật', () => {
  const T = (line_id: string, order_code: string, product_code: string): MatchTarget => ({
    line_id,
    order_code,
    product_code,
  })
  const targets = [
    T('l1', 'DH-1', 'SP-01'),
    T('l2', 'DH-1', 'SP-02'),
    T('l3', 'DH-2', 'SP-01'), // cùng SP, khác đơn
  ]

  it('có mã đơn → khớp chính xác cặp đơn+SP', () => {
    const r = matchPasteRows(targets, parsePricePaste('DH-2\tSP-01\t9', '.').rows)
    expect(r.matched).toEqual([{ line_id: 'l3', price: 9, from_line: 1 }])
    expect(r.ambiguous).toEqual([])
  })

  it('không mã đơn + SP chỉ có ở 1 đơn → khớp được', () => {
    const r = matchPasteRows(targets, parsePricePaste('SP-02\t7', '.').rows)
    expect(r.matched).toEqual([{ line_id: 'l2', price: 7, from_line: 1 }])
  })

  it('không mã đơn + SP trùng ở 2 đơn → AMBIGUOUS, tuyệt đối không đoán', () => {
    const r = matchPasteRows(targets, parsePricePaste('SP-01\t9', '.').rows)
    expect(r.matched).toEqual([])
    expect(r.ambiguous).toEqual([
      { line: 1, product_code: 'SP-01', order_codes: ['DH-1', 'DH-2'] },
    ])
  })

  it('bỏ qua hoa/thường và khoảng trắng khi so mã', () => {
    const r = matchPasteRows(targets, parsePricePaste(' dh-1 \t sp-02 \t7', '.').rows)
    expect(r.matched).toEqual([{ line_id: 'l2', price: 7, from_line: 1 }])
  })

  it('mã không tồn tại → unmatched, giữ nguyên mã người dán để đối chiếu', () => {
    const r = matchPasteRows(targets, parsePricePaste('SP-99\t7', '.').rows)
    expect(r.unmatched).toEqual([{ line: 1, product_code: 'SP-99', order_code: null }])
  })

  it('mã đơn sai nhưng mã SP đúng → unmatched, KHÔNG rơi về khớp theo SP', () => {
    const r = matchPasteRows(targets, parsePricePaste('DH-9\tSP-02\t7', '.').rows)
    expect(r.matched).toEqual([])
    expect(r.unmatched).toEqual([{ line: 1, product_code: 'SP-02', order_code: 'DH-9' }])
  })
})

/**
 * File dán vào là BÁO GIÁ CỦA KHÁCH, và khách ghi mã của họ. Đo 11/09/2026:
 * 78/101 sản phẩm trên đơn đang có mã khách — không khớp theo mã này thì dán
 * file MERXX vào trượt gần hết.
 */
describe('matchPasteRows — khớp theo MÃ KHÁCH', () => {
  const T = (
    line_id: string,
    order_code: string,
    product_code: string,
    customer_code?: string | null,
  ): MatchTarget => ({ line_id, order_code, product_code, customer_code })
  const targets = [
    T('l1', 'DH-1', 'CH0170HG-AL', '22010-307'),
    T('l2', 'DH-1', 'CH0171HG-AL', '22060-210'),
    T('l3', 'DH-2', 'CH0172HG-AL', null), // chưa khai mã khách
  ]

  it('dán mã khách → khớp đúng dòng', () => {
    const r = matchPasteRows(targets, parsePricePaste('22060-210\t29.59', '.').rows)
    expect(r.matched).toEqual([{ line_id: 'l2', price: 29.59, from_line: 1 }])
  })

  it('mã đơn + mã khách → khớp đúng cặp', () => {
    const r = matchPasteRows(targets, parsePricePaste('DH-1\t22010-307\t24.4', '.').rows)
    expect(r.matched).toEqual([{ line_id: 'l1', price: 24.4, from_line: 1 }])
  })

  it('vẫn khớp mã HG như cũ — thêm đường mới không phá đường cũ', () => {
    const r = matchPasteRows(targets, parsePricePaste('CH0172HG-AL\t5', '.').rows)
    expect(r.matched).toEqual([{ line_id: 'l3', price: 5, from_line: 1 }])
  })

  /**
   * Một chuỗi vừa là mã HG của SP này vừa là mã khách của SP khác. Luật phải là
   * MỘT CÂU giải thích được: mã của MÌNH thắng. Dò song song rồi lấy cái khớp
   * trước là hành vi đổi theo thứ tự dữ liệu.
   */
  it('mã trùng giữa hai hệ mã → mã HG thắng', () => {
    const clash = [T('a', 'DH-1', 'X-9', 'Z-1'), T('b', 'DH-1', 'Y-1', 'X-9')]
    const r = matchPasteRows(clash, parsePricePaste('X-9\t3', '.').rows)
    expect(r.matched).toEqual([{ line_id: 'a', price: 3, from_line: 1 }])
  })

  it('một mã khách nằm ở hai đơn → AMBIGUOUS, không đoán', () => {
    const dup = [T('a', 'DH-1', 'HG-1', 'K-9'), T('b', 'DH-2', 'HG-2', 'K-9')]
    const r = matchPasteRows(dup, parsePricePaste('K-9\t3', '.').rows)
    expect(r.matched).toEqual([])
    expect(r.ambiguous).toEqual([
      { line: 1, product_code: 'K-9', order_codes: ['DH-1', 'DH-2'] },
    ])
  })

  /** Hai SP HG khác nhau gộp về một mã khách TRONG CÙNG MỘT ĐƠN: mã đơn không gỡ được. */
  it('một mã khách nằm ở hai dòng CÙNG đơn → vẫn AMBIGUOUS dù có mã đơn', () => {
    const dup = [T('a', 'DH-1', 'HG-1', 'K-9'), T('b', 'DH-1', 'HG-2', 'K-9')]
    const r = matchPasteRows(dup, parsePricePaste('DH-1\tK-9\t3', '.').rows)
    expect(r.matched).toEqual([])
    expect(r.ambiguous).toEqual([{ line: 1, product_code: 'K-9', order_codes: ['DH-1'] }])
  })

  it('SP chưa khai mã khách không sinh khoá rỗng', () => {
    const r = matchPasteRows(targets, parsePricePaste('\t7', '.').rows)
    expect(r.matched).toEqual([])
  })
})
