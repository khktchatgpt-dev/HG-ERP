import { describe, expect, it } from 'vitest'
import {
  buildCatalogSuggestions,
  catalogFillPatch,
  lastPriceUpdates,
  linesByMaterial,
  priceChange,
  specFromLine,
  type CatalogFields,
} from './po-catalog-backfill'

/*
 * Danh mục tự giàu từ dòng đơn (13/08/2026) — mô tả + barem + đóng gói đều
 * fill-empty-only; GIÁ ghi ĐÈ và từ 29/08/2026 phải đi qua hộp xác nhận lúc
 * lưu đơn (không còn tự ghi ở bước gửi NCC).
 */

const EMPTY: CatalogFields = {
  spec: null,
  material_grade: null,
  finish: null,
  open_style: null,
  pcs_per_ctn: null,
  kg_per_m: null,
  kg_per_unit: null,
  pack_size: null,
  pack_unit: null,
  m3_per_unit: null,
  warranty_text: null,
}

describe('catalogFillPatch — mô tả chỉ điền ô trống', () => {
  it('danh mục trống + dòng có đủ → điền cả 5 trường', () => {
    const p = catalogFillPatch(EMPTY, {
      spec: '900x605x115',
      material_grade: 'Carton 5 lớp',
      finish: 'inox bóng',
      open_style: 'AD',
      pcs_per_ctn: 4,
    })
    expect(p).toEqual({
      spec: '900x605x115',
      material_grade: 'Carton 5 lớp',
      finish: 'inox bóng',
      open_style: 'AD',
      pcs_per_ctn: 4,
    })
  })

  it('danh mục ĐÃ có giá trị → tuyệt đối không đè, kể cả khác nhau', () => {
    const p = catalogFillPatch(
      { ...EMPTY, spec: '20x40x1li', open_style: 'MR' },
      { spec: '25x50x2li', open_style: 'AD', finish: 'xi trắng' },
    )
    expect(p).toEqual({ finish: 'xi trắng' })
  })

  it('dòng trống / chỉ khoảng trắng → không có gì để điền, trả null', () => {
    expect(catalogFillPatch(EMPTY, { spec: '  ', pcs_per_ctn: 0 })).toBeNull()
    expect(catalogFillPatch(EMPTY, {})).toBeNull()
  })

  it('chuỗi bị cắt theo trần cột DB (spec 200, grade/finish 100, open 20)', () => {
    const p = catalogFillPatch(EMPTY, { material_grade: 'x'.repeat(150) })
    expect((p?.material_grade as string).length).toBe(100)
  })
})

describe('linesByMaterial — gộp dòng cùng mã, dòng đầu có giá trị thắng', () => {
  it('hai dòng cùng mã: dòng sau chỉ lấp trường dòng trước còn trống', () => {
    const m = linesByMaterial([
      { material_id: 'a', spec: '20x40', finish: '' },
      { material_id: 'a', spec: '25x50', finish: 'inox bóng' },
    ])
    expect(m.get('a')).toMatchObject({ spec: '20x40', finish: 'inox bóng' })
  })

  it('dòng tự do (material_id null) bị bỏ qua', () => {
    expect(linesByMaterial([{ material_id: null, spec: 'x' }]).size).toBe(0)
  })
})

describe('lastPriceUpdates — giá gần nhất khi gửi NCC', () => {
  const lines = [
    { material_id: 'a', unit_price: 80_000 },
    { material_id: 'b', unit_price: null },
    { material_id: null, unit_price: 500 },
    { material_id: 'a', unit_price: 82_000 }, // cùng mã — giá chốt sau thắng
  ]

  it('VND: lấy dòng có giá, cùng mã lấy dòng cuối, bỏ dòng tự do/không giá', () => {
    const m = lastPriceUpdates('VND', lines)
    expect(m.get('a')).toBe(82_000)
    expect(m.has('b')).toBe(false)
    expect(m.size).toBe(1)
  })

  it('đơn USD → không cập nhật gì (cột giá ngầm VND, ghi 700.21 là sai bậc)', () => {
    expect(lastPriceUpdates('USD', lines).size).toBe(0)
  })
})

describe('buildCatalogSuggestions — danh sách cho hộp xác nhận sau khi lưu đơn', () => {
  const mat = { id: 'a', code: 'BAO0062', name: 'Thùng carton 5 lớp', ...EMPTY }

  it('danh mục trống + dòng có cách mở/pcs → một đề xuất kèm nhãn tiếng Việt', () => {
    const s = buildCatalogSuggestions(
      [{ material_id: 'a', open_style: 'AD', pcs_per_ctn: 4 }],
      [mat],
    )
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ material_id: 'a', code: 'BAO0062' })
    expect(s[0].fields).toEqual([
      { field: 'open_style', label: 'Cách mở thùng', value: 'AD' },
      { field: 'pcs_per_ctn', label: 'SP mỗi thùng', value: 4 },
    ])
  })

  it('danh mục đã đủ / dòng không có gì mới → danh sách rỗng, không hiện hộp', () => {
    const full = { ...mat, open_style: 'MR', pcs_per_ctn: 2 }
    expect(
      buildCatalogSuggestions(
        [{ material_id: 'a', open_style: 'AD', pcs_per_ctn: 4 }],
        [full],
      ),
    ).toEqual([])
    expect(buildCatalogSuggestions([{ material_id: 'a' }], [mat])).toEqual([])
  })
})

describe('specFromLine — quy cách suy từ dòng (mẫu không có ô Quy cách)', () => {
  it('gõ thẳng quy cách thì giữ nguyên, không suy diễn', () => {
    expect(specFromLine({ spec: ' 25x50x1li ', inner_l_mm: 900 })).toBe('25x50x1li')
  })

  it('carton: ba số lọt lòng → chuỗi cùng khuôn với link "lưu quy cách ↑"', () => {
    expect(specFromLine({ inner_l_mm: 900, inner_w_mm: 605, inner_h_mm: 115 })).toBe(
      '900x605x115',
    )
  })

  it('thiếu một chiều thì không suy — nửa bộ kích thước vào danh mục là sai', () => {
    expect(specFromLine({ inner_l_mm: 900, inner_w_mm: 605 })).toBeNull()
    expect(specFromLine({ inner_l_mm: 900, inner_w_mm: 605, inner_h_mm: 0 })).toBeNull()
  })

  it('kính/xốp: ô quy cách của dòng đọc ra D×R×C thì lấy', () => {
    expect(specFromLine({ dimension_text: '1220×2440×5' })).toBe('1220×2440×5')
  })

  it('chuỗi mô tả không ra kích thước thì bỏ — danh mục dùng chung, không chứa chữ linh tinh', () => {
    expect(specFromLine({ dimension_text: 'khổ lớn, cắt theo yêu cầu' })).toBeNull()
  })

  it('dòng trống hoàn toàn → null', () => {
    expect(specFromLine({})).toBeNull()
  })
})

/*
 * 29/08/2026 — GIÁ và BAREM/ĐÓNG GÓI vào chung hộp xác nhận lúc lưu đơn.
 * Trước đó giá do handler `po.ordered` tự ghi (không hỏi), barem phải bấm nút
 * riêng trên ô, đóng gói thì không có đường nào.
 */
describe('priceChange — giá mua gần nhất là ĐÈ, không phải fill-empty', () => {
  const m = (p: number | null) => ({ last_purchase_price: p })

  it('danh mục đã có giá khác → vẫn đề xuất, kèm giá cũ để hộp nói "8.200 → 8.500"', () => {
    expect(priceChange(m(8200), 'VND', 8500)).toEqual({ before: 8200, after: 8500 })
  })

  it('chưa có giá → before null, hộp hiện "chưa có → 8.500"', () => {
    expect(priceChange(m(null), 'VND', 8500)).toEqual({ before: null, after: 8500 })
  })

  it('giá y như cũ → null: không hỏi, không đẻ một dòng vết "8.500 → 8.500"', () => {
    expect(priceChange(m(8500), 'VND', 8500)).toBeNull()
  })

  it('đơn ngoại tệ → null (cột giá ngầm VND, ghi 700.21 vào đó là sai bậc tiền)', () => {
    expect(priceChange(m(8200), 'USD', 700.21)).toBeNull()
  })

  it('giá 0 / rỗng → null', () => {
    expect(priceChange(m(8200), 'VND', 0)).toBeNull()
    expect(priceChange(m(8200), 'VND', null)).toBeNull()
  })
})

describe('catalogFillPatch — barem + đóng gói cũng chỉ điền ô trống', () => {
  it('danh mục trống → điền kg/m, kg/đơn vị, quy cách đóng gói, ĐVT đóng gói', () => {
    expect(
      catalogFillPatch(EMPTY, {
        kg_per_m: 1.234,
        kg_per_unit: 12.5,
        pack_size: 500,
        pack_unit: 'bì',
      }),
    ).toEqual({ kg_per_m: 1.234, kg_per_unit: 12.5, pack_size: 500, pack_unit: 'bì' })
  })

  it('danh mục đã có → không đè, kể cả khi dòng gõ số khác', () => {
    const full: CatalogFields = {
      ...EMPTY,
      kg_per_m: 1,
      kg_per_unit: 2,
      pack_size: 100,
      pack_unit: 'thùng',
    }
    expect(
      catalogFillPatch(full, {
        kg_per_m: 9,
        kg_per_unit: 9,
        pack_size: 9,
        pack_unit: 'bì',
      }),
    ).toBeNull()
  })
})

describe('buildCatalogSuggestions — gộp giá vào cùng hộp xác nhận', () => {
  const mat = (over: Partial<CatalogFields & { last_purchase_price: number | null }>) => ({
    ...EMPTY,
    id: 'm1',
    code: 'BB-01',
    name: 'Thùng carton',
    last_purchase_price: null,
    ...over,
  })

  it('giá đổi → có mục "Giá mua gần nhất" mang cờ overwrite + giá cũ', () => {
    const out = buildCatalogSuggestions([{ material_id: 'm1' }], [mat({ last_purchase_price: 8200 })], {
      currency: 'VND',
      byMaterial: new Map([['m1', 8500]]),
    })
    expect(out).toHaveLength(1)
    expect(out[0].fields).toEqual([
      {
        field: 'last_purchase_price',
        label: 'Giá mua gần nhất',
        value: 8500,
        overwrite: true,
        before: 8200,
      },
    ])
  })

  it('không truyền giá → hộp chỉ có phần mô tả, y như trước 29/08', () => {
    const out = buildCatalogSuggestions(
      [{ material_id: 'm1', open_style: 'AD' }],
      [mat({ last_purchase_price: 8200 })],
    )
    expect(out[0].fields.map((f) => f.field)).toEqual(['open_style'])
  })

  it('mô tả đủ + giá y như cũ → không có gì để hỏi, hộp không hiện', () => {
    const out = buildCatalogSuggestions(
      [{ material_id: 'm1' }],
      [mat({ last_purchase_price: 8500 })],
      { currency: 'VND', byMaterial: new Map([['m1', 8500]]) },
    )
    expect(out).toEqual([])
  })
})
