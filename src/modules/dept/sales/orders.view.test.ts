import { describe, it, expect } from 'vitest'
import { toQuotePickPayload } from './orders.view'
import type { ProductPickRow } from '@/modules/dept/technical/technical.repo'

const base: ProductPickRow = {
  id: 'p1',
  code: 'ST000049HG-AL',
  name: 'Ghế xếp Florenz',
  unit: 'cai',
  customer_id: null,
  customer_item_code: null,
  bom_status: 'none',
  description_en: null,
  image_file_id: null,
  packing: {},
  length_mm: null,
  width_mm: null,
  height_mm: null,
}

describe('toQuotePickPayload — bù kích thước từ cột mm', () => {
  it('packing trống + có cột mm → hiện kích thước theo cm (290/537 SP thực tế)', () => {
    const p = toQuotePickPayload({
      ...base,
      length_mm: 755,
      width_mm: 1425,
      height_mm: 750,
    })
    expect(p.packing.l_cm).toBe(75.5)
    expect(p.packing.w_cm).toBe(142.5)
    expect(p.packing.h_cm).toBe(75)
  })

  it('số gõ tay THẮNG cột mm (không ghi đè việc người đã sửa)', () => {
    const p = toQuotePickPayload({
      ...base,
      packing: { l_cm: 60.2, w_cm: 58.1, h_cm: 92.4 },
      length_mm: 755,
      width_mm: 1425,
      height_mm: 750,
    })
    expect([p.packing.l_cm, p.packing.w_cm, p.packing.h_cm]).toEqual([60.2, 58.1, 92.4])
  })

  it('bù TỪNG CHIỀU: thiếu chiều nào lấy chiều đó', () => {
    const p = toQuotePickPayload({
      ...base,
      packing: { l_cm: 60 },
      length_mm: 755,
      width_mm: 1425,
      height_mm: null,
    })
    expect(p.packing.l_cm).toBe(60) // gõ tay
    expect(p.packing.w_cm).toBe(142.5) // bù từ mm
    expect(p.packing.h_cm).toBeUndefined() // cả hai nguồn đều trống
  })

  it('không nguồn nào có kích thước → vẫn undefined (panel bổ sung sẽ hỏi)', () => {
    const p = toQuotePickPayload(base)
    expect(p.packing.l_cm).toBeUndefined()
    expect(p.has_image).toBe(false)
  })

  it('giữ nguyên các ô packing khác + cờ ảnh', () => {
    const p = toQuotePickPayload({
      ...base,
      image_file_id: 'f1',
      packing: { qty_per_carton: 2, loading_40hc: 112 },
    })
    expect(p.packing.qty_per_carton).toBe(2)
    expect(p.packing.loading_40hc).toBe(112)
    expect(p.has_image).toBe(true)
  })
})
