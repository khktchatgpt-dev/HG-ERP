import { describe, expect, it } from 'vitest'
import { PRODUCT_TYPES } from './product-code'
import {
  IMPORT_COLUMNS,
  columnForHeader,
  matchOption,
  nearLabel,
  parseBoolCell,
  parseNumberCell,
  planImport,
  type CellValue,
  type ExistingProduct,
  type RawRow,
} from './product-import'

const P = (
  o: Partial<ExistingProduct> & { code: string; name: string },
): ExistingProduct => ({
  id: `id-${o.code}`,
  customer_name: null,
  updated_at: '2026-10-03T01:42:04.794601+00:00',
  locked_at: null,
  packing: {},
  tech_spec: {},
  unit: 'cái',
  ...o,
})

const EXISTING: ExistingProduct[] = [
  P({ code: 'TB0300HG-AL', name: 'Bàn ăn tròn', customer_name: 'MERXX', product_type: 'TB', frame_material: 'AL' }), // prettier-ignore
  P({ code: 'CH0291HG-AL', name: 'Ghế xếp', customer_name: 'ACE' }),
  P({
    code: 'CH0210HG-IR',
    name: 'Ghế Hali stool khung sắt, dây dù',
    customer_name: 'LAURA',
  }),
  P({
    code: 'BN0029HG-AL',
    name: 'Imani 3 Seater Sofa',
    customer_name: 'LAURA',
    product_type: 'BN',
    frame_material: 'AL',
    length_mm: 2000,
    width_mm: 800,
    height_mm: 685,
    material: 'Nhôm (Aluminium)',
    is_upholstered: true,
    packing: { pack_unit_label: 'ctn' },
    tech_spec: { paint: 'RAL 9005' },
  }),
  P({ code: 'ST0209HG-IR', name: 'Bộ Sigrid nhôm', customer_name: 'LAURA', product_type: 'ST', frame_material: 'IR', locked_at: null }), // prettier-ignore
  P({ code: 'TB0100HG-AL', name: 'Bàn đã khoá', locked_at: '2026-09-01T00:00:00Z' }),
  P({ code: 'RHONE-CHAIR', name: 'Rhone chair' }),
  ...Array.from({ length: 16 }, (_, i) => P({ code: `BN${String(200 + i).padStart(4, '0')}HG-AL`, name: `Băng ${i}`, customer_name: 'BUNNINGS' })), // prettier-ignore
]

let n = 4
const row = (cells: Record<string, CellValue>): RawRow => ({ row: n++, cells })

describe('đọc ô', () => {
  it('Loại / Vật liệu: chữ ô thả xuống, mã, nhãn, không dấu', () => {
    for (const s of ['TB — Bàn', 'TB', 'tb', 'Bàn', 'ban', 'tb - ban']) expect(matchOption(s, PRODUCT_TYPES), s).toBe('TB') // prettier-ignore
    expect(matchOption('Bàn tròn', PRODUCT_TYPES)).toBeNull()
  })
  it('số: ô số giữ nguyên, ô chữ đọc kiểu Việt, chặn chữ lạ', () => {
    expect(parseNumberCell(1.234)).toBe(1.234)
    expect(parseNumberCell('1.390')).toBe(1390)
    expect(parseNumberCell('2,5')).toBe(2.5)
    expect(parseNumberCell('2.395,5')).toBe(2395.5)
    expect(parseNumberCell('205 cm')).toBe(205)
    expect(parseNumberCell('0.525')).toBe(0.525)
    expect(parseNumberCell('1/2')).toBeNull()
    expect(parseNumberCell('khoảng 5')).toBeNull()
  })
  it('có / không', () => {
    for (const s of ['có', 'Có', 'x', '✓', '1']) expect(parseBoolCell(s), s).toBe(true)
    for (const s of ['không', 'khong', '0']) expect(parseBoolCell(s), s).toBe(false)
    expect(parseBoolCell('hình như')).toBeNull()
  })
  it('tiêu đề cột: bỏ dấu, hoa thường, dấu * đều nhận', () => {
    expect(columnForHeader('Tên SP (tiếng Việt) *')?.key).toBe('name')
    expect(columnForHeader('ten sp (tieng viet)')?.key).toBe('name')
    expect(columnForHeader('Cột lạ')).toBeNull()
    // Mọi tiêu đề khác nhau sau khi bỏ dấu — không cột nào che cột nào.
    const folded = IMPORT_COLUMNS.map((c) => columnForHeader(c.header)?.key)
    expect(folded).toEqual(IMPORT_COLUMNS.map((c) => c.key))
  })
  it('nhãn khách gần giống', () => {
    expect(nearLabel('BUNNING', ['BUNNINGS', 'ACE'])).toBe('BUNNINGS')
    expect(nearLabel('AE', ['ACE'])).toBeNull()
  })
})

describe('thêm mới', () => {
  it('dòng không mã → thêm, cấp mã liền nhau theo loại; ĐVT trống = "cái"', () => {
    const p = planImport(
      [
        row({ code: '', type: 'TB — Bàn', material: 'AL — Nhôm', name: 'Bàn ăn 180', customer: 'merxx', length_mm: 1800, qty_per_carton: 2, paint: 'RAL 7016' }), // prettier-ignore
        row({ code: '', type: 'CH', material: 'Sắt', name: 'Ghế ăn' }),
        row({ code: '', type: 'TB', material: 'AL', name: 'Bàn trà', unit: 'bộ' }),
      ],
      EXISTING,
    )
    expect(p.rows.map((r) => [r.action, r.code])).toEqual([
      ['create', 'TB0301HG-AL'],
      ['create', 'CH0292HG-IR'],
      ['create', 'TB0302HG-AL'],
    ])
    expect(p.rows[0].write).toMatchObject({
      name: 'Bàn ăn 180',
      product_type: 'TB',
      frame_material: 'AL',
      customer_name: 'MERXX',
      length_mm: 1800,
      unit: 'cái',
      packing: { qty_per_carton: 2 },
      tech_spec: { paint: 'RAL 7016' },
    })
    expect(p.rows[2].write.unit).toBe('bộ')
    expect(p.counts).toMatchObject({ create: 3, update: 0, error: 0 })
    expect(p.byType).toEqual({ TB: 2, CH: 1 })
  })

  it('SP mới thiếu ô bắt buộc → lỗi đúng ô', () => {
    const p = planImport([row({ code: '', type: 'TB', name: '' })], EXISTING)
    expect(p.rows[0].action).toBe('error')
    expect(p.rows[0].errors.map((e) => e.field)).toEqual(['name', 'material'])
  })

  it('mã gõ tay ngoài quy tắc chưa ai dùng → thêm mới kèm cảnh báo', () => {
    const p = planImport([row({ code: 'RHONE-STOOL', type: 'CH', material: 'AL', name: 'Rhone stool' })], EXISTING) // prettier-ignore
    expect(p.rows[0]).toMatchObject({
      action: 'create',
      code: 'RHONE-STOOL',
      codeAuto: false,
      warn: true,
    })
  })

  it('trùng tên + khách với SP có sẵn → cảnh báo gợi điền mã để cập nhật', () => {
    const p = planImport([row({ code: '', type: 'CH', material: 'IR', name: 'ghế hali stool khung sắt, dây dù', customer: 'Laura' })], EXISTING) // prettier-ignore
    expect(p.rows[0].warnings[0].msg).toContain('điền mã CH0210HG-IR')
  })
})

describe('cập nhật', () => {
  it('chỉ ô KHÁC giá trị đang có mới đổi; ô trống giữ nguyên; json gộp với cũ', () => {
    const p = planImport(
      [
        row({
          code: 'BN0029HG-AL',
          name: 'Imani 3 Seater Sofa', // y nguyên
          length_mm: 2000, // y nguyên (số)
          width_mm: '800', // y nguyên (chữ)
          height_mm: '', // trống = giữ
          qty_per_carton: 2, // mới
          carton_l_cm: '205',
          paint: 'RAL 7016', // đổi trong tech_spec
          is_upholstered: 'có', // y nguyên
        }),
      ],
      EXISTING,
    )
    const r = p.rows[0]
    expect(r.action).toBe('update')
    expect(r.changes.map((c) => [c.label, c.before, c.after])).toEqual([
      ['SP / thùng', '(trống)', '2'],
      ['Carton dài (cm)', '(trống)', '205'],
      ['Sơn (mã màu)', 'RAL 9005', 'RAL 7016'],
    ])
    // Không đụng cột nào ngoài thứ đổi; json giữ khoá cũ.
    expect(r.write).toEqual({
      packing: { pack_unit_label: 'ctn', qty_per_carton: 2, carton_l_cm: 205 },
      tech_spec: { paint: 'RAL 7016' },
    })
    expect(p.changedCells).toBe(3)
  })

  it('"-" xoá trắng: cột thường → null, khoá json → bỏ, có/không → false', () => {
    const p = planImport([row({ code: 'BN0029HG-AL', material_main: '-', paint: '-', pack_unit_label: '-', is_upholstered: '-' })], EXISTING) // prettier-ignore
    expect(p.rows[0].write).toEqual({
      material: null,
      is_upholstered: false,
      packing: {},
      tech_spec: {},
    })
  })

  it('xoá ô có/không bày đúng chữ sẽ ghi ("không"), không phải (trống)', () => {
    const p = planImport([row({ code: 'BN0029HG-AL', is_upholstered: '-' })], EXISTING)
    expect(p.rows[0].changes[0]).toMatchObject({ before: 'có', after: 'không' })
  })

  it('"-" ở ô bắt buộc → lỗi', () => {
    const p = planImport([row({ code: 'BN0029HG-AL', name: '-' })], EXISTING)
    expect(p.rows[0].errors[0]).toMatchObject({ field: 'name' })
  })

  it('xuống dòng \\r\\n trong DB và \\n trong Excel là một — không coi là sửa', () => {
    const withCrlf = [
      ...EXISTING,
      P({ code: 'TB0104HG-IR', name: 'Bàn', notes: 'dòng 1\r\ndòng 2' }),
    ]
    const p = planImport(
      [row({ code: 'TB0104HG-IR', notes: 'dòng 1\ndòng 2' })],
      withCrlf,
    )
    expect(p.rows[0].action).toBe('same')
  })

  it('không ô nào khác → "Không đổi", không ghi, không cảnh báo', () => {
    const p = planImport([row({ code: 'BN0029HG-AL', name: 'Imani 3 Seater Sofa', version: 'cũ' })], EXISTING) // prettier-ignore
    expect(p.rows[0]).toMatchObject({
      action: 'same',
      write: {},
      warnings: [],
      warn: false,
    })
    expect(p.counts.same).toBe(1)
  })

  it('mã đúng quy tắc mà không có → lỗi (không âm thầm thêm SP mang số dãy)', () => {
    const p = planImport([row({ code: 'CH0999HG-AL', name: 'X', type: 'CH', material: 'AL' })], EXISTING) // prettier-ignore
    expect(p.rows[0].errors[0].msg).toContain('không có trong thư viện')
  })

  it('hồ sơ khoá → lỗi; mã trùng trong file → lỗi', () => {
    const p = planImport(
      [row({ code: 'TB0100HG-AL', name: 'Đổi' }), row({ code: 'BN0029HG-AL', notes: 'a' }), row({ code: 'bn0029hg-al', notes: 'b' })], // prettier-ignore
      EXISTING,
    )
    expect(p.rows[0].errors[0].msg).toContain('khoá')
    expect(p.rows[1].action).toBe('update')
    expect(p.rows[2].errors[0].msg).toContain('trùng với dòng')
  })

  it('đổi Loại / Vật liệu → cảnh báo mã không đổi theo', () => {
    const p = planImport([row({ code: 'ST0209HG-IR', material: 'AL — Nhôm' })], EXISTING)
    expect(p.rows[0]).toMatchObject({ action: 'update', warn: true })
    expect(p.rows[0].warnings[0].msg).toContain('mã ST0209HG-IR không đổi')
  })

  it('SP sửa trên web sau khi xuất (phiên bản khác) → cảnh báo, vẫn cập nhật', () => {
    const p = planImport([row({ code: 'BN0029HG-AL', notes: 'mới', version: '2026-09-01T00:00:00Z' })], EXISTING) // prettier-ignore
    expect(p.rows[0].action).toBe('update')
    expect(p.rows[0].warnings[0].msg).toContain('sau khi xuất file')
    // Phiên bản khớp → không cảnh báo.
    const q = planImport([row({ code: 'BN0029HG-AL', notes: 'mới', version: '2026-10-03T01:42:04.794601+00:00' })], EXISTING) // prettier-ignore
    expect(q.rows[0].warn).toBe(false)
  })

  it('số sai dạng → lỗi đúng ô; SP/thùng phải nguyên dương', () => {
    const p = planImport([row({ code: 'BN0029HG-AL', width_mm: '1/2', qty_per_carton: '2,5', carton_h_cm: 0 })], EXISTING) // prettier-ignore
    expect(p.rows[0].errors.map((e) => e.field)).toEqual([
      'width_mm',
      'qty_per_carton',
      'carton_h_cm',
    ])
  })
})
