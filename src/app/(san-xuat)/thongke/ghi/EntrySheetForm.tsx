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
  reason: string
  kg: string
  worker: string
  note: string
}

const EMPTY: LineDraft = { qty: '', defect: '', reason: '', kg: '', worker: '', note: '' }

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

  const typed = useMemo(() => {
    const out: { component_id: string; name: string; d: LineDraft }[] = []
    for (const l of allLines) {
      const d = drafts[l.component_id]
      if (d && (num(d.qty) > 0 || num(d.defect) > 0)) {
        out.push({ component_id: l.component_id, name: l.name, d })
      }
    }
    return out
  }, [drafts, allLines])

  const typedQty = typed.reduce((a, t) => a + num(t.d.qty), 0)
  const typedDefect = typed.reduce((a, t) => a + num(t.d.defect), 0)

  /** Dòng ghi phế mà chưa nói vì sao — chặn lưu, và phải chỉ được tới nó. */
  const missingReason = typed.find((t) => num(t.d.defect) > 0 && !t.d.reason.trim())

  const blocked = !sheet.can_record
    ? 'lệnh chưa được duyệt hoặc đã kết thúc — màn chỉ để xem'
    : !teamId
      ? 'chưa chọn tổ — sổ ngày khoá theo tổ nên bản ghi phải có chủ'
      : typed.length === 0
        ? 'chưa gõ số nào — điền SL đạt hoặc phế vào ít nhất một dòng'
        : missingReason
          ? `"${missingReason.name}" ghi phế nhưng chưa ghi vì sao`
          : undefined

  const goBlocked = () => {
    const id = !teamId ? 'sheet-team' : `reason-${missingReason?.component_id ?? ''}`
    const el = document.getElementById(id)
    el?.scrollIntoView({ block: 'center' })
    ;(el as HTMLInputElement | null)?.focus()
  }

  async function save(submit: boolean) {
    if (busy || blocked) return
    setBusy(true)
    try {
      const res = await api<{ warnings: string[]; doc_no: string }>(
        `/api/dept/production/lsx/${sheet.lsx.id}/entries`,
        {
          method: 'POST',
          body: {
            stage: sheet.stage,
            entry_date: date,
            team_department_id: teamId || null,
            submit,
            note: docNote.trim() || null,
            entries: typed.map(({ component_id, d }) => ({
              component_id,
              qty: num(d.qty),
              kg: d.kg.trim() ? num(d.kg) : null,
              defect_qty: num(d.defect),
              defect_reason: d.reason.trim() || null,
              worker_name: d.worker.trim() || null,
              note: d.note.trim() || null,
            })),
          },
        },
      )
      setWarnings(res.warnings)
      setDrafts({})
      setDocNote('')
      toast.success(
        submit
          ? `Phiếu ${res.doc_no} đã ghi chính thức`
          : `Phiếu ${res.doc_no} đã lưu nháp`,
        res.warnings.length
          ? `${res.warnings.length} cảnh báo — xem trên bảng`
          : undefined,
      )
      router.refresh()
    } catch (e) {
      toast.error('Không lưu được phiếu', apiErrorText(e))
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
    <ScreenFrame>
      <div
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            void save(true)
          }
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* ĐẦU PHIẾU — một hàng chip, không phải ba khối thẻ (luật 1) */}
        <HeadChips>
          <Pick
            label="Lệnh"
            value={sheet.lsx.id}
            onChange={(v) => router.push(`/thongke/ghi?lsx=${v}`)}
            width={230}
            options={lsxOptions.map((o) => ({
              value: o.id,
              label: `${o.code}${o.open_count > 0 ? ` · còn ${o.open_count} việc` : ' · đủ số'}`,
            }))}
          />
          <HeadChip label="Khách" value={sheet.lsx.customer_name} muted />
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
          <span className="ml-auto">
            {blocked ? (
              <Tag tone="warn">chưa ghi được</Tag>
            ) : (
              <Tag tone="done">{typed.length} dòng sắp ghi</Tag>
            )}
          </span>
        </HeadChips>

        {/* DẢI CÔNG ĐOẠN — như dãy tab sheet của sổ Excel thống kê đang dùng */}
        <div className="flex flex-wrap items-center gap-[6px] border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[9px]">
          {sheet.stages.map((s) => (
            <Chip
              key={s.code}
              on={s.code === sheet.stage}
              onClick={() =>
                router.push(`/thongke/ghi?lsx=${sheet.lsx.id}&stage=${s.code}`)
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

        {warnings.length > 0 && (
          <NoticeBar
            tone="warn"
            tag="Đã ghi, nhưng đọc cái này"
            action={{ label: 'Đã xem', onClick: () => setWarnings([]) }}
          >
            {warnings.join(' · ')}
          </NoticeBar>
        )}

        <Table>
          <THead pinFirst>
            <th>Dòng ghi</th>
            <th style={{ textAlign: 'right' }}>Cần</th>
            <th style={{ textAlign: 'right' }}>Đã đạt</th>
            <th style={{ textAlign: 'right' }}>Còn</th>
            <th style={{ textAlign: 'right' }}>SL đạt</th>
            <th style={{ textAlign: 'right' }}>Phế</th>
            <th>Lý do phế</th>
            {more && <th style={{ textAlign: 'right' }}>kg</th>}
            {more && <th>Người làm</th>}
            {more && <th>Ghi chú dòng</th>}
          </THead>
          <tbody>
            {sheet.groups.map((g) => (
              <Fragment key={g.order_line_id}>
                <GroupRow
                  name={`${g.product_code} · ${g.product_name}`}
                  meta={`${fmt(g.qty)} bộ`}
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
                  // Vượt phần còn thiếu = cảnh báo MỀM: sổ cho ghi dư (làm bù,
                  // gộp đợt), chỉ nhuộm để người gõ nhìn lại.
                  const over = l.remaining > 0 && qty + defect > l.remaining
                  const isSet = l.unit === 'bộ' || l.kind === 'assembly'
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
                          {isSet && <Tag tone="neutral">BỘ</Tag>}
                        </span>
                        <span className="mt-[2px] block text-[var(--fs-sm)] text-[var(--ink-3)]">
                          {l.is_virtual &&
                            (isFinishRowId(l.component_id)
                              ? 'Đếm theo bộ hoàn chỉnh — gõ số bộ đã qua bước này · '
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
                      <Cell>
                        {defect > 0 && (
                          <TextInput
                            id={`reason-${l.component_id}`}
                            value={d.reason}
                            onCommit={(v) => patch(l.component_id, { reason: v })}
                            disabled={!sheet.can_record}
                            placeholder="vì sao phế?"
                            list="defect-reasons"
                            label={`Lý do phế ${l.name}`}
                            data-cell={`${rIdx}:2`}
                            onKeyDown={onCellKey(rIdx, 2)}
                            onPaste={onCellPaste(rIdx, 2)}
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
                            data-cell={`${rIdx}:3`}
                            onKeyDown={onCellKey(rIdx, 3)}
                            onPaste={onCellPaste(rIdx, 3)}
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
                            data-cell={`${rIdx}:4`}
                            onKeyDown={onCellKey(rIdx, 4)}
                            onPaste={onCellPaste(rIdx, 4)}
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
                            data-cell={`${rIdx}:5`}
                            onKeyDown={onCellKey(rIdx, 5)}
                            onPaste={onCellPaste(rIdx, 5)}
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
            label={<td>Sắp ghi {typed.length} dòng</td>}
            cells={
              <>
                <td colSpan={3} />
                <td className="num" style={{ textAlign: 'right' }}>
                  {fmt(typedQty)}
                </td>
                <td className="num" style={{ textAlign: 'right' }}>
                  {fmt(typedDefect)}
                </td>
                <td colSpan={more ? 4 : 1} />
              </>
            }
            caveat="Tổng chỉ cộng dòng ĐANG GÕ trên phiếu này — không gồm số đã ghi trước đó."
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
          />
          <Btn onClick={toggleMore}>{more ? 'Ẩn cột chi tiết' : 'Cột chi tiết'}</Btn>
        </div>

        <datalist id="defect-reasons">
          {sheet.recent_defect_reasons.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>

      <CommitBar
        totals={[
          { label: 'Σ đạt', value: fmt(typedQty) },
          { label: 'Σ phế', value: fmt(typedDefect) },
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
