import type { PoTemplate, PoTerms } from '@/lib/po-template'
import { poTemplateMeta } from '@/lib/po-template'
import {
  templateDefaults,
  type PoHeader,
} from '@/app/(workspace)/planning/pos/new/po-draft'
import type { Line } from '@/app/(workspace)/planning/pos/new/po-line'
import type { Check } from '@/components/kit'

/**
 * LOGIC THUẦN CỦA MÀN CHỨNG TỪ HỢP NHẤT — không React, có test.
 *
 * Hai việc: (1) đổi một đơn đã lưu thành `PoHeader` mà form hiểu, và ngược lại
 * dựng `PoHeader` trống cho đơn mới; (2) bảng kiểm trước khi gửi duyệt — trước
 * đây nằm inline trong `PoDetailScreen.tsx:540-573`, không kiểm được.
 */

export type PoForHeader = {
  template: PoTemplate
  production_order_id: string | null
  supplier_id: string
  currency: string
  vat_rate: number | null
  price_includes_vat: boolean
  discount_amount: number | null
  contract_no: string | null
  expected_at: string | null
  note: string | null
  signer_role: string | null
  terms_quality: string | null
  terms_delivery_place: string | null
  terms_payment: string | null
  terms_invoice: string | null
  terms_lead_time: string | null
}

/** Đơn đã lưu → đầu đơn để sửa. Điều khoản trống thì lấy mặc định của mẫu. */
export function headerFromPo(po: PoForHeader, extraLsxIds: string[]): PoHeader {
  const meta = poTemplateMeta(po.template)
  const terms: PoTerms = {
    quality: po.terms_quality ?? meta.terms.quality,
    delivery_place: po.terms_delivery_place ?? meta.terms.delivery_place,
    payment: po.terms_payment ?? meta.terms.payment,
    invoice: po.terms_invoice ?? meta.terms.invoice,
    lead_time: po.terms_lead_time ?? meta.terms.lead_time,
  }
  return {
    template: po.template,
    poType: po.production_order_id ? 'lsx' : 'standalone',
    lsxId: po.production_order_id ?? '',
    extraLsxIds,
    supplierId: po.supplier_id,
    expectedAt: po.expected_at ? po.expected_at.slice(0, 10) : '',
    contractNo: po.contract_no ?? '',
    currency: po.currency,
    note: po.note ?? '',
    discount: po.discount_amount ?? '',
    vat: po.vat_rate ?? '',
    inclVat: po.price_includes_vat,
    terms,
    signerRole: po.signer_role ?? meta.signerRole,
  }
}

/** Đầu đơn cho ĐƠN MỚI — mẫu 'simple', mọi thứ lấy mặc định của mẫu. */
export function newHeader(opts: {
  supplierId?: string
  lsxId?: string
  currency?: string
  template?: PoTemplate
}): PoHeader {
  const template = opts.template ?? 'simple'
  const d = templateDefaults(template)
  return {
    template,
    poType: opts.lsxId ? 'lsx' : 'standalone',
    lsxId: opts.lsxId ?? '',
    extraLsxIds: [],
    supplierId: opts.supplierId ?? '',
    expectedAt: '',
    contractNo: '',
    currency: opts.currency ?? 'VND',
    note: '',
    discount: '',
    vat: d.vat,
    inclVat: d.inclVat,
    terms: d.terms,
    signerRole: d.signerRole,
  }
}

/** Đổi mẫu thì điều khoản/VAT/người ký nhảy theo mẫu mới — giữ phần đã gõ khác. */
export function retemplate(h: PoHeader, t: PoTemplate): PoHeader {
  const d = templateDefaults(t)
  return { ...h, template: t, vat: d.vat, inclVat: d.inclVat, terms: d.terms, signerRole: d.signerRole } // prettier-ignore
}

/**
 * BẢNG KIỂM TRƯỚC KHI GỬI DUYỆT — năm luật y hệt màn chi tiết cũ, nay là hàm
 * thuần để hai màn không lệch nhau và để test được.
 *
 * `stop` chặn gửi; `warn` cho gửi nhưng nói ra. Chỉ có nghĩa khi đơn còn ở
 * nháp hoặc chờ duyệt — đơn đã gửi NCC thì bảng kiểm không còn việc.
 */
export function poChecks(
  po: { status: string; production_order_id: string | null; expected_at: string | null },
  lines: { unit_price: number | null }[],
  today: string,
): Check[] {
  if (po.status !== 'draft' && po.status !== 'pending_approval') return []
  const out: Check[] = []
  const noPrice = lines.filter((l) => l.unit_price == null).length
  if (lines.length === 0) out.push({ level: 'stop', what: 'Đơn chưa có dòng vật tư nào', fix: 'Thêm ít nhất một dòng' }) // prettier-ignore
  if (noPrice > 0) out.push({ level: 'stop', what: `${noPrice} dòng chưa có đơn giá`, fix: 'Nhập giá hoặc ghi “chờ báo giá”' }) // prettier-ignore
  if (!po.production_order_id) out.push({ level: 'warn', what: 'Chưa gắn lệnh sản xuất', fix: 'Gắn lệnh, hoặc bỏ qua nếu mua bù tồn' }) // prettier-ignore
  if (!po.expected_at) out.push({ level: 'warn', what: 'Chưa có hạn giao', fix: 'Điền hạn giao' }) // prettier-ignore
  else if (po.expected_at.slice(0, 10) < today) out.push({ level: 'warn', what: `Hạn giao ${dmy(po.expected_at)} đã qua`, fix: 'Cập nhật hạn hoặc ghi lý do' }) // prettier-ignore
  return out
}

const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/** Dòng nào của lưới đang thiếu gì — để tô ô và để câu chặn lưu nói đúng dòng. */
export function lineIssues(
  template: PoTemplate,
  lines: Line[],
  problemOf: (t: PoTemplate, l: Line) => string | null,
): { index: number; why: string }[] {
  return lines
    .map((l, index) => ({ index, why: problemOf(template, l) }))
    .filter((x): x is { index: number; why: string } => x.why != null)
}
