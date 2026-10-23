import { describe, expect, it } from 'vitest'
import { docQuyCach, laKimLoai } from './quy-cach-vat-tu'

const key = (n: string, extra?: string) => docQuyCach(n, extra)?.label

describe('docQuyCach — gom tên khác nhau của cùng một quy cách', () => {
  it('bỏ chiều dài cây, mọi cách viết vuông 20 về một', () => {
    const ten = [
      'Nhôm vuông 20 x 20 T1.0',
      'Nhôm vuông 20 x 20 T1.0 dài 5.48m',
      'Nhôm vuông 20 x1.0 (dài 5.0m)',
      'Nhôm vuông 20 x1.0 (5.5m)',
    ]
    for (const t of ten) expect(key(t)).toBe('Nhôm vuông 20×20 T1.0')
  })
  it('tròn: phi / ø / ống đọc đường kính + độ dày', () => {
    expect(key('Nhôm phi 25x1li dài 5.65m')).toBe('Nhôm phi 25 T1.0')
    expect(key('Nhôm phi 25 x1.0 (dài 5.8m)')).toBe('Nhôm phi 25 T1.0')
    expect(key('Nhôm ø25*1.2 có gân')).toBe('Nhôm phi 25 T1.2 có gân')
  })
  it('hai cạnh khác nhau là hộp, kể cả tên ghi "hộp vuông"', () => {
    expect(key('Thép hộp vuông 20x40x1.0')).toBe('Thép hộp 20×40 T1.0')
    expect(key('Nhôm 25x25xT1.0R1.5')).toBe('Nhôm vuông 25×25 T1.0')
  })
  it('"8dem" là 0,8 mm; cờ kẽm đọc cả ở chữ phụ', () => {
    expect(key('Sắt hộp 15x35x8dem')).toBe('Thép hộp 15×35 T0.8')
    expect(key('Sắt hộp 20x40 x0.8mm (dài 5.9m)', 'kẽm')).toBe('Thép hộp 20×40 T0.8 kẽm')
  })
  it('mềm và có gân là quy cách khác', () => {
    expect(key('Nhôm hộp 20x80x1.2li Ủ mềm dài 5.45m')).toBe('Nhôm hộp 20×80 T1.2 mềm')
    expect(docQuyCach('Nhôm hộp 20 x 40 x T1.0 có 2 gân')?.key).not.toBe(
      docQuyCach('Nhôm hộp 20x40x1.0')?.key,
    )
  })
  it('tấm khoá theo độ dày', () => {
    expect(key('Thép tấm 1500x3000x5mm')).toBe('Thép tấm dày 5 mm')
    expect(key('Thép tấm 5x1500x3000')).toBe('Thép tấm dày 5 mm')
    expect(key('Nhôm tấm 1.75 li, khổ 1200x2400')).toBe('Nhôm tấm dày 1.75 mm')
  })
  it('profile riêng của NCC không gom với hàng thường', () => {
    expect(docQuyCach('Nhôm tD-B107 (Hộp 30x75)')?.dang).toBe('profile')
    expect(docQuyCach('Nhôm QM-HGGL-5858R10')?.dang).toBe('profile')
  })
})

describe('laKimLoai — chỉ thanh/tấm kim loại, không phải ngũ kim', () => {
  it('nhận nhôm/thép/sắt/inox', () => {
    expect(laKimLoai('Nhôm hộp 20x40x1.0')).toBe(true)
    expect(laKimLoai('Thép oval 17x26x0.85')).toBe(true)
  })
  it('bulon, vít, tán, tấm lót không phải', () => {
    expect(laKimLoai('Bulon 6x20x15, 7 màu')).toBe(false)
    expect(laKimLoai('Vít dù 4x12, 7M')).toBe(false)
    expect(laKimLoai('Tấm lót 3 lớp')).toBe(false)
    expect(docQuyCach('Vít dù 4x12, 7M')).toBeNull()
  })
})
