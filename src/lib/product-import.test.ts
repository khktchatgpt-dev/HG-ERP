import { describe, expect, it } from 'vitest'
import { PRODUCT_TYPES } from './product-code'
import {
  matchOption,
  nearLabel,
  planImport,
  type ExistingProduct,
  type ImportField,
  type RawRow,
} from './product-import'

const EXISTING: ExistingProduct[] = [
  { code: 'TB0300HG-AL', name: 'Bàn ăn tròn', customer_name: 'MERXX' },
  { code: 'CH0291HG-AL', name: 'Ghế xếp', customer_name: 'ACE' },
  {
    code: 'CH0210HG-IR',
    name: 'Ghế Hali stool khung sắt, dây dù',
    customer_name: 'LAURA',
  },
  { code: 'CH0052HG-AL', name: 'Folding Chair', customer_name: 'ACE' },
  { code: 'RHONE-CHAIR', name: 'Rhone chair', customer_name: null },
  ...Array.from({ length: 16 }, (_, i) => ({ code: `BN${String(200 + i).padStart(4, '0')}HG-AL`, name: `Băng ${i}`, customer_name: 'BUNNINGS' })), // prettier-ignore
]

let n = 3
function row(c: Partial<Record<ImportField, string>>): RawRow {
  return {
    row: n++,
    cells: { type: '', material: '', code: '', name: '', name_foreign: '', customer: '', unit: '', ...c }, // prettier-ignore
  }
}

describe('matchOption', () => {
  it('nhận chữ ô thả xuống, mã, nhãn, không dấu, gạch nối khác kiểu', () => {
    for (const s of [
      'TB — Bàn',
      'TB',
      'tb',
      'Bàn',
      'ban',
      'BÀN',
      'tb - ban',
      'TB – Bàn',
    ]) {
      expect(matchOption(s, PRODUCT_TYPES), s).toBe('TB')
    }
    expect(matchOption('Băng ghế / sofa bank', PRODUCT_TYPES)).toBe('BN')
    expect(matchOption('Bàn tròn', PRODUCT_TYPES)).toBeNull()
    expect(matchOption('', PRODUCT_TYPES)).toBeNull()
  })
})

describe('nearLabel', () => {
  it('bắt nhãn lệch một ký tự, bỏ qua nhãn trùng hẳn và nhãn ngắn', () => {
    expect(nearLabel('BUNNING', ['BUNNINGS', 'ACE'])).toBe('BUNNINGS')
    expect(nearLabel('BUNNINGS', ['BUNNINGS', 'BUNNING'])).toBeNull()
    expect(nearLabel('AE', ['ACE'])).toBeNull()
    expect(nearLabel('YOTRIO', ['ROSCO'])).toBeNull()
  })
})

describe('planImport', () => {
  it('cấp mã liền nhau theo loại, tiếp sau số lớn nhất của thư viện', () => {
    const p = planImport(
      [
        row({ type: 'TB — Bàn', material: 'AL — Nhôm', name: 'Bàn ăn chữ nhật 180', customer: 'merxx' }), // prettier-ignore
        row({ type: 'CH — Ghế', material: 'AL — Nhôm', name: 'Ghế ăn có tay' }),
        row({ type: 'TB', material: 'Sắt', name: 'Bàn trà' }),
      ],
      EXISTING,
    )
    expect(p.rows.map((r) => r.code)).toEqual([
      'TB0301HG-AL',
      'CH0292HG-AL',
      'TB0302HG-IR',
    ])
    expect(p.rows.every((r) => r.codeAuto)).toBe(true)
    expect(p.rows[0].customer).toBe('MERXX')
    expect(p.rows[0].unit).toBe('cái')
    expect(p.counts).toEqual({ total: 3, ok: 3, warn: 0, error: 0 })
    expect(p.byType).toEqual({ TB: 2, CH: 1 })
  })

  it('mã gõ tay đẩy số tự cấp lên, kể cả khi dòng gõ tay nằm DƯỚI', () => {
    const p = planImport(
      [
        row({ type: 'CH', material: 'AL', name: 'Ghế A' }),
        row({ type: 'CH', material: 'AL', code: 'ch0400hg-al', name: 'Ghế B' }),
      ],
      EXISTING,
    )
    expect(p.rows[0].code).toBe('CH0401HG-AL')
    expect(p.rows[1].code).toBe('CH0400HG-AL')
    expect(p.rows[1].codeAuto).toBe(false)
  })

  it('mã đã có, mã trùng trong file, mã lệch loại → lỗi; dòng lỗi không được cấp mã', () => {
    const p = planImport(
      [
        row({ type: 'CH', material: 'AL', code: 'CH0052HG-AL', name: 'Folding Chair' }),
        row({ type: 'CH', material: 'AL', code: 'CH0500HG-AL', name: 'X' }),
        row({ type: 'CH', material: 'AL', code: 'CH0500HG-AL', name: 'Y' }),
        row({ type: 'TB', material: 'AL', code: 'CH0501HG-AL', name: 'Z' }),
        row({ type: 'Bàn tròn', material: 'AL', name: 'Bàn tròn D90' }),
        row({ type: 'TB', material: '', name: '' }),
      ],
      EXISTING,
    )
    const [taken, first, dup, wrongType, badType, empty] = p.rows
    expect(taken.errors[0].msg).toContain('Mã đã có')
    expect(taken.errors[0].msg).toContain('Folding Chair')
    // Mã đã có = chính SP đó; không cảnh báo trùng tên thêm lần nữa.
    expect(taken.warnings).toEqual([])
    expect(first.status).toBe('ok')
    expect(dup.errors[0].msg).toContain('dòng')
    expect(wrongType.errors[0].msg).toContain('loại CH')
    expect(badType.errors[0]).toMatchObject({ field: 'type' })
    expect(badType.code).toBeNull()
    expect(empty.errors.map((e) => e.field)).toEqual(['material', 'name'])
    expect(p.counts.error).toBe(5)
  })

  it('mã cũ ngoài quy tắc gõ tay được, miễn chưa ai dùng', () => {
    const p = planImport([row({ type: 'CH', material: 'AL', code: 'RHONE-STOOL', name: 'Rhone stool' })], EXISTING) // prettier-ignore
    expect(p.rows[0]).toMatchObject({
      status: 'ok',
      code: 'RHONE-STOOL',
      codeAuto: false,
    })
  })

  it('trùng tên + khách với thư viện hoặc trong file, nhãn gần giống → cảnh báo, vẫn thêm', () => {
    const p = planImport(
      [
        row({ type: 'CH', material: 'IR', name: 'ghế hali stool khung sắt, dây dù', customer: 'Laura' }), // prettier-ignore
        row({ type: 'BN', material: 'AL', name: 'Băng ghế 3 chỗ', customer: 'BUNNING' }),
        row({ type: 'BN', material: 'AL', name: 'Băng ghế 3 chỗ', customer: 'BUNNING' }),
      ],
      EXISTING,
    )
    expect(p.rows[0].status).toBe('warn')
    expect(p.rows[0].warnings[0].msg).toContain('CH0210HG-IR')
    expect(p.rows[0].code).toBe('CH0292HG-IR')
    expect(p.rows[1].warnings.map((w) => w.field)).toEqual(['customer'])
    expect(p.rows[1].warnings[0].msg).toContain('BUNNINGS')
    expect(p.rows[1].warnings[0].msg).toContain('16 SP')
    expect(p.rows[2].warnings.map((w) => w.msg).join()).toContain('dòng')
    expect(p.counts).toMatchObject({ warn: 3, error: 0 })
  })

  it('chữ quá dài → lỗi đúng ô', () => {
    const p = planImport(
      [row({ type: 'TB', material: 'AL', name: 'x'.repeat(201) })],
      EXISTING,
    )
    expect(p.rows[0].errors[0]).toMatchObject({ field: 'name' })
  })
})
