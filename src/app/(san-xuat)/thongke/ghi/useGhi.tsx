'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { isSingleCell, parsePasteGrid, pasteFootprint } from '@/lib/entry-paste'
import { parsePasteNumber } from '@/lib/po-paste'
import {
  crewProblem,
  laborHours,
  linesKg,
  parseCrew,
  productivity,
  type CrewInput,
} from '@/lib/gio-cong'
import { dongBo, maMacDinh, TAT_CA_MA, xepTheoCum, type DongBo } from '@/lib/ghi-nhom'
import { khoaCum } from '@/lib/khoa-cum'
import { chiaDot, chiaText } from '@/lib/ghi-gom-dot'
import {
  buildEditCols,
  cellId,
  dmy,
  draftKg,
  draftKey,
  FIELD_PREFIX,
  hasAnyValue,
  isTyped,
  num,
  readDraftRaw,
  readMore,
  readSp,
  rowProblems,
  subscribeDraft,
  subscribeMore,
  subscribeSp,
  writeDraftRaw,
  writeMore,
  writeSp,
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
  // GIỜ CÔNG đầu phiếu (0296): một lần cho cả phiếu, không phải mỗi dòng.
  const [crew, setCrewState] = useState<CrewInput>(CREW_EMPTY)
  const [drafts, setDrafts] = useState<Drafts>({})
  const [warnings, setWarnings] = useState<string[]>([])
  const [loi, setLoi] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** Đã bấm Ghi sổ chính thức ít nhất một lần — câu đỏ chỉ hiện từ lúc đó (Q5). */
  const [daBam, setDaBam] = useState(false)
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
  const persist = (lines: Drafts, c: CrewInput = crew) =>
    writeDraftRaw(
      dKey,
      hasAnyValue(lines)
        ? { date, team_id: teamId, note: docNote, crew: c, lines }
        : null,
    )
  const setCrew = (k: keyof CrewInput, v: string) => {
    const next = { ...crew, [k]: v }
    setCrewState(next)
    persist(drafts, next)
    setLoi(null)
  }

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
    setCrewState(saved.crew ?? CREW_EMPTY)
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
  // Gợi ý trả theo component THẬT; dòng đã gom đợt sáng khi bất kỳ đợt nào được gợi ý.
  const suggestedSet = useMemo(() => {
    const real = new Set(
      sheet.suggested.filter((s) => s.team_id === teamId).map((s) => s.component_id),
    )
    const out = new Set<string>()
    for (const g of sheet.groups)
      for (const l of g.lines)
        if (l.parts.some((p) => real.has(p.component_id))) out.add(l.component_id)
    return out
  }, [sheet.suggested, sheet.groups, teamId])
  // Mã hàng → cụm → chi tiết (bản vẽ 11/11): xếp chi tiết theo cụm để mỗi cụm
  // một đầu nhóm, không rải rác.
  const allRows = useMemo(
    () => sheet.groups.flatMap((g) => xepTheoCum(g.lines).map((l) => ({ g, l }))),
    [sheet.groups],
  )

  // ── Chọn MÃ HÀNG (Q11–Q13 bản vẽ 12/11) ────────────────────────────────
  // Nhớ theo máy × lệnh; mã lạ / chưa nhớ → mã đầu còn việc (lib/ghi-nhom).
  const spKey = sheet.lsx?.id ?? 'all'
  const spNho = useSyncExternalStore(
    subscribeSp,
    () => readSp(spKey),
    () => null,
  )
  const spChon = maMacDinh(sheet.groups, spNho)
  const chonSp = (code: string) => writeSp(spKey, code)
  /** Thanh chọn mã chỉ có nghĩa khi lệnh có ≥ 2 mã hàng ở công đoạn này. */
  const nhieuMa = sheet.groups.length > 1
  const motMa = nhieuMa && spChon !== TAT_CA_MA
  const nhomChon = motMa
    ? (sheet.groups.find((g) => g.product_code === spChon) ?? null)
    : null
  /** Bộ đồng bộ ở công đoạn đang ghi — theo mã hàng và theo từng cụm (MỌI dòng, không theo lọc). */
  const nhom = useMemo(() => {
    const sp = new Map<string, DongBo>()
    const cum = new Map<string, { sets: number | null; n: number }>()
    for (const g of sheet.groups) {
      const ls = g.lines.map((l) => ({
        name: l.name,
        cluster: l.cluster,
        needed: l.needed,
        done: l.done,
      }))
      sp.set(g.order_line_id, dongBo(ls, g.qty))
      // Khoá cụm không phân biệt hoa thường (Q20) — "cụm tựa" là "Cụm tựa".
      for (const c of new Set(ls.map((l) => khoaCum(l.cluster)))) {
        if (!c) continue
        const of = ls.filter((l) => khoaCum(l.cluster) === c)
        cum.set(`${g.order_line_id}|${c}`, { sets: dongBo(of, g.qty).sets, n: of.length })
      }
    }
    return { sp, cum }
  }, [sheet.groups])
  /** Dòng đang BÀY: theo mã đang chọn; lọc "dòng gợi ý" khi bật (dòng đã gõ luôn giữ). */
  const rows = useMemo(() => {
    const cuaMa = motMa ? allRows.filter(({ g }) => g.product_code === spChon) : allRows
    return chiGoiY
      ? cuaMa.filter(
          ({ l }) => suggestedSet.has(l.component_id) || isTyped(drafts[l.component_id]),
        )
      : cuaMa
  }, [allRows, motMa, spChon, chiGoiY, suggestedSet, drafts])
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
          dm_kg: l.dm_kg,
          parts: l.parts,
          d: drafts[l.component_id],
        })),
    [drafts, allRows],
  )
  const typedQty = typed.reduce((a, t) => a + num(t.d.qty), 0)
  const typedDefect = typed.reduce((a, t) => a + num(t.d.defect), 0)
  const typedRework = typed.reduce((a, t) => a + num(t.d.rework), 0)
  // Kg + năng suất của phiếu — cùng hàm với báo cáo (lib/gio-cong).
  const typedKg = linesKg(
    typed.map((t) => ({ qty: num(t.d.qty), kg: draftKg(t.d), dm_kg: t.dm_kg })),
  )
  const crewParsed = useMemo(() => parseCrew(crew), [crew])
  const crewBad = crewProblem(crewParsed)
  const gioCong = laborHours(crewParsed)
  const nangSuat = productivity(typedKg.kg, gioCong)

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
            ? 'chưa gõ số nào — điền số đạt hoặc lỗi vào ít nhất một dòng'
            : firstProblem
              ? `"${firstProblem.name}" ${firstProblem.msg}`
              : null

  /**
   * Hai mức chặn (Q1 bản vẽ 11/11): giờ công TRỐNG chỉ chặn Ghi sổ chính thức —
   * lưu nháp vẫn được; giờ công gõ SAI thì chặn cả hai (server cũng đá).
   */
  const blockedNhap =
    blocked ?? (crewBad && !crewBad.missing ? `giờ công: ${crewBad.msg}` : null)
  const blockedGhi = blockedNhap ?? (crewBad ? crewBad.msg : null)

  // Cột trống CẢ CỘT thì ẩn (Q3): Khả dụng ở công đoạn đầu (mọi dòng null), 14
  // ngày khi chưa ai ghi trong 14 ngày. Có số thì cột tự hiện lại.
  const cotKhaDung = allRows.some(({ l }) => l.available != null)
  const cot14 = allRows.some(({ l }) => l.days.some((x) => x.qty > 0))
  // Nhóm cột ĐỊNH MỨC (Q10): ẩn cột nào cả cột trống ở mã đang bày (SL / SP luôn có).
  const cotQuyCach = rows.some(({ l }) => l.spec != null)
  const cotKgCt = rows.some(({ l }) => l.dm_kg != null)
  /** Chỉ tiêu hôm nay của tổ đang chọn (0168 — giao theo tổ × công đoạn × ngày). */
  const chiTieu =
    date === sheet.today
      ? (sheet.targets.find((t) => t.team_id === teamId)?.qty ?? null)
      : null
  /** Nhãn "đợt 1: 108 · đợt 2: 12" cho dòng gom đang gõ — rỗng khi một đợt. */
  const chiaCua = (l: (typeof allRows)[number]['l']): string => {
    if (l.parts.length < 2) return ''
    const d = drafts[l.component_id]
    if (!d || num(d.qty) <= 0) return ''
    return chiaText(chiaDot(l.parts, { qty: num(d.qty), defect: 0, rework: 0, kg: null }))
  }

  /** Nhãn của liên kết gỡ chặn + việc nó làm (theo mức chặn của nút Ghi sổ). */
  const goBlocked = (): { label: string; run: () => void } | null => {
    if (!blockedGhi || !sheet.can_record || dateFuture) return null
    if (!blocked && crewBad)
      return { label: 'Ghi giờ công', run: () => focusEl(`crew-${crewBad.field}`) }
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
  /**
   * Một dòng gõ → MỘT HAY NHIỀU dòng sổ: dòng đã gom đợt chia số đạt cho đợt
   * xuất sớm trước (lib/ghi-gom-dot, Q1). Lý do, ô riêng, người làm, ghi chú đi
   * theo mọi phần; phế / sửa lại vào đợt đầu nhận số.
   */
  const toPayload = ({ parts, d }: (typeof typed)[number]) => {
    const r = (d.reason ?? '').trim()
    const code = codeByLabel.get(r.toLowerCase()) ?? null
    const meta: Record<string, string> = {}
    for (const c of cols) {
      if (!c.key.startsWith(FIELD_PREFIX)) continue
      const v = (d[c.key] ?? '').trim()
      if (v) meta[c.key.slice(FIELD_PREFIX.length)] = v
    }
    const chia = chiaDot(parts, {
      qty: num(d.qty),
      defect: num(d.defect),
      rework: num(d.rework),
      kg: (d.kg ?? '').trim() ? num(d.kg) : null,
    })
    return chia.map((x) => {
      const bad = x.defect > 0 || x.rework > 0
      return {
        component_id: x.component_id,
        qty: x.qty,
        kg: x.kg,
        defect_qty: x.defect,
        rework_qty: x.rework,
        defect_code: bad ? code : null,
        defect_reason: bad ? (code ? null : r || null) : null,
        stage_meta: Object.keys(meta).length ? meta : null,
        worker_name: (d.worker ?? '').trim() || null,
        note: (d.note ?? '').trim() || null,
      }
    })
  }

  /** Một lượt gõ có thể trải nhiều lệnh → mỗi lệnh một phiếu. Gọi TUẦN TỰ (số phiếu). */
  const save = async (submit: boolean) => {
    if (submit) setDaBam(true)
    if (busy || (submit ? blockedGhi : blockedNhap)) return
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
              shift: crewParsed.shift,
              worker_count: crewParsed.worker_count,
              hours_per_worker: crewParsed.hours_per_worker,
              entries: rowsOf.flatMap(toPayload),
            },
          },
        )
        docNos.push(res.doc_no)
        all.push(...res.warnings)
      }
      setWarnings(all)
      setDaBam(false)
      setDrafts({})
      setDocNote('')
      // Xoá số người + giờ sau mỗi phiếu (giữ ca): phiếu kế — lệnh khác cùng ca —
      // phải tự ghi phần giờ của nó, không mang nguyên ca sang (lỗi chép lặp).
      setCrewState((c) => ({ ...CREW_EMPTY, shift: c.shift }))
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
    crew,
    setCrew,
    gioCong,
    crewBad,
    /** Ô giờ công nào tô đỏ: gõ sai thì luôn, còn trống thì chỉ khi đã có dòng gõ. */
    crewRed: (field: 'workers' | 'hours' | 'shift') =>
      crewBad?.field === field && (!crewBad.missing || typed.length > 0),
    nangSuat,
    typedKg,
    nhom,
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
    blockedNhap,
    blockedGhi,
    daBam,
    setDaBam,
    goBlocked,
    cotKhaDung,
    cot14,
    cotQuyCach,
    cotKgCt,
    spChon,
    chonSp,
    nhieuMa,
    motMa,
    nhomChon,
    chiTieu,
    chiaCua,
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

const CREW_EMPTY: CrewInput = { shift: '1', workers: '', hours: '' }

function focusEl(id: string) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ block: 'center' })
  ;(el as HTMLElement | null)?.focus()
}
