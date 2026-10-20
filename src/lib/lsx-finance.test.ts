import { describe, expect, it } from 'vitest'
import { rollupByLsx, rollupCross, totalOf, type LsxFinanceRow } from './lsx-finance'
import { threeWayMatch, type MatchPoLine } from './three-way-match'

/** Ca cũ đều MỘT tiền tệ — map luôn trả 'VND' để khỏi lặp ở từng ca. */
const VND: Map<string, string> = {
  get: () => 'VND',
} as unknown as Map<string, string>

const L = (id: string, qty: number, price: number): MatchPoLine => ({
  id,
  material_code: id,
  material_name: `VT ${id}`,
  unit: 'cái',
  qty_ordered: qty,
  unit_price: price,
})

describe('rollupByLsx — gộp tiền lên trục lệnh', () => {
  it('cộng đúng ba vế và suy ra hai khoản chênh', () => {
    const rows = threeWayMatch(
      [L('a', 10, 100), L('b', 5, 200)],
      [
        { po_line_id: 'a', direction: 'in', qty: 10, unit_cost: 100 },
        { po_line_id: 'b', direction: 'in', qty: 2, unit_cost: 200 },
      ],
      [
        { po_line_id: 'a', invoice_id: 'i1', invoice_no: 'HD1', qty: 10, unit_price: 100, amount: 1000 }, // prettier-ignore
      ],
    )
    const m = rollupByLsx(rows, new Map([['a', 'LSX1'], ['b', 'LSX1']]), VND) // prettier-ignore
    const v = m.get('LSX1')!.get('VND')!
    expect(v.committed).toBe(2000) // 10×100 + 5×200
    expect(v.received).toBe(1400) // 1000 + 400
    expect(v.invoiced).toBe(1000)
    expect(v.not_received).toBe(600) // 2000 − 1400
    expect(v.awaiting_invoice).toBe(400) // 1400 − 1000
    expect(v.line_count).toBe(2)
  })

  it('tách đúng khi một đơn mua chia cho hai lệnh', () => {
    const rows = threeWayMatch([L('a', 10, 100), L('b', 10, 100)], [], [])
    const m = rollupByLsx(rows, new Map([['a', 'LSX1'], ['b', 'LSX2']]), VND) // prettier-ignore
    expect(m.get('LSX1')!.get('VND')!.committed).toBe(1000)
    expect(m.get('LSX2')!.get('VND')!.committed).toBe(1000)
  })

  /**
   * Dòng mua bù tồn không thuộc lệnh nào. Gom chúng vào một rổ "không lệnh" thì
   * tổng của màn không còn khớp tổng của bất kỳ lệnh nào — bỏ hẳn thì rõ ràng.
   */
  it('bỏ qua dòng KHÔNG thuộc lệnh nào, không dựng rổ rác', () => {
    const rows = threeWayMatch([L('a', 10, 100), L('b', 10, 100)], [], [])
    const m = rollupByLsx(rows, new Map([['a', 'LSX1'], ['b', null]]), VND) // prettier-ignore
    expect([...m.keys()]).toEqual(['LSX1'])
    expect(m.get('LSX1')!.get('VND')!.committed).toBe(1000)
  })

  it('hàng về DƯ thì "còn phải về" là 0, không phải số âm', () => {
    const rows = threeWayMatch(
      [L('a', 10, 100)],
      [{ po_line_id: 'a', direction: 'in', qty: 12, unit_cost: 100 }],
      [],
    )
    const v = rollupByLsx(rows, new Map([['a', 'LSX1']]), VND).get('LSX1')!.get('VND')!
    expect(v.received).toBe(1200)
    expect(v.not_received).toBe(0)
  })

  it('đếm dòng LỆCH để màn biết chỗ nào cần người nhìn vào', () => {
    const rows = threeWayMatch(
      [L('a', 10, 100), L('b', 10, 100), L('c', 10, 100)],
      [
        { po_line_id: 'a', direction: 'in', qty: 10, unit_cost: 100 },
        { po_line_id: 'b', direction: 'in', qty: 10, unit_cost: 100 },
      ],
      [
        // a: khớp
        { po_line_id: 'a', invoice_id: 'i', invoice_no: 'H', qty: 10, unit_price: 100, amount: 1000 }, // prettier-ignore
        // b: lệch giá · c: đòi trước (chưa về)
        { po_line_id: 'b', invoice_id: 'i', invoice_no: 'H', qty: 10, unit_price: 120, amount: 1200 }, // prettier-ignore
        { po_line_id: 'c', invoice_id: 'i', invoice_no: 'H', qty: 10, unit_price: 100, amount: 1000 }, // prettier-ignore
      ],
    )
    const v = rollupByLsx(rows, new Map([['a', 'X'], ['b', 'X'], ['c', 'X']]), VND).get('X')!.get('VND')! // prettier-ignore
    expect(v.issue_count).toBe(2)
  })
})

describe('totalOf — dải đầu trang', () => {
  const row = (o: Partial<LsxFinanceRow>): LsxFinanceRow => ({
    lsx_id: 'x',
    committed: 0,
    confirmed: 0,
    draft: 0,
    received: 0,
    invoiced: 0,
    not_received: 0,
    awaiting_invoice: 0,
    line_count: 0,
    issue_count: 0,
    revenue: null,
    ...o,
  })

  it('cộng từ hàng ĐÃ GỘP, ra đúng tổng', () => {
    const t = totalOf([
      row({ committed: 1000, received: 600, not_received: 400, line_count: 2 }),
      row({ committed: 500, received: 500, awaiting_invoice: 500, line_count: 1 }),
    ])
    expect(t.committed).toBe(1500)
    expect(t.received).toBe(1100)
    expect(t.not_received).toBe(400)
    expect(t.awaiting_invoice).toBe(500)
    expect(t.lsx_count).toBe(2)
    expect(t.line_count).toBe(3)
  })

  it('không lệnh nào thì mọi số bằng 0, không NaN', () => {
    const t = totalOf([])
    expect(t.committed).toBe(0)
    expect(t.lsx_count).toBe(0)
  })
})

describe('doanh thu là null, KHÔNG phải 0', () => {
  it('null đọc ra "chưa có nguồn"; 0 đọc ra "bán không thu được đồng nào"', () => {
    const t = totalOf([])
    // Kiểu của `revenue` buộc phải chứa null — đây là ca canh ý đồ đó.
    const r: LsxFinanceRow['revenue'] = null
    expect(r).toBeNull()
    expect(t.committed).toBe(0)
  })
})

describe('TIỀN TỆ — USD và VND không bao giờ cộng lẫn', () => {
  /**
   * CA CANH LỖI THẬT. Đo 11/09/2026: 6 lệnh mang cả đơn VND lẫn đơn USD, nặng
   * nhất `01/26-27 - MX` = 218.500.000 VND + 174.369,48 USD. Bản đầu gộp một
   * cục nên ngầm khai 1 USD = 1 VND — con số ra trông vẫn bình thường, nên
   * không ai bắt được bằng mắt.
   */
  it('một lệnh có CẢ HAI tiền tệ thì ra hai rổ, không cộng vào nhau', () => {
    const rows = threeWayMatch([L('v', 1, 218_500_000), L('u', 1, 174_369.48)], [], [])
    const m = rollupByLsx(
      rows,
      new Map([['v', 'LSX1'], ['u', 'LSX1']]), // prettier-ignore
      new Map([['v', 'VND'], ['u', 'USD']]), // prettier-ignore
    )
    const per = m.get('LSX1')!
    expect([...per.keys()].sort()).toEqual(['USD', 'VND'])
    expect(per.get('VND')!.committed).toBe(218_500_000)
    expect(per.get('USD')!.committed).toBe(174_369.48)
    expect([...per.values()].some((v) => v.committed > 218_500_001)).toBe(false)
  })

  it('dòng không khai tiền tệ rơi về VND, không rơi vào rổ rỗng', () => {
    const rows = threeWayMatch([L('a', 1, 100)], [], [])
    const m = rollupByLsx(rows, new Map([['a', 'L']]), new Map())
    expect(m.get('L')!.get('VND')!.committed).toBe(100)
  })
})

describe('làm tròn — theo DÒNG, không theo tổng', () => {
  /**
   * Đo thật trên `01/26-27 - MX` (36 dòng USD): cộng thô ra 174.369,482 còn
   * làm tròn từng dòng ra 174.369,50. Lấy số thứ hai vì tiền từng dòng là số
   * IN RA GIẤY — tổng phải bằng tổng các dòng đã in.
   */
  it('tổng bằng tổng các dòng ĐÃ làm tròn, không phải tổng thô', () => {
    // 3 dòng, mỗi dòng lẻ 1/3 xu: thô = 30,000 · theo dòng = 30,01
    const rows = threeWayMatch(
      [L('a', 1, 10.004), L('b', 1, 10.004), L('c', 1, 10.004)],
      [],
      [],
    )
    const v = rollupByLsx(rows, new Map([['a', 'L'], ['b', 'L'], ['c', 'L']]), VND).get('L')!.get('VND')! // prettier-ignore
    expect(v.committed).toBe(30)
    // Từng dòng đã là 10 (10,004 → 10,00), nên tổng đúng bằng 3 × 10.
    expect(rows.every((r) => r.amount_ordered === 10)).toBe(true)
  })
})

describe('"đã xác nhận" tách khỏi "đã cam kết"', () => {
  /**
   * Đơn còn nháp là Ý ĐỊNH của người mua — NCC chưa biết gì. Đơn NCC đã xác
   * nhận là cam kết hai chiều. Gộp một cục thì Giám đốc không phân biệt được
   * "đang tính mua" với "đã trót hứa".
   */
  it('chỉ dòng thuộc đơn ĐÃ XÁC NHẬN mới vào vế confirmed', () => {
    const rows = threeWayMatch([L('a', 10, 100), L('b', 10, 100)], [], [])
    const v = rollupByLsx(
      rows,
      new Map([['a', 'L'], ['b', 'L']]), // prettier-ignore
      VND,
      new Set(['a']),
    ).get('L')!.get('VND')!
    expect(v.committed).toBe(2000) // cả hai dòng
    expect(v.confirmed).toBe(1000) // chỉ dòng 'a'
  })

  it('không truyền tập xác nhận thì confirmed = 0, KHÔNG bằng committed', () => {
    const rows = threeWayMatch([L('a', 10, 100)], [], [])
    const v = rollupByLsx(rows, new Map([['a', 'L']]), VND).get('L')!.get('VND')!
    expect(v.committed).toBe(1000)
    expect(v.confirmed).toBe(0)
  })

  it('tổng cộng đúng cả hai vế', () => {
    const rows = threeWayMatch([L('a', 1, 100), L('b', 1, 300)], [], [])
    const m = rollupByLsx(rows, new Map([['a', 'X'], ['b', 'Y']]), VND, new Set(['b'])) // prettier-ignore
    const t = totalOf([
      { lsx_id: 'X', revenue: null, ...m.get('X')!.get('VND')! },
      { lsx_id: 'Y', revenue: null, ...m.get('Y')!.get('VND')! },
    ])
    expect(t.committed).toBe(400)
    expect(t.confirmed).toBe(300)
  })
})

describe('đơn NHÁP vẫn tính vào cam kết, nhưng bày riêng', () => {
  /**
   * "Đã cam kết 5,6 tỷ" mà 97% còn nằm ở đơn nháp là thông tin HOÀN TOÀN KHÁC
   * với 5,6 tỷ đã gửi nhà cung cấp. Tính vào — nhưng phải nói ra bao nhiêu.
   */
  it('nháp nằm TRONG committed, đồng thời đếm riêng ở draft', () => {
    const rows = threeWayMatch([L('a', 1, 900), L('b', 1, 100)], [], [])
    const v = rollupByLsx(
      rows,
      new Map([['a', 'L'], ['b', 'L']]), // prettier-ignore
      VND,
      new Set(['b']), // b đã xác nhận
      new Set(['a']), // a còn nháp
    ).get('L')!.get('VND')!
    expect(v.committed).toBe(1000) // GỒM cả nháp
    expect(v.draft).toBe(900)
    expect(v.confirmed).toBe(100)
  })
})

describe('rollupCross — bảng chéo LỆNH × NCC', () => {
  /**
   * Nợ thuộc về NCC, chi phí thuộc về LỆNH — hai trục trên cùng một giao dịch.
   * Đo 11/09/2026: 11 lệnh mua từ nhiều NCC (cao nhất 10), 12 NCC phục vụ nhiều
   * lệnh (cao nhất 6). Thiếu bảng chéo thì mỗi bên chỉ nhìn được một nửa.
   */
  it('một lệnh mua từ hai NCC ra HAI ô, không gộp', () => {
    const rows = threeWayMatch([L('a', 1, 700), L('b', 1, 300)], [], [])
    const cross = rollupCross(
      rows,
      new Map([['a', 'LSX1'], ['b', 'LSX1']]), // prettier-ignore
      new Map([['a', 'NCC1'], ['b', 'NCC2']]), // prettier-ignore
      VND,
    )
    expect(cross).toHaveLength(2)
    expect(cross[0]).toMatchObject({ lsx_id: 'LSX1', supplier_id: 'NCC1', committed: 700 }) // prettier-ignore
    expect(cross[1]).toMatchObject({ lsx_id: 'LSX1', supplier_id: 'NCC2', committed: 300 }) // prettier-ignore
  })

  it('một NCC phục vụ hai lệnh cũng ra hai ô — đọc được cả chiều ngược', () => {
    const rows = threeWayMatch([L('a', 1, 100), L('b', 1, 200)], [], [])
    const cross = rollupCross(
      rows,
      new Map([['a', 'LSX1'], ['b', 'LSX2']]), // prettier-ignore
      new Map([['a', 'NCC1'], ['b', 'NCC1']]), // prettier-ignore
      VND,
    )
    expect(cross.filter((c) => c.supplier_id === 'NCC1')).toHaveLength(2)
    expect(cross.map((c) => c.lsx_id).sort()).toEqual(['LSX1', 'LSX2'])
  })

  it('tách theo tiền tệ trong cùng một cặp lệnh × NCC', () => {
    const rows = threeWayMatch([L('v', 1, 1_000_000), L('u', 1, 40)], [], [])
    const cross = rollupCross(
      rows,
      new Map([['v', 'L'], ['u', 'L']]), // prettier-ignore
      new Map([['v', 'S'], ['u', 'S']]), // prettier-ignore
      new Map([['v', 'VND'], ['u', 'USD']]), // prettier-ignore
    )
    expect(cross).toHaveLength(2)
    expect(cross.map((c) => c.currency).sort()).toEqual(['USD', 'VND'])
  })

  it('bỏ dòng thiếu lệnh HOẶC thiếu NCC — ô không đọc được theo chiều nào', () => {
    const rows = threeWayMatch([L('a', 1, 100), L('b', 1, 100), L('c', 1, 100)], [], []) // prettier-ignore
    const cross = rollupCross(
      rows,
      new Map([['a', 'L'], ['b', null], ['c', 'L']]), // prettier-ignore
      new Map([['a', 'S'], ['b', 'S']]), // c thiếu NCC
      VND,
    )
    expect(cross).toHaveLength(1)
    expect(cross[0].lsx_id).toBe('L')
  })

  it('tổng bảng chéo KHỚP tổng theo lệnh — cùng một lõi cộng tiền', () => {
    const rows = threeWayMatch([L('a', 1, 700), L('b', 1, 300)], [], [])
    const lsxOf = new Map([['a', 'L'], ['b', 'L']]) // prettier-ignore
    const supOf = new Map([['a', 'S1'], ['b', 'S2']]) // prettier-ignore
    const cross = rollupCross(rows, lsxOf, supOf, VND)
    const byLsx = rollupByLsx(rows, lsxOf, VND).get('L')!.get('VND')!
    expect(cross.reduce((s, c) => s + c.committed, 0)).toBe(byLsx.committed)
  })

  it('xếp ô tiền lớn nhất lên đầu', () => {
    const rows = threeWayMatch([L('a', 1, 100), L('b', 1, 900)], [], [])
    const cross = rollupCross(
      rows,
      new Map([['a', 'L'], ['b', 'L']]), // prettier-ignore
      new Map([['a', 'S1'], ['b', 'S2']]), // prettier-ignore
      VND,
    )
    expect(cross[0].committed).toBe(900)
  })
})
