import type { PlanView } from '@/modules/dept/production/plan.service'
import type { UnitTally } from '@/lib/line-stage-tally'

/**
 * GIAO TỔ & HẠN — phần THUẦN của màn (bản vẽ 10/11/2026,
 * https://claude.ai/artifact/3m3pok6LKJ96dyZncUAqYV, duyệt Q1–Q7): nháp lưới
 * dòng SP × công đoạn, hàng "Cả lệnh" áp xuống, câu chặn, payload cho hai API
 * cũ (lsxPlanSchema · linePlanSchema). Không `'use client'` để test dùng chung.
 */

export type Line = PlanView['lines'][number]
export type Stage = PlanView['stages'][number]
export type Team = PlanView['teams'][number]

/** Một ô nháp. `team` '' = để server tự gán theo công đoạn (chỉ khi công đoạn có đúng 1 tổ). */
export type CellDraft = { on: boolean; team: string; start: string; end: string }
export type Draft = {
  /** Hàng "Cả lệnh": công đoạn → ô. Áp xuống dòng CHƯA có kế hoạch (hoặc mọi dòng khi ghi đè). */
  all: Record<string, CellDraft>
  /** Sửa riêng từng dòng: lineId → công đoạn → ô. Thắng hàng Cả lệnh. */
  lines: Record<string, Record<string, CellDraft>>
}

export type CellKey = { line: string | null; stage: string } // line null = hàng Cả lệnh

export const fmt = (n: number) => n.toLocaleString('vi-VN')
export const cx = (...xs: (string | false | null | undefined | 0)[]) =>
  xs.filter(Boolean).join(' ')
/** "12/11→25/11" · "→25/11" · "12/11→" · "" */
export function spanText(start: string, end: string): string {
  const dm = (iso: string) => iso.slice(5, 10).split('-').reverse().join('/')
  if (!start && !end) return ''
  return `${start ? dm(start) : ''}→${end ? dm(end) : ''}`
}
export const dmyFull = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

const EMPTY: CellDraft = { on: false, team: '', start: '', end: '' }

/** Nháp ban đầu = kế hoạch đang có (jobs) — hàng Cả lệnh trống. */
export function initialDraft(view: PlanView): Draft {
  const lines: Draft['lines'] = {}
  for (const l of view.lines) {
    const m: Record<string, CellDraft> = {}
    for (const j of l.jobs) {
      m[j.stage] = {
        on: true,
        team: j.team_department_id ?? '',
        start: j.planned_start?.slice(0, 10) ?? '',
        end: j.planned_end?.slice(0, 10) ?? '',
      }
    }
    lines[l.order_line_id] = m
  }
  return { all: {}, lines }
}

/** Tổ phụ trách công đoạn theo departments.stage_code (Q4: > 1 tổ → không tự chọn). */
export function teamsForStage(teams: Team[], stage: string): Team[] {
  return teams.filter((t) => t.stage_code === stage)
}
export function defaultTeam(teams: Team[], stage: string): string {
  const c = teamsForStage(teams, stage)
  return c.length === 1 ? c[0].id : ''
}

/**
 * Cột của lưới theo THỨ TỰ DANH MỤC: công đoạn có ở "cần" của dòng nào đó, có
 * việc đang lên, hoặc đang được tick trong nháp (kể cả thêm cột tay).
 */
export function columnsOf(view: PlanView, draft: Draft, extra: string[] = []): Stage[] {
  const has = new Set<string>(extra)
  for (const l of view.lines) {
    for (const s of Object.keys(l.needs)) has.add(s)
    for (const j of l.jobs) has.add(j.stage)
    for (const [s, c] of Object.entries(draft.lines[l.order_line_id] ?? {}))
      if (c.on) has.add(s)
  }
  for (const [s, c] of Object.entries(draft.all)) if (c.on) has.add(s)
  return view.stages.filter((s) => has.has(s.code))
}

export type Effective = {
  cell: CellDraft
  /** 'line' sửa riêng · 'job' đang có trên DB chưa đụng · 'all' nhận từ hàng Cả lệnh (xem trước) · 'none' */
  source: 'line' | 'job' | 'all' | 'none'
}

/** Ô hiệu lực của (dòng × công đoạn) sau khi áp hàng Cả lệnh (Q1). */
export function effectiveCell(
  view: PlanView,
  draft: Draft,
  lineId: string,
  stage: string,
  overwrite: boolean,
): Effective {
  const line = view.lines.find((l) => l.order_line_id === lineId)
  const own = draft.lines[lineId]?.[stage]
  const job = line?.jobs.find((j) => j.stage === stage)
  const ownIsJob =
    own &&
    job &&
    own.on &&
    own.team === (job.team_department_id ?? '') &&
    own.start === (job.planned_start?.slice(0, 10) ?? '') &&
    own.end === (job.planned_end?.slice(0, 10) ?? '')
  const all = draft.all[stage]
  const hasPlan = (line?.jobs.length ?? 0) > 0
  const receivesAll = all?.on && (!hasPlan || overwrite) && (!own || ownIsJob)
  // Dòng không đi qua công đoạn (không có cần, không có việc) thì hàng Cả lệnh
  // không sinh việc — đúng luật lsxPlanSchema.
  const passes = !!line && (stage in line.needs || !!job || !line.default_route)
  if (receivesAll && passes) return { cell: all, source: 'all' }
  if (own) return { cell: own, source: ownIsJob ? 'job' : 'line' }
  return { cell: EMPTY, source: 'none' }
}

/** Việc đã chạy (doing/done) — không bỏ được, đổi tổ/hạn phải có lý do (0169). */
export function lockedJob(line: Line, stage: string) {
  const j = line.jobs.find((x) => x.stage === stage)
  return j && j.status !== 'todo' ? j : null
}

export type LinePayload = {
  order_line_id: string
  stages: {
    stage: string
    team_department_id: string | null
    planned_start: string | null
    planned_end: string | null
  }[]
}
export type DiffOut = {
  /** Hàng Cả lệnh có ô bật → body { scope: 'lsx', stages, overwrite }. */
  lsx: { stages: LinePayload['stages'] } | null
  /** Dòng có ô sửa riêng khác DB → body linePlanSchema (gửi TRỌN dòng, gồm ô nhận từ Cả lệnh). */
  lines: LinePayload[]
  receiving: number
  changedCells: number
  /** Số việc đã chạy bị đổi tổ/hạn hoặc bị dời — cần lý do. */
  activeTouched: number
}

const toStage = (stage: string, c: CellDraft) => ({
  stage,
  team_department_id: c.team || null,
  planned_start: c.start || null,
  planned_end: c.end || null,
})

export function diffDraft(view: PlanView, draft: Draft, overwrite: boolean): DiffOut {
  const order = new Map(view.stages.map((s, i) => [s.code, i]))
  const sortSt = <T extends { stage: string }>(a: T[]) =>
    a.sort((x, y) => (order.get(x.stage) ?? 99) - (order.get(y.stage) ?? 99))
  const allOn = Object.entries(draft.all).filter(([, c]) => c.on)
  const lsx = allOn.length
    ? { stages: sortSt(allOn.map(([s, c]) => toStage(s, c))) }
    : null

  const lines: LinePayload[] = []
  let receiving = 0
  let changedCells = 0
  let activeTouched = 0
  for (const l of view.lines) {
    const ownMap = draft.lines[l.order_line_id] ?? {}
    let lineChanged = false
    let gotAll = false
    for (const s of view.stages) {
      const eff = effectiveCell(view, draft, l.order_line_id, s.code, overwrite)
      const job = l.jobs.find((j) => j.stage === s.code)
      if (eff.source === 'all') gotAll = true
      if (eff.source === 'line') {
        lineChanged = true
        changedCells += 1
        if (job && job.status !== 'todo') activeTouched += 1
      } else if (!eff.cell.on && job && ownMap[s.code] && !ownMap[s.code].on) {
        // bỏ công đoạn đang có
        lineChanged = true
        changedCells += 1
        if (job.status !== 'todo') activeTouched += 1
      }
    }
    if (gotAll) receiving += 1
    if (lineChanged) {
      const st = view.stages
        .map((s) => ({
          s,
          e: effectiveCell(view, draft, l.order_line_id, s.code, overwrite),
        }))
        .filter((x) => x.e.cell.on)
        .map((x) => toStage(x.s.code, x.e.cell))
      lines.push({ order_line_id: l.order_line_id, stages: st })
    }
  }
  if (lsx && overwrite)
    activeTouched += view.lines.reduce(
      (a, l) =>
        a + l.jobs.filter((j) => j.status !== 'todo' && draft.all[j.stage]?.on).length,
      0,
    )
  return { lsx, lines, receiving, changedCells, activeTouched }
}

export type Blocker = { text: string; cell?: CellKey; kind: 'stop' | 'warn' }

/** Câu chặn ở thanh chốt — bấm được, nhảy tới ô. */
export function blockers(
  view: PlanView,
  draft: Draft,
  overwrite: boolean,
  reason: string,
  diff: DiffOut,
): Blocker[] {
  const out: Blocker[] = []
  const label = (s: string) => view.stages.find((x) => x.code === s)?.label ?? s
  const check = (key: CellKey, c: CellDraft, who: string) => {
    if (!c.on) return
    if (c.start && c.end && c.end < c.start)
      out.push({
        kind: 'stop',
        cell: key,
        text: `${who} · ${label(key.stage)}: kết thúc ${dmyFull(c.end)} trước bắt đầu ${dmyFull(c.start)}`,
      })
    if (!c.team && teamsForStage(view.teams, key.stage).length > 1)
      out.push({
        kind: 'stop',
        cell: key,
        text: `${who} · ${label(key.stage)}: ${teamsForStage(view.teams, key.stage).length} tổ cùng công đoạn — chọn một`,
      })
  }
  for (const [s, c] of Object.entries(draft.all))
    check({ line: null, stage: s }, c, 'Cả lệnh')
  for (const l of view.lines)
    for (const [s, c] of Object.entries(draft.lines[l.order_line_id] ?? {}))
      if (effectiveCell(view, draft, l.order_line_id, s, overwrite).source === 'line')
        check({ line: l.order_line_id, stage: s }, c, l.product_code)
  if (!diff.lsx && diff.lines.length === 0)
    out.push({ kind: 'warn', text: 'Chưa đổi gì để lưu' })
  if (diff.activeTouched > 0 && !reason.trim())
    out.push({
      kind: 'stop',
      text: `${fmt(diff.activeTouched)} việc đã chạy bị đổi — ghi lý do điều chỉnh (nhật ký 0169)`,
    })
  return out
}

/** Dòng tổ & hạn của một ô khối trên, theo NHÁP: gộp mọi dòng SP ở công đoạn đó. */
export function stageDraftSummary(
  view: PlanView,
  draft: Draft,
  stage: string,
  overwrite: boolean,
): { text: string; tone: 'draft' | 'warn' | null } {
  const teams = new Set<string>()
  let start: string | null = null
  let end: string | null = null
  let n = 0
  let fromDraft = false
  let missingTeam = false
  for (const l of view.lines) {
    const e = effectiveCell(view, draft, l.order_line_id, stage, overwrite)
    if (!e.cell.on) continue
    n += 1
    if (e.source !== 'job') fromDraft = true
    if (e.cell.team) teams.add(view.teams.find((t) => t.id === e.cell.team)?.name ?? '?')
    else if (teamsForStage(view.teams, stage).length === 1)
      teams.add(teamsForStage(view.teams, stage)[0].name)
    else missingTeam = true
    if (e.cell.start && (!start || e.cell.start < start)) start = e.cell.start
    if (e.cell.end && (!end || e.cell.end > end)) end = e.cell.end
  }
  if (n === 0) return { text: 'chưa giao tổ & hạn', tone: 'warn' }
  const who =
    teams.size === 0
      ? 'chưa có tổ'
      : teams.size === 1
        ? [...teams][0]
        : `${teams.size} tổ`
  const span = spanText(start ?? '', end ?? '')
  const txt = `${who} · ${span || 'chưa hạn'}${missingTeam ? ' · thiếu tổ' : ''}${fromDraft ? ' · nháp' : ''}`
  return { text: txt, tone: fromDraft ? 'draft' : !span || missingTeam ? 'warn' : null }
}

/** "9.000" · "300·900ct" — đơn vị ở tiêu đề cột nên ô chỉ ghi số. */
export function needCellText(us: UnitTally[] | undefined): string {
  if (!us || us.length === 0) return ''
  const full = us.map((u) => fmt(u.needed)).join('·')
  // Ô 97px chứa ~10 ký tự mono 11px; dài hơn thì số chính + "+" (đủ số ở title).
  return full.length > 10 && us.length > 1 ? `${fmt(us[0].needed)} +` : full
}

/** Tiêu đề cột: đơn vị của công đoạn gộp mọi dòng ("cái · ct"). */
export function columnUnit(view: PlanView, stage: string): string {
  const units: string[] = []
  for (const l of view.lines)
    for (const u of l.needs[stage] ?? []) if (!units.includes(u.unit)) units.push(u.unit)
  return units.map((u) => (u === 'chi tiết' ? 'ct' : u)).join(' · ')
}
