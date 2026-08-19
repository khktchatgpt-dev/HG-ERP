import { describe, it, expect } from 'vitest'
import {
  BOM_LINE_FIELDS,
  bomAiExtractSchema,
  bomDraftLineSchema,
  buildExtractJsonSchema,
} from './bom-ai.schema'

const GROUPS = ['FRAME', 'WOOD', 'NGU_KIM']

const line = (over: Record<string, unknown> = {}) => ({
  part_no: 1,
  part_name: 'Chân trước',
  cluster_name: 'Cụm khung',
  profile_shape: 'HOP',
  profile_code: null,
  material_kind: 'AL',
  dim_a_mm: 18,
  dim_b_mm: 70,
  wall_thickness_mm: 1.4,
  cut_length_mm: 650,
  bend_waste_mm: null,
  tenon_mm: null,
  qty: 4,
  unit: 'cây',
  material_note: null,
  color: null,
  waste_pct: null,
  roll_width_m: null,
  m3_per_sheet: null,
  wood_species: null,
  weight_kg: null,
  total_length_m: null,
  paint_area_m2: null,
  volume_m3: null,
  note: null,
  confidence: 1,
  source_ref: 'BOM!C14',
  ...over,
})

/** Duyệt mọi nút của một JSON Schema. */
function walk(node: unknown, visit: (o: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) {
    for (const n of node) walk(n, visit)
    return
  }
  if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>
    visit(o)
    for (const v of Object.values(o)) walk(v, visit)
  }
}

describe('buildExtractJsonSchema', () => {
  const schema = buildExtractJsonSchema(GROUPS)

  it('khoá group_code vào đúng danh sách nhóm truyền vào', () => {
    const sections = (schema.properties as Record<string, Record<string, unknown>>)
      .sections
    const item = sections.items as Record<string, Record<string, Record<string, unknown>>>
    expect(item.properties.group_code.enum).toEqual(GROUPS)
  })

  it('mọi trường của dòng đều nằm trong required', () => {
    const sections = (schema.properties as Record<string, Record<string, unknown>>)
      .sections
    const item = sections.items as Record<string, Record<string, Record<string, unknown>>>
    const lines = item.properties.lines as unknown as Record<
      string,
      Record<string, unknown>
    >
    expect(lines.items.required).toEqual(BOM_LINE_FIELDS.map((f) => f.name))
  })

  it('trường không bắt buộc thì nullable bằng anyOf, không phải type mảng', () => {
    const sections = (schema.properties as Record<string, Record<string, unknown>>)
      .sections
    const item = sections.items as Record<string, Record<string, Record<string, unknown>>>
    const lines = item.properties.lines as unknown as Record<
      string,
      Record<string, Record<string, Record<string, unknown>>>
    >
    expect(lines.items.properties.note.anyOf).toEqual([
      { type: 'string' },
      { type: 'null' },
    ])
    // part_name bắt buộc → không bọc anyOf.
    expect(lines.items.properties.part_name.type).toBe('string')
  })

  /**
   * Chốt chặn cái bẫy đã suýt vấp: structured outputs của Anthropic và
   * `responseJsonSchema` của Gemini đều KHÔNG nhận các từ khoá ràng buộc miền
   * giá trị. Sinh schema từ `z.toJSONSchema(productPartsBulkSchema)` là dính
   * ngay, nên có test này để lần sau ai đó "tối ưu" cũng đỏ liền.
   */
  it('không chứa từ khoá mà structured outputs từ chối', () => {
    const banned = [
      'minimum',
      'maximum',
      'exclusiveMinimum',
      'exclusiveMaximum',
      'minLength',
      'maxLength',
      'multipleOf',
      'pattern',
    ]
    const hits: string[] = []
    walk(schema, (o) => {
      for (const key of banned) if (key in o) hits.push(key)
    })
    expect(hits).toEqual([])
  })

  it('mọi object đều đóng additionalProperties', () => {
    const open: string[] = []
    walk(schema, (o) => {
      if (o.type === 'object' && o.additionalProperties !== false) open.push('object')
    })
    expect(open).toEqual([])
  })
})

describe('bomDraftLineSchema', () => {
  it('nhận một dòng đầy đủ', () => {
    const r = bomDraftLineSchema.parse(line())
    expect(r.part_name).toBe('Chân trước')
    expect(r.qty).toBe(4)
  })

  it('kẹp confidence về miền 0..1', () => {
    expect(bomDraftLineSchema.parse(line({ confidence: 7.5 })).confidence).toBe(1)
    expect(bomDraftLineSchema.parse(line({ confidence: -2 })).confidence).toBe(0)
    expect(bomDraftLineSchema.parse(line({ confidence: null })).confidence).toBe(0)
  })

  it('bỏ số âm và số vô nghĩa về null thay vì để lọt', () => {
    const r = bomDraftLineSchema.parse(
      line({ dim_a_mm: -5, cut_length_mm: Infinity, wall_thickness_mm: NaN }),
    )
    expect(r.dim_a_mm).toBeNull()
    expect(r.cut_length_mm).toBeNull()
    expect(r.wall_thickness_mm).toBeNull()
  })

  it('loại mã dạng và hệ vật liệu mô hình bịa ra', () => {
    const r = bomDraftLineSchema.parse(
      line({ profile_shape: 'HÌNH THANG', material_kind: 'TITAN' }),
    )
    expect(r.profile_shape).toBeNull()
    expect(r.material_kind).toBeNull()
  })

  it('chuỗi rỗng / toàn khoảng trắng về null', () => {
    const r = bomDraftLineSchema.parse(line({ unit: '   ', note: '' }))
    expect(r.unit).toBeNull()
    expect(r.note).toBeNull()
  })

  it('từ chối dòng không có TÊN — thứ duy nhất khiến dòng vô nghĩa', () => {
    expect(bomDraftLineSchema.safeParse(line({ part_name: '  ' })).success).toBe(false)
  })

  /**
   * File BOM bỏ trống hẳn cột Số lượng là chuyện thường (đo trên "Ghế XC Tilos":
   * trống cả 11 dòng). Trước đây `qty` bắt buộc nên prompt phải dặn "ô trống
   * hiểu là 1" — tức là BẢO mô hình bịa số đi thẳng vào giá thành. Giờ để null
   * và người dùng điền ở màn duyệt.
   */
  it('SL trống / 0 / âm đều về null chứ không loại dòng, không bịa thành 1', () => {
    expect(bomDraftLineSchema.parse(line({ qty: null })).qty).toBeNull()
    expect(bomDraftLineSchema.parse(line({ qty: 0 })).qty).toBeNull()
    expect(bomDraftLineSchema.parse(line({ qty: -3 })).qty).toBeNull()
    expect(bomDraftLineSchema.parse(line({ qty: 4 })).qty).toBe(4)
  })

  /**
   * Cột "Loại" của biểu mẫu chứa MÃ KHUÔN chứ không phải hình dạng ở rất nhiều
   * file (TD-B768, td-hg04, DT-BD-02). Trước đây không có chỗ chứa nên mã bị
   * mất trắng hoặc bị ép thành một hình dạng sai.
   */
  it('giữ nguyên mã khuôn ở profile_code, không ép thành hình dạng', () => {
    const r = bomDraftLineSchema.parse(
      line({ profile_shape: null, profile_code: 'td-hg04' }),
    )
    expect(r.profile_code).toBe('td-hg04')
    expect(r.profile_shape).toBeNull()
  })

  it('part_no lẻ (1.5) về null chứ không làm tròn', () => {
    expect(bomDraftLineSchema.parse(line({ part_no: 1.5 })).part_no).toBeNull()
  })
})

describe('bomAiExtractSchema', () => {
  it('nhận nguồn là file đã đính', () => {
    const r = bomAiExtractSchema.safeParse({
      source: { kind: 'file', file_id: '11111111-1111-4111-8111-111111111111' },
    })
    expect(r.success).toBe(true)
  })

  it('từ chối mime ngoài danh sách', () => {
    const r = bomAiExtractSchema.safeParse({
      source: {
        kind: 'upload',
        filename: 'bom.txt',
        mime: 'text/plain',
        data_base64: 'AAAA',
      },
    })
    expect(r.success).toBe(false)
  })
})

/**
 * Hai luật ĐỔI CHIỀU ngày 19/08/2026 — canh để đợt sửa prompt sau không lỡ tay
 * quay về nếp cũ.
 */
describe('luật trích 19/08/2026', () => {
  it('CÓ trích số dẫn xuất file ghi sẵn (trước đây cố tình bỏ)', () => {
    const names = BOM_LINE_FIELDS.map((f) => f.name)
    for (const k of ['total_length_m', 'paint_area_m2', 'volume_m3', 'weight_kg'])
      expect(names).toContain(k)

    const r = bomDraftLineSchema.parse(
      line({ total_length_m: 2.99, paint_area_m2: 0.6283, volume_m3: 0.002763 }),
    )
    expect(r.total_length_m).toBe(2.99)
    expect(r.paint_area_m2).toBe(0.6283)
    expect(r.volume_m3).toBe(0.002763)
  })

  it('KHÔNG có trường tiền nào — định mức chỉ ghi nhận định mức', () => {
    const names = BOM_LINE_FIELDS.map((f) => f.name).join(' ')
    for (const k of ['price', 'gia', 'amount', 'cost', 'supplier', 'ncc'])
      expect(names.toLowerCase()).not.toContain(k)
  })

  it('cảnh báo bẫy "K. Lượng (m3)" nằm ngay trong mô tả weight_kg', () => {
    // Chính luật này đã cắn bom-import-all.mjs: 232 dòng m³ chui vào ô kg.
    const w = BOM_LINE_FIELDS.find((f) => f.name === 'weight_kg')!
    expect(w.desc).toMatch(/m3/i)
    expect(w.desc).toMatch(/volume_m3/)
  })

  it('có đủ cột đặc trưng của nhóm sơn và nhóm vải', () => {
    const names = BOM_LINE_FIELDS.map((f) => f.name)
    expect(names).toContain('color') // Màu sơn
    expect(names).toContain('waste_pct') // hao hụt vải %
    expect(names).toContain('roll_width_m') // khổ vải
  })
})
