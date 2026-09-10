import { describe, expect, it } from 'vitest'
import {
  headerFromPo,
  newHeader,
  poChecks,
  retemplate,
  type PoForHeader,
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
  it('mặc định mẫu simple, có lệnh thì poType lsx', () => {
    const h = newHeader({ lsxId: 'x' })
    expect(h.template).toBe('simple')
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
