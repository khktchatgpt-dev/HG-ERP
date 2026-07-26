import { describe, expect, it } from 'vitest'
import {
  FRAME_MATERIAL_CODES,
  PRODUCT_TYPE_CODES,
  buildProductCode,
  nextSerial,
  parseProductCode,
} from './product-code'

describe('parseProductCode', () => {
  it('tách đúng 3 phần của mã chuẩn', () => {
    expect(parseProductCode('CH000201HG-IN')).toEqual({
      type: 'CH',
      serial: 201,
      material: 'IN',
    })
  })

  it('chấp nhận chữ thường và khoảng trắng thừa (người dùng dán từ Excel)', () => {
    expect(parseProductCode(' ch000201hg-in ')?.serial).toBe(201)
  })

  it('trả null cho mã cũ nhập tay — 6 mã thật đang còn trong DB', () => {
    for (const c of [
      'RHONE-CHAIR',
      'RHONE-BENCH',
      'RHONE-DT',
      '28256-228',
      '21605-217',
      '26443-228',
    ])
      expect(parseProductCode(c)).toBeNull()
  })

  it('trả null khi số thứ tự không đủ 6 chữ số (dạng mã cũ C0093HG-AL)', () => {
    expect(parseProductCode('C0093HG-AL')).toBeNull()
  })
})

describe('buildProductCode', () => {
  it('đệm số thứ tự đủ 6 chữ số', () => {
    expect(buildProductCode('TB', 2, 'AL')).toBe('TB000002HG-AL')
    expect(buildProductCode('CH', 197, 'IR')).toBe('CH000197HG-IR')
  })

  it('dựng rồi tách lại thì ra chính nó', () => {
    for (const t of PRODUCT_TYPE_CODES)
      for (const m of FRAME_MATERIAL_CODES)
        expect(parseProductCode(buildProductCode(t, 42, m))).toEqual({
          type: t,
          serial: 42,
          material: m,
        })
  })
})

describe('nextSerial', () => {
  it('lấy max + 1, KHÔNG lấp khoảng trống đã cấp', () => {
    // thiếu 000002 nhưng vẫn nhảy lên 4 — số đã cấp là số đã in ra đơn hàng
    expect(nextSerial(['CH000001HG-AL', 'CH000003HG-IR'], 'CH')).toBe(4)
  })

  it('đếm chung mọi vật liệu của cùng một loại', () => {
    expect(nextSerial(['CH000197HG-AL'], 'CH')).toBe(198)
  })

  it('không đếm lẫn loại khác', () => {
    expect(nextSerial(['TB000119HG-AL', 'CH000005HG-AL'], 'CH')).toBe(6)
  })

  it('loại chưa có SP nào thì bắt đầu từ 1', () => {
    expect(nextSerial(['CH000010HG-AL'], 'AC')).toBe(1)
    expect(nextSerial([], 'TB')).toBe(1)
  })

  it('bỏ qua mã cũ không đúng dạng thay vì hỏng cả phép đánh số', () => {
    expect(nextSerial(['RHONE-CHAIR', 'C0093HG-AL', 'CH000007HG-AL'], 'CH')).toBe(8)
  })

  it('khớp số thật trong DB ngày 26/07/2026', () => {
    // max theo loại: TB 119 · CH 197 · BN 190 · ST 138 · SL 11 · OT 45 · AC 2
    expect(nextSerial(['CH000197HG-AL'], 'CH')).toBe(198)
    expect(nextSerial(['BN000190HG-IR'], 'BN')).toBe(191)
  })
})
