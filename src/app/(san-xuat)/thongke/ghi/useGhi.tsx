'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { isSingleCell, parsePasteGrid, pasteFootprint } from '@/lib/entry-paste'
import { parsePasteNumber } from '@/lib/po-paste'
import {
  buildEditCols,
  cellId,
  dmy,
  draftKey,
  FIELD_PREFIX,
  hasAnyValue,
  isTyped,
  num,
  readDraftRaw,
  readMore,
  rowProblems,
  subscribeDraft,
  subscribeMore,
  writeDraftRaw,
  writeMore,
  type Drafts,
  type LineDraft,
  type SavedDraft,
  type Sheet,
} from './ghi.shared'

export type GhiProps = {
  sheet: Sheet
  userTeamId: string | null
  /** Mọi lệnh đang có việc — đổi lệnh ngay trên đầu phiếu. */
  lsxOptions: { id: string; code: string; open_count: number }[]
}

/**
 * Toàn bộ state + xử lý của màn Ghi sản lượng (B3, không kit).
 *
 * ĐÁNH ĐỔI CÓ CHỦ ĐÍCH: ô chốt giá trị lúc RỜI Ô (blur) chứ không mỗi phím —
 * lưới có thể vài trăm dòng × 12 cột, nâng state mỗi phím là vẽ lại cả bảng.
 */
export function useGhi(p: GhiProps) {
  const { sheet } = p
  const router = useRouter()
  const [date, setDate] = useState(sheet.today)
  // Tổ mặc định: tổ phụ trách công đoạn → tổ của người nhập → trống.
  const [teamId, setTeamId] = useState(() => {
    const byStage = sheet.teams.find((t) => t.stage_code === sheet.stage)
    if (byStage) return byStage.id
    if (p.userTeamId && sheet.teams.some((t) => t.id === p.userTeamId))
      return p.userTeamId
    return ''
  })
  const [docNote, setDocNote] = useState('')
  const [drafts, setDrafts] = useState<Drafts>({})
  const [warnings, setWarnings] = useState<string[]>([])
  const [loi, setLoi] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [chiGoiY, setChiGoiY] = useState(false)
  const more = useSyncExternalStore(subscribeMore, readMore, () => false)
  const toggleMore = () => writeMore(!more)

  const cols = useMemo(() => buildEditCols(sheet, more), [sheet, more])
  // Đặt con trỏ vào ô đầu MỘT LẦN lúc mở màn — không dùng `autoFocus` trên ô,
  // vì ô chốt giá trị bằng cách thay `key`, mỗi lần chốt là một lần mount lại
  // và `autoFocus` sẽ giật con trỏ về ô đầu (dính 03/11: Tab không đi đâu được).
  useEffect(() => {
    if (!sheet.can_record) return
    const el = document.querySelector<HTMLInputElement>(
      '[data-cell="0:0"]:not([disabled])',
    )
    el?.focus()
  }, [sheet.can_record])
  const colIdx = useMemo(() => new Map(cols.map((c, i) => [c.key, i])), [cols])

  // ── Bản gõ dở ──────────────────────────────────────────────────────────
  const dKey = draftKey(sheet.lsx?.id ?? 'all', sheet.stage)
  const savedRaw = useSyncExternalStore(
    subscribeDraft,
    () => readDraftRaw(dKey),
    () => null,
  )
  const saved = useMemo(() => {
    if (!savedRaw) return null
    try {
      const s = JSON.parse(savedRaw) as SavedDraft
      return s && s.lines ? s : null
    } catch {
      return null
    }
  }, [savedRaw])
  const [draftHidden, setDraftHidden] = useState(false)
  const persist = (lines: Drafts) =>
    writeDraftRaw(
      dKey,
      hasAnyValue(lines) ? { date, team_id: teamId, note: docNote, lines } : null,
    )

  const draftOf = (id: string): LineDraft => drafts[id] ?? {}
  const patch = (id: string, k: string, v: string) => {
    const next = { ...drafts, [id]: { ...(drafts[id] ?? {}), [k]: v } }
    setDrafts(next)
    persist(next)
    setLoi(null)
  }
  const khoiPhuc = () => {
    if (!saved) return
    setDrafts(saved.lines)
    setDate(saved.date)
    setTeamId(saved.team_id)
    setDocNote(saved.note)
    setDraftHidden(true)
    setThongBao('Đã khôi phục bản gõ dở — kiểm lại ngày và tổ trước khi ghi sổ')
  }
  const boNhap = () => {
    writeDraftRaw(dKey, null)
    setDraftHidden(true)
  }
  const huy = () => {
    setDrafts({})
    setDocNote('')
    writeDraftRaw(dKey, null)
    setLoi(null)
  }

  // ── Dòng ───────────────────────────────────────────────────────────────
  const suggestedSet = useMemo(
    () =>
      new Set(
        sheet.suggested.filter((s) => s.team_id === teamId).map((s) => s.component_id),
      ),
    [sheet.suggested, teamId],
  )
  const allRows = useMemo(
    () => sheet.groups.flatMap((g) => g.lines.map((l) => ({ g, l }))),
    [sheet.groups],
  )
  /** Dòng đang BÀY: lọc "dòng gợi ý" khi bật; dòng đã gõ luôn giữ lại. */
  const rows = useMemo(
    () =>
      chiGoiY
        ? allRows.filter(
            ({ l }) =>
              suggestedSet.has(l.component_id) || isTyped(drafts[l.component_id]),
          )
        : allRows,
    [allRows, chiGoiY, suggestedSet, drafts],
  )
  const order = useMemo(() => rows.map((r) => r.l.component_id), [rows])
  const lsxOfComponent = useMemo(() => {
    const m = new Map<string, string>()
    for (const g of sheet.groups) for (const l of g.lines) m.set(l.component_id, g.lsx_id)
    return m
  }, [sheet.groups])

  const typed = useMemo(
    () =>
      allRows
        .filter(({ l }) => isTyped(drafts[l.component_id]))
        .map(({ l }) => ({
          component_id: l.component_id,
          name: l.name,
          d: drafts[l.component_id],
        })),
    [drafts, allRows],
  )
  const typedQty = typed.reduce((a, t) => a + num(t.d.qty), 0)
  const typedDefect = typed.reduce((a, t) => a + num(t.d.defect), 0)
  const typedRework = typed.reduce((a, t) => a + num(t.d.rework), 0)

  /** Mọi ô còn thiếu trên các dòng ĐÃ GÕ — phần tử đầu là thứ thanh chốt chỉ tới. */
  const problems = useMemo(
    () =>
      typed.flatMap((t) =>
        rowProblems(t.d, cols).map((pb) => ({
          ...pb,
          component_id: t.component_id,
          name: t.name,
        })),
      ),
    [typed, cols],
  )
  const firstProblem = problems[0] ?? null
  const errCells = useMemo(
    () => new Set(problems.map((pb) => cellId(pb.component_id, pb.key))),
    [problems],
  )

  // ── Mã lý do: gõ trúng nhãn danh mục → lưu MÃ ─────────────────────────
  const pickableCodes = useMemo(
    () => sheet.defect_codes.filter((c) => c.code !== 'khac'),
    [sheet.defect_codes],
  )
  const codeByLabel = useMemo(
    () => new Map(pickableCodes.map((c) => [c.label.toLowerCase(), c.code])),
    [pickableCodes],
  )

  // ── Sổ chốt / ngày ─────────────────────────────────────────────────────
  const lockedTeamIds = useMemo(
    () => new Set(sheet.locks.filter((l) => l.entry_date === date).map((l) => l.team_id)),
    [sheet.locks, date],
  )
  const lockedNow = teamId ? lockedTeamIds.has(teamId) : false
  const lockedBy =
    sheet.locks.find((l) => l.entry_date === date && l.team_id === teamId)
      ?.locked_by_name ?? null
  const dateFuture = date > sheet.today
  const datePast = date < sheet.today
  const teamName = sheet.teams.find((t) => t.id === teamId)?.name ?? null

  const blocked = !sheet.can_record
    ? 'lệnh chưa được duyệt hoặc đã kết thúc — màn chỉ để xem'
    : dateFuture
      ? `ngày ${dmy(date)} chưa tới — sổ chỉ ghi cho hôm nay hoặc ngày đã qua`
      : !teamId
        ? 'chưa chọn tổ — sổ ngày khoá theo tổ nên bản ghi phải có chủ'
        : lockedNow
          ? `sổ ngày ${dmy(date)} của tổ này đã chốt`
          : typed.length === 0
            ? 'chưa gõ số nào — điền SL đạt, phế hoặc sửa lại vào ít nhất một dòng'
            : firstProblem
              ? `"${firstProblem.name}" ${firstProblem.msg}`
              : null

  /** Nhãn của liên kết gỡ chặn + việc nó làm. */
  const goBlocked = (): { label: string; run: () => void } | null => {
    if (!blocked || !sheet.can_record || dateFuture) return null
    if (!teamId) return { label: 'Chọn tổ', run: () => focusEl('sheet-team') }
    if (lockedNow)
      return {
        label: 'Mở khoá ở Sổ ngày',
        run: () => router.push(`/thongke/ngay?date=${date}`),
      }
    if (typed.length === 0)
      return {
        label: 'Tới ô đầu',
        run: () => order[0] && focusEl(cellId(order[0], 'qty')),
      }
    if (firstProblem) {
      const c = cols.find((x) => x.key === firstProblem.key)
      return {
        label: `Tới ô ${c?.label ?? firstProblem.key}`,
        run: () => focusEl(cellId(firstProblem.component_id, firstProblem.key)),
      }
    }
    return null
  }

  // ── Ghi sổ ─────────────────────────────────────────────────────────────
  const toPayload = ({ component_id, d }: (typeof typed)[number]) => {
    const r = (d.reason ?? '').trim()
    const code = codeByLabel.get(r.toLowerCase()) ?? null
    const meta: Record<string, string> = {}
    for (const c of cols) {
      if (!c.key.startsWith(FIELD_PREFIX)) continue
      const v = (d[c.key] ?? '').trim()
      if (v) meta[c.key.slice(FIELD_PREFIX.length)] = v
    }
    return {
      component_id,
      qty: num(d.qty),
      kg: (d.kg ?? '').trim() ? num(d.kg) : null,
      defect_qty: num(d.defect),
      rework_qty: num(d.rework),
      defect_code: code,
      defect_reason: code ? null : r || null,
      stage_meta: Object.keys(meta).length ? meta : null,
      worker_name: (d.worker ?? '').trim() || null,
      note: (d.note ?? '').trim() || null,
    }
  }

  /** Một lượt gõ có thể trải nhiều lệnh → mỗi lệnh một phiếu. Gọi TUẦN TỰ (số phiếu). */
  const save = async (submit: boolean) => {
    if (busy || blocked) return
    setBusy(true)
    setLoi(null)
    try {
      const byLsx = new Map<string, typeof typed>()
      for (const t of typed) {
        const id = lsxOfComponent.get(t.component_id)
        if (id) byLsx.set(id, [...(byLsx.get(id) ?? []), t])
      }
      const docNos: string[] = []
      const all: string[] = []
      for (const [lsxId, rowsOf] of byLsx) {
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
              entries: rowsOf.map(toPayload),
            },
          },
        )
        docNos.push(res.doc_no)
        all.push(...res.warnings)
      }
      setWarnings(all)
      setDrafts({})
      setDocNote('')
      writeDraftRaw(dKey, null)
      setDraftHidden(true)
      const what = submit ? 'ghi chính thức' : 'lưu nháp'
      const gio = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
      setThongBao(
        docNos.length === 1
          ? `Phiếu ${docNos[0]} đã ${what} lúc ${gio}`
          : `Đã ${what} ${docNos.length} phiếu lúc ${gio}: ${docNos.join(' · ')}`,
      )
      router.refresh()
    } catch (e) {
      // Trải nhiều lệnh mà hỏng giữa chừng: phiếu đã ghi vẫn còn — nói rõ để
      // người dùng không gõ lại từ đầu rồi ghi đúp.
      setLoi(apiErrorText(e, 'Không lưu được phiếu'))
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  // ── Bàn phím & dán (nếp Excel) ─────────────────────────────────────────
  const focusCell = (row: number, col: number) => {
    const el = document.querySelector<HTMLInputElement>(
      `[data-cell="${row}:${col}"]:not([disabled])`,
    )
    if (!el) return false
    el.focus()
    el.select?.()
    return true
  }
  const step = (row: number, col: number, dr: number, dc: number) => {
    for (let i = 1; i <= (dr !== 0 ? order.length : cols.length); i++) {
      if (focusCell(row + dr * i, col + dc * i)) return
    }
  }
  const onCellKey =
    (row: number, col: number) =>
    (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (e.ctrlKey || e.metaKey) return
      const el = e.currentTarget
      const isInput = el instanceof HTMLInputElement
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault()
        step(row, col, e.key === 'Enter' && e.shiftKey ? -1 : 1, 0)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        step(row, col, -1, 0)
      } else if (e.key === 'ArrowLeft' && (!isInput || el.selectionStart === 0)) {
        e.preventDefault()
        step(row, col, 0, -1)
      } else if (
        e.key === 'ArrowRight' &&
        (!isInput || el.selectionEnd === el.value.length)
      ) {
        e.preventDefault()
        step(row, col, 0, 1)
      }
    }
  /** Dán vùng ô: chảy sang phải / xuống dưới từ ô đang đứng. Phần tràn bị bỏ và NÓI RA. */
  const onCellPaste =
    (row: number, col: number) => (e: React.ClipboardEvent<HTMLInputElement>) => {
      const grid = parsePasteGrid(e.clipboardData.getData('text/plain'))
      if (grid.length === 0 || isSingleCell(grid)) return
      e.preventDefault()
      const { fills, dropped } = pasteFootprint(
        grid,
        { row, col },
        { rows: order.length, cols: cols.length },
      )
      const next = { ...drafts }
      for (let r = 0; r < grid.length; r++) {
        const id = order[row + r]
        if (!id) continue
        const cur = { ...(next[id] ?? {}) }
        for (let c = 0; c < grid[r].length; c++) {
          const colDef = cols[col + c]
          if (!colDef) continue
          const raw = grid[r][c]
          cur[colDef.key] =
            colDef.kind === 'num'
              ? raw === ''
                ? ''
                : (parsePasteNumber(raw)?.toString() ?? '')
              : raw
        }
        next[id] = cur
      }
      setDrafts(next)
      persist(next)
      setThongBao(
        `Đã dán ${fills} ô${dropped > 0 ? ` — ${dropped} ô rơi ngoài lưới nên bị bỏ, kiểm lại dòng cuối` : ''}`,
      )
    }

  const doiLenh = (id: string) => {
    if (!id) return
    document.cookie = `sx_ghi_lsx=${id}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`
    router.push(`/thongke/ghi?lsx=${id}&stage=${sheet.stage}`)
  }
  const doiCongDoan = (code: string) =>
    router.push(
      sheet.lsx
        ? `/thongke/ghi?lsx=${sheet.lsx.id}&stage=${code}`
        : `/thongke/ghi?stage=${code}`,
    )

  return {
    sheet,
    lsxOptions: p.lsxOptions,
    cols,
    colIdx,
    rows,
    order,
    date,
    setDate,
    teamId,
    setTeamId,
    teamName,
    docNote,
    setDocNote,
    drafts,
    draftOf,
    patch,
    typed,
    typedQty,
    typedDefect,
    typedRework,
    errCells,
    suggestedSet,
    chiGoiY,
    setChiGoiY,
    more,
    toggleMore,
    saved,
    draftHidden,
    khoiPhuc,
    boNhap,
    huy,
    lockedTeamIds,
    lockedNow,
    lockedBy,
    dateFuture,
    datePast,
    blocked,
    goBlocked,
    warnings,
    setWarnings,
    loi,
    thongBao,
    setThongBao,
    busy,
    save,
    onCellKey,
    onCellPaste,
    pickableCodes,
    codeByLabel,
    doiLenh,
    doiCongDoan,
  } as const
}

export type GhiCtx = ReturnType<typeof useGhi>

function focusEl(id: string) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ block: 'center' })
  ;(el as HTMLElement | null)?.focus()
}
