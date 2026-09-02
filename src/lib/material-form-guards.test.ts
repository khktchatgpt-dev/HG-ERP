import { describe, expect, it } from 'vitest'
import {
  codeWarning,
  kgUnitVsBar,
  packPreview,
  specFromName,
  specPreview,
  unitWarning,
  baremGate,
} from './material-form-guards'

/*
 * Guard cho ô nhập tay nguy hiểm của form khai vật tư (13/08/2026) — mỗi guard
 * một khối, số mẫu lấy từ danh mục/đơn thật.
 */

const UNITS = ['Cây', 'Tấm', 'Cái', 'Con', 'Kg', 'Mét', 'Cuộn', 'Thùng', 'Bộ']

describe('unitWarning — ĐVT gõ tay so với danh mục nhãn', () => {
  it('nhãn chuẩn (kể cả khác hoa thường/dấu cách) → không cảnh báo', () => {
    expect(unitWarning('Cây', UNITS)).toBeNull()
    expect(unitWarning('cây', UNITS)).toBeNull()
    expect(unitWarning('  KG ', UNITS)).toBeNull()
  })

  it('gõ nhầm một ký tự → gợi ý nhãn cách đúng 1 ký tự', () => {
    // "Câi" cách đều "Cây" lẫn "Cái" — gợi ý nào cũng là cú hích đúng hướng.
    const w = unitWarning('Câi', UNITS)
    expect(w?.kind).toBe('suggest')
    expect(['Cái', 'Cây']).toContain((w as { suggest: string }).suggest)
    expect(unitWarning('Mét ', UNITS)).toBeNull()
  })

  it('nhãn lạ thật ("Lố") → unknown, form bắt xác nhận chứ không chặn cứng', () => {
    expect(unitWarning('Lố', UNITS)).toEqual({ kind: 'unknown' })
  })

  it('ô trống hoặc danh mục chưa nạp → im lặng, không chặn khai', () => {
    expect(unitWarning('', UNITS)).toBeNull()
    expect(unitWarning('Cây', [])).toBeNull()
  })
})

describe('specPreview — hiện điều máy hiểu từ ô Quy cách', () => {
  const BB = 'Bao bì - đóng gói - tem nhãn'

  it('bao bì + lọt lòng chuẩn + AD → tách kích thước và tính m²/thùng', () => {
    const p = specPreview(BB, '900x605x115', 'AD')
    expect(p).toMatchObject({ ok: true })
    expect((p as { text: string }).text).toContain('900×605×115')
    expect((p as { text: string }).text).toContain('m²/thùng')
  })

  it('bao bì + chuỗi không phải lọt lòng → cảnh báo, nói rõ hậu quả', () => {
    // Ca thật 12/08: spec bulong "6x20x13" dạng đúng nên vẫn bóc — nhưng chuỗi
    // ống "25×50×1li" (chữ dính số thứ ba) phải bị từ chối.
    const p = specPreview(BB, '25x50x1li', 'AD')
    expect(p).toMatchObject({ ok: false })
    expect((p as { warn: string }).warn).toContain('D×R×C')
  })

  it('kính → m²/tấm = D×R/10⁶ (605×539 ≈ 0,3261)', () => {
    const p = specPreview('Gỗ - kính - nhựa tấm', '605x539x5mm', '')
    expect(p).toMatchObject({ ok: true })
    expect((p as { text: string }).text).toContain('0,3261')
  })

  it('xốp tấm → m³/tấm; mút cuộn không đọc được thì nhắc nhẹ (không phải lỗi)', () => {
    const tam = specPreview('Mút - xốp - nệm - gòn', '1520x920x10', '')
    expect(tam).toMatchObject({ ok: true })
    expect((tam as { text: string }).text).toContain('m³/tấm')
    const cuon = specPreview('Mút - xốp - nệm - gòn', '8mm x 1.05m x 150m', '')
    expect(cuon).toMatchObject({ ok: false })
    expect((cuon as { warn: string }).warn).toContain('mút cuộn')
  })

  it('nhóm không nuôi tiền từ quy cách (ngũ kim…) → không preview, không phiền', () => {
    expect(specPreview('Bu lông - vít - đinh - liên kết', '6x20', '')).toBeNull()
    expect(specPreview(null, '900x605x115', '')).toBeNull()
  })
})

describe('packPreview — quy đổi đóng gói lộ typo ngay lúc gõ', () => {
  it('gõ đúng 500 → ví dụ 1.000 Con ≈ 2 bì', () => {
    const p = packPreview('bì', '500', 'Con')
    expect(p?.text).toContain('1 bì = 500 Con')
    expect(p?.text).toContain('≈ 2 bì')
  })

  it('gõ thiếu số 0 (50) → ví dụ nhảy thành 20 bì — số vô lý lộ ngay', () => {
    expect(packPreview('bì', '50', 'Con')?.text).toContain('≈ 20 bì')
  })

  it('đóng gói 1:1 → cảnh báo "mua lẻ thì bỏ trống"', () => {
    expect(packPreview('bì', '1', 'Con')?.warn).toContain('bỏ trống')
  })

  it('thiếu một nửa cặp → im lặng (corePayload cũng bỏ nửa cặp)', () => {
    expect(packPreview('', '500', 'Con')).toBeNull()
    expect(packPreview('bì', '', 'Con')).toBeNull()
  })
})

describe('kgUnitVsBar — kg/đơn-vị đối chiếu kg/m × dài cây', () => {
  it('khớp barem (10.1 ≈ 1.788×5.65) → lệch dưới 5%', () => {
    expect(kgUnitVsBar('10.1', '1.788', '5.65')!).toBeLessThan(0.05)
  })

  it('gõ nhầm dấu chấm (101) → lệch ~10 lần, vượt ngưỡng rõ', () => {
    expect(kgUnitVsBar('101', '1.788', '5.65')!).toBeGreaterThan(0.05)
  })

  it('thiếu một trong ba số → null, không cảnh báo mò', () => {
    expect(kgUnitVsBar('10.1', '', '5.65')).toBeNull()
    expect(kgUnitVsBar('', '1.788', '5.65')).toBeNull()
  })
})

describe('codeWarning — mã gõ tay lệch quy ước', () => {
  it('đúng nếp danh mục (NH-0009, BAO0062, XM-0103) → im lặng', () => {
    for (const c of ['NH-0009', 'BAO0062', 'XM-0103', 'NHO0146']) {
      expect(codeWarning(c)).toBeNull()
    }
  })

  it('mã lạc quy ước → cảnh báo kèm lối an toàn (bỏ trống)', () => {
    expect(codeWarning('NH999X')).toContain('lệch quy ước')
    expect(codeWarning('vt 01')).toContain('bỏ trống')
  })

  it('bỏ trống (server tự cấp) → không cảnh báo', () => {
    expect(codeWarning('')).toBeNull()
  })
})

describe('specFromName — bóc quy cách từ tên khi ô Quy cách trống', () => {
  it('tên chứa tiết diện → đề xuất đúng đoạn quy cách', () => {
    expect(specFromName('Nhôm hộp 20x40x1li')).toBe('20x40x1li')
    expect(specFromName('Sắt vuông 25x1.2li đen')).toBe('25x1.2li')
    expect(specFromName('Nhôm phi 25x1li')).toContain('phi 25')
  })

  it('tên không có quy cách ("Tán rút 6, 7 màu" — 6 không phải tiết diện) → null', () => {
    expect(specFromName('Mạc đồng dán')).toBeNull()
    expect(specFromName('Tán rút 6, 7 màu')).toBeNull()
  })

  it('tên CHỈ là quy cách → null (điền sang là lặp nguyên tên)', () => {
    expect(specFromName('20x40x1li')).toBeNull()
  })
})

describe('baremGate — barem tiền lệch phải xác nhận mới lưu (02/09)', () => {
  const base = { kg_per_m: '', kg_per_unit: '', default_bar_length_m: '', derivedKg: null }

  it('trống hết → không chặn (vật tư không phải hàng cân)', () => {
    expect(baremGate(base).blocked).toBe(false)
  })

  it('khớp số máy đọc trong ngưỡng → không chặn', () => {
    expect(baremGate({ ...base, kg_per_m: '0.25', derivedKg: 0.248 }).blocked).toBe(false)
  })

  it('gõ nhầm dấu chấm (2.48 vs máy đọc 0.248) → CHẶN', () => {
    expect(baremGate({ ...base, kg_per_m: '2.48', derivedKg: 0.248 }).blocked).toBe(true)
  })

  it('máy không đọc được tên (derivedKg null) → không có gì để so, không chặn', () => {
    expect(baremGate({ ...base, kg_per_m: '2.48' }).blocked).toBe(false)
  })

  it('kg/đơn-vị lệch kg/m × dài cây quá ngưỡng → CHẶN', () => {
    const f = { ...base, kg_per_m: '0.26', default_bar_length_m: '6', kg_per_unit: '15.6' }
    expect(baremGate(f).blocked).toBe(true) // đúng phải ~1.56
  })

  it('kg/đơn-vị khớp tích kg/m × dài cây → không chặn', () => {
    const f = { ...base, kg_per_m: '0.26', default_bar_length_m: '6', kg_per_unit: '1.56' }
    expect(baremGate(f).blocked).toBe(false)
  })

  it('key đổi khi BẤT KỲ ô nào đổi — xác nhận cũ phải hết giá trị', () => {
    const a = baremGate({ ...base, kg_per_m: '2.48', derivedKg: 0.248 })
    const b = baremGate({ ...base, kg_per_m: '2.49', derivedKg: 0.248 })
    expect(a.key).not.toBe(b.key)
  })
})
