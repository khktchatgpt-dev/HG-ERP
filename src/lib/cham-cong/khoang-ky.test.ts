import { describe, expect, it } from 'vitest'
import { khoangKy, kiemKhoang, soNgay, thangCua, type KhoangDat } from './khoang-ky'

// Sổ Nhân sự T9/2026: 25/08 → 25/09 (32 ngày) — kỳ 08 ngoài ERP, chưa có dòng nào.
const T9: KhoangDat = { thang: '2026-09', tu: '2026-08-25', den: '2026-09-25' }

describe('khoangKy — đã đặt / gợi ý', () => {
  it('chưa đặt gì: mặc định 26 → 25', () => {
    expect(khoangKy('2026-09', [])).toEqual({
      thang: '2026-09',
      tu: '2026-08-26',
      den: '2026-09-25',
      daDat: false,
    })
  })
  it('kỳ đã đặt dùng đúng khoảng đó', () => {
    expect(khoangKy('2026-09', [T9])).toMatchObject({
      tu: '2026-08-25',
      den: '2026-09-25',
      daDat: true,
    })
  })
  it('kỳ sau chưa đặt nối tiếp kỳ trước; kỳ trước chưa đặt kết thúc trước kỳ đã đặt', () => {
    expect(khoangKy('2026-10', [T9])).toMatchObject({
      tu: '2026-09-26',
      den: '2026-10-25',
      daDat: false,
    })
    expect(khoangKy('2026-08', [T9])).toMatchObject({
      tu: '2026-07-26',
      den: '2026-08-24',
      daDat: false,
    })
  })
})

describe('thangCua — ngày thuộc kỳ nào', () => {
  it('25/08 thuộc kỳ 09 khi T9 đặt từ 25/08; mặc định thì thuộc kỳ 08', () => {
    expect(thangCua('2026-08-25', [T9])).toBe('2026-09')
    expect(thangCua('2026-08-25', [])).toBe('2026-08')
    expect(thangCua('2026-09-26', [T9])).toBe('2026-10')
    expect(thangCua('2026-08-24', [T9])).toBe('2026-08')
  })
})

describe('kiemKhoang — trước khi lưu', () => {
  it('T9 = 25/08 → 25/09: hợp lệ, khác gợi ý mặc định nên cần lý do', () => {
    const k = kiemKhoang('2026-09', '2026-08-25', '2026-09-25', [])
    expect(k.loi).toEqual([])
    expect(k.khacGoiY).toBe(true)
    expect(soNgay('2026-08-25', '2026-09-25')).toBe(32)
  })
  it('chồng ngày với kỳ đã đặt là LỖI, kèm khoảng chồng', () => {
    const k = kiemKhoang('2026-10', '2026-09-24', '2026-10-25', [T9])
    expect(k.loi).toEqual(['Chồng 24/09 → 25/09 với kỳ 09/2026'])
  })
  it('hở ngày chỉ CẢNH BÁO', () => {
    const k = kiemKhoang('2026-10', '2026-09-27', '2026-10-25', [T9])
    expect(k.loi).toEqual([])
    expect(k.canhBao).toEqual([
      'Ngày 26/09 → 26/09 không thuộc kỳ nào (kỳ 09/2026 đến 25/09)',
    ])
  })
  it('dài ngoài 28–35 ngày hoặc đến trước từ là lỗi', () => {
    expect(kiemKhoang('2026-10', '2026-09-26', '2026-11-25', [T9]).loi[0]).toMatch(
      /61 ngày/,
    )
    expect(kiemKhoang('2026-10', '2026-10-25', '2026-09-26', []).loi).toEqual([
      '"Đến ngày" phải sau "Từ ngày"',
    ])
  })
  it('đặt lại chính kỳ đó không tự chồng với bản cũ', () => {
    expect(kiemKhoang('2026-09', '2026-08-26', '2026-09-25', [T9]).loi).toEqual([])
  })
})
