import { describe, expect, it } from 'vitest'
import { lechDonLenh, trichDoiDon, type SuKienDon } from './don-doi'

const maCuaSp = new Map([
  ['p-ch', 'CH0254HG-IR'],
  ['p-tb', 'TB0287HG-IR'],
  ['p-moi', 'BN0300HG-IR'],
])

const sk = (
  change: Record<string, unknown>,
  note: string | null,
  at = '2026-10-05T07:41:19Z',
): SuKienDon => ({
  // prettier-ignore
  order_id: 'o1',
  order_code: 'ROSCO IBIZA 02',
  change,
  note,
  boi: 'Sale A',
  created_at: at,
})

// Đúng hình dạng thật (05/10, ROSCO 02): trước ghi product_code, sau ghi product_id.
const SUA_DONG = sk(
  {
    type: 'update',
    lines: {
      before: [
        { product_code: 'CH0254HG-IR', qty: 8960, unit_price: 45.13 },
        { product_code: 'TB0287HG-IR', qty: 2240, unit_price: 148.15 },
      ],
      after: [
        { product_id: 'p-ch', qty: 8816, unit_price: 45.13 },
        { product_id: 'p-tb', qty: 2240, unit_price: 150 },
        { product_id: 'p-moi', qty: 40, unit_price: 10 },
      ],
    },
  },
  'Bản 2: về đúng ORDERED QTY file khách',
)

describe('trích thay đổi đơn ảnh hưởng việc mua', () => {
  const khongNoi = { maCuaSp, dongDon: [], dongLenh: [{ sales_order_line_id: null, product_code: 'CH0254HG-IR', qty: 8816 }], ngayLenh: null } // prettier-ignore

  it('sửa dòng: mỗi SP đổi SL một dòng (thêm SP = trước rỗng); đổi giá thôi thì không', () => {
    const r = trichDoiDon([SUA_DONG], khongNoi)
    expect(r.map((x) => [x.sp, x.truoc, x.sau])).toEqual([
      ['BN0300HG-IR', null, 40],
      ['CH0254HG-IR', 8960, 8816],
    ])
    expect(r[1]).toMatchObject({ loai: 'sl', lyDo: 'Bản 2: về đúng ORDERED QTY file khách', boi: 'Sale A' }) // prettier-ignore
  })

  it('lệnh không nối dòng đơn → không so được, chỉ bày SL lệnh cùng mã', () => {
    const r = trichDoiDon([SUA_DONG], khongNoi)
    expect(r[1].soLenh).toEqual({ k: 'khong_noi', slLenhCungMa: 8816 })
    expect(r[0].soLenh).toEqual({ k: 'khong_noi', slLenhCungMa: null })
  })

  it('có nối: lệnh đã theo / chưa sửa theo (so SL đơn BÂY GIỜ với tổng dòng lệnh nối vào)', () => {
    const dongDon = [{ id: 'dl1', order_id: 'o1', product_id: 'p-ch', code: 'CH0254HG-IR', qty: 8816 }] // prettier-ignore
    const theo = trichDoiDon([SUA_DONG], { maCuaSp, dongDon, ngayLenh: null, dongLenh: [
      { sales_order_line_id: 'dl1', product_code: 'CH0254HG-IR', qty: 8000 },
      { sales_order_line_id: 'dl1', product_code: 'CH0254HG-IR', qty: 816 },
    ] }) // prettier-ignore
    expect(theo.find((x) => x.sp === 'CH0254HG-IR')?.soLenh).toEqual({
      k: 'theo',
      slLenh: 8816,
    })
    const chua = trichDoiDon([SUA_DONG], { maCuaSp, dongDon, ngayLenh: null, dongLenh: [
      { sales_order_line_id: 'dl1', product_code: 'CH0254HG-IR', qty: 8960 },
    ] }) // prettier-ignore
    expect(chua.find((x) => x.sp === 'CH0254HG-IR')?.soLenh).toEqual({ k: 'chua_theo', slDon: 8816, slLenh: 8960 }) // prettier-ignore
  })

  it('hạn giao đổi → một dòng kèm ngày xuất lệnh; huỷ đơn → đếm dòng lệnh còn nối', () => {
    const han = sk({ type: 'update', fields: { due_date: { from: null, to: '2027-03-17' } } }, 'Theo chuyến cuối') // prettier-ignore
    const huy = sk({ type: 'cancel', fields: { status: { from: 'in_production', to: 'cancelled' } } }, 'Khách huỷ', '2026-10-06T00:00:00Z') // prettier-ignore
    const dongDon = [{ id: 'dl1', order_id: 'o1', product_id: 'p-ch', code: 'CH0254HG-IR', qty: 8816 }] // prettier-ignore
    const r = trichDoiDon([huy, han], { maCuaSp, dongDon, ngayLenh: '2027-03-10', dongLenh: [{ sales_order_line_id: 'dl1', product_code: 'CH0254HG-IR', qty: 8816 }] }) // prettier-ignore
    expect(r.map((x) => x.loai)).toEqual(['han', 'huy'])
    expect(r[0]).toMatchObject({ truoc: null, sau: '2027-03-17', soLenh: { k: 'ngay', ngayLenh: '2027-03-10' } }) // prettier-ignore
    expect(r[1].soLenh).toEqual({ k: 'huy', dongLenhCon: 1 })
  })

  it('bỏ qua giá, đợt xuất, mốc lệnh', () => {
    const r = trichDoiDon(
      [sk({ type: 'price_fill' }, 'x'), sk({ type: 'shipment', fields: {} }, null), sk({ type: 'lsx_approved' }, null)], // prettier-ignore
      khongNoi,
    )
    expect(r).toEqual([])
  })
})

describe('cờ lệnh chưa sửa theo đơn', () => {
  it('chỉ dòng CÓ nối mà SL khác', () => {
    expect(
      lechDonLenh(
        [
          { id: 'a', order_id: 'o1', product_id: null, code: 'CH0176HG-AL', qty: 280, don: '18086 HG-MX' }, // prettier-ignore
          { id: 'b', order_id: 'o1', product_id: null, code: 'CH0172HG-AL', qty: 450, don: '18086 HG-MX' }, // prettier-ignore
          { id: 'c', order_id: 'o1', product_id: null, code: 'TB0182HG-AL', qty: 100, don: '18086 HG-MX' }, // prettier-ignore
        ],
        [
          { sales_order_line_id: 'a', product_code: 'CH0176HG-AL', qty: 300 },
          { sales_order_line_id: 'b', product_code: 'CH0172HG-AL', qty: 450 },
          { sales_order_line_id: null, product_code: 'TB0182HG-AL', qty: 90 },
        ],
      ),
    ).toEqual([{ don: '18086 HG-MX', sp: 'CH0176HG-AL', slDon: 280, slLenh: 300 }])
  })
})
