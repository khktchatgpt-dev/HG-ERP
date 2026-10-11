import { describe, expect, it } from 'vitest'
import { canChuY, lenhCuaKhach, soHangMuc, type HangMucDon } from './hang-muc'

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
