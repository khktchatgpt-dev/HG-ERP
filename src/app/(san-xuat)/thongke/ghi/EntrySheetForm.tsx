'use client'

import { Fragment, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
  DayStrip,
  Chip,
  CommitBar,
  DateInput,
  GroupRow,
  HeadChip,
  HeadChips,
  NoticeBar,
  NumInput,
  Pick,
  Row,
  ScreenFrame,
  TFoot,
  THead,
  Table,
  Tag,
  TextInput,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { isSingleCell, parsePasteGrid, pasteFootprint } from '@/lib/entry-paste'
import { isFinishRowId } from '@/lib/finish-stages'
import { parsePasteNumber } from '@/lib/po-paste'
import type { EntrySheet } from '@/modules/dept/production/worklist.service'

/**
 * M4 — GHI SẢN LƯỢNG, dựng theo KHUÔN F (bảng nhập liệu) của `/design-lab`.
 *
 * Một phiếu = 1 lệnh × 1 công đoạn × 1 tổ × 1 ngày (0172). Thân phiếu gom theo
 * SP; dòng bỏ trống không vào phiếu. Đơn vị đếm đổi theo công đoạn: phôi gõ
 * CHI TIẾT, từ hàn gõ MỘT SỐ theo BỘ (cụm), sau sơn gõ BỘ THÀNH PHẨM.
 *
 * NĂM LUẬT CỦA KHUÔN F, và chỗ áp vào đây:
 *
 *  1. LƯỚI LÀ NHÂN VẬT CHÍNH → đầu phiếu co thành `HeadChips` một hàng. Bản
 *     cũ dùng ba khối thẻ chồng nhau, ăn mất ~180px tức khoảng 6 hàng lưới.
 *  2. KIỂM TỪNG DÒNG NGAY KHI GÕ → ô vượt phần còn thiếu nhuộm `warn` ngay lúc
 *     rời ô, không đợi bấm Ghi sổ.
 *  3. CÂU CHẶN LƯU PHẢI BẤM ĐƯỢC → `CommitBar.blocked` + `onGoBlocked` nhảy
 *     tới đúng ô hỏng. Lưới cuộn nên chỗ hỏng thường đang nằm ngoài màn.
 *  4. NẠP HÀNG LOẠT LÀ ĐƯỜNG CHÍNH → cột "Còn" bấm được để điền đủ phần thiếu.
 *  5. GHIM HAI ĐẦU → cột tên dòng ghim trái (`pinFirst` + `Cell pin`).
 *
 * VÌ SAO BỎ `type=number`: lăn chuột trên ô số đang focus ĐỔI GIÁ TRỊ trong
 * mọi trình duyệt — người dùng cuộn trang qua bảng và số tự nhảy, không ai
 * thấy. `NumInput` của kit nhả focus khi lăn, và nhận cả dấu phẩy thập phân.
 *
 * ĐÁNH ĐỔI CÓ CHỦ ĐÍCH: `NumInput` chốt giá trị lúc RỜI Ô chứ không mỗi phím
 * gõ. Lưới này có thể lên hàng trăm dòng; nâng state mỗi phím là vẽ lại cả
 * bảng (bẫy hiệu năng đã dính ở bản lưới trước). Đổi lại, vệt cảnh báo "vượt
 * số còn lại" hiện chậm một nhịp — vẫn trước khi ghi sổ, nên không ai ghi
 * nhầm vì nó.
 */

type LineDraft = {
  qty: string
  defect: string
  /** Hỏng nhưng CỨU ĐƯỢC (0206) — sửa xong ghi lần hai vào `qty`. */
  rework: string
  reason: string
  kg: string
  worker: string
  note: string
}

const EMPTY: LineDraft = {
  qty: '',
  defect: '',
  rework: '',
  reason: '',
  kg: '',
  worker: '',
  note: '',
}

/**
 * THỨ TỰ CỘT GÕ ĐƯỢC — trục ngang của bàn phím và của vùng dán.
 *
 * Phải khớp thứ tự cột trong bảng. Ba cột cuối chỉ hiện khi bật "Cột chi
 * tiết"; giữ chúng trong danh sách là CỐ Ý: người dán một vùng 6 cột ra từ sổ
 * Excel vẫn vào đúng chỗ, và phím ← → thì tự nhảy qua ô không có trên màn.
 */
const EDIT_FIELDS: readonly (keyof LineDraft)[] = [
  'qty',
  'defect',
  'rework',
  'reason',
  'kg',
  'worker',
  'note',
]
const EDIT_COLS = EDIT_FIELDS.length

/**
 * CỘT CHI TIẾT — nhớ theo MÁY, không theo người: một máy ở xưởng nhiều người
 * dùng chung, và ai cũng muốn bảng mở ra giống lần trước mình để.
 *
 * Đọc qua `useSyncExternalStore` chứ không phải state + effect. Lý do là BẪY
 * HYDRATION: đọc localStorage trong initializer của `useState` thì server trả
 * false còn client trả true, React báo lệch và trang chớp một nhịp. Kho ngoài
 * có ảnh chụp riêng cho server (`() => false`) nên hết lệch, và không cần gọi
 * setState trong effect — thứ luật hooks của dự án cấm.
 */
const MORE_KEY = 'hg:thongke-cot-chi-tiet'
const moreListeners = new Set<() => void>()

function subscribeMore(cb: () => void) {
  moreListeners.add(cb)
  return () => {
    moreListeners.delete(cb)
  }
}

function readMore() {
  try {
    return localStorage.getItem(MORE_KEY) === '1'
  } catch {
    // Chế độ riêng tư chặn storage — cứ dùng mặc định, đừng làm hỏng màn.
    return false
  }
}

function writeMore(v: boolean) {
  try {
    localStorage.setItem(MORE_KEY, v ? '1' : '0')
  } catch {
    /* không lưu được thì thôi, phiên này vẫn đổi */
  }
  for (const cb of moreListeners) cb()
}

/**
 * BẢN GÕ DỞ — cứu lưới khi người nhập lỡ rời trang (lỗi L4 đo 22/09/2026).
 *
 * Lưới vài chục dòng gõ mất 15–20 phút; trước bản này chỉ cần bấm nhầm một liên
 * kết là mất sạch, không cảnh báo gì.
 *
 * KHÔI PHỤC PHẢI DO NGƯỜI BẤM, không tự đổ lại. Tự đổ số cũ vào lưới là cách
 * chắc chắn để một ngày nào đó ai đó ghi nhầm số của hôm trước mà không biết —
 * sổ sản lượng là căn cứ tính lương, không đánh cược vào phỏng đoán.
 *
 * Kèm luôn NGÀY và TỔ của lúc gõ: khôi phục mà để nguyên ngày/tổ đang chọn thì
 * số rơi vào đúng lưới nhưng sai chỗ ghi.
 *
 * Khoá theo (lệnh × công đoạn) — hai công đoạn khác nhau là hai phiếu khác nhau.
 */
const DRAFT_PREFIX = 'hg:thongke-nhap-do:'
const draftListeners = new Set<() => void>()

type SavedDraft = {
  at: number
  date: string
  team_id: string
  note: string
  meta: Record<string, string>
  lines: Record<string, LineDraft>
}

function draftKey(lsxId: string, stage: string) {
  return `${DRAFT_PREFIX}${lsxId}|${stage}`
}

function subscribeDraft(cb: () => void) {
  draftListeners.add(cb)
  return () => {
    draftListeners.delete(cb)
  }
}

/**
 * Ảnh chụp là CHUỖI THÔ chứ không phải object đã parse: `useSyncExternalStore`
 * so sánh bằng `Object.is`, trả object mới mỗi lượt gọi là vòng lặp vô tận.
 */
function readDraftRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Đóng dấu giờ NGAY TẠI ĐÂY chứ không nhận từ chỗ gọi: `Date.now()` là hàm
 * không thuần, gọi trong thân component thì luật `react-hooks/purity` chặn.
 */
function writeDraftRaw(key: string, value: Omit<SavedDraft, 'at'> | null) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify({ ...value, at: Date.now() }))
    else localStorage.removeItem(key)
  } catch {
    /* chế độ riêng tư chặn storage — phiên này vẫn gõ được, chỉ là không cứu được */
  }
  for (const cb of draftListeners) cb()
}

/** Có ô nào thực sự có chữ không — đừng lưu một bản nháp rỗng rồi mời khôi phục. */
function hasAnyValue(lines: Record<string, LineDraft>): boolean {
  return Object.values(lines).some((d) => Object.values(d).some((v) => v.trim() !== ''))
}

const fmt = (n: number) => n.toLocaleString('vi-VN')
const num = (s: string) => {
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export function EntrySheetForm({
  sheet,
  userTeamId,
  lsxOptions,
}: {
  sheet: EntrySheet
  userTeamId: string | null
  /** Mọi lệnh đang có việc — đổi lệnh ngay trên đầu phiếu, không quay ra ngoài. */
  lsxOptions: { id: string; code: string; open_count: number }[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [date, setDate] = useState(sheet.today)
  // Tổ mặc định: tổ phụ trách công đoạn đang mở → tổ của người nhập → trống.
  const [teamId, setTeamId] = useState(() => {
    const byStage = sheet.teams.find((t) => t.stage_code === sheet.stage)
    if (byStage) return byStage.id
    if (userTeamId && sheet.teams.some((t) => t.id === userTeamId)) return userTeamId
    return ''
  })
  const [docNote, setDocNote] = useState('')
  /** Ô riêng của công đoạn (0207) — áp cho MỌI dòng của phiếu. */
  const [meta, setMeta] = useState<Record<string, string>>({})
  /**
   * Đầu phiếu đã THU chưa — mẫu Dynamic Page của SAP Fiori: cuộn xuống thì
   * khối đầu ẩn đi, còn một dòng dính mang danh tính; cuộn lên thì bung lại.
   *
   * Hai ngưỡng LỆCH NHAU có chủ đích (thu ở 48px, bung ở 8px). Một ngưỡng
   * duy nhất sẽ dao động: thu lại làm vùng cuộn cao thêm ~45px, `scrollTop`
   * tụt xuống dưới ngưỡng, nó bung ra, rồi lại thu — đầu phiếu nhấp nháy khi
   * người dùng dừng đúng mép.
   */
  const [headUp, setHeadUp] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({})
  const [warnings, setWarnings] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const more = useSyncExternalStore(subscribeMore, readMore, () => false)
  const toggleMore = () => writeMore(!more)

  // ── Bản gõ dở ────────────────────────────────────────────────────────────
  const dKey = draftKey(sheet.lsx?.id ?? 'all', sheet.stage)
  const savedRaw = useSyncExternalStore(
    subscribeDraft,
    () => readDraftRaw(dKey),
    () => null,
  )
  const saved = useMemo(() => {
    if (!savedRaw) return null
    try {
      return JSON.parse(savedRaw) as SavedDraft
    } catch {
      return null
    }
  }, [savedRaw])
  const [draftHidden, setDraftHidden] = useState(false)

  /**
   * Lưu ngay trong tay người gõ (sự kiện blur / dán), KHÔNG qua effect — effect
   * chạy sau render nên có cửa sổ mất dữ liệu đúng lúc đang rời trang.
   */
  const persist = (lines: Record<string, LineDraft>) => {
    writeDraftRaw(
      dKey,
      hasAnyValue(lines) ? { date, team_id: teamId, note: docNote, meta, lines } : null,
    )
  }

  const draftOf = (id: string) => drafts[id] ?? EMPTY
  const patch = (id: string, p: Partial<LineDraft>) => {
    const next = { ...drafts, [id]: { ...(drafts[id] ?? EMPTY), ...p } }
    setDrafts(next)
    persist(next)
  }

  // Chấm ● cho dòng hệ đề xuất theo TỔ đang chọn (được giao / ghi 7 ngày qua).
  const suggestedSet = useMemo(
    () =>
      new Set(
        sheet.suggested.filter((s) => s.team_id === teamId).map((s) => s.component_id),
      ),
    [sheet.suggested, teamId],
  )

  const allLines = useMemo(() => sheet.groups.flatMap((g) => g.lines), [sheet.groups])

  /** chi tiết → lệnh chứa nó. Cần vì một lượt ghi tách phiếu theo lệnh. */
  const lsxOfComponent = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of sheet.groups) for (const l of g.lines) m.set(l.component_id, g.lsx_id)
    return m
  }, [sheet.groups])

  /** Lệnh có mặt trong lưới — quyết định có cần vẽ hàng tiêu đề lệnh không. */
  const lsxCount = useMemo(
    () => new Set(sheet.groups.map((g) => g.lsx_id)).size,
    [sheet.groups],
  )

  const typed = useMemo(() => {
    const out: { component_id: string; name: string; d: LineDraft }[] = []
    for (const l of allLines) {
      const d = drafts[l.component_id]
      if (d && (num(d.qty) > 0 || num(d.defect) > 0 || num(d.rework) > 0)) {
        out.push({ component_id: l.component_id, name: l.name, d })
      }
    }
    return out
  }, [drafts, allLines])

  /**
   * Nhãn danh mục → mã. Bỏ 'khac' ra khỏi gợi ý: mã đó tồn tại để mở đường
   * cho ô chữ, mà ở đây ô chữ vốn luôn mở — chọn "Nguyên nhân khác" rồi không
   * nói gì thêm thì đúng bằng không nói gì.
   */
  const pickableCodes = useMemo(
    () => sheet.defect_codes.filter((c) => c.code !== 'khac'),
    [sheet.defect_codes],
  )
  const codeByLabel = useMemo(
    () => new Map(pickableCodes.map((c) => [c.label.toLowerCase(), c.code])),
    [pickableCodes],
  )

  const typedQty = typed.reduce((a, t) => a + num(t.d.qty), 0)
  const typedDefect = typed.reduce((a, t) => a + num(t.d.defect), 0)
  const typedRework = typed.reduce((a, t) => a + num(t.d.rework), 0)

  /** Dòng có phần không đạt mà chưa nói vì sao — chặn lưu, và phải chỉ tới nó. */
  const missingReason = typed.find(
    (t) => (num(t.d.defect) > 0 || num(t.d.rework) > 0) && !t.d.reason.trim(),
  )

  /**
   * SỔ NGÀY ĐÃ CHỐT — phải biết TRƯỚC khi gõ, không phải lúc bấm Ghi.
   *
   * Đo 22/09/2026: màn không có tín hiệu nào, thống kê gõ xong cả lưới mới ăn
   * lỗi từ service. Trái đúng luật của dự án ("hành động bị chặn phải nói vướng
   * gì và cách gỡ, ngay tại chỗ"). `entriesService.record` vẫn là hàng rào cuối.
   */
  const lockedTeamIds = useMemo(
    () => new Set(sheet.locks.filter((l) => l.entry_date === date).map((l) => l.team_id)),
    [sheet.locks, date],
  )
  const lockedNow = teamId ? lockedTeamIds.has(teamId) : false
  const lockedBy =
    sheet.locks.find((l) => l.entry_date === date && l.team_id === teamId)
      ?.locked_by_name ?? null

  /**
   * Ngày TƯƠNG LAI không ghi được (`entries.service` chặn). Đo 22/09/2026: màn
   * cho chọn thoải mái rồi còn gọi nhầm là "ghi lùi ngày" — người nhập gõ xong
   * cả lưới mới biết. Ô lịch nay có `max`, và đây là vế chặn cho đường gõ tay.
   */
  const dateFuture = date > sheet.today

  const blocked = !sheet.can_record
    ? 'lệnh chưa được duyệt hoặc đã kết thúc — màn chỉ để xem'
    : dateFuture
      ? `ngày ${date.split('-').reverse().join('/')} chưa tới — sổ chỉ ghi được cho hôm nay hoặc ngày đã qua`
      : !teamId
        ? 'chưa chọn tổ — sổ ngày khoá theo tổ nên bản ghi phải có chủ'
        : lockedNow
          ? `sổ ngày ${date.split('-').reverse().join('/')} của tổ này đã chốt — mở khoá ở Sổ ngày rồi ghi tiếp`
          : typed.length === 0
            ? 'chưa gõ số nào — điền SL đạt, phế hoặc sửa lại vào ít nhất một dòng'
            : missingReason
              ? `"${missingReason.name}" có phế/sửa lại nhưng chưa ghi vì sao`
              : undefined

  const goBlocked = () => {
    // Sổ đã chốt thì chỗ gỡ nằm ở MÀN KHÁC — đưa thẳng tới đó, đừng focus một ô
    // trên màn này vì không ô nào sửa được tình trạng đó.
    if (lockedNow) {
      router.push(`/thongke/ngay?date=${date}`)
      return
    }
    const id = !teamId ? 'sheet-team' : `reason-${missingReason?.component_id ?? ''}`
    const el = document.getElementById(id)
    el?.scrollIntoView({ block: 'center' })
    ;(el as HTMLInputElement | null)?.focus()
  }

  const toPayload = ({ component_id, d }: (typeof typed)[number]) => ({
    component_id,
    qty: num(d.qty),
    kg: d.kg.trim() ? num(d.kg) : null,
    defect_qty: num(d.defect),
    rework_qty: num(d.rework),
    // Ô lý do là MỘT ô gõ-hoặc-chọn. Gõ trúng nhãn của danh mục → lưu MÃ (gộp
    // Pareto được); gõ tự do → lưu chữ. Không ép chọn: danh mục từng bị bỏ
    // 07/2026 vì vướng, và không hệ ERP lớn nào bắt buộc khai lý do ngay lần
    // ghi đầu.
    ...(() => {
      const r = d.reason.trim()
      const code = codeByLabel.get(r.toLowerCase()) ?? null
      return { defect_code: code, defect_reason: code ? null : r || null }
    })(),
    stage_meta: Object.keys(meta).length ? meta : null,
    worker_name: d.worker.trim() || null,
    note: d.note.trim() || null,
  })

  /**
   * GHI SỔ — một lượt gõ có thể trải NHIỀU LỆNH, và mỗi lệnh ra MỘT PHIẾU.
   *
   * Quy ước chứng từ không đổi: một phiếu PBS vẫn là 1 lệnh × 1 công đoạn ×
   * 1 tổ × 1 ngày (0172). Chỉ có màn nhập là bỏ ranh giới lệnh, vì tổ làm mấy
   * lệnh một ngày là chuyện của xưởng chứ không phải của sổ sách.
   *
   * GỌI TUẦN TỰ, không `Promise.all`: số hiệu phiếu lấy qua `nextDocNo()`, hai
   * lượt chạy song song có thể giành cùng một số.
   */
  async function save(submit: boolean) {
    if (busy || blocked) return
    setBusy(true)
    try {
      const byLsx = new Map<string, typeof typed>()
      for (const t of typed) {
        const id = lsxOfComponent.get(t.component_id)
        if (!id) continue
        byLsx.set(id, [...(byLsx.get(id) ?? []), t])
      }

      const docNos: string[] = []
      const allWarnings: string[] = []
      for (const [lsxId, rows] of byLsx) {
        const res = await api<{ warnings: string[]; doc_no: string }>(
          `/api/dept/production/lsx/${lsxId}/entries`,
          {
            method: 'POST',
            body: {
              stage: sheet.stage,
              entry_date: date,
              team_department_id: teamId || null,
              submit,
              note: docNote.trim() || null,
              entries: rows.map(toPayload),
            },
          },
        )
        docNos.push(res.doc_no)
        allWarnings.push(...res.warnings)
      }

      setWarnings(allWarnings)
      setDrafts({})
      setDocNote('')
      // Ghi được rồi thì bản gõ dở hết việc — để lại là lần sau mời khôi phục
      // đúng những số vừa vào sổ, tức mời ghi đúp.
      writeDraftRaw(dKey, null)
      setDraftHidden(true)
      const what = submit ? 'ghi chính thức' : 'lưu nháp'
      toast.success(
        docNos.length === 1
          ? `Phiếu ${docNos[0]} đã ${what}`
          : `Đã ${what} ${docNos.length} phiếu: ${docNos.join(' · ')}`,
        allWarnings.length ? `${allWarnings.length} cảnh báo — xem trên bảng` : undefined,
      )
      router.refresh()
    } catch (e) {
      // Lượt trải nhiều lệnh mà hỏng giữa chừng: phiếu đã ghi vẫn còn, phần
      // sau chưa ghi. Nói rõ để người dùng không gõ lại từ đầu rồi ghi đúp.
      toast.error('Không lưu được phiếu', apiErrorText(e))
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const qtyOrder = useMemo(() => allLines.map((l) => l.component_id), [allLines])

  /**
   * ĐI KHẮP LƯỚI BẰNG BÀN PHÍM — chép nếp Excel, cũng là nếp journal entry của
   * Dynamics và list sửa-tại-chỗ của Odoo.
   *
   *   Enter / ↓      xuống cùng cột      Shift+Enter / ↑   lên cùng cột
   *   ← →            sang cột kế         (chỉ khi con trỏ đã chạm mép chữ)
   *   Ctrl+Enter     ghi sổ
   *
   * VÌ SAO ← → PHẢI ĐỢI CON TRỎ CHẠM MÉP: ô "Lý do phế" là chữ, và người đang
   * sửa giữa chữ mà bấm ← thì họ muốn đi trong chữ, không muốn nhảy ô. Đây là
   * đúng luật Excel áp cho ô đang ở chế độ sửa.
   *
   * Tìm ô đích bằng `data-cell` đọc TỪ DOM chứ không bằng bảng toạ độ dựng
   * sẵn: ô "Lý do phế" chỉ hiện khi dòng có phế, và ba cột chi tiết bật/tắt
   * được — bảng dựng sẵn sẽ lệch ngay lần đầu người dùng bấm "Cột chi tiết".
   */
  const focusCell = (row: number, col: number) => {
    const el = document.querySelector<HTMLInputElement>(
      `[data-cell="${row}:${col}"]:not([disabled])`,
    )
    if (el) {
      el.focus()
      el.select?.()
      return true
    }
    return false
  }

  /** Ô kế theo hướng, NHẢY QUA ô không tồn tại (lý do phế của dòng không phế). */
  const step = (row: number, col: number, dr: number, dc: number) => {
    for (let i = 1; i <= (dr !== 0 ? qtyOrder.length : EDIT_COLS); i++) {
      if (focusCell(row + dr * i, col + dc * i)) return
    }
  }

  const onCellKey =
    (row: number, col: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.ctrlKey || e.metaKey) return // Ctrl+Enter là ghi sổ, đừng cướp
      const el = e.currentTarget
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault()
        step(row, col, e.key === 'Enter' && e.shiftKey ? -1 : 1, 0)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        step(row, col, -1, 0)
      } else if (e.key === 'ArrowLeft' && el.selectionStart === 0) {
        e.preventDefault()
        step(row, col, 0, -1)
      } else if (e.key === 'ArrowRight' && el.selectionEnd === el.value.length) {
        e.preventDefault()
        step(row, col, 0, 1)
      }
    }

  /**
   * DÁN VÙNG Ô TỪ EXCEL (luật 4 của Khuôn F).
   *
   * Dán vào ô đang đứng, chảy sang phải và xuống dưới — y như Excel. Một ô thì
   * để trình duyệt dán như thường (đừng chen vào thao tác tầm thường nhất).
   *
   * Phần TRÀN ra ngoài lưới bị bỏ, và phải NÓI RA: dán nhầm cột 40 dòng vào
   * dòng thứ 38 thì 2 dòng cuối rơi mất, im lặng là mất số mà không ai biết.
   */
  const onCellPaste =
    (row: number, col: number) => (e: React.ClipboardEvent<HTMLInputElement>) => {
      const grid = parsePasteGrid(e.clipboardData.getData('text/plain'))
      if (grid.length === 0 || isSingleCell(grid)) return
      e.preventDefault()
      const size = { rows: qtyOrder.length, cols: EDIT_COLS }
      const { fills, dropped } = pasteFootprint(grid, { row, col }, size)
      // Dựng state kế tiếp NGOÀI updater rồi mới `setDrafts` + lưu: vùng dán
      // không phụ thuộc giá trị trước đó, và có lưu ra localStorage ở đây nên
      // không được đặt trong updater (StrictMode gọi updater hai lần).
      const next = { ...drafts }
      for (let r = 0; r < grid.length; r++) {
        const id = qtyOrder[row + r]
        if (!id) continue
        const cur = { ...(next[id] ?? EMPTY) }
        for (let c = 0; c < grid[r].length; c++) {
          const field = EDIT_FIELDS[col + c]
          if (!field) continue
          const raw = grid[r][c]
          // Cột số đi qua luật số VN/Excel dùng chung ("1.390" = 1390);
          // cột chữ giữ nguyên văn.
          cur[field] =
            field === 'reason' || field === 'worker' || field === 'note'
              ? raw
              : raw === ''
                ? ''
                : (parsePasteNumber(raw)?.toString() ?? '')
        }
        next[id] = cur
      }
      setDrafts(next)
      persist(next)
      toast.success(
        `Đã dán ${fills} ô`,
        dropped > 0
          ? `${dropped} ô rơi ngoài lưới nên bị bỏ — kiểm lại dòng cuối`
          : undefined,
      )
    }

  // BẰNG ĐÚNG số <th> — dòng tiêu đề nhóm trải hết bề ngang. Trước 24/09 biến này
  // là 7/10 trong khi bảng có 8/11 cột: dòng nhóm hụt một ô ở mép phải.
  const cols = more ? 12 : 9
  const teamName = sheet.teams.find((t) => t.id === teamId)?.name ?? null
  /** Ghi LÙI ngày: hợp lệ, chỉ cần nhắc. Khác hẳn ngày chưa tới (`dateFuture`). */
  const datePast = date < sheet.today

  return (
    // `dense`: màn này gõ hàng trăm dòng mỗi ngày nên số hàng nhìn thấy cùng
    // lúc là thứ quý nhất. Hàng 39px → ~30px, thấy thêm khoảng 3 hàng mỗi màn.
    // `tableMin` KHAI THEO SỐ CỘT THẬT — mặc định 680px của `Table` chỉ vừa
    // bảng 4–5 cột. Lưới này 8 cột, bật "Cột chi tiết" thành 11. Thiếu khai thì
    // bảng KHÔNG cuộn ngang mà bị BÓP: ô nhập co lại, tên chi tiết cắt cụt.
    // Đổi theo `more` chứ không đóng cứng số lớn, kẻo lúc gấp cột lại thì bảng
    // cuộn ngang vô cớ.
    <ScreenFrame dense tableMin={more ? 1430 : 1070}>
      <div
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            void save(true)
          }
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/*
          ĐẦU PHIẾU THU GỌN — dòng dính mang DANH TÍNH phiếu.

          Fiori đặt yêu cầu này rõ: khi header co lại, phần dính phải đủ để
          người dùng biết mình đang ở đâu mà không phải cuộn ngược lên kiểm.
          Với màn này danh tính là bốn thứ: lệnh (hoặc "mọi lệnh") · công đoạn
          · tổ · ngày — cộng thông số công đoạn nếu đã khai, vì gõ nhầm màu
          sơn cho cả phiếu là lỗi không ai phát hiện tới lúc in.
        */}
        {headUp && (
          // Dòng này PHẢI mỏng hơn hẳn dải chip nó thay, nếu không thu lại
          // chẳng lợi gì (đo lần đầu: 630 → 632px, đúng 2px). Không dùng `Btn`
          // ở đây — nút cao 28px kéo cả dòng lên 43px, xấp xỉ dải chip 45px.
          <div className="text-k-sm flex h-[22px] shrink-0 items-center gap-x-2.5 overflow-hidden border-b border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] whitespace-nowrap">
            <b>{sheet.lsx?.code ?? 'Mọi lệnh'}</b>
            <span className="text-[var(--ink-3)]">·</span>
            <span>{sheet.stage_label}</span>
            <span className="text-[var(--ink-3)]">·</span>
            <span>{teamName ?? 'chưa chọn tổ'}</span>
            <span className="text-[var(--ink-3)]">·</span>
            <span className="num">{date.split('-').reverse().join('/')}</span>
            {Object.entries(meta)
              .filter(([, v]) => v.trim())
              .map(([k, v]) => (
                <span key={k} className="text-[var(--ink-2)]">
                  · {v}
                </span>
              ))}
            <button
              type="button"
              onClick={() => setHeadUp(false)}
              className="ml-auto text-[var(--act)] hover:underline"
            >
              Sửa đầu phiếu
            </button>
          </div>
        )}

        {/* ĐẦU PHIẾU — một hàng chip, không phải ba khối thẻ (luật 1) */}
        {!headUp && (
          <HeadChips>
            {/*
            MỘT LỆNH MỘT LƯỢT (22/09). Bỏ lựa chọn "Mọi lệnh đang chạy": gộp
            nhiều lệnh vào một lưới đo ra 208 dòng / 8 lệnh ở công đoạn Phôi —
            chủ dự án chê rối, và đúng là không đối chiếu nổi với sổ giấy.

            Nhưng KHÔNG quay lại màn "Bước 1 chọn lệnh" (bản đó bị chê 21/09):
            đổi lệnh là một lượt bấm ngay tại đây, lưới đổi tại chỗ.
          */}
            <Pick
              label="Lệnh"
              value={sheet.lsx?.id ?? ''}
              onChange={(v) => {
                if (!v) return
                // Nhớ cho lần sau. Cookie chứ không localStorage — server đọc
                // được nên lượt vào sau render thẳng đúng lệnh, không nháy.
                document.cookie = `sx_ghi_lsx=${v}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`
                router.push(`/thongke/ghi?lsx=${v}&stage=${sheet.stage}`)
              }}
              width={230}
              options={lsxOptions.map((o) => ({
                value: o.id,
                label: `${o.code}${o.open_count > 0 ? ` · còn ${o.open_count} việc` : ' · đủ số'}`,
              }))}
            />
            {/* `max` chặn đường bấm lịch; ô chữ vẫn gõ được nên còn hàng rào
                `blocked` bên dưới và hàng rào cuối ở service. */}
            <DateInput label="Ngày" value={date} onChange={setDate} max={sheet.today} />
            <Pick
              label="Tổ"
              value={teamId}
              onChange={setTeamId}
              width={165}
              options={[
                { value: '', label: '— chọn tổ —' },
                // Tổ đã chốt sổ NGÀY ĐANG CHỌN mang dấu khoá ngay trong danh
                // sách — thấy trước khi chọn, không phải sau khi gõ xong lưới.
                ...sheet.teams.map((t) => ({
                  value: t.id,
                  label: lockedTeamIds.has(t.id) ? `🔒 ${t.name}` : t.name,
                })),
              ]}
            />
            {/*
            Ô RIÊNG CỦA CÔNG ĐOẠN (0207) — Máy ở Phôi, Loại máy hàn ở Hàn,
            Màu + Loại sơn ở Sơn… khai ở `production_stage_fields`, không phải
            cột trong mã.

            Đặt ở ĐẦU PHIẾU chứ không thành cột lưới, vì một phiếu vốn là MỘT
            công đoạn × MỘT tổ × MỘT ngày — cả lượt cùng một máy, một màu. Sổ
            Excel của thống kê cũng làm vậy ("mặc định cả lượt"). Thành cột thì
            lưới rộng thêm để lặp đúng một giá trị xuống vài chục dòng.
          */}
            {sheet.stage_fields.map((f) =>
              f.kind === 'select' ? (
                <Pick
                  key={f.field_key}
                  label={f.label}
                  value={meta[f.field_key] ?? ''}
                  onChange={(v) => setMeta((m) => ({ ...m, [f.field_key]: v }))}
                  width={150}
                  options={[
                    // Nhãn nằm TRONG option rỗng: `Pick` của kit chỉ đặt
                    // aria-label, không vẽ nhãn ra màn — ô chưa chọn mà để "—"
                    // thì không ai biết nó hỏi gì.
                    { value: '', label: `— ${f.label} —` },
                    ...(f.options ?? []).map((o) => ({ value: o, label: o })),
                  ]}
                />
              ) : (
                <TextInput
                  key={f.field_key}
                  label={f.label}
                  value={meta[f.field_key] ?? ''}
                  onCommit={(v) => setMeta((m) => ({ ...m, [f.field_key]: v }))}
                  disabled={!sheet.can_record}
                  // Nhãn làm placeholder, cùng lý do như trên: `TextInput` chỉ
                  // đặt aria-label. Ô rỗng không chú thích là ô câm — người nhập
                  // thấy hai ô trắng cạnh nhau mà không biết ô nào là màu, ô nào
                  // là loại sơn.
                  placeholder={f.required ? `${f.label} (bắt buộc)` : f.label}
                  // `TextInput` không có prop `width` như `Pick`, và mặc định nó
                  // giãn hết dòng — hai ô meta sẽ chiếm hai hàng của dải đầu
                  // phiếu, đúng thứ khuôn F cấm (mỗi hàng đầu trang là một hàng
                  // lưới bị lấy mất).
                  style={{ width: 150 }}
                />
              ),
            )}
          </HeadChips>
        )}

        {/* DẢI CÔNG ĐOẠN — như dãy tab sheet của sổ Excel thống kê đang dùng */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-2">
          {sheet.stages.map((s) => (
            <Chip
              key={s.code}
              on={s.code === sheet.stage}
              onClick={() =>
                router.push(
                  sheet.lsx
                    ? `/thongke/ghi?lsx=${sheet.lsx.id}&stage=${s.code}`
                    : `/thongke/ghi?stage=${s.code}`,
                )
              }
            >
              {s.label}
            </Chip>
          ))}
        </div>

        {/*
          BẢN GÕ DỞ. Chỉ mời khi lưới ĐANG TRỐNG — đang gõ dở mà hiện lên thì
          vừa che chỗ vừa mời đè lên chính việc đang làm.
        */}
        {saved && !draftHidden && typed.length === 0 && (
          <NoticeBar
            tag="Bản gõ dở"
            action={{
              label: 'Khôi phục',
              onClick: () => {
                setDrafts(saved.lines)
                setDate(saved.date)
                setTeamId(saved.team_id)
                setDocNote(saved.note)
                setMeta(saved.meta ?? {})
                setDraftHidden(true)
                toast.success(
                  'Đã khôi phục bản gõ dở',
                  'Kiểm lại ngày và tổ trước khi ghi sổ',
                )
              },
            }}
          >
            {`Lần trước bạn gõ dở ${fmt(Object.keys(saved.lines).length)} dòng ở đây, ${new Date(
              saved.at,
            ).toLocaleDateString('vi-VN', {
              day: '2-digit',
              month: '2-digit',
            })} lúc ${new Date(saved.at).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}, mà chưa ghi sổ. Khôi phục sẽ đặt lại cả ngày và tổ của lúc đó.`}
          </NoticeBar>
        )}

        {/*
          SỔ ĐÃ CHỐT — nói ngay, và chỉ thẳng chỗ gỡ. Đặt TRƯỚC thanh ghi lùi
          ngày vì nó nặng hơn: ghi lùi ngày vẫn lưu được, sổ chốt thì không.
        */}
        {lockedNow && (
          <NoticeBar
            tone="stop"
            tag="Sổ đã chốt"
            action={{
              label: 'Mở khoá ở Sổ ngày',
              onClick: () => router.push(`/thongke/ngay?date=${date}`),
            }}
          >
            {`Sổ ngày ${date.split('-').reverse().join('/')} của tổ này đã chốt${
              lockedBy ? ` — ${lockedBy} chốt` : ''
            }. Gõ thêm sẽ không lưu được. Mở khoá rồi ghi tiếp, hoặc đổi sang tổ/ngày khác.`}
          </NoticeBar>
        )}

        {/*
          NGÀY CHƯA TỚI — chặn hẳn, không phải nhắc. Trước 22/09 màn gộp chung
          với ghi lùi ngày và gọi cả hai là "Ghi lùi ngày", nên chọn nhầm ngày
          mai thì vừa không ai cản vừa bị mô tả sai.
        */}
        {dateFuture && (
          <NoticeBar
            tone="stop"
            tag="Ngày chưa tới"
            action={{ label: 'Về hôm nay', onClick: () => setDate(sheet.today) }}
          >
            {`Ngày ${date.split('-').reverse().join('/')} chưa tới nên không ghi sổ được — xưởng chưa làm thì chưa có số để báo.`}
          </NoticeBar>
        )}

        {datePast && (
          <NoticeBar tone="warn" tag="Ghi lùi ngày">
            Phiếu này sẽ mang ngày {date.split('-').reverse().join('/')}, không phải hôm
            nay. Sổ cộng dồn — ngày đó đã ghi rồi thì gõ thêm là cộng vào, không thay thế.
          </NoticeBar>
        )}

        {/*
          Vượt trần hiển thị: NÓI RA và chỉ đường, không im lặng cắt. Chép cách
          D365 xử lý khi lưới quá tải ("hãy lọc hẹp lại") thay vì phân trang —
          phân trang ở màn nhập liệu làm người gõ mất dấu mình đang ở đâu.
        */}
        {sheet.truncated > 0 && (
          <NoticeBar tag="Chưa bày hết">
            {`Còn ${fmt(sheet.truncated)} dòng nữa của lệnh này chưa hiện — lưới bày tối đa 200 dòng một lượt. Ghi xong phần đang thấy rồi tải lại để gõ tiếp.`}
          </NoticeBar>
        )}

        {warnings.length > 0 && (
          <NoticeBar
            tone="warn"
            tag="Đã ghi, nhưng đọc cái này"
            action={{ label: 'Đã xem', onClick: () => setWarnings([]) }}
          >
            {warnings.join(' · ')}
          </NoticeBar>
        )}

        <Table
          onScroll={(e) => {
            const y = e.currentTarget.scrollTop
            // Hai ngưỡng lệch nhau — xem chú thích ở `headUp`.
            setHeadUp((up) => (up ? y > 8 : y > 48))
          }}
        >
          <THead pinFirst>
            <th>Dòng ghi</th>
            <th style={{ textAlign: 'right' }}>Cần</th>
            <th style={{ textAlign: 'right' }}>Đã đạt</th>
            <th style={{ textAlign: 'right' }}>Còn</th>
            {/* Nhịp 14 ngày — CHỈ ĐỌC (T4). Đọc trước khi gõ: hôm qua tổ làm bao nhiêu. */}
            <th>14 ngày</th>
            <th style={{ textAlign: 'right' }}>SL đạt</th>
            <th style={{ textAlign: 'right' }}>Phế</th>
            <th style={{ textAlign: 'right' }}>Sửa lại</th>
            <th>Lý do</th>
            {more && <th style={{ textAlign: 'right' }}>kg</th>}
            {more && <th>Người làm</th>}
            {more && <th>Ghi chú dòng</th>}
          </THead>
          <tbody>
            {sheet.groups.map((g, gi) => (
              <Fragment key={g.order_line_id}>
                {/*
                  HÀNG TIÊU ĐỀ LỆNH — chỉ vẽ khi lưới trải NHIỀU lệnh, và chỉ ở
                  dòng SP đầu tiên của mỗi lệnh. Lọc hẹp về một lệnh thì thừa:
                  mã lệnh đã nằm trên ô lọc ở đầu phiếu.
                */}
                {lsxCount > 1 && sheet.groups[gi - 1]?.lsx_id !== g.lsx_id && (
                  <GroupRow
                    name={`Lệnh ${g.lsx_code}`}
                    meta={g.customer_name}
                    cols={cols}
                  />
                )}
                <GroupRow
                  name={`${g.product_code} · ${g.product_name}`}
                  meta={`${fmt(g.qty)} ${g.unit}`}
                  cols={cols}
                />
                {g.lines.map((l) => {
                  const d = draftOf(l.component_id)
                  // Chỉ số hàng PHẲNG xuyên mọi nhóm SP — trục dọc của bàn
                  // phím và của vùng dán. Đánh theo nhóm thì dán một cột 40
                  // dòng sẽ dừng ở cuối nhóm đầu tiên.
                  const rIdx = qtyOrder.indexOf(l.component_id)
                  const qty = num(d.qty)
                  const defect = num(d.defect)
                  const rework = num(d.rework)
                  // Vượt phần còn thiếu = cảnh báo MỀM: sổ cho ghi dư (làm bù,
                  // gộp đợt), chỉ nhuộm để người gõ nhìn lại.
                  const over = l.remaining > 0 && qty + defect > l.remaining
                  // Dòng đếm theo CẢ SẢN PHẨM (cụm mặc nhiên, dòng thành
                  // phẩm) chứ không theo chi tiết. Nhận diện bằng `kind`, KHÔNG
                  // bằng đơn vị: sau 19/09 gần như mọi dòng mang đơn vị "cái",
                  // nên so với chuỗi "bộ" là bỏ sót hết.
                  const isSet = l.kind === 'assembly'
                  const kgHint =
                    l.dm_kg != null && qty > 0
                      ? String(Math.round(l.dm_kg * qty * 100) / 100)
                      : ''
                  return (
                    <Row key={l.component_id}>
                      <Cell pin grow title={l.name}>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {suggestedSet.has(l.component_id) && (
                            <span
                              className="text-[var(--act)]"
                              title="Hệ đề xuất: tổ đang cầm hàng được giao / đã ghi gần đây"
                            >
                              ●
                            </span>
                          )}
                          {l.cluster && (
                            <span className="text-[var(--ink-3)]">{l.cluster} ·</span>
                          )}
                          <b>{l.name}</b>
                          {isSet && l.unit && (
                            <Tag tone="neutral">{l.unit.toUpperCase()}</Tag>
                          )}
                        </span>
                        <span className="text-k-sm mt-0.5 block text-[var(--ink-3)]">
                          {l.is_virtual &&
                            (isFinishRowId(l.component_id)
                              ? `Đếm theo ${l.unit ?? 'cái'} hoàn chỉnh — gõ số đã qua bước này · `
                              : 'BOM phẳng — hệ gộp chi tiết thành 1 cụm/SP · ')}
                          {l.pending > 0 && `chờ duyệt +${fmt(l.pending)} · `}
                          {l.today_qty > 0 && `hôm nay đã ghi ${fmt(l.today_qty)} · `}
                          {l.unit && !isSet && `ĐVT ${l.unit}`}
                        </span>
                      </Cell>
                      <Cell num>{fmt(l.needed)}</Cell>
                      <Cell num muted={l.done === 0}>
                        {fmt(l.done)}
                      </Cell>
                      <Cell num>
                        {l.remaining <= 0 ? (
                          <span className="text-[var(--done)]">đủ</span>
                        ) : (
                          // Luật 4: nạp nhanh là đường chính. Bấm là điền đủ
                          // phần thiếu — thao tác lặp nhiều nhất của cả màn.
                          <Btn
                            onClick={() =>
                              patch(l.component_id, { qty: String(l.remaining) })
                            }
                            disabled={!sheet.can_record}
                            title={`Điền ${fmt(l.remaining)} còn lại cho ${l.name}`}
                          >
                            {fmt(l.remaining)}
                          </Btn>
                        )}
                      </Cell>
                      <Cell>
                        {/*
                          THANG RIÊNG TỪNG DÒNG (không `max` chung): dòng này là
                          chân ×4, dòng kia là tựa ×1 — so chiều cao cột giữa hai
                          dòng là so hai đơn vị khác nhau. Dải ở đây để đọc NHỊP
                          của chính dòng đó; số thật nằm trong ô rê chuột và bảng
                          ẩn cho trình đọc màn hình.
                        */}
                        {l.days.length > 0 ? (
                          <DayStrip
                            days={l.days.map((d) => ({
                              date: d.date,
                              value: d.qty,
                              note: d.docs > 0 ? `${d.docs} phiếu` : undefined,
                            }))}
                            today={sheet.today}
                            label={`${l.name} · 14 ngày`}
                          />
                        ) : (
                          <span
                            className="text-k-label text-[var(--ink-3)]"
                            title="Dòng do hệ suy ra, chưa có sổ riêng — chưa có nhịp để bày"
                          >
                            —
                          </span>
                        )}
                      </Cell>
                      <Cell num>
                        <NumInput
                          id={`qty-${l.component_id}`}
                          value={d.qty}
                          onCommit={(v) => patch(l.component_id, { qty: v })}
                          data-cell={`${rIdx}:0`}
                          onKeyDown={onCellKey(rIdx, 0)}
                          onPaste={onCellPaste(rIdx, 0)}
                          disabled={!sheet.can_record}
                          autoFocus={sheet.can_record && qtyOrder[0] === l.component_id}
                          placeholder={l.remaining > 0 ? fmt(l.remaining) : ''}
                          aria-label={`SL đạt ${l.name}`}
                          style={
                            over
                              ? {
                                  borderColor: 'var(--warn)',
                                  background: 'var(--warn-bg)',
                                }
                              : undefined
                          }
                          title={
                            over
                              ? `Vượt phần còn thiếu (${fmt(l.remaining)}) — vẫn ghi được, kiểm lại cho chắc`
                              : undefined
                          }
                        />
                      </Cell>
                      <Cell num>
                        <NumInput
                          value={d.defect}
                          onCommit={(v) => patch(l.component_id, { defect: v })}
                          disabled={!sheet.can_record}
                          aria-label={`Phế ${l.name}`}
                          data-cell={`${rIdx}:1`}
                          onKeyDown={onCellKey(rIdx, 1)}
                          onPaste={onCellPaste(rIdx, 1)}
                        />
                      </Cell>
                      <Cell num>
                        <NumInput
                          value={d.rework}
                          onCommit={(v) => patch(l.component_id, { rework: v })}
                          disabled={!sheet.can_record}
                          aria-label={`Sửa lại ${l.name}`}
                          title="Hỏng nhưng cứu được — sửa xong ghi lại vào SL đạt"
                          data-cell={`${rIdx}:2`}
                          onKeyDown={onCellKey(rIdx, 2)}
                          onPaste={onCellPaste(rIdx, 2)}
                        />
                      </Cell>
                      <Cell>
                        {(defect > 0 || rework > 0) && (
                          <TextInput
                            id={`reason-${l.component_id}`}
                            value={d.reason}
                            onCommit={(v) => patch(l.component_id, { reason: v })}
                            disabled={!sheet.can_record}
                            placeholder="vì sao?"
                            list="defect-reasons"
                            label={`Lý do ${l.name}`}
                            data-cell={`${rIdx}:3`}
                            onKeyDown={onCellKey(rIdx, 3)}
                            onPaste={onCellPaste(rIdx, 3)}
                          />
                        )}
                      </Cell>
                      {more && (
                        <Cell num>
                          <NumInput
                            value={d.kg}
                            onCommit={(v) => patch(l.component_id, { kg: v })}
                            disabled={!sheet.can_record}
                            placeholder={kgHint}
                            aria-label={`kg ${l.name}`}
                            data-cell={`${rIdx}:4`}
                            onKeyDown={onCellKey(rIdx, 4)}
                            onPaste={onCellPaste(rIdx, 4)}
                            title={
                              kgHint
                                ? `Bỏ trống = tự tính ${kgHint} kg (ĐM × SL)`
                                : undefined
                            }
                          />
                        </Cell>
                      )}
                      {more && (
                        <Cell>
                          <TextInput
                            value={d.worker}
                            onCommit={(v) => patch(l.component_id, { worker: v })}
                            disabled={!sheet.can_record}
                            label={`Người làm ${l.name}`}
                            data-cell={`${rIdx}:5`}
                            onKeyDown={onCellKey(rIdx, 5)}
                            onPaste={onCellPaste(rIdx, 5)}
                          />
                        </Cell>
                      )}
                      {more && (
                        <Cell>
                          <TextInput
                            value={d.note}
                            onCommit={(v) => patch(l.component_id, { note: v })}
                            disabled={!sheet.can_record}
                            label={`Ghi chú ${l.name}`}
                            data-cell={`${rIdx}:6`}
                            onKeyDown={onCellKey(rIdx, 6)}
                            onPaste={onCellPaste(rIdx, 6)}
                          />
                        </Cell>
                      )}
                    </Row>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
          <TFoot
            /*
              Chú thích đi CÙNG Ô NHÃN, không dùng prop `caveat` của kit.
              `caveat` render thành một <td> ở CUỐI hàng, mà cột cuối của bảng
              này ("Lý do") chỉ rộng ~52px — câu dài nhét vào đó bị bóp thành
              một ký tự mỗi dòng, cao 213px, ăn hết chiều cao bảng. Ô nhãn nằm
              ở cột "Dòng ghi" vốn là cột rộng nhất nên chứa vừa.
            */
            label={
              <td>
                Sắp ghi {typed.length} dòng
                <span className="text-k-sm ml-1.5 font-normal text-[var(--ink-3)]">
                  · chỉ cộng dòng đang gõ, chưa gồm số đã ghi trước đó
                </span>
              </td>
            }
            cells={
              <>
                <td colSpan={4} />
                <td className="num" style={{ textAlign: 'right' }}>
                  {fmt(typedQty)}
                </td>
                <td className="num" style={{ textAlign: 'right' }}>
                  {fmt(typedDefect)}
                </td>
                <td className="num" style={{ textAlign: 'right' }}>
                  {fmt(typedRework)}
                </td>
                {/*
                  ĐẾM CỘT CHO KHỚP với `THead`, kẻo chân bảng tràn:
                  nhãn(1) + 4 + 1 + 1 + 1 + ô cuối = 9 khi gấp cột chi tiết,
                  = 12 khi bật (thêm kg · Người làm · Ghi chú). Cột "14 ngày"
                  (B6) nằm trong khối 4 ô trống đầu.

                  Sai chỗ này KHÔNG ném lỗi nào — trình duyệt lặng lẽ bóp cột
                  cuối lại, và chữ trong đó xếp DỌC một ký tự mỗi dòng, cao
                  213px, ăn hết chiều cao bảng (đo 21/09/2026).
                */}
                <td colSpan={more ? 4 : 1} />
              </>
            }
          />
        </Table>

        {/* Đứng NGOÀI khung cuộn: gõ tới dòng 40 mà phải cuộn về đáy mới ghi
            chú được là thao tác thừa lặp cả ngày. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[var(--surface)] px-[var(--gutter)] py-2">
          <TextInput
            value={docNote}
            onCommit={setDocNote}
            disabled={!sheet.can_record}
            placeholder="ghi chú chung cả phiếu (không bắt buộc)"
            label="Ghi chú phiếu"
            // Không để giãn hết dòng, kẻo nút "Cột chi tiết" bị đẩy xuống hàng
            // thứ hai và ăn thêm một hàng lưới.
            style={{ width: 360 }}
          />
          <Btn onClick={toggleMore}>{more ? 'Ẩn cột chi tiết' : 'Cột chi tiết'}</Btn>
        </div>

        {/*
          Gợi ý lý do = DANH MỤC của công đoạn đang mở, rồi mới tới lý do vừa
          gõ gần đây. Gõ trúng nhãn danh mục thì lúc lưu hoá thành MÃ (gộp
          Pareto được); gõ tự do vẫn ghi được. Danh mục đứng trước vì nó là
          thứ ta muốn người dùng chọn, và nó đã lọc theo công đoạn nên ngắn.
        */}
        <datalist id="defect-reasons">
          {pickableCodes.map((c) => (
            <option key={c.code} value={c.label} />
          ))}
          {sheet.recent_defect_reasons
            .filter((r) => !codeByLabel.has(r.toLowerCase()))
            .map((r) => (
              <option key={r} value={r} />
            ))}
        </datalist>
      </div>

      <CommitBar
        totals={[
          { label: 'Σ đạt', value: fmt(typedQty) },
          { label: 'Σ phế', value: fmt(typedDefect) },
          { label: 'Σ sửa lại', value: fmt(typedRework) },
        ]}
        grand={{
          label: 'Phiếu',
          value: `${typed.length} dòng · ${teamName ?? 'chưa có tổ'}`,
        }}
        blocked={blocked}
        onGoBlocked={goBlocked}
        actions={
          <>
            <Btn icon="luuNhap" onClick={() => save(false)} disabled={busy || !!blocked}>
              Lưu nháp
            </Btn>
            {/* User chốt 27/08: không cần tổ trưởng xác nhận — gửi là chính thức. */}
            <Btn
              icon="ghiSo"
              primary
              onClick={() => save(true)}
              disabled={busy}
              blockedBy={blocked}
            >
              Ghi sổ chính thức
            </Btn>
          </>
        }
      />
    </ScreenFrame>
  )
}
