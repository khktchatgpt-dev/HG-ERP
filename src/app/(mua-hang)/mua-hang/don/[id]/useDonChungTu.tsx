'use client'

import { type CreatedMaterial } from '@/app/(mua-hang)/mua-hang/don/_lib/QuickAddMaterial'
import { sameMaterialManyLines } from '@/lib/po-line-dup'
import {
  buildPoPayload,
  draftProblem,
  poTotals,
  templateDefaults,
  type PoHeader,
} from '@/app/(mua-hang)/mua-hang/don/_lib/po-draft'
import {
  lineFromPo,
  lineProblem,
  lineQty2,
  newFreeLine,
  newLine,
  remapLinesForTemplate,
  type Line,
} from '@/app/(mua-hang)/mua-hang/don/_lib/po-line'
import { poHolder, useToast, type IcoName, type Mark } from '@/components/kit'
import { useSuaTaiCho } from './useSuaTaiCho'
import {
  fetchMaterialByCode,
  fetchMaterialsByIds,
  invalidateMaterialPickCache,
} from '@/components/supply/MaterialPicker'
import { ApiError, api, apiErrorText } from '@/lib/api'
import { planAdjustment, type AdjBeforeLine } from '@/lib/po-adjust'
import { allocationNote } from '@/lib/po-allocation'
import type { CatalogSuggestion } from '@/lib/po-catalog-backfill'
import { canCarryCost } from '@/lib/po-cost'
import { PO_FIELDS, type PoField } from '@/lib/po-fields'
import { poFinanceView } from '@/lib/po-finance'
import { poLineAmount } from '@/lib/po-line'
import type { PoMaterial } from '@/lib/po-material.types'
import type { ShipmentInput } from '@/lib/po-shipments'
import { poTrackStep, type PoStatus } from '@/lib/po-status'
import { deriveLine, poTemplateMeta, type PoTemplate } from '@/lib/po-template'
import { moqHint } from '@/lib/po-tracking'
import { useLocalPref } from '@/lib/use-local-pref'
import type { PoIssue } from '@/modules/dept/supply/po-tracking.repo'
import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { DENSE_DEFAULT, DENSE_KEY } from '../../../_shell/KitFrame'
import { actionsFor, type Action as DocAction } from '../actions'
import { costShareOf, type CostRow } from './ChiPhiPanel'
import { type PasteConfirm } from './SoanDonPanels'
import { type TrackLine } from './TheoDoiPanel'
// prettier-ignore
import { headerFromPo, lineIssues, newHeader, poChecks, retemplate, templateForGroup } from './chung-tu'
import {
  MUC_IDS,
  MUC_OF,
  MucId,
  Props,
  SHIP_STATUS_LABEL,
  daysBetween,
  dmy,
  fmtNum,
  money,
  rowKey,
  signed,
  toNum,
} from './don-chung-tu.shared'
import { receiveActions, type ShipmentLineRef, type ShipmentLite } from './nhan-hang'
import {
  columnsToShipments,
  lsxJoinedLabel,
  pendingNeeds,
  planColumnsFromShipments,
  splitLineFields,
  type Need,
  type PlanColumn,
} from './soan-don'
import { draftKeyFor, type SavedDraft } from './nhap-an-toan'
import { useNhapAnToan } from './useNhapAnToan'
import { barLayout, splitForStatusBar, type BarKey } from './thanh-nut'
import { phieuNhapCuoi, vuongPhieuKho } from './tong-quan'

/**
 * TRẠNG THÁI + XỬ LÝ của màn chứng từ đơn mua — tách khỏi DonChungTuScreen.tsx
 * (28/09/2026, bước 3 kế hoạch chất lượng UI; file cũ 4.384 dòng). Giữ NGUYÊN
 * thứ tự câu lệnh gốc — thứ tự gọi hook không đổi. Trả về mọi tên đã khai để
 * các khối giao diện (`dau-don.tsx`, `dong-hang.tsx`…) lấy đúng thứ mình dùng.
 */
export function useDonChungTu(p: Props) {
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

  /**
   * Bố cục ĐỌC mới (menu) — mọi lúc không SOẠN nháp. Sửa tại chỗ (điều khoản,
   * đợt, và từ B3 cả dòng hàng theo luật điều chỉnh) đều ở trong bố cục này:
   * lưới dòng sửa được ngay trong mục "Dòng hàng", không nhảy sang bố cục soạn.
   */
  const viewMode = !!po && (!editing || adjusting)

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

  /*
    ĐỒNG BỘ header khi `po` đổi sau `router.refresh()` (vá 28/09/2026). Header khởi
    tạo MỘT LẦN từ po; server có thể tự đổi hạn giao (kéo theo đợt sớm nhất) sau
    một lượt Lưu, và header cũ làm chip bày ngày sai, lượt Sửa kế tiếp tưởng
    "đã đổi ngày" rồi gọi /reschedule lùi cả đợt về ngày cũ (đo trên đơn test).
    Mẫu React "chỉnh state khi prop đổi" — không dùng useEffect để khỏi vẽ hai nhịp.
  */
  const [syncedAt, setSyncedAt] = useState(po?.updated_at ?? null)
  if (po && (po.updated_at ?? null) !== syncedAt) {
    setSyncedAt(po.updated_at ?? null)
    if (!editing && !termsEdit) setHeader(headerFromPo(po, p.extraLsx.map((x) => x.id))) // prettier-ignore
  }

  // Đơn đã phát hành giữ tổng kg/m² đã chốt (xem `Line.qty2_saved`), nháp chạy theo ô nhập.
  const keepQty2 = !!po && po.status !== 'draft'
  const linesFromProps = () =>
    p.lines.map(
      (l) =>
      lineFromPo(l, l.material_id ? (p.stock[l.material_id] ?? null) : null, keepQty2, (po?.template ?? p.seedHeader?.template) as PoTemplate | undefined), // prettier-ignore
    )
  const [lines, setLines] = useState<Line[]>(linesFromProps)
  // Cùng lý do với header ở trên: dòng đổi trên server (điều chỉnh, nhận hàng)
  // thì lưới đọc phải theo — chỉ khi không đang sửa.
  const [syncedLines, setSyncedLines] = useState(p.lines)
  if (p.lines !== syncedLines) {
    setSyncedLines(p.lines)
    if (!editing && !termsEdit) setLines(linesFromProps())
  }

  const [sel, setSel] = useState<string[]>([])

  const [pick, setPick] = useState<number>(0)

  const [busy, setBusy] = useState(false)

  const [sheet, setSheet] = useState<null | { action: DocAction }>(null)

  const [xacNhan, setXacNhan] = useState<null | 'confirm' | 'add'>(null)

  const [dot, setDot] = useState<null | {
    kind: 'reschedule' | 'cancel' | 'edit' | 'split'
    s: ShipmentLite
  }>(null)
  // prettier-ignore
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

  const [enrich, setEnrich] = useState<{
    items: CatalogSuggestion[]
    dest: string
    poCode: string
  } | null>(null)
  // prettier-ignore
  const [enrichBusy, setEnrichBusy] = useState(false)

  /** Người dùng đã tự chỉnh VAT / tiền tệ — đổi mẫu / đổi NCC không áp đè lại. */
  const dirty = useRef({
    vat: !!po || !!p.seedHeader,
    currency: !!po || !!p.seedHeader,
    template: !!po || !!p.seedHeader,
  })
  // Khối giao diện nhận `dirty` qua props nên không được ghi thẳng ref (react-hooks/immutability).
  const markDirty = (k: keyof typeof dirty.current) => {
    dirty.current[k] = true
  }
  // prettier-ignore
  const [askCancel, setAskCancel] = useState(false)

  const [headOpen, setHeadOpen] = useState(false)
  const [dotMo, setDotMo] = useState(false) // Lúc soạn, khối Chia đợt chỉ hiện khi bấm nút (30/09/2026).

  const [reason, setReason] = useState('')

  const [date, setDate] = useState('')

  const [denseRaw, setDenseRaw] = useLocalPref(DENSE_KEY, DENSE_DEFAULT)

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

  const { grid: gridFields, detail: detailFields } = useMemo(
    () => splitLineFields(allFields),
    [allFields],
  )
  // prettier-ignore
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
  const [detailOpenRaw, setDetailOpenRaw] = useLocalPref('hg.mua-hang.don.chi-tiet-dong', '0')
  // prettier-ignore
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

  const statusById = useMemo(
    () => new Map(p.statusLines.map((s) => [s.id, s])),
    [p.statusLines],
  )
  // prettier-ignore
  /** SL từng dòng đã hẹn trong đợt giao CÒN SỐNG — cùng luật hàm DB 0210. */
  const plannedLive = useMemo(() => {
    const m = new Map<string, number>()
    for (const sh of p.shipments) {
      if (sh.status !== 'planned' && sh.status !== 'arrived') continue
      for (const x of sh.lines) m.set(x.po_line_id, (m.get(x.po_line_id) ?? 0) + x.qty)
    }
    return m
  }, [p.shipments])

  const origById = useMemo(
    () => new Map(p.lines.flatMap((l) => (l.id ? [[l.id, l] as const] : []))),
    [p.lines],
  )
  // prettier-ignore
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
  const adjRow = useMemo(
    () =>
      new Map(
        (adjPlan?.changes ?? [])
          .filter((c) => c.kind !== 'removed')
          .map((c) => [c.no - 1, c]),
      ),
    [adjPlan],
  )
  // prettier-ignore
  const adjErrors = adjPlan ? [...(problem ? [problem] : []), ...adjPlan.errors] : []

  const adjBlocked = adjErrors[0] ?? null

  const nextSeq = (adjustments.at(-1)?.seq ?? 0) + 1

  const unsentAdj = [...adjustments].reverse().find((a) => !a.sent_at) ?? null

  /** Ai nhận thông báo khi áp dụng — cùng luật server: người đã ký duyệt, trừ chính mình. */
  const notifyWho = !po?.approver_name
    ? 'người có quyền duyệt đơn mua'
    : po.approver_name === me.name
      ? null
      : po.approver_name
  // prettier-ignore
  const checks = po ? poChecks(po, p.lines, today) : []

  const blockers = checks.filter((c) => c.level === 'stop')

  const cur = lines[Math.min(pick, lines.length - 1)] ?? null

  const curIdx = cur ? lines.indexOf(cur) : -1

  /* ── sửa dòng ─────────────────────────────────────────────────────── */
  // Sửa ô nào của dòng thì tổng kg đã chốt hết hiệu lực — số chạy theo ô nhập.
  const patch = (i: number, part: Partial<Line>) =>
    setLines((ls) => ls.map((l, k) => (k === i ? { ...l, qty2_saved: null, ...part } : l))) // prettier-ignore

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
   * THÊM MỘT VẬT TƯ từ ô tìm. MÃ ĐÃ CÓ TRÊN ĐƠN THÌ NHẢY TỚI DÒNG ĐÓ (14/09/2026:
   * trước đó gõ lại một mã là ra hai dòng, tới lúc Lưu mới ăn 400 trùng dòng) —
   * nhảy chứ không im lặng bỏ qua, kẻo người dùng bấm lại rồi đi tìm lỗi. TRỪ mẫu
   * cắt theo chiều dài (`sameMaterialManyLines`): thêm dòng để khai chiều dài khác.
   */
  const addMaterial = (m: PoMaterial) => {
    const cu = lines.findIndex((l) => l.material_id === m.id)
    if (cu >= 0 && !sameMaterialManyLines(template)) {
      setPick(cu)
      focusQty(cu)
      toast.info(`${m.code} đã có ở dòng ${cu + 1}`, 'Sửa số lượng ngay trên dòng đó.')
      return
    }
    const t = cu >= 0 ? template : tplForFirst(m)
    setLines((ls) => [...ls, newLine(t, m)])
    setPick(lines.length)
    focusQty(lines.length)
    if (cu >= 0) toast.info(`${m.code} đã có ở dòng ${cu + 1} — thêm dòng mới`, 'Khai chiều dài cây / quy cách khác cho dòng này; trùng cả chiều dài thì gộp vào dòng cũ.') // prettier-ignore
  }

  // Đơn mới: mẫu theo nhóm của vật tư đầu tiên (`templateForGroup`); trả mẫu để dòng dựng đúng ngay.
  function tplForFirst(m?: PoMaterial): PoTemplate {
    const t = templateForGroup({ group: m?.group_name, current: template, touched: dirty.current.template, isNew: !po && lines.length === 0, groups: p.groupTemplates ?? {} }) // prettier-ignore
    if (t) changeTemplate(t)
    if (t) toast.info(`Mẫu đơn: ${poTemplateMeta(t).label}`, `Theo nhóm "${m?.group_name}" — đổi được ở ô "Mẫu đơn".`) // prettier-ignore
    return t ?? template
  }

  /**
   * ENTER ĐI TIẾP như Excel: SL đặt → Đơn giá → ô nhập kế tiếp trên dòng → dòng
   * dưới; hết bảng thì về ô tìm vật tư để thêm dòng kế. Tab vẫn hoạt động như
   * thường; Enter là phản xạ của người quen sổ.
   */
  function gridKeys(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return
    const t = e.target as HTMLElement
    if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) || t.closest('.k-gbar')) return // prettier-ignore
    e.preventDefault()
    t.blur()
    const all = [...document.querySelectorAll<HTMLElement>('#dong-hang tbody :is(input:not([type=checkbox]), textarea):not([disabled])')] // prettier-ignore
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
    const stuck = adjusting ? lines.filter((l) => sel.includes(rowKey(l)) && lockedLine(l)) : [] // prettier-ignore
    if (stuck.length > 0) return void toast.warning(`Không bỏ được ${stuck.length} dòng`, `${stuck[0].code || stuck[0].name}: ${lockedLine(stuck[0])}`) // prettier-ignore
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
      nhap.forget()
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

  // SỬA TẠI CHỖ (B1 + B2, 28/09/2026) — hẹn giao · điều khoản · đợt giao; luật ở `sua-tai-cho.ts`.
  const sua = useSuaTaiCho({
    po,
    header,
    shipments: p.shipments,
    // Dòng ĐANG BÀY (đã sửa nếu đang điều chỉnh) — đợt giao kiểm theo SL mới.
    poLines: lines.map((l, i) => ({ id: l.po_line_id, key: rowKey(l) ?? `tu-do-${i}`, material_name: l.name, qty_ordered: typeof l.qty === 'number' ? l.qty : 0 })), // prettier-ignore
    noteOver,
    termsEdit,
    setTermsEdit,
    setHeadOpen, // prettier-ignore
    // `goTo` khai bên dưới — bọc lại để không đụng TDZ; chỉ gọi lúc bấm.
    goTo: (id) => goTo(id),
    resetHeader: () =>
      po &&
      setHeader(
        headerFromPo(
          po,
          p.extraLsx.map((x) => x.id),
        ),
      ),
    setBusy,
    toast,
    router, // prettier-ignore
    /*
      DÒNG HÀNG TRONG CÙNG NÚT SỬA (B3): bước còn điều chỉnh được (đã duyệt →
      đang giao) thì Sửa mở luôn lưới dòng theo luật điều chỉnh (0210) — cùng
      `adjPlan`, cùng hộp lý do, cùng route. Đơn về đủ chỉ còn điều khoản.
    */
    adjust: {
      can: !!po && perms.canEdit && ['approved', 'ordered', 'confirmed', 'in_transit', 'partial'].includes(po.status), // prettier-ignore
      start: () => startAdjust(),
      finish: () => { setAdjSheet(false); setAdjusting(false); setEditing(false); setAdjReason('') }, // prettier-ignore
      pending: !!adjPlan && (adjPlan.changes.length > 0 || !!adjPlan.headerChanges),
      blocked: adjBlocked,
      askReason: () => setAdjSheet(true),
      post: () => postAdjust(),
    },
  })
  const { startEdit, saveTerms } = sua

  /** Vào chế độ điều chỉnh đơn đang chạy — cùng lưới, lưu đi đường khác. */
  function startAdjust() {
    setAdjReason('')
    setLines(linesFromProps())
    setSel([])
    setAdjusting(true)
    setEditing(true)
  }

  /** Chỉ gọi route điều chỉnh; toast / đóng chế độ do `saveTerms` lo (một nút Lưu chung). */
  async function postAdjust() {
    if (!po) throw new Error('Chưa có đơn')
    const body = buildPoPayload(header, lines)
    try {
      return await api<{ seq: number; delta_total: number }>(`/api/dept/supply/pos/${po.id}/adjustments`, { method: 'POST', body: { base_seq: adjustments.at(-1)?.seq ?? 0, reason: adjReason.trim(), vat_rate: body.vat_rate, discount_amount: body.discount_amount, lines: body.lines.map((l, i) => ({ ...l, id: lines[i].po_line_id ?? null })) } }) // prettier-ignore
    } catch (e) {
      // 409 = có người vừa điều chỉnh trước — bản đang sửa đã cũ, nói thẳng.
      if (e instanceof ApiError && e.status === 409) throw new Error(`Đơn vừa được điều chỉnh bởi người khác — ${apiErrorText(e)}`) // prettier-ignore
      throw e
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

  /** Đã khác bản gốc chưa — để Huỷ hỏi lại, và để chặn rời trang mất dữ liệu. */
  const isDirty = () =>
    termsEdit
      ? (!!adjPlan && (adjPlan.changes.length > 0 || !!adjPlan.headerChanges)) ||
        sua.shipChanges > 0 ||
        (!!po && JSON.stringify(header) !== JSON.stringify(headerFromPo(po, p.extraLsx.map((x) => x.id)))) // prettier-ignore
      : nhap.changed()
  // prettier-ignore
  function askCancelEdit() {
    if (isDirty()) setAskCancel(true)
    else cancelEdit()
  }

  function cancelEdit() {
    setAskCancel(false)
    nhap.forget()
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
    setLines(linesFromProps())
    setSel([])
    setEditing(false)
    setAdjusting(false)
    setAdjReason('')
    sua.cancelTermsEdit()
  }

  /* ── hành động theo bước (chế độ xem) ──────────────────────────────── */
  // `hasReceipts` chặn hạ-về-nháp NGAY TRÊN NÚT (có phiếu kho / đã nhận một phần
  // thì sửa dòng làm phiếu nhập mồ côi). Server vẫn kiểm lại — đây chỉ nói trước.
  const hasReceipts =
    p.warehouseDocs.length > 0 ||
    p.statusLines.some((l) => Number(l.qty_received ?? 0) > 1e-6)

  const docActions = po
    ? actionsFor(po.status as PoStatus, {
        own: perms.canEdit,
        approve: perms.canApprove,
        privileged: perms.privileged,
        hasReceipts,
        noEta: !po.expected_at,
        lead: perms.lead,
      })
    : []
  // prettier-ignore
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
    // Bật chế độ Sửa tại chỗ — không rời trang, không gọi route nào ngay.
    // 'adjust' (dòng hàng) gộp vào cùng nút từ B3.
    if (a.id === 'adjust' || a.id === 'edit_terms') return startEdit()
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
  const moqWarn = moqHint(
    supplierOpt?.moq,
    lines.map((l) => ({ unit: l.unit, qty: l.qty === '' ? 0 : Number(l.qty) })),
  )
  // prettier-ignore

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
        hint: l.customer_name, // mã đơn bán bỏ 02/10/2026 — lệnh LAURA nối 11 mã, không ai cần
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
        ...p.warehouseDocs.map((d) => ({ key: d.doc_id, at: d.at, label: `${d.kind === 'receipt' ? 'Phiếu nhập' : d.kind === 'reversal' ? 'Phiếu đảo' : d.kind === 'adjustment' ? 'Điều chỉnh' : 'Trả NCC'} ${d.code}`, detail: `${d.qty_total.toLocaleString('vi-VN')} đơn vị${d.reversal_of ? ` · đảo ${d.reversal_of}` : ''}${d.reversed_by ? ` · đã đảo bởi ${d.reversed_by}` : ''}${d.fix_of ? ` · lập lại thay ${d.fix_of}` : ''}${d.adjust_of ? ` · chênh lệch của ${d.adjust_of}` : ''}`, tone: 'done' as const })), // prettier-ignore
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
    urgent_send: 'gui',
    reassign: 'gui',
    duplicate: 'saoChep',
    cancel: 'huy',
    delete: 'xoa',
  }

  type BarItem = {
    label: string
    icon?: IcoName
    run: () => void
    blocked?: string
    danger?: boolean
  }
  // prettier-ignore
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
        return { label: po?.status === 'partial' ? 'Hẹn giao bù (đợt mới)' : 'Thêm đợt giao', icon: 'them', run: () => setXacNhan('add'), blocked: lyDo(recv.addShipment) } // prettier-ignore
      case 'transit':
        return { label: 'Hàng đang trên đường', icon: 'nhanHang', run: () => start(TRANSIT), blocked: lyDo(recv.transit) } // prettier-ignore
      case 'receive':
        return { label: 'Xử lý giao nhận', icon: 'nhanHang', run: () => router.push(`/mua-hang/theo-doi?don=${poId}`), blocked: lyDo(recv.receive) } // prettier-ignore
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

  const openStockLines = p.statusLines.filter(
    (s) => s.material_id != null && s.qty_open > 0 && !s.closed_short_at,
  )
  // prettier-ignore
  const recv = receiveActions({ status: po?.status ?? 'draft', canEdit: perms.canEdit, hasStockLines: shipLines.length > 0, openStockLines: openStockLines.length })
  // prettier-ignore

  const sentToSupplier = ['ordered', 'confirmed', 'in_transit', 'partial', 'received'].includes(po?.status ?? '')
  // prettier-ignore

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
        ? call(
            `/api/dept/supply/pos/${po.id}/shipments`,
            'POST',
            { shipments: ships },
            'Đã thêm đợt giao',
          )
        : call(
            `/api/dept/supply/pos/${po.id}/confirm`,
            'POST',
            { confirmed_note: note || null, shipments: ships },
            `Đã ghi nhận NCC xác nhận · ${ships.length} đợt`,
          )
  // prettier-ignore
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
  const ADV = (to: string) => ({
    path: `/api/dept/supply/pos/${po?.id}/advance`,
    method: 'POST' as const,
    body: { to },
  })
  // prettier-ignore
  const CONFIRM_PLAIN: DocAction = { id: 'confirm', label: 'NCC xác nhận', ui: 'sheet', stakes: 'vua', consequence: `Ghi nhận ${po?.supplier_name ?? 'NCC'} đã nhận đơn. Đơn toàn dòng tự gõ nên không có đợt giao để khai.`, done: 'Đã ghi nhận NCC xác nhận', build: () => [ADV('confirmed')] }
  // prettier-ignore
  const TRANSIT: DocAction = { id: 'transit', label: 'Hàng đang trên đường', ui: 'sheet', stakes: 'vua', consequence: 'NCC báo đã xuất hàng. Đơn chuyển sang "Đang giao" để Kho biết mà chờ nhận — hẹn giao và số lượng không đổi.', done: 'Đã chuyển sang đang giao', build: () => [ADV('in_transit')] }
  // prettier-ignore
  const ACCEPT: DocAction = { id: 'accept', label: 'Nghiệm thu ngoài sổ', ui: 'sheet', stakes: 'nang', consequence: 'Đóng đơn KHÔNG qua phiếu kho — chỉ cho đơn toàn dòng tự gõ (gỗ, gia công) nghiệm thu ngoài sổ kho. Đơn sang "Đã nhận đủ".', done: 'Đã nghiệm thu', build: () => [ADV('received')] }
  // prettier-ignore
  /**
   * CHỐT PHẦN THIẾU — cả đơn (`target` trống) hoặc ĐÚNG MỘT DÒNG.
   *
   * Route nhận `line_id` từ 0154 nhưng màn này vẫn gửi `null`, nên người mua
   * chỉ có lựa chọn "được ăn cả": đơn 12 mã mà NCC hết đúng 1 mã thì chốt cả
   * đơn là nói dối sổ — 11 mã kia vẫn đang chờ về thật.
   */
  const closeShortAct = (target?: { id: string; label: string; missing: number; unit: string }): DocAction => ({ id: 'close_short', label: target ? `Chốt thiếu · ${target.label}` : 'Chốt phần thiếu', ui: 'sheet', stakes: 'nang', needReason: true, reasonLabel: 'Vì sao NCC không giao nữa', reasonHint: 'Ghi vào vết của đơn. Phần thiếu không còn tính là "đang đặt" — Kho và kế hoạch thấy ngay.', consequence: target ? `Chốt ${fmtNum(target.missing)} ${target.unit} còn thiếu của dòng này. Các dòng khác của đơn không đổi. NCC đổi ý giao bù thì mở lại được.` : `${openStockLines.length} dòng còn thiếu sẽ chốt. NCC đổi ý giao bù thì mở lại được từng dòng.`, confirmLabel: 'Chốt phần thiếu', done: target ? 'Đã chốt thiếu dòng này' : 'Đã chốt phần thiếu', build: ({ id, reason }) => [{ path: `/api/dept/supply/pos/${id}/close-short`, method: 'POST', body: { action: 'close', line_id: target?.id ?? null, reason } }] })
  // prettier-ignore
  /**
   * MỞ LẠI một dòng đã chốt — NCC đổi ý giao bù. Không bắt lý do: mở lại là
   * quay về hiện trạng THẬT, không phải một quyết định cần biện minh.
   */
  const reopenAct = (target: { id: string; label: string }): DocAction => ({ id: 'close_short', label: `Mở lại · ${target.label}`, ui: 'sheet', stakes: 'vua', consequence: 'Dòng này chờ về trở lại: phần thiếu tính lại là "đang đặt", đơn đã "về đủ" sẽ quay về "về một phần". Chốt lại lúc nào cũng được.', confirmLabel: 'Mở lại dòng', done: 'Đã mở lại dòng', build: ({ id }) => [{ path: `/api/dept/supply/pos/${id}/close-short`, method: 'POST', body: { action: 'reopen', line_id: target.id } }] })
  // prettier-ignore
  const CLOSE_SHORT = closeShortAct()

  /* ── soạn đơn: nhu cầu lệnh · dán Excel · vật tư mới · danh mục · nháp ── */
  const usedIds = useMemo(() => new Set(lines.map((l) => l.material_id)), [lines])

  const pending = pendingNeeds(needs, lines)

  /** Đề xuất mua theo mã, từ nhu cầu của lệnh — nuôi nút "dùng N ↩" trên ô SL. */
  const suggestByMat = useMemo(
    () => new Map(needs.map((n) => [n.material_id, n.suggest])),
    [needs],
  )
  // prettier-ignore
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

  const lsxLabel =
    header.poType === 'lsx'
      ? lsxJoinedLabel(header.lsxId, header.extraLsxIds, p.lsxs)
      : null
  // prettier-ignore

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
  // prettier-ignore
  function addMaterials(list: PoMaterial[], extras?: Map<string, { qty?: number | null; price?: number | null; note?: string | null }>) {
    const seen = new Set<string>()
    const add = list.filter((m) => !usedIds.has(m.id) && !seen.has(m.id) && (seen.add(m.id), true))
    if (add.length === 0) return
    const t = tplForFirst(add[0])
    setPick(lines.length)
    setLines((ls) => [
      ...ls,
      ...add.map((m) => {
        const l = newLine(t, m)
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
    if (n > 0) toast.success(`Đã thêm ${n} dòng từ vùng dán`, dup > 0 ? `${dup} mã đã có trên đơn, không thêm lại` : undefined) // prettier-ignore
    else if (dup > 0) toast.warning('Không thêm dòng nào', `${dup} mã trong vùng dán đã có trên đơn`) // prettier-ignore
  }

  /** Từ nhu cầu lệnh: nạp hồ sơ vật tư (kg/m, dài cây…) rồi mới thành dòng — thiếu thì dòng nhôm không tính được tiền. */
  async function addFromNeeds(list: Need[]) {
    const ids = list.map((n) => n.material_id).filter((id) => !usedIds.has(id))
    if (ids.length === 0) return
    try {
      const mats = await fetchMaterialsByIds(ids)
      const byId = new Map(mats.map((m) => [m.id, m]))
      const t = tplForFirst(byId.get(ids[0]))
      setLines((ls) => {
        const have = new Set(ls.map((l) => l.material_id))
        const add: Line[] = []
        for (const n of list) {
          const m = byId.get(n.material_id)
          if (!m || have.has(n.material_id)) continue
          // SL đặt để trống cho người mua quyết; nhu cầu và phân bổ theo SP đổ sẵn.
          add.push({ ...newLine(t, m), qty_demand: n.qty_needed, note: allocationNote(n.breakdown ?? []).slice(0, 500) }) // prettier-ignore
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

  // TỰ LƯU NHÁP + chặn rời trang mất dữ liệu — xem `useNhapAnToan`.
  const draftKey = draftKeyFor(po?.id ?? null, [p.seed?.lsxId, p.seed?.supplierId, p.seedCodes?.codes.join(',')]) // prettier-ignore
  const snap = useMemo(() => ({ header, lines, shipCols }), [header, lines, shipCols])
  const nhap = useNhapAnToan({ drafting, draftKey, snap, isDirty: () => isDirty(), apply: restoreDraft }) // prettier-ignore

  // Ctrl+S = Lưu (phản xạ Excel); rời trang bằng trình duyệt khi đang sửa dở thì hỏi.
  // useEffectEvent: hàm luôn đọc state MỚI NHẤT mà không phải gỡ/gắn lại listener.
  // Bản trước để effect KHÔNG có deps → mỗi phím gõ trong lưới gỡ rồi gắn lại hai
  // listener trên window (vercel-react-best-practices: advanced-event-handler-refs).
  const onSaveKey = useEffectEvent((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      if (busy) return
      if (termsEdit) void saveTerms()
      else if (!problem) void save()
    }
  })
  const onLeavePage = useEffectEvent((e: BeforeUnloadEvent) => {
    if (isDirty()) e.preventDefault()
  })
  useEffect(() => {
    if (!editing && !termsEdit) return
    const onKey = (e: KeyboardEvent) => onSaveKey(e)
    const onLeave = (e: BeforeUnloadEvent) => onLeavePage(e)
    window.addEventListener('keydown', onKey)
    window.addEventListener('beforeunload', onLeave)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('beforeunload', onLeave)
    }
  }, [editing, termsEdit])

  function restoreDraft(d: SavedDraft) {
    setHeader(d.header)
    setLines(d.lines)
    setShipCols(d.shipCols ?? [])
    dirty.current = { vat: true, currency: true, template: true }
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
  const trackLines: TrackLine[] = p.lines.flatMap((l) =>
    l.id
      ? [
          {
            id: l.id,
            code: l.material_code || null,
            name: l.material_name,
            unit: l.material_unit,
            qty_ordered: Number(l.qty_ordered),
          },
        ]
      : [],
  )
  // prettier-ignore
  const trackById = new Map(trackLines.map((l) => [l.id, l]))

  const openIssues = (p.tracking?.issues ?? []).filter((i) => i.status === 'mo').length

  /*
    PHẦN GIAO THIẾU THẬT — chỉ tính khi hàng ĐÃ về ít nhất một lần hoặc dòng đã
    chốt thiếu. Đơn vừa gửi chưa về gì thì "còn thiếu" = cả đơn, và nút "tạo đơn
    bổ sung" lúc đó là mời đặt trùng (thử trên đơn test 27/09/2026).
  */
  // Đơn bổ sung CHỈ lấy dòng ĐÃ CHỐT THIẾU (NCC không giao nữa) — dòng còn thiếu
  // mà chưa chốt nghĩa là NCC vẫn đang giao, bổ sung lúc đó là đặt trùng.
  const missingTotal = p.statusLines
    .filter((s) => !!s.closed_short_at)
    .reduce((t, s) => t + Math.max(0, Number(s.qty_missing ?? 0)), 0)
  // prettier-ignore
  const openShortLines = p.statusLines.filter((s) => !s.closed_short_at && Number(s.qty_received ?? 0) > 0 && Number(s.qty_missing ?? 0) > 1e-6).length
  // prettier-ignore
  const closedShort = new Set(
    p.statusLines.filter((x) => !!x.closed_short_at).map((x) => x.id),
  )

  // Dòng đã chốt thiếu là dòng ĐÃ ĐÓNG — không còn gì để NCC hẹn.
  const notFullyConfirmed =
    po && po.confirmed_at
      ? trackLines
          .filter((l) => !closedShort.has(l.id))
          .filter((l) => {
            const live = p.shipments.filter((s) => s.status !== 'cancelled')
            if (live.length === 0) return false
            const c = live.reduce(
              (t, s) =>
                t +
                s.lines
                  .filter((x) => x.po_line_id === l.id)
                  .reduce((a, x) => a + x.qty, 0),
              0,
            )
            return c < l.qty_ordered - 1e-6
          }).length
      : 0
  // prettier-ignore
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

  const statusTone =
    track.tone === 'wait'
      ? 'warn'
      : track.tone === 'done'
        ? 'done'
        : track.tone === 'stop'
          ? 'stop'
          : undefined
  // prettier-ignore
  const daVeDu = po?.status === 'received'

  const lastReceipt = phieuNhapCuoi(p.warehouseDocs)

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
    ...vuongPhieuKho(p.warehouseDocs),
  ]

  return {
    p,
    router,
    muc,
    setMuc,
    pickMuc,
    toast,
    po,
    perms,
    me,
    today,
    editing,
    setEditing,
    adjusting,
    setAdjusting,
    drafting,
    viewMode,
    adjSheet,
    setAdjSheet,
    adjReason,
    setAdjReason,
    sentSheet,
    setSentSheet,
    sentNote,
    setSentNote,
    adjustments,
    costs,
    phiOpen,
    setPhiOpen,
    phiVoid,
    setPhiVoid,
    suCoOpen,
    setSuCoOpen,
    suCoClose,
    setSuCoClose,
    termsEdit,
    setTermsEdit,
    ...sua,
    header,
    setHeader,
    lines,
    setLines,
    sel,
    setSel,
    pick,
    setPick,
    busy,
    setBusy,
    sheet,
    setSheet,
    xacNhan,
    setXacNhan,
    dot,
    setDot,
    shipCols,
    setShipCols,
    needs,
    setNeeds,
    needsLoading,
    setNeedsLoading,
    paste,
    setPaste,
    quickAdd,
    setQuickAdd,
    editMaterial,
    setEditMaterial,
    preview,
    setPreview,
    enrich,
    setEnrich,
    enrichBusy,
    setEnrichBusy,
    nhap,
    dirty,
    markDirty,
    askCancel,
    setAskCancel,
    headOpen,
    setHeadOpen,
    reason,
    setReason,
    date,
    setDate,
    denseRaw,
    setDenseRaw,
    dense,
    template,
    meta,
    tplTerms,
    tplSigner,
    allFields,
    gridFields,
    detailFields,
    detailOpenRaw,
    setDetailOpenRaw,
    detailOpen,
    setDetailOpen,
    totals,
    issues,
    termsEditing,
    problem,
    NOTE_MAX,
    noteOver,
    statusById,
    plannedLive,
    origById,
    lockedLine,
    adjPlan,
    adjRow,
    adjErrors,
    adjBlocked,
    nextSeq,
    unsentAdj,
    notifyWho,
    checks,
    blockers,
    cur,
    curIdx,
    patch,
    setField,
    focusQty,
    addMaterial,
    gridKeys,
    addFree,
    removeSel,
    changeTemplate,
    save,
    startAdjust,
    markSent,
    isDirty,
    askCancelEdit,
    cancelEdit,
    hasReceipts,
    docActions,
    runAction,
    start,
    sheetInvalid,
    holder,
    track,
    recvIdx,
    veKho,
    lsx,
    supplierOpt,
    moqWarn,
    lsxOptions,
    supplierOptions,
    marks,
    costWhy,
    costShare,
    bar,
    DOC_ICON,
    barItem,
    code,
    primary,
    secondary,
    editAct,
    editLabel,
    shipLines,
    shipLinesById,
    shippedByLine,
    liveShipments,
    shipmentsDone,
    openStockLines,
    recv,
    sentToSupplier,
    call,
    submitShipments,
    shipmentAct,
    ADV,
    CONFIRM_PLAIN,
    TRANSIT,
    ACCEPT,
    closeShortAct,
    reopenAct,
    CLOSE_SHORT,
    usedIds,
    pending,
    suggestByMat,
    capLeft,
    lsxsOfPo,
    lsxLabel,
    addMaterials,
    addFromPaste,
    addFromNeeds,
    onCreatedMaterial,
    saveToCatalog,
    toggleExtraLsx,
    seeded,
    confirmEnrich,
    goTo,
    goToProblem,
    trackLines,
    trackById,
    openIssues,
    missingTotal,
    openShortLines,
    closedShort,
    notFullyConfirmed,
    moneyRows,
    split,
    toMenu,
    headActions,
    headMenu,
    nextItem,
    statusMoves,
    statusTone,
    daVeDu,
    lastReceipt,
    hanGiao,
    conNgay,
    giaoSignal,
    finSignal,
    mucItems,
    hanText,
    finView,
    holderDays,
    vuong,
    dotMo,
    setDotMo,
  } as const
}

export type DonCtx = ReturnType<typeof useDonChungTu>
