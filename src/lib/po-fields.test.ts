import { describe, expect, it } from 'vitest'
import { PO_TEMPLATES, poTemplateMeta, type PoTemplate } from './po-template'
import { PO_FIELDS, PO_PRINT_ORDER, PO_PRINT_QTY_LABEL, poField } from './po-fields'

/**
 * Khoá BỘ CỘT PHIẾU IN đúng như bản đang gửi nhà cung cấp.
 *
 * Danh sách dưới đây chép từ `columnsFor()` của trang in TRƯỚC khi gộp khai báo —
 * đây là mẫu NCC đang ký, đảo cột là họ phải dò lại đơn. Đổi `PO_FIELDS` hay
 * `PO_PRINT_ORDER` mà quên phiếu in thì test này đỏ.
 */
const NHAN_COT_PHIEU_IN: Record<PoTemplate, string[]> = {
  accessory: [
    'STT',
    'Mã SP',
    'Tên vật tư',
    'Vật liệu',
    'Quy cách',
    'SL đơn hàng',
    'Tồn kho',
    'SL đặt',
    'ĐVT',
    'Đơn giá',
    'Thành tiền',
    'Ghi chú',
  ],
  aluminium: [
    'STT',
    'Mã SP',
    'Tên vật tư',
    'Mã khuôn',
    'kg/m',
    'Dài cây (m)',
    'Số cây',
    'Cây dư',
    'Tổng kg',
    // Nhôm tính tiền theo kg nên nhãn đơn giá phải nói rõ đơn vị.
    'Đơn giá / kg',
    'Thành tiền',
    'Ghi chú',
  ],
  metal_kg: [
    'STT',
    'Mã SP',
    'Tên vật tư',
    'Vật liệu',
    'Kích thước',
    'Màu / bề mặt',
    'ĐVT',
    'Số lượng',
    'kg / đơn vị',
    'Tổng kg',
    'Đơn giá / kg',
    'Thành tiền',
    'Ghi chú',
  ],
  carton: [
    'STT',
    'Mã SP',
    'Tên vật tư',
    'Cách mở',
    'Pcs/thùng',
    'Số thùng',
    'Lọt lòng D×R×C (mm)',
    'm²/thùng',
    'Đơn giá',
    'Thành tiền',
    'Ghi chú',
  ],
  simple: [
    'STT',
    'Mã SP',
    'Tên vật tư',
    'Quy cách',
    'ĐVT',
    'Số lượng',
    'Đơn giá',
    'Thành tiền',
    'Ghi chú',
  ],
}

/** Dựng nhãn cột từ khai báo — đúng cách trang in đang làm. */
function nhanCot(t: PoTemplate): string[] {
  const CO_DINH: Record<string, string> = {
    '@stt': 'STT',
    '@productcode': 'Mã SP',
    '@name': 'Tên vật tư',
    '@unit': 'ĐVT',
    '@price': 'Đơn giá',
    '@amount': 'Thành tiền',
    '@note': 'Ghi chú',
  }
  const unit = poTemplateMeta(t).priceUnit
  return PO_PRINT_ORDER[t].map((key) => {
    if (key === '@qty') return PO_PRINT_QTY_LABEL[t]
    // Mẫu tính tiền theo kg thì nhãn đơn giá kèm đơn vị ("Đơn giá / kg").
    if (key === '@price') return unit ? `Đơn giá / ${unit}` : 'Đơn giá'
    if (key.startsWith('@')) return CO_DINH[key]
    const f = poField(t, key)
    if (!f) throw new Error(`Mẫu ${t}: cột "${key}" không có trong PO_FIELDS`)
    return f.printLabel ?? f.label
  })
}

describe('PO_PRINT_ORDER — bộ cột phiếu in', () => {
  for (const t of PO_TEMPLATES) {
    it(`mẫu ${t} giữ nguyên thứ tự cột đang ký với NCC`, () => {
      expect(nhanCot(t)).toEqual(NHAN_COT_PHIEU_IN[t])
    })
  }

  it('mọi key trong thứ tự in đều có khai báo (không gõ nhầm)', () => {
    for (const t of PO_TEMPLATES)
      for (const key of PO_PRINT_ORDER[t])
        if (!key.startsWith('@')) expect(poField(t, key), `${t}/${key}`).toBeTruthy()
  })

  it('hao hụt % không in cho NCC — số nội bộ', () => {
    expect(PO_FIELDS.accessory.some((f) => f.key === 'waste')).toBe(true)
    expect(PO_PRINT_ORDER.accessory).not.toContain('waste')
  })

  it('cột số lượng nằm GIỮA phần thông số ở mẫu nhôm và bao bì', () => {
    // Đảo về cuối là sai mẫu giấy: nhôm đọc "dài cây → số cây → cây dư".
    const nhom = PO_PRINT_ORDER.aluminium
    expect(nhom.indexOf('@qty')).toBeGreaterThan(nhom.indexOf('barlen'))
    expect(nhom.indexOf('@qty')).toBeLessThan(nhom.indexOf('surplus'))
    const bb = PO_PRINT_ORDER.carton
    expect(bb.indexOf('@qty')).toBeGreaterThan(bb.indexOf('pcs'))
    expect(bb.indexOf('@qty')).toBeLessThan(bb.indexOf('inner'))
  })
})
