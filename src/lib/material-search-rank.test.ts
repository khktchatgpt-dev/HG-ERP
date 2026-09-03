import { describe, expect, it } from 'vitest'
import { matchScore, rankMaterials } from './material-search-rank'

const m = (code: string, name: string) => ({ code, name })

describe('matchScore — gõ gần đúng tên phải thắng khớp rời rạc', () => {
  it('khớp cả cụm hơn khớp từng từ rời', () => {
    const phrase = matchScore('thung carton', m('BB-1', 'Thùng carton hộp chân bàn'))
    const scattered = matchScore('thung carton', m('BB-2', 'Thùng đựng dầu, lót carton'))
    expect(phrase).toBeGreaterThan(scattered)
  })

  it('đứng đầu tên hơn nằm giữa', () => {
    expect(matchScore('nhom hop', m('NH-1', 'Nhôm hộp 20x40'))).toBeGreaterThan(
      matchScore('nhom hop', m('NH-2', 'Kệ đỡ nhôm hộp mạ')),
    )
  })

  it('gõ trúng mã thắng mọi khớp theo tên', () => {
    expect(matchScore('sat0046', m('SAT0046', 'Bulong 6x30x12 inox 304'))).toBe(100)
    expect(matchScore('sat00', m('SAT0046', 'Bulong 6x30'))).toBe(80)
  })

  it('không dấu, đảo dấu câu vẫn khớp (cùng luật với search_text ở DB)', () => {
    expect(matchScore('vit 4x15', m('VIT-1', 'Vít 4x15'))).toBeGreaterThan(0)
    expect(matchScore('VÍT 4X15', m('VIT-1', 'Vít 4x15'))).toBeGreaterThan(0)
  })

  it('không khớp từ nào → 0, không lọt vào danh sách', () => {
    expect(matchScore('bulong', m('MUT-1', 'Mút D15 1400x510'))).toBe(0)
  })

  it('thế hoà thì tên gọn hơn lên trước', () => {
    expect(matchScore('vit 4x15', m('V1', 'Vít 4x15'))).toBeGreaterThan(
      matchScore('vit 4x15', m('V2', 'Vít 4x15 đầu bằng ren gỗ xi trắng 7 màu')),
    )
  })
})

describe('rankMaterials', () => {
  const rows = [
    m('BB-0027', 'BB 2 bank 2'),
    m('BB-0500', 'Thùng carton hộp chân bàn nhôm kính 80(120)x70cm'),
    m('BB-0100', 'Tấm lót thùng carton'),
  ]

  it('cái gõ gần đúng lên đầu, không phải cái đứng đầu bảng chữ cái', () => {
    const out = rankMaterials('thung carton hop chan ban', rows)
    expect(out[0].code).toBe('BB-0500')
  })

  it('điểm chữ thắng tín hiệu dùng thật — đang dùng chỉ phá thế hoà', () => {
    const out = rankMaterials('thung carton hop chan ban', rows, (x) => ({
      used: x.code === 'BB-0027',
    }))
    expect(out[0].code).toBe('BB-0500')

    const tie = [m('A-1', 'Vít 4x15'), m('A-2', 'Vít 4x15')]
    const ranked = rankMaterials('vit 4x15', tie, (x) => ({ used: x.code === 'A-2' }))
    expect(ranked[0].code).toBe('A-2')
  })
})
