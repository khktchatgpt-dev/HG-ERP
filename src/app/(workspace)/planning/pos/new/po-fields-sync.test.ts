import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PO_FIELDS } from '@/lib/po-fields'
import { PO_TEMPLATES, type PoTemplate } from '@/lib/po-template'
import { poLineInputSchema } from '@/modules/dept/supply/pos.schema'
import { buildPoPayload, type PoHeader } from './po-draft'
import { lineFromPo, type PoLineDto } from './po-line'

/*
 * CANH ĐỒNG BỘ BỘ TRƯỜNG THEO MẪU ĐƠN — trả lời câu "mỗi mẫu vật tư một bộ
 * thông số, lưu có đủ không?" bằng máy thay vì bằng dò tay.
 *
 * Một trường của mẫu phải sống sót qua 5 tầng, và MỖI tầng đều có cách làm
 * mất dữ liệu IM LẶNG nếu quên khai:
 *
 *   1. `buildPoPayload` quên gửi        → không lưu, không lỗi.
 *   2. `poLineInputSchema` thiếu key    → zod LỘT key lạ khỏi payload, không lỗi.
 *   3. `TEMPLATE_LINE_COLS` (repo) sót  → không ghi DB, không lỗi.
 *   4. chuỗi select của `listLines` sót → mở lại đơn thấy trống; LƯU LẠI LÀ XOÁ
 *      luôn số đã có — tệ nhất trong cả chuỗi.
 *   5. `lineFromPo` quên đổ lại         → như (4).
 *
 * Đây không phải rủi ro lý thuyết: trước 0139 gỗ phải "mượn" weight_per_unit
 * chứa m³/SP và finish chứa bảo hành vì bộ cột chưa theo kịp mẫu. Thêm cột mới
 * cho một mẫu là phải chạm đủ 5 chỗ — test này đỏ ngay khi sót một chỗ.
 */

/** Trường DỮ LIỆU của một mẫu — cột `field:` khai trong PO_FIELDS. */
function templateFields(t: PoTemplate): string[] {
  const fields = PO_FIELDS[t].flatMap((f) => {
    // kind 'inner' là MỘT ô gõ "900×605×115" nhưng ghi BA cột — PO_FIELDS không
    // khai `field` cho nó nên phải liệt kê tay ở đây.
    if (f.kind === 'inner') return ['inner_l_mm', 'inner_w_mm', 'inner_h_mm']
    // kind 'unit2' (0182) ghi cặp — hệ số là cột DB; NHÃN đi qua unit2 sẵn có
    // (server dẫn xuất) nên không nằm trong bộ cột mẫu.
    if (f.kind === 'unit2') return ['unit2_per_unit']
    return f.field ? [f.field] : [] // kind 'calc' không có field — số dẫn xuất
  })
  return [...new Set(fields)]
}

const ALL_FIELDS = [...new Set(PO_TEMPLATES.flatMap(templateFields))]

/** Dòng đơn đã lưu, MỌI cột mẫu đều mang giá trị nhận diện được. */
const FULL_DTO: PoLineDto = {
  id: 'line-1',
  material_id: 'a3a4b184-0000-4000-8000-000000000001',
  material_code: 'NH-0001',
  material_name: 'Nhôm hộp 25×50',
  material_unit: 'cây',
  qty_ordered: 120,
  unit_price: 61500,
  spec: '25x50x1li',
  note: '50 bàn santorin',
  material_grade: 'Sắt xi trắng',
  dm_per_sp: 4,
  qty_demand: 480,
  qty_on_hand: 60,
  die_code: 'TD-HG04',
  weight_per_m: 0.26,
  bar_length_m: 6.1,
  dimension_text: '900×605×115',
  finish: 'xi trắng',
  weight_per_unit: 1.55,
  m3_per_unit: 0.021,
  warranty_text: '12 tháng',
  open_style: 'AD',
  pcs_per_ctn: 28,
  inner_l_mm: 900,
  inner_w_mm: 605,
  inner_h_mm: 115,
  area_m2: 1.61,
  price_per_m2: 9200,
  print_fee: 150000,
  carton_basis: 'm2',
  pack_size: 28,
  pack_unit: 'bì',
  unit2_per_unit: 17.5,
  unit2: 'Lít',
}

function headerOf(t: PoTemplate): PoHeader {
  return {
    template: t,
    poType: 'standalone',
    lsxId: '',
    extraLsxIds: [],
    supplierId: 'ncc-1',
    expectedAt: '',
    contractNo: '',
    currency: 'VND',
    note: '',
    discount: '',
    vat: '',
    inclVat: false,
    terms: { quality: '', delivery_place: '', payment: '', invoice: '', lead_time: '' },
    signerRole: '',
  }
}

describe('tầng 1+5 — mở lại đơn rồi lưu lại: KHÔNG mất trường nào của mẫu', () => {
  for (const t of PO_TEMPLATES) {
    it(`mẫu ${t}: ${templateFields(t).length} trường sống sót vòng DB → form → payload`, () => {
      const line = lineFromPo(FULL_DTO)
      const payload = buildPoPayload(headerOf(t), [line])
      const sent = payload.lines[0] as unknown as Record<string, unknown>
      for (const f of templateFields(t)) {
        expect(sent, `trường "${f}" phải có trong payload`).toHaveProperty(f)
        expect(sent[f], `trường "${f}" phải giữ nguyên giá trị đã lưu`).toBe(
          (FULL_DTO as unknown as Record<string, unknown>)[f],
        )
      }
    })
  }
})

describe('tầng 2 — zod schema nhận đủ (zod LỘT key lạ im lặng, không báo lỗi)', () => {
  it('mọi trường của mọi mẫu đều là key của poLineInputSchema', () => {
    const keys = Object.keys(poLineInputSchema.shape)
    for (const f of ALL_FIELDS) {
      expect(keys, `schema thiếu "${f}" — payload gửi lên sẽ bị lột mất`).toContain(f)
    }
  })
})

describe('tầng 3+4 — repo: cột ghi và cột đọc', () => {
  /*
   * Canh bằng VĂN BẢN nguồn vì cả hai đều bắt buộc là literal trong repo:
   * chuỗi select để supabase-js suy kiểu, TEMPLATE_LINE_COLS không export
   * (module server). Đọc file là đường kiểm duy nhất không kéo theo db().
   */
  const repoSrc = readFileSync('src/modules/dept/supply/pos.repo.ts', 'utf8')

  it('TEMPLATE_LINE_COLS (INSERT khi tạo/sửa) chứa đủ cột mẫu', () => {
    const block = repoSrc.match(/const TEMPLATE_LINE_COLS = \[[\s\S]*?\] as const/)?.[0]
    expect(block).toBeTruthy()
    // qty_ordered / unit_price / spec / note nằm ngoài bộ cột mẫu — replaceLines
    // ghi tường minh từng cột đó, đã được vòng roundtrip ở trên canh.
    const structural = ['qty_ordered', 'unit_price', 'spec', 'note']
    for (const f of ALL_FIELDS.filter((x) => !structural.includes(x))) {
      expect(block, `TEMPLATE_LINE_COLS thiếu "${f}" — lưu sẽ rơi cột này`).toContain(
        `'${f}'`,
      )
    }
  })

  it('chuỗi select của listLines (mở lại đơn) chứa đủ cột mẫu', () => {
    const sel = repoSrc.match(/'id, po_id, material_id[^']*'/)?.[0]
    expect(sel).toBeTruthy()
    for (const f of ALL_FIELDS) {
      expect(
        sel,
        `select của listLines thiếu "${f}" — mở lại đơn sẽ trống ô, LƯU LẠI LÀ XOÁ`,
      ).toContain(f)
    }
  })
})
