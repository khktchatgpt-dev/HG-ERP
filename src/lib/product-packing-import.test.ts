import { describe, expect, it } from 'vitest'
import type { CellValue } from './product-import'
import {
  PACKING_COLUMNS,
  packingColumnForHeader,
  planPacking,
  type OptionData,
  type PackingRawRow,
} from './product-packing-import'

const PRODUCTS = [
  { id: 'p-sofa', code: 'ST0209HG-IR', locked_at: null },
  { id: 'p-ban', code: 'TB0300HG-AL', locked_at: null },
  { id: 'p-khoa', code: 'TB0100HG-AL', locked_at: '2026-09-01T00:00:00Z' },
]
const OLD: OptionData[] = [
  {
    option_no: 1,
    label: 'Op1',
    is_default: true,
    cartons_per_set: 3,
    loading_40hc: 138,
    note: null,
    packages: [
      { package_label: 'Bàn', qty: 1, carton_l_mm: 630, carton_w_mm: 630, carton_h_mm: 530, net_weight_kg: null, gross_weight_kg: null }, // prettier-ignore
      { package_label: 'Ghế', qty: 2, carton_l_mm: 1380, carton_w_mm: 630, carton_h_mm: 370, net_weight_kg: null, gross_weight_kg: null }, // prettier-ignore
    ],
  },
]
const EXISTING = new Map([['p-sofa', OLD]])

let n = 4
const r = (cells: Record<string, CellValue>): PackingRawRow => ({ row: n++, cells })

describe('cột', () => {
  it('tiêu đề nhận lại được, không cột nào che cột nào', () => {
    expect(PACKING_COLUMNS.map((c) => packingColumnForHeader(c.header)?.key)).toEqual(PACKING_COLUMNS.map((c) => c.key)) // prettier-ignore
  })
})

describe('planPacking', () => {
  it('xuất y nguyên (kiện lặp ô phương án) → Không đổi', () => {
    const p = planPacking(
      [
        r({ code: 'ST0209HG-IR', option_no: 1, label: 'Op1', is_default: 'có', cartons_per_set: 3, loading_40hc: 138, package_label: 'Bàn', qty: 1, carton_l_mm: 630, carton_w_mm: 630, carton_h_mm: 530 }), // prettier-ignore
        r({ code: 'ST0209HG-IR', option_no: 1, label: 'Op1', is_default: 'có', cartons_per_set: 3, loading_40hc: 138, package_label: 'Ghế', qty: 2, carton_l_mm: 1380, carton_w_mm: 630, carton_h_mm: 370 }), // prettier-ignore
      ],
      PRODUCTS,
      EXISTING,
    )
    expect(p.items[0]).toMatchObject({ action: 'same', productId: 'p-sofa' })
  })

  it('thêm phương án 2 không kiện, dòng kiện sau để trống ô phương án → thay cả bộ', () => {
    const p = planPacking(
      [
        r({ code: 'st0209hg-ir', option_no: 1, label: 'Op1', cartons_per_set: 3, loading_40hc: 140, package_label: 'Bàn', carton_l_mm: '630' }), // prettier-ignore
        r({ code: 'ST0209HG-IR', option_no: 1, package_label: 'Ghế', qty: 2 }),
        r({
          code: 'ST0209HG-IR',
          option_no: 2,
          label: 'Op2: không tháo rời',
          loading_40hc: 60,
        }),
      ],
      PRODUCTS,
      EXISTING,
    )
    const it0 = p.items[0]
    expect(it0.action).toBe('replace')
    expect(
      it0.options.map((o) => [
        o.option_no,
        o.is_default,
        o.loading_40hc,
        o.packages.length,
      ]),
    ).toEqual([
      [1, true, 140, 2], // không ai đánh dấu → phương án số nhỏ nhất là mặc định
      [2, false, 60, 0],
    ])
    expect(it0.options[0].packages[1]).toMatchObject({
      package_label: 'Ghế',
      qty: 2,
      carton_l_mm: null,
    })
    expect(it0.before).toBe('1 phương án · 2 kiện · mặc định PA1: 138 bộ/40HC')
    expect(it0.after).toBe('2 phương án · 2 kiện · mặc định PA1: 140 bộ/40HC')
  })

  it('SP chưa có phương án nào → thêm; mặc định đánh dấu đúng phương án', () => {
    const p = planPacking([r({ code: 'TB0300HG-AL', option_no: 1, loading_40hc: 90 }), r({ code: 'TB0300HG-AL', option_no: 2, is_default: 'có', loading_40hc: 120 })], PRODUCTS, EXISTING) // prettier-ignore
    expect(p.items[0].options.map((o) => o.is_default)).toEqual([false, true])
    expect(p.items[0].before).toBe('(không có phương án)')
  })

  it('"-" = xoá hết phương án', () => {
    const p = planPacking(
      [r({ code: 'ST0209HG-IR', option_no: '-' })],
      PRODUCTS,
      EXISTING,
    )
    expect(p.items[0]).toMatchObject({
      action: 'replace',
      options: [],
      after: '(xoá hết phương án)',
    })
  })

  it('lỗi: 2 mặc định, ô phương án ghi khác nhau, kiện thiếu tên, số sai, mã không có, hồ sơ khoá', () => {
    const p = planPacking(
      [
        r({ code: 'ST0209HG-IR', option_no: 1, is_default: 'có', loading_40hc: 100 }),
        r({ code: 'ST0209HG-IR', option_no: 2, is_default: 'có' }),
        r({ code: 'TB0300HG-AL', option_no: 1, loading_40hc: 90, package_label: 'Bàn' }),
        r({ code: 'TB0300HG-AL', option_no: 1, loading_40hc: 95, package_label: 'Chân' }),
        r({ code: 'TB0300HG-AL', option_no: 1, carton_l_mm: 500 }),
        r({ code: 'TB0300HG-AL', option_no: 'x' }),
        r({ code: 'CH9999HG-AL', option_no: 1 }),
        r({ code: 'TB0100HG-AL', option_no: 1 }),
        r({ code: '', option_no: 1 }),
      ],
      PRODUCTS,
      EXISTING,
    )
    const by = (code: string) => p.items.find((i) => i.code === code)!
    expect(by('ST0209HG-IR').errors[0].msg).toContain('2 phương án đánh dấu Mặc định')
    const ban = by('TB0300HG-AL')
      .errors.map((e) => e.msg)
      .join(' | ')
    expect(ban).toContain('ghi khác dòng')
    expect(ban).toContain('thiếu Tên kiện')
    expect(ban).toContain('Phương án số "x"')
    expect(by('CH9999HG-AL').errors[0].msg).toContain('không có trong thư viện')
    expect(by('TB0100HG-AL').errors[0].msg).toContain('khoá')
    expect(by('').errors[0].msg).toContain('Thiếu Mã nội bộ')
    expect(p.counts).toMatchObject({ error: 5, replace: 0 })
  })
})
