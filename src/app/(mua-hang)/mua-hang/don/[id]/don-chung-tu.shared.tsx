'use client'

import { type PoHeader } from '@/app/(mua-hang)/mua-hang/don/_lib/po-draft'
import {
  lineQty2,
  type Line,
  type Num,
  type PoLineDto,
} from '@/app/(mua-hang)/mua-hang/don/_lib/po-line'
import { NumInput, Pick, TextInput, type IcoName } from '@/components/kit'
import { isoToVn, todayVn } from '@/lib/date-vn'
import type { DocTemplate } from '@/lib/doc-templates'
import { type AdjChange } from '@/lib/po-adjust'
import { type PoField } from '@/lib/po-fields'
import { fmtMoney, roundMoney } from '@/lib/po-line'
import { type PoStatus } from '@/lib/po-status'
import { type PoTemplate } from '@/lib/po-template'
import type { ReceiptBatch } from '@/modules/dept/supply/po-receipts.service'
import type { CommitLogRow, PoIssue } from '@/modules/dept/supply/po-tracking.repo'
import { type CostRow } from './ChiPhiPanel'
import { type PoFinance } from './TaiChinhPanel'
import { type ShipmentLite } from './nhan-hang'

/**
 * MÀN CHỨNG TỪ ĐƠN MUA HỢP NHẤT — xem / sửa / tạo cùng một bố cục.
 *
 * VIẾT LẠI 10/09/2026 theo bảng tiêu chí `docs/tieu-chi-man-chung-tu-erp.md`,
 * sau khi bản đầu bị chấm "chưa đạt ERP". Bản đầu chép xương của màn mẫu — một
 * bản trưng bày — nên đầu đơn nở hết cỡ và lưới dòng bị đẩy xuống dưới nếp gấp.
 * Màn ERP thật (Dynamics *Purchase order details*) làm ngược lại:
 *
 *   · LƯỚI DÒNG LÀ NHÂN VẬT CHÍNH — mở ra là thấy dòng hàng, không phải cuộn;
 *   · đầu đơn co thành MỘT dải nhận diện; trường đầu đơn nằm gấp trong các
 *     NHÓM CÓ TÊN (Chung / Giao hàng / Giá & thuế), mở khi cần;
 *   · CHI TIẾT DÒNG ĐANG CHỌN hiện ngay dưới lưới — cột hiếm dùng sống ở đó,
 *     nhờ vậy lưới gọn và ô đặc thù (khuôn, lọt lòng, đơn vị kép) có chỗ tử tế;
 *   · chứng từ liên quan là NÚT THÔNG MINH có số đếm (Odoo), không phải danh
 *     sách trong cột phải;
 *   · mật độ ERP: hàng 25px, ô 24px, mặc định dày.
 *
 * TIỀN, QUY ĐỔI, KIỂM DÒNG — không tính lại: `lineAmount`, `lineQty2`,
 * `lineProblem`, `draftProblem`, `poTotals`, `buildPoPayload` là đúng các hàm
 * form cũ dùng.
 */

export type PoDoc = {
  id: string
  code: string
  /** Lần gửi duyệt cuối — dải "ai giữ" đếm ngày chờ duyệt từ đây. */
  submitted_at?: string | null
  status: string
  template: PoTemplate
  supplier_id: string
  supplier_name: string
  lsx_code: string | null
  order_code: string | null
  production_order_id: string | null
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
  assigned_to: string | null
  assignee_name: string | null
  /** Người duyệt — hiện ở mốc "Giám đốc duyệt" trên dòng thời gian. */
  approver_name?: string | null
  approved_at: string | null
  ordered_at: string | null
  confirmed_at: string | null
  confirmed_note: string | null
  created_at: string
  updated_at?: string | null
}

export type StatusLineLite = {
  id: string
  material_id: string | null
  qty_received: number
  qty_missing: number
  qty_open: number
  closed_short_at: string | null
}

/** Một lần ĐIỀU CHỈNH đơn đã gửi (0210) — đúng hình `poAdjustmentsRepo.listByPo`. */
export type AdjustmentLite = {
  seq: number
  reason: string
  created_at: string
  created_by_name: string | null
  currency: string
  subtotal_before: number
  subtotal_after: number
  vat_before: number
  vat_after: number
  total_before: number
  total_after: number
  delta_by_price: number
  delta_by_qty: number
  lines: AdjChange[]
  sent_at: string | null
  sent_by_name: string | null
  sent_note: string | null
}

export type Props = {
  mode: 'view' | 'edit' | 'create'
  today: string
  po: PoDoc | null
  /** Dòng đúng hình dạng service trả về — `lineFromPo` cần đủ cột theo mẫu. */
  lines: PoLineDto[]
  statusLines: StatusLineLite[]
  extraLsx: { id: string; code: string }[]
  warehouseDocs: {
    doc_id: string
    code: string
    kind: string
    qty_total: number
    /** Ngày hàng về (ngày chứng từ) — xem `supplyRepo.docsByPo`. */
    at: string
    /** Lúc Kho ghi phiếu vào máy. */
    entered_at: string
  }[]
  stock: Record<string, number>
  position: { index: number; total: number } | null
  /** Mục menu mở sẵn — từ `?muc=` của đường dẫn. Sai / trống = Tổng quan. */
  initialMuc?: string
  /** Số của mục Tài chính (`poFinanceForPo`). null = đọc lỗi; bỏ trống ở màn tạo mới. */
  finance?: PoFinance | null
  /** Người xem nhập được hoá đơn NCC (Kế toán) — nút "Nhập hoá đơn NCC" mở hay khoá mềm. */
  canInvoice?: boolean
  /** Sổ hẹn giao + sổ sự cố (0213). */
  tracking?: { commits: CommitLogRow[]; issues: PoIssue[] }
  /** Đơn bổ sung ↔ đơn gốc (0213). */
  links?: { source: { id: string; code: string } | null; supplements: { id: string; code: string; status: string }[] } // prettier-ignore
  /** Ghi / đóng sự cố giao hàng được (Cung ứng hoặc Kho). */
  canIssue?: boolean
  /** Màn TẠO đơn bổ sung cho phần giao thiếu của đơn này (`?bo-sung=`). */
  sourcePo?: { id: string; code: string } | null
  supplier: {
    name: string
    code: string | null
    tax_no: string | null
    phone: string | null
  } | null
  facts: { orders: number; received: number; onTime: { hit: number; of: number } | null; lastOrderAt: string | null } | null // prettier-ignore
  shipments: ShipmentLite[]
  /** Đã về có chứng từ theo đợt: shipment id → (line id → SL). */
  shipmentReceipts: Record<string, Record<string, number>>
  /** Đợt về theo phiếu nhập — ma trận nhận. */
  receiptBatches: ReceiptBatch[]
  /** `can_order` false = NCC đang khoá đặt hàng — không bày trong ô chọn (trừ NCC đơn đang mang). */
  suppliers: { id: string; name: string; currency: string | null; payment_terms: string | null; lead_time_days: number | null; can_order?: boolean; lock_reason?: string | null; moq?: string | null }[] // prettier-ignore
  lsxs: { id: string; code: string; customer_name: string; order_codes: string[] }[]
  perms: {
    canEdit: boolean
    canApprove: boolean
    isSupply: boolean
    /** Admin / trưởng phòng CƯ / người duyệt — đủ quyền hạ đơn về nháp để sửa. */
    privileged?: boolean
    /** Ghi / huỷ phiếu chi phí mua hàng (0211) — Cung ứng + Kế toán. */
    canRecordCost?: boolean
  }
  me: { id: string; name: string }
  seed?: { supplierId?: string; lsxId?: string }
  /** NHÂN BẢN: đầu đơn của đơn gốc (lines truyền qua `lines`, đã bỏ id). */
  seedHeader?: PoHeader
  /** Mở từ dòng tồn / bảng kê: mã vật tư + SL đề xuất cùng thứ tự — mồi thành dòng. */
  seedCodes?: { codes: string[]; qtys: number[] }
  /** Đầu phiếu + mẫu in cho "Xem trước phiếu" — từ Cài đặt, server nạp. */
  company?: Record<string, string | null>
  tpl?: DocTemplate
  /** Sổ điều chỉnh của đơn (0210) — bản duyệt → phát sinh lần N → hiện hành. */
  adjustments?: AdjustmentLite[]
  /** Mẫu của đơn gần nhất theo NCC — đơn mới chọn NCC thì mẫu tự theo (`templateForSupplier`). */
  lastTemplates?: Record<string, PoTemplate>
  /** Mẫu đơn theo nhóm vật tư (0183) — đơn mới lấy mẫu theo nhóm của dòng đầu. */
  groupTemplates?: Record<string, PoTemplate>
  /** Phiếu chi phí mua hàng gắn đơn này (0211) — gồm cả phiếu đã huỷ. */
  costs?: CostRow[]
  /** Người có thể đã trả phí tại chỗ (chi hộ, 0215) — ô "Người trả" của hộp ghi phí. */
  payers?: { id: string; name: string }[]
}

export const dmy = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

/**
 * Ngày của một MỐC GIỜ (timestamptz) theo lịch VIỆT NAM. `dmy` cắt chuỗi ISO
 * nên đọc ngày UTC: điều chỉnh lúc 2 giờ sáng 26/09 hiện thành 25/09.
 */
export const dmyAt = (ts: string | null | undefined) =>
  ts ? isoToVn(todayVn(new Date(ts))) : ''

/**
 * TIỀN theo đúng loại tiền tệ — VND không lẻ, USD đủ 2 số lẻ.
 *
 * Bản đầu dùng `toLocaleString('vi-VN')` trơn: USD 16.830,9 đọc thành "9 xu"
 * trong khi số thật là 90 xu, và VND thì đẻ ra phần lẻ không tồn tại. Dùng
 * `fmtMoney`/`roundMoney` — đúng hàm phiếu in và Excel xuất ra đang dùng, nên
 * ba nơi không bao giờ lệch nhau một đồng.
 */
export const money = (v: number, cur: string) =>
  `${fmtMoney(roundMoney(v, cur), cur)} ${cur}`

/** Tiền có dấu — phát sinh: "+1.707.632 VND", "−538.100 VND", "0 VND". */
export const signed = (v: number, cur: string) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${money(Math.abs(v), cur)}`

/**
 * ĐỊNH DANH DÒNG trên lưới: mã dòng DB nếu có, không thì mã vật tư. Một đơn có
 * thể có HAI dòng cùng vật tư (đơn nạp từ file chia hai lệnh) — định danh
 * theo material_id thì chọn một dòng là chọn cả hai, bấm xoá là mất cả hai.
 */
export const rowKey = (l: Line) => l.po_line_id ?? l.material_id

export const numStr = (v: Num) => (v === '' ? '' : String(v))

export const fmtNum = (n: number) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

export const toNum = (s: string): Num =>
  s.trim() === '' ? '' : Number(s.replace(',', '.'))

export function daysBetween(a: string, b: string): number {
  const t = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  return Math.round((t(b) - t(a)) / 86_400_000)
}

/**
 * CỘT NÀO Ở LƯỚI, CỘT NÀO XUỐNG CHI TIẾT DÒNG.
 *
 * Lưới chỉ giữ cột người mua ĐỌC-MÀ-QUYẾT khi lướt 40 dòng: chữ ngắn, số, và
 * số tự tính. Ô nhiều phần (lọt lòng D×R×C, đơn vị kép "17.5 Lít"), ô chọn
 * (khuôn, cách mở, cơ sở tính tiền) xuống Chi tiết dòng — ở lưới chúng vừa
 * rộng vừa khó gõ. Tối đa 3 cột mẫu ở lưới; bảng tiêu chí đặt trần 11 cột.
 */
/**
 * NĂM ĐIỀU KHOẢN in nguyên văn lên phiếu gửi NCC — theo đúng thứ tự trên tờ
 * đơn thật. Gợi ý chỗ trống lấy từ câu hay dùng nhất của phòng Cung ứng.
 */
export const TERM_FIELDS = [
  ['quality', 'Chất lượng', 'Hàng mới 100%, đúng quy cách đã duyệt'],
  ['delivery_place', 'Nơi giao', 'Xưởng SX — Cụm CN…'],
  ['lead_time', 'Thời gian giao', '15 ngày kể từ ngày đặt'],
  ['payment', 'Thanh toán', 'Chuyển khoản 30 ngày kể từ ngày nhận đủ'],
  ['invoice', 'Hoá đơn', 'Hoá đơn GTGT giao cùng hàng'],
] as const

/* ══ MENU NỘI DUNG CỦA ĐƠN (27/09/2026) ════════════════════════════════
   Canvas "Đơn mua" — chủ dự án: "tách ra như menu vậy nhưng chỉ hiện thị
   thông tin về tài chính ngay chính trang để không bị rối". Mở sẵn Tổng quan;
   Trao đổi là mục riêng; Tài chính ai mở được đơn cũng xem được. */
export const MUC_IDS = [
  'tong-quan',
  'dong-hang',
  'giao-nhan',
  'tai-chinh',
  'trao-doi',
  'lich-su',
] as const

export type MucId = (typeof MUC_IDS)[number]

/** Neo cũ của từng khối (nút, thông báo vẫn gọi `goTo(neo)`) → mục menu chứa nó. */
export const MUC_OF: Record<string, MucId> = {
  'dau-don': 'tong-quan',
  'dong-hang': 'dong-hang',
  'nhu-cau': 'dong-hang',
  'dot-giao': 'giao-nhan',
  kho: 'giao-nhan',
  'phat-sinh': 'tai-chinh',
  'chi-phi': 'tai-chinh',
  'trao-doi': 'trao-doi',
  'dong-thoi-gian': 'lich-su',
  'tai-lieu': 'lich-su',
}

/** Nhãn trạng thái đợt giao cho dòng thời gian — trước đây in thẳng mã tiếng Anh ("· planned"). */
export const SHIP_STATUS_LABEL: Record<string, string> = {
  planned: 'đã hẹn',
  arrived: 'hàng đã tới',
  received: 'đã nhận',
  cancelled: 'đã thay / huỷ',
}

/** Icon của trạng thái đơn — viên trạng thái trên `DocStatus`. */
export const STATUS_ICON: Record<PoStatus, IcoName> = {
  draft: 'banNhap',
  pending_approval: 'cho',
  approved: 'duyet',
  ordered: 'gui',
  confirmed: 'xong',
  in_transit: 'nhanHang',
  partial: 'nhanHang',
  received: 'nhapKho',
  cancelled: 'huy',
}

/* ── ô theo `kind` của PO_FIELDS — dùng ở cả lưới và chi tiết dòng ───────── */

export function ViewCell({
  f,
  l,
  template,
}: {
  f: PoField
  l: Line
  template: PoTemplate
}) {
  if (f.kind === 'calc') {
    const v = lineQty2(template, l)
    return <span className="num">{v == null ? '—' : v.toLocaleString('vi-VN')}</span>
  }
  if (f.kind === 'inner')
    return (
      <span className="num">
        {[l.inner_l_mm, l.inner_w_mm, l.inner_h_mm]
          .map((x) => (x === '' ? '?' : x))
          .join(' × ')}
      </span>
    )
  if (f.kind === 'unit2')
    return (
      <span className="num">
        {l.unit2_per_unit === '' ? '—' : `${l.unit2_per_unit} ${l.unit2_label}`}
      </span>
    )
  if (f.kind === 'cartonBasis')
    return (
      <>{f.options?.find((o) => o.value === l.carton_basis)?.label ?? l.carton_basis}</>
    )
  const v = f.field ? (l as unknown as Record<string, Num | string>)[f.field] : ''
  if (v === '' || v == null) return <span className="text-[var(--ink-empty)]">—</span>
  return typeof v === 'number' ? (
    <span className="num">{v.toLocaleString('vi-VN')}</span>
  ) : (
    <>{String(v)}</>
  )
}

export function EditCell({
  f,
  l,
  template,
  onField,
  onPatch,
}: {
  f: PoField
  l: Line
  template: PoTemplate
  onField: (v: string) => void
  onPatch: (part: Partial<Line>) => void
}) {
  switch (f.kind) {
    case 'calc': {
      const v = lineQty2(template, l)
      return (
        <span className="num text-[var(--ink-3)]">
          {v == null ? '—' : v.toLocaleString('vi-VN')}
        </span>
      )
    }
    case 'number':
    case 'area':
      return (
        <NumInput
          aria-label={f.label}
          value={numStr((l as unknown as Record<string, Num>)[f.field ?? ''] ?? '')}
          onCommit={onField}
          placeholder={f.placeholder}
        />
      )
    case 'cartonBasis':
      return (
        <Pick
          label={f.label}
          value={l.carton_basis}
          onChange={(v) => onPatch({ carton_basis: v as Line['carton_basis'] })}
          options={f.options ?? []}
        />
      )
    case 'inner':
      return (
        <span className="flex gap-1">
          {(['inner_l_mm', 'inner_w_mm', 'inner_h_mm'] as const).map((k, i) => (
            <NumInput
              key={k}
              aria-label={`${f.label} ${['dài', 'rộng', 'cao'][i]}`}
              placeholder={['D', 'R', 'C'][i]}
              value={numStr(l[k])}
              onCommit={(v) => onPatch({ [k]: toNum(v) } as Partial<Line>)}
            />
          ))}
        </span>
      )
    case 'unit2':
      return (
        <span className="flex gap-1">
          <NumInput
            aria-label={`${f.label} số`}
            placeholder="17.5"
            value={numStr(l.unit2_per_unit)}
            onCommit={(v) => onPatch({ unit2_per_unit: toNum(v) })}
          />
          <TextInput
            label={`${f.label} đơn vị`}
            placeholder="Lít"
            value={l.unit2_label}
            onCommit={(v) => onPatch({ unit2_label: v })}
          />
        </span>
      )
    case 'die':
    case 'openStyle':
    case 'text':
    default:
      return (
        <TextInput
          label={f.label}
          mono={f.kind === 'die'}
          value={String(
            (l as unknown as Record<string, string | Num>)[f.field ?? ''] ?? '',
          )}
          onCommit={onField}
          placeholder={f.placeholder}
        />
      )
  }
}
