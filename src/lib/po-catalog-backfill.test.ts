import { describe, expect, it } from 'vitest'
import {
  buildCatalogSuggestions,
  catalogFillPatch,
  lastPriceUpdates,
  linesByMaterial,
  type CatalogFields,
} from './po-catalog-backfill'

/*
 * Danh mục tự giàu từ dòng đơn (13/08/2026) — mô tả fill-empty-only,
 * giá ghi đè có chủ đích khi gửi NCC (chỉ VND).
 */

const EMPTY: CatalogFields = {
  spec: null,
  material_grade: null,
  finish: null,
  open_style: null,
  pcs_per_ctn: null,
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
      buildCatalogSuggestions([{ material_id: 'a', open_style: 'AD', pcs_per_ctn: 4 }], [full]),
    ).toEqual([])
    expect(buildCatalogSuggestions([{ material_id: 'a' }], [mat])).toEqual([])
  })
})
