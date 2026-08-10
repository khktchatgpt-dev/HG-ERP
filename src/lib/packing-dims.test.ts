import { describe, it, expect } from 'vitest'
import { dimsText, mmToCm, packingWithDims } from './packing-dims'

describe('mmToCm', () => {
  it('quy đổi và làm tròn 2 số lẻ', () => {
    expect(mmToCm(700)).toBe(70)
    expect(mmToCm(555)).toBe(55.5)
    expect(mmToCm(876)).toBe(87.6)
  })

  it('null/undefined → undefined (không hoá 0)', () => {
    expect(mmToCm(null)).toBeUndefined()
    expect(mmToCm(undefined)).toBeUndefined()
  })

  it('0 là số đo thật, không được nuốt thành undefined', () => {
    expect(mmToCm(0)).toBe(0)
  })
})

describe('packingWithDims — số gõ tay luôn thắng', () => {
  const mm = { length_mm: 620, width_mm: 680, height_mm: 990 }

  it('thiếu cm → bù từ mm', () => {
    expect(packingWithDims({}, mm)).toMatchObject({ l_cm: 62, w_cm: 68, h_cm: 99 })
  })

  it('có cm rồi → KHÔNG ghi đè bằng mm', () => {
    const pk = { l_cm: 68, w_cm: 62, h_cm: 99 }
    expect(packingWithDims(pk, mm)).toMatchObject(pk)
  })

  it('bù từng chiều một — thiếu chiều nào bù chiều đó', () => {
    const out = packingWithDims({ l_cm: 68 }, mm)
    expect(out).toMatchObject({ l_cm: 68, w_cm: 68, h_cm: 99 })
  })

  it('không có nguồn nào → để trống, không bịa số 0', () => {
    const out = packingWithDims({}, { length_mm: null, width_mm: null, height_mm: null })
    expect(out.l_cm).toBeUndefined()
    expect(out.w_cm).toBeUndefined()
    expect(out.h_cm).toBeUndefined()
  })

  it('KHÔNG đụng các ô đóng gói (carton, NW/GW, loading)', () => {
    const pk = { carton_l_cm: 120, nw_kg: 12.5, gw_kg: 14, loading_40hc: 220 }
    expect(packingWithDims(pk, mm)).toMatchObject(pk)
  })
})

describe('dimsText', () => {
  it('đủ ba chiều mới ra chuỗi', () => {
    expect(dimsText({ l_cm: 68, w_cm: 62, h_cm: 99 })).toBe('68 × 62 × 99')
  })

  it('thiếu một chiều → null (thà trống còn hơn in nửa vời)', () => {
    expect(dimsText({ l_cm: 68, w_cm: 62 })).toBeNull()
    expect(dimsText({})).toBeNull()
  })
})
