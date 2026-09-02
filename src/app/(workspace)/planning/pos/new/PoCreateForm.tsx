'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ClipboardList,
  ClipboardPaste,
  Plus,
  Printer,
  ScrollText,
  Search,
  Sparkles,
  Truck,
} from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { Button } from '@/components/shadcn/button'
import { Breadcrumbs } from '@/components/erp/Breadcrumbs'
import {
  MaterialPickDialog,
  invalidateMaterialPickCache,
  type PoMaterial,
} from '@/components/supply/MaterialPicker'
import type { CatalogSuggestion } from '@/lib/po-catalog-backfill'
import { allocationNote } from '@/lib/po-allocation'
import {
  FREE_LINE_TEMPLATES,
  poTemplateMeta,
  type PoTemplate,
  type PoTerms,
} from '@/lib/po-template'
import { Modal } from '@/components/Modal'
import { PoPrintSheet } from '@/app/print/supply/PoPrintSheet'
import type { DocTemplate } from '@/lib/doc-templates'
import { PoLineTable } from './PoLineTable'
import { HeaderChips } from './sections/HeaderChips'
import { TotalsBar } from './sections/TotalsBar'
import {
  ShipmentPlanPanel,
  columnsToShipments,
  type PlanColumn,
} from './sections/ShipmentPlanPanel'
import { NeedsPanel, type Need } from './sections/NeedsPanel'
import { TermsSection } from './sections/TermsSection'
import { QuickAddMaterial } from './QuickAddMaterial'
import { EditMaterialDialog } from './EditMaterialDialog'
import { PasteLinesDialog, type PasteConfirm } from './PasteLinesDialog'
import {
  buildPoPayload,
  draftProblem,
  poTotals,
  readyLineCount,
  templateDefaults,
  type PoHeader,
} from './po-draft'
import {
  migrateDraftLine,
  newFreeLine,
  newLine,
  refreshLineFromMaterial,
  type Line,
} from './po-line'
import { previewHeaderFromDraft, previewLinesFromDraft } from './po-preview'

type SupplierOption = {
  id: string
  name: string
  rating: string | null
  lead_time_days: number | null
  payment_terms: string | null
  /** Tiền tệ mặc định của NCC — chọn NCC là ô tiền tệ tự chuyển theo. */
  currency?: string | null
  /** Chỉ dùng cho khối "Kính gửi" của phiếu xem trước. */
  address?: string | null
  tax_no?: string | null
  phone?: string | null
}
type LsxOption = {
  id: string
  code: string
  order_codes: string[]
  customer_name: string
}

/** Đơn đang mở sẵn — server page dựng từ `posService.detail`. */
export type PoInitial = {
  mode: 'edit' | 'duplicate'
  po: {
    id: string
    code: string
    template: PoTemplate
    production_order_id: string | null
    /** LSX PHỤ gộp vào đơn (0125). */
    extra_lsx_ids: string[]
    supplier_id: string
    currency: string
    vat_rate: number | null
    price_includes_vat: boolean
    discount_amount: number | null
    contract_no: string | null
    expected_at: string | null
    note: string | null
    signer_role: string | null
    terms: PoTerms
  }
  lines: Line[]
  /**
   * Kế hoạch chia đợt đã lưu (28/08) — khoá theo CHỈ SỐ dòng, đúng thứ tự
   * `lines` ở trên. Chế độ sửa nạp lại để người dùng chỉnh chứ không phải gõ
   * lại từ đầu; nhân bản đơn thì cố ý bỏ (lịch của lần mua trước không còn
   * đúng cho lần này).
   */
  shipments?: { date: string; qty: Record<number, number | ''> }[]
}

/**
 * TỰ LƯU BẢN NHÁP vào trình duyệt (bất cập #5, 09/08/2026): đơn 20 dòng gõ dở
 * mà F5 / mất mạng / lỡ đóng tab là mất sạch — Excel thì Ctrl+S theo phản xạ
 * nên không ai nghĩ tới chuyện này cho tới khi mất. Form ghi localStorage sau
 * mỗi nhịp gõ (debounce), mở lại trang thì đề nghị khôi phục.
 *
 * 13/08/2026: mở rộng cho CẢ CHẾ ĐỘ SỬA (khóa riêng theo đơn,
 * `hg-po-draft-<id>`) — điều hướng nội bộ SPA không bắn beforeunload nên bấm
 * nhầm một link sidebar là mất trắng chỉnh sửa; autosave + banner khôi phục
 * đỡ được mọi kiểu rời trang. Chế độ sửa chỉ ghi khi state KHÁC bản server
 * (mốc `baselineRef`) để không gắn banner "sửa dở" oan.
 */
const DRAFT_KEY = 'hg-po-draft-new'

/*
 * "Đề xuất từ BOM" từng TẮT TOÀN CỤC (11/08/2026) vì định mức đang làm lại.
 * BẬT LẠI CÓ KIỂM SOÁT (12/08/2026, user chốt): needs đọc từ BẢNG CHI TIẾT của
 * chính lệnh (ưu tiên nhập tay, fallback BOM×SL — xem /api/dept/supply/needs),
 * lệnh nào Kỹ thuật đã nhập thì số là số thật; lệnh chưa có dữ liệu thì panel
 * tự ẩn (needs rỗng) — im như hồi tắt. Panel mang nhãn "số nháp — đối chiếu
 * trước khi dùng", và số vẫn chỉ là gợi ý bấm-để-dùng.
 */

type SavedDraft = {
  at: string
  template: PoTemplate
  poType: 'lsx' | 'standalone'
  lsxId: string
  extraLsxIds: string[]
  supplierId: string
  expectedAt: string
  contractNo: string
  currency: string
  note: string
  discount: number | ''
  vat: number | ''
  inclVat: boolean
  vatDirty: boolean
  terms: PoTerms
  signerRole: string
  lines: Line[]
}

function readSavedDraft(key: string): SavedDraft | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const d = JSON.parse(raw) as SavedDraft
    // Nháp rỗng (chưa có dòng nào) không đáng một cái banner.
    return Array.isArray(d.lines) && d.lines.length > 0 ? d : null
  } catch {
    return null
  }
}

/**
 * SOẠN ĐƠN ĐẶT HÀNG — trục là MẪU ĐƠN THEO LOẠI HÀNG.
 *
 * Phòng Cung ứng không dùng một mẫu đơn: rà 8 file đơn thật ra 5 mẫu khác nhau cả
 * bộ cột dòng hàng lẫn công thức tiền, VAT và khối chữ ký (bảng đối chiếu trong
 * `@/lib/po-template`). Form cũ nhồi chung một bảng 10 cột nên dòng nhôm phải
 * mượn ô của dòng vít, và nhân viên tự bấm máy tính ra tổng kg.
 *
 * Ở đây: chọn LSX → chọn mẫu → chọn NCC, rồi bảng tự đổi cột theo mẫu. Ô tính sẵn
 * (tổng kg, m², thành tiền) nền xám không gõ được; hai ô luôn phải gõ là SL đặt
 * và Đơn giá. Dòng nhập nhanh nằm cuối bảng, chọn xong vật tư là con trỏ ở lại ô
 * tìm nên thêm dòng liên tiếp không cần rời bàn phím.
 */
export function PoCreateForm({
  suppliers,
  lsxs,
  company,
  tpl,
  defaultSupplierId,
  defaultLsxId,
  initial,
}: {
  suppliers: SupplierOption[]
  lsxs: LsxOption[]
  /** Đầu phiếu (tên cty, MST, địa danh) cho bản xem trước — từ Cài đặt. */
  company: Record<string, string | null>
  /** Mẫu in của PO (0164) — server nạp, truyền xuống để ô xem trước dựng đúng
   *  tờ sẽ gửi NCC. Thiếu thì PoPrintSheet tự dùng mặc định trong code. */
  tpl?: DocTemplate
  defaultSupplierId?: string
  /** `?lsx=` — mở form từ màn "Vật tư theo lệnh", chọn sẵn lệnh + nạp nhu cầu. */
  defaultLsxId?: string
  /** Có = mở đơn có sẵn: 'edit' ghi đè đơn cũ, 'duplicate' tạo đơn mới từ nó. */
  initial?: PoInitial
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)

  const isEdit = initial?.mode === 'edit'
  const start = initial?.po
  const startMeta = poTemplateMeta(start?.template ?? 'accessory')

  const [template, setTemplate] = useState<PoTemplate>(start?.template ?? 'accessory')
  const [poType, setPoType] = useState<'lsx' | 'standalone'>(
    start ? (start.production_order_id ? 'lsx' : 'standalone') : 'lsx',
  )
  const [lsxId, setLsxId] = useState(
    start?.production_order_id ??
      (defaultLsxId && lsxs.some((l) => l.id === defaultLsxId) ? defaultLsxId : ''),
  )
  // LSX PHỤ gộp vào đơn (0125) — đơn thật ghi "LSX 01+2+3/26-27".
  const [extraLsxIds, setExtraLsxIds] = useState<string[]>(start?.extra_lsx_ids ?? [])
  const [supplierId, setSupplierId] = useState(
    start?.supplier_id ??
      (defaultSupplierId && suppliers.some((s) => s.id === defaultSupplierId)
        ? defaultSupplierId
        : ''),
  )
  const [expectedAt, setExpectedAt] = useState(start?.expected_at ?? '')
  const [contractNo, setContractNo] = useState(start?.contract_no ?? '')
  const [currency, setCurrency] = useState(
    start?.currency ??
      // Vào form với NCC chọn sẵn (?supplier=…) thì tiền tệ theo NCC luôn.
      suppliers.find((s) => s.id === defaultSupplierId)?.currency?.toUpperCase() ??
      'VND',
  )
  /**
   * Người dùng ĐÃ TỰ CHỌN tiền tệ chưa — có thì đổi NCC KHÔNG áp lại tiền tệ
   * mặc định của NCC mới nữa (cùng lối với `vatDirty`). Mở đơn có sẵn coi như
   * đã chọn: currency là số đã chốt với NCC.
   */
  const [currencyDirty, setCurrencyDirty] = useState(!!start)
  const [note, setNote] = useState(start?.note ?? '')
  const [discount, setDiscount] = useState<number | ''>(start?.discount_amount ?? '')

  const meta = poTemplateMeta(template)
  // VAT và điều khoản đi theo mẫu, nhưng phải sửa được: cùng mẫu vẫn có NCC chào
  // khác. Đổi mẫu thì nạp lại mặc định của mẫu mới (xem selectTemplate). Mở đơn có
  // sẵn thì giữ nguyên số đã chốt với NCC, không áp lại mặc định của mẫu.
  const [vat, setVat] = useState<number | ''>(start?.vat_rate ?? startMeta.vatRate ?? '')
  const [inclVat, setInclVat] = useState(
    start?.price_includes_vat ?? startMeta.priceIncludesVat,
  )
  /**
   * Người dùng ĐÃ TỰ CHỈNH VAT chưa. Có thì đổi mẫu KHÔNG đè lại mặc định của
   * mẫu mới nữa — phòng Cung ứng phản hồi "nhiều NCC để 10%" mà chỉnh xong đổi
   * mẫu là số bị áp lại 8%. Mở đơn có sẵn coi như đã chỉnh (số đã chốt với NCC).
   */
  const [vatDirty, setVatDirty] = useState(!!start)
  const [terms, setTerms] = useState(start?.terms ?? startMeta.terms)
  const [signerRole, setSignerRole] = useState(start?.signer_role ?? startMeta.signerRole)
  const [showTerms, setShowTerms] = useState(true)

  const [lines, setLines] = useState<Line[]>(initial?.lines ?? [])
  const [needs, setNeeds] = useState<Need[]>([])
  const [loadingNeeds, setLoadingNeeds] = useState(false)
  const [showNeeds, setShowNeeds] = useState(true)

  /*
   * BẢO VỆ CHUYỂN TRANG ĐỘT NGỘT (13/08/2026 — user: "chưa có cơ chế bảo vệ").
   * Trước đây autosave CHỈ ở chế độ tạo mới; chế độ SỬA chỉ có beforeunload —
   * tức bấm một link sidebar là mất trắng 20 dòng chỉnh sửa, không cảnh báo,
   * không khôi phục (beforeunload không bắn với điều hướng nội bộ SPA).
   *
   * Nay autosave CẢ HAI chế độ, khóa nháp tách theo đơn (`hg-po-draft-<id>`
   * cho sửa, khóa cũ cho tạo mới) — rời trang kiểu gì quay lại cũng có banner
   * đề nghị khôi phục.
   */
  const draftKey = isEdit ? `hg-po-draft-${initial!.po.id}` : DRAFT_KEY

  // Bản nháp tự lưu tìm thấy lúc mở trang — hiện banner đề nghị khôi phục.
  // setState qua callback của timer, không gọi thẳng thân effect (lint cascading
  // render — cùng lý do với effect nạp taxonomy ở MaterialCoreFields).
  const [savedDraft, setSavedDraft] = useState<SavedDraft | null>(null)
  useEffect(() => {
    // 'duplicate' (nhân bản) không autosave/khôi phục: bản gốc là đơn cũ, mở
    // lại lúc nào cũng dựng lại được — đừng đẻ thêm một lớp nháp gây rối.
    if (initial && initial.mode !== 'edit') return
    const t = setTimeout(() => setSavedDraft(readSavedDraft(draftKey)), 0)
    return () => clearTimeout(t)
  }, [initial, draftKey])

  /**
   * MỐC ĐỐI CHIẾU của chế độ sửa: chụp state lúc mở trang (đúng bản server).
   * Autosave chỉ ghi khi state KHÁC mốc — không thì vừa mở đơn ra xem đã bị
   * gắn banner "sửa dở" oan; quay về đúng bản gốc thì nháp tự xoá.
   */
  const baselineRef = useRef<string | null>(null)
  const dirtyRef = useRef(false)

  useEffect(() => {
    if (initial && initial.mode !== 'edit') return
    if (savedDraft) return // banner chưa được trả lời — đừng đè bản nháp cũ
    const t = setTimeout(() => {
      try {
        const d: SavedDraft = {
          at: '', // điền lúc ghi — không tham gia so sánh với mốc
          template,
          poType,
          lsxId,
          extraLsxIds,
          supplierId,
          expectedAt,
          contractNo,
          currency,
          note,
          discount,
          vat,
          inclVat,
          vatDirty,
          terms,
          signerRole,
          lines,
        }
        const body = JSON.stringify(d)
        if (isEdit && baselineRef.current == null) {
          // Nhịp autosave đầu tiên sau khi mở đơn sửa = đúng bản server → làm mốc.
          baselineRef.current = body
          return
        }
        const unchanged = isEdit ? body === baselineRef.current : lines.length === 0
        dirtyRef.current = !unchanged
        if (unchanged) {
          localStorage.removeItem(draftKey)
          return
        }
        localStorage.setItem(
          draftKey,
          JSON.stringify({ ...d, at: new Date().toISOString() }),
        )
      } catch {
        // localStorage đầy/bị chặn — autosave là lưới an toàn, không chặn việc gõ.
      }
    }, 800)
    return () => clearTimeout(t)
  }, [
    initial,
    isEdit,
    draftKey,
    savedDraft,
    template,
    poType,
    lsxId,
    extraLsxIds,
    supplierId,
    expectedAt,
    contractNo,
    currency,
    note,
    discount,
    vat,
    inclVat,
    vatDirty,
    terms,
    signerRole,
    lines,
  ])

  /*
   * Đóng tab / F5: chặn khi ĐÃ SỬA KHÁC bản gốc (chế độ sửa) — autosave đã giữ
   * nháp nhưng 800ms debounce vẫn hở nhịp gõ cuối; hỏi một câu là rẻ nhất.
   * Tạo mới không hỏi: autosave + banner khôi phục là đủ, chặn F5 chỉ gây bực.
   */
  useEffect(() => {
    if (!isEdit) return
    const h = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [isEdit])

  /*
   * Mở form kèm `?lsx=` (từ màn "Vật tư theo lệnh") — nạp luôn nhu cầu vật tư
   * của lệnh, đúng như khi người dùng tự chọn lệnh trong ô. Không nạp thì người
   * bấm "Đặt vật tư cho lệnh này" phải chọn lại đúng cái lệnh vừa bấm.
   */
  const needsBootRef = useRef(false)
  useEffect(() => {
    if (needsBootRef.current || start || !lsxId) return
    needsBootRef.current = true
    void loadNeeds(lsxId, [])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy đúng một lần lúc mở form
  }, [])

  /** Người dùng bấm "Khôi phục" trên banner — đổ lại toàn bộ state đã lưu. */
  function restoreDraft(d: SavedDraft) {
    setTemplate(d.template)
    setPoType(d.poType)
    setLsxId(d.lsxId)
    setExtraLsxIds(d.extraLsxIds ?? [])
    setSupplierId(d.supplierId)
    setExpectedAt(d.expectedAt)
    setContractNo(d.contractNo)
    setCurrency(d.currency)
    // Nháp đã mang tiền tệ người dùng chốt — đổi NCC sau đó không áp đè lại.
    setCurrencyDirty(true)
    setNote(d.note)
    setDiscount(d.discount)
    setVat(d.vat)
    setInclVat(d.inclVat)
    setVatDirty(d.vatDirty)
    setTerms(d.terms)
    setSignerRole(d.signerRole)
    // Nháp lưu trước 0139: gỗ ghi m³/SP vào weight_per_unit, mro ghi bảo hành
    // vào finish — dọn về cột đúng lúc khôi phục.
    setLines(d.lines.map((l) => migrateDraftLine(d.template, l)))
    setSavedDraft(null)
    if (d.poType === 'lsx' && d.lsxId) void loadNeeds(d.lsxId, d.extraLsxIds ?? [])
  }

  const usedIds = useMemo(() => new Set(lines.map((l) => l.material_id)), [lines])
  const suggestions = useMemo(
    () => new Map(needs.map((n) => [n.material_id, n.suggest])),
    [needs],
  )
  /**
   * Trần tồn (P3.1): còn ĐẶT THÊM được = max_stock − tồn − đã đặt. Chỉ cảnh báo
   * vàng (không chặn) — có LSX lớn thì vượt trần là chủ đích, người mua tự cân.
   */
  const capLeft = useMemo(
    () =>
      new Map(
        needs
          .filter((n) => n.max_stock != null && n.max_stock > 0)
          .map((n) => [
            n.material_id,
            Math.max((n.max_stock ?? 0) - (n.on_hand ?? 0) - (n.ordered ?? 0), 0),
          ]),
      ),
    [needs],
  )
  const lsx = lsxs.find((l) => l.id === lsxId)
  const extraLsxCodes = extraLsxIds.map(
    (id) => lsxs.find((l) => l.id === id)?.code ?? '?',
  )
  /** Nhãn bộ lệnh cho dải bối cảnh + phiếu in — "LSX-04 + LSX-02" như sổ thật. */
  const lsxJoinedCode = lsx ? [lsx.code, ...extraLsxCodes].join(' + ') : null
  const supplier = suppliers.find((s) => s.id === supplierId)

  /**
   * Đổi mẫu → nạp lại điều khoản + chữ ký mặc định (quy tắc ở `po-draft`).
   * VAT chỉ áp mặc định khi người dùng CHƯA tự chỉnh — xem `vatDirty`.
   */
  function selectTemplate(t: PoTemplate) {
    const d = templateDefaults(t)
    setTemplate(t)
    if (!vatDirty) {
      setVat(d.vat)
      setInclVat(d.inclVat)
    }
    setTerms(d.terms)
    setSignerRole(d.signerRole)
  }

  /**
   * Nạp nhu cầu cho CẢ BỘ lệnh (chính + phụ). Gộp ở SERVER, không cộng từng
   * lệnh ở client: mỗi lệnh coi lệnh kia là "đã giữ chỗ", cộng suggest từng
   * lệnh sẽ trừ tồn hai lần.
   */
  async function loadNeeds(primary: string, extras: string[]) {
    setNeeds([])
    if (!primary) return
    setLoadingNeeds(true)
    try {
      const qs = extras.length > 0 ? `&extra_lsx_ids=${extras.join(',')}` : ''
      const data = await api<{ needs: Need[] }>(
        `/api/dept/supply/needs?production_order_id=${primary}${qs}`,
      )
      setNeeds(data.needs)
      // Lệnh lớn (kiểm UI 12/08: LSX 01 có 106 vật tư) mà panel mở sẵn là nó
      // chiếm cả màn giữa hai vùng làm việc — nhiều hơn một lưới 12 thẻ thì
      // THU GỌN, header vẫn đếm đủ và một bấm là bung.
      setShowNeeds(data.needs.length <= 12)
    } catch (e) {
      toast.error('Không tải được nhu cầu', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setLoadingNeeds(false)
    }
  }

  async function selectLsx(id: string) {
    setLsxId(id)
    // LSX vừa thành chính thì rút khỏi danh sách phụ — một lệnh không đứng hai vai.
    const extras = extraLsxIds.filter((e) => e !== id)
    setExtraLsxIds(extras)
    await loadNeeds(id, extras)
  }

  function toggleExtraLsx(id: string, on: boolean) {
    const extras = on
      ? [...extraLsxIds.filter((e) => e !== id), id]
      : extraLsxIds.filter((e) => e !== id)
    setExtraLsxIds(extras)
    void loadNeeds(lsxId, extras)
  }

  /**
   * VÒNG NHẬP, không rời bàn phím: chọn vật tư ở hộp thoại → con trỏ vào SL đặt
   * của dòng đầu vừa thêm → Enter → Đơn giá → Enter → về lại nút "Thêm vật tư"
   * (bấm Enter/Space là mở hộp thoại cho lượt kế).
   */
  const pickerRef = useRef<HTMLButtonElement | null>(null)
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const [pickOpen, setPickOpen] = useState(false)
  /** Vật tư đang mở modal SỬA TẠI CHỖ (giai đoạn hoàn thiện data) — null = đóng. */
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null)
  /** Dán từ Excel (0136) — thêm dòng hàng loạt từ bảng trong sổ. */
  const [pasteOpen, setPasteOpen] = useState(false)
  /** Xem trước phiếu in — dựng từ chính bản nháp đang gõ, không cần lưu đơn. */
  const [previewOpen, setPreviewOpen] = useState(false)

  function addMaterial(m: PoMaterial) {
    addMaterials([m])
  }

  /**
   * Thêm NHIỀU vật tư một lượt — hộp thoại cho tích cả giỏ rồi chốt một lần.
   *
   * Con trỏ nhảy vào SL đặt của dòng ĐẦU TIÊN vừa thêm, không phải dòng cuối:
   * người dùng tích theo thứ tự cần nhập, nên nhập cũng đi theo thứ tự đó.
   */
  function addMaterials(
    list: PoMaterial[],
    /** SL/giá/ghi chú kèm theo (dán từ Excel — 0136) — điền đè sau `newLine`. */
    extras?: Map<
      string,
      { qty?: number | null; price?: number | null; note?: string | null }
    >,
  ) {
    // Bỏ mã đã có trên đơn VÀ mã lặp trong chính danh sách (vùng dán có thể
    // ghi một món hai dòng) — schema chặn trùng dòng lúc gửi, chặn sớm ở đây.
    const seen = new Set<string>()
    const add = list.filter(
      (m) => !usedIds.has(m.id) && !seen.has(m.id) && (seen.add(m.id), true),
    )
    if (add.length === 0) return
    setFocusIndex(lines.length) // dòng mới nối vào cuối bảng
    setLines((ls) => [
      ...ls,
      ...add.map((m) => {
        const l = newLine(template, m)
        const e = extras?.get(m.id)
        if (!e) return l
        return {
          ...l,
          qty: e.qty ?? l.qty,
          price: e.price ?? l.price,
          note: e.note ?? l.note,
        }
      }),
    ])
  }

  /** Dòng tự do (0134) — đơn gỗ/gia công đặt theo MÃ SP, tên gõ ngay trên dòng. */
  function addFreeLine() {
    setFocusIndex(lines.length)
    setLines((ls) => [...ls, newFreeLine()])
  }

  /** Kết quả dán từ Excel (0136): dòng khớp mã + dòng tự gõ, kèm SL/giá của sổ. */
  function addFromPaste(picked: PasteConfirm) {
    const extras = new Map(
      picked.matched.map((p) => [
        p.material.id,
        { qty: p.qty, price: p.price, note: p.note },
      ]),
    )
    addMaterials(
      picked.matched.map((p) => p.material),
      extras,
    )
    if (picked.free.length > 0) {
      setLines((ls) => [
        ...ls,
        ...picked.free.map((f) => ({
          ...newFreeLine(),
          name: f.name,
          qty: (f.qty ?? '') as Line['qty'],
          price: (f.price ?? '') as Line['price'],
          note: f.note ?? '',
        })),
      ])
    }
    const total = picked.matched.length + picked.free.length
    if (total > 0) toast.success(`Đã thêm ${total} dòng từ vùng dán`)
  }

  /**
   * Thêm từ nhu cầu BOM. Nhu cầu chỉ có id/tên/ĐVT nên phải nạp hồ sơ vật tư để
   * lấy kg/m, dài cây, quy cách — thiếu chúng thì dòng nhôm không tính được tiền.
   */
  async function addFromNeeds(list: Need[]) {
    const ids = list.map((n) => n.material_id).filter((id) => !usedIds.has(id))
    if (ids.length === 0) return
    try {
      const { materials } = await api<{ materials: PoMaterial[] }>(
        `/api/dept/supply/po-materials?ids=${ids.join(',')}`,
      )
      const byId = new Map(materials.map((m) => [m.id, m]))
      setLines((ls) => {
        const have = new Set(ls.map((l) => l.material_id))
        const add: Line[] = []
        for (const n of list) {
          if (have.has(n.material_id)) continue
          const m = byId.get(n.material_id)
          if (!m) continue
          // Nhu cầu BOM đổ vào cột "SL đơn hàng" của mẫu phụ kiện; SL đặt vẫn để
          // trống, nhân viên bấm nút gợi ý hoặc tự gõ. Ghi chú đổ sẵn PHÂN BỔ
          // theo SP ("300 Bàn 65 gỗ (4c/sp)") — thứ sổ tay vẫn phải ghi tay.
          add.push({
            ...newLine(template, m),
            qty_demand: n.qty_needed,
            note: allocationNote(n.breakdown ?? []).slice(0, 500),
          })
        }
        return [...ls, ...add]
      })
    } catch (e) {
      toast.error('Không thêm được vật tư', e instanceof ApiError ? e.message : 'Có lỗi')
    }
  }

  function patchLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i))
  }

  /**
   * GHI SỐ CÂN VỀ DANH MỤC (0128) — khai một lần, mọi đơn sau tự điền.
   *
   * Người mua cầm phiếu cân của NCC trong tay đúng lúc lập đơn; trước đây con số
   * đó chỉ sống trong một dòng đơn rồi mất, lần sau lại gõ lại. Chỉ ghi ĐÚNG một
   * trường, không đụng gì khác của vật tư.
   *
   * Ghi xong cập nhật luôn `catalog_*` của MỌI dòng cùng vật tư để nút tự biến
   * mất — đơn có thể có hai dòng cùng mã (khác vị trí lắp), bấm một lần là đủ.
   */
  async function saveToCatalog(
    materialId: string,
    field: 'kgm' | 'kgunit' | 'spec',
    value: number | string,
  ) {
    const col = field === 'kgm' ? 'kg_per_m' : field === 'kgunit' ? 'kg_per_unit' : 'spec'
    try {
      await api(`/api/dept/warehouse/materials/${materialId}`, {
        method: 'PATCH',
        body: { [col]: value },
      })
      setLines((ls) =>
        ls.map((l) =>
          l.material_id === materialId
            ? {
                ...l,
                ...(field === 'kgm'
                  ? { catalog_kg_m: Number(value) }
                  : field === 'kgunit'
                    ? { catalog_kg_unit: Number(value) }
                    : // Quy cách (0136): dòng giữ bản chụp danh mục — cập nhật để
                      // nút "lưu quy cách" tự ẩn và lần sau tự bóc kích thước.
                      { spec: String(value) }),
              }
            : l,
        ),
      )
      toast.success(
        'Đã lưu vào danh mục',
        `${col} = ${typeof value === 'number' ? value.toLocaleString('vi-VN') : value}`,
      )
    } catch (e) {
      toast.error(
        'Không lưu được vào danh mục',
        e instanceof ApiError ? e.message : 'Có lỗi',
      )
    }
  }

  /** Gom đầu đơn lại để đưa cho các hàm thuần ở `po-draft.ts` (có test riêng). */
  const header: PoHeader = {
    template,
    poType,
    lsxId,
    extraLsxIds,
    supplierId,
    expectedAt,
    contractNo,
    currency,
    note,
    discount,
    vat,
    inclVat,
    terms,
    signerRole,
  }
  const { subtotal, vatAmount, grandTotal } = poTotals(header, lines)
  const readyLines = readyLineCount(template, lines)
  const problem = draftProblem(header, lines)

  /**
   * HỘP XÁC NHẬN cập nhật danh mục sau khi lưu đơn (13/08/2026 — user chốt:
   * không tự ghi ngầm). Server trả danh sách "gõ trên dòng mà danh mục đang
   * trống"; người soạn duyệt rồi mới ghi. `dest` giữ đường điều hướng — đóng
   * hộp (đồng ý hay bỏ qua) mới rời trang.
   */
  /**
   * Kế hoạch chia đợt (28/08) — khoá theo CHỈ SỐ dòng trên lưới; server ánh xạ
   * sang po_line_id sau khi ghi dòng (mapDraftShipments).
   */
  const [shipCols, setShipCols] = useState<PlanColumn[]>(() => initial?.shipments ?? [])

  const [enrich, setEnrich] = useState<{
    items: CatalogSuggestion[]
    dest: string
    /** Mã đơn vừa lưu — đi kèm để sổ vết (0177) kể được "vì đơn nào". */
    poCode: string
  } | null>(null)
  const [enrichBusy, setEnrichBusy] = useState(false)

  function leaveTo(dest: string) {
    router.push(dest)
    router.refresh()
  }

  async function confirmEnrich() {
    if (!enrich || enrichBusy) return
    setEnrichBusy(true)
    try {
      const { updated } = await api<{ updated: number }>(
        '/api/dept/warehouse/materials/enrich',
        {
          method: 'POST',
          body: {
            /*
             * Hai luật ghi khác nhau nên gửi thành HAI CHỖ, đúng cờ `overwrite`
             * mà server đã gắn: `set` là fill-empty (không bao giờ đè), `price`
             * là ghi đè có chủ đích. Đổ tất vào `set` thì zod lọc mất giá.
             */
            items: enrich.items.map((s) => ({
              material_id: s.material_id,
              set: Object.fromEntries(
                s.fields.filter((f) => !f.overwrite).map((f) => [f.field, f.value]),
              ),
              price: s.fields.find((f) => f.field === 'last_purchase_price')?.value as
                number | undefined,
            })),
            po_code: enrich.poCode,
          },
        },
      )
      invalidateMaterialPickCache() // ô tìm vật tư phải thấy bản vừa giàu thêm
      toast.success(`Đã cập nhật ${updated} vật tư`, 'Lần đặt sau các ô này tự điền sẵn')
      leaveTo(enrich.dest)
    } catch (err) {
      toast.error(
        'Cập nhật danh mục thất bại',
        err instanceof ApiError ? err.message : 'Có lỗi — đơn đã lưu, chỉ danh mục chưa',
      )
      leaveTo(enrich.dest) // đơn đã lưu xong — không giữ người dùng lại vì phần phụ
    }
  }

  async function submit() {
    if (problem || busy) return
    setBusy(true)
    try {
      const { po, catalog_suggestions } = await api<{
        po: { id: string; code: string }
        catalog_suggestions?: CatalogSuggestion[]
      }>(isEdit ? `/api/dept/supply/pos/${initial!.po.id}` : '/api/dept/supply/pos', {
        // Route sửa đơn là PATCH (`/api/dept/supply/pos/[id]`), không phải PUT.
        method: isEdit ? 'PATCH' : 'POST',
        body: buildPoPayload(header, lines, columnsToShipments(shipCols)),
      })
      // Đã vào server thì bản nháp trình duyệt hết nhiệm vụ — dọn để lần soạn
      // sau không bị hỏi khôi phục đơn đã lưu rồi.
      try {
        localStorage.removeItem(draftKey)
      } catch {}
      // 0116: tạo = LƯU NHÁP, chưa tới bàn duyệt của GĐ. Redirect kèm ?view= để
      // danh sách mở ngay chi tiết — người soạn kiểm tra rồi bấm "Gửi GĐ duyệt".
      toast.success(
        isEdit ? `Đã lưu ${po.code}` : `Đã lưu nháp ${po.code}`,
        isEdit
          ? 'Thay đổi đã ghi vào đơn'
          : 'Kiểm tra lại trong chi tiết rồi bấm "Gửi GĐ duyệt"',
      )
      const dest = isEdit ? '/planning/pos' : `/planning/pos?view=${po.id}`
      // Có thông tin danh mục đang thiếu → hỏi trước khi rời trang; không thì đi luôn.
      if (catalog_suggestions && catalog_suggestions.length > 0) {
        setEnrich({ items: catalog_suggestions, dest, poCode: po.code })
        return
      }
      leaveTo(dest)
    } catch (err) {
      toast.error(
        isEdit ? 'Lưu đơn thất bại' : 'Tạo đơn thất bại',
        err instanceof ApiError ? err.message : 'Có lỗi',
      )
      setBusy(false)
    }
  }

  const pendingNeeds = needs.filter((n) => n.suggest > 0 && !usedIds.has(n.material_id))

  /**
   * TAB thay việc xếp dọc bốn khối.
   *
   * Màn cũ đặt "Nhu cầu BOM", "Chia đợt giao", "Điều khoản" thành ba khối gấp
   * gọn nằm XEN giữa trang: gấp lại thì không ai thấy (đúng phản hồi 28/08 về
   * khối Điều khoản), mở ra thì đẩy bảng dòng hàng đi mất. Thành tab thì luôn
   * thấy là CÓ, luôn một cú bấm, mà không tốn một dòng chiều cao nào.
   */
  const [tab, setTab] = useState<'lines' | 'ship' | 'terms' | 'needs'>('lines')
  /*
   * BỎ HẲN "chế độ gọn" (user chốt 29/08/2026): bảng LUÔN bày đủ cột như sổ
   * Excel. Bản trước mặc định gom cột riêng của mẫu vào một hàng chi tiết bung
   * ra, kèm nút bật/tắt nhớ theo người dùng.
   *
   * Vì sao bỏ chứ không để làm tuỳ chọn: phòng Cung ứng đọc đơn theo HÀNG NGANG
   * — mắt chạy hết một dòng là xong một vật tư, đúng như file Excel họ dùng
   * mười mấy năm (cùng lý do với chốt 08/08/2026 "tất cả cùng hàng như Excel").
   * Hàng chi tiết bắt bấm thêm một nhịp cho mỗi dòng, và tệ hơn là hai người
   * cùng nhìn một đơn lại thấy hai bảng khác nhau. Một bảng, một cách đọc.
   */

  const missingLines = lines.length - readyLines
  const shipCount = columnsToShipments(shipCols).length

  /**
   * "Chưa lưu được: …" BẤM ĐƯỢC — đưa thẳng tới chỗ phải sửa.
   *
   * Đơn 40 dòng mà thanh tổng chỉ nói "dòng 27 thiếu SL đặt" thì người soạn vẫn
   * phải tự cuộn đi tìm dòng 27. Thiếu đầu đơn (NCC/LSX) thì trả con trỏ về
   * đúng chip; thiếu số thì về tab dòng hàng và nhảy vào ô trống đầu tiên.
   */
  function goToProblem() {
    if (!problem) return
    const chip = problem.includes('nhà cung cấp')
      ? 'NCC'
      : problem.includes('LSX')
        ? 'LSX'
        : null
    if (chip) {
      document.querySelector<HTMLButtonElement>(`[aria-label^="${chip}:"]`)?.focus()
      return
    }
    setTab('lines')
    requestAnimationFrame(() => {
      const empty = Array.from(
        document.querySelectorAll<HTMLInputElement>('[data-line] [data-cell]'),
      ).find((i) => i.value === '')
      if (!empty) return
      empty.scrollIntoView({ block: 'center' })
      empty.focus()
      empty.select()
    })
  }

  return (
    /*
     * min-h: THANH TỔNG phải nằm ở ĐÁY MÀN, không lơ lửng giữa trang.
     * Nó `sticky bottom-0`, nhưng sticky chỉ có tác dụng khi trang cao hơn màn
     * hình — đơn mới có 1-2 dòng thì thanh (kèm nút Lưu) đứng chơ vơ giữa chừng
     * với một mảng trắng lớn bên dưới. Cho khung tối thiểu bằng chiều cao vùng
     * nội dung là thanh luôn tì đáy, đơn ngắn hay dài cũng vậy.
     * dvh chứ không vh: trên điện thoại thanh địa chỉ trượt làm vh sai.
     */
    <div className="flex min-h-[calc(100dvh-7.5rem)] flex-col gap-3 pb-2">
      <TopProgressBar active={busy} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          {/* Đường quay lại — thanh chip nói "đơn cho ai", breadcrumb nói "đang
              đứng ở đâu trong khu Cung ứng". Bản dựng đầu bỏ mất phần này. */}
          <Breadcrumbs
            items={[
              { label: 'Cung ứng', href: '/planning' },
              { label: 'Đơn đặt vật tư', href: '/planning/pos' },
              {
                label: isEdit
                  ? `Sửa ${initial!.po.code}`
                  : initial
                    ? `Nhân bản ${initial.po.code}`
                    : 'Soạn đơn',
              },
            ]}
          />
          <h1 className="t-title truncate">
            {isEdit ? `Sửa đơn ${initial!.po.code}` : 'Soạn đơn đặt hàng'}
          </h1>
          <p className="text-muted-foreground truncate text-[11.5px]">
            {initial && !isEdit
              ? `Nhân bản từ ${initial.po.code} — số đơn mới cấp khi lưu`
              : isEdit
                ? 'Sửa xong bấm Lưu thay đổi'
                : 'Số đơn cấp khi lưu · ô nền xám hệ thống tự tính'}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={lines.length === 0}
            onClick={() => setPreviewOpen(true)}
            title={lines.length === 0 ? 'Thêm ít nhất một dòng hàng đã' : undefined}
            className="h-auto gap-1.5 px-3 py-1.5 text-[13px]"
          >
            <Printer strokeWidth={1.8} aria-hidden /> Xem trước phiếu in
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              if (
                dirtyRef.current &&
                !(await confirm({
                  title: 'Rời trang khi đang sửa dở?',
                  description:
                    'Thay đổi chưa bấm Lưu — bản sửa dở đã được giữ tạm trên máy này, quay lại sẽ được đề nghị khôi phục.',
                  confirmLabel: 'Rời trang',
                }))
              ) {
                return
              }
              router.push('/planning/pos')
            }}
            className="h-auto gap-1.5 px-3 py-1.5 text-[13px]"
          >
            <ArrowLeft strokeWidth={1.8} aria-hidden /> Về danh sách
          </Button>
        </div>
      </div>

      {/* Bản nháp tự lưu từ phiên trước — hỏi trước khi đè, không tự khôi phục. */}
      {savedDraft && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3.5 py-2.5 text-[13px]">
          <b>{isEdit ? 'Có bản sửa dở chưa lưu của đơn này' : 'Có bản nháp chưa lưu'}</b>
          <span className="text-muted-foreground">
            {savedDraft.lines.length} dòng ·{' '}
            {new Date(savedDraft.at).toLocaleString('vi-VN')}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => restoreDraft(savedDraft)}
              className="h-auto border-[var(--warn)]/50 px-2.5 py-1 text-xs text-[var(--warn)]"
            >
              Khôi phục
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                try {
                  localStorage.removeItem(draftKey)
                } catch {}
                setSavedDraft(null)
              }}
              className="text-muted-foreground h-auto px-2.5 py-1 text-xs font-normal"
            >
              Bỏ
            </Button>
          </div>
        </div>
      )}

      {/*
        MỘT thẻ dính đầu chứa CẢ chip lẫn tab.

        Tách thành hai thẻ dính rời nhau thì nội dung trang chạy qua khe giữa
        chúng lúc cuộn — đúng cái bẫy `top-[59px]` của màn cũ đã phải vá.
      */}
      <div className="border-border bg-card sticky top-[59px] z-30 rounded-xl border shadow-sm">
        <HeaderChips
          template={template}
          onTemplate={selectTemplate}
          lineCount={lines.length}
          poType={poType}
          onPoType={(t) => {
            setPoType(t)
            if (t === 'standalone') {
              setLsxId('')
              setExtraLsxIds([])
              setNeeds([])
              if (tab === 'needs') setTab('lines')
            }
          }}
          lsxId={lsxId}
          onLsx={(id) => void selectLsx(id)}
          lsxs={lsxs}
          extraLsxIds={extraLsxIds}
          onToggleExtraLsx={toggleExtraLsx}
          supplierId={supplierId}
          onSupplier={(id) => {
            setSupplierId(id)
            // Tiền tệ đi theo NCC (gỗ báo USD/m³) — trừ khi người soạn đã tự chọn.
            if (!currencyDirty) {
              const cur = suppliers.find((s) => s.id === id)?.currency?.toUpperCase()
              if (cur) setCurrency(cur)
            }
          }}
          suppliers={suppliers}
          expectedAt={expectedAt}
          onExpectedAt={setExpectedAt}
          contractNo={contractNo}
          onContractNo={setContractNo}
          currency={currency}
          onCurrency={(v) => {
            setCurrency(v)
            setCurrencyDirty(true)
          }}
          problem={problem}
          lineReady={readyLines}
        />

        <div className="border-border flex flex-wrap items-center gap-1 border-t px-2">
          <TabBtn
            on={tab === 'lines'}
            onClick={() => setTab('lines')}
            icon={ClipboardList}
          >
            Dòng hàng <TabCount warn={missingLines > 0}>{lines.length}</TabCount>
          </TabBtn>
          <TabBtn on={tab === 'ship'} onClick={() => setTab('ship')} icon={Truck}>
            Chia đợt giao{shipCount > 0 && <TabCount>{shipCount}</TabCount>}
          </TabBtn>
          <TabBtn on={tab === 'terms'} onClick={() => setTab('terms')} icon={ScrollText}>
            Điều khoản
          </TabBtn>
          {poType === 'lsx' && lsxId && (
            <TabBtn on={tab === 'needs'} onClick={() => setTab('needs')} icon={Sparkles}>
              Nhu cầu LSX
              {pendingNeeds.length > 0 && <TabCount warn>{pendingNeeds.length}</TabCount>}
            </TabBtn>
          )}
        </div>
      </div>

      {/* ═══════════ DÒNG HÀNG ═══════════ */}
      {tab === 'lines' && (
        <section className="border-border bg-card min-w-0 overflow-hidden rounded-xl border">
          <PoLineTable
            template={template}
            lines={lines}
            suggestions={suggestions}
            capLeft={capLeft}
            currency={currency}
            onPatch={patchLine}
            onRemove={removeLine}
            onSaveToCatalog={(id, f, v) => void saveToCatalog(id, f, v)}
            onEditMaterial={setEditingMaterialId}
            focusIndex={focusIndex}
            onFocused={() => setFocusIndex(null)}
            onDoneRow={() => pickerRef.current?.focus()}
          />

          {/* THANH THÊM DÒNG — NGOÀI khung cuộn, nên không trôi theo bảng.
              Phải là PHẦN TỬ CUỐI của section: `PoLineTable` đo chiều cao khung
              cuộn bằng cách trừ đi chiều cao của phần tử cuối này. */}
          <div className="border-border bg-muted/40 flex flex-wrap items-center gap-2 border-t p-2.5">
            {/* Đơn trống: nói thẳng bước kế tiếp thay vì để người dùng đoán từ
                một bảng chỉ có dòng ma. */}
            {lines.length === 0 && (
              <p className="text-muted-foreground basis-full text-[12px]">
                Mẫu <b className="text-foreground">{meta.label}</b> nhập các cột như trên
                — bấm ô tìm bên dưới để chọn vật tư đầu tiên
                {poType === 'lsx' && lsxId && pendingNeeds.length > 0 && (
                  <>
                    , hoặc lấy sẵn{' '}
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setTab('needs')}
                      className="h-auto p-0 align-baseline text-[13px] font-medium"
                    >
                      {pendingNeeds.length} vật tư nhu cầu LSX
                    </Button>
                  </>
                )}
                .
              </p>
            )}
            <Button
              ref={pickerRef}
              type="button"
              variant="outline"
              onClick={() => setPickOpen(true)}
              /* Nhãn cho trình đọc màn hình: chữ trong nút bị `truncate` và có
                 <kbd> chen vào nên cây accessibility đọc ra nút KHÔNG TÊN. */
              aria-label="Tìm và chọn vật tư cho đơn"
              className="text-muted-foreground min-w-0 flex-1 justify-start gap-2.5 rounded-lg border-dashed px-3 text-left text-[13px] font-normal hover:border-[var(--primary)]"
            >
              <Search className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
              <span className="truncate">
                Tìm và chọn vật tư — mở phiên chọn, tích nhiều món một lượt…
              </span>
              <kbd className="border-border bg-muted t-data ml-auto hidden rounded border px-1.5 text-[10px] sm:inline">
                Enter
              </kbd>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPasteOpen(true)}
              className="shrink-0 gap-1.5 rounded-lg px-3 text-[13px]"
              title="Dán vùng bảng (tên/mã · SL · giá) từ sổ Excel — máy khớp mã, thêm dòng hàng loạt"
            >
              {/* ⎘ trước đây là KÝ TỰ unicode giả làm icon — bộ icon của app là
                  lucide, và ký tự thì đổi hình theo font của từng máy. */}
              <ClipboardPaste strokeWidth={1.8} aria-hidden /> Dán từ Excel
            </Button>
            {FREE_LINE_TEMPLATES.includes(template) && (
              <Button
                type="button"
                variant="outline"
                onClick={addFreeLine}
                className="shrink-0 gap-1.5 rounded-lg px-3 text-[13px]"
                title="Thêm dòng không gắn vật tư kho — tên SP/món gia công gõ ngay trên dòng"
              >
                <Plus strokeWidth={1.8} aria-hidden /> Dòng SP tự gõ
              </Button>
            )}
            <QuickAddMaterial
              template={template}
              onCreated={(m) =>
                addMaterial({
                  id: m.id,
                  code: m.code,
                  name: m.name,
                  unit: m.unit,
                  group_name: m.group_name,
                  sub_group: m.sub_group,
                  spec: m.spec,
                  kg_per_m: m.kg_per_m,
                  kg_per_unit: m.kg_per_unit,
                  default_bar_length_m: m.default_bar_length_m,
                  price_unit: m.price_unit,
                  unit2_factor: m.unit2_factor,
                  vat_rate: null,
                  default_supplier_id: null,
                  last_purchase_price: null,
                  pack_size: m.pack_size,
                  pack_unit: m.pack_unit,
                  material_grade: m.material_grade,
                  open_style: m.open_style,
                  pcs_per_ctn: m.pcs_per_ctn,
                  finish: m.finish,
                  on_hand: null,
                  last_line: null,
                })
              }
            />
            <span className="text-muted-foreground ml-1 hidden text-[11.5px] xl:inline">
              <kbd className="border-border bg-muted t-data rounded border px-1 text-[10px]">
                Enter
              </kbd>{' '}
              SL đặt → đơn giá → dòng kế
            </span>
          </div>
        </section>
      )}

      {/* ═══════════ CHIA ĐỢT GIAO ═══════════ */}
      {tab === 'ship' && (
        <ShipmentPlanPanel
          lines={lines}
          columns={shipCols}
          currency={currency}
          onChange={setShipCols}
        />
      )}

      {/* ═══════════ ĐIỀU KHOẢN ═══════════ */}
      {tab === 'terms' && (
        <TermsSection
          templateLabel={meta.label}
          open={showTerms}
          onToggle={() => setShowTerms((v) => !v)}
          terms={terms}
          onTermsChange={setTerms}
          signerRole={signerRole}
          onSignerChange={setSignerRole}
          note={note}
          onNoteChange={setNote}
        />
      )}

      {/* ═══════════ NHU CẦU LSX ═══════════ */}
      {tab === 'needs' && poType === 'lsx' && lsxId && (
        <NeedsPanel
          needs={needs}
          pending={pendingNeeds}
          loading={loadingNeeds}
          open={showNeeds}
          onToggle={() => setShowNeeds((v) => !v)}
          onGoLines={() => setTab('lines')}
          onAdd={(list) => {
            void addFromNeeds(list)
            setTab('lines')
          }}
        />
      )}

      {/* ── Hộp thoại: giữ nguyên của màn cũ, không sửa file nào bên đó ── */}
      <MaterialPickDialog
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        template={template}
        usedIds={usedIds}
        onAdd={addMaterials}
        needs={suggestions}
      />
      <EditMaterialDialog
        materialId={editingMaterialId}
        onClose={() => setEditingMaterialId(null)}
        onSaved={(id, m) =>
          setLines((ls) =>
            ls.map((l) =>
              l.material_id === id ? refreshLineFromMaterial(template, l, m) : l,
            ),
          )
        }
      />
      <PasteLinesDialog
        open={pasteOpen}
        template={template}
        allowFree={FREE_LINE_TEMPLATES.includes(template)}
        onClose={() => setPasteOpen(false)}
        onConfirm={addFromPaste}
      />

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Xem trước phiếu in — mẫu ${meta.label.toLowerCase()}`}
        maxWidth="sm:max-w-5xl"
      >
        <div className="overflow-x-auto">
          <PoPrintSheet
            company={company}
            tpl={tpl}
            po={previewHeaderFromDraft(header, {
              code: isEdit ? initial!.po.code : '(cấp khi lưu)',
              supplierName: supplier?.name ?? '—',
              lsxCode: poType === 'lsx' ? lsxJoinedCode : null,
              orderCode: poType === 'lsx' ? lsx?.order_codes.join(', ') || null : null,
              createdAt: new Date().toISOString(),
            })}
            supplier={
              supplier
                ? {
                    name: supplier.name,
                    address: supplier.address,
                    tax_no: supplier.tax_no,
                    phone: supplier.phone,
                  }
                : null
            }
            lines={previewLinesFromDraft(template, lines)}
            shipments={columnsToShipments(shipCols).map((sh, i) => ({
              seq: i + 1,
              expected_date: sh.expected_date,
              lines: sh.lines.map((sl) => {
                const l = lines[sl.line_index]
                const ordered = Number(l?.qty) || 0
                const price = l?.price === '' ? null : Number(l?.price)
                return {
                  name: l?.name ?? '?',
                  qty: sl.qty,
                  unit: l?.unit ?? '',
                  amount:
                    price != null && ordered > 0
                      ? price * ordered * (sl.qty / ordered)
                      : null,
                }
              }),
            }))}
          />
        </div>
      </Modal>

      <Modal
        open={enrich != null}
        onClose={() => enrich && leaveTo(enrich.dest)}
        title="Cập nhật kho vật tư?"
        maxWidth="sm:max-w-xl"
      >
        {enrich && (
          <div className="flex flex-col gap-3">
            {/*
              "THÔNG TIN TRÊN DÒNG ĐƠN", không phải "bạn vừa gõ" (sửa 29/08 sau
              khi test thật). Không phải giá trị nào ở đây cũng do người soạn gõ
              tay: vd kg/đơn vị được suy từ chính danh mục (`unit2_factor` + giá
              theo kg) rồi đề xuất ghi ngược lại. Số vẫn đúng, nhưng nói "bạn vừa
              gõ" là mô tả sai việc — người duyệt đi tìm chỗ mình đã gõ mà không
              thấy thì mất tin vào cả danh sách.
            */}
            <p className="text-sm">
              Đơn đã lưu. Có <b>{enrich.items.length}</b> vật tư mà thông tin trên dòng
              đơn khác với kho vật tư — cập nhật để lần đặt sau tự điền sẵn?
            </p>
            <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto text-sm">
              {enrich.items.map((s) => {
                const fill = s.fields.filter((f) => !f.overwrite)
                const price = s.fields.find((f) => f.field === 'last_purchase_price')
                return (
                  <li
                    key={s.material_id}
                    className="border-border rounded-md border px-3 py-2"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="t-data text-muted-foreground text-xs">
                        {s.code}
                      </span>
                      <span className="truncate font-medium">{s.name}</span>
                    </div>
                    {/*
                      HAI NHÓM, vì hai luật ghi khác nhau — gộp một dòng thì
                      người duyệt tưởng giá cũng chỉ "điền chỗ trống", trong khi
                      nó ĐÈ số cũ. Nói rõ số cũ → số mới ngay tại chỗ.
                    */}
                    {fill.length > 0 && (
                      <div className="text-muted-foreground mt-1 text-[12.5px]">
                        <span className="text-[var(--done)]">Điền chỗ trống:</span>{' '}
                        {fill.map((f) => `${f.label}: ${f.value}`).join(' · ')}
                      </div>
                    )}
                    {price && (
                      <div className="mt-1 text-[12.5px]">
                        <span className="font-medium text-[var(--warn)]">
                          Ghi đè giá mua:
                        </span>{' '}
                        <span className="t-data text-[12.5px]">
                          {price.before == null
                            ? 'chưa có'
                            : Number(price.before).toLocaleString('vi-VN')}
                        </span>{' '}
                        →{' '}
                        <b className="t-data text-[12.5px]">
                          {Number(price.value).toLocaleString('vi-VN')}
                        </b>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="text-muted-foreground text-xs">
              Nhóm <b className="text-[var(--done)]">điền chỗ trống</b> không bao giờ đè
              giá trị đã có. Riêng <b className="text-[var(--warn)]">giá mua gần nhất</b>{' '}
              là ghi đè — bấm <b>Bỏ qua</b> thì danh mục giữ nguyên giá cũ.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => leaveTo(enrich.dest)}
              >
                Bỏ qua
              </Button>
              <Button
                type="button"
                disabled={enrichBusy}
                onClick={() => void confirmEnrich()}
              >
                {enrichBusy && <Spinner size={14} />}
                Cập nhật danh mục ({enrich.items.length})
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <TotalsBar
        subtotal={subtotal}
        vat={vat}
        vatAmount={vatAmount}
        inclVat={inclVat}
        discount={discount}
        hasDiscount={meta.hasDiscount}
        grandTotal={grandTotal}
        currency={currency}
        problem={problem}
        onProblemClick={goToProblem}
        busy={busy}
        submitLabel={isEdit ? 'Lưu thay đổi' : 'Lưu nháp'}
        onVatChange={(v) => {
          setVat(v)
          setVatDirty(true)
        }}
        onInclVatChange={(v) => {
          setInclVat(v)
          setVatDirty(true)
        }}
        onDiscountChange={setDiscount}
        onSubmit={() => void submit()}
      />
    </div>
  )
}

/** Nút TAB — cùng khuôn với tab của /design-lab mục 14. */
function TabBtn({
  on,
  onClick,
  icon: Icon,
  children,
}: {
  on: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      aria-current={on}
      /* Tab: bo góc 0 + gạch chân, nên bỏ nền hover của ghost mà vẫn giữ
         focus-ring và nhịp padding của kit. */
      className={
        'h-auto gap-1.5 rounded-none border-b-2 px-3 py-2 text-[13px] font-normal hover:bg-transparent ' +
        (on
          ? 'border-[var(--primary)] font-semibold text-[var(--primary)]'
          : 'text-muted-foreground hover:text-foreground border-transparent')
      }
    >
      <Icon className="size-4" strokeWidth={on ? 2.1 : 1.8} />
      {children}
    </Button>
  )
}

function TabCount({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <span
      className={
        't-data ml-0.5 rounded-full px-1.5 text-[11px] ' +
        (warn ? 'bg-[var(--warn)]/15 text-[var(--warn)]' : 'bg-muted')
      }
    >
      {children}
    </span>
  )
}
