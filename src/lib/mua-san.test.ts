import { describe, expect, it } from 'vitest'
import {
  datTrenSanLoi,
  docTien,
  gomShop,
  guiDuyetSanLoi,
  hoaDonDon,
  noHoanUng,
  soTienDaTra,
  truongSan,
} from './mua-san'

describe('soTienDaTra — phiếu hoàn tiền trừ vào đã trả', () => {
  it('trả tiền dương, hoàn tiền âm, thiếu kind = trả tiền', () => {
    expect(soTienDaTra({ amount: 500_000, kind: 'payment' })).toBe(500_000)
    expect(soTienDaTra({ amount: '120000', kind: 'refund' })).toBe(-120_000)
    expect(soTienDaTra({ amount: 90_000 })).toBe(90_000)
    expect(soTienDaTra({ amount: null })).toBe(0)
  })

  it('đơn Shopee 500k bị hoàn 120k → đã trả ròng 380k', () => {
    const pays = [
      { amount: 500_000, kind: 'payment' },
      { amount: 120_000, kind: 'refund' },
    ]
    expect(pays.reduce((t, p) => t + soTienDaTra(p), 0)).toBe(380_000)
  })
})

describe('truongSan — tên shop chỉ sống trên đơn của NCC là sàn', () => {
  it('NCC thường: luôn null dù client gửi', () => {
    expect(truongSan(false, { marketplace_shop: 'Shop Vít Rẻ', marketplace_tracking_no: 'SPX1' })).toEqual({ marketplace_shop: null, marketplace_tracking_no: null }) // prettier-ignore
  })

  it('NCC là sàn: gọt khoảng trắng, chuỗi rỗng thành null', () => {
    expect(truongSan(true, { marketplace_shop: '  Shop Vít Rẻ ', marketplace_tracking_no: '  ' })).toEqual({ marketplace_shop: 'Shop Vít Rẻ', marketplace_tracking_no: null }) // prettier-ignore
  })
})

describe('hoaDonDon — suy từ sự thật đã ghi', () => {
  it('chưa có gì = chờ hoá đơn', () => {
    expect(hoaDonDon({ posted_invoice_count: 0 })).toBe('pending')
  })
  it('có lý do không hoá đơn = không có hoá đơn', () => {
    expect(hoaDonDon({ invoice_waived_reason: 'Shop cá nhân', posted_invoice_count: 0 })).toBe('waived') // prettier-ignore
    expect(hoaDonDon({ invoice_waived_reason: '   ', posted_invoice_count: 0 })).toBe(
      'pending',
    )
  })
  it('hoá đơn đã vào sổ thắng lời khai "không có"', () => {
    expect(hoaDonDon({ invoice_waived_reason: 'Shop cá nhân', posted_invoice_count: 1 })).toBe('received') // prettier-ignore
  })
})

describe('noHoanUng — công ty còn nợ nhân viên đã ứng tiền', () => {
  const A = 'user-a'
  const B = 'user-b'
  it('chỉ đếm phiếu có người ứng, chưa hoàn; hoàn tiền của sàn trừ vào', () => {
    const r = noHoanUng([
      { paid_by_user_id: A, amount: 300_000, kind: 'payment' },
      { paid_by_user_id: A, amount: 50_000, kind: 'refund' },
      { paid_by_user_id: A, amount: 999_000, kind: 'payment', reimbursed_at: '2026-10-20T00:00:00Z' }, // prettier-ignore
      { paid_by_user_id: B, amount: 80_000 },
      { paid_by_user_id: null, amount: 1_000_000 },
    ])
    expect(r).toEqual([
      { user_id: A, currency: 'VND', amount: 250_000, count: 2 },
      { user_id: B, currency: 'VND', amount: 80_000, count: 1 },
    ])
  })

  it('đã hết nợ (hoàn bằng hoặc hơn số ứng) thì không hiện', () => {
    expect(noHoanUng([{ paid_by_user_id: A, amount: 100, kind: 'payment' }, { paid_by_user_id: A, amount: 100, kind: 'refund' }])).toEqual([]) // prettier-ignore
  })
})

describe('guiDuyetSanLoi / datTrenSanLoi — hàng rào luồng đơn sàn', () => {
  it('gửi duyệt: thiếu tên shop thì chặn, có thì qua', () => {
    expect(guiDuyetSanLoi({ marketplace_shop: '  ' })).toMatch(/tên shop/)
    expect(guiDuyetSanLoi({ marketplace_shop: 'Shop Vít Rẻ' })).toBeNull()
  })

  it('đặt trên sàn: bắt mã đơn, cách trả, số tiền (trừ COD)', () => {
    expect(datTrenSanLoi(undefined)).toMatch(/mã đơn sàn/)
    expect(datTrenSanLoi({ order_no: ' ', method: 'ck', amount: 1 })).toMatch(
      /mã đơn sàn/,
    )
    expect(datTrenSanLoi({ order_no: '2410ABC', method: 'ck' })).toMatch(/số tiền/)
    expect(datTrenSanLoi({ order_no: '2410ABC', method: 'ung', amount: 0 })).toMatch(
      /số tiền/,
    )
    expect(datTrenSanLoi({ order_no: '2410ABC', method: 'cod' })).toBeNull()
    expect(
      datTrenSanLoi({ order_no: '2410ABC', method: 'the', amount: 385_000 }),
    ).toBeNull()
  })
})

describe('gomShop — gợi ý tên shop đã dùng', () => {
  it('gộp tên trùng (hoa thường, khoảng trắng), giữ cách viết gần nhất, đếm số đơn', () => {
    expect(
      gomShop([
        { supplier_id: 'spe', marketplace_shop: 'Kim Khí Phát Đạt Official', created_at: '2026-10-27T03:00:00Z' }, // prettier-ignore
        { supplier_id: 'spe', marketplace_shop: '  kim khí  phát đạt official ', created_at: '2026-10-18T03:00:00Z' }, // prettier-ignore
        {
          supplier_id: 'spe',
          marketplace_shop: null,
          created_at: '2026-10-10T03:00:00Z',
        },
        { supplier_id: 'lzd', marketplace_shop: 'Kim Khí Phát Đạt Official', created_at: '2026-10-05T03:00:00Z' }, // prettier-ignore
      ]),
    ).toEqual([
      { supplier_id: 'spe', shop: 'Kim Khí Phát Đạt Official', n: 2, last: '2026-10-27' },
      { supplier_id: 'lzd', shop: 'Kim Khí Phát Đạt Official', n: 1, last: '2026-10-05' },
    ])
  })
})

describe('docTien — số tiền gõ kiểu VN', () => {
  it('chấm là nghìn, phẩy là thập phân, bỏ khoảng trắng và đơn vị', () => {
    expect(docTien('2.500.000')).toBe(2_500_000)
    expect(docTien('2500000')).toBe(2_500_000)
    expect(docTien(' 385.000 đ')).toBe(385_000)
    expect(docTien('2,5')).toBe(2.5)
    expect(docTien('')).toBeNull()
    expect(docTien('abc')).toBeNull()
  })
})
