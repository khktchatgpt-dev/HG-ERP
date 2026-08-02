import { describe, expect, it } from 'vitest'
import { CANONICAL_UNITS, normalizeUnit } from './unit'

describe('normalizeUnit', () => {
  it('hoa/thường về đúng nhãn chuẩn', () => {
    expect(normalizeUnit('cái')).toBe('Cái')
    expect(normalizeUnit('CÂY')).toBe('Cây')
    expect(normalizeUnit('kg')).toBe('Kg')
  })

  /*
   * HỒI QUY: danh mục thật từng có HAI chuỗi "cái" trông y hệt nhau —
   * 63 e1 69 (á dựng sẵn) và 63 61 301 69 (a + dấu sắc rời). 5 vật tư mang
   * chuỗi thứ hai; lọc theo ĐVT là mất đúng 5 dòng và không ai nhìn ra.
   */
  it('dấu tổ hợp (NFD) và dấu dựng sẵn (NFC) ra CÙNG một nhãn', () => {
    const nfd = 'cái' // c + a + dấu sắc rời
    const nfc = 'cái'
    expect(nfd).not.toBe(nfc) // hai chuỗi khác nhau thật
    expect(normalizeUnit(nfd)).toBe(normalizeUnit(nfc))
    expect(normalizeUnit(nfd)).toBe('Cái')
  })

  it('gọn khoảng trắng thừa', () => {
    expect(normalizeUnit('  cây  ')).toBe('Cây')
    expect(normalizeUnit('m³')).toBe('M³')
  })

  it('ĐVT ngoài danh mục thì GIỮ NGUYÊN, không ép về "Cái"', () => {
    // Xưởng có đơn vị thật nằm ngoài 55 nhãn; ép bừa là sai dữ liệu.
    expect(normalizeUnit('Bành')).toBe('Bành')
    expect(normalizeUnit(' khối gỗ ')).toBe('khối gỗ')
  })

  it('rỗng vẫn rỗng — schema lo phần bắt buộc', () => {
    expect(normalizeUnit('')).toBe('')
    expect(normalizeUnit(null)).toBe('')
  })

  it('55 nhãn, không trùng nhau sau khi thường hoá', () => {
    expect(CANONICAL_UNITS).toHaveLength(55)
    const keys = new Set(CANONICAL_UNITS.map((u) => u.toLowerCase().normalize('NFC')))
    expect(keys.size).toBe(55)
  })

  it('mọi nhãn chuẩn tự khớp chính nó', () => {
    for (const u of CANONICAL_UNITS) expect(normalizeUnit(u)).toBe(u)
  })
})
