import { describe, expect, it } from 'vitest'
import {
  dueDate,
  formatTermSetting,
  guessTerm,
  overdueDays,
  parseTermSetting,
  resolveTerm,
  termLabel,
} from './payment-terms'

/**
 * Các câu dưới đây là CÂU THẬT đang nằm trên đơn mua của HG (đo 11/09/2026),
 * không phải ví dụ bịa. Đó là lý do bộ test này đáng tin: nó đọc đúng thứ dữ
 * liệu mà màn hình sẽ gặp.
 */
describe('guessTerm — đọc câu THẬT trên đơn', () => {
  it('CUỐI THÁNG là một gốc tính hạn riêng, không phải N ngày', () => {
    expect(guessTerm('Thanh toán công nợ cuối tháng')).toMatchObject({
      term: { basis: 'eom', days: 0 },
      confident: true,
    })
    expect(guessTerm('Công nợ cuối tháng.')).toMatchObject({
      term: { basis: 'eom', days: 0 },
    })
  })

  /** "cuối tháng sau 15 ngày" có CẢ hai dấu hiệu — cuối tháng phải thắng. */
  it('cuối tháng + N ngày: xét cuối tháng TRƯỚC số ngày', () => {
    expect(guessTerm('Công nợ cuối tháng sau 15 ngày')).toMatchObject({
      term: { basis: 'eom', days: 15 },
    })
  })

  it('N ngày thường', () => {
    expect(guessTerm('Công nợ 30 ngày.')).toMatchObject({
      term: { basis: 'net', days: 30 },
      confident: true,
    })
    expect(guessTerm('Nhận hàng thanh toán trong vòng 15 ngày.')).toMatchObject({
      term: { basis: 'net', days: 15 },
      confident: true,
    })
    expect(guessTerm('NET 30')).toMatchObject({ term: { basis: 'net', days: 30 } })
  })

  /**
   * "30-60 ngày" lấy mốc XA. Giục theo mốc gần là đòi tiền sớm hơn thoả thuận —
   * hỏng quan hệ NCC, và người đọc sổ không biết vì sao mình bị giục.
   */
  it('KHOẢNG ngày → lấy mốc xa, và không chắc', () => {
    const g = guessTerm('Công nợ 30-60 ngày')
    expect(g.term).toEqual({ basis: 'net', days: 60 })
    expect(g.confident).toBe(false)
    expect(g.why).toContain('mốc xa')
  })

  it('câu NHIỀU VẾ vẫn ra số nhưng KHÔNG chắc', () => {
    expect(
      guessTerm('Cọc 30%, xác nhận đơn đặt hàng. SL còn lại thanh toán trong vòng 30 ngày'), // prettier-ignore
    ).toMatchObject({ term: { basis: 'net', days: 30 }, confident: false })
    expect(
      guessTerm('Tạm ứng 50% sau khi đặt hàng, thanh toán phần còn lại khi giao đủ'),
    ).toMatchObject({ confident: false })
  })

  /** Xét SAU số ngày, nếu không sẽ nuốt mất "nhận hàng thanh toán trong vòng 15 ngày". */
  it('trả ngay / trả trước — không được nuốt mất câu có số', () => {
    expect(guessTerm('Nhận hàng thanh toán')).toMatchObject({
      term: { basis: 'net', days: 0 },
    })
    expect(guessTerm('Thanh toán trước khi nhận hàng')).toMatchObject({
      term: { basis: 'net', days: 0 },
    })
    expect(guessTerm('COD')).toMatchObject({ term: { basis: 'net', days: 0 } })
    // vẫn phải ra 15, không phải 0
    expect(guessTerm('Nhận hàng thanh toán trong vòng 15 ngày.')?.term?.days).toBe(15)
  })

  it('không đọc nổi → null, KHÔNG bịa số', () => {
    expect(guessTerm('TTR — đặt cọc 20%, 80% còn lại khi nhận bản sao vận đơn gốc').term).toBeNull() // prettier-ignore
    expect(guessTerm('theo thoả thuận').term).toBeNull()
    expect(guessTerm('').term).toBeNull()
    expect(guessTerm(null).term).toBeNull()
  })
})

describe('resolveTerm — chuỗi thừa kế ĐƠN → NCC → MẶC ĐỊNH', () => {
  const macDinh = { basis: 'net' as const, days: 30 }

  it('đơn nói rõ thì đơn thắng', () => {
    const r = resolveTerm({
      poTerms: 'Công nợ 45 ngày',
      supplierDays: 20,
      companyDefault: macDinh,
    })
    expect(r.term).toEqual({ basis: 'net', days: 45 })
    expect(r.source).toBe('don')
  })

  /**
   * Câu mơ hồ KHÔNG được áp thẳng — rơi xuống tầng dưới. Áp một con số đoán mò
   * là giục NCC theo hạn chưa ai thoả thuận.
   */
  it('đơn ghi mơ hồ → rơi xuống hồ sơ NCC, không đoán bừa', () => {
    const r = resolveTerm({
      poTerms: 'Cọc 30%, còn lại thanh toán trong vòng 30 ngày',
      supplierDays: 20,
      companyDefault: macDinh,
    })
    expect(r.term).toEqual({ basis: 'net', days: 20 })
    expect(r.source).toBe('ncc')
  })

  it('không có đơn, không có NCC → mặc định công ty', () => {
    const r = resolveTerm({ companyDefault: macDinh })
    expect(r.term).toEqual(macDinh)
    expect(r.source).toBe('mac_dinh')
  })

  /** Đây là điểm mấu chốt: khai MỘT mặc định là mọi khoản nợ đều có hạn. */
  it('có mặc định công ty thì KHÔNG khoản nào rơi ra ngoài', () => {
    for (const poTerms of [null, '', 'theo thoả thuận', 'TTR đặt cọc 20%']) {
      expect(resolveTerm({ poTerms, companyDefault: macDinh }).term).not.toBeNull()
    }
  })

  it('không tầng nào có → nói RÕ chưa có hạn, kèm câu gốc để đọc tay', () => {
    const r = resolveTerm({ poTerms: 'Cọc 40% theo từng đợt lấy hàng' })
    expect(r.term).toBeNull()
    expect(r.source).toBe('khong_co')
    expect(r.why).toContain('đọc tay')
  })
})

describe('dueDate', () => {
  it('net: cộng ngày, qua tháng và qua năm', () => {
    expect(dueDate('2026-09-11', { basis: 'net', days: 30 })).toBe('2026-10-11')
    expect(dueDate('2026-12-20', { basis: 'net', days: 30 })).toBe('2027-01-19')
    expect(dueDate('2026-09-11', { basis: 'net', days: 0 })).toBe('2026-09-11')
  })

  it('eom: ra đúng ngày cuối tháng, kể cả tháng 2 nhuận', () => {
    expect(dueDate('2026-09-11', { basis: 'eom', days: 0 })).toBe('2026-09-30')
    expect(dueDate('2026-02-03', { basis: 'eom', days: 0 })).toBe('2026-02-28')
    expect(dueDate('2024-02-03', { basis: 'eom', days: 0 })).toBe('2024-02-29')
    expect(dueDate('2026-12-01', { basis: 'eom', days: 0 })).toBe('2026-12-31')
  })

  it('eom + N ngày: cuối tháng RỒI mới cộng', () => {
    expect(dueDate('2026-09-11', { basis: 'eom', days: 15 })).toBe('2026-10-15')
  })

  /**
   * Ép "cuối tháng" về net-days sai tới gần một tháng. Nhận hàng 01/09: cuối
   * tháng là 30/09, còn "30 ngày" là 01/10 — hai hạn khác nhau.
   */
  it('eom KHÁC net — không được ép về nhau', () => {
    expect(dueDate('2026-09-01', { basis: 'eom', days: 0 })).toBe('2026-09-30')
    expect(dueDate('2026-09-01', { basis: 'net', days: 30 })).toBe('2026-10-01')
  })

  it('không có điều khoản → null, KHÔNG rơi về hôm nay', () => {
    expect(dueDate('2026-09-11', null)).toBeNull()
  })

  it('ngày gốc hỏng → null chứ không Invalid Date', () => {
    expect(dueDate('khong-phai-ngay', { basis: 'net', days: 30 })).toBeNull()
  })
})

describe('overdueDays', () => {
  it('dương = quá hạn, âm = chưa tới, 0 = đúng hôm nay', () => {
    expect(overdueDays('2026-09-01', '2026-09-11')).toBe(10)
    expect(overdueDays('2026-09-20', '2026-09-11')).toBe(-9)
    expect(overdueDays('2026-09-11', '2026-09-11')).toBe(0)
  })

  it('không có hạn → null, KHÔNG phải "chưa tới hạn"', () => {
    expect(overdueDays(null, '2026-09-11')).toBeNull()
  })
})

describe('termLabel & setting', () => {
  it('nói rõ từng loại, không nhập nhằng', () => {
    expect(termLabel(null)).toBe('chưa có hạn')
    expect(termLabel({ basis: 'net', days: 0 })).toBe('trả ngay')
    expect(termLabel({ basis: 'net', days: 30 })).toBe('30 ngày')
    expect(termLabel({ basis: 'eom', days: 0 })).toBe('cuối tháng')
    expect(termLabel({ basis: 'eom', days: 15 })).toBe('cuối tháng + 15 ngày')
  })

  it('đọc/ghi mặc định công ty đi vòng tròn', () => {
    for (const t of [
      { basis: 'net' as const, days: 30 },
      { basis: 'eom' as const, days: 0 },
    ]) {
      expect(parseTermSetting(formatTermSetting(t))).toEqual(t)
    }
    expect(parseTermSetting('bậy')).toBeNull()
    expect(parseTermSetting(null)).toBeNull()
    expect(parseTermSetting(30)).toBeNull()
  })
})
