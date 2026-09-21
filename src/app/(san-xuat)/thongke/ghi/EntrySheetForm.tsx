'use client'

import { Fragment, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
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
} from '@/components/kit'
import { useToast } from '@/components/ui/Toast'
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

  const draftOf = (id: string) => drafts[id] ?? EMPTY
  const patch = (id: string, p: Partial<LineDraft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? EMPTY), ...p } }))

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

  const blocked = !sheet.can_record
    ? 'lệnh chưa được duyệt hoặc đã kết thúc — màn chỉ để xem'
    : !teamId
      ? 'chưa chọn tổ — sổ ngày khoá theo tổ nên bản ghi phải có chủ'
      : typed.length === 0
        ? 'chưa gõ số nào — điền SL đạt, phế hoặc sửa lại vào ít nhất một dòng'
        : missingReason
          ? `"${missingReason.name}" có phế/sửa lại nhưng chưa ghi vì sao`
          : undefined

  const goBlocked = () => {
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
      setDrafts((d) => {
        const next = { ...d }
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
        return next
      })
      toast.success(
        `Đã dán ${fills} ô`,
        dropped > 0
          ? `${dropped} ô rơi ngoài lưới nên bị bỏ — kiểm lại dòng cuối`
          : undefined,
      )
    }

  const cols = more ? 10 : 7
  const teamName = sheet.teams.find((t) => t.id === teamId)?.name ?? null
  const dateWarn = date !== sheet.today

  return (
    // `dense`: màn này gõ hàng trăm dòng mỗi ngày nên số hàng nhìn thấy cùng
    // lúc là thứ quý nhất. Hàng 39px → ~30px, thấy thêm khoảng 3 hàng mỗi màn.
    <ScreenFrame dense>
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
          <div className="flex h-[22px] shrink-0 items-center gap-x-[10px] overflow-hidden border-b border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] text-[12px] whitespace-nowrap">
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
            {/* eslint-disable-next-line hg/no-raw-control -- `Btn` cao 28px, kéo cả dòng tóm tắt lên 43px và xoá sạch phần chỗ mà việc thu đầu phiếu vừa lấy về; đây là một liên kết chữ, không phải nút hành động */}
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
            LỆNH LÀ BỘ LỌC, KHÔNG PHẢI PHẠM VI BẮT BUỘC (21/09). Mặc định để
            trống = thấy việc của MỌI lệnh đang chạy ở công đoạn này, gom theo
            lệnh trong lưới — vì số lệnh một tổ đụng trong ngày không cố định.
            Ai muốn hẹp về một lệnh vẫn chọn được.
          */}
            <Pick
              label="Lệnh"
              value={sheet.lsx?.id ?? ''}
              onChange={(v) =>
                router.push(
                  v
                    ? `/thongke/ghi?lsx=${v}&stage=${sheet.stage}`
                    : `/thongke/ghi?stage=${sheet.stage}`,
                )
              }
              width={230}
              options={[
                { value: '', label: 'Mọi lệnh đang chạy' },
                ...lsxOptions.map((o) => ({
                  value: o.id,
                  label: `${o.code}${o.open_count > 0 ? ` · còn ${o.open_count} việc` : ' · đủ số'}`,
                })),
              ]}
            />
            <DateInput label="Ngày" value={date} onChange={setDate} />
            <Pick
              label="Tổ"
              value={teamId}
              onChange={setTeamId}
              width={165}
              options={[
                { value: '', label: '— chọn tổ —' },
                ...sheet.teams.map((t) => ({ value: t.id, label: t.name })),
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
        <div className="flex flex-wrap items-center gap-[6px] border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[9px]">
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

        {dateWarn && (
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
            {`Còn ${fmt(sheet.truncated)} dòng nữa chưa hiện. Chọn một lệnh ở ô “Lệnh” để xem đủ và gõ cho chắc.`}
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
                        <span className="flex flex-wrap items-center gap-[6px]">
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
                        <span className="mt-[2px] block text-[var(--fs-sm)] text-[var(--ink-3)]">
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
                <span className="ml-[6px] text-[11.5px] font-normal text-[var(--ink-3)]">
                  · chỉ cộng dòng đang gõ, chưa gồm số đã ghi trước đó
                </span>
              </td>
            }
            cells={
              <>
                <td colSpan={3} />
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
                  nhãn(1) + 3 + 1 + 1 + 1 + ô cuối = 8 khi gấp cột chi tiết,
                  = 11 khi bật (thêm kg · Người làm · Ghi chú).

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
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[var(--surface)] px-[var(--gutter)] py-[9px]">
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
            <Btn onClick={() => save(false)} disabled={busy || !!blocked}>
              Lưu nháp
            </Btn>
            {/* User chốt 27/08: không cần tổ trưởng xác nhận — gửi là chính thức. */}
            <Btn primary onClick={() => save(true)} disabled={busy} blockedBy={blocked}>
              Ghi sổ chính thức
            </Btn>
          </>
        }
      />
    </ScreenFrame>
  )
}
