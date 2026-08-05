import { describe, expect, it } from 'vitest'
import { PO_TEMPLATES, poTemplateMeta, type PoTemplate } from './po-template'
import { PO_FIELDS, PO_PRINT_ORDER, PO_PRINT_QTY_LABEL, poField } from './po-fields'

/**
 * Khoá BỘ CỘT PHIẾU IN đúng như bản đang gửi nhà cung cấp.
 *
 * Danh sách dưới đây chép từ `columnsFor()` của trang in TRƯỚC khi gộp khai báo —
 * đây là mẫu NCC đang ký, đảo cột là họ phải dò lại đơn. Đổi `PO_FIELDS` hay
 * `PO_PRINT_ORDER` mà quên phiếu in thì test này đỏ.
 *
 * Cột "Mã SP" ĐÃ BỎ khỏi cả 5 mẫu (yêu cầu phòng Cung ứng). Không dòng đơn nào
 * từng điền nó — kiểm DB lúc bỏ: 11/11 dòng để trống — nên phiếu in chỉ đang
 * tốn một cột rỗng.
 *
 * Nhãn dưới đây chép từ "FORM ĐẶT HÀNG MỚI" — bộ file đơn thật của phòng Cung
 * ứng (`D:\PO`, 45 sheet). Mọi sheet theo form mới gọi cột tên hàng là "Tên sản
 * phẩm / vật tư" và kèm đơn vị tiền trong ngoặc ở hai cột tiền; ĐVT có mặt ở
 * mọi mẫu trừ bao bì (đơn vị của bao bì luôn là thùng). Nhãn ở đây giả định đơn
 * VND — trang in lấy đúng `po.currency`.
 */
/**
 * KHUNG CHUẨN 08/2026: mọi mẫu mở đầu `STT · LSX · Mã sản phẩm · Tên SP/vật tư`
 * (đối chiếu đơn ĐH chuẩn — đơn sơn 01/26 HG/MĐ của phòng Cung ứng). "Mã sản
 * phẩm" là mã vật tư danh mục, luôn có — khác cột "Mã SP" gõ tay đã bỏ ở 0106.
 * Mẫu đơn giản thêm `Ngày đặt hàng · Thời gian giao hàng` đúng ảnh chuẩn.
 */
const NHAN_COT_PHIEU_IN: Record<PoTemplate, string[]> = {
  accessory: [
    'STT',
    'LSX',
    'Mã sản phẩm',
    'Tên sản phẩm / vật tư',
    'Vật liệu',
    'Quy cách',
    'SL đơn hàng',
    'Tồn kho',
    'SL đặt',
    'ĐVT',
    'Đơn giá (VND)',
    'Thành tiền (VND)',
    'Ghi chú',
  ],
  aluminium: [
    'STT',
    'LSX',
    'Mã sản phẩm',
    'Tên sản phẩm / vật tư',
    'Mã khuôn',
    'kg/m',
    'Dài cây (m)',
    'ĐVT',
    'Số cây',
    // "Cây dư" đã bỏ theo yêu cầu phòng Cung ứng — không nhập được thì in ra
    // cũng chỉ là một cột rỗng trên phiếu gửi NCC.
    'Tổng kg',
    // Nhôm tính tiền theo kg nên nhãn đơn giá phải nói rõ đơn vị.
    'Đơn giá (VND/kg)',
    'Thành tiền (VND)',
    'Ghi chú',
  ],
  metal_kg: [
    'STT',
    'LSX',
    'Mã sản phẩm',
    'Tên sản phẩm / vật tư',
    'Vật liệu',
    'Kích thước',
    'Màu / bề mặt',
    'ĐVT',
    'Số lượng',
    'kg / đơn vị',
    'Tổng kg',
    'Đơn giá (VND/kg)',
    'Thành tiền (VND)',
    'Ghi chú',
  ],
  carton: [
    'STT',
    'LSX',
    'Mã sản phẩm',
    'Tên sản phẩm / vật tư',
    'Cách mở',
    'Pcs/thùng',
    'Số thùng',
    'Lọt lòng D×R×C (mm)',
    'm²/thùng',
    'Đơn giá (VND)',
    'Thành tiền (VND)',
    'Ghi chú',
  ],
  simple: [
    'STT',
    'LSX',
    'Mã sản phẩm',
    'Tên sản phẩm / vật tư',
    'Quy cách',
    'ĐVT',
    'Số lượng',
    'Đơn giá (VND)',
    'Thành tiền (VND)',
    'Ngày đặt hàng',
    'Thời gian giao hàng',
    'Ghi chú',
  ],
}

/** Dựng nhãn cột từ khai báo — đúng cách trang in đang làm. */
function nhanCot(t: PoTemplate): string[] {
  const CO_DINH: Record<string, string> = {
    '@stt': 'STT',
    '@lsx': 'LSX',
    '@code': 'Mã sản phẩm',
    '@name': 'Tên sản phẩm / vật tư',
    '@unit': 'ĐVT',
    '@price': 'Đơn giá (VND)',
    '@amount': 'Thành tiền (VND)',
    '@orderdate': 'Ngày đặt hàng',
    '@delivery': 'Thời gian giao hàng',
    '@note': 'Ghi chú',
  }
  const unit = poTemplateMeta(t).priceUnit
  return PO_PRINT_ORDER[t].map((key) => {
    if (key === '@qty') return PO_PRINT_QTY_LABEL[t]
    // Mẫu tính tiền theo kg thì nhãn đơn giá kèm đơn vị ("Đơn giá (VND/kg)").
    if (key === '@price') return unit ? `Đơn giá (VND/${unit})` : 'Đơn giá (VND)'
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

  it('hao hụt % không phải một cột — không nhập tay, không in cho NCC', () => {
    // Bỏ theo yêu cầu phòng Cung ứng: tỉ lệ hao hụt là quy ước chung (3%), gộp
    // sẵn vào SL gợi ý chứ không gõ từng dòng. Đơn giấy cũng gộp vào nhãn cột
    // số lượng ("SL Đặt hàng hh 3%"), không tách cột riêng.
    expect(PO_FIELDS.accessory.some((f) => f.key === 'waste')).toBe(false)
    expect(PO_PRINT_ORDER.accessory).not.toContain('waste')
  })

  it('cột số lượng nằm GIỮA phần thông số ở mẫu nhôm và bao bì', () => {
    // Đảo về cuối là sai mẫu giấy: nhôm đọc "dài cây → số cây → cây dư".
    const nhom = PO_PRINT_ORDER.aluminium
    expect(nhom.indexOf('@qty')).toBeGreaterThan(nhom.indexOf('barlen'))
    // "Cây dư" đã bỏ (yêu cầu phòng Cung ứng) — số cây giờ đứng ngay trước tổng kg.
    expect(nhom.indexOf('@qty')).toBeLessThan(nhom.indexOf('kgtotal'))
    const bb = PO_PRINT_ORDER.carton
    expect(bb.indexOf('@qty')).toBeGreaterThan(bb.indexOf('pcs'))
    expect(bb.indexOf('@qty')).toBeLessThan(bb.indexOf('inner'))
  })
})
