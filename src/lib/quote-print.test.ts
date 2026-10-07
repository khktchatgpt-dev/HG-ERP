import { describe, expect, it } from 'vitest'
import {
  quotePdfName,
  quotePrintTotals,
  quotePrintWatermark,
  quoteRevisionLabel,
} from './quote-print'

describe('quotePrintWatermark — tờ nào in sạch, tờ nào đóng dải đỏ', () => {
  it('sent / approved / won còn hạn → không dải', () => {
    expect(quotePrintWatermark('sent', '2026-12-31', '2026-10-07')).toBeNull()
    expect(quotePrintWatermark('approved', null, '2026-10-07')).toBeNull()
    expect(quotePrintWatermark('won', '2026-10-01', '2026-10-07')).toBeNull() // đã thành đơn, hết hạn không còn nghĩa
  })
  it('nháp / chờ duyệt / bị thay thế / huỷ → dải nói rõ', () => {
    expect(quotePrintWatermark('draft', null, '2026-10-07')).toMatch(/DRAFT/)
    expect(quotePrintWatermark('pending_approval', null, '2026-10-07')).toMatch(/PENDING/)
    expect(quotePrintWatermark('superseded', null, '2026-10-07')).toMatch(/SUPERSEDED/)
    expect(quotePrintWatermark('cancelled', null, '2026-10-07')).toMatch(/CANCELLED/)
  })
  it('thua là chuyện nội bộ — không in lên tờ gửi khách', () => {
    expect(quotePrintWatermark('lost', '2026-12-31', '2026-10-07')).toBeNull()
  })
  it('đã gửi nhưng quá valid_to → EXPIRED kèm ngày dd/mm/yyyy', () => {
    expect(quotePrintWatermark('sent', '2026-10-06', '2026-10-07')).toBe(
      'EXPIRED on 06/10/2026 — please request a new quotation',
    )
    expect(quotePrintWatermark('sent', '2026-10-07', '2026-10-07')).toBeNull() // ngày cuối vẫn còn hạn
  })
})

describe('quoteRevisionLabel', () => {
  it('bản 1 không in, bản 2+ in "Rev n"', () => {
    expect(quoteRevisionLabel(1)).toBeNull()
    expect(quoteRevisionLabel(undefined)).toBeNull()
    expect(quoteRevisionLabel(3)).toBe('Rev 3')
  })
})

describe('quotePrintTotals — cột SL/MOQ chỉ hiện khi có SL', () => {
  it('không dòng nào có SL → ẩn cột, tổng 0', () => {
    const t = quotePrintTotals([{ qty: null, unit_price: 10, discount_pct: null }])
    expect(t.showQty).toBe(false)
    expect(t.amounts).toEqual([null])
    expect(t.total).toBe(0)
  })
  it('thành tiền theo giá NET sau chiết khấu; dòng không SL ghi null và đếm riêng', () => {
    const t = quotePrintTotals([
      { qty: 100, unit_price: 40, discount_pct: 10 }, // 100 × 36
      { qty: null, unit_price: 5, discount_pct: null },
      { qty: 0, unit_price: 5, discount_pct: null }, // 0 coi như chưa khai
    ])
    expect(t.showQty).toBe(true)
    expect(t.amounts).toEqual([3600, null, null])
    expect(t.total).toBe(3600)
    expect(t.withQty).toBe(1)
    expect(t.withoutQty).toBe(2)
  })
})

describe('quotePdfName', () => {
  it('ghép mã · Rev · khách, lột ký tự cấm tên file', () => {
    expect(quotePdfName('BG-2026-0002', 2, 'YOTRIO GROUP')).toBe(
      'BG-2026-0002 Rev 2 - YOTRIO GROUP',
    )
    expect(quotePdfName('BG-2026-0001', 1, 'A/B: C')).toBe('BG-2026-0001 - AB C')
  })
})
