import { deriveLine, type PoTemplate } from '@/lib/po-template'
import type { PoPrintHeader, PoPrintLine } from '@/app/print/supply/PoPrintSheet'
import { draftOf, type Line } from './po-line'
import type { PoHeader } from './po-draft'

/**
 * BẢN NHÁP ĐANG GÕ → TỜ PHIẾU IN.
 *
 * Cho nút "Xem trước phiếu in" dựng đúng tờ sẽ gửi NCC ngay lúc đơn còn chưa
 * tạo. Trước đây muốn xem phiếu phải tạo đơn thật rồi mở lại, tức mọi sai sót về
 * bố cục hay điều khoản chỉ lộ ra khi đơn đã nằm chờ Giám đốc duyệt.
 *
 * ⭐ `qty2 / price_basis` đi qua ĐÚNG `deriveLine` mà server dùng, không tự tính
 * riêng ở đây. Xem trước mà lấy công thức khác bản thật thì tệ hơn không có: nó
 * cho người dùng tin vào một con số không phải con số sẽ in ra.
 */
export function previewLinesFromDraft(
  template: PoTemplate,
  lines: Line[],
): PoPrintLine[] {
  return lines.map((l) => {
    const draft = draftOf(l)
    const d = deriveLine(template, draft)
    return {
      id: l.material_id,
      material_code: l.code,
      material_name: l.name,
      material_unit: l.unit,
      qty_ordered: Number(l.qty) || 0,
      unit_price: l.price === '' ? null : Number(l.price),
      price_basis: d.price_basis,
      qty2: d.qty2,
      // 0182 — nhãn lấy từ deriveLine (chỉ có khi cặp trọn vẹn), khớp bản in thật.
      unit2_per_unit: draft.unit2_per_unit,
      unit2: d.unit2,
      spec: l.spec.trim() || null,
      note: l.note.trim() || null,
      material_grade: l.material_grade.trim() || null,
      dm_per_sp: l.dm_per_sp === '' ? null : Number(l.dm_per_sp),
      qty_demand: l.qty_demand === '' ? null : Number(l.qty_demand),
      qty_on_hand: l.qty_on_hand === '' ? null : Number(l.qty_on_hand),
      die_code: l.die_code.trim() || null,
      weight_per_m: draft.weight_per_m,
      bar_length_m: draft.bar_length_m,
      dimension_text: l.dimension_text.trim() || null,
      finish: l.finish.trim() || null,
      weight_per_unit: draft.weight_per_unit,
      // 0139 — cột riêng: gỗ m³/SP, mro bảo hành.
      m3_per_unit: draft.m3_per_unit,
      warranty_text: l.warranty_text.trim() || null,
      open_style: l.open_style || null,
      pcs_per_ctn: l.pcs_per_ctn === '' ? null : Number(l.pcs_per_ctn),
      inner_l_mm: l.inner_l_mm === '' ? null : Number(l.inner_l_mm),
      inner_w_mm: l.inner_w_mm === '' ? null : Number(l.inner_w_mm),
      inner_h_mm: l.inner_h_mm === '' ? null : Number(l.inner_h_mm),
      area_m2: draft.area_m2,
      price_per_m2: l.price_per_m2 === '' ? null : Number(l.price_per_m2),
      print_fee: l.print_fee === '' ? null : Number(l.print_fee),
      // Cùng điều kiện với `buildPoPayload`: basis chỉ ở mẫu chốt theo dòng.
      carton_basis: ['carton', 'glass', 'foam'].includes(template)
        ? l.carton_basis
        : null,
      // Xem trước phải thấy đúng dòng quy đổi sẽ in ra (0128) — cùng điều kiện
      // "đủ cả cặp" như `buildPoPayload`, không thì bản xem trước và bản lưu
      // khác nhau ở đúng chỗ người ta soi.
      pack_size: l.pack_size && l.pack_unit ? l.pack_size : null,
      pack_unit: l.pack_size && l.pack_unit ? l.pack_unit : null,
    }
  })
}

/**
 * Đầu đơn cho bản xem trước.
 *
 * `code` chưa có thật (server cấp lúc lưu) nên ghi rõ là bản nháp — in ra tờ có
 * số đơn giả rồi gửi NCC là hỏng việc.
 */
export function previewHeaderFromDraft(
  header: PoHeader,
  opts: {
    code: string
    supplierName: string
    lsxCode: string | null
    orderCode: string | null
    createdAt: string
  },
): PoPrintHeader {
  return {
    code: opts.code,
    template: header.template,
    currency: header.currency,
    vat_rate: header.vat === '' ? null : Number(header.vat),
    price_includes_vat: header.inclVat,
    discount_amount: header.discount === '' ? null : Number(header.discount),
    contract_no: header.contractNo.trim() || null,
    expected_at: header.expectedAt || null,
    note: header.note.trim() || null,
    terms: null,
    terms_quality: header.terms.quality || null,
    terms_delivery_place: header.terms.delivery_place || null,
    terms_payment: header.terms.payment || null,
    terms_invoice: header.terms.invoice || null,
    terms_lead_time: header.terms.lead_time || null,
    signer_role: header.signerRole || null,
    lsx_code: opts.lsxCode,
    order_code: opts.orderCode,
    supplier_name: opts.supplierName,
    created_at: opts.createdAt,
  }
}
