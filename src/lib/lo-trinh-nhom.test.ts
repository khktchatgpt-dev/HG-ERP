import { describe, expect, it } from 'vitest'
import { bamCaNhom, demQua, khoaChiTiet, type DongNhom } from './lo-trinh-nhom'

const THU_TU = ['phoi', 'han', 'nguoi', 'mai', 'son', 'moc', 'dan', 'may']
const sapXep = (xs: string[]) =>
  [...new Set(xs)].sort((a, b) => THU_TU.indexOf(a) - THU_TU.indexOf(b))
const KHUNG = ['phoi', 'han', 'nguoi', 'son']

const go = (key: string, route: string[] = []): DongNhom => ({ key, route, macDinh: [] })
const khung = (key: string, route: string[] = KHUNG): DongNhom => ({
  key,
  route,
  macDinh: KHUNG,
})

describe('bấm ô trên dòng tóm tắt một nhóm (Q2)', () => {
  it('9 chi tiết gỗ chưa qua đâu: bấm Gỗ một lần → cả 9 đi Gỗ', () => {
    const ds = Array.from({ length: 9 }, (_, i) => go(`g${i}`))
    const out = bamCaNhom(ds, 'moc', sapXep)
    expect([...out.values()]).toEqual(Array(9).fill(['moc']))
  })

  it('một phần đã qua → bấm là THÊM cho phần còn lại, không bỏ', () => {
    const out = bamCaNhom([go('a', ['may']), go('b')], 'may', sapXep)
    expect(out.get('a')).toEqual(['may'])
    expect(out.get('b')).toEqual(['may'])
  })

  it('mọi dòng đã qua → bấm là BỎ cho cả nhóm; về rỗng thì về mặc định (null)', () => {
    const out = bamCaNhom([go('a', ['may']), go('b', ['may'])], 'may', sapXep)
    expect([...out.values()]).toEqual([null, null])
  })

  it('khung thêm Mài: chèn đúng thứ tự; bỏ Mài lại thì về mặc định nhóm', () => {
    const them = bamCaNhom([khung('k1'), khung('k2')], 'mai', sapXep)
    expect(them.get('k1')).toEqual(['phoi', 'han', 'nguoi', 'mai', 'son'])
    const bo = bamCaNhom(
      [khung('k1', ['phoi', 'han', 'nguoi', 'mai', 'son'])],
      'mai',
      sapXep,
    )
    expect(bo.get('k1')).toBeNull()
  })

  it('demQua đếm số dòng đi qua — dòng tóm tắt bày "3/9"', () => {
    const ds = [
      go('a', ['moc']),
      go('b', ['moc']),
      go('c', ['moc']),
      ...['d', 'e'].map((k) => go(k)),
    ]
    expect(demQua(ds, 'moc')).toBe(3)
  })
})

describe('khoaChiTiet — so chi tiết giữa các đợt cùng mã (Q4)', () => {
  it('không phân biệt hoa thường, khoảng trắng; khác nhóm là khác chi tiết', () => {
    expect(khoaChiTiet('Nệm  phải ', 'CUSHION')).toBe(khoaChiTiet('nệm phải', 'cushion'))
    expect(khoaChiTiet('Gối', 'CUSHION')).not.toBe(khoaChiTiet('Gối', 'FABRIC'))
  })
})
