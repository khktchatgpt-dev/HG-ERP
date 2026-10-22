import { describe, expect, it } from 'vitest'
import { chuanTen, gomChuaMa, type DongChuaMa } from './bom-chua-ma'

const dong = (o: Partial<DongChuaMa>): DongChuaMa => ({
  product_id: 'p1',
  product_code: 'CH0289HG-AL',
  product_qty: 620,
  kind: 'NGU_KIM',
  part_name: 'Gót chân 40x40x5',
  qty: 2,
  unit: 'Cái',
  material_code: null,
  material_note: null,
  ...o,
})

describe('chuanTen', () => {
  it('gom cách viết khác nhau của cùng một con bulông', () => {
    expect(chuanTen('Bu lông M8 x 45')).toBe(chuanTen('Bulon M8x45'))
    expect(chuanTen('  Gót chân 40 x 40 x 5 ')).toBe('gót chân 40x40x5')
  })
})

describe('gomChuaMa', () => {
  it('cộng theo SL lệnh qua nhiều SP, giữ từng SP', () => {
    const r = gomChuaMa([
      dong({}),
      dong({ product_id: 'p2', product_code: 'BN0230HG-AL', product_qty: 115 }),
      dong({ product_id: 'p3', product_code: 'BN0231HG-AL', product_qty: 195 }),
    ])
    expect(r.items).toHaveLength(1)
    expect(r.items[0].qty_total).toBe(2 * 620 + 2 * 115 + 2 * 195)
    expect(r.items[0].products.map((p) => p.code)).toEqual([
      'CH0289HG-AL',
      'BN0230HG-AL',
      'BN0231HG-AL',
    ])
  })

  it('cách viết khác nhau gom một dòng, ghi lại tên khác', () => {
    const r = gomChuaMa([
      dong({ part_name: 'Bu lông M8 x 45' }),
      dong({ product_id: 'p2', part_name: 'Bulon M8x45', product_qty: 10 }),
    ])
    expect(r.items).toHaveLength(1)
    expect(r.items[0].aliases).toEqual(['Bulon M8x45'])
  })

  it('cùng tên khác quy cách là hai vật tư (gối ghế 1 chỗ ≠ ghế 2 chỗ)', () => {
    const r = gomChuaMa([
      dong({ kind: 'CUSHION', part_name: 'Gối', dims: [22, 47, 65] }),
      dong({
        kind: 'CUSHION',
        part_name: 'Gối',
        dims: [220, 470, 650],
        product_id: 'p2',
      }),
      dong({ kind: 'CUSHION', part_name: 'Gối', dims: [22, 47, 65], product_id: 'p3' }),
    ])
    expect(r.items.map((i) => i.quy_cach).sort()).toEqual(['220×470×650', '22×47×65'])
  })

  it('khung chỉ đếm, không liệt kê theo tên vị trí', () => {
    const r = gomChuaMa([dong({ kind: 'FRAME', part_name: 'Chân sau' }), dong({})])
    expect(r.frame_lines).toBe(1)
    expect(r.items.map((i) => i.name)).toEqual(['Gót chân 40x40x5'])
  })

  it('dòng không ghi số thì tổng là chưa rõ, không cộng như 0', () => {
    const r = gomChuaMa([dong({}), dong({ product_id: 'p2', qty: null })])
    expect(r.items[0].qty_total).toBeNull()
  })

  it('mã ghi sai (không có trong danh mục) tách riêng khỏi dòng chưa gắn mã', () => {
    const r = gomChuaMa([dong({}), dong({ material_code: 'XX-1' })])
    expect(r.items).toHaveLength(2)
    expect(r.items.find((i) => i.bad_code)?.bad_code).toBe('XX-1')
  })
})
