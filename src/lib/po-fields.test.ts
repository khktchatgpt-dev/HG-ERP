import { describe, expect, it } from 'vitest'
import { PO_TEMPLATES, poTemplateMeta, type PoTemplate } from './po-template'
import {
  PO_FIELDS,
  PO_PRINT_ORDER,
  PO_PRINT_QTY_LABEL,
  poField,
} from './po-fields'

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
 * phẩm / vật tư" và kèm đơn vị tiền trong ngoặc ở hai cột tiền. Nhãn ở đây giả
 * định đơn VND — trang in lấy đúng `po.currency`.
 *
 * ĐVT có mặt ở CẢ CHÍN mẫu và luôn đứng ngay trước cột số lượng (10/08/2026).
 * Bao bì trước đây bị bỏ với lý do "đơn vị của bao bì luôn là thùng" — sai với
 * danh mục thật: nhóm bao bì có 24 đơn vị, chỉ 259/942 mã là Thùng.
 */
/**
 * KHUNG CHUẨN 08/2026, chỉnh 12/08/2026 theo form mẫu mới: mọi mẫu mở đầu
 * `STT · Tên SP/vật tư`. LSX + Đơn hàng nằm ở KHUNG GÓC PHẢI đầu phiếu chứ
 * không phải cột bảng kê; cột "Mã sản phẩm" (mã vật tư danh mục) bỏ khỏi mọi
 * mẫu. Mẫu đơn giản thêm `Ngày đặt hàng · Thời gian giao hàng` đúng ảnh chuẩn.
 */
const NHAN_COT_PHIEU_IN: Record<PoTemplate, string[]> = {
  accessory: [
    'STT',
    'Tên sản phẩm / vật tư',
    'Vật liệu',
    'Quy cách',
    'SL đơn hàng',
    // "Tồn kho" bỏ 12/08/2026 (duyệt cột từng mẫu) — số nội bộ, không in cho NCC.
    'ĐVT',
    'SL đặt',
    'Đơn giá (VND)',
    'Thành tiền (VND)',
    'Ghi chú',
  ],
  aluminium: [
    'STT',
    'Tên sản phẩm / vật tư',
    'Mã khuôn',
    'kg/m',
    'Dài cây (m)',
    'ĐVT',
    // "Số cây" → "Số lượng" (12/08/2026) — nhãn đồng bộ, đơn vị cây nói ở ĐVT.
    'Số lượng',
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
    'Tên sản phẩm / vật tư',
    'Cách mở',
    'Pcs/thùng',
    'ĐVT',
    // "Số thùng" → "Số lượng" (12/08/2026) — ĐVT thật của dòng nói ở cột ĐVT.
    'Số lượng',
    'Lọt lòng D×R×C (mm)',
    'm²/thùng',
    // Đơn thật in cả giá/m² + bản in trước đơn giá/thùng (0134 — Hồng Đào CL).
    'Đơn giá/m²',
    'Bản in + công',
    'Đơn giá (VND)',
    'Thành tiền (VND)',
    'Ghi chú',
  ],
  // 3 mẫu 08/08/2026 — đối chiếu đơn thật trên Drive Cung ứng:
  // mây theo form Vipora (Định mức đứng sau tiền), sơn theo form Green Coatings.
  rattan: [
    'STT',
    'Tên sản phẩm / vật tư',
    'Quy cách',
    'ĐVT',
    'Số lượng',
    'Đơn giá (VND)',
    'Thành tiền (VND)',
    'Định mức',
    'Ghi chú',
  ],
  paint: [
    'STT',
    'Tên sản phẩm / vật tư',
    'Mã màu NCC',
    'ĐVT',
    'Số lượng',
    'Đơn giá (VND)',
    'Thành tiền (VND)',
    // "Ngày đặt · Thời gian giao" bỏ 12/08/2026 — đã có ở đầu phiếu.
    'Ghi chú',
  ],
  chemical: [
    'STT',
    'Tên sản phẩm / vật tư',
    'Quy cách',
    'ĐVT',
    'Số lượng',
    'Đơn giá (VND)',
    'Thành tiền (VND)',
    'Ghi chú',
  ],
  foam: [
    'STT',
    'Tên sản phẩm / vật tư',
    'Quy cách',
    // "D×R×Dày" + "Tổng m³" bỏ khỏi phiếu in 12/08/2026 — vẫn là ô trên form
    // để tính m³ và gợi ý giá, không in cho NCC.
    'ĐVT',
    'Số lượng',
    'Đơn giá (VND)',
    'Thành tiền (VND)',
    'Ghi chú',
  ],
  // 3 mẫu 12/08/2026 — bàn giao A Nhân (kính Mai Trang, gỗ Minh Đạt, gia công
  // New ISO/Tiến Phước).
  glass: [
    'STT',
    'Tên sản phẩm / vật tư',
    'Loại kính',
    'Quy cách',
    'ĐVT',
    'Số lượng',
    'm²/tấm',
    // "Tổng m²" bỏ khỏi phiếu in 12/08/2026 — vẫn tự tính trên form.
    'Đơn giá (VND)',
    'Thành tiền (VND)',
    'Ghi chú',
  ],
  wood: [
    'STT',
    'Tên sản phẩm / vật tư',
    'ĐVT',
    'Số lượng',
    'm³ / SP',
    'Tổng m³',
    'Đơn giá (VND/m³)',
    'Thành tiền (VND)',
    'Loại gỗ',
    'Màu gỗ',
    // "KH giao hàng" theo dòng bỏ 12/08/2026 — hẹn giao dùng chung đầu phiếu.
    'Ghi chú',
  ],
  // Mẫu 'outsourcing' đã gỡ 12/08/2026 — gia công là nghiệp vụ ngoài tầm vật tư.
  // MRO (10/08/2026) — chưa có đơn thật để chép; bộ cột dựng theo nhu cầu đã rà:
  // NCC giao đúng nhờ MODEL, phòng đối chiếu về sau nhờ "dùng cho máy" + bảo hành.
  mro: [
    'STT',
    'Tên sản phẩm / vật tư',
    'Model / Mã hãng',
    'Quy cách',
    'Dùng cho máy / vị trí',
    'ĐVT',
    'Số lượng',
    'Đơn giá (VND)',
    'Thành tiền (VND)',
    'Bảo hành',
    'Ghi chú',
  ],
  simple: [
    'STT',
    'Tên sản phẩm / vật tư',
    'Quy cách',
    'ĐVT',
    'Số lượng',
    'Đơn giá (VND)',
    'Thành tiền (VND)',
    // "Ngày đặt · Thời gian giao" bỏ 12/08/2026 — đã có ở đầu phiếu.
    'Ghi chú',
  ],
}

/** Dựng nhãn cột từ khai báo — đúng cách trang in đang làm. */
function nhanCot(t: PoTemplate): string[] {
  const CO_DINH: Record<string, string> = {
    '@stt': 'STT',
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

  it('ĐVT có ở mọi mẫu và đứng ngay trước cột số lượng', () => {
    // Đồng bộ 9/9 (10/08/2026): bao bì từng thiếu hẳn cột này, phụ kiện in nó
    // sau cột SL. Đơn vị phải nằm sát con số thì NCC mới đọc được "540 Con"
    // thay vì đoán theo tên hàng.
    for (const t of PO_TEMPLATES) {
      const cols = PO_PRINT_ORDER[t]
      expect(cols, `${t} thiếu ĐVT`).toContain('@unit')
      expect(cols.indexOf('@qty'), `${t}: ĐVT phải sát trước SL`).toBe(
        cols.indexOf('@unit') + 1,
      )
    }
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

