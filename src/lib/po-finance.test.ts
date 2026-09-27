import { describe, expect, it } from 'vitest'
import { invoiceLineGross, poFinanceView } from './po-finance'

const base = { ordered_gross: 845_477_411, received_net: 0, invoiced_net: 0, invoiced_gross: 0, paid: 0 } // prettier-ignore

describe('poFinanceView — tiền của một đơn đang ở đâu', () => {
  it('chưa về, chưa hoá đơn: chưa phát sinh, không nợ', () => {
    expect(poFinanceView(base)).toMatchObject({ stage: 'chua_phat_sinh', waiting_invoice_net: 0, owed: 0 }) // prettier-ignore
  })

  it('PO-2026-0049 hôm nay: về đủ, chưa hoá đơn → chờ hoá đơn đúng bằng tiền nhận', () => {
    const v = poFinanceView({ ...base, received_net: 782_849_455.2 })
    expect(v.stage).toBe('cho_hoa_don')
    expect(v.waiting_invoice_net).toBe(782_849_455.2)
    expect(v.owed).toBe(0)
  })

  it('có hoá đơn đủ + đã cọc: còn nợ = hoá đơn gồm VAT − đã trả', () => {
    const v = poFinanceView({ ...base, received_net: 782_849_455, invoiced_net: 783_243_540, invoiced_gross: 845_903_023, paid: 253_643_223 }) // prettier-ignore
    expect(v.stage).toBe('con_no')
    expect(v.owed).toBe(592_259_800)
    // Hoá đơn vượt nhận không sinh "chờ hoá đơn" âm.
    expect(v.waiting_invoice_net).toBe(0)
  })

  it('hoá đơn mới đòi một phần hàng đã về → vẫn là chờ hoá đơn (phần còn lại chưa có giấy)', () => {
    const v = poFinanceView({
      ...base,
      received_net: 100,
      invoiced_net: 60,
      invoiced_gross: 64.8,
    })
    expect(v.stage).toBe('cho_hoa_don')
    expect(v.waiting_invoice_net).toBe(40)
    expect(v.owed).toBe(64.8)
  })

  it('trả đủ hoá đơn → đã trả; trả dư → nợ âm, không giấu', () => {
    expect(poFinanceView({ ...base, received_net: 100, invoiced_net: 100, invoiced_gross: 108, paid: 108 }).stage).toBe('da_tra') // prettier-ignore
    expect(poFinanceView({ ...base, received_net: 100, invoiced_net: 100, invoiced_gross: 108, paid: 120 }).owed).toBe(-12) // prettier-ignore
  })
})

describe('poFinanceView — phiếu nhập thiếu giá', () => {
  it('PO-2026-0068: về đủ nhưng phiếu nhập không có giá → thiếu giá, KHÔNG phải "còn nợ 0"', () => {
    const v = poFinanceView({ ...base, received_net: 0, missing_price_lines: 6 })
    expect(v.stage).toBe('thieu_gia')
  })
  it('đã có hoá đơn thì hoá đơn quyết — thiếu giá nhập không che mất khoản nợ', () => {
    const v = poFinanceView({ ...base, received_net: 0, invoiced_gross: 108, invoiced_net: 100, missing_price_lines: 1 }) // prettier-ignore
    expect(v.stage).toBe('con_no')
  })
})

describe('invoiceLineGross', () => {
  it('cộng VAT của chính dòng; VAT trống là 0', () => {
    expect(invoiceLineGross(1_000_000, 8)).toBe(1_080_000)
    expect(invoiceLineGross(1_000_000, null)).toBe(1_000_000)
  })
})
