import { describe, expect, it } from 'vitest'
import { bomToCutLines, specLabel, type BomPartForCut } from './from-bom'

const part = (over: Partial<BomPartForCut>): BomPartForCut => ({
  part_name: 'Chân',
  group_code: 'FRAME',
  material_kind: 'AL',
  profile_shape: 'HOP',
  profile_code: null,
  dim_a_mm: 20,
  dim_b_mm: 40,
  wall_thickness_mm: 1.2,
  cut_length_mm: 1390,
  bend_waste_mm: null,
  bar_length_m: 6,
  qty: 4,
  ...over,
})

describe('specLabel', () => {
  it('vật liệu + dạng + tiết diện, số theo lối Việt', () => {
    expect(specLabel(part({}))).toBe('Nhôm hộp 20×40×1,2')
    expect(
      specLabel(part({ material_kind: 'IR', profile_shape: 'TRON', dim_b_mm: null })),
    ).toBe('Sắt tròn 20×1,2')
  })
  it('không có tiết diện thì lấy mã profile; không có gì thì rỗng', () => {
    expect(
      specLabel(
        part({
          material_kind: 'IR',
          profile_shape: 'PF',
          profile_code: 'TD-HG04',
          dim_a_mm: null,
          dim_b_mm: null,
          wall_thickness_mm: null,
        }),
      ),
    ).toBe('Sắt profile (mã khuôn) TD-HG04')
    expect(
      specLabel(
        part({
          material_kind: null,
          profile_shape: null,
          dim_a_mm: null,
          dim_b_mm: null,
          wall_thickness_mm: null,
        }),
      ),
    ).toBe('')
  })
})

describe('bomToCutLines', () => {
  it('nhân số lượng đợt, cộng phi hao uốn, gom quy cách, cây BOM gợi ý', () => {
    const r = bomToCutLines(
      [
        part({}),
        part({ part_name: 'Giằng', cut_length_mm: 700.5, bend_waste_mm: 10, qty: 2 }),
        part({
          part_name: 'Khung sắt',
          material_kind: 'IR',
          dim_a_mm: 25,
          dim_b_mm: 25,
          bar_length_m: 12,
          qty: 1,
        }),
        part({ part_name: 'Nệm', group_code: 'CUSHION', cut_length_mm: null, qty: 1 }),
        part({ part_name: 'Chưa có SL', qty: null }),
      ],
      10,
      { FRAME: 'Khung', CUSHION: 'Nệm' },
    )
    expect(r.dropped).toBe(2)
    expect(r.lines).toEqual([
      {
        part_name: 'Chân',
        length_mm: 1390,
        qty: 40,
        spec: 'Nhôm hộp 20×40×1,2',
        note: 'Khung',
      },
      {
        part_name: 'Giằng',
        length_mm: 710.5,
        qty: 20,
        spec: 'Nhôm hộp 20×40×1,2',
        note: 'Khung',
      },
      {
        part_name: 'Khung sắt',
        length_mm: 1390,
        qty: 10,
        spec: 'Sắt hộp 25×25×1,2',
        note: 'Khung',
      },
    ])
    expect(r.specs).toEqual([
      {
        key: 'nhôm hộp 20×40×1,2',
        spec: 'Nhôm hộp 20×40×1,2',
        stock_length_mm: 6000,
        lines: 2,
        pieces: 60,
      },
      {
        key: 'sắt hộp 25×25×1,2',
        spec: 'Sắt hộp 25×25×1,2',
        stock_length_mm: 12000,
        lines: 1,
        pieces: 10,
      },
    ])
  })
  it('định mức lẻ × số lượng làm tròn lên; không ghi cây thì gợi ý null', () => {
    const r = bomToCutLines([part({ qty: 0.5, bar_length_m: null })], 3)
    expect(r.lines[0].qty).toBe(2)
    expect(r.specs[0].stock_length_mm).toBeNull()
  })
})
