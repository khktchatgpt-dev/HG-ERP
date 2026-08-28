import { poTemplateMeta, type PoTemplate, type PoTerms } from '@/lib/po-template'
import { poMoney } from '@/lib/po-line'
import {
  draftOf,
  lineAmount,
  lineProblem,
  lineReady,
  type Line,
  type Num,
} from './po-line'

/**
 * QUY TẮC CỦA BẢN NHÁP ĐƠN — phần THUẦN, không dính React.
 *
 * Tách khỏi `PoCreateForm` để test được: mấy quy tắc dưới đây trước nay chỉ sống
 * trong tay người dùng, mà sai một cái là sai tiền trên giấy đã ký —
 *   · đổi mẫu đơn thì VAT / điều khoản / chữ ký đổi theo mẫu mới
 *   · thứ tự cộng tiền: hàng → trừ chiết khấu → VAT (đúng phiếu thật)
 *   · giá "đã gồm VAT" tính ngược, không cộng thêm
 *   · dựng payload gửi API
 */

/** Phần đầu đơn — mọi thứ không thuộc dòng hàng. */
export type PoHeader = {
  template: PoTemplate
  poType: 'lsx' | 'standalone'
  lsxId: string
  /** LSX PHỤ gộp thêm vào đơn (0125) — "LSX 01+2+3/26-27". */
  extraLsxIds: string[]
  supplierId: string
  expectedAt: string
  contractNo: string
  currency: string
  note: string
  discount: Num
  vat: Num
  inclVat: boolean
  terms: PoTerms
  signerRole: string
}

/** Mặc định theo mẫu đơn: VAT, giá đã gồm VAT chưa, điều khoản, chữ ký giữa phiếu. */
export function templateDefaults(
  t: PoTemplate,
): Pick<PoHeader, 'vat' | 'inclVat' | 'terms' | 'signerRole'> {
  const m = poTemplateMeta(t)
  return {
    vat: m.vatRate ?? '',
    inclVat: m.priceIncludesVat,
    terms: m.terms,
    signerRole: m.signerRole,
  }
}

/**
 * Tổng tiền của đơn.
 *
 * Làm tròn về đồng NGAY ở tiền hàng: tiền từng dòng lẻ vô hạn (kg × đơn giá), để
 * trôi xuống thì tổng thanh toán in ra "44.477.168,4" — không ai ký được.
 */
export function poTotals(header: PoHeader, lines: Line[]) {
  // Phép tính nằm ở `@/lib/po-line` để trang CHI TIẾT đơn nói ra đúng con số
  // này — trước đó chi tiết chỉ hiện Σ dòng, tức số trước chiết khấu và VAT.
  return poMoney({
    subtotalRaw: lines.reduce((s, l) => s + lineAmount(header.template, l), 0),
    discount: header.discount === '' ? 0 : Number(header.discount),
    vatRate: header.vat === '' ? 0 : Number(header.vat),
    priceIncludesVat: header.inclVat,
    // VND tròn đồng, USD/EUR/CNY tròn cent — cùng mốc với chi tiết/in/Excel.
    currency: header.currency,
  })
}

/**
 * Lý do CHƯA gửi được đơn — null là gửi được. Thứ tự theo mức nghiêm trọng.
 *
 * Dòng thiếu số thì CHỈ ĐÍCH DANH dòng đầu tiên và thiếu gì. Bản cũ chỉ nói
 * "2 dòng còn thiếu số": đơn 20 dòng thì người dùng phải tự dò từng dòng xem
 * chỗ nào đỏ, trong khi `lineProblem` đã biết chính xác thiếu ô nào.
 */
export function draftProblem(header: PoHeader, lines: Line[]): string | null {
  if (header.poType === 'lsx' && !header.lsxId) return 'chưa chọn LSX'
  if (!header.supplierId) return 'chưa chọn nhà cung cấp'
  if (lines.length === 0) return 'chưa có dòng vật tư nào'

  const thieu = lines
    .map((l, i) => ({ i, why: lineProblem(header.template, l) }))
    .filter((x) => x.why)
  if (thieu.length === 0) return null

  const first = thieu[0]
  const dau = `dòng ${first.i + 1} ${first.why}`
  return thieu.length === 1 ? dau : `${dau} (và ${thieu.length - 1} dòng nữa)`
}

export function readyLineCount(template: PoTemplate, lines: Line[]): number {
  return lines.filter((l) => lineReady(template, l)).length
}

/**
 * Payload gửi `/api/dept/supply/pos`.
 *
 * `qty2 / price_basis / weight_*` KHÔNG gửi thẳng số người dùng gõ — `draftOf()`
 * dẫn xuất theo mẫu đơn, và server còn dẫn xuất lại lần nữa. Nhờ vậy không có
 * đường nào để một dòng lọt vào DB với tổng kg không khớp thông số của chính nó.
 */
/** Đợt giao khai trong form (28/08) — trỏ dòng theo chỉ số trên lưới. */
export type DraftShipmentPayload = {
  expected_date: string
  lines: { line_index: number; qty: number }[]
}

export function buildPoPayload(
  header: PoHeader,
  lines: Line[],
  shipments?: DraftShipmentPayload[],
) {
  const { discountAmount } = poTotals(header, lines)
  return {
    // Bỏ trống = đơn giao một lần theo ô Hẹn giao (server hiểu undefined
    // là "không đụng tới đợt", mảng rỗng là "xoá hết đợt").
    shipments,
    production_order_id: header.poType === 'lsx' ? header.lsxId : null,
    extra_lsx_ids: header.poType === 'lsx' ? header.extraLsxIds : [],
    supplier_id: header.supplierId,
    template: header.template,
    currency: header.currency,
    vat_rate: header.vat === '' ? null : Number(header.vat),
    price_includes_vat: header.inclVat,
    discount_amount: discountAmount || null,
    contract_no: header.contractNo.trim() || null,
    expected_at: header.expectedAt || null,
    terms_quality: header.terms.quality || null,
    terms_delivery_place: header.terms.delivery_place || null,
    terms_payment: header.terms.payment || null,
    terms_invoice: header.terms.invoice || null,
    terms_lead_time: header.terms.lead_time || null,
    signer_role: header.signerRole || null,
    note: header.note.trim() || null,
    lines: lines.map((l) => {
      const d = draftOf(l)
      return {
        // Dòng tự do (0134): material_id chỉ là khóa cục bộ của form — DB nhận
        // null + tên/ĐVT tự gõ (chỉ mẫu gỗ/gia công, service chặn mẫu khác).
        material_id: l.is_free ? null : l.material_id,
        line_name: l.is_free ? l.name.trim() || null : null,
        line_unit: l.is_free ? l.unit.trim() || null : null,
        qty_ordered: d.qty_ordered,
        unit_price: l.price === '' ? null : Number(l.price),
        spec: l.spec.trim() || null,
        note: l.note.trim() || null,
        material_grade: l.material_grade.trim() || null,
        dm_per_sp: l.dm_per_sp === '' ? null : Number(l.dm_per_sp),
        qty_demand: l.qty_demand === '' ? null : Number(l.qty_demand),
        qty_on_hand: l.qty_on_hand === '' ? null : Number(l.qty_on_hand),
        die_code: l.die_code.trim() || null,
        weight_per_m: d.weight_per_m,
        bar_length_m: d.bar_length_m,
        dimension_text: l.dimension_text.trim() || null,
        finish: l.finish.trim() || null,
        weight_per_unit: d.weight_per_unit,
        // 0139 — cột riêng: gỗ m³/SP, mro bảo hành (hết mượn weight_per_unit/finish).
        m3_per_unit: d.m3_per_unit,
        warranty_text: l.warranty_text.trim() || null,
        open_style: l.open_style || null,
        pcs_per_ctn: l.pcs_per_ctn === '' ? null : Number(l.pcs_per_ctn),
        inner_l_mm: l.inner_l_mm === '' ? null : Number(l.inner_l_mm),
        inner_w_mm: l.inner_w_mm === '' ? null : Number(l.inner_w_mm),
        inner_h_mm: l.inner_h_mm === '' ? null : Number(l.inner_h_mm),
        area_m2: d.area_m2,
        price_per_m2: l.price_per_m2 === '' ? null : Number(l.price_per_m2),
        print_fee: l.print_fee === '' ? null : Number(l.print_fee),
        // Cơ sở tính tiền chỉ có nghĩa ở mẫu chốt basis từng dòng (bao bì,
        // kính, xốp) — mẫu khác gửi null cho sạch.
        carton_basis: ['carton', 'glass', 'foam'].includes(header.template)
          ? l.carton_basis
          : null,
        // Đóng gói mua: CHỤP theo danh mục tại thời điểm lập đơn (0128). Gửi
        // cả cặp hoặc không gửi gì — thiếu một nửa thì phiếu in ra "= 28"
        // không có đơn vị, hoặc "= bì" không có số.
        pack_size: l.pack_size && l.pack_unit ? l.pack_size : null,
        pack_unit: l.pack_size && l.pack_unit ? l.pack_unit : null,
      }
    }),
  }
}
