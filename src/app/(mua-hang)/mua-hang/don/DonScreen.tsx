'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  GroupRow,
  NoticeBar,
  Num,
  Pick,
  Row,
  ScopeSwitch,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
  Combobox,
} from '@/components/kit'
import { isMyPo, poOwner, type SupplyScope } from '@/lib/supply-scope'
import { givenNames, materialSummary, supplierShortName } from '@/lib/po-list-labels'
import { poTemplateShort } from '@/lib/po-template'
import { useScopePref } from '@/lib/use-scope-pref'
import { assessPoLate, isMissingEta } from '@/lib/late-risk'
import { assessPoFit } from '@/lib/po-fit'
import {
  PO_NEXT_HINT,
  PO_STATUS_LABEL,
  PO_STATUS_TONE,
  type PoStatus,
} from '@/lib/po-status'
import {
  EMPTY_FILTER,
  PO_BUCKETS,
  countPos,
  isFilterActive,
  poMatches,
  type PoBucket,
  type PoFilterState,
} from '@/app/(workspace)/planning/pos/po-filter'
import { groupPosByLsx, type LsxRef } from '@/app/(workspace)/planning/pos/pos-groups'
import type { Po } from '@/app/(workspace)/planning/pos/po-types'
import { useLocalPref } from '@/lib/use-local-pref'
import {
  ALL_VIEW,
  GROUP_LABEL,
  SORT_LABEL,
  encodeView,
  groupSimple,
  sortPos,
  type GroupBy,
  type ViewState,
} from './views'

/**
 * Phần nhìn của Khuôn C — Phiếu mua. Tầng server ở `page.tsx`, phân tích ở
 * `docs/mua-hang-phieu-mua.md`.
 *
 * NĂM ĐIỀU KHÁC MÀN CŨ, mỗi điều chép của một hệ:
 *  · Khung nhìn có tên, mã trên URL           — SAP variant / Dynamics saved view
 *  · Gom theo là điều khiển, không phải hai màn — Odoo group-by
 *  · Hai trục trạng thái tách cột             — Dynamics / Odoo
 *  · Khay kiểm tra bày đủ hành động, khoá kèm lý do — Dynamics Action Pane
 *  · Chọn cột + mật độ nhớ theo máy           — SAP personalization
 */

const TONE: Record<string, 'stop' | 'warn' | 'done' | 'neutral'> = {
  gray: 'neutral',
  amber: 'warn',
  blue: 'neutral',
  green: 'done',
  red: 'stop',
}

const dmy = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

function daysBetween(a: string, b: string): number {
  const t = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  return Math.round((t(b) - t(a)) / 86_400_000)
}

/* ── CỘT ───────────────────────────────────────────────────────────────
   Chọn cột — chép SAP personalization. Bộ mặc định = bộ màn cũ, trừ "Ngày
   tạo" (màn cũ cũng chỉ hiện ở bảng phẳng). "Đơn" không tắt được: cột định
   danh mà tắt thì bảng còn toàn số không biết của ai. */
type ColKey =
  | 'ncc'
  | 'vat_tu'
  | 'chuoi'
  | 'trang_thai'
  | 've_kho'
  | 'hen'
  | 'kip'
  | 'phu_trach'
  | 'gia_tri'
  | 'tao'

const COLS: { key: ColKey; label: string; num?: boolean }[] = [
  { key: 'ncc', label: 'Nhà cung cấp' },
  { key: 'vat_tu', label: 'Loại · vật tư' },
  { key: 'chuoi', label: 'Lệnh SX' },
  { key: 'trang_thai', label: 'Trạng thái đơn' },
  { key: 've_kho', label: 'Về kho' },
  { key: 'hen', label: 'Hẹn giao' },
  { key: 'kip', label: 'Kịp SX?' },
  { key: 'phu_trach', label: 'Phụ trách' },
  { key: 'gia_tri', label: 'Giá trị', num: true },
  { key: 'tao', label: 'Ngày tạo' },
]
/*
  BỘ MẶC ĐỊNH GỌN LẠI (16/09/2026) — sáu cột trả lời sáu câu cơ bản về một đơn:
  của ai · cho lệnh nào · đang ở đâu · hẹn ngày nào · ai giữ · bao nhiêu tiền.

  Ba cột rời khỏi mặc định chứ KHÔNG mất: "Về kho" (x/y dòng), "Kịp SX?" và
  "Ngày tạo" vẫn bật lại được ở hộp Hiển thị. Chúng là câu hỏi của một đơn cụ
  thể, mà đơn cụ thể thì đã có trang chi tiết — bày sẵn cho cả 67 dòng là bắt
  mắt đọc chín cột để tìm một thứ.

  Đổi được thì đừng đổi ngầm: người đã lưu bộ cột riêng vẫn giữ nguyên bộ của
  họ, `colsRaw` có giá trị thì `DEFAULT_COLS` không đụng tới.
*/
/*
  "LOẠI · VẬT TƯ" VÀO BỘ MẶC ĐỊNH (27/09/2026, artboard 4 "Đơn mua cá nhân
  hoá"): màn từng không nói đơn mua CÁI GÌ — phải mở từng đơn. Khoá lưu bộ cột
  đổi sang `.v2` để bộ cũ còn nằm trong trình duyệt không giấu mất cột mới.
*/
const DEFAULT_COLS: ColKey[] = ['ncc', 'vat_tu', 'chuoi', 'trang_thai', 'hen', 'phu_trach', 'gia_tri'] // prettier-ignore

/**
 * Ô LỌC GÕ-TÌM cho danh mục dài (NCC, lệnh SX).
 *
 * Hai trạng thái, không bao giờ cùng lúc: CHƯA CHỌN thì là ô gõ tìm; ĐÃ CHỌN
 * thì là một chip mang đúng cái tên đang lọc, bấm vào là bỏ. Bày cả hai cùng
 * lúc tốn một hàng lọc mà không thêm thông tin nào.
 *
 * Tìm trên mảng ĐÃ NẠP SẴN nên không có vòng server; bọc trong Promise vì
 * `Combobox` (kiểu TRA) của kit khai `search` là bất đồng bộ (nó dựng cho danh mục 13k
 * dòng phải hỏi server). Trần 20 dòng: danh sách gợi ý dài hơn thế thì người
 * dùng gõ thêm chữ nhanh hơn là đọc.
 */
function LocLookup<T>({
  label,
  placeholder,
  selected,
  onClear,
  items,
  textOf,
  keyOf,
  onPick,
  render,
}: {
  label: string
  placeholder: string
  selected: string | null
  onClear: () => void
  items: T[]
  textOf: (x: T) => string
  keyOf: (x: T) => string
  onPick: (x: T) => void
  render?: (x: T) => React.ReactNode
}) {
  if (selected !== null) {
    return (
      <Chip on onClick={onClear}>
        {label}: {selected} ✕
      </Chip>
    )
  }
  return (
    <Combobox<T>
      label={label}
      placeholder={placeholder}
      width={210}
      keyOf={keyOf}
      render={render ?? ((x) => textOf(x))}
      onPick={onPick}
      search={async (q) => {
        const n = q.trim().toLowerCase()
        return items.filter((x) => textOf(x).toLowerCase().includes(n)).slice(0, 20)
      }}
    />
  )
}

export function DonScreen({
  today,
  pos,
  suppliers,
  lsxs,
  meId,
  canEdit,
  truncatedAt,
  initial,
  openId,
  defaultScope,
  urlScope,
  people,
}: {
  today: string
  pos: Po[]
  /** Người đang cầm ít nhất một đơn — hàng chip "Người phụ trách". */
  people: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  lsxs: LsxRef[]
  meId: string
  canEdit: boolean
  truncatedAt: number | null
  initial: ViewState
  openId: string | null
  /** Phạm vi mặc định theo vai (người mua → của tôi, người duyệt → cả phòng). */
  defaultScope: SupplyScope
  /** Phạm vi do địa chỉ trang quyết (link mang ?pham_vi=, ?mo=, bộ lọc…). */
  urlScope: SupplyScope | null
}) {
  const router = useRouter()

  const [view, setViewState] = useState<ViewState>(initial)
  /*
    PHẠM VI thay cho chip 'Của tôi' (27/09/2026): nhớ theo tài khoản, mặc định
    theo vai. Bộ lọc `mine` của khung nhìn giờ CHỈ đi từ đây — một nguồn, để
    công tắc, số đếm và danh sách không nói ba ý.
  */
  const [scope, setScopePref] = useScopePref('don', meId, defaultScope, urlScope)
  const eff = {
    ...view.filter,
    mine: scope === 'toi',
    ownerId: scope === 'toi' ? 'all' : view.filter.ownerId,
  }

  const [colsRaw] = useLocalPref('hg.mua-hang.don.cols.v2', '')
  const cols = useMemo<ColKey[]>(() => {
    const keep = new Set(COLS.map((c) => c.key))
    const list = colsRaw ? colsRaw.split(',').filter((k): k is ColKey => keep.has(k as ColKey)) : DEFAULT_COLS // prettier-ignore
    return COLS.map((c) => c.key).filter((k) => list.includes(k))
  }, [colsRaw])

  /**
   * ĐỔI KHUNG NHÌN = đổi state + đổi URL, không điều hướng.
   *
   * `history.replaceState` được App Router theo dõi, nên URL khớp mà không
   * tải lại server — bộ lọc chạy ở client trên tập đã nạp, y như màn cũ.
   * F5 hay dán link thì `page.tsx` giải mã lại từ URL.
   */
  function setView(next: ViewState, nextScope: SupplyScope = scope) {
    setViewState(next)
    const qs = new URLSearchParams(
      encodeView({ ...next, filter: { ...next.filter, mine: false } }),
    )
    // "Mọi trạng thái" phải GHI RA: bỏ trống thì F5 đọc thành "không có gì lạ"
    // và rơi về rổ mặc định "còn mở" — người dùng vừa chọn xem hết lại bị lọc.
    if (next.filter.bucket === 'all') qs.set('trang_thai', 'all')
    qs.set('pham_vi', nextScope)
    window.history.replaceState(null, '', `?${qs}`)
  }
  const patchFilter = (f: Partial<PoFilterState>) =>
    setView({ ...view, filter: { ...view.filter, ...f } })

  const ctx = { meId, today }
  const mineOf = (p: Po) =>
    isMyPo({ assigned_to: p.assigned_to ?? null, created_by: p.created_by }, meId)
  /*
    MỌI SỐ TRÊN MÀN ĐẾM TRONG PHẠM VI ĐANG CHỌN (27/09/2026). Trước đó công tắc
    nói "Của tôi 45" mà ngay bên cạnh "Quá hẹn mà chưa gửi 15", "Chưa hẹn giao
    14" và các số trong ô Rổ trạng thái vẫn đếm trên cả 87 đơn của phòng — bấm
    vào ra số khác. Chip là lối đi; lối đi phải nói có bao nhiêu thứ ở đầu kia
    TRONG phạm vi người dùng đang đứng.
  */
  const ownerOf = (p: Po) =>
    poOwner({ assigned_to: p.assigned_to ?? null, created_by: p.created_by })
  const ownerId = scope === 'toi' ? 'all' : view.filter.ownerId
  /*
    TẬP NỀN = đơn của NGƯỜI đang xem (của tôi / một người mua / cả phòng).
    Số trên ô trạng thái, chip loại đơn, danh sách lệnh đều đếm trên tập này.
  */
  const scopePos = useMemo(
    () =>
      scope === 'toi'
        ? pos.filter(mineOf)
        : ownerId !== 'all'
          ? pos.filter((p) => ownerOf(p) === ownerId)
          : pos,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pos, scope, meId, ownerId],
  )
  const mineTotal = useMemo(() => pos.filter(mineOf).length, [pos, meId]) // eslint-disable-line react-hooks/exhaustive-deps

  /*
    NGƯỜI PHỤ TRÁCH (27/09/2026, artboard 4): "Của tôi · Huy · Truyền · Cả
    phòng" thay công tắc hai nấc — trưởng phòng hỏi "Huy đang cầm gì" mà trước
    chỉ có của tôi / cả phòng. "Của tôi" vẫn là phạm vi nhớ theo tài khoản; chọn
    một người khác là xem cả phòng lọc theo người đó (không nhớ — lần sau vào
    lại thấy việc của mình). Người không cầm đơn nào thì không có chip.
  */
  const nick = useMemo(() => givenNames(people), [people])
  const personCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of pos) {
      const o = ownerOf(p)
      if (o) m.set(o, (m.get(o) ?? 0) + 1)
    }
    return m
  }, [pos])
  const personOptions = [
    ...(mineTotal > 0 || defaultScope === 'toi' || scope === 'toi'
      ? [{ value: 'toi', label: 'Của tôi', count: mineTotal, hint: 'Đơn tôi phụ trách' }]
      : []),
    ...people
      .filter((u) => u.id !== meId && (personCount.get(u.id) ?? 0) > 0)
      .sort((a, b) => (personCount.get(b.id) ?? 0) - (personCount.get(a.id) ?? 0))
      .map((u) => ({
        value: u.id,
        label: nick.get(u.id) ?? u.name,
        count: personCount.get(u.id) ?? 0,
        hint: `Đơn ${u.name} phụ trách`,
      })),
    { value: 'phong', label: 'Cả phòng', count: pos.length, hint: 'Mọi đơn trong sổ' },
  ]
  const personValue = scope === 'toi' ? 'toi' : ownerId !== 'all' ? ownerId : 'phong'
  function pickPerson(v: string) {
    if (v === 'toi') {
      setScopePref('toi')
      setView({ ...view, filter: { ...view.filter, ownerId: 'all' } }, 'toi')
    } else {
      // Xem MỘT đồng nghiệp: không nhớ (liếc qua). "Cả phòng" thì nhớ như cũ.
      setScopePref('phong', { remember: v === 'phong' })
      setView({ ...view, filter: { ...view.filter, ownerId: v === 'phong' ? 'all' : v } }, 'phong') // prettier-ignore
    }
  }
  /** Đang xem đơn của MỘT người — cột Phụ trách toàn một tên, ẩn đi. */
  const onePerson = scope === 'toi' || ownerId !== 'all'

  /*
    LỆNH SX: Ô CHỌN CÓ SẴN DANH SÁCH (27/09/2026) thay ô gõ-tìm — ô gõ trông như
    ô nhập, không cho thấy lệnh nào đang có đơn và bao nhiêu. Chỉ lệnh có đơn
    trong tập nền (kể cả lệnh GỘP), mới nhất trên, kèm số đơn.
  */
  /*
    Chip LOẠI ĐƠN và danh sách LỆNH đếm TRONG RỔ TRẠNG THÁI đang chọn: đang
    xem "Còn mở (18)" mà chip ghi "Phụ kiện 36" thì bấm vào ra 13 — số trên lối
    đi phải bằng số ở đầu kia. (Rổ trạng thái thì vẫn đếm trên cả tập nền: nó
    chính là trục đang chọn.)
  */
  const bucketPos = useMemo(
    () =>
      scopePos.filter((p) =>
        poMatches(p, { ...EMPTY_FILTER, bucket: view.filter.bucket }, ctx),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopePos, view.filter.bucket],
  )
  /** Số của chip "Chưa hẹn giao" + hai ô quá hẹn — cùng tập với chip loại đơn. */
  const inBucket = useMemo(
    () => countPos(bucketPos, meId, today),
    [bucketPos, meId, today],
  )
  const lsxOptions = useMemo(() => {
    const m = new Map<string, { code: string; n: number }>()
    let ngoai = 0
    for (const p of bucketPos) {
      if (!p.production_order_id) ngoai++
      const ids = [
        ...(p.production_order_id
          ? [{ id: p.production_order_id, code: p.lsx_code ?? '?' }]
          : []),
        ...(p.extra_lsx ?? []),
      ]
      for (const x of ids) {
        const cur = m.get(x.id) ?? { code: x.code, n: 0 }
        cur.n++
        m.set(x.id, cur)
      }
    }
    return { list: [...m.entries()].sort((a, b) => b[1].code.localeCompare(a[1].code, 'vi', { numeric: true })), ngoai } // prettier-ignore
  }, [bucketPos])
  const lsxValue =
    view.filter.lsxId !== 'all' ? view.filter.lsxId : view.filter.type === 'standalone' ? '@ngoai' : 'all' // prettier-ignore

  /* LOẠI ĐƠN — chỉ loại đang có trong tập nền, nhiều trước. */
  const templateCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of bucketPos)
      if (p.template) m.set(p.template, (m.get(p.template) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [bucketPos])
  const counts = useMemo(() => countPos(scopePos, meId, today), [scopePos, meId, today])
  const shown = useMemo(
    () =>
      sortPos(
        pos.filter((p) => poMatches(p, eff, ctx)),
        view.sortBy,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pos, view, meId, today, scope],
  )
  /*
    TỔNG CỦA DANH SÁCH ĐANG HIỆN — tính trên `shown` (sau lọc), không trên cả
    sổ: người mua lọc rồi mới hỏi tổng, tổng của thứ họ không nhìn thấy là số
    gây hiểu nhầm. Đơn ĐÃ HUỶ không cộng tiền nhưng vẫn đếm để chân bảng nói
    ra — giấu chúng đi thì số dòng và số tiền lệch nhau mà không ai biết vì sao.
  */
  const tongHien = useMemo(() => {
    const m: Record<string, number> = {}
    let huy = 0
    for (const p of shown) {
      if (p.status === 'cancelled') {
        huy++
        continue
      }
      m[p.currency] = (m[p.currency] ?? 0) + (p.total ?? 0)
    }
    return {
      huy,
      tien: Object.entries(m)
        .filter(([, v]) => v > 0)
        .map(([c, v]) => `${v.toLocaleString('vi-VN', { maximumFractionDigits: c === 'VND' ? 0 : 2 })} ${c === 'VND' ? '₫' : c}`), // prettier-ignore
    }
  }, [shown])
  const lsxDue = useMemo(
    () => new Map(lsxs.map((l) => [l.id, l.materials_due_at])),
    [lsxs],
  )
  const emptyLsx = useMemo(() => groupPosByLsx(pos, lsxs, today).emptyLsxs.length, [pos, lsxs, today]) // prettier-ignore

  /*
    BA BỘ LỌC ĐẾN TỪ ĐƯỜNG LINK — khoảng ngày lập và loại đơn.

    Hộp "Lọc thêm" đã bỏ 17/09/2026 (chủ dự án: "bỏ phần lọc thêm đi"): ba ô
    đó dùng thưa hơn hẳn bốn ô còn lại mà chiếm nguyên một nút trên hàng lọc.
    Chúng vẫn sống trong `PoFilterState` vì link chia sẻ và file Excel mã hoá
    theo cùng một khung nhìn — nên vẫn phải ĐẾM: bộ lọc đang cắt bớt dòng mà
    không có dấu hiệu nào trên màn là cách chắc chắn để người dùng tưởng mất
    dữ liệu. Có thì hiện một chip nói rõ, bấm là bỏ.
  */
  const moreCount =
    (view.filter.fromDate ? 1 : 0) +
    (view.filter.toDate ? 1 : 0) +
    (view.filter.type === 'lsx' ? 1 : 0)

  /* Hai thẻ "quá hẹn" là hai nửa của cùng một công tắc — bật nửa này thì nửa
     kia tắt, bấm lại nửa đang bật thì tắt hẳn. */
  const lateOn = (side: 'sent' | 'unsent') =>
    view.filter.late && view.filter.lateSide === side
  const toggleLate = (side: 'sent' | 'unsent') =>
    patchFilter(
      lateOn(side) ? { late: false, lateSide: 'any' } : { late: true, lateSide: side },
    )

  /* Nhóm để vẽ: mỗi nhóm = tiêu đề + meta + dòng. Gom theo lệnh dùng hàm của
     màn cũ (biết tiền theo tệ, đơn mượn); bốn trục kia dùng `groupSimple`. */
  const groups = useMemo(() => {
    if (view.groupBy === 'none') return [{ key: '@all', name: null as string | null, meta: null as React.ReactNode, pos: shown, borrowed: new Set<string>(), lsxId: null as string | null }] // prettier-ignore
    if (view.groupBy === 'lsx') {
      const g = groupPosByLsx(shown, lsxs, today)
      const out = g.groups.map((x) => ({
        key: x.key,
        name: x.lsx_code,
        meta: (
          <>
            {x.customer_name && <span>{x.customer_name} · </span>}
            <span className="num">{x.pos.length} đơn</span>
            {x.total > 0 && (
              <span>
                {' '}
                ·{' '}
                <span className="num">
                  {x.total.toLocaleString('vi-VN')} {x.currency}
                </span>
              </span>
            )}{' '}
            {/* prettier-ignore */}
            {x.otherTotals.map(
              (t) =>
              <span key={t.currency}> · <span className="num">{t.total.toLocaleString('vi-VN')} {t.currency}</span></span>, // prettier-ignore
            )}
            {x.late > 0 && (
              <span className="text-[var(--stop)]"> · {x.late} quá hẹn</span>
            )}
            {x.linesTotal > 0 && (
              <span>
                {' '}
                · về {x.linesDone}/{x.linesTotal} dòng
              </span>
            )}
            {x.materials_due_at && <span> · hạn VT {dmy(x.materials_due_at)}</span>}
            {canEdit && x.lsx_id && (
              <a
                href={`/mua-hang/don/moi?lsx=${x.lsx_id}`}
                className="ml-2 font-semibold text-[var(--act)] normal-case"
              >
                + Đặt thêm
              </a>
            )}
          </>
        ),
        pos: x.pos,
        borrowed: x.borrowed,
        lsxId: x.lsx_id,
      }))
      if (g.standalone.pos.length > 0)
        out.push({ key: '@standalone', name: 'Ngoài lệnh sản xuất', meta: <span className="num">{g.standalone.pos.length} đơn</span>, pos: g.standalone.pos, borrowed: new Set(), lsxId: null }) // prettier-ignore
      return out
    }
    return groupSimple(shown, view.groupBy).map((x) => ({ ...x, name: x.name as string | null, meta: <span>{x.meta}</span> as React.ReactNode, borrowed: new Set<string>(), lsxId: null as string | null })) // prettier-ignore
  }, [shown, view.groupBy, lsxs, today, canEdit])

  /**
   * Mở bằng link (`?mo=`) thì CUỘN TỚI đúng dòng và tô dòng đó lên.
   *
   * Người vừa lưu nháp được đẩy về đây; đơn của họ nằm đâu đó giữa 67 dòng,
   * nên phải tự đưa mắt người dùng tới. Chỉ chạm DOM, không đổi state.
   *
   * Tìm theo `data-anchor` chứ không theo `id`: một đơn MUA CHUNG hiện dưới
   * mọi lệnh nó mua hộ, nên có nhiều dòng cùng trỏ về một đơn. `CSS.escape`
   * vì `openId` đến từ URL — ai đó gắn dấu nháy vào là câu chọn tử hỏng.
   */
  useEffect(() => {
    if (openId)
      document
        .querySelector(`[data-anchor="${CSS.escape(openId)}"]`)
        ?.scrollIntoView({ block: 'center' })
  }, [openId])

  // Đang xem đơn của MỘT người thì cột Phụ trách toàn một tên — ẩn đi.
  // Gom theo lệnh thì cột Lệnh SX lặp đúng tên nhóm ở mọi dòng (147px) — ẩn;
  // đơn gộp lệnh khi đó ghi "+N lệnh" cạnh mã đơn.
  const shownCols = cols.filter(
    (k) =>
      !(onePerson && k === 'phu_trach') && !(view.groupBy === 'lsx' && k === 'chuoi'),
  )
  const colCount = shownCols.length + 1
  const has = (k: ColKey) => shownCols.includes(k)

  /* ── vẽ ─────────────────────────────────────────────────────────────── */
  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Đơn mua"
        /*
          BỐN CON SỐ NÀY LÀ BỘ LỌC, không phải bảng thành tích.

          Trước 16/09/2026 chúng chỉ đọc, và ngay dưới là ba chip lọc mang
          ĐÚNG những con số đó — cùng một khái niệm hiện hai lần, một lần bấm
          được một lần không. Tệ hơn: chip "Quá hẹn" đếm gộp `late +
          lateUnsent` còn ở đây tách làm hai, nên hai chỗ nói hai số khác nhau
          về cùng một thứ.

          Nay số ở đây bấm được và chip "Quá hẹn" bỏ đi. "NCC trễ hẹn" và
          "Quá hẹn mà chưa gửi" vẫn là hai dòng riêng vì chúng là hai việc
          khác nhau: một cái đi giục nhà cung cấp, một cái tự mình phải gửi
          đơn đi — gộp lại thì không biết phải làm gì.
        */
        facts={[
          { label: 'Đang hiện', value: `${shown.length} / ${scopePos.length}` },
          { label: 'NCC trễ hẹn', value: String(inBucket.late), tone: inBucket.late > 0 ? 'stop' : undefined, on: lateOn('sent'), onClick: () => toggleLate('sent') }, // prettier-ignore
          { label: 'Quá hẹn mà chưa gửi', value: String(inBucket.lateUnsent), tone: inBucket.lateUnsent > 0 ? 'warn' : undefined, on: lateOn('unsent'), onClick: () => toggleLate('unsent') }, // prettier-ignore
        ]}
        actions={
          <>
            <Btn icon="lenh" href="/mua-hang/yeu-cau">
              Vật tư theo lệnh
            </Btn>
            {/*
              XUẤT ĐÚNG CÁI ĐANG NHÌN. Chuyển nguyên bộ lọc hiện hành sang
              route, và route lọc lại bằng chính `decodeView` + `poMatches` mà
              màn này dùng — nên file luôn bằng đúng danh sách trên màn.

              Không dùng `Btn href` tĩnh: bộ lọc đổi theo state, href tính lúc
              render sẽ là bộ lọc của lần render trước.
            */}
            <Btn
              onClick={() => {
                // `eff`, không phải `view`: phạm vi nằm ngoài khung nhìn, quên
                // nó là file ra 87 đơn trong khi màn đang hiện 45.
                const qs = encodeView({ ...view, filter: eff })
                window.open(`/api/dept/supply/pos/export-list${qs ? `?${qs}` : ''}`, '_blank') // prettier-ignore
              }}
              icon="excel"
              title={`Xuất ${shown.length} đơn đang hiện ra Excel`}
            >
              Xuất danh sách
            </Btn>
            {canEdit && (
              <Btn primary icon="them" href="/mua-hang/don/moi">
                Soạn đơn mua
              </Btn>
            )}
          </>
        }
      />

      {/* Hàng 1: tìm + rổ trạng thái + hai ô gõ-tìm */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1">
        <SearchInput
          value={view.filter.q}
          onChange={(q) => patchFilter({ q })}
          placeholder="Số PO, NCC, vật tư, LSX, mã đơn hàng…"
          width={260}
        />
        <Pick
          label="Rổ trạng thái"
          value={view.filter.bucket}
          onChange={(b) => patchFilter({ bucket: b as PoBucket })}
          options={[
            { value: 'all', label: `Mọi trạng thái (${counts.all})` },
            { value: 'open', label: `Còn mở — chưa về đủ (${counts.open})` },
            ...PO_BUCKETS.map((b) => ({
              value: b.key,
              label: `${b.label} (${counts[b.key]})`,
            })),
          ]}
        />
        {/*
          NCC VÀ LỆNH SX: GÕ TÌM, KHÔNG PHẢI CUỘN CHỌN.

          Trước 14/09/2026 ô NCC là `<select>` trần với 164 lựa chọn (và còn
          tăng) — không gõ tìm được, phải cuộn một danh sách dài để chọn một
          cái tên mình đã biết sẵn. Lệnh SX thì trước đây chỉ GOM được chứ
          không lọc được. Chủ dự án báo đúng chỗ này: "số lượng LSX và đơn đặt
          NCC nhiều thì các phần lọc không đáp ứng được".

          Chọn xong thì ô tìm nhường chỗ cho một chip mang đúng cái tên đang
          lọc — nhìn là biết đang lọc gì, bấm là bỏ. Ô `<select>` không làm
          được điều đó khi danh sách dài: nhãn bị cắt và không ai chắc mình
          đang đứng ở đâu trong danh sách.
        */}
        <LocLookup
          label="Nhà cung cấp"
          placeholder="Gõ tên nhà cung cấp…"
          selected={
            view.filter.supplierId === 'all'
              ? null
              : (suppliers.find((s) => s.id === view.filter.supplierId)?.name ??
                'NCC không còn trong danh mục')
          }
          onClear={() => patchFilter({ supplierId: 'all' })}
          items={suppliers}
          textOf={(s) => s.name}
          keyOf={(s) => s.id}
          onPick={(s) => patchFilter({ supplierId: s.id })}
        />
        <Pick
          label="Lệnh sản xuất"
          value={lsxValue}
          onChange={(v) =>
            patchFilter(
              v === '@ngoai'
                ? { lsxId: 'all', type: 'standalone' }
                : {
                    lsxId: v,
                    type: view.filter.type === 'standalone' ? 'all' : view.filter.type,
                  },
            )
          }
          options={[
            { value: 'all', label: `Mọi lệnh (${bucketPos.length} đơn)` },
            ...lsxOptions.list.map(([id, x]) => ({
              value: id,
              label: `${x.code} · ${x.n} đơn`,
            })),
            ...(lsxOptions.ngoai > 0
              ? [{ value: '@ngoai', label: `Ngoài lệnh SX · ${lsxOptions.ngoai} đơn` }]
              : []),
            // Lệnh đến từ link mà không còn đơn nào trong tập nền: vẫn phải hiện
            // đúng cái đang lọc, không thì ô chọn nói "Mọi lệnh" mà bảng trống.
            ...(view.filter.lsxId !== 'all' &&
            !lsxOptions.list.some(([id]) => id === view.filter.lsxId)
              ? [
                  {
                    value: view.filter.lsxId,
                    label: `${lsxs.find((l) => l.id === view.filter.lsxId)?.code ?? 'Lệnh đang lọc'} · 0 đơn`,
                  },
                ]
              : []),
          ]}
        />
        <span className="ml-auto flex items-center gap-2">
          {/*
            GOM THEO ở lại ngoài, SẮP XẾP thì không. Gom là câu hỏi nghiệp vụ —
            "xem theo lệnh hay theo nhà cung cấp" đổi hẳn cách đọc bảng và
            người mua đổi nó trong ngày; sắp xếp, chọn cột, mật độ là ba tuỳ
            chỉnh HIỂN THỊ, đặt một lần rồi thôi. Ba thứ đó vào chung một hộp.
          */}
          <Pick
            label="Gom theo"
            value={view.groupBy}
            onChange={(g) => setView({ ...view, groupBy: g as GroupBy })}
            options={(Object.keys(GROUP_LABEL) as GroupBy[]).map((k) => ({ value: k, label: `Gom: ${GROUP_LABEL[k]}` }))} // prettier-ignore
          />
        </span>
      </div>

      {/* Hàng 2: người phụ trách — đơn của AI. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1">
        <ScopeSwitch
          label="Người phụ trách"
          value={personValue}
          onChange={pickPerson}
          options={personOptions}
        />
      </div>

      {/*
        Hàng 3: loại đơn + chưa hẹn giao + bỏ lọc.

        CHIP "QUÁ HẸN" ĐÃ BỎ (16/09/2026). Nó đếm `late + lateUnsent` gộp lại,
        trong khi dải dữ kiện ngay trên tách làm hai con số — cùng một khái
        niệm, hai chỗ, hai số. Nay hai thẻ ở trên bấm được và lọc đúng phía của
        mình, nên chip này chỉ còn là đường thứ hai làm cùng một việc.
      */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1">
        <span className="text-k-label font-semibold tracking-[.04em] text-[var(--ink-3)] uppercase">
          Loại đơn
        </span>
        {templateCounts.map(([t, n]) => (
          <Chip
            key={t}
            on={view.filter.template === t}
            count={n}
            onClick={() =>
              patchFilter({ template: view.filter.template === t ? 'all' : t })
            }
          >
            {poTemplateShort(t) ?? t}
          </Chip>
        ))}
        <span className="mx-1 h-4 border-l border-[var(--line)]" aria-hidden />
        <Chip
          on={view.filter.noEta}
          count={inBucket.noEta}
          icon="hen"
          onClick={() => patchFilter({ noEta: !view.filter.noEta })}
        >
          Chưa hẹn giao
        </Chip>
        {/* Lọc đến từ link mà không có ô nào bày ra — xem ghi chú ở `moreCount`. */}
        {moreCount > 0 && (
          <Chip
            on
            count={moreCount}
            onClick={() =>
              patchFilter({
                fromDate: '',
                toDate: '',
                type: view.filter.type === 'lsx' ? 'all' : view.filter.type,
              })
            }
          >
            Lọc theo ngày lập / loại đơn
          </Chip>
        )}
        {/*
          BỎ LỌC LUÔN CÓ MẶT, khoá lại khi không có gì để bỏ. Trước đây nó chỉ
          hiện khi đang lọc, nên mỗi lần bật/tắt một chip là cả hàng bên phải
          nhảy ngang một đoạn bằng bề rộng cái nút.
        */}
        <span className="ml-auto">
          <Btn
            icon="boLoc"
            disabled={!isFilterActive(view.filter)}
            title={
              isFilterActive(view.filter) ? undefined : 'Chưa có bộ lọc nào đang bật'
            }
            onClick={() =>
              setView({
                ...view,
                filter: {
                  ...view.filter,
                  q: '',
                  bucket: 'all',
                  supplierId: 'all',
                  lsxId: 'all',
                  fromDate: '',
                  toDate: '',
                  type: 'all',
                  mine: false,
                  late: false,
                  lateSide: 'any',
                  noEta: false,
                  ownerId: 'all',
                  template: 'all',
                },
              })
            }
          >
            Bỏ lọc
          </Btn>
        </span>
      </div>

      {truncatedAt != null && (
        <NoticeBar tone="warn" tag="Cắt đuôi">
          Sổ chạm trần <b>{truncatedAt} đơn</b> — số trên màn có thể thiếu.
        </NoticeBar>
      )}
      {emptyLsx > 0 && view.groupBy === 'lsx' && (
        <NoticeBar
          tone="warn"
          tag="Lệnh trống"
          action={{
            label: 'Vật tư theo lệnh',
            onClick: () => router.push('/mua-hang/yeu-cau'),
          }}
        >
          {/* MỘT CÂU. Bản cũ giải thích thêm hai vế "gom theo lệnh chỉ hiện lệnh đã
              có đơn" và "câu lệnh nào còn thiếu đồ trả lời ở trang kia" — đúng cả,
              nhưng nút bên phải đã nói đi đâu, nên đó là chữ đọc một lần rồi thừa
              mãi mãi trên một thanh màu vàng nằm giữa bộ lọc và bảng. */}
          <b>{emptyLsx} lệnh</b> đang chạy chưa có đơn mua nào.
        </NoticeBar>
      )}

      <div className="flex min-h-0 flex-1 border-t border-[var(--line)]">
        {shown.length === 0 ? (
          <div className="min-w-0 flex-1 bg-[var(--surface-card)]">
            <Empty
              headline="Không có đơn nào khớp"
              reason={`Bộ lọc đang bật không còn dòng nào trong ${scopePos.length} đơn ${scope === 'toi' ? 'của tôi' : 'của phòng'}.`}
              next={
                <>
                  <Btn
                    icon="boLoc"
                    onClick={() => {
                      setScopePref('phong')
                      setView(ALL_VIEW)
                    }}
                  >
                    Xem tất cả {pos.length} đơn
                  </Btn>
                  {canEdit && (
                    <Btn icon="them" primary href="/mua-hang/don/moi">
                      Soạn đơn mua
                    </Btn>
                  )}
                </>
              }
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            <Table>
              <THead pinFirst>
                <th>Đơn</th>
                {COLS.filter((c) => has(c.key)).map((c) => (
                  <th key={c.key} style={c.num ? { textAlign: 'right' } : undefined}>
                    {c.label}
                  </th>
                ))}
              </THead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    {g.name && <GroupRow name={g.name} meta={g.meta} cols={colCount} />}
                    {g.pos.map((p) => {
                      const late = assessPoLate(p, today)
                      const noEta = isMissingEta(p)
                      const fit = assessPoFit(p, lsxDue.get(p.production_order_id ?? ''))
                      const borrowed = g.borrowed.has(p.id)
                      return (
                        /*
                          BẤM DÒNG LÀ MỞ ĐƠN (17/09/2026, chủ dự án: "bỏ tính
                          năng chọn đơn đi").

                          Trước đó bấm dòng CHỌN nó: tô nền, mở khay bên phải,
                          bật thanh hành động. Ba tầng đó nay đi cả — màn danh
                          sách trả lời "đơn nào cần tôi động vào", còn động vào
                          thì làm trên chứng từ, nơi có đủ dòng hàng và tiền để
                          quyết. Một cú bấm, một chỗ đến, không còn bước giữa.
                        */
                        <Row
                          key={`${g.key}:${p.id}`}
                          anchor={p.id}
                          selected={p.id === openId}
                          onClick={() => router.push(`/mua-hang/don/${p.id}`)}
                        >
                          <Cell
                            pin
                            className={
                              p.status === 'cancelled' ? 'opacity-60' : undefined
                            }
                          >
                            {/*
                              MÃ ĐƠN LÀ LINK THẬT tới chứng từ đầy đủ.

                              Trước 14/09/2026 nó là `<Code>` trần: mono + màu
                              hành động nên ĐỌC RA là bấm được, mà bấm thì chỉ
                              chọn dòng. Đường duy nhất tới chứng từ là bấm
                              dòng → khay bên phải → "Mở đơn đầy đủ" — ba bước,
                              và ở màn hẹp khay nằm ngoài tầm nhìn nên bước ba
                              không thấy đâu. Chủ dự án báo đúng triệu chứng:
                              "tạo đơn xong, vào xem chi tiết ở đâu không thấy".

                              Giữ là thẻ `<a>` thật dù cả dòng nay cũng dẫn
                              tới đó: chuột giữa mở tab mới, chuột phải có
                              "mở trong tab mới" — một cái `onClick` trên dòng
                              không cho được điều đó. `stopPropagation` để
                              khỏi điều hướng hai lần.
                            */}
                            <Code
                              as="a"
                              href={`/mua-hang/don/${p.id}`}
                              title={`Mở chứng từ ${p.code}`}
                              onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            >
                              {p.code}
                            </Code>
                            {/*
                              ĐƠN GỘP LỆNH: cột Lệnh SX ghi "09/26-27 - MX +1". Cột đó
                              ẩn (đang gom theo lệnh) thì nói ở đây, NGẮN — nhãn dài
                              "gộp với 09/26-27 - MX" từng nở cột Đơn lên 267px.
                            */}
                            {!has('chuoi') && (p.extra_lsx?.length ?? 0) > 0 && (
                              <span
                                className="text-k-label ml-1 text-[var(--ink-3)]"
                                title={`Một đơn mua cho ${[p.lsx_code, ...(p.extra_lsx ?? []).map((x) => x.code)].filter(Boolean).join(' + ')}`}
                              >
                                +{p.extra_lsx?.length} lệnh
                              </span>
                            )}
                            {borrowed && (p.extra_lsx?.length ?? 0) === 0 && (
                              <Tag tone="neutral">mua chung</Tag>
                            )}
                          </Cell>
                          {/*
                            TÊN NCC ĐỂ ĐỌC: bỏ phần loại hình công ty — cột từng
                            cắt mất đúng phần phân biệt (26/46 tên > 30 ký tự).
                            Tên đầy đủ khi rê chuột; ô tìm vẫn tìm theo tên đủ.
                          */}
                          {has('ncc') && (
                            <Cell title={p.supplier_name} className="max-w-44">
                              <span className="font-semibold">
                                {supplierShortName(p.supplier_name)}
                              </span>
                            </Cell>
                          )}
                          {has('vat_tu') &&
                            (() => {
                              const m = materialSummary(p.material_names ?? [])
                              const loai = poTemplateShort(p.template)
                              return (
                                <Cell
                                  grow
                                  title={[loai, ...(p.material_names ?? [])]
                                    .filter(Boolean)
                                    .join(' · ')}
                                >
                                  {loai && <span className="font-semibold">{loai}</span>}
                                  {loai && m.head && ' · '}
                                  {m.head}
                                  {m.more > 0 && (
                                    <span className="text-k-label ml-1 text-[var(--ink-3)]">
                                      +{m.more} mã
                                    </span>
                                  )}
                                  {!loai && !m.head && <Num value="" />}
                                </Cell>
                              )
                            })()}
                          {/*
                            LỆNH SX — mã lệnh, BẤM ĐƯỢC để lọc cả màn về đúng
                            lệnh đó.

                            Trước 16/09/2026 cột này tên "Chuỗi liên kết" và in
                            `<mã đơn khách> › <mã lệnh>` bằng chữ mờ, không bấm
                            được. Hai vấn đề: cái tên không nói ra đây là lệnh
                            sản xuất, và thấy một lệnh đáng quan tâm thì phải đi
                            vòng lên ô lọc gõ lại mã vừa đọc. Mã đơn khách bỏ
                            khỏi cột — nó vẫn tìm được bằng ô tìm và vẫn nằm
                            trên trang chi tiết.
                          */}
                          {has('chuoi') && (
                            <Cell>
                              {p.lsx_code ? (
                                <Code
                                  as="button"
                                  type="button"
                                  title={`Chỉ xem đơn của lệnh ${p.lsx_code}`}
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    patchFilter({
                                      lsxId: p.production_order_id ?? 'all',
                                    })
                                  }}
                                >
                                  {p.lsx_code}
                                </Code>
                              ) : null}
                              {p.lsx_code && (p.extra_lsx?.length ?? 0) > 0 && (
                                <span
                                  className="text-k-label ml-1 text-[var(--ink-3)]"
                                  title={`Gộp thêm: ${(p.extra_lsx ?? []).map((x) => x.code).join(', ')}`}
                                >
                                  +{p.extra_lsx?.length}
                                </span>
                              )}
                              {p.lsx_code ? null : (
                                <span className="text-[var(--ink-3)]">Ngoài LSX</span>
                              )}
                            </Cell>
                          )}
                          {/*
                            Bề rộng CHẶN ở 160px: câu gợi ý của đơn nháp ("kiểm tra
                            rồi gửi GĐ duyệt") từng nở cột lên 223px và đẩy bảng
                            quá khung. Bị cắt thì rê chuột đọc đủ.
                          */}
                          {has('trang_thai') && (
                            <Cell
                              className="max-w-40"
                              title={[
                                PO_STATUS_LABEL[p.status as PoStatus],
                                PO_NEXT_HINT[p.status as PoStatus],
                              ]
                                .filter(Boolean)
                                .join(' → ')}
                            >
                              <Tag tone={TONE[PO_STATUS_TONE[p.status as PoStatus]]}>
                                {PO_STATUS_LABEL[p.status as PoStatus]}
                              </Tag>
                              {PO_NEXT_HINT[p.status as PoStatus] && (
                                <span className="text-k-label ml-1 text-[var(--ink-3)]">
                                  → {PO_NEXT_HINT[p.status as PoStatus]}
                                </span>
                              )}
                            </Cell>
                          )}
                          {has('ve_kho') && (
                            <Cell num>
                              <Num
                                value={
                                  p.lines_total
                                    ? `${p.lines_done}/${p.lines_total} dòng`
                                    : ''
                                }
                                zero="dash"
                              />
                            </Cell>
                          )}
                          {has('hen') && (
                            <Cell
                              num
                              className={
                                late === 'overdue' ? 'text-[var(--stop)]' : undefined
                              }
                            >
                              {p.expected_at ? (
                                <>
                                  {/* Năm nay thì bỏ năm — cột hẹp lại ~35px để bảng vừa 1280. */}
                                  {p.expected_at.slice(0, 4) === today.slice(0, 4)
                                    ? dmy(p.expected_at).slice(0, 5)
                                    : dmy(p.expected_at)}
                                  {late === 'overdue' && (
                                    <span className="text-k-label ml-1">
                                      quá {daysBetween(p.expected_at, today)} ng
                                    </span>
                                  )}
                                  {late === 'due_soon' && (
                                    <span className="text-k-label ml-1 text-[var(--warn)]">
                                      còn {-daysBetween(p.expected_at, today)} ng
                                    </span>
                                  )}
                                </>
                              ) : noEta ? (
                                <Tag tone="warn">chưa hẹn</Tag>
                              ) : (
                                <Num value="" />
                              )}
                            </Cell>
                          )}
                          {has('kip') && (
                            <Cell>
                              {fit === 'late' ? (
                                <Tag tone="stop">Trễ SX</Tag>
                              ) : fit === 'tight' ? (
                                <Tag tone="warn">Sát hạn</Tag>
                              ) : fit === 'ok' ? (
                                <Tag tone="done">Kịp</Tag>
                              ) : (
                                <Num value="" />
                              )}
                            </Cell>
                          )}
                          {has('phu_trach') && (
                            /* Tên GỌI (Nga, Huy) — cùng chữ trên hàng chip Người phụ
                               trách; họ tên đầy đủ khi rê chuột. Chưa giao ai thì
                               người lập đang cầm (lib/supply-scope). */
                            <Cell
                              muted
                              title={
                                people.find((u) => u.id === ownerOf(p))?.name ??
                                p.assignee_name ??
                                'chưa giao ai'
                              }
                            >
                              {mineOf(p) ? '★ ' : ''}
                              {(ownerOf(p) && nick.get(ownerOf(p)!)) ??
                                p.assignee_name ??
                                'chưa giao ai'}
                            </Cell>
                          )}
                          {has('gia_tri') && (
                            <Cell num>
                              <Num
                                value={
                                  p.total
                                    ? // VND ngầm hiểu (chân bảng ghi ₫); ngoại tệ thì ghi rõ.
                                      `${p.total.toLocaleString('vi-VN')}${p.currency === 'VND' ? '' : ` ${p.currency}`}`
                                    : ''
                                }
                                strong
                              />
                            </Cell>
                          )}
                          {has('tao') && (
                            <Cell num>
                              <Num value={dmy(p.created_at)} muted />
                            </Cell>
                          )}
                        </Row>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
              {/*
                CHÂN BẢNG — số nào không kiểm được thì không ai tin (luật 6 của
                sổ thiết kế). Màn này có cột tiền và lọc được xuống 23 đơn, mà
                tới 15/09/2026 KHÔNG có dòng tổng nào: câu đầu tiên người mua
                hỏi khi lọc "nháp chưa gửi" là "tổng bao nhiêu tiền đang chờ",
                và họ phải tự cộng. Màn cũ cũng thiếu — không phải bước lùi,
                là khoảng trống của cả hai bản.

                TIỀN CỘNG RIÊNG TỪNG LOẠI, không quy đổi — cùng luật với ba
                màn kia của khu. Chân bảng nói luôn phần KHÔNG gồm: đơn đã huỷ.
              */}
              <TFoot
                label={<td colSpan={Math.max(1, shownCols.length - 2)}>Cộng {shown.length} đơn đang hiện</td>} // prettier-ignore
                cells={<td className="num">{tongHien.tien.join(' · ') || ''}</td>}
                caveat={
                  tongHien.huy > 0
                    ? `Chưa gồm ${tongHien.huy} đơn đã huỷ đang hiện trong danh sách.`
                    : 'Cộng riêng từng loại tiền, KHÔNG quy đổi.'
                }
              />
            </Table>
          </div>
        )}
      </div>

      <StatusBar
        left={[
          scope === 'toi' ? 'Phạm vi: của tôi' : 'Phạm vi: cả phòng',
          isFilterActive(view.filter)
            ? view.filter.bucket === 'open' &&
              !isFilterActive({ ...view.filter, bucket: 'all' })
              ? `Còn mở · ẩn ${counts.received + counts.cancelled} đơn đã đóng sổ`
              : 'Đang lọc'
            : 'Mọi trạng thái',
          'Gom: ' + GROUP_LABEL[view.groupBy],
          'Sắp: ' + SORT_LABEL[view.sortBy],
        ]}
        right={`${shown.length} / ${scopePos.length} đơn`}
      />
    </ScreenFrame>
  )
}
