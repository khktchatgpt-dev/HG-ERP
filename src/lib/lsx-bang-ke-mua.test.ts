import { describe, expect, it } from 'vitest'
import type { BangKeRow } from '@/lib/lsx-bang-ke'
import {
  chonDuoc,
  demTinhTrangMua,
  hrefLenDon,
  lamTronMua,
  tinhDongMua,
} from './lsx-bang-ke-mua'

/** Dòng bảng kê giả — số đo thật của lệnh 01/26-27 - BLACKIN (08/10/2026). */
function dong(p: Partial<BangKeRow>): BangKeRow {
  return {
    material_id: 'm',
    material_code: 'X',
    material_name: 'x',
    unit: 'Con',
    group_name: null,
    source: 'bom',
    deviates: false,
    auto_needed: null,
    draft_needed: 0,
    edited_by: null,
    edited_at: null,
    from_products: [],
    incomplete: false,
    qty_needed: 0,
    qty_issued: 0,
    qty_remaining: 0,
    on_hand: 0,
    reserved_others: 0,
    available: 0,
    ordered: 0,
    pending: 0,
    draft: 0,
    received: 0,
    suggest: 0,
    status: 'none',
    note: null,
    pos: [],
    ...p,
  }
}

describe('lamTronMua — tròn LÊN theo đơn vị mua (Q4)', () => {
  it('cây / con / cái: số nguyên — 1.109,72 cây → 1.110', () => {
    expect(lamTronMua('Cây', 1109.7216)).toBe(1110)
    expect(lamTronMua('Con', 13512)).toBe(13512)
    expect(lamTronMua('Cái', 7.74)).toBe(8)
  })
  it('kg / m³ / mét: hai số lẻ — 3.005,9384 kg → 3.005,94; 8,0252 m³ → 8,03', () => {
    expect(lamTronMua('Kg', 3005.9384)).toBe(3005.94)
    expect(lamTronMua('M³', 8.0252)).toBe(8.03)
    expect(lamTronMua('Mét', 1099.08)).toBe(1099.08)
  })
  it('sai số dấu phẩy động không bị đẩy lên một bậc', () => {
    expect(lamTronMua('Cây', 3.0000000001)).toBe(3)
    expect(lamTronMua('Kg', 1.23000000001)).toBe(1.23)
    expect(lamTronMua('Cây', 0)).toBe(0)
  })
})

describe('tinhDongMua — còn phải đặt trừ cả nháp (Q1), tình trạng', () => {
  it('vít 4×15: cần 28.864, nháp 18.000 → còn 10.864, "nháp thiếu"', () => {
    const d = tinhDongMua(dong({ qty_needed: 28864, draft: 18000, status: 'pending' }))
    expect(d.conPhaiDat).toBe(10864)
    expect(d.tinhTrang).toBe('nhap_thieu')
    expect(chonDuoc(d)).toBe(true)
  })
  it('bulon 6×25: cần 9.288, nháp 9.400 → còn 0, "đủ trên nháp", không tích được', () => {
    const d = tinhDongMua(dong({ qty_needed: 9288, draft: 9400, status: 'pending' }))
    expect(d.conPhaiDat).toBe(0)
    expect(d.tinhTrang).toBe('du_nhap')
    expect(chonDuoc(d)).toBe(false)
  })
  it('mạc đồng: cần 1.900, tồn khả dụng 1.020 → còn 880, "chưa đặt" (Q3 trừ tồn)', () => {
    const d = tinhDongMua(
      dong({ qty_needed: 1900, on_hand: 1020, available: 1020, status: 'none' }),
    )
    expect(d.conPhaiDat).toBe(880)
    expect(d.tinhTrang).toBe('chua_dat')
  })
  it('sắt vuông 25: 1.109,72 cây → cần 1.110, còn 1.110', () => {
    const d = tinhDongMua(dong({ unit: 'Cây', qty_needed: 1109.7216, status: 'none' }))
    expect(d.can).toBe(1110)
    expect(d.canLe).toBeCloseTo(1109.7216)
    expect(d.conPhaiDat).toBe(1110)
  })
  it('đã gửi NCC mà vẫn thiếu → "đã gửi, còn thiếu"; đủ và đang về → "đang về"', () => {
    expect(tinhDongMua(dong({ qty_needed: 100, ordered: 60, status: 'short' })).tinhTrang).toBe('da_gui_thieu') // prettier-ignore
    expect(tinhDongMua(dong({ qty_needed: 100, ordered: 100, status: 'inflight' })).tinhTrang).toBe('dang_ve') // prettier-ignore
  })
  // Hàng đã về nằm trong TỒN (phiếu nhập → on_hand), nên không trừ thêm `received` — trừ hai lần là âm.
  it('đã về đủ (đã nhập kho) → "đã về đủ"; đủ tồn không đơn → "đủ tồn"', () => {
    expect(tinhDongMua(dong({ qty_needed: 100, received: 100, on_hand: 100, available: 100, status: 'done' })).tinhTrang).toBe('da_ve') // prettier-ignore
    expect(tinhDongMua(dong({ qty_needed: 100, on_hand: 150, available: 150, status: 'done' })).tinhTrang).toBe('du_ton') // prettier-ignore
  })
  it('chỉ có trên đơn (ngoài định mức) / chờ xác nhận / chưa điền số', () => {
    expect(tinhDongMua(dong({ source: 'none', draft: 1910, status: 'extra' })).tinhTrang).toBe('ngoai_dm') // prettier-ignore
    expect(tinhDongMua(dong({ source: 'bom_draft', draft_needed: 50, status: 'unconfirmed' })).tinhTrang).toBe('chua_xac_nhan') // prettier-ignore
    expect(tinhDongMua(dong({ source: 'manual', status: 'blank' })).tinhTrang).toBe('chua_dien') // prettier-ignore
  })
})

describe('demTinhTrangMua + hrefLenDon', () => {
  it('đếm đủ mọi tình trạng, kể cả 0', () => {
    const dem = demTinhTrangMua([
      tinhDongMua(dong({ qty_needed: 10, status: 'none' })),
      tinhDongMua(dong({ qty_needed: 10, draft: 10, status: 'pending' })),
    ])
    expect(dem.chua_dat).toBe(1)
    expect(dem.du_nhap).toBe(1)
    expect(dem.da_ve).toBe(0)
  })
  it('đường dẫn soạn đơn mang mã + SL = còn phải đặt, bỏ dòng 0, tối đa 40', () => {
    expect(hrefLenDon('L1', [])).toBeNull()
    expect(
      hrefLenDon('L1', [
        { material_code: 'ST-0127', conPhaiDat: 1110 },
        { material_code: 'BUL0022', conPhaiDat: 0 },
        { material_code: 'SAT0377', conPhaiDat: 3005.94 },
      ]),
    ).toBe('/mua-hang/don/moi?lsx=L1&vt=ST-0127%2CSAT0377&sl=1110%2C3005.94')
    const nhieu = Array.from({ length: 45 }, (_, i) => ({
      material_code: `M${i}`,
      conPhaiDat: 1,
    }))
    expect(hrefLenDon('L1', nhieu)!.match(/M\d+/g)).toHaveLength(40)
  })
})
