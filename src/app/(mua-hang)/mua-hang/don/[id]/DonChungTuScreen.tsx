'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Action,
  ActionGroup,
  ActionPane,
  Affected,
  Checks,
  Consequence,
  CoverageBar,
  Crumb,
  DateInput,
  DocBody,
  DocHead,
  DocScreen,
  FactBox,
  FactKv,
  FactSection,
  FastTab,
  Field,
  FieldGroup,
  Grid,
  Btn,
  GridBody,
  GridBtn,
  GridCheck,
  GridFoot,
  GridHead,
  GridRow,
  GridSep,
  GridToolbar,
  HolderBar,
  LineDetail,
  LineStatus,
  NoticeBar,
  NumInput,
  Pick,
  Sheet,
  SheetActions,
  SmartLinks,
  StatusBar,
  StatusTrack,
  CellHint,
  Td,
  TextArea,
  TextInput,
  Th,
  Tag,
  Tick,
  Timeline,
  poHolder,
  type Mark,
  useToast,
  Combobox,
  Menu,
  type IcoName,
  DocStatus,
  DocMenu,
  DocMenuPanel,
  HeadChips,
  HeadChip,
  MetricStrip,
  Metric,
} from '@/components/kit'
import { DocumentFiles } from '@/components/DocumentFiles'
import { PoNotesPanel } from '@/app/(workspace)/planning/pos/[id]/PoNotesPanel'
import { ApiError, api, apiErrorText } from '@/lib/api'
import { PO_FIELDS, type PoField } from '@/lib/po-fields'
import {
  FREE_LINE_TEMPLATES,
  PO_TEMPLATE_META,
  deriveLine,
  poTemplateMeta,
  suggestOrderQty,
  type PoTemplate,
} from '@/lib/po-template'
import type { PoMaterial } from '@/lib/po-material.types'
import {
  PO_CURRENCIES,
  fmtMoney,
  packCount,
  poLineAmount,
  roundMoney,
  roundUpToPack,
} from '@/lib/po-line'
import type { ShipmentInput } from '@/lib/po-shipments'
import type { ReceiptBatch } from '@/modules/dept/supply/po-receipts.service'
import { PO_NEXT_HINT, PO_STATUS_LABEL, PO_TRACK_STEPS, poTrackStep, receiptTrackTone, type PoStatus } from '@/lib/po-status' // prettier-ignore
import {
  buildPoPayload,
  draftProblem,
  poTotals,
  templateDefaults,
  type PoHeader,
} from '@/app/(workspace)/planning/pos/new/po-draft'
import {
  lineAmount,
  lineFromPo,
  lineProblem,
  lineQty2,
  newFreeLine,
  cartonPriceSuggest,
  newLine,
  refreshLineFromMaterial,
  remapLinesForTemplate,
  type Line,
  type Num,
  type PoLineDto,
} from '@/app/(workspace)/planning/pos/new/po-line'
import { useLocalPref } from '@/lib/use-local-pref'
import { DENSE_KEY } from '../../../_shell/KitFrame'
import { actionsFor, type Action as DocAction } from '../actions'
import {
  headerFromPo,
  lineIssues,
  newHeader,
  poChecks,
  retemplate,
  templateForSupplier,
} from './chung-tu'
import { receiveActions, shipmentEmptyHint, type ShipmentLineRef, type ShipmentLite } from './nhan-hang' // prettier-ignore
import {
  ChiPhiGrid,
  costShareOf,
  GhiPhiSheet,
  HuyPhiSheet,
  type CostRow,
} from './ChiPhiPanel'
import { canCarryCost } from '@/lib/po-cost'
import { barLayout, splitForStatusBar, type BarKey } from './thanh-nut'
import { TaiChinhPanel, type PoFinance } from './TaiChinhPanel'
import { poFinanceView } from '@/lib/po-finance'
import { underDemand } from '@/lib/po-guards'
import { moqHint, priceDrift } from '@/lib/po-tracking'
import { earliestExpectedDate } from '@/lib/po-shipments'
import type { CommitLogRow, PoIssue } from '@/modules/dept/supply/po-tracking.repo'
import { DongSuCoSheet, GhiSuCoSheet, SoHenGiaoGrid, SuCoGrid, XacNhanTheoDongGrid, type TrackLine } from './TheoDoiPanel' // prettier-ignore
import { PoDocuments } from './PoDocuments'
import { ChungTuKhoGrid, DotGiaoGrid, DotSheet, DotSuaSheet, NhanTheoDotGrid, XacNhanSheet } from './NhanHangPanel' // prettier-ignore
import { CapNhatDanhMucSheet, ChiaDotSoanGrid, DanExcelSheet, NhuCauGrid, type PasteConfirm } from './SoanDonPanels' // prettier-ignore
import { clearDraft, columnsToShipments, draftKeyFor, draftSignature, lsxJoinedLabel, pendingNeeds, planColumnsFromShipments, lineDetailSummary, readDraft, splitLineFields, writeDraft, type Need, type PlanColumn, type SavedDraft } from './soan-don' // prettier-ignore
import {
  QuickAddMaterial,
  type CreatedMaterial,
} from '@/app/(workspace)/planning/pos/new/QuickAddMaterial'
import { EditMaterialDialog } from '@/app/(workspace)/planning/pos/new/EditMaterialDialog'
import { fetchMaterialByCode, fetchMaterialsByIds, invalidateMaterialPickCache } from '@/components/supply/MaterialPicker' // prettier-ignore
import { allocationNote } from '@/lib/po-allocation'
import { isoToVn, todayVn } from '@/lib/date-vn'
import { planAdjustment, type AdjBeforeLine, type AdjChange } from '@/lib/po-adjust'
import type { CatalogSuggestion } from '@/lib/po-catalog-backfill'
import { PoPrintSheet } from '@/app/print/supply/PoPrintSheet'
import type { DocTemplate } from '@/lib/doc-templates'
import {
  previewHeaderFromDraft,
  previewLinesFromDraft,
} from '@/app/(workspace)/planning/pos/new/po-preview'

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

type Props = {
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
    at: string
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
  /** Phiếu chi phí mua hàng gắn đơn này (0211) — gồm cả phiếu đã huỷ. */
  costs?: CostRow[]
}

const dmy = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''
/**
 * Ngày của một MỐC GIỜ (timestamptz) theo lịch VIỆT NAM. `dmy` cắt chuỗi ISO
 * nên đọc ngày UTC: điều chỉnh lúc 2 giờ sáng 26/09 hiện thành 25/09.
 */
const dmyAt = (ts: string | null | undefined) =>
  ts ? isoToVn(todayVn(new Date(ts))) : ''
/**
 * TIỀN theo đúng loại tiền tệ — VND không lẻ, USD đủ 2 số lẻ.
 *
 * Bản đầu dùng `toLocaleString('vi-VN')` trơn: USD 16.830,9 đọc thành "9 xu"
 * trong khi số thật là 90 xu, và VND thì đẻ ra phần lẻ không tồn tại. Dùng
 * `fmtMoney`/`roundMoney` — đúng hàm phiếu in và Excel xuất ra đang dùng, nên
 * ba nơi không bao giờ lệch nhau một đồng.
 */
const money = (v: number, cur: string) => `${fmtMoney(roundMoney(v, cur), cur)} ${cur}`
/** Tiền có dấu — phát sinh: "+1.707.632 VND", "−538.100 VND", "0 VND". */
const signed = (v: number, cur: string) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${money(Math.abs(v), cur)}`
/**
 * ĐỊNH DANH DÒNG trên lưới: mã dòng DB nếu có, không thì mã vật tư. Một đơn có
 * thể có HAI dòng cùng vật tư (đơn nạp từ file chia hai lệnh) — định danh
 * theo material_id thì chọn một dòng là chọn cả hai, bấm xoá là mất cả hai.
 */
const rowKey = (l: Line) => l.po_line_id ?? l.material_id
const numStr = (v: Num) => (v === '' ? '' : String(v))
const fmtNum = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
const toNum = (s: string): Num => (s.trim() === '' ? '' : Number(s.replace(',', '.')))
function daysBetween(a: string, b: string): number {
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
const TERM_FIELDS = [
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
const MUC_IDS = [
  'tong-quan',
  'dong-hang',
  'giao-nhan',
  'tai-chinh',
  'trao-doi',
  'lich-su',
] as const
type MucId = (typeof MUC_IDS)[number]
/** Neo cũ của từng khối (nút, thông báo vẫn gọi `goTo(neo)`) → mục menu chứa nó. */
const MUC_OF: Record<string, MucId> = {
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
const SHIP_STATUS_LABEL: Record<string, string> = {
  planned: 'đã hẹn',
  arrived: 'hàng đã tới',
  received: 'đã nhận',
  cancelled: 'đã thay / huỷ',
}
/** Icon của trạng thái đơn — viên trạng thái trên `DocStatus`. */
const STATUS_ICON: Record<PoStatus, IcoName> = {
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

export function DonChungTuScreen(p: Props) {
  const router = useRouter()
  /*
    MỤC ĐANG MỞ của menu đơn (27/09/2026) — ghi vào đường dẫn (?muc=tai-chinh)
    để gửi link là mở đúng mục. Trang server đọc tham số và truyền xuống
    `initialMuc`; đổi mục thì chỉ thay URL tại chỗ (không tải lại trang).
  */
  const [muc, setMuc] = useState<MucId>(() =>
    (MUC_IDS as readonly string[]).includes(p.initialMuc ?? '')
      ? (p.initialMuc as MucId)
      : 'tong-quan',
  )
  function pickMuc(v: string) {
    if (!(MUC_IDS as readonly string[]).includes(v)) return
    setMuc(v as MucId)
    const u = new URL(window.location.href)
    if (v === 'tong-quan') u.searchParams.delete('muc')
    else u.searchParams.set('muc', v)
    window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash)
  }
  const toast = useToast()
  const { po, perms, me, today } = p

  const [editing, setEditing] = useState(p.mode !== 'view')
  /**
   * ĐIỀU CHỈNH ĐƠN ĐÃ GỬI (0210, chốt 25/09/2026) — dùng CHUNG lưới sửa với
   * đơn nháp, khác ở ba chỗ: đầu đơn khoá (NCC, lệnh, mẫu, tiền tệ), dòng giữ
   * mã dòng, và lưu đi `POST …/adjustments` (áp dụng ngay, phần chênh vào sổ
   * phát sinh) thay vì `PATCH` đơn nháp.
   */
  const [adjusting, setAdjusting] = useState(false)
  /** Đang SOẠN đơn nháp / đơn mới — đầu đơn, nhu cầu lệnh, chia đợt, nháp tự lưu chỉ dành cho việc này. */
  const drafting = editing && !adjusting
  /** Bố cục ĐỌC mới (menu) — mọi lúc không sửa dòng. Sửa điều khoản vẫn ở đây (mục Tổng quan). */
  const viewMode = !!po && !editing
  const [adjSheet, setAdjSheet] = useState(false)
  const [adjReason, setAdjReason] = useState('')
  const [sentSheet, setSentSheet] = useState<number | null>(null)
  const [sentNote, setSentNote] = useState('')
  const adjustments = useMemo(() => p.adjustments ?? [], [p.adjustments])
  const costs = useMemo(() => p.costs ?? [], [p.costs])
  const [phiOpen, setPhiOpen] = useState(false)
  const [phiVoid, setPhiVoid] = useState<CostRow | null>(null)
  const [suCoOpen, setSuCoOpen] = useState(false)
  const [suCoClose, setSuCoClose] = useState<PoIssue | null>(null)
  /**
   * SỬA ĐIỀU KHOẢN — chế độ sửa HẸP cho đơn đã duyệt / đã gửi: chỉ chữ in lên
   * phiếu (5 điều khoản + số hợp đồng + người ký + ghi chú), không đụng dòng
   * hàng hay giá. Đi qua `PATCH …/terms`, không phải `PATCH …/pos/:id`.
   *
   * Dùng CHUNG đúng các ô của chế độ sửa đầy đủ chứ không dựng form thứ hai:
   * hai form cùng ghi một bộ cột thì sớm muộn lệch nhau, và màn cũ đã trả giá
   * đúng chỗ đó (`PoDetailScreen` có hộp thoại riêng, nhãn ô khác hẳn lưới).
   */
  const [termsEdit, setTermsEdit] = useState(false)
  const [header, setHeader] = useState<PoHeader>(
    () =>
    po ? headerFromPo(po, p.extraLsx.map((x) => x.id)) : (p.seedHeader ?? newHeader({ supplierId: p.seed?.supplierId, lsxId: p.seed?.lsxId, fromStock: !!p.seedCodes })), // prettier-ignore
  )
  const [lines, setLines] = useState<Line[]>(() =>
    p.lines.map((l) =>
      lineFromPo(l, l.material_id ? (p.stock[l.material_id] ?? null) : null),
    ),
  )
  const [sel, setSel] = useState<string[]>([])
  const [pick, setPick] = useState<number>(0)
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState<null | { action: DocAction }>(null)
  const [xacNhan, setXacNhan] = useState<null | 'confirm' | 'add'>(null)
  const [dot, setDot] = useState<null | { kind: 'reschedule' | 'cancel' | 'edit' | 'split'; s: ShipmentLite }>(null) // prettier-ignore
  /* ── soạn đơn: đợt giao khai lúc soạn, nhu cầu lệnh, dán Excel, danh mục ── */
  const [shipCols, setShipCols] = useState<PlanColumn[]>(
    () =>
    po && p.mode !== 'create' ? planColumnsFromShipments(p.shipments, p.lines.map((l) => l.id)) : [], // prettier-ignore
  )
  const [needs, setNeeds] = useState<Need[]>([])
  const [needsLoading, setNeedsLoading] = useState(false)
  const [paste, setPaste] = useState(false)
  const [quickAdd, setQuickAdd] = useState(false)
  const [editMaterial, setEditMaterial] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [enrich, setEnrich] = useState<{ items: CatalogSuggestion[]; dest: string; poCode: string } | null>(null) // prettier-ignore
  const [enrichBusy, setEnrichBusy] = useState(false)
  const [savedDraft, setSavedDraft] = useState<SavedDraft | null>(null)
  /** Người dùng đã tự chỉnh VAT / tiền tệ — đổi mẫu / đổi NCC không áp đè lại. */
  const dirty = useRef({ vat: !!po || !!p.seedHeader, currency: !!po || !!p.seedHeader, template: !!po || !!p.seedHeader }) // prettier-ignore
  const [askCancel, setAskCancel] = useState(false)
  const [headOpen, setHeadOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [denseRaw, setDenseRaw] = useLocalPref(DENSE_KEY, '0')
  const dense = denseRaw !== '0'

  const template = header.template
  const meta = poTemplateMeta(template)
  /** Mặc định của MẪU đang chọn — để tô ô "còn nguyên mặc định". */
  const tplTerms = templateDefaults(template).terms
  const tplSigner = templateDefaults(template).signerRole
  const allFields = useMemo(
    () => PO_FIELDS[template].filter((f) => !f.editHidden),
    [template],
  )
  const { grid: gridFields, detail: detailFields } = useMemo(() => splitLineFields(allFields), [allFields]) // prettier-ignore
  /*
    KHAY CHI TIẾT DÒNG — MẶC ĐỊNH GẤP.

    Đo 14/09/2026 trên đơn 17 dòng, khung 694px: khay chiếm 459px = 66% màn
    hình cho 4 ô nhập, và vì lúc nào cũng có một dòng đang chọn nên nó KHÔNG
    BAO GIỜ biến mất. Nó nằm dưới lưới, nên phải cuộn qua hết mới tới phần
    còn lại của chứng từ.

    Trạng thái nhớ theo MÁY, không theo dòng: ai hay dùng ô đặc thù thì mở
    một lần rồi thôi, ai không dùng thì không bao giờ phải thấy. Đổi dòng
    KHÔNG đóng lại — đóng/mở theo từng dòng là bắt bấm 17 lần trên đơn này.
  */
  const [detailOpenRaw, setDetailOpenRaw] = useLocalPref('hg.mua-hang.don.chi-tiet-dong', '0') // prettier-ignore
  const detailOpen = detailOpenRaw === '1'
  const setDetailOpen = (v: boolean) => setDetailOpenRaw(v ? '1' : '0')
  const totals = poTotals(header, lines)
  const issues = lineIssues(template, lines, lineProblem)
  /** Ô chữ-trên-phiếu mở ra khi sửa đầy đủ (nháp) HOẶC sửa hẹp (đơn đã gửi). */
  const termsEditing = drafting || termsEdit
  const problem = editing ? draftProblem(header, lines) : null
  /**
   * Ghi chú vượt trần của `poTermsPatchSchema` bao nhiêu ký tự (0 = còn trong
   * mức). Phải đếm ở màn chứ không đợi zod: mỗi lượt từ chối / huỷ / dời hẹn
   * `stampNote` lại xếp thêm một dòng lên đầu, nên đơn sống lâu có thể chạm
   * trần mà người sửa không hề gõ gì vào ô này — bấm Lưu rồi mới ăn 400 thì
   * không ai đoán ra vướng ở đâu.
   */
  const NOTE_MAX = 2000
  const noteOver = Math.max(header.note.trim().length - NOTE_MAX, 0)
  const statusById = useMemo(() => new Map(p.statusLines.map((s) => [s.id, s])), [p.statusLines]) // prettier-ignore
  /** SL từng dòng đã hẹn trong đợt giao CÒN SỐNG — cùng luật hàm DB 0210. */
  const plannedLive = useMemo(() => {
    const m = new Map<string, number>()
    for (const sh of p.shipments) {
      if (sh.status !== 'planned' && sh.status !== 'arrived') continue
      for (const x of sh.lines) m.set(x.po_line_id, (m.get(x.po_line_id) ?? 0) + x.qty)
    }
    return m
  }, [p.shipments])
  const origById = useMemo(() => new Map(p.lines.flatMap((l) => (l.id ? [[l.id, l] as const] : []))), [p.lines]) // prettier-ignore
  /** Vì sao dòng này không bỏ được khỏi đơn đang chạy — null = bỏ được. */
  const lockedLine = (l: Line): string | null => {
    if (!l.po_line_id) return null
    const got = statusById.get(l.po_line_id)?.qty_received ?? 0
    if (got > 1e-9)
      return `đã nhận ${fmtNum(got)} — NCC không giao nữa thì dùng "Chốt thiếu"`
    if ((plannedLive.get(l.po_line_id) ?? 0) > 1e-9)
      return 'đang nằm trong đợt giao — gỡ khỏi đợt ở khối Giao & nhận hàng trước'
    return null
  }
  /*
    CHÊNH LỆCH TÍNH NGAY TRÊN MÀN bằng ĐÚNG hàm server dùng (`planAdjustment`)
    — số người mua thấy trước khi bấm là số sẽ vào sổ phát sinh, không phải
    một phép tính thứ hai. Dòng lấy qua `buildPoPayload` + `deriveLine`, cùng
    đường lưu đi.
  */
  const adjPlan = useMemo(() => {
    if (!adjusting || !po) return null
    const body = buildPoPayload(header, lines)
    const before: AdjBeforeLine[] = p.lines.flatMap((l) =>
      l.id
        ? [{ ...(l as unknown as Record<string, unknown>), id: l.id, material_id: l.material_id, qty_ordered: Number(l.qty_ordered), unit_price: l.unit_price == null ? null : Number(l.unit_price), price_basis: l.price_basis === 'unit2' ? 'unit2' : 'unit', qty2: (l as { qty2?: number | null }).qty2 == null ? null : Number((l as { qty2?: number | null }).qty2), lsx_split: l.lsx_split ?? null, code: l.material_id ? l.material_code : null, name: l.material_name, unit: l.material_unit, received: statusById.get(l.id)?.qty_received ?? 0, planned: plannedLive.get(l.id) ?? 0, invoiced: false }] // prettier-ignore
        : [],
    )
    return planAdjustment({
      currency: po.currency,
      priceIncludesVat: po.price_includes_vat,
      before: {
        lines: before,
        header: { vatRate: po.vat_rate, discount: po.discount_amount },
      },
      after: {
        header: { vatRate: body.vat_rate, discount: body.discount_amount },
        lines: body.lines.map((pl, i) => ({ ...pl, ...deriveLine(template, pl as Parameters<typeof deriveLine>[1]), id: lines[i].po_line_id ?? null, material_id: pl.material_id ?? null, unit_price: pl.unit_price ?? null, code: lines[i].is_free ? null : lines[i].code, name: lines[i].name, unit: lines[i].unit })), // prettier-ignore
      },
    })
  }, [adjusting, po, header, lines, p.lines, statusById, plannedLive, template])
  /** Chênh theo HÀNG trên lưới (dòng sửa + dòng thêm), khoá bằng chỉ số dòng. */
  const adjRow = useMemo(() => new Map((adjPlan?.changes ?? []).filter((c) => c.kind !== 'removed').map((c) => [c.no - 1, c])), [adjPlan]) // prettier-ignore
  const adjErrors = adjPlan ? [...(problem ? [problem] : []), ...adjPlan.errors] : []
  const adjBlocked = adjErrors[0] ?? null
  const nextSeq = (adjustments.at(-1)?.seq ?? 0) + 1
  const unsentAdj = [...adjustments].reverse().find((a) => !a.sent_at) ?? null
  /** Ai nhận thông báo khi áp dụng — cùng luật server: người đã ký duyệt, trừ chính mình. */
  const notifyWho = !po?.approver_name ? 'người có quyền duyệt đơn mua' : po.approver_name === me.name ? null : po.approver_name // prettier-ignore
  const checks = po ? poChecks(po, p.lines, today) : []
  const blockers = checks.filter((c) => c.level === 'stop')
  const cur = lines[Math.min(pick, lines.length - 1)] ?? null
  const curIdx = cur ? lines.indexOf(cur) : -1

  /* ── sửa dòng ─────────────────────────────────────────────────────── */
  const patch = (i: number, part: Partial<Line>) =>
    setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...part } : l)))
  const setField = (i: number, f: PoField, v: string) => {
    if (!f.field) return
    const isNum = f.kind === 'number' || f.kind === 'area'
    patch(i, { [f.field]: isNum ? toNum(v) : v } as Partial<Line>)
  }
  /** Con trỏ vào ô SL đặt của dòng thứ `i` — vòng nhập không rời bàn phím. */
  const focusQty = (i: number) =>
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`#dong-hang tbody tr:nth-child(${i + 1}) input[aria-label="SL đặt"]`)?.focus() // prettier-ignore
    })
  /**
   * THÊM MỘT VẬT TƯ từ ô tìm — đường thêm dòng dùng nhiều nhất.
   *
   * MÃ ĐÃ CÓ TRÊN ĐƠN THÌ NHẢY TỚI DÒNG ĐÓ, không thêm dòng thứ hai. Tới
   * 14/09/2026 hàm này không kiểm gì (bản gộp `addMaterials` thì có), nên gõ
   * lại một mã là đơn có hai dòng cùng mã: React kêu trùng key, và tới lúc bấm
   * Lưu mới ăn 400 "Vật tư bị trùng dòng" từ zod — sau khi đã gõ xong cả đơn.
   * Màn cũ chặn ngay lúc thêm; đây là bước lùi, không phải thiết kế.
   *
   * Nhảy tới dòng cũ chứ không im lặng bỏ qua: bấm mà không thấy gì xảy ra thì
   * người dùng bấm lại lần nữa, rồi đi tìm xem mình gõ sai ở đâu.
   */
  const addMaterial = (m: PoMaterial) => {
    const cu = lines.findIndex((l) => l.material_id === m.id)
    if (cu >= 0) {
      setPick(cu)
      focusQty(cu)
      toast.info(`${m.code} đã có ở dòng ${cu + 1}`, 'Sửa số lượng ngay trên dòng đó.')
      return
    }
    setLines((ls) => [...ls, newLine(template, m)])
    setPick(lines.length)
    focusQty(lines.length)
  }
  /**
   * ENTER ĐI TIẾP như Excel: SL đặt → Đơn giá → ô nhập kế tiếp trên dòng → dòng
   * dưới; hết bảng thì về ô tìm vật tư để thêm dòng kế. Tab vẫn hoạt động như
   * thường; Enter là phản xạ của người quen sổ.
   */
  function gridKeys(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return
    const t = e.target as HTMLElement
    if (!(t instanceof HTMLInputElement) || t.closest('.k-gbar')) return
    e.preventDefault()
    t.blur()
    const all = [...document.querySelectorAll<HTMLInputElement>('#dong-hang tbody input:not([type=checkbox]):not([disabled])')] // prettier-ignore
    const next = all[all.indexOf(t) + 1]
    if (next) return void requestAnimationFrame(() => next.focus())
    requestAnimationFrame(() =>
      document.querySelector<HTMLInputElement>('#dong-hang .k-gbar input')?.focus(),
    )
  }
  const addFree = () => {
    setLines((ls) => [...ls, newFreeLine()])
    setPick(lines.length)
  }
  const removeSel = () => {
    const stuck = adjusting
      ? lines.filter((l) => sel.includes(rowKey(l)) && lockedLine(l))
      : []
    if (stuck.length > 0) {
      toast.warning(
        `Không bỏ được ${stuck.length} dòng`,
        `${stuck[0].code || stuck[0].name}: ${lockedLine(stuck[0])}`,
      )
      return
    }
    setLines((ls) => ls.filter((l) => !sel.includes(rowKey(l))))
    setSel([])
    setPick(0)
  }
  const changeTemplate = (t: PoTemplate) => {
    setLines((ls) => remapLinesForTemplate(template, t, ls))
    // VAT chỉ áp mặc định của mẫu khi người dùng CHƯA tự chỉnh — phòng CƯ
    // phản hồi "nhiều NCC để 10%" mà đổi mẫu là bị áp lại 8%.
    setHeader((h) => {
      const r = retemplate(h, t)
      return dirty.current.vat ? { ...r, vat: h.vat, inclVat: h.inclVat } : r
    })
  }

  /* ── lưu / huỷ ─────────────────────────────────────────────────────── */
  async function save() {
    if (problem) {
      toast.warning('Chưa lưu được', problem)
      return
    }
    setBusy(true)
    try {
      const body = {
        ...buildPoPayload(header, lines, columnsToShipments(shipCols)),
        // Đơn bổ sung trỏ về đơn gốc (0213) — chỉ có nghĩa lúc TẠO.
        ...(p.sourcePo && (p.mode === 'create' || !po)
          ? { source_po_id: p.sourcePo.id }
          : {}),
      }
      const isNew = p.mode === 'create' || !po
      const r =
        await api<{ po: { id: string; code: string }; catalog_suggestions?: CatalogSuggestion[] }> // prettier-ignore
        (isNew ? '/api/dept/supply/pos' : `/api/dept/supply/pos/${po.id}`, {
          method: isNew ? 'POST' : 'PATCH',
          body,
        })
      clearDraft(draftKey)
      toast.success(isNew ? `Đã tạo ${r.po.code}` : `Đã lưu ${r.po.code}`, isNew ? 'Kiểm tra lại rồi bấm "Gửi Giám đốc duyệt"' : undefined) // prettier-ignore
      const dest = `/mua-hang/don/${r.po.id}`
      if (!isNew) setEditing(false)
      // Có thông số gõ trên dòng mà danh mục đang trống → hỏi trước khi rời.
      if (r.catalog_suggestions && r.catalog_suggestions.length > 0) {
        setEnrich({ items: r.catalog_suggestions, dest, poCode: r.po.code })
        return
      }
      router.replace(dest)
      router.refresh()
    } catch (e) {
      toast.error('Không lưu được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }
  /**
   * Lưu CHỈ phần chữ trên phiếu — `PATCH …/terms`, service mở cho mọi trạng
   * thái trừ đã huỷ. Không gửi dòng hàng, không gửi giá: chữ ký duyệt còn
   * nguyên giá trị.
   */
  async function saveTerms() {
    if (!po) return
    if (noteOver > 0) {
      toast.warning('Chưa lưu được', `Ghi chú dài hơn mức cho phép ${noteOver} ký tự`)
      return
    }
    setBusy(true)
    try {
      const t = (v: string) => v.trim() || null
      await api(`/api/dept/supply/pos/${po.id}/terms`, {
        method: 'PATCH',
        body: {
          contract_no: t(header.contractNo),
          terms_quality: t(header.terms.quality),
          terms_delivery_place: t(header.terms.delivery_place),
          terms_payment: t(header.terms.payment),
          terms_invoice: t(header.terms.invoice),
          terms_lead_time: t(header.terms.lead_time),
          signer_role: t(header.signerRole),
          note: t(header.note),
        },
      })
      toast.success('Đã lưu điều khoản', 'Phiếu in và hồ sơ dùng bản vừa sửa')
      setTermsEdit(false)
      router.refresh()
    } catch (e) {
      toast.error('Không lưu được điều khoản', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }
  /** Vào chế độ điều chỉnh đơn đang chạy — cùng lưới, lưu đi đường khác. */
  function startAdjust() {
    setAdjReason('')
    setAdjusting(true)
    setEditing(true)
  }
  async function applyAdjust() {
    if (!po || !adjPlan) return
    setBusy(true)
    try {
      const body = buildPoPayload(header, lines)
      const r = await api<{ seq: number; delta_total: number }>(
        `/api/dept/supply/pos/${po.id}/adjustments`,
        {
          method: 'POST',
          body: {
            base_seq: adjustments.at(-1)?.seq ?? 0,
            reason: adjReason.trim(),
            vat_rate: body.vat_rate,
            discount_amount: body.discount_amount,
            lines: body.lines.map((l, i) => ({ ...l, id: lines[i].po_line_id ?? null })),
          },
        },
      )
      toast.success(
        `Đã áp dụng điều chỉnh lần ${r.seq} · ${po.code}`,
        `Phát sinh ${signed(r.delta_total, po.currency)} — in phiếu gửi lại NCC rồi ghi đã gửi`,
      )
      setAdjSheet(false)
      setAdjusting(false)
      setEditing(false)
      router.refresh()
    } catch (e) {
      const stale = e instanceof ApiError && e.status === 409
      toast.error(
        stale ? 'Đơn vừa được điều chỉnh' : 'Chưa áp dụng được',
        apiErrorText(e),
      )
      if (stale) router.refresh()
    } finally {
      setBusy(false)
    }
  }
  async function markSent() {
    if (!po || sentSheet == null) return
    const ok = await call(
      `/api/dept/supply/pos/${po.id}/adjustments/sent`,
      'POST',
      { seq: sentSheet, note: sentNote.trim() || null },
      `Đã ghi gửi NCC bản điều chỉnh lần ${sentSheet}`,
    )
    if (ok) setSentSheet(null)
  }

  /** Bỏ sửa điều khoản: trả mọi ô về đúng bản đang lưu. */
  function cancelTermsEdit() {
    setTermsEdit(false)
    if (po) setHeader(headerFromPo(po, p.extraLsx.map((x) => x.id))) // prettier-ignore
  }

  /** Đã khác bản gốc chưa — để Huỷ hỏi lại, và để chặn rời trang mất dữ liệu. */
  const isDirty = () => adjusting ? !!adjPlan && (adjPlan.changes.length > 0 || !!adjPlan.headerChanges) : baseline.current != null && draftSignature({ header, lines, shipCols }) !== baseline.current // prettier-ignore
  function askCancelEdit() {
    if (isDirty()) setAskCancel(true)
    else cancelEdit()
  }
  function cancelEdit() {
    setAskCancel(false)
    clearDraft(draftKey)
    if (p.mode === 'create' || !po) {
      router.push('/mua-hang/don')
      return
    }
    setHeader(
      headerFromPo(
        po,
        p.extraLsx.map((x) => x.id),
      ),
    )
    setLines(
      p.lines.map((l) =>
        lineFromPo(l, l.material_id ? (p.stock[l.material_id] ?? null) : null),
      ),
    )
    setSel([])
    setEditing(false)
    setAdjusting(false)
  }

  /* ── hành động theo bước (chế độ xem) ──────────────────────────────── */
  /*
    `hasReceipts` chặn đường hạ-về-nháp NGAY TRÊN NÚT thay vì để người dùng bấm
    rồi ăn lỗi từ server: có phiếu kho, hoặc đã nhận dù chỉ một phần, là sửa
    dòng sẽ làm phiếu nhập mồ côi. Server vẫn kiểm lại — đây chỉ là nói trước.
  */
  const hasReceipts =
    p.warehouseDocs.length > 0 ||
    p.statusLines.some((l) => Number(l.qty_received ?? 0) > 1e-6)
  const docActions = po ? actionsFor(po.status as PoStatus, { own: perms.canEdit, approve: perms.canApprove, privileged: perms.privileged, hasReceipts, noEta: !po.expected_at }) : [] // prettier-ignore
  async function runAction(a: DocAction) {
    if (!po || !a.build) return
    setBusy(true)
    try {
      for (const c of a.build({ id: po.id, reason: reason.trim(), date }))
        await api(c.path, { method: c.method, body: c.body })
      toast.success(`${a.done} ${po.code}`)
      if (a.id === 'delete') router.push('/mua-hang/don')
      else router.refresh()
    } catch (e) {
      toast.error(`Không làm được: ${a.label}`, apiErrorText(e))
    } finally {
      setBusy(false)
      setSheet(null)
      setReason('')
      setDate('')
    }
  }
  function start(a: DocAction) {
    if (a.blocked || !po) return
    if (a.id === 'edit') return setEditing(true)
    if (a.id === 'adjust') return startAdjust()
    // Bật chế độ sửa hẹp tại chỗ — không rời trang, không gọi route nào ngay.
    if (a.id === 'edit_terms') {
      // Bố cục đọc: khối Đầu đơn nằm GẤP ở mục Tổng quan — mở mục, mở khối, cuộn tới;
      // không thì nút Lưu / Huỷ hiện mà không thấy ô nào để sửa.
      setTermsEdit(true)
      setHeadOpen(true)
      goTo('dau-don')
      return
    }
    if (a.id === 'open') return
    if (a.ui === 'link' && a.href) return router.push(a.href(po.id))
    if (a.ui === 'direct') return void runAction(a)
    setReason('')
    setDate('')
    setSheet({ action: a })
  }
  const sheetInvalid =
    sheet != null &&
    ((sheet.action.needReason && reason.trim().length < (sheet.action.minReason ?? 1)) ||
      (sheet.action.needDate && !date))

  /* ── dữ kiện đầu trang ─────────────────────────────────────────────── */
  const holder = po ? poHolder(po, me.id) : null
  const track = poTrackStep((po?.status ?? 'draft') as PoStatus)
  const recvIdx = po?.status === 'received' ? 2 : po?.status === 'partial' ? 1 : 0
  /*
    ĐỘ PHỦ VỀ KHO — chỉ tính DÒNG VẬT TƯ KHO, cùng luật với `refreshStatusFromReceipts`.
    Dòng tự gõ (gỗ, gia công) nghiệm thu ngoài sổ nên không bao giờ có phiếu
    nhập; đếm cả chúng thì đơn hỗn hợp không bao giờ đạt 100%.
  */
  const veKho = (() => {
    const DA_GUI = ['ordered', 'confirmed', 'in_transit', 'partial', 'received']
    if (!po || !DA_GUI.includes(po.status)) return null
    const kho = p.statusLines.filter((l) => l.material_id != null)
    if (kho.length === 0) return null
    const du = kho.filter((l) => Number(l.qty_open ?? 0) <= 1e-6).length
    return { du, tong: kho.length, ratio: du / kho.length }
  })()
  const lsx = p.lsxs.find((l) => l.id === header.lsxId)
  const supplierOpt = p.suppliers.find((s) => s.id === header.supplierId)
  // MOQ của NCC (chữ tự do) — chỉ nhắc khi đọc chắc được số + đơn vị trùng ĐVT dòng.
  const moqWarn = moqHint(supplierOpt?.moq, lines.map((l) => ({ unit: l.unit, qty: l.qty === '' ? 0 : Number(l.qty) }))) // prettier-ignore

  /*
    Hai danh sách này đi vào ô chọn CÓ TÌM (`Combobox`), nên tên khách và mã
    đơn hàng phải nằm ở `hint` chứ không nối hết vào `label`: `hint` cũng được
    lọc, mà dòng trên vẫn ngắn để đọc lướt. Trước đây mọi thứ nối bằng dấu "·"
    thành một dòng dài, cuộn trong `<select>` 168 dòng.
  */
  const lsxOptions = useMemo(
    () =>
      p.lsxs.map((l) => ({
        value: l.id,
        label: l.code,
        hint: [l.customer_name, l.order_codes?.join(', ')].filter(Boolean).join(' · '),
      })),
    [p.lsxs],
  )
  /*
    NCC KHOÁ ĐẶT HÀNG không bày trong ô chọn (P1, 27/09/2026) — trước đó cờ
    `can_order` chỉ là một thẻ đỏ ở danh sách NCC, chọn và đặt vẫn được. NCC
    đơn ĐANG mang thì vẫn giữ (ghi rõ đang khoá) để không làm trống ô.
  */
  const supplierOptions = useMemo(
    () =>
      p.suppliers
        .filter((s) => s.can_order !== false || s.id === header.supplierId)
        .map((s) => ({ value: s.id, label: s.can_order === false ? `${s.name} · đang khoá đặt hàng` : s.name })), // prettier-ignore
    [p.suppliers, header.supplierId],
  )
  const marks: Mark[] = po
    ? [
        { key: 'tao', at: po.created_at, label: 'Tạo đơn', actor: po.assignee_name },
        { key: 'duyet', at: po.approved_at, label: 'Giám đốc duyệt', actor: po.approver_name ?? undefined, tone: po.approved_at ? 'done' : undefined }, // prettier-ignore
        { key: 'gui', at: po.ordered_at, label: 'Gửi nhà cung cấp' },
        { key: 'xn', at: po.confirmed_at, label: 'NCC nhận' },
        ...p.shipments.map((s, i) => ({ key: `dot${i}`, at: s.expected_date, label: `${s.code ?? `Đợt giao ${i + 1}`} · ${SHIP_STATUS_LABEL[s.status] ?? s.status}` })), // prettier-ignore
        ...p.warehouseDocs.map((d) => ({ key: d.doc_id, at: d.at, label: `${d.kind === 'receipt' ? 'Phiếu nhập' : 'Trả NCC'} ${d.code}`, detail: `${d.qty_total.toLocaleString('vi-VN')} đơn vị`, tone: 'done' as const })), // prettier-ignore
        ...adjustments.map((a) => ({ key: `dc${a.seq}`, at: a.created_at, label: `Điều chỉnh lần ${a.seq} · phát sinh ${signed(a.total_after - a.total_before, a.currency)}`, actor: a.created_by_name ?? undefined, detail: a.reason })), // prettier-ignore
        ...costs.map((c) => ({ key: `phi${c.id}`, at: c.cost_date, label: `Ghi phí ${c.kind === 'boc_xep' ? 'bốc xếp' : c.kind === 'khac' ? 'khác' : 'vận chuyển'}${c.doc_no ? ` ${c.doc_no}` : ''} · ${money(c.amount, c.currency)}${c.voided_at ? ' · đã huỷ' : ''}`, actor: c.created_by_name ?? undefined, detail: c.payee_name ?? undefined })), // prettier-ignore
        ...adjustments.flatMap((a) => (a.sent_at ? [{ key: `dcg${a.seq}`, at: a.sent_at, label: `Gửi NCC bản điều chỉnh lần ${a.seq}`, actor: a.sent_by_name ?? undefined, detail: a.sent_note ?? undefined }] : [])), // prettier-ignore
      ]
    : []
  /*
    GHI PHÍ VẬN CHUYỂN (0211) — mở ở đơn đã duyệt trở đi, kể cả đơn đã về đủ
    (hoá đơn nhà xe hay tới sau khi hàng đã nhập kho). Câu lý do dùng CHUNG với
    lỗi server (`canCarryCost`) — một nguồn.
  */
  const costWhy = !po
    ? 'Lưu đơn trước'
    : !p.perms.canRecordCost
      ? 'Chỉ Cung ứng hoặc Kế toán ghi được phí mua hàng'
      : ((g) => (g.ok ? undefined : g.reason))(canCarryCost(po.status))
  const costShare = po ? costShareOf(costs, po.id) : 0
  /* ── thanh hành động một hàng: khoá → nhãn, icon, việc, lý do khoá ─────── */
  const bar = po
    ? barLayout(
        po.status,
        docActions.map((a) => a.id),
      )
    : null
  const DOC_ICON: Record<string, IcoName> = {
    submit: 'gui',
    approve: 'duyet',
    send: 'gui',
    withdraw: 'traLai',
    reject: 'traLai',
    nudge: 'ghiChu',
    reschedule: 'lich',
    edit_terms: 'sua',
    reopen: 'mo',
    reassign: 'gui',
    duplicate: 'saoChep',
    cancel: 'huy',
    delete: 'xoa',
  }
  type BarItem = { label: string; icon?: IcoName; run: () => void; blocked?: string; danger?: boolean } // prettier-ignore
  function barItem(k: BarKey): BarItem | null {
    if (!po) return null
    if (k.startsWith('doc:')) {
      const a = docActions.find((x) => x.id === k.slice(4))
      if (!a) return null
      const loi = a.id === 'submit' && blockers.length > 0 ? `Còn ${blockers.length} lỗi chặn — xem danh sách kiểm dưới đầu đơn` : undefined // prettier-ignore
      return { label: a.label, icon: DOC_ICON[a.id], run: () => start(a), blocked: a.blocked ?? loi, danger: a.id === 'cancel' || a.id === 'delete' } // prettier-ignore
    }
    const lyDo = (x: { ok: boolean; why?: string }) => (x.ok ? undefined : x.why)
    const poId = po.id
    switch (k) {
      case 'edit':
        return editAct ? { label: editLabel, icon: 'sua', run: () => start(editAct), blocked: editAct.blocked } : null // prettier-ignore
      case 'confirm':
        return { label: 'NCC xác nhận', icon: 'xong', run: () => (shipLines.length > 0 ? setXacNhan('confirm') : start(CONFIRM_PLAIN)), blocked: lyDo(recv.confirm) } // prettier-ignore
      case 'addShipment':
        return { label: 'Thêm đợt giao', icon: 'them', run: () => setXacNhan('add'), blocked: lyDo(recv.addShipment) } // prettier-ignore
      case 'transit':
        return { label: 'Hàng đang trên đường', icon: 'nhanHang', run: () => start(TRANSIT), blocked: lyDo(recv.transit) } // prettier-ignore
      case 'receive':
        return { label: 'Ghi nhận nhận hàng · Kho', icon: 'ghiSo', run: () => router.push(`/warehouse/nhap/${poId}`), blocked: lyDo(recv.receive) } // prettier-ignore
      case 'closeShort':
        return { label: 'Chốt phần thiếu', run: () => start(CLOSE_SHORT), blocked: lyDo(recv.closeShort) } // prettier-ignore
      case 'acceptByHand':
        return { label: 'Nghiệm thu ngoài sổ', run: () => start(ACCEPT), blocked: lyDo(recv.acceptByHand) } // prettier-ignore
      case 'cost':
        return { label: 'Ghi phí vận chuyển', icon: 'tien', run: () => setPhiOpen(true), blocked: costWhy } // prettier-ignore
      case 'print':
        return { label: 'Phiếu đặt hàng', icon: 'in', run: () => window.open(`/print/supply/${poId}`, '_blank') } // prettier-ignore
      case 'excel':
        return { label: 'Xuất Excel', icon: 'excel', run: () => window.open(`/api/dept/supply/pos/${poId}/export`, '_blank') } // prettier-ignore
      case 'new':
        return {
          label: 'Tạo đơn mới',
          icon: 'them',
          run: () => router.push('/mua-hang/don/moi'),
        }
      case 'dense':
        return { label: dense ? 'Lưới thưa' : 'Lưới dày', run: () => setDenseRaw(dense ? '0' : '1') } // prettier-ignore
      default:
        return null
    }
  }
  const code = po?.code ?? 'Đơn mới'
  const primary = docActions.find((a) => a.primary && a.id !== 'open')
  const secondary = docActions.filter(
    (a) => !a.primary && a.id !== 'open' && a.id !== 'edit' && a.id !== 'adjust',
  )
  // Đơn đã gửi: ô "Sửa" thành "Điều chỉnh" — cùng chỗ, người dùng không phải đi tìm.
  const editAct = docActions.find((a) => a.id === 'edit' || a.id === 'adjust')
  const editLabel = editAct?.id === 'adjust' ? 'Điều chỉnh' : 'Sửa'
  /* ── giao & nhận hàng ─────────────────────────────────────────────── */
  // Dòng chia đợt được = dòng gắn vật tư kho, đã có id. Tiền dòng tính đúng
  // hàm form dùng (giá theo đơn vị 2 thì qty2 của dòng form).
  const shipLines: ShipmentLineRef[] = p.lines.flatMap((l, i) =>
    l.id && l.material_id
      ? [{ id: l.id, name: l.material_name, unit: l.material_unit, qty_ordered: l.qty_ordered, amount: l.unit_price != null ? poLineAmount({ qty_ordered: l.qty_ordered, unit_price: l.unit_price, price_basis: l.price_basis, qty2: lines[i] ? lineQty2(template, lines[i]) : null }) : null, price_approx: l.price_basis === 'unit2' }] // prettier-ignore
      : [],
  )
  const shipLinesById = new Map(shipLines.map((l) => [l.id, l]))
  const shippedByLine = new Map<string, number>()
  for (const s of p.shipments) {
    if (s.status === 'cancelled') continue
    for (const l of s.lines) shippedByLine.set(l.po_line_id, (shippedByLine.get(l.po_line_id) ?? 0) + l.qty) // prettier-ignore
  }
  const liveShipments = p.shipments.filter((s) => s.status !== 'cancelled')
  const shipmentsDone = liveShipments.filter((s) => s.status === 'received').length
  const openStockLines = p.statusLines.filter((s) => s.material_id != null && s.qty_open > 0 && !s.closed_short_at) // prettier-ignore
  const recv = receiveActions({ status: po?.status ?? 'draft', canEdit: perms.canEdit, hasStockLines: shipLines.length > 0, openStockLines: openStockLines.length }) // prettier-ignore

  const sentToSupplier = ['ordered', 'confirmed', 'in_transit', 'partial', 'received'].includes(po?.status ?? '') // prettier-ignore

  async function call(
    path: string,
    method: 'POST' | 'PATCH',
    body: unknown,
    done: string,
  ) {
    setBusy(true)
    try {
      await api(path, { method, body })
      toast.success(done, po?.code)
      router.refresh()
      return true
    } catch (e) {
      toast.error('Không làm được', apiErrorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }
  const submitShipments = (ships: ShipmentInput[], note: string) =>
    !po
      ? Promise.resolve(false)
      : xacNhan === 'add'
        ? call(`/api/dept/supply/pos/${po.id}/shipments`, 'POST', { shipments: ships }, 'Đã thêm đợt giao')
        : call(`/api/dept/supply/pos/${po.id}/confirm`, 'POST', { confirmed_note: note || null, shipments: ships }, `Đã ghi nhận NCC xác nhận · ${ships.length} đợt`) // prettier-ignore
  const shipmentAct = (
    id: string,
    input: {
      action: 'reschedule' | 'arrived' | 'cancel' | 'edit' | 'split'
      expected_date?: string
      reason?: string
      lines?: { po_line_id: string; qty: number }[]
    },
    done: string,
  ) =>
    // prettier-ignore
    call(`/api/dept/supply/shipments/${id}`, 'PATCH', input, done)

  // Hành động của tab Nhận hàng đi qua cùng cửa `start()`/`runAction()` với
  // luồng duyệt: một hộp thoại, một cách báo lỗi, một chỗ refresh.
  const ADV = (to: string) => ({ path: `/api/dept/supply/pos/${po?.id}/advance`, method: 'POST' as const, body: { to } }) // prettier-ignore
  const CONFIRM_PLAIN: DocAction = { id: 'confirm', label: 'NCC xác nhận', ui: 'sheet', stakes: 'vua', consequence: `Ghi nhận ${po?.supplier_name ?? 'NCC'} đã nhận đơn. Đơn toàn dòng tự gõ nên không có đợt giao để khai.`, done: 'Đã ghi nhận NCC xác nhận', build: () => [ADV('confirmed')] } // prettier-ignore
  const TRANSIT: DocAction = { id: 'transit', label: 'Hàng đang trên đường', ui: 'sheet', stakes: 'vua', consequence: 'NCC báo đã xuất hàng. Đơn chuyển sang "Đang giao" để Kho biết mà chờ nhận — hẹn giao và số lượng không đổi.', done: 'Đã chuyển sang đang giao', build: () => [ADV('in_transit')] } // prettier-ignore
  const ACCEPT: DocAction = { id: 'accept', label: 'Nghiệm thu ngoài sổ', ui: 'sheet', stakes: 'nang', consequence: 'Đóng đơn KHÔNG qua phiếu kho — chỉ cho đơn toàn dòng tự gõ (gỗ, gia công) nghiệm thu ngoài sổ kho. Đơn sang "Đã nhận đủ".', done: 'Đã nghiệm thu', build: () => [ADV('received')] } // prettier-ignore
  /**
   * CHỐT PHẦN THIẾU — cả đơn (`target` trống) hoặc ĐÚNG MỘT DÒNG.
   *
   * Route nhận `line_id` từ 0154 nhưng màn này vẫn gửi `null`, nên người mua
   * chỉ có lựa chọn "được ăn cả": đơn 12 mã mà NCC hết đúng 1 mã thì chốt cả
   * đơn là nói dối sổ — 11 mã kia vẫn đang chờ về thật.
   */
  const closeShortAct = (target?: { id: string; label: string; missing: number; unit: string }): DocAction => ({ id: 'close_short', label: target ? `Chốt thiếu · ${target.label}` : 'Chốt phần thiếu', ui: 'sheet', stakes: 'nang', needReason: true, reasonLabel: 'Vì sao NCC không giao nữa', reasonHint: 'Ghi vào vết của đơn. Phần thiếu không còn tính là "đang đặt" — Kho và kế hoạch thấy ngay.', consequence: target ? `Chốt ${fmtNum(target.missing)} ${target.unit} còn thiếu của dòng này. Các dòng khác của đơn không đổi. NCC đổi ý giao bù thì mở lại được.` : `${openStockLines.length} dòng còn thiếu sẽ chốt. NCC đổi ý giao bù thì mở lại được từng dòng.`, confirmLabel: 'Chốt phần thiếu', done: target ? 'Đã chốt thiếu dòng này' : 'Đã chốt phần thiếu', build: ({ id, reason }) => [{ path: `/api/dept/supply/pos/${id}/close-short`, method: 'POST', body: { action: 'close', line_id: target?.id ?? null, reason } }] }) // prettier-ignore
  /**
   * MỞ LẠI một dòng đã chốt — NCC đổi ý giao bù. Không bắt lý do: mở lại là
   * quay về hiện trạng THẬT, không phải một quyết định cần biện minh.
   */
  const reopenAct = (target: { id: string; label: string }): DocAction => ({ id: 'close_short', label: `Mở lại · ${target.label}`, ui: 'sheet', stakes: 'vua', consequence: 'Dòng này chờ về trở lại: phần thiếu tính lại là "đang đặt", đơn đã "về đủ" sẽ quay về "về một phần". Chốt lại lúc nào cũng được.', confirmLabel: 'Mở lại dòng', done: 'Đã mở lại dòng', build: ({ id }) => [{ path: `/api/dept/supply/pos/${id}/close-short`, method: 'POST', body: { action: 'reopen', line_id: target.id } }] }) // prettier-ignore
  const CLOSE_SHORT = closeShortAct()

  /* ── soạn đơn: nhu cầu lệnh · dán Excel · vật tư mới · danh mục · nháp ── */
  const usedIds = useMemo(() => new Set(lines.map((l) => l.material_id)), [lines])
  const pending = pendingNeeds(needs, lines)
  /** Đề xuất mua theo mã, từ nhu cầu của lệnh — nuôi nút "dùng N ↩" trên ô SL. */
  const suggestByMat = useMemo(() => new Map(needs.map((n) => [n.material_id, n.suggest])), [needs]) // prettier-ignore
  /**
   * Trần tồn còn đặt thêm được = max_stock − tồn − đã đặt. Chỉ NHẮC, không
   * chặn: có lệnh lớn thì vượt trần là chủ đích, người mua tự cân.
   */
  const capLeft = useMemo(
    () => new Map(needs.filter((n) => n.max_stock != null && n.max_stock > 0).map((n) => [n.material_id, Math.max((n.max_stock ?? 0) - (n.on_hand ?? 0) - (n.ordered ?? 0), 0)])), // prettier-ignore
    [needs],
  )
  const lsxsOfPo = useMemo(
    () => (header.poType === 'lsx' ? [header.lsxId, ...header.extraLsxIds].filter(Boolean).flatMap((id) => { const l = p.lsxs.find((x) => x.id === id); return l ? [{ id: l.id, code: l.code }] : [] }) : []), // prettier-ignore
    [header.poType, header.lsxId, header.extraLsxIds, p.lsxs],
  )
  const lsxLabel = header.poType === 'lsx' ? lsxJoinedLabel(header.lsxId, header.extraLsxIds, p.lsxs) : null // prettier-ignore

  // Nhu cầu của CẢ BỘ lệnh (chính + phụ), gộp ở server — cộng từng lệnh ở
  // client sẽ trừ tồn hai lần. Chỉ nạp khi đang soạn.
  useEffect(() => {
    if (!drafting || header.poType !== 'lsx' || !header.lsxId) {
      const t = setTimeout(() => setNeeds([]), 0)
      return () => clearTimeout(t)
    }
    let gone = false
    const t = setTimeout(() => setNeedsLoading(true), 0)
    const qs =
      header.extraLsxIds.length > 0
        ? `&extra_lsx_ids=${header.extraLsxIds.join(',')}`
        : ''
    api<{ needs: Need[] }>(
      `/api/dept/supply/needs?production_order_id=${header.lsxId}${qs}`,
    )
      .then((d) => !gone && setNeeds(d.needs))
      .catch(
        (e) => !gone && toast.error('Không tải được nhu cầu của lệnh', apiErrorText(e)),
      )
      .finally(() => !gone && setNeedsLoading(false))
    return () => {
      gone = true
      clearTimeout(t)
    }
    // toast ổn định theo provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafting, header.poType, header.lsxId, header.extraLsxIds])

  /** Thêm nhiều vật tư một lượt, kèm SL/giá/ghi chú (dán Excel, mồi từ URL). */
  function addMaterials(
    list: PoMaterial[],
    extras?: Map<
      string,
      { qty?: number | null; price?: number | null; note?: string | null }
    >,
  ) {
    // prettier-ignore
    const seen = new Set<string>()
    const add = list.filter(
      (m) => !usedIds.has(m.id) && !seen.has(m.id) && (seen.add(m.id), true),
    )
    if (add.length === 0) return
    setPick(lines.length)
    setLines((ls) => [
      ...ls,
      ...add.map((m) => {
        const l = newLine(template, m)
        const e = extras?.get(m.id)
        return e ? { ...l, qty: (e.qty ?? l.qty) as Line['qty'], price: (e.price ?? l.price) as Line['price'], note: e.note ?? l.note } : l // prettier-ignore
      }),
    ])
  }
  function addFromPaste(picked: PasteConfirm) {
    addMaterials(picked.matched.map((x) => x.material), new Map(picked.matched.map((x) => [x.material.id, { qty: x.qty, price: x.price, note: x.note }]))) // prettier-ignore
    if (picked.free.length > 0) {
      setLines((ls) => [...ls, ...picked.free.map((f) => ({ ...newFreeLine(), name: f.name, qty: (f.qty ?? '') as Line['qty'], price: (f.price ?? '') as Line['price'], note: f.note ?? '' }))]) // prettier-ignore
    }
    const dup = picked.matched.filter((x) => usedIds.has(x.material.id)).length
    const n = picked.matched.length - dup + picked.free.length
    if (n > 0)
      toast.success(
        `Đã thêm ${n} dòng từ vùng dán`,
        dup > 0 ? `${dup} mã đã có trên đơn, không thêm lại` : undefined,
      )
    else if (dup > 0)
      toast.warning('Không thêm dòng nào', `${dup} mã trong vùng dán đã có trên đơn`)
  }
  /** Từ nhu cầu lệnh: nạp hồ sơ vật tư (kg/m, dài cây…) rồi mới thành dòng — thiếu thì dòng nhôm không tính được tiền. */
  async function addFromNeeds(list: Need[]) {
    const ids = list.map((n) => n.material_id).filter((id) => !usedIds.has(id))
    if (ids.length === 0) return
    try {
      const mats = await fetchMaterialsByIds(ids)
      const byId = new Map(mats.map((m) => [m.id, m]))
      setLines((ls) => {
        const have = new Set(ls.map((l) => l.material_id))
        const add: Line[] = []
        for (const n of list) {
          const m = byId.get(n.material_id)
          if (!m || have.has(n.material_id)) continue
          // SL đặt để trống cho người mua quyết; nhu cầu và phân bổ theo SP đổ sẵn.
          add.push({ ...newLine(template, m), qty_demand: n.qty_needed, note: allocationNote(n.breakdown ?? []).slice(0, 500) }) // prettier-ignore
        }
        return [...ls, ...add]
      })
    } catch (e) {
      toast.error('Không thêm được vật tư', apiErrorText(e))
    }
  }
  function onCreatedMaterial(m: CreatedMaterial) {
    addMaterials([{ ...m, vat_rate: null, default_supplier_id: null, last_purchase_price: null, on_hand: null, last_line: null } as PoMaterial]) // prettier-ignore
  }
  /** Ghi số cân / quy cách về danh mục ngay từ dòng — khai một lần, mọi đơn sau tự điền. */
  async function saveToCatalog(
    materialId: string,
    field: 'kgm' | 'kgunit' | 'spec',
    value: number | string,
  ) {
    // prettier-ignore
    const col = field === 'kgm' ? 'kg_per_m' : field === 'kgunit' ? 'kg_per_unit' : 'spec'
    try {
      await api(`/api/dept/warehouse/materials/${materialId}`, {
        method: 'PATCH',
        body: { [col]: value },
      })
      setLines((ls) => ls.map((l) => l.material_id === materialId ? { ...l, ...(field === 'kgm' ? { catalog_kg_m: Number(value) } : field === 'kgunit' ? { catalog_kg_unit: Number(value) } : { spec: String(value) }) } : l)) // prettier-ignore
      invalidateMaterialPickCache()
      toast.success('Đã lưu vào danh mục', `${col} = ${value}`)
    } catch (e) {
      toast.error('Không lưu được vào danh mục', apiErrorText(e))
    }
  }
  function toggleExtraLsx(id: string, on: boolean) {
    setHeader((h) => ({ ...h, extraLsxIds: on ? [...h.extraLsxIds.filter((e) => e !== id), id] : h.extraLsxIds.filter((e) => e !== id) })) // prettier-ignore
  }

  // MỒI DÒNG TỪ URL (?vt=A,B&sl=10,20): mở từ dòng tồn hoặc bảng kê vật tư.
  const seeded = useRef(false)
  useEffect(() => {
    if (!p.seedCodes || seeded.current || !editing) return
    seeded.current = true
    const { codes, qtys } = p.seedCodes
    void Promise.all(codes.map((c) => fetchMaterialByCode(c))).then((found) => {
      const list: PoMaterial[] = []
      const extras = new Map<string, { qty?: number | null }>()
      const missing: string[] = []
      found.forEach((m, i) => {
        if (!m) return void missing.push(codes[i])
        list.push(m)
        if (Number.isFinite(qtys[i]) && qtys[i] > 0) extras.set(m.id, { qty: qtys[i] })
      })
      if (list.length > 0) addMaterials(list, extras)
      if (missing.length > 0) toast.error(`Không thấy vật tư "${missing.join('", "')}"`)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mồi một lần lúc mở
  }, [])

  // TỰ LƯU NHÁP: ghi sau mỗi nhịp gõ khi khác bản gốc; mở lại thì đề nghị khôi phục.
  const draftKey = draftKeyFor(po?.id ?? null)
  const baseline = useRef<string | null>(null)
  useEffect(() => {
    if (!drafting) return
    const t = setTimeout(() => setSavedDraft(readDraft(draftKey)), 0)
    return () => clearTimeout(t)
  }, [drafting, draftKey])
  useEffect(() => {
    if (!drafting || savedDraft) return
    const snap = { header, lines, shipCols }
    const sig = draftSignature(snap)
    if (baseline.current == null) {
      baseline.current = sig
      return
    }
    if (sig === baseline.current) {
      clearDraft(draftKey)
      return
    }
    const t = setTimeout(() => writeDraft(draftKey, snap), 700)
    return () => clearTimeout(t)
  }, [drafting, savedDraft, header, lines, shipCols, draftKey])
  // Ctrl+S = Lưu (phản xạ Excel); rời trang bằng trình duyệt khi đang sửa dở thì hỏi.
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (adjusting) {
          if (!adjBlocked && !busy) setAdjSheet(true)
        } else if (!problem && !busy) void save()
      }
    }
    const onLeave = (e: BeforeUnloadEvent) => {
      if (isDirty()) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onLeave)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onLeave)
    }
  })
  function restoreDraft(d: SavedDraft) {
    setHeader(d.header)
    setLines(d.lines)
    setShipCols(d.shipCols ?? [])
    dirty.current = { vat: true, currency: true, template: true }
    setSavedDraft(null)
  }

  async function confirmEnrich(picked: CatalogSuggestion[]) {
    if (!enrich) return
    setEnrichBusy(true)
    try {
      const { updated } = await api<{ updated: number }>(
        '/api/dept/warehouse/materials/enrich',
        {
          method: 'POST',
          body: {
            items: picked.map((s) => ({ material_id: s.material_id, set: Object.fromEntries(s.fields.filter((f) => !f.overwrite).map((f) => [f.field, f.value])), price: s.fields.find((f) => f.field === 'last_purchase_price')?.value as number | undefined })), // prettier-ignore
            po_code: enrich.poCode,
          },
        },
      )
      invalidateMaterialPickCache()
      toast.success(`Đã cập nhật ${updated} vật tư`, 'Lần đặt sau các ô này tự điền sẵn')
    } catch (e) {
      toast.error('Cập nhật danh mục thất bại', apiErrorText(e))
    } finally {
      setEnrichBusy(false)
      const dest = enrich.dest
      setEnrich(null)
      router.replace(dest)
      router.refresh()
    }
  }

  const goTo = (id: string) => {
    // Bố cục đọc: khối nằm trong một mục menu — mở mục đó rồi mới cuộn tới.
    const m = viewMode ? MUC_OF[id] : undefined
    if (m && m !== muc) {
      pickMuc(m)
      requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }))) // prettier-ignore
      return
    }
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }
  /** "Chưa lưu được: …" BẤM ĐƯỢC — đưa thẳng tới chỗ phải sửa, không bắt tự cuộn tìm. */
  function goToProblem(why: string) {
    const field = /nhà cung cấp/i.test(why) ? 'Nhà cung cấp' : /lệnh|LSX/i.test(why) ? 'Lệnh sản xuất' : /mẫu/i.test(why) ? 'Mẫu đơn' : null // prettier-ignore
    if (field) {
      setHeadOpen(true)
      goTo('dau-don')
      requestAnimationFrame(() => document.querySelector<HTMLSelectElement>(`#dau-don select[aria-label="${field}"]`)?.focus()) // prettier-ignore
      return
    }
    goTo('dong-hang')
    requestAnimationFrame(() => {
      const empty = [...document.querySelectorAll<HTMLInputElement>('#dong-hang tbody input[aria-label="SL đặt"], #dong-hang tbody input[aria-label="Đơn giá"]')].find((i) => i.value === '') // prettier-ignore
      empty?.focus()
    })
  }

  /* ── THEO DÕI THỰC HIỆN (0213) ───────────────────────────────────────── */
  const trackLines: TrackLine[] = p.lines.flatMap((l) => (l.id ? [{ id: l.id, code: l.material_code || null, name: l.material_name, unit: l.material_unit, qty_ordered: Number(l.qty_ordered) }] : [])) // prettier-ignore
  const trackById = new Map(trackLines.map((l) => [l.id, l]))
  const openIssues = (p.tracking?.issues ?? []).filter((i) => i.status === 'mo').length
  /*
    PHẦN GIAO THIẾU THẬT — chỉ tính khi hàng ĐÃ về ít nhất một lần hoặc dòng đã
    chốt thiếu. Đơn vừa gửi chưa về gì thì "còn thiếu" = cả đơn, và nút "tạo đơn
    bổ sung" lúc đó là mời đặt trùng (thử trên đơn test 27/09/2026).
  */
  // Đơn bổ sung CHỈ lấy dòng ĐÃ CHỐT THIẾU (NCC không giao nữa) — dòng còn thiếu
  // mà chưa chốt nghĩa là NCC vẫn đang giao, bổ sung lúc đó là đặt trùng.
  const missingTotal = p.statusLines.filter((s) => !!s.closed_short_at).reduce((t, s) => t + Math.max(0, Number(s.qty_missing ?? 0)), 0) // prettier-ignore
  const openShortLines = p.statusLines.filter((s) => !s.closed_short_at && Number(s.qty_received ?? 0) > 0 && Number(s.qty_missing ?? 0) > 1e-6).length // prettier-ignore
  const closedShort = new Set(
    p.statusLines.filter((x) => !!x.closed_short_at).map((x) => x.id),
  )
  // Dòng đã chốt thiếu là dòng ĐÃ ĐÓNG — không còn gì để NCC hẹn.
  const notFullyConfirmed = po && po.confirmed_at ? trackLines.filter((l) => !closedShort.has(l.id)).filter((l) => { const live = p.shipments.filter((s) => s.status !== 'cancelled'); if (live.length === 0) return false; const c = live.reduce((t, s) => t + s.lines.filter((x) => x.po_line_id === l.id).reduce((a, x) => a + x.qty, 0), 0); return c < l.qty_ordered - 1e-6 }).length : 0 // prettier-ignore
  /* ══ CÁC KHỐI CỦA MÀN — một chỗ định nghĩa, hai bố cục dùng chung ══════
     (27/09/2026) Màn ĐỌC chia thân thành menu ngang (`DocMenu`): bấm mục
     nào, thân chỉ hiện mục đó. Màn SOẠN / SỬA giữ nguyên bố cục khối gập +
     cột phải. Hai bố cục dùng CÙNG các khối dưới đây — không chép hai bản. */
  const moneyRows: [string, React.ReactNode][] = [
    ['Tiền hàng', <span key="a" className="num">{money(totals.subtotal, header.currency)}</span>], // prettier-ignore
    ['VAT', <span key="b" className="num">{header.vat === '' ? 0 : header.vat}% · {money(totals.vatAmount, header.currency)}</span>], // prettier-ignore
    ['Tổng thanh toán', <b key="c" className="num">{money(totals.grandTotal, header.currency)}</b>], // prettier-ignore
    ...(!editing && adjustments.length > 0 ? [['Bản duyệt', <span key="e" className="num">{money(adjustments[0].total_before, header.currency)}</span>], ['Phát sinh sau duyệt', <span key="f" className="num" title="Cộng các lần điều chỉnh — chi tiết ở khối Tiền của đơn">{signed(adjustments.at(-1)!.total_after - adjustments[0].total_before, header.currency)}</span>]] as [string, React.ReactNode][] : []), // prettier-ignore
    ...(!editing && costShare > 0 ? [['Chi phí mua · chưa VAT', <span key="g" className="num" title="Phí vận chuyển / bốc xếp chia cho đơn này — trả nhà xe hoặc NCC, chưa vào giá nhập kho">{money(costShare, header.currency)}</span>], ['Giá trị đơn + phí', <span key="h" className="num" title="Tiền hàng sau chiết khấu + chi phí mua, cùng CHƯA VAT">{money(totals.grandTotal - totals.vatAmount + costShare, header.currency)}</span>]] as [string, React.ReactNode][] : []), // prettier-ignore
    ...(issues.length > 0 ? [['Chưa gồm', <span key="d" className="k-t-warn">{issues.length} dòng thiếu số</span>] as [string, React.ReactNode]] : []), // prettier-ignore
  ]
  const nccBody = (
    <>
      <div className="k-strong" style={{ marginBottom: 4 }}>
        {p.supplier?.name ?? supplierOpt?.name ?? '—'}
      </div>
      {!p.supplier && !supplierOpt ? (
        <div className="text-k-sm text-[var(--ink-3)]">
          Chọn nhà cung cấp ở Đầu đơn — tiền tệ và điều khoản thanh toán tự theo hồ sơ.
        </div>
      ) : !p.facts ? (
        <FactKv
          rows={[
            ['Tiền tệ', <span key="a" className="num">{supplierOpt?.currency?.toUpperCase() ?? '—'}</span>], // prettier-ignore
            ['Thanh toán', <span key="b">{supplierOpt?.payment_terms ?? '—'}</span>], // prettier-ignore
            ['Lead time', <span key="c" className="num">{supplierOpt?.lead_time_days != null ? `${supplierOpt.lead_time_days} ngày` : '—'}</span>], // prettier-ignore
            ['Lịch sử mua', <span key="d" className="text-[var(--ink-3)]">hiện sau khi lưu đơn</span>], // prettier-ignore
          ]}
        />
      ) : (
        <FactKv
          rows={[
            ['Giao đúng hẹn', p.facts.onTime ? <span key="a" className="num k-t-done">{p.facts.onTime.hit} / {p.facts.onTime.of} đơn</span> : <span key="a" className="k-t-warn">chưa có lịch sử</span>], // prettier-ignore
            // GỌN 3 dòng (26/09/2026): cột phải nhường chỗ cho khối Trao đổi — 6
            // dòng dữ kiện NCC đẩy ô viết xuống gần đáy màn. "Mua gần nhất" bỏ:
            // hồ sơ NCC có đủ, ở đây nó không trả lời câu nào của đơn này.
            ['Đã đặt · nhận đủ', <span key="b" className="num">{p.facts.orders} · {p.facts.received} đơn</span>], // prettier-ignore
            ['Mã · MST', <span key="e" className="num">{p.supplier?.code ?? '—'} · {p.supplier?.tax_no ?? '—'}</span>], // prettier-ignore
          ]}
        />
      )}
    </>
  )
  const notesPanel = po ? (
    <PoNotesPanel
      poId={po.id}
      meId={me.id}
      meName={me.name}
      marks={marks.map((m) => ({ key: m.key, at: m.at, label: m.label, actor: m.actor }))} // prettier-ignore
      followerNames={[po.assignee_name].filter((x): x is string => !!x)}
      partnerLabel="Đã báo NCC · ghi lại"
      filters
    />
  ) : null
  const blkChecks = (
    <>
      {!editing && checks.length > 0 && (
        <Checks
          compact={blockers.length === 0}
          title={
            po?.status === 'approved'
              ? blockers.length > 0
                ? 'Chưa gửi NCC được'
                : 'Lưu ý trước khi gửi NCC'
              : blockers.length > 0
                ? 'Chưa gửi duyệt được'
                : 'Lưu ý trước khi gửi duyệt'
          }
          items={checks}
        />
      )}
    </>
  )
  const blkUnsent = (
    <>
      {!editing && unsentAdj && po && (
        <NoticeBar
          tone="warn"
          tag={`Điều chỉnh lần ${unsentAdj.seq} chưa tới NCC`}
          action={
            perms.canEdit
              ? { label: 'Ghi đã gửi NCC', onClick: () => { setSentNote(''); setSentSheet(unsentAdj.seq) } } // prettier-ignore
              : undefined
          }
        >
          Áp dụng {dmyAt(unsentAdj.created_at)} — in phiếu đặt hàng gửi lại{' '}
          {po.supplier_name} để NCC làm theo số mới.
        </NoticeBar>
      )}
    </>
  )
  const blkLines = (
    <>
      {/* ══ 1. LƯỚI DÒNG — mở đầu, nhân vật chính ═══════════════════════ */}
      <FastTab
        fixed={viewMode}
        id="dong-hang"
        title="Dòng đơn hàng"
        defaultOpen
        flush
        summary={[
          ['Số dòng', <span key="a" className="num">{lines.length}</span>], // prettier-ignore
          ['Thiếu số', <span key="b" className={issues.length ? 'num k-t-warn' : 'num'}>{issues.length}</span>], // prettier-ignore
          ['Tổng', <span key="c" className="num">{money(totals.grandTotal, header.currency)}</span>], // prettier-ignore
        ]}
        actions={
          !editing ? (
            <>
              <GridBtn
                disabled={!editAct || !!editAct.blocked}
                title={editAct?.blocked}
                onClick={() => editAct && start(editAct)}
              >
                {editAct?.id === 'adjust' ? 'Điều chỉnh đơn' : 'Chỉnh sửa vật tư'}
              </GridBtn>
              <GridSep />
              <GridBtn
                onClick={() => goTo('dot-giao')}
                disabled={!po}
                title="Đợt giao, ma trận nhận và các nút nhận hàng"
              >
                Giao &amp; nhận hàng
              </GridBtn>
            </>
          ) : undefined
        }
      >
        {editing && (
          <GridToolbar
            count={sel.length > 0 ? `${sel.length} dòng đã chọn` : `${lines.length} dòng`}
          >
            <>
              <Combobox<PoMaterial>
                label="Thêm vật tư"
                placeholder="Gõ mã, tên hoặc quy cách (50x50, 8x15…) rồi Enter"
                width={400}
                search={async (q) =>
                  (
                    await api<{ materials: PoMaterial[] }>(
                      `/api/dept/supply/po-materials?q=${encodeURIComponent(q)}&limit=12`,
                    )
                  ).materials
                }
                keyOf={(m) => m.id}
                /*
                    HAI DÒNG, QUY CÁCH ĐỨNG RIÊNG. Trước đây một dòng "mã · tên ·
                    ĐVT · nhóm" và KHÔNG có quy cách — trong khi quy cách chính là
                    thứ người mua dùng để phân biệt: danh mục có 8 mã "Inox hộp
                    50x50" khác nhau ở độ dày, và 131 mã "Nút chân" khác nhau ở
                    kích thước. Chọn nhầm là cả đơn sai hàng.

                    Tồn kho đi kèm luôn: biết còn 2.000 cái trong kho thì người
                    mua đặt 500 chứ không đặt 2.500.
                  */
                render={(m) => (
                  <>
                    <span className="flex items-baseline gap-2">
                      <span className="num shrink-0 font-semibold text-[var(--act)]">
                        {m.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    </span>
                    <span className="text-k-label flex flex-wrap items-baseline gap-x-2.5">
                      {m.spec ? (
                        <span className="num font-semibold text-[var(--ink-2)]">
                          {m.spec}
                        </span>
                      ) : (
                        <span className="text-[var(--ink-empty)]">chưa có quy cách</span>
                      )}
                      <span className="text-[var(--ink-3)]">{m.unit}</span>
                      {m.on_hand != null && m.on_hand !== 0 && (
                        <span className="num text-[var(--ink-3)]">tồn {m.on_hand}</span>
                      )}
                      {m.last_purchase_price != null && (
                        <span className="num text-[var(--ink-3)]">
                          giá gần nhất {m.last_purchase_price.toLocaleString('vi-VN')}
                        </span>
                      )}
                      {m.group_name && (
                        <span className="truncate text-[var(--ink-3)]">
                          {m.group_name}
                        </span>
                      )}
                    </span>
                  </>
                )}
                onPick={addMaterial}
              />
              <GridBtn onClick={addFree}>+ Dòng tự do</GridBtn>
              <GridBtn
                disabled={sel.length === 0}
                title="Chọn dòng trước"
                onClick={removeSel}
              >
                Xoá dòng
              </GridBtn>
              <GridSep />
              <GridBtn onClick={() => setPaste(true)} title="Dán vùng bảng từ sổ Excel">
                Dán từ Excel
              </GridBtn>
              <GridBtn
                onClick={() => setQuickAdd(true)}
                title="Khai vật tư chưa có trong danh mục"
              >
                Khai vật tư mới
              </GridBtn>
              {/* Chuyển xuống từ thanh hành động: nó đẻ ra dòng, nên đứng
                    cạnh hai nút kia chứ không nằm trên đầu chứng từ. */}
              {drafting && (
                <GridBtn
                  disabled={pending.length === 0}
                  title={pending.length === 0 ? (header.poType === 'lsx' && header.lsxId ? 'Lệnh không còn nhu cầu nào chưa lên đơn' : 'Chọn lệnh sản xuất trước') : 'Thêm mọi mã lệnh còn thiếu vào đơn'} // prettier-ignore
                  onClick={() => void addFromNeeds(pending)}
                >
                  Thêm {pending.length > 0 ? `${pending.length} mã ` : ''}còn thiếu
                </GridBtn>
              )}
            </>
          </GridToolbar>
        )}

        <div onKeyDown={editing ? gridKeys : undefined}>
          {/* Ô GỌN (Đm/sp) không cộng bề rộng tối thiểu: nó lấy chỗ của cột tên vật tư
                (co giãn) để cột tiền vẫn trong màn ở 1280 — đo 26/09/2026. */}
          <Grid minWidth={640 + gridFields.filter((f) => !f.compact).length * 100}>
            <GridHead>
              <Th width={30} />
              <Th width={36}>#</Th>
              <Th>Mã · tên vật tư</Th>
              {gridFields.map((f) => (
                <Th key={f.key} num={f.align === 'right' || f.kind !== 'text'}>
                  {f.label}
                </Th>
              ))}
              <Th>ĐVT</Th>
              <Th num>SL đặt</Th>
              <Th num>Đơn giá</Th>
              <Th num>Thành tiền</Th>
              {adjusting && <Th num>Đã nhận</Th>}
              {adjusting && <Th num>Phát sinh</Th>}
              {!editing && <Th>Trạng thái</Th>}
            </GridHead>
            <GridBody>
              {lines.map((l, i) => {
                const why = issues.find((x) => x.index === i)?.why ?? null
                const st = statusById.get(l.po_line_id ?? '')
                const org =
                  adjusting && l.po_line_id ? origById.get(l.po_line_id) : undefined
                const got = adjusting && l.po_line_id ? (st?.qty_received ?? 0) : 0
                const underGot = adjusting && l.qty !== '' && Number(l.qty) < got - 1e-9
                const kind: 'idle' | 'part' | 'done' | 'short' = !st
                  ? 'idle'
                  : st.closed_short_at
                    ? 'short'
                    : st.qty_open <= 0
                      ? 'done'
                      : st.qty_received > 0
                        ? 'part'
                        : 'idle'
                return (
                  <GridRow
                    key={rowKey(l)}
                    selected={i === curIdx}
                    onClick={() => setPick(i)}
                  >
                    <GridCheck
                      checked={sel.includes(rowKey(l))}
                      label={`Chọn dòng ${l.code || l.name}`}
                      onChange={() =>
                        setSel((s) =>
                          s.includes(rowKey(l))
                            ? s.filter((x) => x !== rowKey(l))
                            : [...s, rowKey(l)],
                        )
                      }
                    />
                    <Td num tone={why ? 'warn' : undefined}>
                      {i + 1}
                    </Td>
                    <Td>
                      {l.is_free && editing ? (
                        <TextInput
                          label="Tên hàng"
                          value={l.name}
                          onCommit={(v) => patch(i, { name: v })}
                          placeholder="Tên hàng (dòng tự do)"
                        />
                      ) : (
                        <>
                          <span className="num k-strong">{l.code}</span>
                          {l.code ? ' · ' : ''}
                          {l.name}
                          {l.is_free && (
                            <span className="text-[var(--ink-3)]"> · tự do</span>
                          )}
                        </>
                      )}
                    </Td>
                    {gridFields.map((f) => (
                      <Td key={f.key} num={f.kind !== 'text'}>
                        {editing ? (
                          <EditCell
                            f={f}
                            l={l}
                            template={template}
                            onField={(v) => setField(i, f, v)}
                            onPatch={(part) => patch(i, part)}
                          />
                        ) : (
                          <ViewCell f={f} l={l} template={template} />
                        )}
                      </Td>
                    ))}
                    <Td>
                      {editing && l.is_free ? (
                        <TextInput
                          label="ĐVT"
                          value={l.unit}
                          onCommit={(v) => patch(i, { unit: v })}
                        />
                      ) : (
                        l.unit
                      )}
                    </Td>
                    <Td num tone={why?.includes('SL') || underGot ? 'warn' : undefined}>
                      {editing ? (
                        <>
                          <NumInput
                            aria-label="SL đặt"
                            value={numStr(l.qty)}
                            onCommit={(v) => patch(i, { qty: toNum(v) })}
                          />
                          {underGot && (
                            <CellHint
                              tone="warn"
                              title='Không đặt thấp hơn số Kho đã nhận. NCC không giao nữa thì dùng "Chốt thiếu" ở khối Giao & nhận hàng.'
                            >
                              ⚠ dưới SL đã nhận {fmtNum(got)}
                            </CellHint>
                          )}
                          {org &&
                            !underGot &&
                            Number(org.qty_ordered) !== Number(l.qty) && (
                              <CellHint title="Số của bản đang chạy">
                                từ {fmtNum(Number(org.qty_ordered))}
                              </CellHint>
                            )}
                          {(() => {
                            // Ô còn TRỐNG mới mời; đã gõ số thì gợi ý là nhiễu.
                            if (l.qty !== '') return null
                            const short = l.qty_demand !== '' ? suggestOrderQty(Number(l.qty_demand), Number(l.qty_on_hand) || 0, l.dm_per_sp === '' ? null : Number(l.dm_per_sp)) : null // prettier-ignore
                            const raw = short ?? suggestByMat.get(l.material_id) ?? null
                            if (raw == null || raw <= 0) return null
                            const use = roundUpToPack(raw, l.pack_size)
                            return (
                              <CellHint
                                onClick={() => patch(i, { qty: use })}
                                title={`${short != null ? (l.dm_per_sp !== '' && Number(l.dm_per_sp) > 0 ? `SL đơn hàng × Đm/sp (${fmtNum(Number(l.dm_per_sp))}) − tồn kho` : 'SL cần cho lệnh − tồn kho') : 'Đề xuất từ nhu cầu của lệnh'}${use !== raw ? ` (${fmtNum(raw)} làm tròn lên nguyên ${l.pack_unit || 'bao'})` : ''} — bấm để dùng`} // prettier-ignore
                              >
                                dùng {fmtNum(use)} ↩
                              </CellHint>
                            )
                          })()}
                        </>
                      ) : (
                        Number(l.qty || 0).toLocaleString('vi-VN')
                      )}
                      {(() => {
                        /*
                          ĐẶT ÍT HƠN NHU CẦU (P1, 27/09/2026) — màn cũ tô hổ phách ô
                          này để người duyệt thấy đơn không phủ hết lệnh; màn soạn
                          mới làm rơi mất. Nhu cầu tính CÙNG phép với gợi ý "dùng N"
                          (SL đơn hàng × Đm/sp − tồn) — một nguồn số. Chỉ nhắc, không
                          chặn: giao đợt khác / dùng hàng thay thế là chủ đích hợp lệ.
                        */
                        if (l.qty === '' || l.qty_demand === '') return null
                        const need = suggestOrderQty(Number(l.qty_demand), Number(l.qty_on_hand) || 0, l.dm_per_sp === '' ? null : Number(l.dm_per_sp)) // prettier-ignore
                        const gap = underDemand(Number(l.qty), need)
                        if (gap == null) return null
                        return (
                          <CellHint
                            tone="warn"
                            title={`Cần đặt ${fmtNum(need ?? 0)} theo nhu cầu lệnh (đã trừ tồn kho). Đặt ít hơn thì lệnh chưa đủ vật tư — chủ đích (giao đợt khác, hàng thay thế) thì cứ đặt, chỉ nhắc.`} // prettier-ignore
                          >
                            {' '}
                            {/* prettier-ignore */}⚠ thiếu {fmtNum(gap)} so với nhu cầu
                          </CellHint>
                        )
                      })()}
                      {(() => {
                        const cap = capLeft.get(l.material_id)
                        if (cap == null || l.qty === '' || Number(l.qty) <= cap)
                          return null
                        return (
                          <CellHint
                            tone="warn"
                            title="Trần tồn trừ tồn hiện có và lượng đã đặt chưa về. Vượt trần là chủ đích thì cứ đặt — chỉ nhắc, không chặn."
                          >
                            {' '}
                            {/* prettier-ignore */}⚠ vượt trần · thêm được {fmtNum(cap)}
                          </CellHint>
                        )
                      })()}
                      {(() => {
                        // Quy đổi ĐÓNG GÓI MUA — đúng phép chia nhân viên vẫn
                        // tự bấm trong Excel (13.596 con ÷ 500 → 28 bì).
                        const packs =
                          l.qty !== '' ? packCount(Number(l.qty), l.pack_size) : null
                        if (packs == null) return null
                        return (
                          <CellHint
                            title={`Đóng gói mua: 1 ${l.pack_unit} = ${fmtNum(l.pack_size ?? 0)} ${l.unit}`}
                          >
                            {' '}
                            {/* prettier-ignore */}
                            {Number.isInteger(packs) ? '=' : '≈'} {fmtNum(packs)}{' '}
                            {l.pack_unit}
                          </CellHint>
                        )
                      })()}
                    </Td>
                    <Td num tone={why?.includes('giá') ? 'warn' : undefined}>
                      {editing ? (
                        <>
                          <NumInput
                            aria-label="Đơn giá"
                            value={numStr(l.price)}
                            onCommit={(v) => patch(i, { price: toNum(v) })}
                          />
                          {org &&
                            Number(org.unit_price ?? 0) !== Number(l.price || 0) && (
                              <CellHint title="Đơn giá của bản đang chạy">
                                từ {fmtNum(Number(org.unit_price ?? 0))}
                              </CellHint>
                            )}
                          {(() => {
                            // GIÁ LỆCH LẦN MUA TRƯỚC ≥ 5% (P3, 27/09/2026) — cùng ngưỡng màn duyệt
                            // của Giám đốc đang tô. Chỉ nhắc: tăng giá có thể hợp lệ, nhưng người
                            // mua phải thấy trước khi gửi, không phải Giám đốc thấy lúc duyệt.
                            const d = priceDrift(l.price === '' ? null : Number(l.price), l.last_price) // prettier-ignore
                            if (d == null) return null
                            return (
                              <CellHint
                                tone="warn"
                                title={`Giá mua lần trước ${fmtNum(l.last_price ?? 0)}`}
                              >
                                {d > 0 ? '▲' : '▼'} {Math.abs(d)}% so với lần trước
                              </CellHint>
                            )
                          })()}
                          {(() => {
                            // Mẫu bao bì tính theo m²: máy dựng sẵn giá thùng
                            // để người mua đối chiếu với giá NCC chào.
                            const goi = cartonPriceSuggest(template, l)
                            if (goi == null || goi <= 0 || Number(l.price) === goi) return null // prettier-ignore
                            return (
                              <CellHint
                                onClick={() => patch(i, { price: goi })}
                                title="m²/thùng × đơn giá/m² + phí bản in — bấm để dùng"
                              >
                                dùng {fmtNum(goi)} ↩
                              </CellHint>
                            )
                          })()}
                        </>
                      ) : l.price === '' ? (
                        <span className="k-t-warn">—</span>
                      ) : (
                        Number(l.price).toLocaleString('vi-VN')
                      )}
                    </Td>
                    <Td num>
                      {l.price === '' ? (
                        <span className="k-flag">chưa có giá</span>
                      ) : (
                        fmtMoney(
                          roundMoney(lineAmount(template, l), header.currency),
                          header.currency,
                        )
                      )}
                    </Td>
                    {adjusting && (
                      <Td num>
                        {l.po_line_id ? (
                          fmtNum(got)
                        ) : (
                          <span className="text-[var(--ink-3)]">mới</span>
                        )}
                      </Td>
                    )}
                    {adjusting && (
                      <Td num>
                        {(() => {
                          const c = adjRow.get(i)
                          if (!c) return <span className="text-[var(--ink-3)]">—</span>
                          const d = c.amount_after - c.amount_before
                          return (
                            <span
                              title={
                                c.kind === 'added'
                                  ? 'Dòng thêm mới'
                                  : `vì giá ${signed(c.by_price, header.currency)} · vì lượng ${signed(c.by_qty, header.currency)}${c.fields.length ? ` · đổi ${c.fields.join(', ')}` : ''}`
                              }
                            >
                              {signed(d, header.currency)}
                            </span>
                          )
                        })()}
                      </Td>
                    )}
                    {!editing && (
                      <Td>
                        <LineStatus kind={kind}>
                          {
                            {
                              idle: 'Chưa nhận',
                              part: 'Một phần',
                              done: 'Đủ',
                              short: 'Đóng thiếu',
                            }[kind]
                          }
                        </LineStatus>
                      </Td>
                    )}
                  </GridRow>
                )
              })}
            </GridBody>
            <GridFoot>
              <Td colSpan={3 + gridFields.length + 1}>
                Cộng {lines.length} dòng
                {issues.length > 0 ? ` · ${issues.length} thiếu số` : ''}
              </Td>
              <Td num>
                {lines
                  .reduce((s, l) => s + Number(l.qty || 0), 0)
                  .toLocaleString('vi-VN')}
              </Td>
              <Td />
              <Td num>
                {fmtMoney(roundMoney(totals.subtotal, header.currency), header.currency)}
              </Td>
              {adjusting && <Td />}
              {adjusting && (
                <Td num>
                  {adjPlan ? signed(adjPlan.delta.subtotal, header.currency) : null}
                </Td>
              )}
              {!editing && <Td />}
            </GridFoot>
          </Grid>
        </div>

        {/* ══ CHI TIẾT DÒNG ĐANG CHỌN — Dynamics Line details ═══════════ */}
        {cur ? (
          <LineDetail
            index={curIdx + 1}
            code={cur.code || cur.name || '(dòng tự do)'}
            open={detailOpen}
            onToggle={() => setDetailOpen(!detailOpen)}
            // Lúc gấp vẫn phải biết bên trong có gì — không có câu này thì
            // khay thành hộp kín và người dùng mở ra ở MỌI dòng để kiểm,
            // tức tệ hơn lúc chưa gấp.
            summary={detailOpen ? null : lineDetailSummary(cur, detailFields)}
          >
            <FieldGroup title="Thông số theo mẫu">
              {detailFields.length === 0 && (
                <Field label="—">Mẫu này không có thông số riêng</Field>
              )}
              {detailFields.map((f) => (
                <Field key={f.key} label={f.label}>
                  {editing ? (
                    <EditCell
                      f={f}
                      l={cur}
                      template={template}
                      onField={(v) => setField(curIdx, f, v)}
                      onPatch={(part) => patch(curIdx, part)}
                    />
                  ) : (
                    <ViewCell f={f} l={cur} template={template} />
                  )}
                </Field>
              ))}
            </FieldGroup>
            <FieldGroup title="Số lượng &amp; giá">
              <Field label="Quy đổi kho">
                <span className="num">
                  {(() => {
                    const v = lineQty2(template, cur)
                    return v == null
                      ? '—'
                      : `${v.toLocaleString('vi-VN')} ${cur.unit2_label || meta.priceUnit || ''}`
                  })()}
                </span>
              </Field>
              <Field label="Nhu cầu lệnh">
                <span className="num">
                  {cur.qty_demand === ''
                    ? '—'
                    : Number(cur.qty_demand).toLocaleString('vi-VN')}
                </span>
              </Field>
              <Field label="Tồn kho lúc soạn">
                <span className="num">
                  {cur.on_hand == null
                    ? 'chưa có sổ kho'
                    : cur.on_hand.toLocaleString('vi-VN')}
                </span>
              </Field>
              <Field label="Đóng gói mua">
                {cur.pack_size ? (
                  <span className="num">
                    1 {cur.pack_unit} = {cur.pack_size} {cur.unit}
                  </span>
                ) : (
                  '—'
                )}
              </Field>
              {/* NCC BÁO GIÁ THEO ĐƠN VỊ NÀO — chỗ quyết định tiền của dòng
                    nhôm/sơn: cùng một con số 62.000 mà "theo cây" với "theo kg"
                    lệch nhau vài lần. Bản cũ cho chọn ngay trên lưới; ở đây nằm
                    tại chi tiết dòng để lưới giữ 11 cột. */}
              <Field label="Giá theo">
                {editing && lineQty2(template, cur) != null ? (
                  <Pick
                    label="Giá theo đơn vị"
                    value={cur.price_per || 'mac-dinh'}
                    onChange={
                      (v) =>
                        patch(curIdx, { price_per: (v === 'mac-dinh' ? '' : v) as Line['price_per'] }) // prettier-ignore
                    }
                    options={[
                      { value: 'mac-dinh', label: `Mặc định của mẫu ${meta.label.toLowerCase()}` }, // prettier-ignore
                      { value: 'unit', label: `Theo ĐVT mua (${cur.unit || 'đvt'})` },
                      { value: 'unit2', label: `Theo đơn vị quy đổi (${cur.unit2_label || meta.priceUnit})` }, // prettier-ignore
                    ]}
                  />
                ) : cur.price_per === 'unit2' ? (
                  `đơn vị quy đổi (${cur.unit2_label || meta.priceUnit})`
                ) : cur.price_per === 'unit' ? (
                  'ĐVT mua'
                ) : (
                  'mặc định của mẫu'
                )}
              </Field>
              {/* Giá ở đơn vị CÒN LẠI — số để so với báo giá của NCC, không
                    dùng để tính tiền. Chỉ dựng khi đủ SL, giá và hệ số quy đổi. */}
              {(() => {
                const q2 = lineQty2(template, cur)
                const sl = cur.qty === '' ? 0 : Number(cur.qty)
                const gia = cur.price === '' ? 0 : Number(cur.price)
                if (q2 == null || q2 <= 0 || sl <= 0 || gia <= 0) return null
                const theoUnit2 = cur.price_per === 'unit2'
                const quy = theoUnit2 ? (gia * q2) / sl : (gia * sl) / q2
                const nhan = theoUnit2 ? cur.unit || 'đvt' : cur.unit2_label || meta.priceUnit // prettier-ignore
                return (
                  <Field label="Tương đương">
                    <span
                      className="num"
                      title="Số để đối chiếu báo giá của NCC — không dùng để tính tiền"
                    >
                      {' '}
                      {/* prettier-ignore */}≈{' '}
                      {fmtMoney(roundMoney(quy, header.currency), header.currency)} /{' '}
                      {nhan}
                    </span>
                  </Field>
                )
              })()}
              <Field label="Thành tiền">
                <b className="num">
                  {cur.price === ''
                    ? '—'
                    : money(lineAmount(template, cur), header.currency)}
                </b>
              </Field>
            </FieldGroup>
            {lsxsOfPo.length > 1 && (
              <FieldGroup title="Chia số lượng cho lệnh">
                {lsxsOfPo.map((lx) => (
                  <Field key={lx.id} label={lx.code}>
                    {editing ? (
                      <NumInput value={cur.lsx_split?.[lx.id] === undefined || cur.lsx_split[lx.id] === '' ? '' : String(cur.lsx_split[lx.id])} aria-label={`SL cho ${lx.code}`} onCommit={(v) => patch(curIdx, { lsx_split: { ...cur.lsx_split, [lx.id]: (v.trim() === '' ? '' : Number(v.replace(',', '.'))) as Num } })} /> // prettier-ignore
                    ) : (
                      <span className="num">{cur.lsx_split?.[lx.id] === undefined || cur.lsx_split[lx.id] === '' ? '—' : Number(cur.lsx_split[lx.id]).toLocaleString('vi-VN')}</span> // prettier-ignore
                    )}
                  </Field>
                ))}
              </FieldGroup>
            )}
            {editing && !cur.is_free && (
              <FieldGroup title="Danh mục vật tư">
                <Field label="Hồ sơ">
                  <span className="flex flex-wrap gap-1">
                    <GridBtn
                      onClick={() => setEditMaterial(cur.material_id)}
                      title="Sửa quy cách, nhóm, barem của vật tư này trong danh mục"
                    >
                      Sửa danh mục vật tư
                    </GridBtn>
                    {
                      cur.weight_per_m !== '' && cur.catalog_kg_m == null &&
                        <GridBtn onClick={() => void saveToCatalog(cur.material_id, 'kgm', Number(cur.weight_per_m))}>Lưu kg/m vào danh mục</GridBtn> // prettier-ignore
                    }
                    {
                      cur.weight_per_unit !== '' && cur.catalog_kg_unit == null &&
                        <GridBtn onClick={() => void saveToCatalog(cur.material_id, 'kgunit', Number(cur.weight_per_unit))}>Lưu kg/đv vào danh mục</GridBtn> // prettier-ignore
                    }
                    {cur.spec.trim() !== '' && (
                      <GridBtn
                        title="Ghi quy cách đang gõ vào hồ sơ vật tư — lần đặt sau tự điền"
                        onClick={() => void saveToCatalog(cur.material_id, 'spec', cur.spec.trim())} // prettier-ignore
                      >
                        Lưu quy cách vào danh mục
                      </GridBtn>
                    )}
                  </span>
                </Field>
              </FieldGroup>
            )}
            <FieldGroup title="Ghi chú dòng">
              <Field label="Ghi chú">
                {editing ? (
                  <TextInput
                    label="Ghi chú dòng"
                    value={cur.note}
                    onCommit={(v) => patch(curIdx, { note: v })}
                  />
                ) : (
                  cur.note || '—'
                )}
              </Field>
              {cur.is_free && <Field label="Loại dòng">Dòng tự do — không trừ kho</Field>}
            </FieldGroup>
          </LineDetail>
        ) : (
          <div className="k-ft-note">
            Chưa có dòng nào.{' '}
            {editing
              ? 'Gõ mã vật tư ở ô tìm phía trên rồi Enter.'
              : 'Bấm Sửa để thêm dòng.'}
          </div>
        )}
      </FastTab>
    </>
  )
  const blkPhatSinh = (
    <>
      {/* ══ 1c. TIỀN CỦA ĐƠN — bản duyệt + phát sinh sau duyệt (0210) ══════
            Chỉ có khi đơn từng được điều chỉnh. Kế toán đối chiếu hoá đơn theo
            tổng HIỆN HÀNH; các khoản phát sinh nói tiền tăng/giảm từ đâu — vì
            giá hay vì lượng — và đã tới NCC chưa. */}
      {!editing && po && adjustments.length > 0 && (
        <FastTab
          fixed={viewMode}
          id="phat-sinh"
          title="Tiền của đơn · bản duyệt và phát sinh"
          flush
          defaultOpen
          summary={[
            ['Lần điều chỉnh', <span key="a" className="num">{adjustments.length}</span>], // prettier-ignore
            ['Phát sinh', <span key="b" className="num">{signed(adjustments.at(-1)!.total_after - adjustments[0].total_before, po.currency)}</span>], // prettier-ignore
          ]}
        >
          <Grid minWidth={700}>
            <GridHead>
              <Th width={120}>Khoản</Th>
              <Th width={170}>Ngày · người</Th>
              <Th num>Tiền hàng</Th>
              <Th num>VAT</Th>
              <Th num>Tổng thanh toán</Th>
              <Th>Lý do · gửi NCC</Th>
            </GridHead>
            <GridBody>
              <GridRow>
                <Td>
                  <b>Bản duyệt</b>
                </Td>
                <Td>
                  {dmyAt(po.approved_at) || '—'} · {po.approver_name ?? '—'}
                </Td>
                <Td num>{money(adjustments[0].subtotal_before, po.currency)}</Td>
                <Td num>{money(adjustments[0].vat_before, po.currency)}</Td>
                <Td num>{money(adjustments[0].total_before, po.currency)}</Td>
                <Td>Tiền đã ký duyệt</Td>
              </GridRow>
              {adjustments.map((a) => (
                <GridRow key={a.seq}>
                  <Td>
                    <b>Phát sinh lần {a.seq}</b>
                  </Td>
                  <Td>
                    {dmyAt(a.created_at)} · {a.created_by_name ?? '—'}
                  </Td>
                  <Td num>{signed(a.subtotal_after - a.subtotal_before, a.currency)}</Td>
                  <Td num>{signed(a.vat_after - a.vat_before, a.currency)}</Td>
                  <Td num>{signed(a.total_after - a.total_before, a.currency)}</Td>
                  <Td>
                    {a.reason} ·{' '}
                    {a.sent_at ? (
                      `đã gửi NCC ${dmyAt(a.sent_at)}`
                    ) : (
                      <span className="k-t-warn">chưa gửi NCC</span>
                    )}
                  </Td>
                </GridRow>
              ))}
            </GridBody>
            <GridFoot>
              <Td colSpan={2}>Hiện hành — đối chiếu hoá đơn NCC theo dòng này</Td>
              <Td num>{money(adjustments.at(-1)!.subtotal_after, po.currency)}</Td>
              <Td num>{money(adjustments.at(-1)!.vat_after, po.currency)}</Td>
              <Td num>{money(adjustments.at(-1)!.total_after, po.currency)}</Td>
              <Td />
            </GridFoot>
          </Grid>
          <div className="px-[var(--gutter)] pt-3">
            <h3 className="k-fgrp-h">
              Chi tiết phát sinh theo dòng · tách vì giá và vì lượng
            </h3>
          </div>
          <Grid minWidth={720}>
            <GridHead>
              <Th width={44} num>
                Lần
              </Th>
              <Th>Mã · tên vật tư</Th>
              <Th width={90}>Loại</Th>
              <Th num>Cũ</Th>
              <Th num>Mới</Th>
              <Th num>Vì giá</Th>
              <Th num>Vì lượng</Th>
              <Th num>Cộng</Th>
            </GridHead>
            <GridBody>
              {adjustments.flatMap((a) =>
                a.lines.map((c, k) => (
                  <GridRow key={`${a.seq}-${k}`}>
                    <Td num>{a.seq}</Td>
                    <Td>
                      <span className="num k-strong">{c.code}</span>
                      {c.code ? ' · ' : ''}
                      {c.name}
                    </Td>
                    <Td>
                      {c.kind === 'added'
                        ? 'Dòng mới'
                        : c.kind === 'removed'
                          ? 'Bỏ dòng'
                          : c.by_price !== 0 && c.by_qty !== 0
                            ? 'Giá + lượng'
                            : c.by_price !== 0
                              ? 'Giá'
                              : c.by_qty !== 0
                                ? 'Lượng'
                                : 'Thông số'}{' '}
                      {/* prettier-ignore */}
                    </Td>
                    <Td num>
                      {c.qty_before == null
                        ? '—'
                        : `${fmtNum(c.qty_before)} × ${fmtNum(c.price_before ?? 0)}`}
                    </Td>
                    <Td num>
                      {c.qty_after == null
                        ? '—'
                        : `${fmtNum(c.qty_after)} × ${fmtNum(c.price_after ?? 0)}`}
                    </Td>
                    <Td num>{c.by_price ? signed(c.by_price, a.currency) : '—'}</Td>
                    <Td num>{c.by_qty ? signed(c.by_qty, a.currency) : '—'}</Td>
                    <Td num>{signed(c.amount_after - c.amount_before, a.currency)}</Td>
                  </GridRow>
                )),
              )}
            </GridBody>
            <GridFoot>
              <Td colSpan={5}>Cộng phát sinh tiền hàng (chưa VAT)</Td>
              <Td num>
                {signed(
                  adjustments.reduce((t, a) => t + a.delta_by_price, 0),
                  po.currency,
                )}
              </Td>
              <Td num>
                {signed(
                  adjustments.reduce((t, a) => t + a.delta_by_qty, 0),
                  po.currency,
                )}
              </Td>
              <Td num>
                {signed(
                  adjustments.reduce(
                    (t, a) => t + a.subtotal_after - a.subtotal_before,
                    0,
                  ),
                  po.currency,
                )}
              </Td>
            </GridFoot>
          </Grid>
        </FastTab>
      )}
    </>
  )
  const blkNhuCau = (
    <>
      {/* ══ 1a. NHU CẦU CỦA LỆNH — chỉ khi đang soạn đơn theo lệnh ═══════ */}
      {drafting && header.poType === 'lsx' && header.lsxId && (
        <FastTab
          id="nhu-cau"
          title="Nhu cầu của lệnh"
          flush
          defaultOpen={pending.length > 0}
          summary={[
            ['Lệnh', <span key="a" className="num">{lsxLabel ?? '—'}</span>], // prettier-ignore
            ['Còn thiếu', <span key="b" className={pending.length ? 'num k-t-warn' : 'num'}>{pending.length}</span>], // prettier-ignore
          ]}
          actions={
            <GridBtn
              disabled={pending.length === 0}
              onClick={() => void addFromNeeds(pending)}
            >
              + Thêm tất cả còn thiếu
            </GridBtn>
          }
        >
          <NhuCauGrid
            needs={needs}
            loading={needsLoading}
            usedIds={usedIds}
            onAdd={(l) => void addFromNeeds(l)}
          />
        </FastTab>
      )}
    </>
  )
  const blkGiao = (
    <>
      {/* ══ 1b. GIAO & NHẬN HÀNG — hai sổ: NCC hẹn gì, Kho thực nhận gì ═══
            Mở sẵn khi đơn đã gửi NCC (từ đó trở đi đây là câu hỏi hằng ngày);
            trước đó gấp lại, chỉ tiêu đề nói "chưa có đợt". */}
      {(po || drafting) && (
        <FastTab
          fixed={viewMode}
          id="dot-giao"
          title={drafting ? 'Chia đợt giao' : 'Giao & nhận hàng'}
          flush
          defaultOpen={drafting ? shipCols.length > 0 : viewMode || sentToSupplier}
          summary={
            drafting
              ? [
                  [
                    'Đợt',
                    <span key="a" className="num">
                      {columnsToShipments(shipCols).length || '—'}
                    </span>,
                  ],
                ]
              : [
                  // prettier-ignore
                  ['Đợt giao', <span key="a" className="num">{liveShipments.length}</span>], // prettier-ignore
                  ['Đã nhận', <span key="b" className="num">{liveShipments.length > 0 ? `${shipmentsDone}/${liveShipments.length}` : '—'}</span>], // prettier-ignore
                  ['Phiếu kho', <span key="c" className="num">{p.warehouseDocs.length}</span>], // prettier-ignore
                ]
          }
          actions={
            !drafting ? (
              <>
                <GridBtn
                  disabled={busy || !recv.addShipment.ok}
                  title={recv.addShipment.why}
                  onClick={() => setXacNhan('add')}
                >
                  {' '}
                  {/* prettier-ignore */}+ Thêm đợt giao
                </GridBtn>
                <GridBtn
                  disabled={!recv.receive.ok}
                  title={recv.receive.why}
                  onClick={() => po && router.push(`/warehouse/nhap/${po.id}`)}
                >
                  {' '}
                  {/* prettier-ignore */}
                  Ghi nhận nhận hàng · Kho
                </GridBtn>
              </>
            ) : undefined
          }
        >
          {drafting ? (
            <ChiaDotSoanGrid lines={lines} columns={shipCols} onChange={setShipCols} />
          ) : !po ? null : po.status === 'cancelled' ? (
            <div className="text-k-sm px-[var(--gutter)] py-3 text-[var(--ink-2)]">
              Đơn đã huỷ — kế hoạch giao và chứng từ kho không còn áp dụng.
            </div>
          ) : (
            <>
              {sentToSupplier && (
                <>
                  <div className="px-[var(--gutter)] pt-2">
                    <h3 className="k-fgrp-h">
                      Xác nhận theo dòng · đặt / NCC hẹn / đã về
                    </h3>
                  </div>
                  <XacNhanTheoDongGrid
                    lines={trackLines}
                    status={p.statusLines}
                    shipments={p.shipments}
                    po={po}
                  />
                </>
              )}
              <div className="px-[var(--gutter)] pt-3">
                <h3 className="k-fgrp-h">Kế hoạch giao · NCC hẹn</h3>
              </div>
              <DotGiaoGrid
                shipments={p.shipments}
                linesById={shipLinesById}
                currency={po.currency}
                receivedByLine={new Map(p.statusLines.map((s) => [s.id, s.qty_received ?? 0]))} // prettier-ignore
                linkedReceipts={new Map(Object.entries(p.shipmentReceipts).map(([sid, per]) => [sid, new Map(Object.entries(per))]))} // prettier-ignore
                confirmedNote={po.confirmed_note}
                emptyHint={shipmentEmptyHint(po.status, shipLines.length > 0)}
                canAct={perms.canEdit && !drafting}
                busy={busy}
                today={today}
                onArrived={(id) => void shipmentAct(id, { action: 'arrived' }, 'Đã ghi nhận xe tới')} // prettier-ignore
                onReschedule={(s) => setDot({ kind: 'reschedule', s })}
                onCancel={(s) => setDot({ kind: 'cancel', s })}
                onEdit={(s) => setDot({ kind: 'edit', s })}
                onSplit={(s) => setDot({ kind: 'split', s })}
              />
              {/* Bày sổ theo DÒNG từ lúc đơn rời tay mình, không đợi Kho lập
                    phiếu đầu tiên. Bản trước gác bằng `receiptBatches.length > 0`
                    nên đúng lúc cần nhất — NCC báo hết một mã mà chưa về gì —
                    thì bảng không hiện, và người mua chỉ còn nút chốt CẢ ĐƠN. */}
              {(p.receiptBatches.length > 0 || sentToSupplier) && (
                <>
                  <div className="px-[var(--gutter)] pt-3">
                    <h3 className="k-fgrp-h">
                      {p.receiptBatches.length > 0
                        ? 'Nhận theo đợt · sổ thực nhận của Kho'
                        : 'Theo dòng · Kho chưa lập phiếu nhập nào'}
                    </h3>
                  </div>
                  <NhanTheoDotGrid
                    batches={p.receiptBatches}
                    lines={p.lines.flatMap((l) => (l.id ? [{ id: l.id, code: l.material_code, name: l.material_name, unit: l.material_unit, qty_ordered: l.qty_ordered }] : []))} // prettier-ignore
                    status={p.statusLines}
                    poStatus={po?.status ?? 'draft'}
                    canEdit={perms.canEdit}
                    busy={busy}
                    onCloseShort={(l) => start(closeShortAct(l))}
                    onReopen={(l) => start(reopenAct(l))}
                  />
                </>
              )}
              <div className="px-[var(--gutter)] pt-3">
                <h3 className="k-fgrp-h">
                  Lịch sử hẹn giao · đề nghị → NCC cam kết → dời → thực nhận
                </h3>
              </div>
              <SoHenGiaoGrid
                commits={p.tracking?.commits ?? []}
                receipts={p.warehouseDocs.filter((d) => d.kind === 'receipt').map((d) => ({ code: d.code, at: d.at, qty_total: d.qty_total }))} // prettier-ignore
                linesById={trackById}
                currentEarliest={earliestExpectedDate(p.shipments)}
              />
              <div className="flex items-center gap-2 px-[var(--gutter)] pt-3" id="su-co">
                <h3 className="k-fgrp-h grow">
                  Sự cố giao hàng · {openIssues} đang mở /{' '}
                  {(p.tracking?.issues ?? []).length}
                </h3>
                <GridBtn
                  disabled={busy || !p.canIssue || !sentToSupplier}
                  title={!p.canIssue ? 'Chỉ Cung ứng hoặc Kho ghi sự cố được' : !sentToSupplier ? 'Đơn chưa gửi NCC — chưa có gì giao' : 'Hàng sai quy cách, thiếu, dư, hỏng, giao trễ'} // prettier-ignore
                  onClick={() => setSuCoOpen(true)}
                >
                  + Ghi sự cố
                </GridBtn>
              </div>
              <SuCoGrid
                issues={p.tracking?.issues ?? []}
                linesById={trackById}
                canEdit={!!p.canIssue}
                onResolve={(i) => setSuCoClose(i)}
              />
              {openShortLines > 0 && missingTotal <= 1e-6 && (
                <div className="text-k-sm px-[var(--gutter)] pt-2 text-[var(--ink-2)]">
                  {openShortLines} dòng đã về thiếu. NCC không giao nữa thì bấm “Chốt
                  thiếu” ở bảng theo dòng phía trên, rồi tạo đơn bổ sung (cùng hoặc khác
                  NCC) cho phần đã chốt.
                </div>
              )}
              {(missingTotal > 1e-6 || (p.links?.supplements.length ?? 0) > 0) && (
                <>
                  <div className="flex items-center gap-2 px-[var(--gutter)] pt-3">
                    <h3 className="k-fgrp-h grow">
                      Đơn bổ sung phần thiếu · {p.links?.supplements.length ?? 0}
                    </h3>
                    {missingTotal > 1e-6 && (
                      <GridBtn
                        disabled={!perms.canEdit}
                        title={perms.canEdit ? 'Mồi sẵn đơn mới = phần còn thiếu của từng dòng; đổi NCC khác được ngay trên màn' : 'Chỉ người phụ trách đơn tạo đơn bổ sung được'} // prettier-ignore
                        onClick={() => router.push(`/mua-hang/don/moi?bo-sung=${po.id}`)}
                      >
                        + Tạo đơn bổ sung phần đã chốt thiếu
                      </GridBtn>
                    )}
                  </div>
                  <div className="text-k-sm flex flex-wrap gap-2 px-[var(--gutter)] pb-2">
                    {(p.links?.supplements ?? []).length === 0 ? (
                      <span className="text-[var(--ink-2)]">
                        Đã chốt thiếu {fmtNum(missingTotal)} (cộng các dòng) — chưa có đơn
                        bổ sung nào.
                      </span>
                    ) : (
                      (p.links?.supplements ?? []).map((x) => (
                        <GridBtn
                          key={x.id}
                          onClick={() => router.push(`/mua-hang/don/${x.id}`)}
                        >
                          {x.code} · {PO_STATUS_LABEL[x.status as PoStatus] ?? x.status}
                        </GridBtn>
                      ))
                    )}
                  </div>
                </>
              )}
              <div className="px-[var(--gutter)] pt-3" id="kho">
                <h3 className="k-fgrp-h">
                  Chứng từ kho · {p.warehouseDocs.length} phiếu
                </h3>
              </div>
              {p.warehouseDocs.length > 0 ? (
                <ChungTuKhoGrid docs={p.warehouseDocs} />
              ) : (
                <div className="text-k-sm px-[var(--gutter)] pb-3 text-[var(--ink-2)]">
                  Chưa có phiếu nhập hay xuất trả nào ghi vào đơn này.
                </div>
              )}
            </>
          )}
        </FastTab>
      )}
    </>
  )
  const blkChiPhi = (
    <>
      {/* ══ 1c. CHI PHÍ MUA HÀNG (0211) — phí vận chuyển / bốc xếp của đơn.
            Artboard 11a: sau Giao & nhận, vì phí phát sinh lúc hàng về. */}
      {po && !editing && (
        <FastTab
          // Phiếu đầu tiên vừa ghi thì mở khối ra — defaultOpen chỉ đọc lúc dựng.
          key={costs.length > 0 ? 'chi-phi-co' : 'chi-phi-rong'}
          fixed={viewMode}
          id="chi-phi"
          title="Chi phí mua hàng"
          flush
          defaultOpen={viewMode || costs.length > 0}
          summary={[
            [
              'Phiếu',
              <span key="a" className="num">
                {costs.length}
              </span>,
            ],
            ['Phần của đơn · chưa VAT', <span key="b" className="num">{money(costShare, po.currency)}</span>], // prettier-ignore
          ]}
          actions={
            <GridBtn
              disabled={busy || !!costWhy}
              title={costWhy ?? 'Ghi phí vận chuyển / bốc xếp cho đơn này'}
              onClick={() => setPhiOpen(true)}
            >
              + Ghi phí
            </GridBtn>
          }
        >
          <ChiPhiGrid
            costs={costs}
            poId={po.id}
            currency={po.currency}
            canRecord={!costWhy}
            onRecord={() => setPhiOpen(true)}
            onVoid={(c) => setPhiVoid(c)}
            onOpenPo={(id) => router.push(`/mua-hang/don/${id}`)}
          />
        </FastTab>
      )}
    </>
  )
  const blkDauDon = (
    <>
      {/* ══ 2. ĐẦU ĐƠN — gấp, nhóm có tên, 3 cột ═══════════════════════ */}
      <FastTab
        key={headOpen ? 'dau-don-mo' : drafting ? 'dau-don-sua' : 'dau-don-xem'}
        id="dau-don"
        /*
            Lúc SỬA, khối này chỉ còn điều khoản + ghi chú (mọi ô đầu đơn đã lên
            dải trên), nên gọi nó "Đầu đơn" là sai tên và dải tóm tắt NCC/Lệnh/
            Hạn giao lặp y nguyên thứ vừa hiện cách đó hai dòng. Lúc ĐỌC thì khối
            này đúng là cả đầu đơn, giữ nguyên tên và tóm tắt.
          */
        title={drafting ? 'Điều khoản & ghi chú' : 'Đầu đơn'}
        defaultOpen={drafting || headOpen}
        flush
        summary={
          drafting
            ? []
            : [
                ['NCC', po?.supplier_name ?? supplierOpt?.name ?? '—'],
                ['Lệnh', <span key="l" className="num">{po?.lsx_code ?? lsx?.code ?? 'ngoài LSX'}</span>], // prettier-ignore
                ['Hạn giao', header.expectedAt ? <span key="h" className={`num ${header.expectedAt < today ? 'k-t-stop' : ''}`}>{dmy(header.expectedAt)}</span> : <span key="h" className="k-t-warn">chưa có</span>], // prettier-ignore
                ['Mẫu', meta.label],
              ]
        }
      >
        {/* Ba nhom nay CHI hien khi DOC don: luc sua, moi o cua chung
              da nam tren DAI DAU DON o dau luoi. Hai cho sua cung mot o
              la nguoi dung phai tu hoi cho nao moi that. */}
        {!drafting && (
          <>
            <FieldGroup title="Chung">
              {drafting ? (
                <>
                  {/* Mẫu đơn / Loại đơn / Lệnh / NCC KHÔNG lặp lại ở đây khi đang
                    sửa — chúng đã ở DẢI QUYẾT ĐỊNH trên đầu lưới. Hai chỗ sửa
                    cùng một ô là người dùng phải tự hỏi chỗ nào mới thật. Lúc
                    ĐỌC (không sửa) thì vẫn hiện đủ ở đây, vì khi đó không có
                    dải nào cả. */}
                  {header.poType === 'lsx' && (
                    <Field label="Gộp thêm lệnh">
                      <span className="flex flex-wrap items-center gap-1">
                        {header.extraLsxIds.map((id) => (
                          <GridBtn
                            key={id}
                            title="Bỏ lệnh này khỏi đơn"
                            onClick={() => toggleExtraLsx(id, false)}
                          >
                            {p.lsxs.find((l) => l.id === id)?.code ?? '?'} ×
                          </GridBtn>
                        ))}
                        <span className="min-w-[180px]">
                          <Combobox
                            label="Gộp thêm lệnh"
                            value=""
                            onChange={(v) => v && toggleExtraLsx(v, true)}
                            emptyLabel={header.extraLsxIds.length ? '+ thêm lệnh nữa' : '— một đơn mua cho nhiều lệnh —'} // prettier-ignore
                            placeholder="Gõ số lệnh hoặc tên khách…"
                            options={lsxOptions.filter((o) => o.value !== header.lsxId && !header.extraLsxIds.includes(o.value))} // prettier-ignore
                          />
                        </span>
                      </span>
                    </Field>
                  )}
                  <Field label="Số hợp đồng">
                    <TextInput
                      label="Số hợp đồng"
                      value={header.contractNo}
                      onCommit={(v) => setHeader((h) => ({ ...h, contractNo: v }))}
                      mono
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Mẫu đơn">{meta.label}</Field>
                  <Field label="Nhà cung cấp">{po?.supplier_name}</Field>
                  <Field label="Lệnh sản xuất">
                    <span className="num">{po?.lsx_code ?? 'Ngoài LSX'}</span>
                  </Field>
                  <Field label="Đơn khách">
                    <span className="num">{po?.order_code ?? '—'}</span>
                  </Field>
                  <Field label="Người phụ trách">
                    {po?.assignee_name ?? 'chưa giao ai'}
                  </Field>
                  <Field label="Ngày đặt">
                    <span className="num">{dmy(po?.created_at)}</span>
                  </Field>
                  {/* Số hợp đồng in lên phiếu nên nó thuộc bộ "chữ trên phiếu",
                    sửa được cả khi đơn đã gửi — kế toán hay đòi ghi số HĐ sau. */}
                  <Field label="Số hợp đồng">
                    {termsEdit ? (
                      <TextInput
                        label="Số hợp đồng"
                        value={header.contractNo}
                        onCommit={(v) => setHeader((h) => ({ ...h, contractNo: v }))}
                        mono
                      />
                    ) : (
                      <span className="num">{po?.contract_no ?? '—'}</span>
                    )}
                  </Field>
                </>
              )}
            </FieldGroup>
            <FieldGroup title="Giao hàng">
              {drafting /* Hạn giao nằm trên DẢI QUYẾT ĐỊNH ở đầu lưới — không lặp ở đây. */ ? null : (
                <Field
                  label="Hạn giao"
                  tone={
                    po?.expected_at && po.expected_at.slice(0, 10) < today
                      ? 'stop'
                      : undefined
                  }
                >
                  <span className="num">{dmy(po?.expected_at) || '—'}</span>
                </Field>
              )}
              <Field label="Thời gian giao của NCC" inherited>
                <span className="num">
                  {supplierOpt?.lead_time_days != null
                    ? `${supplierOpt.lead_time_days} ngày`
                    : '—'}
                </span>
              </Field>
            </FieldGroup>
            <FieldGroup title="Giá &amp; thuế">
              {drafting ? (
                <>
                  <Field label="Tiền tệ">
                    <Pick
                      label="Tiền tệ"
                      value={header.currency}
                      onChange={(v) => {
                        dirty.current.currency = true
                        setHeader((h) => ({ ...h, currency: v }))
                      }}
                      options={PO_CURRENCIES.map((c) => ({ value: c, label: c }))}
                    />
                  </Field>
                  <Field label="Thuế suất %">
                    <NumInput
                      aria-label="Thuế suất"
                      value={numStr(header.vat)}
                      onCommit={(v) => setHeader((h) => ({ ...h, vat: toNum(v) }))}
                    />
                  </Field>
                  <Field label="Giá đã gồm VAT">
                    <Tick
                      label="Đơn giá đã gồm VAT"
                      checked={header.inclVat}
                      onChange={(v) => {
                        // Tự tick / bỏ tick = đã tự chỉnh: đổi mẫu sau đó không được áp lại.
                        dirty.current.vat = true
                        setHeader((h) => ({ ...h, inclVat: v }))
                      }}
                    />
                  </Field>
                  {meta.hasDiscount && (
                    <Field label="Chiết khấu">
                      <NumInput
                        aria-label="Chiết khấu"
                        value={numStr(header.discount)}
                        onCommit={(v) => setHeader((h) => ({ ...h, discount: toNum(v) }))}
                      />
                    </Field>
                  )}
                </>
              ) : (
                <>
                  <Field label="Tiền tệ">
                    <span className="num">{po?.currency}</span>
                  </Field>
                  <Field label="Thuế suất">
                    <span className="num">
                      {po?.vat_rate ?? 0}%{po?.price_includes_vat ? ' · giá đã gồm' : ''}
                    </span>
                  </Field>
                  <Field label="Chiết khấu">
                    <span className="num">
                      {po?.discount_amount ? money(po.discount_amount, po.currency) : '—'}
                    </span>
                  </Field>
                </>
              )}
              <Field label="Điều khoản TT của NCC" inherited>
                {supplierOpt?.payment_terms ?? '—'}
              </Field>
            </FieldGroup>
          </>
        )}

        {/* ══ ĐIỀU KHOẢN — nhóm RIÊNG, có tên ═══════════════════════════════
              Năm điều khoản này in nguyên văn lên phiếu gửi NCC, nên chúng là
              một khối nghiệp vụ chứ không phải vài ô lẻ. Bản đầu rải chúng vào
              nhóm "Giao hàng" và "Giá & thuế" dưới nhãn chung chung ("Nơi giao",
              "Thanh toán") — chữ "điều khoản" không xuất hiện ở đâu, nên người
              soạn không tìm ra chỗ ghi (chủ dự án 10/09/2026). */}
        <FieldGroup title="Điều khoản — in lên phiếu gửi NCC">
          {TERM_FIELDS.map(([k, label, hint]) => (
            <Field
              key={k}
              label={label}
              inherited={termsEditing && header.terms[k] === tplTerms[k]}
            >
              {' '}
              {/* prettier-ignore */}
              {termsEditing ? (
                <TextArea
                  aria-label={label}
                  rows={2}
                  placeholder={hint}
                  value={header.terms[k]}
                  onChange={(v) => setHeader((h) => ({ ...h, terms: { ...h.terms, [k]: v } }))} // prettier-ignore
                />
              ) : (
                header.terms[k] || '—'
              )}
            </Field>
          ))}
          <Field
            label="Người ký"
            inherited={termsEditing && header.signerRole === tplSigner}
          >
            {termsEditing ? (
              <TextInput
                label="Người ký"
                value={header.signerRole}
                onCommit={(v) => setHeader((h) => ({ ...h, signerRole: v }))}
              />
            ) : (
              (po?.signer_role ?? meta.signerRole)
            )}
          </Field>
          {termsEditing && (
            <div
              style={{ gridColumn: '1 / -1' }}
              className="text-k-sm flex flex-wrap items-center gap-2 pt-1 text-[var(--ink-3)]"
            >
              <GridBtn
                title={`Nạp lại năm điều khoản và người ký theo mẫu ${meta.label.toLowerCase()}`}
                onClick={() => {
                  const d = templateDefaults(template)
                  setHeader((h) => ({ ...h, terms: d.terms, signerRole: d.signerRole }))
                }}
              >
                Lấy lại theo mẫu
              </GridBtn>
              <span>
                Ô nền nhạt là mặc định của mẫu <b>{meta.label}</b> — sửa ở đây chỉ đổi cho
                đơn này.
              </span>
            </div>
          )}
        </FieldGroup>

        <FieldGroup title="Ghi chú đơn">
          {termsEditing ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <TextArea
                value={header.note}
                onChange={(v) => setHeader((h) => ({ ...h, note: v }))}
                rows={3}
                placeholder="Ghi chú nội bộ — nhà cung cấp không thấy"
              />
              {noteOver > 0 && (
                <p className="text-k-sm mt-1 font-semibold text-[var(--stop)]">
                  Dài hơn mức cho phép {noteOver} ký tự — xoá bớt vết cũ ở cuối ghi chú
                  rồi lưu lại.
                </p>
              )}
            </div>
          ) : (
            <div style={{ gridColumn: '1 / -1' }} className="k-note k-note-text">
              {po?.note || 'Không có ghi chú.'}
            </div>
          )}
        </FieldGroup>
      </FastTab>
    </>
  )
  const blkTimeline = (
    <>
      {po && (
        <FastTab
          id="dong-thoi-gian"
          fixed={viewMode}
          title="Dòng thời gian"
          summary={[
            [
              'Mốc',
              <span key="m" className="num">
                {marks.filter((m) => m.at).length}
              </span>,
            ],
          ]}
        >
          <Timeline marks={marks} />
        </FastTab>
      )}
    </>
  )
  const blkTaiLieu = (
    <>
      {po && (
        <FastTab id="tai-lieu" title="Tài liệu đính kèm" fixed={viewMode}>
          <PoDocuments poId={po.id} canEdit={p.perms.isSupply || p.perms.canApprove} />
        </FastTab>
      )}
    </>
  )

  /* ── BỐ CỤC ĐỌC: đầu trang sắp xếp lại (27/09/2026, duyệt theo khuyến nghị) ──
     Mã đơn + việc hay làm CÙNG HÀNG → hàng dữ kiện → thanh trạng thái (bước kế
     tiếp + chuyển trạng thái) → menu. Chuyển trạng thái rời thanh nút về
     `DocStatus` (splitForStatusBar, có test); việc bị khoá không đứng trơ trên
     hàng đầu mà vào "⋯" kèm LÝ DO. */
  const split = bar ? splitForStatusBar(bar) : null
  const toMenu = (xs: { key: BarKey; group: string }[]) =>
    xs.flatMap(({ key, group }) => {
      const it = barItem(key)
      return it ? [{ label: it.label, group, danger: it.danger, why: busy ? 'Đang xử lý việc trước…' : it.blocked, onClick: it.run }] : [] // prettier-ignore
    })
  const headActions = (split?.actions ?? []).flatMap((k) => {
    const it = barItem(k)
    return it && !it.blocked ? [{ key: k, it }] : []
  })
  const headMenu = toMenu([
    ...(split?.actions ?? []).filter((k) => !!barItem(k)?.blocked).map((key) => ({ key, group: 'Đơn' })), // prettier-ignore
    ...(split?.menu ?? []),
  ])
  const nextItem = split?.next ? barItem(split.next) : null
  const statusMoves = toMenu([
    // Bước kế tiếp bị khoá thì không thành nút chính câm — vào đầu menu, kèm lý do.
    ...(split?.next && nextItem?.blocked ? [{ key: split.next, group: 'Đi tiếp' }] : []),
    ...(split?.moves ?? []),
  ])
  const statusTone = track.tone === 'wait' ? 'warn' : track.tone === 'done' ? 'done' : track.tone === 'stop' ? 'stop' : undefined // prettier-ignore
  const daVeDu = po?.status === 'received'
  const lastReceipt = p.warehouseDocs.filter((d) => d.kind === 'receipt').at(-1)
  const hanGiao = po?.expected_at ? po.expected_at.slice(0, 10) : null
  const conNgay = hanGiao ? daysBetween(today, hanGiao) : null
  const giaoSignal = daVeDu
    ? { text: 'đủ', tone: 'done' as const }
    : veKho
      ? { text: `${veKho.du}/${veKho.tong} dòng`, tone: 'warn' as const }
      : undefined
  const finSignal: { text: string; tone?: 'warn' | 'done' } | undefined = !p.finance
    ? undefined
    : (() => {
        const f = poFinanceView({ ordered_gross: totals.grandTotal, received_net: p.finance.received_net, invoiced_net: p.finance.invoiced_net, invoiced_gross: p.finance.invoiced_gross, paid: p.finance.paid, missing_price_lines: p.finance.missing_price_lines }) // prettier-ignore
        return f.stage === 'thieu_gia' ? { text: 'thiếu giá', tone: 'warn' } : f.stage === 'cho_hoa_don' ? { text: 'chờ HĐ', tone: 'warn' } : f.stage === 'con_no' ? { text: 'còn nợ', tone: 'warn' } : f.stage === 'da_tra' ? { text: 'đã trả', tone: 'done' } : undefined // prettier-ignore
      })()
  const mucItems = [
    { id: 'tong-quan', label: 'Tổng quan' },
    { id: 'dong-hang', label: 'Dòng hàng', signal: { text: String(lines.length) } },
    { id: 'giao-nhan', label: 'Giao & nhận', signal: openIssues > 0 ? { text: `${openIssues} sự cố`, tone: 'stop' as const } : giaoSignal }, // prettier-ignore
    { id: 'tai-chinh', label: 'Tài chính', signal: finSignal }, // prettier-ignore
    { id: 'trao-doi', label: 'Trao đổi' },
    { id: 'lich-su', label: 'Tài liệu & lịch sử' },
  ]
  const hanText = hanGiao
    ? `${dmy(hanGiao)}${conNgay == null ? '' : conNgay < 0 ? ` · trễ ${-conNgay} ngày` : conNgay === 0 ? ' · hôm nay' : ` · còn ${conNgay} ngày`}` // prettier-ignore
    : null
  /*
    "VƯỚNG GÌ" Ở TỔNG QUAN — mỗi dòng một chuyện, bấm là sang đúng mục. Chỉ gom
    thứ ĐÃ CÓ nguồn ở màn này (hạn giao, người giữ, đối chiếu, điều chỉnh, bảng
    kiểm) — không bịa cảnh báo mới.
  */
  const finView = p.finance
    ? poFinanceView({ ordered_gross: totals.grandTotal, received_net: p.finance.received_net, invoiced_net: p.finance.invoiced_net, invoiced_gross: p.finance.invoiced_gross, paid: p.finance.paid, missing_price_lines: p.finance.missing_price_lines }) // prettier-ignore
    : null
  const holderDays = holder?.since ? daysBetween(holder.since, today) : null
  const vuong: {
    tag: string
    tone: 'stop' | 'warn' | 'neutral'
    text: string
    muc: MucId
    goLabel: string
  }[] = [
    ...(blockers.length > 0 ? [{ tag: 'Chưa đi tiếp được', tone: 'stop' as const, text: `${blockers.length} lỗi chặn — xem bảng kiểm dưới thanh trạng thái`, muc: 'dong-hang' as const, goLabel: 'Dòng hàng' }] : []), // prettier-ignore
    ...(!daVeDu && sentToSupplier && conNgay != null && conNgay < 0 ? [{ tag: 'Trễ hạn', tone: 'stop' as const, text: `Quá hạn giao ${-conNgay} ngày (hạn ${dmy(hanGiao)}) mà chưa về đủ.`, muc: 'giao-nhan' as const, goLabel: 'Giao & nhận' }] : []), // prettier-ignore
    ...(!daVeDu && sentToSupplier && conNgay != null && conNgay >= 0 && conNgay <= 3 ? [{ tag: 'Sắp hạn', tone: 'warn' as const, text: `Hạn giao ${dmy(hanGiao)} — còn ${conNgay} ngày${liveShipments.length === 0 && p.warehouseDocs.length === 0 ? ', chưa có đợt giao hay phiếu nhập nào' : ''}.`, muc: 'giao-nhan' as const, goLabel: 'Giao & nhận' }] : []), // prettier-ignore
    ...(holder && holder.who !== '—' && holderDays != null && holderDays >= 3 ? [{ tag: 'Nằm im', tone: 'warn' as const, text: `Đang giữ: ${holder.who} — ${holder.what} · đã ${holderDays} ngày.`, muc: 'trao-doi' as const, goLabel: 'Trao đổi' }] : []), // prettier-ignore
    ...(finView?.stage === 'thieu_gia' ? [{ tag: 'Thiếu giá', tone: 'warn' as const, text: `${p.finance?.missing_price_lines} dòng đã về nhưng phiếu nhập chưa có đơn giá — tiền nhận đang tính thiếu.`, muc: 'tai-chinh' as const, goLabel: 'Tài chính' }] : []), // prettier-ignore
    ...(finView?.stage === 'cho_hoa_don' ? [{ tag: 'Chờ HĐ', tone: 'warn' as const, text: `Hàng đã về ${money(finView.waiting_invoice_net, header.currency)} (chưa VAT), NCC chưa xuất hoá đơn.`, muc: 'tai-chinh' as const, goLabel: 'Tài chính' }] : []), // prettier-ignore
    ...(openIssues > 0 ? [{ tag: 'Sự cố', tone: 'stop' as const, text: `${openIssues} sự cố giao hàng đang mở — xử lý với NCC rồi đóng lại.`, muc: 'giao-nhan' as const, goLabel: 'Giao & nhận' }] : []), // prettier-ignore
    ...(notFullyConfirmed > 0 && !daVeDu ? [{ tag: 'Xác nhận thiếu', tone: 'warn' as const, text: `${notFullyConfirmed} dòng NCC chưa hẹn giao đủ số đã đặt.`, muc: 'giao-nhan' as const, goLabel: 'Giao & nhận' }] : []), // prettier-ignore
    ...(unsentAdj ? [{ tag: 'Điều chỉnh', tone: 'warn' as const, text: `Điều chỉnh lần ${unsentAdj.seq} chưa tới NCC — in phiếu gửi lại.`, muc: 'tai-chinh' as const, goLabel: 'Tài chính' }] : []), // prettier-ignore
  ]
  const viewHead = po ? (
    <>
      <DocHead
        compact
        kind="Đơn đặt vật tư"
        code={code}
        sub={
          <>
            soạn {dmy(po.created_at)} · {po.assignee_name ?? '—'}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {termsEdit ? (
            <>
              <Btn
                primary
                icon="luuNhap"
                disabled={busy || noteOver > 0}
                title={noteOver > 0 ? `Ghi chú dài hơn mức cho phép ${noteOver} ký tự` : undefined} // prettier-ignore
                onClick={() => void saveTerms()}
              >
                Lưu điều khoản
              </Btn>
              <Btn icon="huy" disabled={busy} onClick={cancelTermsEdit}>
                Huỷ
              </Btn>
            </>
          ) : (
            <>
              {headActions.map(({ key, it }) => (
                <Btn key={key} icon={it.icon} disabled={busy} onClick={it.run}>
                  {it.label}
                </Btn>
              ))}
              {headMenu.length > 0 && (
                <Menu label="⋯" ariaLabel="Các việc khác của đơn" items={headMenu} />
              )}
            </>
          )}
        </div>
      </DocHead>
      <HeadChips>
        <HeadChip
          label="Nhà cung cấp"
          value={
            p.supplier?.code
              ? `${po.supplier_name} · ${p.supplier.code}`
              : po.supplier_name
          }
          onClick={() => router.push(`/mua-hang/ncc/${po.supplier_id}`)}
        />
        {daVeDu ? (
          <HeadChip
            label="Về đủ"
            value={
              lastReceipt ? `${dmy(lastReceipt.at)} · ${lastReceipt.code}` : 'đã về đủ'
            }
          />
        ) : (
          <HeadChip label="Hạn giao" value={hanText} />
        )}
        <HeadChip
          label="Tổng thanh toán"
          value={money(totals.grandTotal, header.currency)}
        />
        <HeadChip
          label="Lệnh SX"
          value={[po.lsx_code, ...p.extraLsx.map((l) => l.code)].filter(Boolean).join(' + ') || 'ngoài lệnh'} // prettier-ignore
          onClick={po.production_order_id ? () => router.push(`/mua-hang/yeu-cau/${po.production_order_id}`) : undefined} // prettier-ignore
        />
        {p.links?.source && (
          <HeadChip
            label="Bổ sung cho"
            value={p.links.source.code}
            onClick={() => router.push(`/mua-hang/don/${p.links!.source!.id}`)}
          />
        )}
        <HeadChip label="Thanh toán" value={po.terms_payment} muted />
        <HeadChip label="Nơi giao" value={po.terms_delivery_place} muted />
      </HeadChips>
      <DocStatus
        status={PO_STATUS_LABEL[po.status as PoStatus] ?? po.status}
        icon={STATUS_ICON[po.status as PoStatus] ?? 'thongTin'}
        tone={statusTone}
        marks={marks}
        holder={holder && holder.who !== '—' ? { who: holder.who, what: holder.what, mine: holder.mine, days: holder.since ? daysBetween(holder.since, today) : null } : undefined} // prettier-ignore
        next={
          nextItem && !nextItem.blocked ? (
            <Btn primary icon={nextItem.icon} disabled={busy} onClick={nextItem.run}>
              {nextItem.label}
            </Btn>
          ) : undefined
        }
        moves={statusMoves}
      />
      {blkChecks}
      {blkUnsent}
      <DocBody>
        <DocMenu
          label="Nội dung đơn"
          items={mucItems}
          value={muc}
          onValueChange={pickMuc}
        >
          <DocMenuPanel value="tong-quan">
            <MetricStrip>
              <Metric
                label="Giá trị đặt"
                value={money(totals.grandTotal, header.currency)}
                basis={`${lines.length} dòng · gồm VAT ${header.vat === '' ? 0 : header.vat}%`}
              />
              <Metric
                label="Về kho"
                value={veKho ? `${Math.round(veKho.ratio * 100)}%` : null}
                tone={veKho ? (veKho.ratio >= 1 ? 'done' : undefined) : undefined}
                basis={
                  veKho ? `${veKho.du}/${veKho.tong} dòng vật tư kho` : 'đơn chưa gửi NCC'
                }
              />
              <Metric
                label="Đã có hoá đơn"
                value={
                  p.finance ? money(p.finance.invoiced_gross, header.currency) : null
                }
                basis={
                  p.finance
                    ? `${p.finance.invoices.length} hoá đơn · gồm VAT`
                    : 'chưa tải được'
                }
              />
              <Metric
                label="Đã trả"
                value={p.finance ? money(p.finance.paid, header.currency) : null}
                basis={
                  p.finance
                    ? `${p.finance.payments.length} phiếu chi gắn đơn`
                    : 'chưa tải được'
                }
              />
            </MetricStrip>
            <div className="grid grid-cols-1 border-b border-[var(--line)] md:grid-cols-2">
              <div className="md:border-r md:border-[var(--line)]">
                <FastTab fixed title="Vướng gì" summary={[['Việc', vuong.length]]}>
                  {vuong.length === 0 ? (
                    <div className="text-k-body flex items-center gap-2 text-[var(--ink-2)]">
                      <Tag tone="done">Ổn</Tag> Không có gì vướng ở bước này.
                    </div>
                  ) : (
                    <ul className="m-0 flex list-none flex-col p-0">
                      {vuong.map((v) => (
                        <li
                          key={v.text}
                          className="text-k-body flex items-center gap-2.5 border-t border-[var(--hair)] py-2 first:border-t-0 first:pt-0"
                        >
                          <Tag tone={v.tone}>{v.tag}</Tag>
                          <span className="min-w-0 grow">{v.text}</span>
                          <GridBtn onClick={() => pickMuc(v.muc)}>{v.goLabel} ›</GridBtn>
                        </li>
                      ))}
                    </ul>
                  )}
                </FastTab>
              </div>
              <FastTab fixed title="Nhà cung cấp">
                {nccBody}
              </FastTab>
            </div>
            {blkDauDon}
          </DocMenuPanel>
          <DocMenuPanel value="dong-hang">{blkLines}</DocMenuPanel>
          <DocMenuPanel value="giao-nhan">{blkGiao}</DocMenuPanel>
          <DocMenuPanel value="tai-chinh">
            <TaiChinhPanel
              finance={p.finance ?? null}
              poId={po.id}
              orderedGross={totals.grandTotal}
              lineCount={lines.length}
              vatLabel={`VAT ${header.vat === '' ? 0 : header.vat}%`}
              termsPayment={po.terms_payment}
              termsInvoice={po.terms_invoice}
              canInvoice={!!p.canInvoice}
              onAskInvoice={() => pickMuc('trao-doi')}
              extra={
                <>
                  {blkPhatSinh}
                  {blkChiPhi}
                </>
              }
            />
          </DocMenuPanel>
          <DocMenuPanel value="trao-doi">
            <div id="trao-doi" className="max-w-3xl p-4">
              {notesPanel}
            </div>
          </DocMenuPanel>
          <DocMenuPanel value="lich-su">
            {blkTimeline}
            {blkTaiLieu}
          </DocMenuPanel>
        </DocMenu>
      </DocBody>
    </>
  ) : null

  return (
    <DocScreen dense={dense}>
      <Crumb
        path={[{ label: 'Đơn mua', href: '/mua-hang/don' }, code]}
        position={p.position ? [p.position.index, p.position.total] : undefined}
      />

      {viewMode && po && viewHead}

      {!viewMode && (
        <>
          {/*
        THANH HÀNH ĐỘNG MỘT HÀNG (duyệt 26/09/2026, canvas "Đơn mua — gọn thanh
        nút & Trao đổi"). Bỏ 3 tab Đơn hàng / Nhận hàng / Tài chính (16 + 11 nút,
        tab Tài chính khoá vĩnh viễn, cao 150px): việc kế tiếp của đơn từng nằm ở
        TAB KHÁC với trục trạng thái. Nay nút chính = việc kế tiếp của BƯỚC, ≤ 3
        việc hay làm, còn lại vào "⋯ Thêm" theo nhóm — chỗ đặt do `barLayout`
        (thanh-nut.ts, có test) quyết.
      */}
          <ActionPane>
            {' '}
            {/* prettier-ignore */}
            {termsEdit && !editing ? (
              /* Sửa hẹp: thanh hành động thu về đúng hai nút, để không ai tưởng
             mình đang sửa được cả dòng hàng. */
              <ActionGroup label="Đang sửa điều khoản">
                <Action
                  primary
                  disabled={busy || noteOver > 0}
                  title={noteOver > 0 ? `Ghi chú dài hơn mức cho phép ${noteOver} ký tự` : undefined} // prettier-ignore
                  onClick={() => void saveTerms()}
                >
                  Lưu điều khoản
                </Action>
                <Action icon="huy" disabled={busy} onClick={cancelTermsEdit}>
                  Huỷ
                </Action>
              </ActionGroup>
            ) : editing ? (
              <>
                <ActionGroup label={adjusting ? 'Đang điều chỉnh' : 'Đang sửa'}>
                  {adjusting ? (
                    <Action
                      primary
                      disabled={busy || adjBlocked != null}
                      title={
                        adjBlocked ??
                        'Áp dụng ngay — không duyệt lại; phần chênh ghi thành phát sinh'
                      }
                      onClick={() => setAdjSheet(true)}
                    >
                      Áp dụng điều chỉnh
                    </Action>
                  ) : (
                    <Action
                      primary
                      disabled={busy || !!problem}
                      title={problem ?? undefined}
                      onClick={() => void save()}
                    >
                      {p.mode === 'create' ? 'Tạo đơn' : 'Lưu'}
                    </Action>
                  )}
                  <Action icon="huy" disabled={busy} onClick={askCancelEdit}>
                    Huỷ
                  </Action>
                </ActionGroup>
                {/*
              NHÓM "NHẬP NHANH" ĐÃ BỎ KHỎI ĐÂY (14/09/2026).

              Ba nút của nó là thao tác trên DÒNG, không phải trên chứng từ —
              và hai trong ba ("Dán từ Excel", "Khai vật tư mới") đã nằm sẵn ở
              thanh lưới, ngay trên bảng. Tức thanh hành động đang in lại cùng
              một nút ở chỗ xa bảng hơn.

              Đo trên đơn 17 dòng, khung 694px: thanh hành động cao 201px =
              37% của toàn bộ 542px nằm trên dòng đầu tiên, và chỉ 3/17 dòng
              nhìn thấy được. Bỏ nhóm này trả lại ~108px cho bảng — thứ duy
              nhất người dùng thật sự nhìn.

              Nút thứ ba ("Thêm … còn thiếu của lệnh") chuyển xuống thanh lưới
              cùng hai nút kia: cả ba đều đẻ ra dòng, nên phải đứng cạnh nhau.
            */}
                <ActionGroup label="Kiểm">
                  <Action
                    icon="in"
                    disabled={!p.company}
                    title={
                      p.company
                        ? 'Dựng đúng tờ phiếu sẽ gửi NCC từ bản đang gõ'
                        : 'Trang này chưa nạp đầu phiếu'
                    }
                    onClick={() => setPreview(true)}
                  >
                    {' '}
                    {/* prettier-ignore */}
                    Xem trước phiếu
                  </Action>
                </ActionGroup>
              </>
            ) : bar ? (
              <>
                <ActionGroup label="Bước này">
                  {[bar.primary, ...bar.quick].map((k, i) => {
                    const it = k ? barItem(k) : null
                    return (
                      it && (
                        <Action
                          key={k}
                          primary={i === 0 && k === bar.primary}
                          icon={it.icon}
                          disabled={busy || !!it.blocked}
                          title={it.blocked}
                          onClick={it.run}
                        >
                          {it.label}
                        </Action>
                      )
                    )
                  })}
                </ActionGroup>
                <ActionGroup label="Khác">
                  <Menu
                    label="⋯ Thêm"
                    ariaLabel="Các việc khác của đơn"
                    items={bar.more.flatMap(({ key, group }) => {
                      const it = barItem(key)
                      return it
                        ? [
                            {
                              label: it.label,
                              group,
                              danger: it.danger,
                              why: busy ? 'Đang xử lý việc trước…' : it.blocked,
                              onClick: it.run,
                            },
                          ]
                        : []
                    })}
                  />
                </ActionGroup>
              </>
            ) : null}
          </ActionPane>

          <DocHead
            compact
            kind="Đơn đặt vật tư"
            code={code}
            /*
          NHÃN "ĐANG SỬA" BẮT THEO VIỆC, KHÔNG BẮT THEO "ĐÃ CÓ ĐƠN LƯU".

          Bản cũ viết `po ? (tiêu đề thường) : (<Tag>Đang sửa</Tag>)` — tức nhãn
          chỉ hiện khi CHƯA có đơn nào lưu, nghĩa là chỉ ở màn tạo mới. Sửa một
          đơn nháp ĐÃ LƯU thì `po` có giá trị nên rơi vào nhánh đầu và đầu chứng
          từ trông y hệt lúc đọc: cùng tiêu đề, cùng trục trạng thái, chỉ khác ở
          chỗ các ô đã thành ô nhập. Chủ dự án báo 15/09/2026 "không rõ cảnh báo
          rằng đang trong trạng thái chỉnh sửa" — đúng, và đây là dòng gây ra.
        */
            sub={
              editing ? (
                <>
                  <Tag tone="warn">
                    {adjusting
                      ? `Đang điều chỉnh lần ${nextSeq} · chưa áp dụng`
                      : p.mode === 'create'
                        ? 'Đang tạo · chưa lưu'
                        : 'Đang sửa · chưa lưu'}
                  </Tag>{' '}
                  {po?.supplier_name ?? supplierOpt?.name ?? 'chưa chọn nhà cung cấp'}
                </>
              ) : (
                <>
                  {po?.supplier_name} · soạn {dmy(po?.created_at)} bởi{' '}
                  {po?.assignee_name ?? '—'}
                </>
              )
            }
          >
            {po && (
              <>
                {/*
              MỐC THẬT CHO TỪNG BƯỚC — xem `marks` ở `StatusTrack`.

              Ba bước có cột lưu mốc (`approved_at`, `ordered_at`,
              `confirmed_at`); trống nghĩa là bước đó chưa từng chạy, và dải
              phải nói ra thay vì tick xanh. Hai bước "Chờ duyệt" và "Đang
              giao" không có cột nào — truyền `undefined` để dải không kết luận
              gì về chúng, đúng hơn là bịa ra một dấu ✓ hay một dấu hỏi.
            */}
                <StatusTrack
                  label="Trạng thái đơn"
                  steps={[...PO_TRACK_STEPS]}
                  at={track.at}
                  tone={track.tone}
                  marks={[
                    dmy(po.created_at),
                    undefined,
                    po.approved_at ? dmy(po.approved_at) : null,
                    po.ordered_at ? dmy(po.ordered_at) : null,
                    po.confirmed_at ? dmy(po.confirmed_at) : null,
                    undefined,
                  ]}
                  terminal={track.terminal}
                />
                <StatusTrack
                  label="Nhận hàng"
                  steps={['Chưa', 'Một phần', 'Đủ']}
                  at={recvIdx}
                  tone={receiptTrackTone(recvIdx)}
                />
                {/* VỀ ĐƯỢC BAO NHIÊU — con số, không phải ba cái chip.

                Trục "Nhận hàng" chỉ nói Chưa / Một phần / Đủ. "Một phần" là 1
                trong 4 dòng hay 39 trong 40 dòng thì cũng cùng một chữ, mà hai
                tình huống đó quyết định khác hẳn nhau: một cái phải gọi NCC
                ngay, một cái chờ nốt là xong. Chủ dự án hỏi đúng câu này —
                "có về hàng chưa, về được bao nhiêu".

                Đếm theo DÒNG chứ không theo số lượng cộng dồn: cộng 1.950 cái
                nút với 8.504 con sò ra một con số vô nghĩa. Dòng đã chốt thiếu
                tính là xong, cùng luật với `qty_open` mà sổ kho dùng. */}
                {veKho && (
                  <div>
                    <div className="k-track-lab">Về kho</div>
                    <CoverageBar
                      ratio={veKho.ratio}
                      label={`${veKho.du}/${veKho.tong} dòng`}
                    />
                  </div>
                )}
              </>
            )}
          </DocHead>

          {/* Nút thông minh — chép Odoo. Số đếm là lời hứa: bấm ra đúng chừng ấy. */}
          {po && (
            <SmartLinks
              items={[
                { label: 'đợt giao', count: liveShipments.length, onClick: () => goTo('dot-giao'), title: 'Kế hoạch giao NCC hẹn' }, // prettier-ignore
                { label: 'phiếu kho', count: p.warehouseDocs.length, onClick: () => goTo('kho'), title: 'Phiếu nhập / trả đã ghi vào đơn' }, // prettier-ignore
                ...(costs.length > 0 ? [{ label: 'phiếu phí', count: costs.length, onClick: () => goTo('chi-phi'), title: 'Phí vận chuyển / bốc xếp gắn đơn này (kể cả phiếu đã huỷ)' }] : []), // prettier-ignore
                { label: 'lệnh SX', count: (po.production_order_id ? 1 : 0) + p.extraLsx.length, onClick: () => po.production_order_id && router.push(`/mua-hang/yeu-cau/${po.production_order_id}`), disabled: !po.production_order_id }, // prettier-ignore
                { label: 'trao đổi', count: null, onClick: () => goTo('trao-doi'), title: 'Ghi chú và mốc máy ghi trên đơn này' }, // prettier-ignore
                { label: 'tài liệu', count: null, onClick: () => goTo('tai-lieu'), title: 'Báo giá, hợp đồng, chứng từ giao nhận' }, // prettier-ignore
              ]}
            />
          )}

          {holder && !editing && (
            <HolderBar
              mine={holder.mine}
              who={holder.who}
              what={holder.what}
              age={holder.since ? `${daysBetween(holder.since, today)} ngày` : undefined}
            />
          )}
          {blkChecks}
          {drafting && p.sourcePo && (
            <NoticeBar tone="warn" tag="Đơn bổ sung">
              Bổ sung cho <b>{p.sourcePo.code}</b> — dòng mồi sẵn là phần NCC còn giao
              thiếu. Đổi nhà cung cấp được ở Đầu đơn nếu NCC cũ không giao nổi.
            </NoticeBar>
          )}
          {drafting && moqWarn && (
            <NoticeBar tone="warn" tag="MOQ">
              {moqWarn}
            </NoticeBar>
          )}
          {drafting && savedDraft && (
            <NoticeBar
              tone="warn"
              tag="Bản nháp"
              action={{ label: 'Khôi phục', onClick: () => restoreDraft(savedDraft) }}
            >
              Có bản gõ dở tự lưu lúc{' '}
              <b className="num">{new Date(savedDraft.at).toLocaleString('vi-VN')}</b> (
              {savedDraft.lines.length} dòng).{' '}
              <GridBtn
                onClick={() => {
                  clearDraft(draftKey)
                  setSavedDraft(null)
                }}
              >
                Bỏ bản nháp
              </GridBtn>
            </NoticeBar>
          )}
          {/* THANH ĐANG SỬA — CÓ MẶT SUỐT chế độ sửa, không chỉ khi có lỗi.

          Bản cũ chỉ bày thanh này khi đơn còn thiếu thông tin. Nghĩa là đơn khai
          ĐÚNG và ĐỦ thì tuyệt nhiên không có dòng nào nói người dùng đang sửa dở
          — đúng lúc nguy hiểm nhất, vì lúc đó nút Lưu mở và mọi thứ trông như
          màn đọc bình thường.

          Nay một thanh, hai trạng thái: còn vướng thì nói vướng gì và chỉ tới ô;
          hết vướng thì nói "còn thay đổi chưa lưu" và cho Lưu ngay tại chỗ. Nút
          Lưu trên thanh hành động vẫn còn — người dùng cuộn xuống giữa lưới 40
          dòng thì thanh này là chỗ gần tay nhất. */}
          {adjusting &&
            adjPlan &&
            (adjBlocked ? (
              <NoticeBar
                tone="warn"
                tag={
                  adjPlan.changes.length === 0 && !adjPlan.headerChanges
                    ? 'Chưa có thay đổi'
                    : 'Chưa áp dụng được'
                }
                action={{ label: 'Xem dòng hàng', onClick: () => goTo('dong-hang') }}
              >
                {adjBlocked}
                {adjErrors.length > 1 ? ` · và ${adjErrors.length - 1} vướng nữa` : ''}
              </NoticeBar>
            ) : (
              <NoticeBar
                tone="warn"
                tag={`Đang điều chỉnh · lần ${nextSeq}`}
                action={{ label: 'Áp dụng', onClick: () => setAdjSheet(true) }}
              >
                Phát sinh{' '}
                <b className="num">{signed(adjPlan.delta.total, header.currency)}</b> so
                với bản đang chạy — áp dụng ngay, không duyệt lại;{' '}
                {notifyWho
                  ? `${notifyWho} nhận thông báo`
                  : 'bạn là người đã duyệt đơn này nên không báo ai'}
                . Tới lúc bấm Áp dụng, Kho vẫn nhận theo bản cũ.
              </NoticeBar>
            ))}
          {blkUnsent}
          {drafting &&
            (problem ? (
              <NoticeBar
                tone="warn"
                tag="Chưa lưu được"
                action={{
                  label: /nhà cung cấp|lệnh|LSX|mẫu/i.test(problem)
                    ? 'Tới ô cần điền'
                    : 'Xem dòng hàng',
                  onClick: () => goToProblem(problem),
                }}
              >
                {problem}. Sửa xong thì nút Lưu tự mở.
              </NoticeBar>
            ) : (
              <NoticeBar
                tone="warn"
                tag="Đang sửa"
                action={{ label: busy ? 'Đang lưu…' : 'Lưu', onClick: () => void save() }}
              >
                {p.mode === 'create'
                  ? 'Đơn chưa được tạo — rời trang là mất.'
                  : 'Thay đổi chưa lưu. Rời trang khi chưa lưu thì đơn giữ nguyên bản cũ.'}
              </NoticeBar>
            ))}
        </>
      )}

      {!viewMode && (
        <DocBody
          wideAside={!!po}
          aside={
            <FactBox>
              <FactSection title="Tiền">
                <FactKv rows={moneyRows} />
              </FactSection>
              <FactSection title="Nhà cung cấp">{nccBody}</FactSection>
              {/*
              TRAO ĐỔI Ở CỘT PHẢI (duyệt 26/09/2026 — chép chatter Odoo 17). Trước
              đó là khối gập thứ 6 ở thân, đỉnh y≈981: mở đơn ra không thấy ai đã
              nói gì, và cả hệ thống mới có 1 ghi chú. Mở sẵn lọc "Ghi chú" — mốc
              máy đã có khối "Dòng thời gian" riêng. "Gửi nhà cung cấp" đổi thành
              "Đã báo NCC · ghi lại": hệ thống KHÔNG gửi gì cho NCC, nhãn cũ nói sai.
            */}
              {po && (
                <div id="trao-doi">
                  <FactSection title="Trao đổi">{notesPanel}</FactSection>
                </div>
              )}
            </FactBox>
          }
        >
          {/* ══ 0. ĐẦU ĐƠN — ba nhóm, xếp CỘT, dùng lưới nhãn–giá trị của kit ══
            Vì sao nó ở TRÊN lưới: gần như ô nào ở đây cũng là ĐIỀU KIỆN của lưới
            — mẫu đơn quyết định lưới có cột nào, lệnh quyết định "Thêm còn
            thiếu" lấy nhu cầu ở đâu, NCC quyết định tiền tệ và giá gợi ý, thuế
            quyết định số ở chân lưới. Để dưới lưới thì gõ xong 20 dòng mới biết
            chọn nhầm mẫu.

            Vì sao KHÔNG còn là dải ngang tự chế (bản 15/09 đầu): mười ô nhãn-trên
            điều-khiển-dưới, mỗi ô một bề rộng, thả vào `flex-wrap` thì không cột
            nào thẳng cột nào và nhóm bị thụt bậc khi bẻ dòng — chủ dự án nói đúng
            là "rất rối, không ngăn nắp gì cả". Kit đã có sẵn thứ cần: `.k-fields`
            là lưới NHÃN–GIÁ TRỊ căn cột nghiêm ngặt, chính là "dày nhưng có kỷ
            luật căn chỉnh" mà sổ thiết kế đòi. Dựng tay một cái thứ hai kém hơn
            là tự chuốc.

            Ba nhóm xếp thành BA CỘT (không xếp chồng như khối "Đầu đơn" cũ) nên
            cao đúng 4 hàng, vẫn còn nguyên chỗ cho lưới. Mỗi nhóm bọc một lớp
            `div` riêng để luật `.k-fgrp + .k-fgrp` không kẻ vạch ngang giữa các
            cột. Nền TRẮNG — xem ghi chú ở `.k-gbar`: dưới nó là thanh công cụ rồi
            tới hàng tiêu đề cột, ba dải cùng tô là một mảng xám câm. */}
          {adjusting && adjPlan && po && (
            <div className="grid grid-cols-1 gap-x-4 border-b border-[var(--line)] bg-[var(--surface-card)] md:grid-cols-2">
              <div>
                <FieldGroup title="Chênh lệch so với bản đang chạy">
                  <Field label="Tổng đang chạy">
                    <span className="num">
                      {money(adjPlan.money.before.grandTotal, header.currency)}
                    </span>
                  </Field>
                  <Field label="Tổng sau điều chỉnh">
                    <span className="num">
                      {money(adjPlan.money.after.grandTotal, header.currency)}
                    </span>
                  </Field>
                  <Field label={`Phát sinh lần ${nextSeq}`}>
                    <b className="num">{signed(adjPlan.delta.total, header.currency)}</b>
                  </Field>
                  <Field label="Tiền hàng: vì giá · vì lượng">
                    <span
                      className="num"
                      title="vì giá = SL mới × (giá mới − giá cũ) · vì lượng = (SL mới − SL cũ) × giá cũ"
                    >
                      {signed(adjPlan.delta.byPrice, header.currency)} ·{' '}
                      {signed(adjPlan.delta.byQty, header.currency)}
                    </span>
                  </Field>
                </FieldGroup>
              </div>
              <div>
                <FieldGroup title="Giữ nguyên khi điều chỉnh">
                  <Field label="Nhà cung cấp" inherited>
                    {po.supplier_name}
                  </Field>
                  <Field label="Lệnh · mẫu · tiền tệ" inherited>
                    <span className="num">{po.lsx_code ?? 'ngoài LSX'}</span> ·{' '}
                    {meta.label} · {po.currency}
                  </Field>
                  <Field label="Thuế suất %">
                    <NumInput
                      aria-label="Thuế suất"
                      value={numStr(header.vat)}
                      onCommit={(v) => setHeader((h) => ({ ...h, vat: toNum(v) }))}
                    />
                  </Field>
                  {meta.hasDiscount && (
                    <Field label="Chiết khấu">
                      <NumInput
                        aria-label="Chiết khấu"
                        value={numStr(header.discount)}
                        onCommit={(v) => setHeader((h) => ({ ...h, discount: toNum(v) }))}
                      />
                    </Field>
                  )}
                </FieldGroup>
                <div className="text-k-label px-[var(--gutter)] pb-2 text-[var(--ink-3)]">
                  Đổi nhà cung cấp thì Huỷ đơn rồi Nhân bản sang NCC mới. Điều khoản in
                  lên phiếu sửa bằng “Sửa điều khoản”.
                </div>
              </div>
            </div>
          )}
          {drafting && (
            <div className="grid grid-cols-1 gap-x-4 border-b border-[var(--line)] bg-[var(--surface-card)] md:grid-cols-2 xl:grid-cols-3">
              <div>
                <FieldGroup title="Đặt cho lệnh nào">
                  <Field label="Mẫu đơn">
                    <Pick
                      label="Mẫu đơn"
                      value={template}
                      onChange={(t) => {
                        dirty.current.template = true
                        changeTemplate(t as PoTemplate)
                      }}
                      options={Object.values(PO_TEMPLATE_META).map((m) => ({ value: m.key, label: m.label }))} // prettier-ignore
                    />
                  </Field>
                  <Field label="Loại đơn">
                    <Pick
                      label="Loại đơn"
                      value={header.poType}
                      onChange={(v) =>
                        setHeader((h) => ({
                          ...h,
                          poType: v as PoHeader['poType'],
                          lsxId: v === 'standalone' ? '' : h.lsxId,
                        }))
                      }
                      options={[
                        { value: 'lsx', label: 'Theo lệnh sản xuất' },
                        { value: 'standalone', label: 'Ngoài lệnh (mua bù tồn)' },
                      ]}
                    />
                  </Field>
                  <Field label="Lệnh sản xuất">
                    {/* Ô bắt buộc mà còn trống thì NÓI NGAY TẠI Ô, không bắt người
                      dùng đọc dải vàng đầu trang rồi tự đoán ô nào. Chữ nằm cùng
                      hàng với ô chọn nên không tốn thêm chiều cao. */}
                    <span className="flex items-center gap-2">
                      <Combobox
                        label="Lệnh sản xuất"
                        disabled={header.poType !== 'lsx'}
                        value={header.lsxId}
                        onChange={(v) => setHeader((h) => ({ ...h, lsxId: v }))}
                        emptyLabel="— chọn lệnh —"
                        placeholder="Gõ số lệnh hoặc tên khách…"
                        options={lsxOptions}
                      />
                      {header.poType === 'lsx' && !header.lsxId && (
                        <span className="k-t-warn text-k-label shrink-0 whitespace-nowrap">
                          bắt buộc
                        </span>
                      )}
                    </span>
                  </Field>
                  {header.poType === 'lsx' && (
                    <Field label="Gộp thêm lệnh">
                      <span className="flex flex-wrap items-center gap-1">
                        {header.extraLsxIds.map((id) => (
                          <GridBtn
                            key={id}
                            title="Bỏ lệnh này khỏi đơn"
                            onClick={() => toggleExtraLsx(id, false)}
                          >
                            {p.lsxs.find((l) => l.id === id)?.code ?? '?'} ×
                          </GridBtn>
                        ))}
                        <Combobox
                          label="Gộp thêm lệnh"
                          value=""
                          onChange={(v) => v && toggleExtraLsx(v, true)}
                          emptyLabel={header.extraLsxIds.length ? '+ thêm lệnh nữa' : '— một đơn, nhiều lệnh —'} // prettier-ignore
                          placeholder="Gõ số lệnh…"
                          options={lsxOptions.filter((o) => o.value !== header.lsxId && !header.extraLsxIds.includes(o.value))} // prettier-ignore
                        />
                      </span>
                    </Field>
                  )}
                </FieldGroup>
              </div>

              <div>
                <FieldGroup title="Đặt của ai">
                  <Field label="Nhà cung cấp">
                    <span className="flex items-center gap-2">
                      <Combobox
                        label="Nhà cung cấp"
                        value={header.supplierId}
                        onChange={(v) => {
                          const s = p.suppliers.find((x) => x.id === v)
                          setHeader((h) => ({
                            ...h,
                            supplierId: v,
                            // Tiền tệ theo NCC (gỗ báo USD) — trừ khi đã tự chọn.
                            currency: !dirty.current.currency && s?.currency ? s.currency.toUpperCase() : h.currency, // prettier-ignore
                          }))
                          // Mẫu theo đơn gần nhất của NCC (kéo theo VAT / "giá gồm VAT"
                          // của mẫu đó) — chỉ khi đơn mới và người soạn chưa tự chọn mẫu.
                          const t = templateForSupplier({ supplierId: v, current: template, touched: dirty.current.template, isNew: !po, last: p.lastTemplates ?? {} }) // prettier-ignore
                          if (t) {
                            changeTemplate(t)
                            toast.info(`Mẫu đơn: ${PO_TEMPLATE_META[t].label}`, 'Theo đơn gần nhất của NCC này — đổi được ở ô "Mẫu đơn".') // prettier-ignore
                          }
                        }}
                        emptyLabel="— chọn NCC —"
                        placeholder="Gõ tên nhà cung cấp…"
                        options={supplierOptions}
                      />
                      {!header.supplierId && (
                        <span className="k-t-warn text-k-label shrink-0 whitespace-nowrap">
                          bắt buộc
                        </span>
                      )}
                      {supplierOpt?.can_order === false && (
                        <span
                          className="k-t-stop text-k-label shrink-0 whitespace-nowrap"
                          title={supplierOpt.lock_reason ?? undefined}
                        >
                          đang khoá đặt hàng
                        </span>
                      )}
                    </span>
                  </Field>
                  <Field label="Số hợp đồng">
                    <TextInput
                      label="Số hợp đồng"
                      value={header.contractNo}
                      onCommit={(v) => setHeader((h) => ({ ...h, contractNo: v }))}
                      mono
                    />
                  </Field>
                  <Field label="Hạn giao">
                    <DateInput
                      label="Hạn giao"
                      value={header.expectedAt}
                      onChange={(v) => setHeader((h) => ({ ...h, expectedAt: v }))}
                    />
                  </Field>
                  <Field label="Thời gian giao của NCC" inherited>
                    <span className="num">
                      {supplierOpt?.lead_time_days != null
                        ? `${supplierOpt.lead_time_days} ngày`
                        : '—'}
                    </span>
                  </Field>
                </FieldGroup>
              </div>

              <div>
                <FieldGroup title="Tính tiền thế nào">
                  <Field label="Tiền tệ">
                    <Pick
                      label="Tiền tệ"
                      value={header.currency}
                      onChange={(v) => {
                        dirty.current.currency = true
                        setHeader((h) => ({ ...h, currency: v }))
                      }}
                      options={PO_CURRENCIES.map((c) => ({ value: c, label: c }))}
                    />
                  </Field>
                  <Field label="Thuế suất %">
                    <NumInput
                      aria-label="Thuế suất"
                      value={numStr(header.vat)}
                      onCommit={(v) => setHeader((h) => ({ ...h, vat: toNum(v) }))}
                    />
                  </Field>
                  <Field label="Giá đã gồm VAT">
                    <Tick
                      label="Đơn giá đã gồm VAT"
                      checked={header.inclVat}
                      onChange={(v) => {
                        // Tự tick / bỏ tick = đã tự chỉnh: đổi mẫu sau đó không được áp lại.
                        dirty.current.vat = true
                        setHeader((h) => ({ ...h, inclVat: v }))
                      }}
                    />
                  </Field>
                  {meta.hasDiscount && (
                    <Field label="Chiết khấu">
                      <NumInput
                        aria-label="Chiết khấu"
                        value={numStr(header.discount)}
                        onCommit={(v) => setHeader((h) => ({ ...h, discount: toNum(v) }))}
                      />
                    </Field>
                  )}
                  <Field label="Điều khoản TT của NCC" inherited>
                    {supplierOpt?.payment_terms ?? '—'}
                  </Field>
                </FieldGroup>
              </div>

              {/* Nút của chính bộ kit, không phải <button> tự vẽ: cổng
                `hg/no-raw-control` chặn thẻ thô, mà gợi ý của nó
                (shadcn/button) sẽ TRỘN hai hệ token trong cùng một file. */}
              <div className="col-span-full flex justify-end border-t border-[var(--hair)] px-[var(--gutter)] py-1">
                <GridBtn
                  title="Năm điều khoản in nguyên văn lên phiếu gửi nhà cung cấp"
                  onClick={() => {
                    setHeadOpen(true)
                    goTo('dau-don')
                  }}
                >
                  Điều khoản in lên phiếu →
                </GridBtn>
              </div>
            </div>
          )}

          {blkLines}
          {blkPhatSinh}
          {blkNhuCau}
          {blkGiao}
          {blkChiPhi}
          {blkDauDon}
          {blkTimeline}
          {blkTaiLieu}
        </DocBody>
      )}

      <StatusBar
        left={[
          <>
            <b>{me.name}</b> · Mua hàng
          </>,
          adjusting
            ? 'Đang điều chỉnh — chưa áp dụng'
            : editing
              ? 'Đang sửa — chưa lưu'
              : (PO_NEXT_HINT[(po?.status ?? 'draft') as PoStatus] ?? ''),
        ]}
        right={
          po
            ? `${po.code} · ${PO_STATUS_LABEL[po.status as PoStatus] ?? po.status}`
            : 'Đơn mới'
        }
      />

      {askCancel && (
        <Sheet
          open
          onClose={() => setAskCancel(false)}
          stakes="nang"
          title={
            adjusting
              ? 'Bỏ điều chỉnh?'
              : p.mode === 'create'
                ? 'Bỏ đơn đang soạn?'
                : 'Bỏ các thay đổi?'
          }
          subtitle={
            adjusting
              ? 'Các thay đổi chưa áp dụng sẽ mất — đơn giữ nguyên bản đang chạy.'
              : `${lines.length} dòng đang gõ sẽ mất. Bản nháp tự lưu cũng bị xoá.`
          }
          footer={
            <SheetActions
              stakes="nang"
              onCancel={() => setAskCancel(false)}
              onConfirm={cancelEdit}
              cancelLabel={adjusting ? 'Sửa tiếp' : 'Soạn tiếp'}
              confirmLabel={
                adjusting
                  ? 'Bỏ điều chỉnh'
                  : p.mode === 'create'
                    ? 'Bỏ đơn'
                    : 'Bỏ thay đổi'
              }
            />
          }
        >
          <Consequence>
            {adjusting
              ? 'Chưa có gì vào sổ: đơn, Kho và NCC vẫn theo bản đang chạy.'
              : 'Muốn giữ lại để làm tiếp sau thì bấm “Soạn tiếp” rồi Lưu — đơn lưu ở nháp, chưa gửi ai.'}
          </Consequence>
        </Sheet>
      )}
      {adjSheet && po && adjPlan && (
        <Sheet
          open
          onClose={() => setAdjSheet(false)}
          stakes="vua"
          width={640}
          title={`Áp dụng điều chỉnh lần ${nextSeq} · ${po.code}`}
          subtitle="Không cần duyệt lại. Phần chênh ghi thành phát sinh riêng để kế toán theo dõi."
          footer={
            <SheetActions
              stakes="vua"
              busy={busy}
              onCancel={() => setAdjSheet(false)}
              onConfirm={() => void applyAdjust()}
              cancelLabel="Quay lại sửa"
              confirmLabel="Áp dụng"
              disabled={adjReason.trim().length < 5 || adjBlocked != null}
            />
          }
        >
          <Affected
            max={20}
            items={[
              ...adjPlan.changes.map((c) => ({ code: c.kind === 'added' ? `Thêm · dòng ${c.no}` : c.kind === 'removed' ? `Bỏ · dòng cũ ${c.no}` : `Dòng ${c.no}`, label: `${c.code ? `${c.code} ` : ''}${c.name}${c.kind === 'changed' ? ` — ${c.qty_before !== c.qty_after ? `SL ${fmtNum(c.qty_before ?? 0)} → ${fmtNum(c.qty_after ?? 0)} ` : ''}${c.price_before !== c.price_after ? `giá ${fmtNum(c.price_before ?? 0)} → ${fmtNum(c.price_after ?? 0)} ` : ''}${c.fields.length ? `đổi ${c.fields.join(', ')}` : ''}` : ''}`, amount: signed(c.amount_after - c.amount_before, header.currency) })), // prettier-ignore
              ...(adjPlan.headerChanges?.vat_rate ? [{ code: 'VAT', label: `${adjPlan.headerChanges.vat_rate[0] ?? 0}% → ${adjPlan.headerChanges.vat_rate[1] ?? 0}%` }] : []), // prettier-ignore
              ...(adjPlan.headerChanges?.discount_amount ? [{ code: 'Chiết khấu', label: `${fmtNum(adjPlan.headerChanges.discount_amount[0])} → ${fmtNum(adjPlan.headerChanges.discount_amount[1])}` }] : []), // prettier-ignore
            ]}
          />
          <FactKv
            rows={[
              ['Tổng đang chạy', <span key="a" className="num">{money(adjPlan.money.before.grandTotal, header.currency)}</span>], // prettier-ignore
              ['Tổng mới', <span key="b" className="num">{money(adjPlan.money.after.grandTotal, header.currency)}</span>], // prettier-ignore
              [`Phát sinh lần ${nextSeq}`, <b key="c" className="num">{signed(adjPlan.delta.total, header.currency)}</b>], // prettier-ignore
              ['Báo cho', <span key="d">{notifyWho ?? 'không ai — bạn là người đã duyệt đơn này'}</span>], // prettier-ignore
            ]}
          />
          <Field label="Vì sao điều chỉnh">
            <TextArea
              aria-label="Vì sao điều chỉnh"
              value={adjReason}
              onChange={setAdjReason}
              placeholder="VD: NCC báo tăng giá từ 25/09 (Zalo anh Nguyên); lệnh tăng 20 bộ"
            />
          </Field>
          {adjReason.trim().length < 5 && (
            <div className="k-t-warn text-k-sm">
              Ghi lý do (ít nhất 5 ký tự) — vào sổ phát sinh và thông báo.
            </div>
          )}
          <Consequence>
            Bản mới thay ngay bản đang chạy: Kho nhận theo số mới từ lúc này, đơn vẫn ở
            bước hiện tại. Khoản phát sinh vào sổ, không xoá được — muốn đảo thì điều
            chỉnh lần sau. Nhớ in phiếu gửi lại NCC rồi bấm “Ghi đã gửi NCC”.
          </Consequence>
        </Sheet>
      )}
      {sentSheet != null && po && (
        <Sheet
          open
          onClose={() => setSentSheet(null)}
          stakes="nhe"
          title={`Ghi đã gửi NCC bản điều chỉnh lần ${sentSheet}`}
          subtitle={`${po.code} · ${po.supplier_name}`}
          footer={
            <SheetActions
              stakes="nhe"
              busy={busy}
              onCancel={() => setSentSheet(null)}
              onConfirm={() => void markSent()}
              confirmLabel="Ghi đã gửi"
            />
          }
        >
          <Field label="Gửi qua đâu (tuỳ chọn)">
            <TextInput
              label="Gửi qua đâu"
              value={sentNote}
              onCommit={setSentNote}
              placeholder="Zalo anh Nguyên · email · in giấy gửi xe…"
            />
          </Field>
          <Consequence>
            Ghi mốc lên dòng thời gian đơn, tắt nhắc “chưa tới NCC”.
          </Consequence>
        </Sheet>
      )}
      {
        paste &&
        <DanExcelSheet allowFree={FREE_LINE_TEMPLATES.includes(template)} onClose={() => setPaste(false)} onConfirm={addFromPaste} /> // prettier-ignore
      }
      {
        editing &&
        <QuickAddMaterial open={quickAdd} onOpenChange={setQuickAdd} template={template} onCreated={onCreatedMaterial} /> // prettier-ignore
      }
      {editing && (
        <EditMaterialDialog
          materialId={editMaterial}
          onClose={() => setEditMaterial(null)}
          onSaved={(id, m) => {
            // Hút số mới vào các dòng đang mở cùng vật tư — đúng như bản cũ.
            setLines((ls) =>
              ls.map((l) =>
                l.material_id === id ? refreshLineFromMaterial(template, l, m) : l,
              ),
            )
            invalidateMaterialPickCache()
            setEditMaterial(null)
          }}
        />
      )}
      {enrich && (
        <CapNhatDanhMucSheet
          items={enrich.items}
          busy={enrichBusy}
          onSkip={() => { const d = enrich.dest; setEnrich(null); router.replace(d); router.refresh() }} // prettier-ignore
          onConfirm={(picked) => void confirmEnrich(picked)}
        />
      )}
      {preview && p.company && (
        <Sheet
          open
          onClose={() => setPreview(false)}
          width={900}
          title="Xem trước phiếu đặt hàng"
          subtitle="Dựng từ bản đang gõ — chưa lưu, chưa có số phiếu."
        >
          {' '}
          {/* prettier-ignore */}
          <PoPrintSheet
            company={p.company}
            tpl={p.tpl}
            po={previewHeaderFromDraft(header, { code: po?.code ?? '(cấp khi lưu)', supplierName: supplierOpt?.name ?? '—', lsxCode: lsxLabel, orderCode: header.poType === 'lsx' ? (lsx?.order_codes.join(', ') || null) : null, createdAt: po?.created_at ?? new Date().toISOString() })} // prettier-ignore
            supplier={supplierOpt ? { name: supplierOpt.name } : null}
            lines={previewLinesFromDraft(template, lines)}
          />
        </Sheet>
      )}
      {phiOpen && po && (
        <GhiPhiSheet
          poId={po.id}
          poCode={po.code}
          supplierId={po.supplier_id}
          supplierName={po.supplier_name}
          busy={busy}
          onClose={() => setPhiOpen(false)}
          onSubmit={(body) =>
            call('/api/dept/supply/po-costs', 'POST', body, 'Đã ghi phiếu chi phí')
          }
        />
      )}
      {suCoOpen && po && (
        <GhiSuCoSheet
          lines={trackLines}
          busy={busy}
          onClose={() => setSuCoOpen(false)}
          onSubmit={(x) =>
            call(`/api/dept/supply/pos/${po.id}/issues`, 'POST', x, 'Đã ghi sự cố')
          }
        />
      )}
      {suCoClose && (
        <DongSuCoSheet
          issue={suCoClose}
          busy={busy}
          onClose={() => setSuCoClose(null)}
          onSubmit={(resolution) =>
            call(
              `/api/dept/supply/po-issues/${suCoClose.id}/resolve`,
              'POST',
              { resolution },
              'Đã đóng sự cố',
            )
          }
        />
      )}
      {phiVoid && (
        <HuyPhiSheet
          cost={phiVoid}
          busy={busy}
          onClose={() => setPhiVoid(null)}
          onSubmit={(reason) =>
            call(
              `/api/dept/supply/po-costs/${phiVoid.id}/void`,
              'POST',
              { reason },
              'Đã huỷ phiếu chi phí',
            )
          }
        />
      )}
      {xacNhan && po && (
        <XacNhanSheet
          mode={xacNhan}
          poCode={po.code}
          defaultDate={po.expected_at?.slice(0, 10) ?? today}
          lines={shipLines}
          existing={xacNhan === 'add' ? shippedByLine : new Map()}
          busy={busy}
          onClose={() => setXacNhan(null)}
          onSubmit={submitShipments}
        />
      )}
      {dot && (dot.kind === 'edit' || dot.kind === 'split') && (
        <DotSuaSheet
          kind={dot.kind}
          shipment={dot.s}
          lines={shipLines}
          others={p.shipments
            .filter((s) => s.id !== dot.s.id && s.status !== 'cancelled')
            .flatMap((s) => s.lines)
            .reduce((m, l) => m.set(l.po_line_id, (m.get(l.po_line_id) ?? 0) + l.qty), new Map<string, number>())} // prettier-ignore
          busy={busy}
          onClose={() => setDot(null)}
          onSubmit={(d, reason, lines) =>
            shipmentAct(
              dot.s.id,
              { action: dot.kind, expected_date: d, reason, lines },
              dot.kind === 'split' ? 'Đã tách đợt lấy trước' : 'Đã sửa đợt giao',
            )
          }
        />
      )}
      {dot && (dot.kind === 'reschedule' || dot.kind === 'cancel') && (
        <DotSheet
          kind={dot.kind}
          shipment={dot.s}
          busy={busy}
          onClose={() => setDot(null)}
          onSubmit={
            (d, reason) =>
            dot.kind === 'cancel'
              ? shipmentAct(dot.s.id, { action: 'cancel', reason }, 'Đã huỷ đợt giao')
              : shipmentAct(dot.s.id, { action: 'reschedule', expected_date: d, reason }, 'Đã dời ngày đợt giao') // prettier-ignore
          }
        />
      )}

      {sheet && po && (
        <Sheet
          open
          onClose={() => setSheet(null)}
          title={`${sheet.action.label} · ${po.code}`}
          stakes={sheet.action.stakes}
          footer={
            <SheetActions
              stakes={sheet.action.stakes}
              busy={busy}
              onCancel={() => setSheet(null)}
              onConfirm={() => void runAction(sheet.action)}
              confirmLabel={sheet.action.confirmLabel ?? sheet.action.label}
              /**
               * `sheetInvalid` trước đây chỉ hiện DÒNG CHỮ nhắc mà không khoá
               * nút: bấm được, rồi zod ở biên trả 400 và người dùng nhận toast
               * "Không làm được". Đúng thứ luật kiểm của sổ thiết kế cấm —
               * hành động bị chặn phải nói vướng gì NGAY TẠI CHỖ, không cho
               * bấm rồi mới báo lỗi.
               */
              disabled={sheetInvalid}
            />
          }
        >
          {sheet.action.consequence && (
            <Consequence>{sheet.action.consequence}</Consequence>
          )}
          {sheet.action.needDate && (
            <label className="mb-3 block">
              <span className="text-k-label mb-1 block font-bold tracking-[.07em] text-[var(--ink-3)] uppercase">
                Ngày giao mới
              </span>
              <DateInput value={date} onChange={setDate} label="Ngày giao mới" />
            </label>
          )}
          {sheet.action.needReason && (
            <label className="block">
              <span className="text-k-label mb-1 block font-bold tracking-[.07em] text-[var(--ink-3)] uppercase">
                {sheet.action.reasonLabel}
              </span>
              <TextArea value={reason} onChange={setReason} rows={3} />
              <span className="text-k-sm mt-1 block leading-relaxed text-[var(--ink-3)]">
                {sheet.action.reasonHint}
              </span>
            </label>
          )}
          {sheetInvalid && (
            <p className="text-k-sm mt-3 font-semibold text-[var(--warn)]">
              {sheet.action.needDate && !date
                ? 'Chọn ngày giao mới trước đã.'
                : 'Viết một câu — người sau đọc để khỏi hỏi lại.'}
            </p>
          )}
          {sheet.action.id === 'delete' && (
            <Affected
              items={[
                {
                  code: po.code,
                  label: po.supplier_name,
                  amount: money(totals.grandTotal, po.currency),
                },
              ]}
            />
          )}
        </Sheet>
      )}
    </DocScreen>
  )
}

/* ── ô theo `kind` của PO_FIELDS — dùng ở cả lưới và chi tiết dòng ───────── */

function ViewCell({ f, l, template }: { f: PoField; l: Line; template: PoTemplate }) {
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

function EditCell({
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
