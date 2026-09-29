import { describe, expect, it } from 'vitest'
import {
  headerFromPo,
  newHeader,
  poChecks,
  retemplate,
  type PoForHeader,
  templateForSupplier,
} from './chung-tu'

const po: PoForHeader = {
  template: 'accessory',
  production_order_id: 'lsx-1',
  supplier_id: 'ncc-1',
  currency: 'VND',
  vat_rate: 8,
  price_includes_vat: false,
  discount_amount: null,
  contract_no: null,
  expected_at: '2026-09-18T00:00:00+07:00',
  note: null,
  signer_role: null,
  terms_quality: 'theo mẫu',
  terms_delivery_place: null,
  terms_payment: null,
  terms_invoice: null,
  terms_lead_time: null,
}

describe('headerFromPo', () => {
  it('đơn có lệnh → poType lsx; ngày cắt về yyyy-mm-dd; số null → ô trống', () => {
    const h = headerFromPo(po, ['lsx-2'])
    expect(h.poType).toBe('lsx')
    expect(h.lsxId).toBe('lsx-1')
    expect(h.extraLsxIds).toEqual(['lsx-2'])
    expect(h.expectedAt).toBe('2026-09-18')
    expect(h.discount).toBe('')
    expect(h.vat).toBe(8)
  })
  it('điều khoản trống lấy mặc định của mẫu, điều khoản có thì giữ', () => {
    const h = headerFromPo(po, [])
    expect(h.terms.quality).toBe('theo mẫu')
    expect(h.terms.payment.length).toBeGreaterThan(0)
  })
  it('không có lệnh → standalone', () => {
    expect(headerFromPo({ ...po, production_order_id: null }, []).poType).toBe(
      'standalone',
    )
  })
})

describe('newHeader / retemplate', () => {
  it('mặc định mẫu PHỤ KIỆN (VAT 8%, giá chưa gồm VAT), có lệnh thì poType lsx', () => {
    // 26/09/2026: 0/82 đơn thật dùng mẫu "Đơn giản", phụ kiện nhiều nhất (33). Mặc
    // định "Đơn giản" kéo theo VAT 10% + "giá đã gồm VAT" — sai với đơn giấy ATP.
    const h = newHeader({ lsxId: 'x' })
    expect(h.template).toBe('accessory')
    expect(h.vat).toBe(8)
    expect(h.inclVat).toBe(false)
    expect(h.poType).toBe('lsx')
    expect(h.supplierId).toBe('')
  })
  it('đổi mẫu thì VAT/điều khoản/người ký theo mẫu mới, NCC và lệnh giữ nguyên', () => {
    const h = retemplate(newHeader({ supplierId: 's', lsxId: 'l' }), 'carton')
    expect(h.template).toBe('carton')
    expect(h.supplierId).toBe('s')
    expect(h.lsxId).toBe('l')
  })
})

describe('templateForSupplier — chọn NCC thì mẫu theo đơn gần nhất của NCC đó', () => {
  const last = { atp: 'accessory', vipora: 'accessory', doan_gia: 'aluminium' } as const
  it('đơn MỚI, người soạn CHƯA tự chọn mẫu → mẫu của đơn gần nhất cùng NCC', () => {
    expect(templateForSupplier({ supplierId: 'doan_gia', current: 'accessory', touched: false, isNew: true, last })).toBe('aluminium') // prettier-ignore
  })
  it('đã tự chọn mẫu / đơn đã lưu / NCC chưa có đơn / đang đúng mẫu → không đổi (null)', () => {
    expect(templateForSupplier({ supplierId: 'doan_gia', current: 'accessory', touched: true, isNew: true, last })).toBeNull() // prettier-ignore
    expect(templateForSupplier({ supplierId: 'doan_gia', current: 'accessory', touched: false, isNew: false, last })).toBeNull() // prettier-ignore
    expect(templateForSupplier({ supplierId: 'moi', current: 'accessory', touched: false, isNew: true, last })).toBeNull() // prettier-ignore
    expect(templateForSupplier({ supplierId: 'atp', current: 'accessory', touched: false, isNew: true, last })).toBeNull() // prettier-ignore
  })
})

describe('poChecks — năm luật của màn chi tiết cũ', () => {
  const base = { status: 'draft', production_order_id: 'l', expected_at: '2026-09-20' }
  it('đơn đã gửi NCC thì không kiểm', () => {
    expect(poChecks({ ...base, status: 'ordered' }, [], '2026-09-10')).toEqual([])
  })
  it('không dòng → chặn; dòng thiếu giá → chặn kèm số dòng', () => {
    const c = poChecks(base, [], '2026-09-10')
    expect(c.some((x) => x.level === 'stop' && /chưa có dòng/.test(x.what))).toBe(true)
    const c2 = poChecks(base, [{ unit_price: null }, { unit_price: 1 }, { unit_price: null }], '2026-09-10') // prettier-ignore
    expect(c2.find((x) => /đơn giá/.test(x.what))?.what).toBe('2 dòng chưa có đơn giá')
  })
  it('không lệnh, không hạn, hạn đã qua → cảnh báo, không chặn', () => {
    const c = poChecks({ status: 'pending_approval', production_order_id: null, expected_at: '2026-09-01' }, [{ unit_price: 1 }], '2026-09-10') // prettier-ignore
    expect(c.every((x) => x.level === 'warn')).toBe(true)
    expect(c.map((x) => x.what)).toEqual([
      'Chưa gắn lệnh sản xuất',
      'Hạn giao 01/09/2026 đã qua',
    ])
  })
})

describe('hẹn giao — nhắc ở bước soạn, CHẶN ở bước gửi NCC (17/09/2026)', () => {
  const du = [{ unit_price: 1 }]
  it('đơn nháp thiếu hẹn giao chỉ bị NHẮC, vẫn gửi duyệt được', () => {
    const c = poChecks(
      { status: 'draft', production_order_id: 'l', expected_at: null },
      du,
      '2026-09-10',
    )
    const eta = c.find((x) => /hẹn giao/.test(x.what))!
    expect(eta.level).toBe('warn')
    expect(eta.fix).toMatch(/bắt buộc/)
  })
  it('đơn ĐÃ DUYỆT thiếu hẹn giao thì thành lỗi CHẶN, và nói cách gỡ', () => {
    const c = poChecks(
      { status: 'approved', production_order_id: 'l', expected_at: null },
      du,
      '2026-09-10',
    )
    const eta = c.find((x) => /hẹn giao/.test(x.what))!
    expect(eta.level).toBe('stop')
    expect(eta.fix).toMatch(/"Sửa"/)
  })
  it('đơn đã duyệt mà CÓ hẹn giao thì không còn lỗi chặn nào', () => {
    const c = poChecks(
      { status: 'approved', production_order_id: 'l', expected_at: '2026-09-20' },
      du,
      '2026-09-10',
    )
    expect(c.filter((x) => x.level === 'stop')).toEqual([])
  })
  it('gửi NCC rồi thì bảng kiểm tắt — hàng rào đã qua', () => {
    expect(
      poChecks(
        { status: 'ordered', production_order_id: 'l', expected_at: null },
        du,
        '2026-09-10',
      ),
    ).toEqual([])
  })
})

describe('newHeader — loại đơn mặc định', () => {
  it('mặc định THEO LỆNH: đơn nào của phòng cũng gắn lệnh, ô lệnh không được khoá sẵn', () => {
    expect(newHeader({}).poType).toBe('lsx')
    expect(newHeader({ supplierId: 's' }).poType).toBe('lsx')
  })
  it('mở từ dòng tồn kho mà không kèm lệnh = mua bù tồn → ngoài lệnh', () => {
    expect(newHeader({ fromStock: true }).poType).toBe('standalone')
  })
  it('mở từ dòng tồn kho NHƯNG có lệnh trên URL thì vẫn theo lệnh', () => {
    expect(newHeader({ fromStock: true, lsxId: 'l1' }).poType).toBe('lsx')
  })
})
