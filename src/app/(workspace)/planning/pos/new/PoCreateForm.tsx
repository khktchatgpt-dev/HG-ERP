'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  FileText,
  Printer,
  Search,
} from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/erp/PageHeader'
import { TopProgressBar } from '@/components/erp/Spinner'
import { MaterialPickDialog, type PoMaterial } from '@/components/supply/MaterialPicker'
import { SupplierPicker } from '@/components/supply/SupplierPicker'
import { allocationNote } from '@/lib/po-allocation'
import { poTemplateMeta, type PoTemplate, type PoTerms } from '@/lib/po-template'
import { PoLineTable } from './PoLineTable'
import { QuickAddMaterial } from './QuickAddMaterial'
import {
  buildPoPayload,
  draftProblem,
  poTotals,
  readyLineCount,
  templateDefaults,
  type PoHeader,
} from './po-draft'
import { ContextStrip } from './sections/ContextStrip'
import { Segmented } from './sections/Segmented'
import { TemplatePicker } from './sections/TemplatePicker'
import { NeedsPanel, type Need } from './sections/NeedsPanel'
import { TermsSection } from './sections/TermsSection'
import { TotalsBar } from './sections/TotalsBar'
import { newLine, type Line } from './po-line'
import { Modal } from '@/components/Modal'
import { PoPrintSheet } from '@/app/print/supply/PoPrintSheet'
import { previewHeaderFromDraft, previewLinesFromDraft } from './po-preview'

type SupplierOption = {
  id: string
  name: string
  rating: string | null
  lead_time_days: number | null
  payment_terms: string | null
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
}

/*
 * Token theme-v2 thay bộ zinc/violet tự chế (08/08/2026): shell + mọi form khác
 * đã về một hệ stone/emerald, màn này giữ hệ riêng nên đứng cạnh trông như app
 * khác — và nhãn zinc-400 ở cỡ 11px chỉ đạt ~2.5:1, đọc rất mệt. Nhãn lên
 * muted-foreground (stone-600, ~7:1), ô nhập cùng khuôn Input shadcn.
 */
const field =
  'h-9 w-full rounded-lg border border-input bg-card px-2.5 text-[13px] shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

/**
 * TỰ LƯU BẢN NHÁP vào trình duyệt (bất cập #5, 09/08/2026): đơn 20 dòng gõ dở
 * mà F5 / mất mạng / lỡ đóng tab là mất sạch — Excel thì Ctrl+S theo phản xạ
 * nên không ai nghĩ tới chuyện này cho tới khi mất. Form ghi localStorage sau
 * mỗi nhịp gõ (debounce), mở lại trang thì đề nghị khôi phục. Chỉ ở chế độ
 * TẠO MỚI — sửa đơn đã có bản gốc trên server, khôi phục đè lên nó dễ nhầm hơn
 * là gõ lại.
 */
const DRAFT_KEY = 'hg-po-draft-new'

/**
 * TẠM TẮT "đề xuất từ BOM" (11/08/2026, theo yêu cầu).
 *
 * Định mức đang được làm lại nên số nhu cầu/đề xuất chưa đáng tin — thà không
 * hiện còn hơn hiện một con số sai rồi có người đặt theo. Tắt cờ này thì:
 * không gọi `/api/dept/supply/needs`, không hiện panel "Nhu cầu từ BOM của
 * LSX", và hộp chọn vật tư + bảng dòng hàng không còn số "lệnh cần"/gợi ý theo
 * BOM (gợi ý theo ô "SL đơn hàng" gõ tay vẫn giữ nguyên).
 *
 * BẬT LẠI: đổi về `true`, không phải sửa gì thêm.
 */
const BOM_NEEDS_ENABLED: boolean = false

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

function readSavedDraft(): SavedDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as SavedDraft
    // Nháp rỗng (chưa có dòng nào) không đáng một cái banner.
    return Array.isArray(d.lines) && d.lines.length > 0 ? d : null
  } catch {
    return null
  }
}
/** Nhãn micro trên ô — cùng khuôn với nhãn SL đặt/Đơn giá của dòng hàng. */
const fieldLabel =
  'text-muted-foreground text-[11px] font-semibold tracking-wide uppercase'
/** Icon neo mắt bên trái ô — ô nào có icon thì input thêm `pl-8`. */
const fieldIcon =
  'text-muted-foreground/70 pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2'

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
  defaultSupplierId,
  initial,
}: {
  suppliers: SupplierOption[]
  lsxs: LsxOption[]
  /** Đầu phiếu (tên cty, MST, địa danh) cho bản xem trước — từ Cài đặt. */
  company: Record<string, string | null>
  defaultSupplierId?: string
  /** Có = mở đơn có sẵn: 'edit' ghi đè đơn cũ, 'duplicate' tạo đơn mới từ nó. */
  initial?: PoInitial
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const isEdit = initial?.mode === 'edit'
  const start = initial?.po
  const startMeta = poTemplateMeta(start?.template ?? 'accessory')

  const [template, setTemplate] = useState<PoTemplate>(start?.template ?? 'accessory')
  const [poType, setPoType] = useState<'lsx' | 'standalone'>(
    start ? (start.production_order_id ? 'lsx' : 'standalone') : 'lsx',
  )
  const [lsxId, setLsxId] = useState(start?.production_order_id ?? '')
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
  const [currency, setCurrency] = useState(start?.currency ?? 'VND')
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
  const [showTerms, setShowTerms] = useState(false)

  const [lines, setLines] = useState<Line[]>(initial?.lines ?? [])
  const [needs, setNeeds] = useState<Need[]>([])
  const [loadingNeeds, setLoadingNeeds] = useState(false)
  const [showNeeds, setShowNeeds] = useState(true)

  // Bản nháp tự lưu tìm thấy lúc mở trang — hiện banner đề nghị khôi phục.
  // setState qua callback của timer, không gọi thẳng thân effect (lint cascading
  // render — cùng lý do với effect nạp taxonomy ở MaterialCoreFields).
  const [savedDraft, setSavedDraft] = useState<SavedDraft | null>(null)
  useEffect(() => {
    if (initial) return
    const t = setTimeout(() => setSavedDraft(readSavedDraft()), 0)
    return () => clearTimeout(t)
  }, [initial])

  /*
   * TỰ LƯU sau mỗi nhịp gõ (debounce 800ms) — chỉ chế độ tạo mới, và chỉ khi
   * banner khôi phục đã được trả lời (không thì vòng autosave đè mất bản nháp
   * cũ TRƯỚC khi người dùng kịp bấm "Khôi phục").
   */
  useEffect(() => {
    if (initial || savedDraft) return
    const t = setTimeout(() => {
      try {
        if (lines.length === 0) {
          localStorage.removeItem(DRAFT_KEY)
          return
        }
        const d: SavedDraft = {
          at: new Date().toISOString(),
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
        localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
      } catch {
        // localStorage đầy/bị chặn — autosave là lưới an toàn, không chặn việc gõ.
      }
    }, 800)
    return () => clearTimeout(t)
  }, [
    initial,
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
   * Chế độ SỬA không có autosave (bản gốc nằm trên server) — chặn đóng tab khi
   * đang có dòng hàng để khỏi mất chỉnh sửa vì một cú F5.
   */
  useEffect(() => {
    if (!isEdit) return
    const h = (e: BeforeUnloadEvent) => {
      if (lines.length > 0) e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [isEdit, lines.length])

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
    setNote(d.note)
    setDiscount(d.discount)
    setVat(d.vat)
    setInclVat(d.inclVat)
    setVatDirty(d.vatDirty)
    setTerms(d.terms)
    setSignerRole(d.signerRole)
    setLines(d.lines)
    setSavedDraft(null)
    if (d.poType === 'lsx' && d.lsxId) void loadNeeds(d.lsxId, d.extraLsxIds ?? [])
  }

  const usedIds = useMemo(() => new Set(lines.map((l) => l.material_id)), [lines])
  const suggestions = useMemo(
    () => new Map(needs.map((n) => [n.material_id, n.suggest])),
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
    if (!BOM_NEEDS_ENABLED) return
    if (!primary) return
    setLoadingNeeds(true)
    try {
      const qs = extras.length > 0 ? `&extra_lsx_ids=${extras.join(',')}` : ''
      const data = await api<{ needs: Need[] }>(
        `/api/dept/supply/needs?production_order_id=${primary}${qs}`,
      )
      setNeeds(data.needs)
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
  function addMaterials(list: PoMaterial[]) {
    const add = list.filter((m) => !usedIds.has(m.id))
    if (add.length === 0) return
    setFocusIndex(lines.length) // dòng mới nối vào cuối bảng
    setLines((ls) => [...ls, ...add.map((m) => newLine(template, m))])
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
    field: 'kgm' | 'kgunit',
    value: number,
  ) {
    const col = field === 'kgm' ? 'kg_per_m' : 'kg_per_unit'
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
                  ? { catalog_kg_m: value }
                  : { catalog_kg_unit: value }),
              }
            : l,
        ),
      )
      toast.success('Đã lưu vào danh mục', `${col} = ${value.toLocaleString('vi-VN')}`)
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

  async function submit() {
    if (problem || busy) return
    setBusy(true)
    try {
      const { po } = await api<{ po: { id: string; code: string } }>(
        isEdit ? `/api/dept/supply/pos/${initial!.po.id}` : '/api/dept/supply/pos',
        {
          // Route sửa đơn là PATCH (`/api/dept/supply/pos/[id]`), không phải PUT.
          method: isEdit ? 'PATCH' : 'POST',
          body: buildPoPayload(header, lines),
        },
      )
      // Đã vào server thì bản nháp trình duyệt hết nhiệm vụ — dọn để lần soạn
      // sau không bị hỏi khôi phục đơn đã lưu rồi.
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {}
      // 0116: tạo = LƯU NHÁP, chưa tới bàn duyệt của GĐ. Redirect kèm ?view= để
      // danh sách mở ngay chi tiết — người soạn kiểm tra rồi bấm "Gửi GĐ duyệt".
      toast.success(
        isEdit ? `Đã lưu ${po.code}` : `Đã lưu nháp ${po.code}`,
        isEdit
          ? 'Thay đổi đã ghi vào đơn'
          : 'Kiểm tra lại trong chi tiết rồi bấm "Gửi GĐ duyệt"',
      )
      router.push(isEdit ? '/planning/pos' : `/planning/pos?view=${po.id}`)
      router.refresh()
    } catch (err) {
      toast.error(
        isEdit ? 'Lưu đơn thất bại' : 'Tạo đơn thất bại',
        err instanceof ApiError ? err.message : 'Có lỗi',
      )
      setBusy(false)
    }
  }

  const pendingNeeds = needs.filter((n) => n.suggest > 0 && !usedIds.has(n.material_id))

  return (
    <div className="flex flex-col gap-3.5 pb-24">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[
          { label: 'Kế hoạch - Cung ứng', href: '/planning' },
          { label: 'Đơn đặt vật tư', href: '/planning/pos' },
          {
            label: isEdit
              ? `Sửa ${initial!.po.code}`
              : initial
                ? `Nhân bản ${initial.po.code}`
                : 'Soạn đơn',
          },
        ]}
        title={isEdit ? `Sửa đơn ${initial!.po.code}` : 'Soạn đơn đặt hàng'}
        description="Chọn mẫu đơn theo loại hàng — bảng tự đổi cột, ô nền xám hệ thống tự tính. Bạn chỉ nhập SL đặt và đơn giá."
        actions={
          <div className="flex items-center gap-2">
            {/*
              XEM TRƯỚC PHIẾU IN ngay lúc soạn.

              Trước đây muốn thấy tờ phiếu phải TẠO đơn thật rồi mở lại — tức
              mọi sai sót về điều khoản, chữ ký hay bố cục cột chỉ lộ ra khi đơn
              đã nằm chờ Giám đốc duyệt. Bản xem trước dùng ĐÚNG component của
              trang in thật (`PoPrintSheet`) nên không có đường nào để hai bản
              lệch nhau.
            */}
            <button
              type="button"
              disabled={lines.length === 0}
              onClick={() => setPreviewOpen(true)}
              title={lines.length === 0 ? 'Thêm ít nhất một dòng hàng đã' : undefined}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <Printer className="size-4" aria-hidden /> Xem trước phiếu in
            </button>
            <Link
              href="/planning/pos"
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <ArrowLeft className="size-4" aria-hidden /> Về danh sách
            </Link>
          </div>
        }
      />

      {/* Bản nháp tự lưu từ phiên trước — hỏi trước khi đè, không tự khôi phục. */}
      {savedDraft && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] dark:border-amber-900 dark:bg-amber-950/30">
          <b>Có bản nháp chưa lưu</b>
          <span className="text-muted-foreground">
            {savedDraft.lines.length} dòng ·{' '}
            {new Date(savedDraft.at).toLocaleString('vi-VN')}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => restoreDraft(savedDraft)}
              className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 shadow-xs hover:bg-amber-100 dark:border-amber-800 dark:bg-zinc-950 dark:text-amber-300"
            >
              Khôi phục
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem(DRAFT_KEY)
                } catch {}
                setSavedDraft(null)
              }}
              className="text-muted-foreground rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs shadow-xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950"
            >
              Bỏ
            </button>
          </div>
        </div>
      )}

      <ContextStrip
        templateLabel={meta.label}
        lsxLabel={
          poType === 'standalone' ? 'ngoài LSX' : (lsxJoinedCode ?? '— chưa chọn —')
        }
        supplierName={supplier?.name ?? null}
        readyLines={readyLines}
        totalLines={lines.length}
      />

      <TemplatePicker
        value={template}
        lineCount={lines.length}
        onChange={selectTemplate}
      />

      {/* ── Bối cảnh đơn: card có header, nhãn micro uppercase, icon neo mắt ── */}
      <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3.5 py-2.5 dark:border-zinc-800">
          <b className="text-[13px]">Bối cảnh đơn</b>
          <div className="ml-auto">
            <Segmented
              label="Đơn theo LSX hay ngoài LSX"
              options={[
                { value: 'lsx', label: 'Theo lệnh sản xuất' },
                { value: 'standalone', label: 'Ngoài LSX' },
              ]}
              value={poType}
              onSelect={(t) => {
                setPoType(t)
                if (t === 'standalone') {
                  setLsxId('')
                  setExtraLsxIds([])
                  setNeeds([])
                }
              }}
            />
          </div>
        </div>
        <div className="grid gap-3 p-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {poType === 'lsx' && (
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>
                LSX <span className="text-red-500">*</span>
              </span>
              <span className="relative">
                <FileText className={fieldIcon} aria-hidden />
                <select
                  value={lsxId}
                  onChange={(e) => void selectLsx(e.target.value)}
                  className={`${field} pl-8`}
                >
                  <option value="">— chọn LSX đã duyệt —</option>
                  {lsxs.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} — {l.customer_name}
                    </option>
                  ))}
                </select>
              </span>
              {/* LSX cũ (trước 0120) không gắn mã đơn hàng — ẩn hẳn thay vì
                  hiện chữ "Đơn hàng" với chỗ trống phía sau. */}
              {lsx && lsx.order_codes.length > 0 && (
                <span className="text-muted-foreground text-xs">
                  Đơn hàng{' '}
                  <b className="text-muted-foreground font-mono">
                    {lsx.order_codes.join(', ')}
                  </b>
                </span>
              )}
              {/*
                GỘP THÊM LSX (0125) — đơn thật hay gộp nhu cầu nhiều lệnh
                ("LSX 01+2+3/26-27") hoặc đặt bổ sung cho lệnh cũ. Chip từng
                lệnh phụ + ô chọn thêm; nhu cầu bên dưới tự gộp cả bộ.
              */}
              {lsxId && (
                <span className="flex flex-wrap items-center gap-1.5">
                  {extraLsxIds.map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-50 py-0.5 pr-1 pl-2 font-mono text-[11px] dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      {lsxs.find((l) => l.id === id)?.code ?? '?'}
                      <button
                        type="button"
                        onClick={() => toggleExtraLsx(id, false)}
                        className="text-muted-foreground grid size-4 place-items-center rounded-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        aria-label={`Bỏ LSX ${lsxs.find((l) => l.id === id)?.code ?? ''} khỏi đơn`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) toggleExtraLsx(e.target.value, true)
                    }}
                    className="text-muted-foreground h-6 rounded-md border border-dashed border-zinc-300 bg-transparent px-1.5 text-[11px] dark:border-zinc-700"
                    aria-label="Gộp thêm LSX vào đơn"
                  >
                    <option value="">＋ gộp thêm LSX…</option>
                    {lsxs
                      .filter((l) => l.id !== lsxId && !extraLsxIds.includes(l.id))
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.code} — {l.customer_name}
                        </option>
                      ))}
                  </select>
                </span>
              )}
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>
              Nhà cung cấp <span className="text-red-500">*</span>
            </span>
            {/*
              Ô TÌM, không phải <select>. Danh sách NCC ngày 02/08 đi từ 39 lên
              150; cuộn dropdown 151 mục giữa lúc soạn đơn là việc không nên có,
              và trình duyệt chỉ cho gõ nhảy theo ký tự ĐẦU nên gõ "tường" không
              tới được "CÔNG TY TNHH SX-TM TƯỜNG NGUYÊN".
            */}
            <span className="relative">
              <Building2 className={fieldIcon} aria-hidden />
              <SupplierPicker
                value={supplierId}
                onChange={setSupplierId}
                suppliers={suppliers}
                className={`${field} pl-8`}
              />
            </span>
            {supplier && (
              <span className="text-muted-foreground text-xs">
                {[
                  supplier.lead_time_days != null
                    ? `lead ${supplier.lead_time_days} ngày`
                    : null,
                  supplier.payment_terms,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Hẹn giao</span>
            <span className="relative">
              <CalendarDays className={fieldIcon} aria-hidden />
              <input
                type="date"
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
                className={`${field} pl-8`}
              />
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Theo HĐ số</span>
            <input
              maxLength={100}
              value={contractNo}
              onChange={(e) => setContractNo(e.target.value)}
              placeholder="HĐ nguyên tắc 02/26…"
              className={field}
            />
          </label>
        </div>
      </section>

      {/* ── Nhu cầu LSX: đường tắt, không phải cửa bắt buộc ── */}
      {BOM_NEEDS_ENABLED && poType === 'lsx' && lsxId && (
        <NeedsPanel
          needs={needs}
          pending={pendingNeeds}
          loading={loadingNeeds}
          open={showNeeds}
          onToggle={() => setShowNeeds((v) => !v)}
          onAdd={(list) => void addFromNeeds(list)}
        />
      )}

      {/* ── Dòng hàng: thẻ 2 tầng, ô đổi theo mẫu ── */}
      <section className="min-w-0 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3.5 py-2.5 dark:border-zinc-800">
          <b className="text-[13px]">Dòng hàng</b>
          <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">
            mẫu {meta.label}
          </span>
          {/* Vòng nhập không rời bàn phím — nói bằng phím, không phải một câu dài. */}
          <span className="text-muted-foreground ml-auto flex items-center gap-1 text-[11px]">
            <kbd className="text-muted-foreground rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-medium dark:border-zinc-700 dark:bg-zinc-900">
              Enter
            </kbd>
            SL đặt → đơn giá → dòng kế
            <span aria-hidden>·</span>
            {readyLines}/{lines.length} dòng đủ số
          </span>
        </div>
        <PoLineTable
          template={template}
          lines={lines}
          suggestions={suggestions}
          currency={currency}
          onPatch={patchLine}
          onRemove={removeLine}
          onSaveToCatalog={(id, f, v) => void saveToCatalog(id, f, v)}
          focusIndex={focusIndex}
          onFocused={() => setFocusIndex(null)}
          onDoneRow={() => pickerRef.current?.focus()}
        />

        {/*
          THANH THÊM DÒNG — NẰM NGOÀI BẢNG.

          Trước đây ô tìm là một `<tr>` cuối bảng, tức nằm trong khung cuộn ngang.
          Bảng rộng hơn màn hình nên chỉ cần cuộn sang phải xem cột Ghi chú là ô
          tìm trôi đi mất; muốn thêm dòng phải cuộn ngược lại. Ô tìm cũng bị bóp
          theo bề rộng cột, và nút "vật tư mới" thì lạc xuống một khối riêng bên
          dưới — hai việc cùng một mục đích mà nằm hai chỗ.

          Đưa ra ngoài `overflow-x-auto`: ô tìm luôn đứng yên, rộng hết khổ, và
          nút khai vật tư mới đứng ngay cạnh. Vẫn đặt DƯỚI bảng vì dòng mới nối
          vào cuối — mắt không phải nhảy từ đầu bảng xuống cuối sau mỗi lần thêm.
        */}
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          {/*
            NÚT MỞ HỘP THOẠI, không phải ô gõ tại chỗ.

            Danh mục 13.064 vật tư: chọn vật tư không phải "gõ một chữ rồi bấm"
            mà là một phiên — thu hẹp theo nhóm, đọc quy cách, so tồn, đối chiếu
            số lệnh cần. Ô gõ nhét trong trang chỉ đủ chỗ vài dòng kết quả, và
            mỗi món lại phải mở lại từ đầu. Hộp thoại mở MỘT LẦN, tích đủ giỏ,
            chốt một lượt — đơn 20 dòng thành một lượt mở thay vì hai mươi.

            TẠO HÌNH như một Ô TÌM trải hết khổ (viền đứt + icon kính lúp):
            nhìn là biết "gõ tìm ở đây", đúng thói quen từ các ô tìm khác của
            app — nhưng vẫn là nút, bấm/Enter là mở phiên chọn.
          */}
          <button
            ref={pickerRef}
            type="button"
            onClick={() => setPickOpen(true)}
            className="text-muted-foreground flex h-[38px] min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-dashed border-zinc-300 bg-white px-3 text-left text-[13px] transition-colors hover:border-violet-400 hover:text-zinc-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-violet-600 dark:hover:text-zinc-300"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="truncate">
              Tìm và chọn vật tư — mở phiên chọn, tích nhiều món một lượt…
            </span>
            <kbd className="text-muted-foreground ml-auto hidden rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline dark:border-zinc-700 dark:bg-zinc-900">
              Enter
            </kbd>
          </button>
          <QuickAddMaterial
            template={template}
            onCreated={(m) =>
              // NCC chào loại mới ngay lúc đặt — khai vật tư tại chỗ rồi vào thẳng
              // dòng, khỏi chạy sang danh mục Kho khai trước. Lấy ĐÚNG số server
              // vừa ghi (kg/m…) chứ không suy lại ở client: suy lại thì
              // dòng vẫn đẹp kể cả khi server ghi hụt, và lệch chỉ lộ ở lần sau.
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
                // Đóng gói + vật liệu (0124) vừa khai — dòng đầu tiên dùng ngay.
                pack_size: m.pack_size,
                pack_unit: m.pack_unit,
                material_grade: m.material_grade,
                // Vừa khai xong thì chưa có sổ kho — null, hiện "kho ?".
                on_hand: null,
                // Vật tư vừa khai thì chưa có lịch sử đặt để rót vào ô mô tả.
                last_line: null,
              })
            }
          />
        </div>

        <MaterialPickDialog
          open={pickOpen}
          onClose={() => setPickOpen(false)}
          template={template}
          usedIds={usedIds}
          onAdd={addMaterials}
          needs={suggestions}
        />
      </section>

      {/* ── Điều khoản: mặc định theo mẫu, sửa được ── */}
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

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Xem trước phiếu in — mẫu ${meta.label.toLowerCase()}`}
        maxWidth="sm:max-w-5xl"
      >
        <div className="overflow-x-auto">
          <PoPrintSheet
            company={company}
            po={previewHeaderFromDraft(header, {
              // Số đơn do server cấp lúc lưu — bản nháp chưa có, nói thẳng ra
              // thay vì bịa một mã trông như thật.
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
          />
        </div>
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
        onCurrencyChange={setCurrency}
        onSubmit={() => void submit()}
      />
    </div>
  )
}
