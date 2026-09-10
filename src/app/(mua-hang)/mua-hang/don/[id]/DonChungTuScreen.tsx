'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Action,
  ActionGroup,
  ActionPane,
  Affected,
  Checks,
  Consequence,
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
  Lookup,
  NoticeBar,
  NumInput,
  Pick,
  Sheet,
  SheetActions,
  SmartLinks,
  StatusBar,
  StatusTrack,
  Td,
  TextArea,
  TextInput,
  Th,
  Tick,
  Timeline,
  poHolder,
  type Mark,
} from '@/components/kit'
import { useToast } from '@/components/ui/Toast'
import { DocumentFiles } from '@/components/DocumentFiles'
import { PoNotesPanel } from '@/app/(workspace)/planning/pos/[id]/PoNotesPanel'
import { api, apiErrorText } from '@/lib/api'
import { PO_FIELDS, type PoField } from '@/lib/po-fields'
import { PO_TEMPLATE_META, poTemplateMeta, type PoTemplate } from '@/lib/po-template'
import type { PoMaterial } from '@/lib/po-material.types'
import { PO_CURRENCIES, poLineAmount } from '@/lib/po-line'
import type { ShipmentInput } from '@/lib/po-shipments'
import type { ReceiptBatch } from '@/modules/dept/supply/po-receipts.service'
import { PO_NEXT_HINT, PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'
import {
  buildPoPayload,
  draftProblem,
  poTotals,
  type PoHeader,
} from '@/app/(workspace)/planning/pos/new/po-draft'
import {
  lineAmount,
  lineFromPo,
  lineProblem,
  lineQty2,
  newFreeLine,
  newLine,
  remapLinesForTemplate,
  type Line,
  type Num,
  type PoLineDto,
} from '@/app/(workspace)/planning/pos/new/po-line'
import { useLocalPref } from '../../../_shell/use-local-pref'
import { actionsFor, type Action as DocAction } from '../actions'
import { headerFromPo, lineIssues, newHeader, poChecks, retemplate } from './chung-tu'
import { receiveActions, shipmentEmptyHint, type ShipmentLineRef, type ShipmentLite } from './nhan-hang' // prettier-ignore
import { ChungTuKhoGrid, DotGiaoGrid, DotSheet, NhanTheoDotGrid, XacNhanSheet } from './NhanHangPanel' // prettier-ignore

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
  suppliers: { id: string; name: string; currency: string | null; payment_terms: string | null; lead_time_days: number | null }[] // prettier-ignore
  lsxs: { id: string; code: string; customer_name: string; order_codes: string[] }[]
  perms: { canEdit: boolean; canApprove: boolean; isSupply: boolean }
  me: { id: string; name: string }
  seed?: { supplierId?: string; lsxId?: string }
}

const dmy = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''
const money = (v: number, cur: string) => `${v.toLocaleString('vi-VN')} ${cur}`
const numStr = (v: Num) => (v === '' ? '' : String(v))
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
const GRID_KINDS = new Set(['text', 'number', 'calc'])
const GRID_MAX = 3

export function DonChungTuScreen(p: Props) {
  const router = useRouter()
  const toast = useToast()
  const { po, perms, me, today } = p

  const [editing, setEditing] = useState(p.mode !== 'view')
  const [header, setHeader] = useState<PoHeader>(
    () =>
    po ? headerFromPo(po, p.extraLsx.map((x) => x.id)) : newHeader({ supplierId: p.seed?.supplierId, lsxId: p.seed?.lsxId }), // prettier-ignore
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
  const [paneTab, setPaneTab] = useState<'don' | 'nhan'>('don')
  const [xacNhan, setXacNhan] = useState<null | 'confirm' | 'add'>(null)
  const [dot, setDot] = useState<null | { kind: 'reschedule' | 'cancel'; s: ShipmentLite }>(null) // prettier-ignore
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [denseRaw, setDenseRaw] = useLocalPref('hg.mua-hang.don.dense', '1')
  const dense = denseRaw !== '0'

  const template = header.template
  const meta = poTemplateMeta(template)
  const allFields = useMemo(
    () => PO_FIELDS[template].filter((f) => !f.editHidden),
    [template],
  )
  const gridFields = useMemo(() => allFields.filter((f) => GRID_KINDS.has(f.kind)).slice(0, GRID_MAX), [allFields]) // prettier-ignore
  const detailFields = useMemo(() => allFields.filter((f) => !gridFields.includes(f)), [allFields, gridFields]) // prettier-ignore
  const totals = poTotals(header, lines)
  const issues = lineIssues(template, lines, lineProblem)
  const problem = editing ? draftProblem(header, lines) : null
  const statusById = useMemo(() => new Map(p.statusLines.map((s) => [s.id, s])), [p.statusLines]) // prettier-ignore
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
  const addMaterial = (m: PoMaterial) => {
    setLines((ls) => [...ls, newLine(template, m)])
    setPick(lines.length)
  }
  const addFree = () => {
    setLines((ls) => [...ls, newFreeLine()])
    setPick(lines.length)
  }
  const removeSel = () => {
    setLines((ls) => ls.filter((l) => !sel.includes(l.material_id)))
    setSel([])
    setPick(0)
  }
  const changeTemplate = (t: PoTemplate) => {
    setLines((ls) => remapLinesForTemplate(template, t, ls))
    setHeader((h) => retemplate(h, t))
  }

  /* ── lưu / huỷ ─────────────────────────────────────────────────────── */
  async function save() {
    if (problem) {
      toast.warning('Chưa lưu được', problem)
      return
    }
    setBusy(true)
    try {
      const body = buildPoPayload(header, lines)
      if (p.mode === 'create' || !po) {
        const r = await api<{ po: { id: string; code: string } }>('/api/dept/supply/pos', { method: 'POST', body }) // prettier-ignore
        toast.success(`Đã tạo ${r.po.code}`)
        router.replace(`/mua-hang/don/${r.po.id}`)
      } else {
        await api(`/api/dept/supply/pos/${po.id}`, { method: 'PATCH', body })
        toast.success(`Đã lưu ${po.code}`)
        setEditing(false)
        router.replace(`/mua-hang/don/${po.id}`)
        router.refresh()
      }
    } catch (e) {
      toast.error('Không lưu được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }
  function cancelEdit() {
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
  }

  /* ── hành động theo bước (chế độ xem) ──────────────────────────────── */
  const docActions = po ? actionsFor(po.status as PoStatus, { own: perms.canEdit, approve: perms.canApprove }) : [] // prettier-ignore
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
    if (a.id === 'open') return
    if (a.ui === 'link' && a.href) return router.push(a.href(po.id))
    if (a.ui === 'direct') return void runAction(a)
    setReason('')
    setDate('')
    setSheet({ action: a })
  }
  const sheetInvalid =
    sheet != null &&
    ((sheet.action.needReason && reason.trim().length === 0) ||
      (sheet.action.needDate && !date))

  /* ── dữ kiện đầu trang ─────────────────────────────────────────────── */
  const holder = po ? poHolder(po, me.id) : null
  const stepIdx = po ? ['draft', 'pending_approval', 'approved', 'ordered', 'confirmed', 'in_transit'].indexOf(po.status) : 0 // prettier-ignore
  const recvIdx = po?.status === 'received' ? 2 : po?.status === 'partial' ? 1 : 0
  const lsx = p.lsxs.find((l) => l.id === header.lsxId)
  const supplierOpt = p.suppliers.find((s) => s.id === header.supplierId)
  const marks: Mark[] = po
    ? [
        { key: 'tao', at: po.created_at, label: 'Tạo đơn', actor: po.assignee_name },
        { key: 'duyet', at: po.approved_at, label: 'Giám đốc duyệt', tone: po.approved_at ? 'done' : undefined }, // prettier-ignore
        { key: 'gui', at: po.ordered_at, label: 'Gửi nhà cung cấp' },
        { key: 'xn', at: po.confirmed_at, label: 'NCC nhận' },
        ...p.shipments.map((s, i) => ({ key: `dot${i}`, at: s.expected_date, label: `Đợt giao ${i + 1} · ${s.status}` })), // prettier-ignore
        ...p.warehouseDocs.map((d) => ({ key: d.doc_id, at: d.at, label: `${d.kind === 'receipt' ? 'Phiếu nhập' : 'Trả NCC'} ${d.code}`, detail: `${d.qty_total.toLocaleString('vi-VN')} đơn vị`, tone: 'done' as const })), // prettier-ignore
      ]
    : []
  const code = po?.code ?? 'Đơn mới'
  const primary = docActions.find((a) => a.primary && a.id !== 'open')
  const secondary = docActions.filter(
    (a) => !a.primary && a.id !== 'open' && a.id !== 'edit',
  )
  const editAct = docActions.find((a) => a.id === 'edit')
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
      action: 'reschedule' | 'arrived' | 'cancel'
      expected_date?: string
      reason?: string
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
  const CLOSE_SHORT: DocAction = { id: 'close_short', label: 'Chốt phần thiếu', ui: 'sheet', stakes: 'nang', needReason: true, reasonLabel: 'Vì sao NCC không giao nữa', reasonHint: 'Ghi vào vết của đơn. Phần thiếu không còn tính là "đang đặt" — Kho và kế hoạch thấy ngay.', consequence: `${openStockLines.length} dòng còn thiếu sẽ chốt. NCC đổi ý giao bù thì mở lại được từng dòng.`, done: 'Đã chốt phần thiếu', build: ({ id, reason }) => [{ path: `/api/dept/supply/pos/${id}/close-short`, method: 'POST', body: { action: 'close', line_id: null, reason } }] } // prettier-ignore

  const goOld = (hash: string) => po && router.push(`/planning/pos/${po.id}${hash}`)
  const goTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ block: 'start' })

  return (
    <DocScreen dense={dense}>
      <Crumb
        path={['Đơn mua', code]}
        view={editing ? (p.mode === 'create' ? 'đang tạo' : 'đang sửa') : undefined}
        position={p.position ? [p.position.index, p.position.total] : undefined}
      />

      <ActionPane
        tabs={[
          { label: 'Đơn hàng', active: editing || paneTab === 'don', onClick: () => setPaneTab('don') }, // prettier-ignore
          { label: 'Nhận hàng', active: !editing && paneTab === 'nhan', disabled: editing || !po, title: editing ? 'Lưu hoặc huỷ sửa trước' : undefined, onClick: () => setPaneTab('nhan') }, // prettier-ignore
          { label: 'Tài chính', disabled: true, title: 'Phân hệ Kế toán chưa mở' },
        ]}
      >
        {' '}
        {/* prettier-ignore */}
        {editing ? (
          <>
            <ActionGroup label="Đang sửa">
              <Action
                primary
                disabled={busy || !!problem}
                title={problem ?? undefined}
                onClick={() => void save()}
              >
                {p.mode === 'create' ? 'Tạo đơn' : 'Lưu'}
              </Action>
              <Action disabled={busy} onClick={cancelEdit}>
                Huỷ
              </Action>
            </ActionGroup>
            <ActionGroup label="Dòng hàng">
              <Action onClick={addFree}>+ Dòng tự do</Action>
              <Action
                disabled={sel.length === 0}
                title="Chọn dòng trước"
                onClick={removeSel}
              >
                Xoá dòng đã chọn
              </Action>
            </ActionGroup>
          </>
        ) : paneTab === 'nhan' && po ? (
          <>
            <ActionGroup label="Kế hoạch giao">
              <Action
                primary={po.status === 'ordered'}
                disabled={busy || !recv.confirm.ok}
                title={recv.confirm.why}
                onClick={() => (shipLines.length > 0 ? setXacNhan('confirm') : start(CONFIRM_PLAIN))} // prettier-ignore
              >
                NCC xác nhận
              </Action>
              <Action
                disabled={busy || !recv.addShipment.ok}
                title={recv.addShipment.why}
                onClick={() => setXacNhan('add')}
              >
                Thêm đợt giao
              </Action>
              <Action
                disabled={busy || !recv.transit.ok}
                title={recv.transit.why}
                onClick={() => start(TRANSIT)}
              >
                Hàng đang trên đường
              </Action>
            </ActionGroup>
            <ActionGroup label="Nhận hàng">
              {/* Lập phiếu nhập là việc của KHO và màn đó đã có. Dựng lại một
                  form nhập ở đây là hai đường ghi vào cùng một sổ. Nút DẪN. */}
              <Action
                primary={['confirmed', 'in_transit', 'partial'].includes(po.status)}
                disabled={!recv.receive.ok}
                title={recv.receive.why ?? 'Mở màn lập phiếu nhập bên Kho cho đơn này'}
                onClick={() => router.push(`/warehouse/don-ncc/${po.id}`)}
              >
                Ghi nhận nhận hàng · Kho
              </Action>
              <Action
                disabled={busy || !recv.closeShort.ok}
                title={recv.closeShort.why}
                onClick={() => start(CLOSE_SHORT)}
              >
                Chốt phần thiếu
              </Action>
              <Action
                disabled={busy || !recv.acceptByHand.ok}
                title={recv.acceptByHand.why}
                onClick={() => start(ACCEPT)}
              >
                Nghiệm thu ngoài sổ
              </Action>
            </ActionGroup>
            <ActionGroup label="Hiển thị">
              <Action
                onClick={() => setDenseRaw(dense ? '0' : '1')}
                title="Mật độ hàng của lưới"
              >
                {dense ? 'Thưa' : 'Dày'}
              </Action>
            </ActionGroup>
          </>
        ) : (
          <>
            <ActionGroup label="Duy trì">
              <Action
                strong
                disabled={!editAct || !!editAct.blocked}
                title={
                  editAct?.blocked ??
                  (po?.status !== 'draft' ? 'Chỉ sửa được đơn nháp' : undefined)
                }
                onClick={() => editAct && start(editAct)}
              >
                Sửa
              </Action>
              <Action onClick={() => router.push('/mua-hang/don/moi')}>Mới</Action>
              {secondary
                .filter((a) => a.id === 'duplicate' || a.id === 'delete')
                .map((a) => (
                  <Action
                    key={a.id}
                    disabled={busy || !!a.blocked}
                    title={a.blocked}
                    onClick={() => start(a)}
                  >
                    {a.label}
                  </Action>
                ))}
            </ActionGroup>
            <ActionGroup label="Luồng phê duyệt">
              {primary && (
                <Action
                  primary
                  disabled={
                    busy ||
                    !!primary.blocked ||
                    (primary.id === 'submit' && blockers.length > 0)
                  }
                  title={
                    primary.blocked ??
                    (blockers.length > 0 ? `Còn ${blockers.length} lỗi chặn` : undefined)
                  }
                  onClick={() => start(primary)}
                >
                  {primary.label}
                </Action>
              )}
              {secondary
                .filter((a) => a.id !== 'duplicate' && a.id !== 'delete')
                .map((a) => (
                  <Action
                    key={a.id}
                    disabled={busy || !!a.blocked}
                    title={a.blocked}
                    onClick={() => start(a)}
                  >
                    {a.label}
                  </Action>
                ))}
            </ActionGroup>
            <ActionGroup label="In &amp; xuất">
              <Action
                disabled={!po}
                onClick={() => po && window.open(`/print/supply/${po.id}`, '_blank')}
              >
                Phiếu đặt hàng
              </Action>
              <Action
                disabled={!po}
                onClick={() =>
                  po && window.open(`/api/dept/supply/pos/${po.id}/export`, '_blank')
                }
              >
                Xuất Excel
              </Action>
            </ActionGroup>
            <ActionGroup label="Hiển thị">
              <Action
                onClick={() => setDenseRaw(dense ? '0' : '1')}
                title="Mật độ hàng của lưới"
              >
                {dense ? 'Thưa' : 'Dày'}
              </Action>
            </ActionGroup>
          </>
        )}
      </ActionPane>

      <DocHead
        compact
        kind="Đơn đặt vật tư"
        code={code}
        sub={
          po ? (
            <>
              {po.supplier_name} · soạn {dmy(po.created_at)} bởi {po.assignee_name ?? '—'}
            </>
          ) : (
            <>Chưa lưu · {supplierOpt?.name ?? 'chưa chọn nhà cung cấp'}</>
          )
        }
      >
        {po && (
          <>
            <StatusTrack
              label="Trạng thái đơn"
              steps={[
                'Nháp',
                'Chờ duyệt',
                'Đã duyệt',
                'Đã gửi',
                'NCC xác nhận',
                'Đang giao',
              ]}
              at={Math.max(0, stepIdx)}
            />
            <StatusTrack
              label="Nhận hàng"
              steps={['Chưa', 'Một phần', 'Đủ']}
              at={recvIdx}
            />
          </>
        )}
      </DocHead>

      {/* Nút thông minh — chép Odoo. Số đếm là lời hứa: bấm ra đúng chừng ấy. */}
      {po && (
        <SmartLinks
          trailing={
            holder && !editing ? (
              <HolderBar
                inline
                mine={holder.mine}
                who={holder.who}
                what={holder.what}
                age={
                  holder.since ? `${daysBetween(holder.since, today)} ngày` : undefined
                }
              />
            ) : undefined
          }
          items={[
            { label: 'đợt giao', count: liveShipments.length, onClick: () => goTo('dot-giao'), title: 'Kế hoạch giao NCC hẹn' }, // prettier-ignore
            { label: 'phiếu kho', count: p.warehouseDocs.length, onClick: () => goTo('kho'), title: 'Phiếu nhập / trả đã ghi vào đơn' }, // prettier-ignore
            { label: 'lệnh SX', count: (po.production_order_id ? 1 : 0) + p.extraLsx.length, onClick: () => po.production_order_id && router.push(`/planning/lsx/${po.production_order_id}`), disabled: !po.production_order_id }, // prettier-ignore
            { label: 'trao đổi', count: null, onClick: () => goTo('trao-doi'), title: 'Ghi chú và mốc máy ghi trên đơn này' }, // prettier-ignore
            { label: 'tài liệu', count: null, onClick: () => goTo('tai-lieu'), title: 'Báo giá, hợp đồng, chứng từ giao nhận' }, // prettier-ignore
          ]}
        />
      )}

      {!editing && checks.length > 0 && (
        <Checks
          compact
          title={
            blockers.length > 0 ? 'Chưa gửi duyệt được' : 'Lưu ý trước khi gửi duyệt'
          }
          items={checks}
        />
      )}
      {editing && problem && (
        <NoticeBar tone="warn" tag="Chưa lưu được" action={{ label: 'Xem dòng hàng' }}>
          {problem}. Sửa xong thì nút Lưu tự mở.
        </NoticeBar>
      )}

      <DocBody
        aside={
          <FactBox>
            <FactSection title="Nhà cung cấp">
              <div className="k-strong" style={{ marginBottom: 4 }}>
                {p.supplier?.name ?? supplierOpt?.name ?? '—'}
              </div>
              <FactKv
                rows={[
                  ['Giao đúng hẹn', p.facts?.onTime ? <span key="a" className="num k-t-done">{p.facts.onTime.hit} / {p.facts.onTime.of} đơn</span> : <span key="a" className="k-t-warn">chưa có lịch sử</span>], // prettier-ignore
                  ['Đã đặt', <span key="b" className="num">{p.facts?.orders ?? 0} đơn</span>], // prettier-ignore
                  ['Nhận đủ', <span key="c" className="num">{p.facts?.received ?? 0} đơn</span>], // prettier-ignore
                  ['Mua gần nhất', <span key="d" className="num">{dmy(p.facts?.lastOrderAt) || '—'}</span>], // prettier-ignore
                  ['Mã NCC', <span key="e" className="num">{p.supplier?.code ?? '—'}</span>], // prettier-ignore
                  ['Mã số thuế', <span key="f" className="num">{p.supplier?.tax_no ?? '—'}</span>], // prettier-ignore
                ]}
              />
            </FactSection>
            <FactSection title="Tiền">
              <FactKv
                rows={[
                  ['Tiền hàng', <span key="a" className="num">{money(totals.subtotal, header.currency)}</span>], // prettier-ignore
                  ['VAT', <span key="b" className="num">{header.vat === '' ? 0 : header.vat}% · {money(totals.vatAmount, header.currency)}</span>], // prettier-ignore
                  ['Tổng thanh toán', <b key="c" className="num">{money(totals.grandTotal, header.currency)}</b>], // prettier-ignore
                  ...(issues.length > 0 ? [['Chưa gồm', <span key="d" className="k-t-warn">{issues.length} dòng thiếu số</span>] as [string, React.ReactNode]] : []), // prettier-ignore
                ]}
              />
            </FactSection>
          </FactBox>
        }
      >
        {/* ══ 1. LƯỚI DÒNG — mở đầu, nhân vật chính ═══════════════════════ */}
        <FastTab
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
                  Chỉnh sửa vật tư
                </GridBtn>
                <GridSep />
                <GridBtn
                  onClick={() => {
                    setPaneTab('nhan')
                    goTo('dot-giao')
                  }}
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
              count={
                sel.length > 0 ? `${sel.length} dòng đã chọn` : `${lines.length} dòng`
              }
            >
              <>
                <Lookup<PoMaterial>
                  label="Thêm vật tư"
                  placeholder="Gõ mã hoặc tên vật tư, Enter để thêm dòng…"
                  width={340}
                  search={async (q) =>
                    (
                      await api<{ materials: PoMaterial[] }>(
                        `/api/dept/supply/po-materials?q=${encodeURIComponent(q)}&limit=12`,
                      )
                    ).materials
                  }
                  keyOf={(m) => m.id}
                  render={(m) => (
                    <>
                      <span className="num font-semibold text-[var(--act)]">
                        {m.code}
                      </span>{' '}
                      · {m.name}{' '}
                      <span className="text-[var(--ink-3)]">
                        · {m.unit}
                        {m.group_name ? ` · ${m.group_name}` : ''}
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
                <GridBtn
                  onClick={() => po && router.push(`/planning/pos/${po.id}/edit`)}
                  disabled={!po}
                  title="Dán từ Excel, khai vật tư mới, chia lệnh — nửa sau bước 2"
                >
                  Nhập hàng loạt (bản cũ)
                </GridBtn>
              </>
            </GridToolbar>
          )}

          <Grid minWidth={640 + gridFields.length * 100}>
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
              {!editing && <Th>Trạng thái</Th>}
            </GridHead>
            <GridBody>
              {lines.map((l, i) => {
                const why = issues.find((x) => x.index === i)?.why ?? null
                const st = statusById.get(p.lines[i]?.id ?? '')
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
                    key={l.material_id}
                    selected={i === curIdx}
                    onClick={() => setPick(i)}
                  >
                    <GridCheck
                      checked={sel.includes(l.material_id)}
                      label={`Chọn dòng ${l.code || l.name}`}
                      onChange={() =>
                        setSel((s) =>
                          s.includes(l.material_id)
                            ? s.filter((x) => x !== l.material_id)
                            : [...s, l.material_id],
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
                    <Td num tone={why?.includes('SL') ? 'warn' : undefined}>
                      {editing ? (
                        <NumInput
                          aria-label="SL đặt"
                          value={numStr(l.qty)}
                          onCommit={(v) => patch(i, { qty: toNum(v) })}
                        />
                      ) : (
                        Number(l.qty || 0).toLocaleString('vi-VN')
                      )}
                    </Td>
                    <Td num tone={why?.includes('giá') ? 'warn' : undefined}>
                      {editing ? (
                        <NumInput
                          aria-label="Đơn giá"
                          value={numStr(l.price)}
                          onCommit={(v) => patch(i, { price: toNum(v) })}
                        />
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
                        lineAmount(template, l).toLocaleString('vi-VN')
                      )}
                    </Td>
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
              <Td num>{totals.subtotal.toLocaleString('vi-VN')}</Td>
              {!editing && <Td />}
            </GridFoot>
          </Grid>

          {/* ══ CHI TIẾT DÒNG ĐANG CHỌN — Dynamics Line details ═══════════ */}
          {cur ? (
            <LineDetail index={curIdx + 1} code={cur.code || cur.name || '(dòng tự do)'}>
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
                <Field label="Nhu cầu (định mức × SL lệnh)">
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
                <Field label="Giá theo">
                  {cur.price_per === 'unit2'
                    ? `đơn vị quy đổi (${cur.unit2_label || meta.priceUnit})`
                    : cur.price_per === 'unit'
                      ? 'ĐVT mua'
                      : `mặc định của mẫu`}
                </Field>
                <Field label="Thành tiền">
                  <b className="num">
                    {cur.price === ''
                      ? '—'
                      : money(lineAmount(template, cur), header.currency)}
                  </b>
                </Field>
              </FieldGroup>
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
                {cur.is_free && (
                  <Field label="Loại dòng">Dòng tự do — không trừ kho</Field>
                )}
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

        {/* ══ 1b. GIAO & NHẬN HÀNG — hai sổ: NCC hẹn gì, Kho thực nhận gì ═══
            Mở sẵn khi đơn đã gửi NCC (từ đó trở đi đây là câu hỏi hằng ngày);
            trước đó gấp lại, chỉ tiêu đề nói "chưa có đợt". */}
        {po && (
          <FastTab
            id="dot-giao"
            title="Giao & nhận hàng"
            flush
            defaultOpen={sentToSupplier}
            summary={[
              ['Đợt giao', <span key="a" className="num">{liveShipments.length}</span>], // prettier-ignore
              ['Đã nhận', <span key="b" className="num">{liveShipments.length > 0 ? `${shipmentsDone}/${liveShipments.length}` : '—'}</span>], // prettier-ignore
              ['Phiếu kho', <span key="c" className="num">{p.warehouseDocs.length}</span>], // prettier-ignore
            ]}
            actions={
              !editing ? (
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
                    onClick={() => router.push(`/warehouse/don-ncc/${po.id}`)}
                  >
                    {' '}
                    {/* prettier-ignore */}
                    Ghi nhận nhận hàng · Kho
                  </GridBtn>
                </>
              ) : undefined
            }
          >
            {po.status === 'cancelled' ? (
              <div className="px-[var(--gutter)] py-3 text-[var(--fs-sm)] text-[var(--ink-2)]">
                Đơn đã huỷ — kế hoạch giao và chứng từ kho không còn áp dụng.
              </div>
            ) : (
              <>
                <div className="px-[var(--gutter)] pt-2">
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
                  canAct={perms.canEdit && !editing}
                  busy={busy}
                  today={today}
                  onArrived={(id) => void shipmentAct(id, { action: 'arrived' }, 'Đã ghi nhận xe tới')} // prettier-ignore
                  onReschedule={(s) => setDot({ kind: 'reschedule', s })}
                  onCancel={(s) => setDot({ kind: 'cancel', s })}
                />
                {p.receiptBatches.length > 0 && (
                  <>
                    <div className="px-[var(--gutter)] pt-3">
                      <h3 className="k-fgrp-h">Nhận theo đợt · sổ thực nhận của Kho</h3>
                    </div>
                    <NhanTheoDotGrid
                      batches={p.receiptBatches}
                      lines={p.lines.flatMap((l) => (l.id ? [{ id: l.id, code: l.material_code, name: l.material_name, unit: l.material_unit, qty_ordered: l.qty_ordered }] : []))} // prettier-ignore
                      status={p.statusLines}
                    />
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
                  <div className="px-[var(--gutter)] pb-3 text-[var(--fs-sm)] text-[var(--ink-2)]">
                    Chưa có phiếu nhập hay xuất trả nào ghi vào đơn này.
                  </div>
                )}
              </>
            )}
          </FastTab>
        )}

        {/* ══ 2. ĐẦU ĐƠN — gấp, nhóm có tên, 3 cột ═══════════════════════ */}
        <FastTab
          title="Đầu đơn"
          defaultOpen={p.mode === 'create'}
          flush
          summary={[
            ['NCC', po?.supplier_name ?? supplierOpt?.name ?? '—'],
            ['Lệnh', <span key="l" className="num">{po?.lsx_code ?? lsx?.code ?? 'ngoài LSX'}</span>], // prettier-ignore
            ['Hạn giao', header.expectedAt ? <span key="h" className={`num ${header.expectedAt < today ? 'k-t-stop' : ''}`}>{dmy(header.expectedAt)}</span> : <span key="h" className="k-t-warn">chưa có</span>], // prettier-ignore
            ['Mẫu', meta.label],
          ]}
        >
          <FieldGroup title="Chung">
            {editing ? (
              <>
                <Field label="Mẫu đơn">
                  <Pick
                    label="Mẫu đơn"
                    value={template}
                    onChange={(t) => changeTemplate(t as PoTemplate)}
                    options={Object.values(PO_TEMPLATE_META).map((m) => ({
                      value: m.key,
                      label: m.label,
                    }))}
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
                  <Pick
                    label="Lệnh sản xuất"
                    disabled={header.poType !== 'lsx'}
                    value={header.lsxId}
                    onChange={(v) => setHeader((h) => ({ ...h, lsxId: v }))}
                    options={[
                      { value: '', label: '— chọn lệnh —' },
                      ...p.lsxs.map((l) => ({
                        value: l.id,
                        label: `${l.code} · ${l.customer_name}`,
                      })),
                    ]}
                  />
                </Field>
                <Field label="Nhà cung cấp">
                  <Pick
                    label="Nhà cung cấp"
                    value={header.supplierId}
                    onChange={(v) => {
                      const s = p.suppliers.find((x) => x.id === v)
                      setHeader((h) => ({
                        ...h,
                        supplierId: v,
                        currency: s?.currency ?? h.currency,
                      }))
                    }}
                    options={[
                      { value: '', label: '— chọn NCC —' },
                      ...p.suppliers.map((s) => ({ value: s.id, label: s.name })),
                    ]}
                  />
                </Field>
                <Field label="Số hợp đồng">
                  <TextInput
                    label="Số hợp đồng"
                    value={header.contractNo}
                    onCommit={(v) => setHeader((h) => ({ ...h, contractNo: v }))}
                    mono
                  />
                </Field>
                <Field label="Người ký">
                  <TextInput
                    label="Người ký"
                    value={header.signerRole}
                    onCommit={(v) => setHeader((h) => ({ ...h, signerRole: v }))}
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
                <Field label="Số hợp đồng">
                  <span className="num">{po?.contract_no ?? '—'}</span>
                </Field>
                <Field label="Người ký">{po?.signer_role ?? meta.signerRole}</Field>
              </>
            )}
          </FieldGroup>
          <FieldGroup title="Giao hàng">
            {editing ? (
              <Field label="Hạn giao">
                <DateInput
                  label="Hạn giao"
                  value={header.expectedAt}
                  onChange={(v) => setHeader((h) => ({ ...h, expectedAt: v }))}
                />
              </Field>
            ) : (
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
            {(['delivery_place', 'lead_time'] as const).map((k) => (
              <Field
                key={k}
                label={k === 'delivery_place' ? 'Nơi giao' : 'Thời gian giao'}
              >
                {editing ? (
                  <TextInput
                    label={k}
                    value={header.terms[k]}
                    onCommit={(v) =>
                      setHeader((h) => ({ ...h, terms: { ...h.terms, [k]: v } }))
                    }
                  />
                ) : (
                  header.terms[k] || '—'
                )}
              </Field>
            ))}
            <Field label="Thời gian giao của NCC" inherited>
              <span className="num">
                {supplierOpt?.lead_time_days != null
                  ? `${supplierOpt.lead_time_days} ngày`
                  : '—'}
              </span>
            </Field>
          </FieldGroup>
          <FieldGroup title="Giá &amp; thuế">
            {editing ? (
              <>
                <Field label="Tiền tệ">
                  <Pick
                    label="Tiền tệ"
                    value={header.currency}
                    onChange={(v) => setHeader((h) => ({ ...h, currency: v }))}
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
                    onChange={(v) => setHeader((h) => ({ ...h, inclVat: v }))}
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
            {(['payment', 'invoice', 'quality'] as const).map((k) => (
              <Field
                key={k}
                label={
                  { payment: 'Thanh toán', invoice: 'Hoá đơn', quality: 'Chất lượng' }[k]
                }
              >
                {editing ? (
                  <TextInput
                    label={k}
                    value={header.terms[k]}
                    onCommit={(v) =>
                      setHeader((h) => ({ ...h, terms: { ...h.terms, [k]: v } }))
                    }
                  />
                ) : (
                  header.terms[k] || '—'
                )}
              </Field>
            ))}
            <Field label="Điều khoản TT của NCC" inherited>
              {supplierOpt?.payment_terms ?? '—'}
            </Field>
          </FieldGroup>
          <FieldGroup title="Ghi chú đơn">
            {editing ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <TextArea
                  value={header.note}
                  onChange={(v) => setHeader((h) => ({ ...h, note: v }))}
                  rows={3}
                  placeholder="Ghi chú nội bộ — nhà cung cấp không thấy"
                />
              </div>
            ) : (
              <div style={{ gridColumn: '1 / -1' }} className="k-note">
                {po?.note || 'Không có ghi chú.'}
              </div>
            )}
          </FieldGroup>
        </FastTab>

        {/* ══ 3. TRAO ĐỔI — Odoo chatter. Người mở tới đây hỏi "vì sao đơn đứng
            im"; câu trả lời là lời người viết, nên ghi chú đứng trước, mốc máy
            ghi trộn vào cùng dòng (PoNotesPanel lo). Khối "Dòng thời gian" giữ
            riêng cho ai muốn xem mỗi phần máy ghi. ═══════════════════════ */}
        {po && (
          <FastTab id="trao-doi" title="Trao đổi" defaultOpen>
            <PoNotesPanel
              poId={po.id}
              meId={me.id}
              meName={me.name}
              marks={marks.map((m) => ({ key: m.key, at: m.at, label: m.label, actor: m.actor }))} // prettier-ignore
              followerNames={[po.assignee_name].filter((x): x is string => !!x)}
            />
          </FastTab>
        )}
        {po && (
          <FastTab
            id="dong-thoi-gian"
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
        {po && (
          <FastTab id="tai-lieu" title="Tài liệu đính kèm">
            <DocumentFiles
              kind="purchase_order"
              id={po.id}
              canEdit={p.perms.isSupply || p.perms.canApprove}
              title="Báo giá NCC · Hợp đồng mua bán · Chứng từ giao nhận"
            />
          </FastTab>
        )}
      </DocBody>

      <StatusBar
        left={[
          <>
            <b>{me.name}</b> · Mua hàng
          </>,
          editing
            ? 'Đang sửa — chưa lưu'
            : (PO_NEXT_HINT[(po?.status ?? 'draft') as PoStatus] ?? ''),
        ]}
        right={
          po
            ? `${po.code} · ${PO_STATUS_LABEL[po.status as PoStatus] ?? po.status}`
            : 'Đơn mới'
        }
      />

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
      {dot && (
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
              confirmLabel={sheet.action.label}
            />
          }
        >
          {sheet.action.consequence && (
            <Consequence>{sheet.action.consequence}</Consequence>
          )}
          {sheet.action.needDate && (
            <label className="mb-3 block">
              <span className="mb-1 block font-bold tracking-[.07em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
                Ngày giao mới
              </span>
              <DateInput value={date} onChange={setDate} label="Ngày giao mới" />
            </label>
          )}
          {sheet.action.needReason && (
            <label className="block">
              <span className="mb-1 block font-bold tracking-[.07em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
                {sheet.action.reasonLabel}
              </span>
              <TextArea value={reason} onChange={setReason} rows={3} />
              <span className="mt-1 block text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                {sheet.action.reasonHint}
              </span>
            </label>
          )}
          {sheetInvalid && (
            <p className="mt-3 font-semibold text-[var(--fs-sm)] text-[var(--warn)]">
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
