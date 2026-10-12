import { describe, expect, it } from 'vitest'
import { tinhHangLenh, type DongDonLenh } from './kho-hang-lenh'

const vt = new Map([
  ['m-vit', { code: 'NK-0083', name: 'vít 4x20, 7M', unit: 'Con' }],
  ['m-lds', { code: 'BUL0606', name: 'LĐS 8x20x2', unit: 'cái' }],
  ['m-kinh', { code: 'KIM0161', name: 'Kính sơn màu 625x399x5mm', unit: 'Tấm' }],
  ['m-tang', { code: 'PKN0289', name: 'Tăng đơ', unit: 'Cái' }],
])
const dong = (
  p: Partial<DongDonLenh> & Pick<DongDonLenh, 'line_id' | 'material_id'>,
): DongDonLenh => ({
  qty_ordered: 100,
  phan_lenh: 100,
  ...p,
})
const chay = (
  d: DongDonLenh[],
  nhan: [string, number][],
  xuat: [string, number][],
  ton: [string, number][],
) =>
  tinhHangLenh({
    dong: d,
    nhanTheoDong: new Map(nhan),
    daXuat: new Map(xuat),
    ton: new Map(ton),
    vatTu: vt,
  })

describe('tinhHangLenh', () => {
  it('09-MX: đã về 12.154, chưa xuất, kho còn đủ → gợi ý lấy hết phần của lệnh', () => {
    const r = chay(
      [
        dong({
          line_id: 'l1',
          material_id: 'm-vit',
          qty_ordered: 12154,
          phan_lenh: 12154,
        }),
      ],
      [['l1', 12154]],
      [],
      [['m-vit', 12154]],
    )
    expect(r).toEqual([
      { material_id: 'm-vit', code: 'NK-0083', name: 'vít 4x20, 7M', unit: 'Con', ve: 12154, xuat: 0, con: 12154, ton: 12154, goi_y: 12154, het: false }, // prettier-ignore
    ])
  })

  it('YOTRIO BUL0606: lệnh còn 2.322 mà kho chỉ 810 → gợi ý 810', () => {
    const [x] = chay([dong({ line_id: 'l', material_id: 'm-lds', qty_ordered: 2322, phan_lenh: 2322 })], [['l', 2322]], [], [['m-lds', 810]]) // prettier-ignore
    expect([x.con, x.ton, x.goi_y, x.het]).toEqual([2322, 810, 810, false])
  })

  it('PKN0289: kho còn 1.950 (có phần lệnh khác) → gợi ý chỉ phần của lệnh 741,6', () => {
    const [x] = chay([dong({ line_id: 'l', material_id: 'm-tang', qty_ordered: 741.6, phan_lenh: 741.6 })], [['l', 741.6]], [], [['m-tang', 1950]]) // prettier-ignore
    expect(x.goi_y).toBe(741.6)
  })

  it('08-MX: đã về nhưng kho hết → vẫn bày, mờ, không gợi ý; xếp sau mã còn tồn', () => {
    const r = chay(
      [
        dong({ line_id: 'a', material_id: 'm-kinh', qty_ordered: 1350, phan_lenh: 1350 }),
        dong({ line_id: 'b', material_id: 'm-vit' }),
      ],
      [['a', 1350], ['b', 100]], // prettier-ignore
      [],
      [['m-vit', 5]],
    )
    expect(r.map((x) => [x.code, x.het, x.goi_y])).toEqual([
      ['NK-0083', false, 5],
      ['KIM0161', true, 0],
    ])
  })

  it('trừ xuất RÒNG; xuất đủ thì không còn dòng; hoàn kho nhiều hơn xuất không thành âm', () => {
    const d = [dong({ line_id: 'l', material_id: 'm-vit' })]
    expect(chay(d, [['l', 100]], [['m-vit', 40]], [['m-vit', 60]])[0].con).toBe(60)
    expect(chay(d, [['l', 100]], [['m-vit', 100]], [['m-vit', 60]])).toEqual([])
    expect(chay(d, [['l', 100]], [['m-vit', -20]], [['m-vit', 100]])[0].xuat).toBe(0)
  })

  it('đơn gộp lệnh đã chia (0185): đã về chia theo tỉ lệ phần của lệnh (Q2)', () => {
    // Dòng 1.350, lệnh này được chia 550; về 1.000 → của lệnh 1.000 × 550/1.350.
    const [x] = chay([dong({ line_id: 'l', material_id: 'm-kinh', qty_ordered: 1350, phan_lenh: 550 })], [['l', 1000]], [], [['m-kinh', 1000]]) // prettier-ignore
    expect(x.ve).toBeCloseTo(407.4074, 4)
  })

  it('cộng nhiều dòng (nhiều đơn) cùng một mã; bỏ dòng chưa về / phần 0', () => {
    const r = chay(
      [
        dong({ line_id: 'l1', material_id: 'm-vit' }),
        dong({ line_id: 'l2', material_id: 'm-vit' }),
        dong({ line_id: 'l3', material_id: 'm-vit', phan_lenh: 0 }),
        dong({ line_id: 'l4', material_id: 'm-lds' }),
      ],
      [['l1', 100], ['l2', 30], ['l3', 100]], // prettier-ignore
      [],
      [['m-vit', 500]],
    )
    expect(r.map((x) => [x.code, x.ve])).toEqual([['NK-0083', 130]])
  })
})
