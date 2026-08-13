import { describe, expect, it } from 'vitest'
import { parsePasteNumber, parsePoPaste } from './po-paste'

/*
 * Các vùng dán mô phỏng SỔ THẬT của phòng Cung ứng (bàn giao A Nhân): bảng có
 * tiêu đề đủ kiểu viết, bảng trần không tiêu đề, dòng tổng cuối bảng, số kiểu
 * vi ("1.234,5") lẫn Excel Anh ("1,234.5").
 */

const tsv = (rows: string[][]) => rows.map((r) => r.join('\t')).join('\n')

describe('parsePasteNumber — số sổ Việt lẫn Excel Anh', () => {
  it('đọc đúng cả hai kiểu phân cách', () => {
    expect(parsePasteNumber('1.234,5')).toBe(1234.5)
    expect(parsePasteNumber('1,234.5')).toBe(1234.5)
    expect(parsePasteNumber('13.596')).toBe(13596) // vi: dấu chấm nghìn
    expect(parsePasteNumber('3,5')).toBe(3.5)
    expect(parsePasteNumber('1 234')).toBe(1234)
  })

  it('không ra số thì null — không đoán', () => {
    expect(parsePasteNumber('')).toBeNull()
    expect(parsePasteNumber('12 con')).toBeNull()
    expect(parsePasteNumber('x')).toBeNull()
  })
})

describe('parsePoPaste — bảng CÓ tiêu đề', () => {
  it('nhận cột theo tiêu đề, bỏ dòng Tổng cộng', () => {
    const r = parsePoPaste(
      tsv([
        ['Mã VT', 'Tên hàng hóa', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Ghi chú'],
        ['NK-0012', 'Vít 4x15 đuôi cá', 'Con', '13.596', '250', '3.399.000', '28 bì'],
        ['', 'Long đền nhựa 6x16 đen', 'Con', '500', '120', '60.000', ''],
        ['', 'Tổng cộng', '', '', '', '3.459.000', ''],
      ]),
    )
    expect(r.headerDetected).toBe(true)
    expect(r.lines).toHaveLength(2)
    expect(r.skipped).toBe(1)
    expect(r.lines[0]).toEqual({
      name: 'Vít 4x15 đuôi cá',
      code: 'NK-0012',
      qty: 13596,
      price: 250,
      note: '28 bì',
    })
    // Cột ĐVT/Thành tiền cố tình bỏ — app tự có ĐVT theo danh mục, tiền tự tính.
    expect(r.lines[1].code).toBeNull()
  })

  it('tiêu đề viết kiểu khác vẫn nhận ("SL", "Giá")', () => {
    const r = parsePoPaste(
      tsv([
        ['Tên vật tư', 'SL', 'Giá'],
        ['Sơn xám cát ngoài trời', '200', '81.000'],
      ]),
    )
    expect(r.headerDetected).toBe(true)
    expect(r.lines[0]).toMatchObject({
      name: 'Sơn xám cát ngoài trời',
      qty: 200,
      price: 81000,
    })
  })
})

describe('parsePoPaste — bảng KHÔNG tiêu đề (đoán cột)', () => {
  it('mã · tên · SL · giá — cột chữ dài nhất là tên, cột mã đứng trước', () => {
    const r = parsePoPaste(
      tsv([
        ['PTBDDW-02N', 'Mây dẹp cào xước màu nâu đỏ', '5.100', '35.000'],
        ['PTBDDW-03X', 'Mây dẹp cào xước màu xám', '3.400', '35.000'],
      ]),
    )
    expect(r.headerDetected).toBe(false)
    expect(r.lines).toHaveLength(2)
    expect(r.lines[0]).toMatchObject({
      code: 'PTBDDW-02N',
      name: 'Mây dẹp cào xước màu nâu đỏ',
      qty: 5100,
      price: 35000,
    })
  })

  it('chỉ tên + SL cũng chạy — giá để null chứ không bịa', () => {
    const r = parsePoPaste(tsv([['Kính trắng phun mờ 605x539x5mm', '500']]))
    expect(r.lines[0]).toMatchObject({ qty: 500, price: null })
  })

  it('dòng trống tên bị bỏ và ĐẾM vào skipped', () => {
    const r = parsePoPaste(
      tsv([
        ['Vít 4x15', '100', '250'],
        ['', '9', '9'],
      ]),
    )
    expect(r.lines).toHaveLength(1)
    expect(r.skipped).toBe(1)
  })

  it('quá trần thì cắt và đếm — không nuốt im lặng', () => {
    const rows = Array.from({ length: 5 }, (_, i) => [`Vật tư ${i}`, '1', '10'])
    const r = parsePoPaste(tsv(rows), 3)
    expect(r.lines).toHaveLength(3)
    expect(r.skipped).toBe(2)
  })
})
