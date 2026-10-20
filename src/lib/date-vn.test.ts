import { describe, expect, it } from 'vitest'
import { docEventAt, isoToVn, maskVnDate, todayVn, vnToIso } from './date-vn'

describe('isoToVn', () => {
  it('đổi ISO sang kiểu VN', () => {
    expect(isoToVn('2026-08-03')).toBe('03/08/2026')
  })
  it('bỏ qua phần giờ nếu có', () => {
    expect(isoToVn('2026-08-03T10:00:00Z')).toBe('03/08/2026')
  })
  it('rỗng/không đúng khuôn → chuỗi rỗng', () => {
    expect(isoToVn('')).toBe('')
    expect(isoToVn(null)).toBe('')
    expect(isoToVn('03/08/2026')).toBe('')
  })
})

describe('vnToIso', () => {
  it('đổi kiểu VN sang ISO', () => {
    expect(vnToIso('03/08/2026')).toBe('2026-08-03')
    expect(vnToIso('3/8/2026')).toBe('2026-08-03')
  })
  it('ngày không có thật → null', () => {
    expect(vnToIso('31/02/2026')).toBeNull()
    expect(vnToIso('31/04/2026')).toBeNull()
    expect(vnToIso('13/13/2026')).toBeNull()
  })
  it('29/02 chỉ đúng vào năm nhuận', () => {
    expect(vnToIso('29/02/2028')).toBe('2028-02-29')
    expect(vnToIso('29/02/2026')).toBeNull()
  })
  it('gõ dở → null, không nhảy giá trị dưới tay', () => {
    expect(vnToIso('03/08')).toBeNull()
    expect(vnToIso('')).toBeNull()
  })
})

describe('maskVnDate', () => {
  it('tự chèn dấu / khi gõ', () => {
    expect(maskVnDate('0')).toBe('0')
    expect(maskVnDate('03')).toBe('03')
    expect(maskVnDate('0308')).toBe('03/08')
    expect(maskVnDate('03082026')).toBe('03/08/2026')
  })
  it('giữ ranh giới người gõ chia — dấu nào cũng thành /', () => {
    expect(maskVnDate('3-8-2026')).toBe('3/8/2026')
    expect(maskVnDate('03.08.2026')).toBe('03/08/2026')
  })
  it('gõ dấu ngăn xong bỏ lửng thì giữ dấu', () => {
    expect(maskVnDate('03/')).toBe('03/')
    expect(maskVnDate('03/0')).toBe('03/0')
  })
  it('cắt phần thừa', () => {
    expect(maskVnDate('030820261')).toBe('03/08/2026')
  })

  /*
    GÕ TỪNG PHÍM (24/09/2026 — bắt được khi viết test cho DateInput B4). Các
    test trên đưa CẢ CHUỖI vào một lần, tức đường DÁN. Người gõ tay thì mỗi phím
    là một lượt: ô đã tự chèn "/" ở lượt trước, nên lượt sau nhận "03/082" —
    và bản cũ hiểu đó là người dùng TỰ chia hai đoạn, cắt đoạn hai còn 2 số,
    nuốt mất năm. Ô kẹt ở "03/08", gõ gì tiếp cũng không vào.
  */
  it('gõ liền từng phím vẫn ra đủ ngày — số tràn đoạn thì sang đoạn sau', () => {
    const go = (keys: string) => [...keys].reduce((s, k) => maskVnDate(s + k), '')
    expect(go('03082026')).toBe('03/08/2026')
    expect(go('24092026')).toBe('24/09/2026')
    // Tràn giữa chừng khi người dùng đã tự gõ một dấu ngăn.
    expect(maskVnDate('03/082')).toBe('03/08/2')
    // Ranh giới người dùng tự chia vẫn giữ.
    expect(go('3-8-2026')).toBe('3/8/2026')
  })
})

describe('todayVn — hôm nay theo giờ Việt Nam', () => {
  it('00:45 giờ VN vẫn là NGÀY HÔM ĐÓ, không lùi về hôm qua như UTC', () => {
    // 2026-09-14T17:45Z = 2026-09-15 00:45 giờ VN.
    const t = new Date('2026-09-14T17:45:00Z')
    expect(t.toISOString().slice(0, 10)).toBe('2026-09-14') // cái sai
    expect(todayVn(t)).toBe('2026-09-15') // cái đúng
  })

  it('16:59Z vẫn là hôm sau; 17:00Z là ranh giới', () => {
    expect(todayVn(new Date('2026-09-14T16:59:00Z'))).toBe('2026-09-14')
    expect(todayVn(new Date('2026-09-14T17:00:00Z'))).toBe('2026-09-15')
  })

  it('giữa trưa giờ VN thì trùng UTC, không đổi gì', () => {
    const t = new Date('2026-09-15T05:00:00Z') // 12:00 giờ VN
    expect(todayVn(t)).toBe(t.toISOString().slice(0, 10))
  })

  it('luôn ra dạng yyyy-mm-dd để so chuỗi được', () => {
    expect(todayVn(new Date('2026-01-02T00:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('docEventAt — mốc sự việc của phiếu kho', () => {
  it('nhập máy cùng ngày chứng từ (giờ VN) → giữ giờ ghi máy', () => {
    // 01:30Z = 08:30 giờ VN ngày 27/09
    expect(docEventAt('2026-09-27', '2026-09-27T01:30:00Z')).toBe('2026-09-27T01:30:00Z')
  })
  it('nhập máy lúc 00:30 giờ VN vẫn là CÙNG ngày dù UTC còn hôm trước', () => {
    expect(docEventAt('2026-09-27', '2026-09-26T17:30:00Z')).toBe('2026-09-26T17:30:00Z')
  })
  it('nhập máy trễ (hàng về 27/09, ghi 30/09) → ngày chứng từ', () => {
    expect(docEventAt('2026-09-27', '2026-09-30T08:00:00Z')).toBe('2026-09-27')
  })
  it('không có ngày chứng từ → giờ ghi máy', () => {
    expect(docEventAt(null, '2026-09-30T08:00:00Z')).toBe('2026-09-30T08:00:00Z')
  })
})
