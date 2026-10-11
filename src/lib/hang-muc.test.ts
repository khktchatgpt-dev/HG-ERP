import { describe, expect, it } from 'vitest'
import {
  canChuY,
  docTienDuToan,
  lenhCuaKhach,
  loiHangMuc,
  soHangMuc,
  thieuViec,
  type HangMucDon,
} from './hang-muc'

const don = (o: Partial<HangMucDon>): HangMucDon => ({
  status: 'ordered',
  currency: 'VND',
  gross: 0,
  received_net: 0,
  invoiced_gross: 0,
  paid: 0,
  overdue: false,
  ...o,
})

describe('soHangMuc — một nghĩa cho "đã tiêu bao nhiêu"', () => {
  it('nháp đếm riêng, huỷ bỏ qua, tiền khác không cộng', () => {
    const so = soHangMuc({ budget: 300_000_000, currency: 'VND' }, [
      don({ gross: 18_700_000, received_net: 17_000_000, invoiced_gross: 18_700_000, paid: 18_700_000 }), // prettier-ignore
      don({ gross: 71_500_000, received_net: 65_000_000, invoiced_gross: 41_300_000, paid: 21_300_000, overdue: true }), // prettier-ignore
      don({ status: 'draft', gross: 34_980_000 }),
      don({ status: 'cancelled', gross: 99_000_000 }),
      don({ currency: 'USD', gross: 1_000 }),
    ])
    expect(so).toMatchObject({
      n: 2,
      nhap: 1,
      nhap_gross: 34_980_000,
      ordered: 90_200_000,
      received_net: 82_000_000,
      invoiced_gross: 60_000_000,
      paid: 40_000_000,
      owed: 20_000_000,
      overdue: 1,
      khac_tien_te: 1,
      pct: 30,
      co_hoa_don: 2,
    })
  })

  it('không dự toán → pct null', () => {
    expect(
      soHangMuc({ budget: null, currency: 'VND' }, [don({ gross: 5 })]).pct,
    ).toBeNull()
  })
})

describe('canChuY', () => {
  const hm = { status: 'open', kind: 'Xây dựng', budget: 100, currency: 'VND' }
  const so = (ordered: number, overdue = 0) => ({
    ...soHangMuc({ budget: 100, currency: 'VND' }, []),
    ordered,
    pct: ordered,
    overdue,
  })
  it('vượt dự toán / từ 90% / quá hẹn / đã có lệnh', () => {
    expect(canChuY(hm, so(120, 1))).toEqual(['vượt dự toán 20', '1 đơn quá hẹn'])
    expect(canChuY(hm, so(92))).toEqual(['đã đặt 92% dự toán'])
    expect(canChuY(hm, so(50))).toEqual([])
    expect(canChuY(hm, so(10), ['09/26-27 - IBIZA'])).toEqual(['đã có lệnh 09/26-27 - IBIZA — đóng hạng mục?']) // prettier-ignore
  })
  it('hạng mục đã đóng thì không nhắc gì', () => {
    expect(canChuY({ ...hm, status: 'closed' }, so(500, 3))).toEqual([])
  })
})

describe('lenhCuaKhach', () => {
  const lenh = [
    { code: '05/26-27 - IBIZA', customer_name: 'IBIZA' },
    { code: '01/26-27 - MX', customer_name: 'MX' },
    { code: '02/26-27 - LAURA', customer_name: 'Laura' },
  ]
  it('chỉ hạng mục "Đơn khách chưa ra lệnh"; bỏ dấu, hoa thường; tên khách ngắn bỏ qua', () => {
    expect(lenhCuaKhach({ kind: 'Đơn khách chưa ra lệnh', name: 'Đơn khách Ibiza tháng 10' }, lenh)).toEqual(['05/26-27 - IBIZA']) // prettier-ignore
    expect(lenhCuaKhach({ kind: 'Đơn khách chưa ra lệnh', name: 'Đơn khách MX' }, lenh)).toEqual([]) // prettier-ignore
    expect(lenhCuaKhach({ kind: 'Khuôn mẫu', name: 'Khuôn Laura' }, lenh)).toEqual([])
  })
})

describe('luật hạng mục của đơn ngoài lệnh', () => {
  const open = { code: 'HM-2026-0001', status: 'open' }
  const closed = { code: 'HM-2026-0002', status: 'closed' }
  it('không tồn tại / đã đóng → lỗi; giữ nguyên hạng mục cũ đã đóng → hợp lệ', () => {
    expect(loiHangMuc(null, 'x')).toBe('Hạng mục không tồn tại')
    expect(loiHangMuc(open, 'a')).toBeNull()
    expect(loiHangMuc(closed, 'b')).toMatch(/HM-2026-0002 đã đóng/)
    expect(loiHangMuc(closed, 'b', 'b')).toBeNull()
    expect(loiHangMuc(closed, 'b', 'c')).toMatch(/đã đóng/)
  })
  it('thieuViec: ngoài lệnh mà không hạng mục mới thiếu', () => {
    expect(thieuViec({ production_order_id: null, project_id: null })).toBe(true)
    expect(thieuViec({ production_order_id: null, project_id: 'p' })).toBe(false)
    expect(thieuViec({ production_order_id: 'l' })).toBe(false)
  })
})

describe('thiếu giá / lỗi đọc tài chính phải nói ra, không im lặng thành 0', () => {
  it('đếm đơn thiếu giá + lỗi đọc, và canChuY nhắc', () => {
    const so = soHangMuc({ budget: null, currency: 'VND' }, [
      don({ gross: 100, received_net: 0, missing_price_lines: 6 }),
      don({ gross: 50, received_net: null, finance_error: true }),
    ])
    expect([so.thieu_gia, so.loi_tai_chinh]).toEqual([1, 1])
    expect(
      canChuY({ status: 'open', kind: 'Dự trữ kho', budget: null, currency: 'VND' }, so),
    ).toEqual([
      // prettier-ignore
      '1 đơn phiếu nhập thiếu giá — "đã về" chưa đủ',
      '1 đơn chưa đọc được số tài chính',
    ])
  })
  it('vượt dự toán ghi kèm tiền tệ khi không phải VND', () => {
    const so = {
      ...soHangMuc({ budget: 100, currency: 'USD' }, []),
      ordered: 101.5,
      pct: 102,
    }
    expect(canChuY({ status: 'open', kind: 'X', budget: 100, currency: 'USD' }, so)[0]).toBe('vượt dự toán 1,50 USD') // prettier-ignore
  })
})

describe('docTienDuToan', () => {
  it('chấm nghìn VN, phẩy nghìn kiểu Mỹ, phẩy thập phân, trống, sai', () => {
    expect(docTienDuToan('300.000.000')).toBe(300_000_000)
    expect(docTienDuToan('300,000,000')).toBe(300_000_000)
    expect(docTienDuToan('1,5')).toBe(1.5)
    expect(docTienDuToan(' 150 000 000 ')).toBe(150_000_000)
    expect(docTienDuToan('')).toBeNull()
    expect(docTienDuToan('abc')).toBeUndefined()
    expect(docTienDuToan('-5')).toBeUndefined()
  })
})
