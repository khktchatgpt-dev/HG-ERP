import { describe, expect, it } from 'vitest'
import {
  columnForHeader,
  optionCode,
  parseVnNum,
  planRows,
  type ExistingSp,
  type RawRow,
} from './sp-excel'

const pk = {
  pk_qty: 1,
  pk_l: 101,
  pk_w: 62,
  pk_h: 10.5,
  pk_nw: 11,
  pk_gw: 12.6,
  pk_cbm: null,
  pk_hc: 865,
}
const keros: ExistingSp = {
  id: 'p1',
  code: 'CH0195HG-IN',
  name: 'Ghế 5 bậc Keros',
  product_type: 'CH',
  frame_material: 'IN',
  name_foreign: 'Sessel Keros',
  customer_name: 'MERXX',
  customer_item_code: '22120-011',
  unit: 'cái',
  length_mm: 700,
  width_mm: 600,
  height_mm: 1170,
  net_weight_kg: null,
  actual_weight_kg: null,
  material: 'Inox 304',
  tech_spec: { wood: 'Keo FSC' },
  barcode: null,
  description_en: null,
  notes: null,
  is_active: true,
  locked_at: null,
  updated_at: '2026-10-08T00:00:00Z',
  image_file_id: 'f1',
  pk,
}
const row = (cells: RawRow['cells'], extra?: Partial<RawRow>): RawRow => ({
  row: 4,
  cells,
  ...extra,
})

describe('sp-excel', () => {
  it('đọc cột theo tiêu đề, bỏ dấu * và khoảng trắng thừa', () => {
    expect(columnForHeader('Tên SP')?.key).toBe('name')
    expect(columnForHeader('  Tên SP *')?.key).toBe('name')
    expect(columnForHeader('Vật liệu khung')?.key).toBe('frame_material')
    expect(columnForHeader('Cột lạ')).toBeUndefined()
  })
  it('ô thả xuống nhận cả "CH — Ghế", "CH" và "Ghế"', () => {
    const T = [
      { code: 'CH', label: 'Ghế' },
      { code: 'TB', label: 'Bàn' },
    ]
    expect(optionCode('CH — Ghế', T)).toBe('CH')
    expect(optionCode('ch', T)).toBe('CH')
    expect(optionCode('Bàn', T)).toBe('TB')
    expect(optionCode('Tủ', T)).toBeUndefined()
    expect(optionCode('', T)).toBeNull()
  })
  it('số kiểu VN: 1.390 là nghìn, 2,5 là lẻ; số thật từ Excel giữ nguyên', () => {
    expect(parseVnNum('1.390')).toBe(1390)
    expect(parseVnNum('2,5')).toBe(2.5)
    expect(parseVnNum(1170)).toBe(1170)
    expect(parseVnNum('abc')).toBeUndefined()
    expect(parseVnNum('')).toBeNull()
  })
  it('ô trống giữ nguyên, "-" xoá trắng, chỉ ô khác giá trị mới thành thay đổi', () => {
    const r = planRows(
      [
        row({
          code: 'CH0195HG-IN',
          name: '',
          height_mm: '1.180',
          material: '-',
          ts_wood: 'Keo FSC',
          ts_paint: 'RAL 9005',
          pk_nw: 11,
        }),
      ],
      [keros],
    )
    const p = r.rows[0]
    expect(p.action).toBe('update')
    expect(p.write).toEqual({ height_mm: 1180, material: null })
    expect(p.tech).toEqual({ paint: 'RAL 9005' })
    expect(p.pk).toBeNull()
    expect(p.changes.map((c) => c.key).sort()).toEqual([
      'height_mm',
      'material',
      'ts_paint',
    ])
    expect(r.counts.update).toBe(1)
  })
  it('dòng không mã = thêm mới, cần Tên + Loại + Khung', () => {
    const r = planRows(
      [
        row({ name: 'Bàn mới', product_type: 'TB — Bàn', frame_material: 'AL' }),
        row({ name: 'Thiếu loại' }),
      ],
      [],
    )
    expect(r.rows[0].action).toBe('create')
    expect(r.rows[0].type).toBe('TB')
    expect(r.rows[0].material).toBe('AL')
    expect(r.rows[1].action).toBe('error')
    expect(r.rows[1].errors.join(' ')).toMatch(/Loại/)
  })
  it('mã lạ, hồ sơ khoá, mã lặp đều là lỗi; không đổi gì = không đổi', () => {
    const r = planRows(
      [
        row({ code: 'XX9999HG-AL', name: 'x' }),
        row({ code: 'CH0195HG-IN', name: 'Ghế 5 bậc Keros' }),
        row({ code: 'CH0195HG-IN' }),
      ],
      [keros],
    )
    expect(r.rows[0].action).toBe('error')
    expect(r.rows[1].action).toBe('unchanged')
    expect(r.rows[2].action).toBe('error')
    const locked = planRows(
      [row({ code: 'CH0195HG-IN', name: 'Đổi' })],
      [{ ...keros, locked_at: '2026-10-01' }],
    )
    expect(locked.rows[0].action).toBe('error')
  })
  it('ảnh: cùng vân tay với "Ảnh gốc" thì không tính là ảnh mới', () => {
    const same = planRows(
      [
        row(
          { code: 'CH0195HG-IN', image_ref: 'f1|abc' },
          { image: { sha: 'abc', ext: 'png', bytes: 10 } },
        ),
      ],
      [keros],
    )
    expect(same.rows[0].newImage).toBe(false)
    expect(same.rows[0].action).toBe('unchanged')
    const diff = planRows(
      [
        row(
          { code: 'CH0195HG-IN', image_ref: 'f1|abc' },
          { image: { sha: 'zzz', ext: 'png', bytes: 10 } },
        ),
      ],
      [keros],
    )
    expect(diff.rows[0].newImage).toBe(true)
    expect(diff.rows[0].action).toBe('update')
    expect(diff.counts.image).toBe(1)
  })
  it('đổi Loại trên SP đang có: cho đổi nhưng cảnh báo mã không đổi theo', () => {
    const r = planRows([row({ code: 'CH0195HG-IN', product_type: 'TB' })], [keros])
    expect(r.rows[0].action).toBe('update')
    expect(r.rows[0].warnings.join(' ')).toMatch(/không đổi theo/)
  })
})
