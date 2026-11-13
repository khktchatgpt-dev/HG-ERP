import { describe, expect, it } from 'vitest'
import { dongBo, xepTheoCum } from './ghi-nhom'

describe('xepTheoCum', () => {
  it('gom cụm theo lần xuất hiện đầu, trong cụm giữ thứ tự', () => {
    const out = xepTheoCum([
      { id: 1, cluster: 'Cụm mê' },
      { id: 2, cluster: 'Bàn giữa' },
      { id: 3, cluster: 'Cụm mê' },
      { id: 4, cluster: null },
      { id: 5, cluster: 'Bàn giữa' },
    ])
    expect(out.map((x) => x.id)).toEqual([1, 3, 2, 5, 4])
  })
})

describe('dongBo', () => {
  // Giường Oval 992852 · 832 bộ, số Sơn trong sổ Excel 16/10.
  const lines = [
    { name: 'Vòng ngoài', cluster: 'Cụm mê', needed: 3328, done: 624 },
    { name: 'Thanh hông', cluster: 'Cụm mê', needed: 6656, done: 1248 },
    { name: 'Vòng 1', cluster: 'Cụm mái vòm', needed: 1664, done: 0 },
  ]
  it('MIN ⌊đạt ÷ (cần ÷ SL)⌋ và chỉ ra cụm đang kéo xuống', () => {
    expect(dongBo(lines, 832)).toEqual({ sets: 0, short: ['Cụm mái vòm'] })
    expect(dongBo(lines.slice(0, 2), 832)).toEqual({ sets: 156, short: ['Cụm mê'] })
  })
  it('đủ bộ thì không chỉ ai; làm dư không vượt SL đặt', () => {
    expect(
      dongBo([{ name: 'Chân', cluster: null, needed: 800, done: 900 }], 400),
    ).toEqual({ sets: 400, short: [] })
  })
  it('chưa gán cụm thì chỉ bằng tên dòng; SL đặt 0 thì không tính', () => {
    expect(
      dongBo([{ name: 'Chân', cluster: null, needed: 800, done: 100 }], 400).short,
    ).toEqual(['Chân'])
    expect(dongBo(lines, 0).sets).toBeNull()
  })
})

describe('quyCachDong', () => {
  it('dày × rộng × dài · thành; thiếu số nào bỏ số đó', async () => {
    const { quyCachDong } = await import('./ghi-nhom')
    expect(quyCachDong({ t: 40, w: 40, l: 625, wall: 1.2 })).toBe('40×40×625·1,2')
    expect(quyCachDong({ t: 15, w: 73, l: 69, wall: null })).toBe('15×73×69')
    expect(quyCachDong({ t: null, w: null, l: 625, wall: null })).toBe('625')
    expect(quyCachDong(null)).toBe('')
  })

  it('bản 5 Q20: dấu phẩy kiểu VN, bỏ "·thành" khi thành = dày', async () => {
    const { quyCachDong } = await import('./ghi-nhom')
    expect(quyCachDong({ t: 13.5, w: 50, l: 1145, wall: 1.2 })).toBe('13,5×50×1145·1,2')
    expect(quyCachDong({ t: 2, w: 20, l: 65, wall: 2 })).toBe('2×20×65')
    expect(quyCachDong({ t: 1.75, w: 25, l: 465, wall: 1.75 })).toBe('1,75×25×465')
  })
})

describe('xepTheoCum — tên cụm lệch chữ hoa (Q20)', () => {
  it('"Cụm tựa" và "cụm tựa" là một nhóm', () => {
    const out = xepTheoCum([
      { id: 1, cluster: 'Cụm tựa' },
      { id: 2, cluster: 'Cụm mê' },
      { id: 3, cluster: 'cụm  tựa ' },
    ])
    expect(out.map((x) => x.id)).toEqual([1, 3, 2])
  })
})

describe('maMacDinh', () => {
  const groups = [
    { product_code: 'TB0298HG-AL', lines: [{ remaining: 0 }] },
    { product_code: 'CH0289HG-AL', lines: [{ remaining: 744 }] },
  ]
  it('nhớ mã lần trước nếu lệnh còn mã đó, hoặc "Tất cả"', async () => {
    const { maMacDinh, TAT_CA_MA } = await import('./ghi-nhom')
    expect(maMacDinh(groups, 'TB0298HG-AL')).toBe('TB0298HG-AL')
    expect(maMacDinh(groups, TAT_CA_MA)).toBe(TAT_CA_MA)
  })
  it('không nhớ / mã lạ → mã đầu còn việc; hết việc → mã đầu; rỗng → tất cả', async () => {
    const { maMacDinh, TAT_CA_MA } = await import('./ghi-nhom')
    expect(maMacDinh(groups, null)).toBe('CH0289HG-AL')
    expect(maMacDinh(groups, 'XX')).toBe('CH0289HG-AL')
    expect(maMacDinh([{ product_code: 'A', lines: [{ remaining: 0 }] }], null)).toBe('A')
    expect(maMacDinh([], null)).toBe(TAT_CA_MA)
  })
})
