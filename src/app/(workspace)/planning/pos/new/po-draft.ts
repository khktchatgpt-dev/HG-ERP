import { poTemplateMeta, type PoTemplate, type PoTerms } from '@/lib/po-template'
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
  const subtotal = Math.round(
    lines.reduce((s, l) => s + lineAmount(header.template, l), 0),
  )
  const discountAmount = header.discount === '' ? 0 : Number(header.discount)
  const base = Math.max(0, subtotal - discountAmount)
  const vatRate = header.vat === '' ? 0 : Number(header.vat)
  // Giá đã gồm VAT: tách ngược ra khỏi tiền hàng, KHÔNG cộng thêm lần nữa.
  const vatAmount = header.inclVat
    ? Math.round((base * vatRate) / (100 + vatRate))
    : Math.round((base * vatRate) / 100)
  return {
    subtotal,
    discountAmount,
    vatAmount,
    grandTotal: header.inclVat ? base : base + vatAmount,
  }
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
export function buildPoPayload(header: PoHeader, lines: Line[]) {
  const { discountAmount } = poTotals(header, lines)
  return {
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
        material_id: l.material_id,
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
        open_style: l.open_style || null,
        pcs_per_ctn: l.pcs_per_ctn === '' ? null : Number(l.pcs_per_ctn),
        inner_l_mm: l.inner_l_mm === '' ? null : Number(l.inner_l_mm),
        inner_w_mm: l.inner_w_mm === '' ? null : Number(l.inner_w_mm),
        inner_h_mm: l.inner_h_mm === '' ? null : Number(l.inner_h_mm),
        area_m2: d.area_m2,
        // Cơ sở tính tiền chỉ có nghĩa ở mẫu bao bì — mẫu khác gửi null cho sạch.
        carton_basis: header.template === 'carton' ? l.carton_basis : null,
        // Đóng gói mua: CHỤP theo danh mục tại thời điểm lập đơn (0128). Gửi
        // cả cặp hoặc không gửi gì — thiếu một nửa thì phiếu in ra "= 28"
        // không có đơn vị, hoặc "= bì" không có số.
        pack_size: l.pack_size && l.pack_unit ? l.pack_size : null,
        pack_unit: l.pack_size && l.pack_unit ? l.pack_unit : null,
      }
    }),
  }
}
