import { describe, it, expect } from 'vitest'
import {
  buildImportedRows,
  guessField,
  looksLikeHeader,
  matchMaterial,
  parseDelimited,
  parseNum,
  type BomField,
} from './bom-import'

const MATERIALS = [
  { id: 'm-sat', code: 'VT-SAT-H25', name: 'Sắt hộp 25×25×1.2mm (cây 6m)' },
  { id: 'm-nhom', code: 'VT-NHOM-OT25', name: 'Ống nhôm tròn Ø25×1.2mm (cây 6m)' },
  { id: 'm-son', code: 'VT-SON-001', name: 'Sơn PU 2K (bộ base+cứng)' },
]

describe('parseDelimited', () => {
  it('tab (dán từ Excel) thắng, trim ô, bỏ dòng trống', () => {
    const rows = parseDelimited('a\tb, c\t d \n\n1\t2\t3\n')
    expect(rows).toEqual([
      ['a', 'b, c', 'd'],
      ['1', '2', '3'],
    ])
  })

  it('CSV tôn trọng ngoặc kép + "" escape trong ô quoted; " giữa ô là ký tự thường', () => {
    const rows = parseDelimited('"KHUNG, CHÂN",2\n"TỰA ""A""",1\nTỰA "B",3')
    expect(rows).toEqual([
      ['KHUNG, CHÂN', '2'],
      ['TỰA "A"', '1'],
      ['TỰA "B"', '3'],
    ])
  })
})

describe('guessField — tiêu đề tiếng Việt có/không dấu', () => {
  const cases: [string, BomField][] = [
    ['Cụm', 'cluster'],
    ['Tên chi tiết', 'name'],
    ['CHI TIET', 'name'],
    ['Mã VT', 'material'],
    ['Vật tư', 'material'],
    ['Loại VT', 'material_type'],
    ['Dày', 'spec_thickness_mm'],
    ['Rộng', 'spec_width_mm'],
    ['Dài (mm)', 'spec_length_mm'],
    ['CT/SP', 'qty_per_unit'],
    ['SL/SP', 'qty_per_unit'],
    ['ĐM kg', 'dm_kg'],
    ['CT/cây', 'pcs_per_bar'],
    ['Ghi chú', 'note'],
    ['Cột lạ hoắc', 'skip'],
  ]
  it.each(cases)('%s → %s', (header, field) => {
    expect(guessField(header)).toBe(field)
  })
})

describe('looksLikeHeader', () => {
  it('dòng tiêu đề thật → true; dòng số liệu → false', () => {
    expect(looksLikeHeader(['Cụm', 'Chi tiết', 'CT/SP', 'ĐM kg'])).toBe(true)
    expect(looksLikeHeader(['CỤM TỰA', 'TAY+TỰA', '2', '1.5'])).toBe(false)
  })
})

describe('matchMaterial', () => {
  it('trùng mã (không phân hoa thường) thắng', () => {
    expect(matchMaterial('vt-sat-h25', MATERIALS)).toBe('m-sat')
  })
  it('mã nằm trong chuỗi dài', () => {
    expect(matchMaterial('Sắt VT-SAT-H25 loại 1', MATERIALS)).toBe('m-sat')
  })
  it('khớp theo tên gần đúng', () => {
    expect(matchMaterial('ống nhôm tròn', MATERIALS)).toBe('m-nhom')
  })
  it('không khớp → null', () => {
    expect(matchMaterial('kính cường lực 8mm', MATERIALS)).toBeNull()
  })
})

describe('parseNum — số kiểu Việt', () => {
  it.each([
    ['12', 12],
    ['1,5', 1.5],
    ['1.234,5', 1234.5],
    ['', ''],
    ['abc', ''],
  ] as const)('%s → %s', (input, out) => {
    expect(parseNum(input)).toBe(out)
  })
})

describe('buildImportedRows', () => {
  const mapping: BomField[] = ['cluster', 'name', 'material', 'qty_per_unit', 'dm_kg']

  it('bỏ dòng thiếu tên; cụm trống kế thừa dòng trên (ô gộp)', () => {
    const { rows } = buildImportedRows(
      [
        ['CỤM KHUNG', 'KHUNG CHÂN', 'VT-SAT-H25', '2', '1,5'],
        ['', 'THANH GIẰNG', 'VT-SAT-H25', '4', '0,6'],
        ['', '', '', '', ''],
      ],
      mapping,
      MATERIALS,
    )
    expect(rows.length).toBe(2)
    expect(rows[1].cluster).toBe('CỤM KHUNG')
    expect(rows[0].material_id).toBe('m-sat')
    expect(rows[0].dm_kg).toBe(1.5)
  })

  it('vật tư không khớp → đếm + giữ text trong ghi chú', () => {
    const { rows, unmatched_materials } = buildImportedRows(
      [['', 'MẶT KÍNH', 'kính cường lực 8mm', '1', '']],
      mapping,
      MATERIALS,
    )
    expect(unmatched_materials).toBe(1)
    expect(rows[0].material_id).toBe('')
    expect(rows[0].note).toContain('kính cường lực 8mm')
  })
})
