import { describe, expect, it } from 'vitest'
import {
  bucketBalance,
  daysBetween,
  hasDraft,
  shortOf,
  summarise,
  urgencyOf,
  type BalanceRow,
} from './balance.calc'

/**
 * Test CANH PHÉP TRỪ của sổ cân đối.
 *
 * Bắt buộc có vì đây là số đi vào quyết định CHI TIỀN: sai một chiều thì mua
 * thiếu và dừng sản xuất, sai chiều kia thì mua thừa và chôn vốn. Cả hai đều
 * không lộ ra ngay — người dùng chỉ thấy khi hàng đã về hoặc đã hết.
 */

const row = (p: Partial<BalanceRow> = {}): BalanceRow => ({
  material_code: 'CN1527',
  material_name: 'Vít dù 4x12',
  unit: 'Con',
  qty_needed: 100,
  qty_on_hand: 0,
  qty_incoming: 0,
  qty_drafted: 0,
  qty_short: 100,
  need_by: '2026-09-20',
  lsx_count: 1,
  lsx_codes: ['01/26-27'],
  ...p,
})

describe('shortOf — công thức còn thiếu', () => {
  it('trừ tồn và hàng đã cam kết', () => {
    expect(shortOf(100, 30, 20)).toBe(50)
  })

  it('kẹp sàn 0 khi mua dư — không có "thiếu âm"', () => {
    expect(shortOf(100, 80, 40)).toBe(0)
  })

  it('KHÔNG trừ hàng mới nằm trên đơn nháp', () => {
    // Người gọi truyền qty_incoming, KHÔNG truyền qty_drafted. Đây là luật
    // nghiệp vụ, không phải chi tiết cài đặt: đơn nháp chưa ai duyệt thì hàng
    // chưa chắc về. Đo 09/09/2026 có 345.210 đơn vị ở tình trạng đó.
    const r = row({ qty_needed: 100, qty_on_hand: 0, qty_incoming: 0, qty_drafted: 90 })
    expect(shortOf(r.qty_needed, r.qty_on_hand, r.qty_incoming)).toBe(100)
  })

  it('khớp đúng con số view SQL trả về cho dòng thật', () => {
    // CN1527 đo trên CSDL 09/09/2026: cần 149.600, tồn 0, cam kết 0.
    expect(shortOf(149_600, 0, 0)).toBe(149_600)
  })
})

describe('urgencyOf — bốn bậc gấp', () => {
  const today = '2026-09-09'

  it('quá hạn là "late"', () => {
    expect(urgencyOf('2026-09-07', today)).toBe('late')
  })

  it('đúng hôm nay chưa phải trễ', () => {
    expect(urgencyOf('2026-09-09', today)).toBe('soon')
  })

  it('trong 7 ngày là "soon", biên 7 vẫn tính là soon', () => {
    expect(urgencyOf('2026-09-16', today)).toBe('soon')
    expect(urgencyOf('2026-09-17', today)).toBe('later')
  })

  it('KHÔNG có hạn là bậc riêng, không gộp vào "later"', () => {
    // 37% dòng lệnh chưa có ship_date. Gộp vào "sắp tới" là nói dối — hệ thống
    // không biết chúng gấp hay không.
    expect(urgencyOf(null, today)).toBe('nodate')
  })
})

describe('daysBetween', () => {
  it('âm khi mốc đã qua', () => {
    expect(daysBetween('2026-09-09', '2026-09-07')).toBe(-2)
  })

  it('không lệch khi vắt qua tháng', () => {
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1)
  })
})

describe('bucketBalance', () => {
  const today = '2026-09-09'

  it('bỏ dòng đã đủ — mã không thiếu không phải việc hôm nay', () => {
    const b = bucketBalance([row({ qty_short: 0 })], today)
    expect(b.late.length + b.soon.length + b.later.length + b.nodate.length).toBe(0)
  })

  it('chia đúng bốn rổ', () => {
    const b = bucketBalance(
      [
        row({ material_code: 'A', need_by: '2026-09-01' }),
        row({ material_code: 'B', need_by: '2026-09-12' }),
        row({ material_code: 'C', need_by: '2026-12-01' }),
        row({ material_code: 'D', need_by: null }),
      ],
      today,
    )
    expect(b.late.map((r) => r.material_code)).toEqual(['A'])
    expect(b.soon.map((r) => r.material_code)).toEqual(['B'])
    expect(b.later.map((r) => r.material_code)).toEqual(['C'])
    expect(b.nodate.map((r) => r.material_code)).toEqual(['D'])
  })

  it('trong một rổ: hạn sớm trước, cùng hạn thì thiếu nhiều trước', () => {
    const b = bucketBalance(
      [
        row({ material_code: 'X', need_by: '2026-09-05', qty_short: 10 }),
        row({ material_code: 'Y', need_by: '2026-09-01', qty_short: 10 }),
        row({ material_code: 'Z', need_by: '2026-09-05', qty_short: 999 }),
      ],
      today,
    )
    expect(b.late.map((r) => r.material_code)).toEqual(['Y', 'Z', 'X'])
  })
})

describe('summarise — con số lên badge nav', () => {
  const today = '2026-09-09'

  it('tổng bằng đúng số dòng còn thiếu, không đếm dòng đã đủ', () => {
    // "Badge nói 5 mà mở ra thấy 7 là hỏng niềm tin vào cả sidebar" —
    // nguyên tắc đã ghi ở nav-badges.ts. Đếm bằng đúng hàm mà màn dùng.
    const s = summarise(
      [
        row({ material_code: 'A', need_by: '2026-09-01' }),
        row({ material_code: 'B', need_by: null }),
        row({ material_code: 'C', qty_short: 0 }),
      ],
      today,
    )
    expect(s.total).toBe(2)
    expect(s.late).toBe(1)
    expect(s.nodate).toBe(1)
  })

  it('đếm riêng số mã đã có nháp — để cảnh báo gõ trùng', () => {
    const s = summarise(
      [
        row({ material_code: 'A', qty_drafted: 500 }),
        row({ material_code: 'B', qty_drafted: 0 }),
        // Dòng đã đủ thì không đếm, dù có nháp.
        row({ material_code: 'C', qty_short: 0, qty_drafted: 900 }),
      ],
      today,
    )
    expect(s.drafted).toBe(1)
  })
})

describe('hasDraft', () => {
  it('nhận ra mã đã có người gõ vào đơn nháp', () => {
    expect(hasDraft(row({ qty_drafted: 8430 }))).toBe(true)
    expect(hasDraft(row({ qty_drafted: 0 }))).toBe(false)
  })
})
