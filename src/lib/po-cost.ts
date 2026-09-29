import { nod } from './material-key'
import { roundMoney } from './po-line'
import type { LedgerEntry } from './ap-ledger'

/**
 * PHIẾU CHI PHÍ MUA HÀNG (0211) — phí vận chuyển / bốc xếp / phí khác của đơn
 * mua. Người thu là NCC của đơn HOẶC nhà xe; một phiếu gắn được nhiều đơn (một
 * chuyến xe chở hàng của nhiều đơn). Chưa cộng vào giá vốn nhập kho — nằm
 * riêng cho Kế toán (chủ dự án chốt 26/09/2026).
 *
 * File này thuần: chia tiền, tính VAT, luật đơn nào nhận phí. Service và hàm
 * DB `supply_po_cost_create` dùng đúng các con số nó trả về.
 */

export const PO_COST_KINDS = ['van_chuyen', 'boc_xep', 'khac'] as const
export type PoCostKind = (typeof PO_COST_KINDS)[number]

export const PO_COST_KIND_LABEL: Record<PoCostKind, string> = {
  van_chuyen: 'Vận chuyển',
  boc_xep: 'Bốc xếp',
  khac: 'Phí khác',
}

/** Trạng thái đơn nhận phí được — cùng tập với `canCarryCost` và hàm DB. */
export const PO_COST_STATUSES = [
  'approved',
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
  'received',
] as const

/**
 * HÌNH THỨC VẬN CHUYỂN (0215, chốt 28/09/2026): nhà xe / chành trong danh mục;
 * ship lẻ (Grab, Ahamove, shipper…) gõ tự do trên phiếu; NCC tự giao và tính
 * phí trên hoá đơn của họ. Xe công ty KHÔNG ghi phiếu phí (xăng dầu là chi phí
 * xưởng) — chủ dự án chốt theo khuyến nghị.
 */
export const TRANSPORT_MODES = ['nha_xe', 'ship_le', 'ncc'] as const
export type TransportMode = (typeof TRANSPORT_MODES)[number]
export const TRANSPORT_MODE_LABEL: Record<TransportMode, string> = {
  nha_xe: 'Nhà xe · chành',
  ship_le: 'Ship lẻ',
  ncc: 'NCC tự giao',
}

/** Người trong công ty trả tại chỗ bằng gì — Kế toán hoàn lại theo đó. */
export const PAID_METHODS = ['tien_mat', 'ck_ca_nhan'] as const
export type PaidMethod = (typeof PAID_METHODS)[number]
export const PAID_METHOD_LABEL: Record<PaidMethod, string> = {
  tien_mat: 'Tiền mặt',
  ck_ca_nhan: 'CK cá nhân',
}

export const CARRIER_KINDS = ['nha_xe', 'tai_xe_le'] as const
export type CarrierKind = (typeof CARRIER_KINDS)[number]
export const CARRIER_KIND_LABEL: Record<CarrierKind, string> = {
  nha_xe: 'Nhà xe · chành',
  tai_xe_le: 'Tài xế lẻ đã lưu',
}

export type CostAllocation = { po_id: string; base: number; amount: number }

/**
 * Chia tiền phiếu (chưa VAT) cho các đơn theo TIỀN HÀNG mỗi đơn.
 *
 * Làm tròn theo tiền tệ (VND về đồng, USD về cent), phần dư làm tròn dồn vào
 * đơn có tiền hàng LỚN NHẤT — Σ phần chia luôn đúng bằng tiền phiếu, hàm DB
 * kiểm lại điều đó. Mọi đơn tiền hàng 0 (đơn gia công chưa có giá) thì chia
 * đều, thay vì chia cho 0.
 */
export function allocateCost(
  amount: number,
  bases: { po_id: string; base: number }[],
  currency?: string | null,
): CostAllocation[] {
  if (bases.length === 0) return []
  const r = (n: number) => roundMoney(n, currency)
  const clean = bases.map((b) => ({
    po_id: b.po_id,
    base: Math.max(0, Number(b.base) || 0),
  }))
  const sum = clean.reduce((s, b) => s + b.base, 0)
  const out = clean.map((b) => ({
    ...b,
    amount: r(sum > 0 ? (amount * b.base) / sum : amount / clean.length),
  }))
  const diff = r(amount - out.reduce((s, x) => s + x.amount, 0))
  if (diff !== 0) {
    let big = 0
    for (let i = 1; i < out.length; i++) if (out[i].base > out[big].base) big = i
    out[big].amount = r(out[big].amount + diff)
  }
  return out
}

/** Tiền chưa VAT → VAT riêng của phí + tổng. Nhà xe không hoá đơn: VAT trống = 0. */
export function costMoney(
  amount: number,
  vatRate: number | null | undefined,
  currency?: string | null,
): { amount: number; vat_amount: number; total: number } {
  const a = roundMoney(amount, currency)
  const vat = roundMoney((a * (Number(vatRate) || 0)) / 100, currency)
  return { amount: a, vat_amount: vat, total: roundMoney(a + vat, currency) }
}

/**
 * Đơn nào nhận phí được. Phí ghi theo số THỰC TẾ lúc hàng về / có hoá đơn,
 * nên đơn phải đã duyệt trở đi. Đơn đã về đủ VẪN nhận — hoá đơn nhà xe
 * thường tới sau khi hàng đã nhập kho.
 */
export function canCarryCost(
  status: string,
): { ok: true } | { ok: false; reason: string } {
  switch (status) {
    case 'approved':
    case 'ordered':
    case 'confirmed':
    case 'in_transit':
    case 'partial':
    case 'received':
      return { ok: true }
    case 'draft':
    case 'pending_approval':
      return {
        ok: false,
        reason: 'Đơn chưa duyệt — phí chỉ ghi khi hàng đã về / có hoá đơn',
      }
    case 'cancelled':
      return { ok: false, reason: 'Đơn đã huỷ — không ghi phí vào đơn đã huỷ' }
    default:
      return { ok: false, reason: `Đơn ở trạng thái "${status}" — không ghi phí được` }
  }
}

/** Loại NCC gán cho nhà xe thêm nhanh từ hộp ghi phí (Q1, chốt 26/09/2026). */
export const CARRIER_TYPE = 'Vận chuyển'

// Chữ chung của một địa chỉ giao — không nói lên bãi nào.
const PLACE_STOP = new Set([
  'nha',
  'xe',
  'chanh',
  'bai',
  'tp',
  'hcm',
  'ql',
  'quan',
  'phuong',
  'duong',
  'so',
  'ap',
  'xa',
  'huyen',
  'tinh',
  'kho',
  'giao',
  'tai',
])

function placeTokens(s: string | null | undefined): Set<string> {
  const plain = nod(s)
  return new Set(
    plain.split(/[^a-z0-9]+/).filter((t) => t.length >= 2 && !PLACE_STOP.has(t)),
  )
}

/**
 * Hai nơi giao có phải CÙNG một chỗ không — để gợi ý "đơn cùng chuyến" (Q2).
 * Địa chỉ gõ tay mỗi đơn một kiểu ("Nhà xe Hùng vịnh, QL 1A…" / "Chành xe hùng
 * vịnh…"), nên so theo TỪ RIÊNG: bỏ dấu, bỏ chữ chung (nhà, xe, bãi, Tp…),
 * trùng ≥ 2 từ là cùng chỗ. Chỉ để GỢI Ý — người dùng vẫn tự tick.
 */
export function samePlace(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ta = placeTokens(a)
  if (ta.size === 0) return false
  let n = 0
  for (const t of placeTokens(b)) if (ta.has(t)) n++
  return n >= 2
}

export type CostPayeeRole = 'carrier' | 'po_supplier' | 'chi_ho'

/**
 * Phiếu này đi vào sổ nào (chốt 26/09 + 28/09/2026).
 *
 * - `chi_ho` — người trong công ty ĐÃ TRẢ TẠI CHỖ (`paid_by`). Nợ là nợ NHÂN
 *   VIÊN, không phải nợ nhà xe: KHÔNG vào sổ 331, nằm ở dải "Chi hộ chờ hoàn"
 *   cho Kế toán hoàn lại. Vào cả hai sổ là Kế toán trả hai lần.
 * - `carrier` — chưa trả, người nhận tiền không phải NCC của đơn nào trong
 *   phiếu (nhà xe). Phiếu chính là chứng từ đòi tiền của họ, không ai nhập hoá
 *   đơn thứ hai → phát sinh tăng TK 331 ngay, theo tổng gồm VAT.
 * - `po_supplier` — NCC của đơn tính phí trên hoá đơn của họ. Ghi thẳng vào sổ
 *   thì khi kế toán nhập hoá đơn NCC (có dòng phí) là nợ tăng GẤP ĐÔI. Nên nó
 *   nằm ở dải "Ngoài sổ" và được mồi thành một dòng của hoá đơn NCC.
 */
export function costPayeeRole(
  payeeId: string | null,
  poSupplierIds: readonly string[],
  paidBy?: string | null,
): CostPayeeRole {
  if (paidBy) return 'chi_ho'
  return payeeId && poSupplierIds.includes(payeeId) ? 'po_supplier' : 'carrier'
}

/**
 * BÚT TOÁN SỔ 331 CỦA MỘT PHIẾU NHÀ XE — gồm cả khi phiếu đã HUỶ.
 *
 * Trước 26/09/2026 phiếu huỷ biến khỏi sổ, kéo theo số dư của MỌI kỳ từ ngày
 * phiếu trở đi đổi ngược lại: sổ tháng trước kế toán đã chốt, đã đối chiếu với
 * nhà xe, mở lại thấy số khác mà không có dòng nào giải thích. Nay phiếu gốc
 * GIỮ NGUYÊN ở ngày của nó, và lúc huỷ đẻ thêm một dòng ĐẢO (phát sinh giảm)
 * vào ngày huỷ — kỳ cũ đứng yên, kỳ huỷ nói rõ vì sao nợ giảm.
 *
 * Ngày đảo không được sớm hơn ngày phiếu (phiếu ghi ngày tương lai rồi huỷ
 * ngay): đảo trước khi phát sinh thì sổ chi tiết âm giữa chừng.
 */
export function carrierLedgerEntries(
  c: {
    payee_supplier_id: string
    kind: PoCostKind
    cost_date: string
    doc_no: string | null
    currency: string
    total: number
    note: string | null
    po_codes: string[]
    /** Ngày huỷ theo giờ VN (YYYY-MM-DD), `null` = còn hiệu lực. */
    voided_on: string | null
    void_reason: string | null
  },
  supplierName: string,
): LedgerEntry[] {
  const doc = `${PO_COST_KIND_LABEL[c.kind]} ${c.doc_no ?? ''}`.trim()
  const base = {
    supplier_id: c.payee_supplier_id,
    supplier_name: supplierName,
    currency: c.currency || 'VND',
  }
  const out: LedgerEntry[] = [
    {
      ...base,
      date: c.cost_date,
      kind: 'invoice',
      doc_no: doc,
      amount: c.total,
      note: [`Phí mua hàng · ${c.po_codes.join(', ')}`, c.note]
        .filter(Boolean)
        .join(' · '),
      label: 'Phiếu phí nhà xe',
    },
  ]
  if (c.voided_on) {
    out.push({
      ...base,
      date: c.voided_on < c.cost_date ? c.cost_date : c.voided_on,
      kind: 'payment',
      doc_no: `Huỷ ${doc}`,
      amount: c.total,
      note: c.void_reason ? `Lý do huỷ: ${c.void_reason}` : null,
      label: 'Huỷ phiếu phí',
    })
  }
  return out
}
