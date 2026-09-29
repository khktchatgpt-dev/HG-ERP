import { describe, expect, it } from 'vitest'
import { canHien, demTinhTrang, tinhTrang } from './lsx-bang-ke-gon'

const f = (
  o: Partial<{ ordered: number; pending: number; draft: number; received: number }>,
) => ({
  ordered: 0,
  pending: 0,
  draft: 0,
  received: 0,
  ...o,
})

describe('tinhTrang — ca thật lệnh 02/26-27 ROSCO (29/09)', () => {
  it('BAO0716: đặt 2.814, chưa về → Đang về', () => {
    expect(tinhTrang(f({ ordered: 2814 }))).toBe('dang_ve')
  })
  it('CKH0001: đã về 8.600, không còn gì đang về → Đã về', () => {
    expect(tinhTrang(f({ received: 8600 }))).toBe('da_ve')
  })
  it('còn đang về dù đã nhận một phần → vẫn Đang về', () => {
    expect(tinhTrang(f({ ordered: 10, received: 90 }))).toBe('dang_ve')
  })
  it('CN1679 chờ Giám đốc ký → Chờ duyệt; MUT0551 chỉ nằm ở đơn nháp → Nháp', () => {
    expect(tinhTrang(f({ pending: 8550 }))).toBe('cho_duyet')
    expect(tinhTrang(f({ draft: 4480 }))).toBe('nhap')
  })
  it('chỉ có số cần, chưa nằm trên đơn nào → Chưa đặt', () => {
    expect(tinhTrang(f({}))).toBe('chua_dat')
  })
  it('đếm khớp tổng', () => {
    const d = demTinhTrang([
      f({ ordered: 1 }),
      f({ received: 1 }),
      f({ draft: 1 }),
      f({ draft: 1 }),
    ])
    expect(d).toEqual({ chua_dat: 0, nhap: 2, cho_duyet: 0, dang_ve: 1, da_ve: 1 })
  })
})

describe('canHien', () => {
  it('ngoài định mức → trống (không in 0 — 0 nghĩa là "không cần")', () => {
    expect(canHien({ source: 'none', qty_needed: 0, draft_needed: 0 })).toBeNull()
  })
  it('YOTRIO VIT0019 từ định mức nháp → 17.600 kèm cờ nháp', () => {
    expect(canHien({ source: 'bom_draft', qty_needed: 0, draft_needed: 17600 })).toEqual({
      qty: 17600,
      nhap: true,
    })
  })
  it('định mức đã xác nhận → số thật, không cờ', () => {
    expect(canHien({ source: 'bom', qty_needed: 360, draft_needed: 0 })).toEqual({
      qty: 360,
      nhap: false,
    })
  })
})
