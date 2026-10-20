import { describe, expect, it } from 'vitest'
import { SPEC_FIELDS, coThongSo, gomThongSo, type SpecLine } from './lsx-spec-summary'

const dong = (code: string, specs: Record<string, string>): SpecLine => ({
  code,
  name: 'Ghế ' + code,
  specs,
})

describe('gomThongSo — nói một câu khi cả lệnh giống nhau', () => {
  it('mọi dòng cùng mã sơn → một câu cho cả lệnh, không liệt kê', () => {
    const g = gomThongSo([
      dong('A1', { son: 'PT-7476' }),
      dong('A2', { son: 'PT-7476' }),
      dong('A3', { son: 'PT-7476' }),
    ])
    const son = g.find((x) => x.key === 'son')!
    expect(son.chung).toBe('PT-7476')
    expect(son.theoGiaTri).toHaveLength(0)
    expect(son.thieu).toBe(0)
  })

  it('bỏ qua khoảng trắng thừa khi so', () => {
    const g = gomThongSo([dong('A1', { go: ' Gỗ keo ' }), dong('A2', { go: 'Gỗ keo' })])
    expect(g.find((x) => x.key === 'go')!.chung).toBe('Gỗ keo')
  })
})

describe('gomThongSo — bày ra đúng chỗ khác nhau', () => {
  it('có dòng khai khác thì liệt kê theo mã SP', () => {
    const g = gomThongSo([dong('A1', { son: 'PT-7476' }), dong('A2', { son: 'PT-9000' })])
    const son = g.find((x) => x.key === 'son')!
    expect(son.chung).toBeNull()
    expect(son.theoGiaTri).toEqual([
      { value: 'PT-7476', codes: ['A1'] },
      { value: 'PT-9000', codes: ['A2'] },
    ])
  })

  /*
    Ca đáng giá nhất: 2/3 dòng giống nhau, một dòng TRỐNG. Nói "cả lệnh dùng
    PT-7476" là nói dối — dòng trống kia có thể là mã không sơn, cũng có thể là
    quên khai, và người mua phải thấy để đi hỏi.
  */
  it('một dòng bỏ trống thì KHÔNG được gộp thành câu cả lệnh', () => {
    const g = gomThongSo([
      dong('A1', { son: 'PT-7476' }),
      dong('A2', { son: 'PT-7476' }),
      dong('A3', {}),
    ])
    const son = g.find((x) => x.key === 'son')!
    expect(son.chung).toBeNull()
    expect(son.theoGiaTri).toEqual([{ value: 'PT-7476', codes: ['A1', 'A2'] }])
    expect(son.thieu).toBe(1)
  })
})

describe('gomThongSo — gom theo GIÁ TRỊ, không theo mã', () => {
  /*
    Đo trên lệnh 01/26-27 ROSCO ngày 16/09/2026: ô "Mây" có 20 mã nhưng chỉ
    HAI giá trị. Liệt kê theo mã ra 20 dòng, 18 dòng lặp chữ y hệt dòng trên.
  */
  it('20 mã hai giá trị → hai dòng, mỗi dòng gom mã của nó', () => {
    const lines = Array.from({ length: 20 }, (_, i) =>
      dong('M' + i, { may: i % 2 === 0 ? 'Coastal Drift' : 'Stormstone' }),
    )
    const may = gomThongSo(lines).find((x) => x.key === 'may')!
    expect(may.theoGiaTri).toHaveLength(2)
    expect(may.theoGiaTri[0].value).toBe('Coastal Drift')
    expect(may.theoGiaTri[0].codes).toHaveLength(10)
    expect(may.theoGiaTri[1].codes).toHaveLength(10)
  })

  it('giữ thứ tự xuất hiện theo dòng lệnh, không sắp xếp lại', () => {
    const g = gomThongSo([
      dong('Z9', { go: 'Gỗ thông' }),
      dong('A1', { go: 'Gỗ keo' }),
      dong('B2', { go: 'Gỗ thông' }),
    ])
    const go = g.find((x) => x.key === 'go')!
    expect(go.theoGiaTri.map((x) => x.value)).toEqual(['Gỗ thông', 'Gỗ keo'])
    expect(go.theoGiaTri[0].codes).toEqual(['Z9', 'B2'])
  })
})

describe('gomThongSo — chỗ trống phải nói ra', () => {
  it('không dòng nào khai thì vẫn trả khoá đó, kèm số dòng thiếu', () => {
    const g = gomThongSo([dong('A1', { son: 'X' }), dong('A2', { son: 'X' })])
    const kinh = g.find((x) => x.key === 'kinh')!
    expect(kinh.chung).toBeNull()
    expect(kinh.theoGiaTri).toHaveLength(0)
    expect(kinh.thieu).toBe(2)
  })

  it('luôn trả đủ năm khoá, đúng thứ tự người mua đọc', () => {
    expect(gomThongSo([]).map((g) => g.key)).toEqual(SPEC_FIELDS.map((f) => f.key))
  })

  it('lệnh chưa khai gì → coThongSo false, để màn bày trạng thái rỗng', () => {
    expect(coThongSo(gomThongSo([dong('A1', {}), dong('A2', {})]))).toBe(false)
    expect(coThongSo(gomThongSo([dong('A1', { nem: 'Olefin kem' })]))).toBe(true)
  })

  it('lệnh không có dòng nào cũng không vỡ', () => {
    const g = gomThongSo([])
    expect(g.every((x) => x.thieu === 0 && x.chung === null)).toBe(true)
  })
})
