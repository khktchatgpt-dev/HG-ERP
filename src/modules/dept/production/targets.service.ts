import { targetsRepo, type DailyTarget } from './targets.repo'
import { productionRepo } from './production.repo'
import { entriesRepo } from './entries.repo'
import { jobsService } from './jobs.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest } from '@/server/http'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { resolveStageConfigs, type CountLevel } from '@/lib/stage-config'
import { shiftIso, vnTodayIso } from '@/lib/local-date'

/**
 * CHỈ TIÊU NGÀY (GĐ 2.2 — 0168): Kế hoạch giao chỉ tiêu per tổ × công đoạn
 * cho một ngày. Ô bỏ trống = KHÔNG giao → Vào việc / Tổ hôm nay / Báo cáo dùng
 * số suy từ Giao tổ & hạn; ô = 0 là chỉ tiêu thật ("hôm nay tổ này làm việc
 * khác"). Màn dựng lại 11/11/2026 (bản vẽ
 * https://claude.ai/artifact/Y5UN1RKu11M9aMHW1hdCL1) xem theo TUẦN: một hàng
 * một tổ ở công đoạn của nó — `getWeek`. API ghi vẫn theo NGÀY (`saveDay`).
 */

const UNIT_LABEL: Record<CountLevel, string> = {
  part: 'chi tiết',
  cluster: 'cụm',
  unit: 'bộ',
}

export type ChiTieuRow = {
  team_id: string
  team_name: string
  stage: string
  stage_label: string
  /** Đơn vị đếm của công đoạn (chi tiết · cụm · bộ) — chỉ tiêu ghi theo đơn vị này. */
  unit: string
}

export type ChiTieuCell = {
  team_department_id: string
  stage: string
  date: string
  qty: number
}

export type ChiTieuWeek = {
  week_start: string
  /** 7 ngày T2..CN. */
  days: string[]
  today: string
  rows: ChiTieuRow[]
  /** Chỉ tiêu THẬT đã lưu trong tuần. */
  targets: ChiTieuCell[]
  /** Số SUY từ Giao tổ & hạn, chỉ ngày ≥ hôm nay. */
  derived: ChiTieuCell[]
  /** Đạt (sổ) theo tổ × công đoạn × ngày — bày ở ngày đã qua. */
  done: ChiTieuCell[]
  /** Tổ SX chưa gắn công đoạn — không có hàng. */
  teams_without_stage: string[]
  /** Công đoạn chưa tổ nào gắn — không có hàng. */
  stages_without_team: string[]
  /** Việc đang chạy có hạn — 0 thì số suy trống cả tuần. */
  jobs_with_end: number
}

export const targetsService = {
  /** Lưới của 1 ngày: danh mục tổ SX + công đoạn + các ô đã giao. Đọc: mọi NV. */
  async getDay(
    _user: User,
    date: string,
  ): Promise<{
    date: string
    teams: { id: string; name: string }[]
    stages: { code: string; label: string }[]
    targets: DailyTarget[]
  }> {
    const [depts, stages, targets] = await Promise.all([
      departmentsRepo.list(),
      productionRepo.listStages(),
      targetsRepo.listByDate(date),
    ])
    return {
      date,
      teams: depts
        .filter((d) => d.workspace_id === 'production')
        .map((d) => ({ id: d.id, name: d.name })),
      stages,
      targets,
    }
  },

  /**
   * Lưới MỘT TUẦN (tổ × 7 ngày). Hàng = tổ SX đã gắn công đoạn
   * (`resolveTeamStage`), thứ tự danh mục công đoạn; cặp (tổ × công đoạn) đã
   * có chỉ tiêu hay số suy mà không nằm trong danh sách đó vẫn được thêm hàng
   * — số đã lưu không bao giờ vô hình. Đọc: mọi NV.
   */
  async getWeek(_user: User, weekStart: string): Promise<ChiTieuWeek> {
    const today = vnTodayIso()
    const days = Array.from({ length: 7 }, (_, i) => shiftIso(weekStart, i))
    const end = days[6]
    const [depts, stages, targets, entries, derivedByDay] = await Promise.all([
      departmentsRepo.list(),
      productionRepo.listStages(),
      targetsRepo.listRange(weekStart, end),
      entriesRepo.listRange(weekStart, end),
      jobsService.derivedTargetsByDay(days),
    ])
    const levelOf = new Map(
      resolveStageConfigs(stages).map((c) => [c.code, c.meta.count_level] as const),
    )
    const stageIdx = new Map(stages.map((s, i) => [s.code, i]))
    const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c
    const unitOf = (c: string) => UNIT_LABEL[levelOf.get(c) ?? 'part']

    const teams = depts.filter((d) => d.workspace_id === 'production')
    const nameOf = new Map(teams.map((t) => [t.id, t.name]))
    const rows: ChiTieuRow[] = []
    const seen = new Set<string>()
    const push = (team_id: string, stage: string) => {
      const k = `${team_id}|${stage}`
      if (seen.has(k) || !stageIdx.has(stage)) return
      seen.add(k)
      rows.push({
        team_id,
        team_name: nameOf.get(team_id) ?? '?',
        stage,
        stage_label: labelOf(stage),
        unit: unitOf(stage),
      })
    }
    const teamsWithoutStage: string[] = []
    for (const t of teams) {
      const st = resolveTeamStage(t, stages)
      if (st) push(t.id, st)
      else teamsWithoutStage.push(t.name)
    }

    const derived: ChiTieuCell[] = []
    for (const [date, list] of derivedByDay) {
      for (const d of list) {
        if (!d.team_department_id) continue
        derived.push({
          team_department_id: d.team_department_id,
          stage: d.stage,
          date,
          qty: d.qty,
        })
      }
    }
    const targetCells: ChiTieuCell[] = targets.map((t) => ({
      team_department_id: t.team_department_id,
      stage: t.stage,
      date: t.target_date,
      qty: t.qty,
    }))
    for (const c of [...targetCells, ...derived]) {
      if (nameOf.has(c.team_department_id)) push(c.team_department_id, c.stage)
    }
    rows.sort(
      (a, b) =>
        (stageIdx.get(a.stage) ?? 99) - (stageIdx.get(b.stage) ?? 99) ||
        a.team_name.localeCompare(b.team_name, 'vi'),
    )

    const doneMap = new Map<string, ChiTieuCell>()
    for (const e of entries) {
      if (!e.team_department_id) continue
      const k = `${e.team_department_id}|${e.stage}|${e.entry_date}`
      const c = doneMap.get(k) ?? {
        team_department_id: e.team_department_id,
        stage: e.stage,
        date: e.entry_date,
        qty: 0,
      }
      c.qty += Number(e.qty)
      doneMap.set(k, c)
    }

    const stagesWithTeam = new Set(rows.map((r) => r.stage))
    const jobsWithEnd = new Set<string>()
    for (const list of derivedByDay.values())
      for (const d of list) jobsWithEnd.add(`${d.team_department_id}|${d.stage}`)

    return {
      week_start: weekStart,
      days,
      today,
      rows,
      targets: targetCells,
      derived,
      done: [...doneMap.values()],
      teams_without_stage: teamsWithoutStage,
      stages_without_team: stages
        .filter((s) => !stagesWithTeam.has(s.code))
        .map((s) => s.label),
      jobs_with_end: jobsWithEnd.size,
    }
  },

  /** Ghi đè trọn ngày — quyền Kế hoạch (cùng màn lộ trình/giao tổ). */
  async saveDay(
    user: User,
    date: string,
    rows: {
      team_department_id: string
      stage: string
      qty: number
      note?: string | null
    }[],
  ): Promise<void> {
    await assertAction(user, 'production.plan.manage')
    const seen = new Set<string>()
    for (const r of rows) {
      const k = `${r.team_department_id}|${r.stage}`
      if (seen.has(k)) {
        throw BadRequest('Trùng ô (tổ × công đoạn) trong một lượt lưu')
      }
      seen.add(k)
    }
    await targetsRepo.replaceDay(
      date,
      rows.map((r) => ({
        team_department_id: r.team_department_id,
        stage: r.stage,
        qty: r.qty,
        note: r.note ?? null,
        created_by: user.id,
      })),
    )
  },
}
