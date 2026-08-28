import { jobsService, type OverviewRow } from './jobs.service'
import { jobsRepo } from './jobs.repo'
import { lsxLinesRepo } from './lsx-lines.repo'
import { entriesRepo } from './entries.repo'
import { targetsRepo } from './targets.repo'
import { productionRepo } from './production.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'

/**
 * KẾ HOẠCH TUẦN (user hỏi "vấn đề theo tuần" 24/08/2026) — TUẦN LÀ LĂNG KÍNH
 * ĐỌC, KHÔNG PHẢI THỰC THỂ: màn này chỉ tổng hợp từ dữ liệu đã có (lệnh phải
 * xuất trong tuần · việc đến hạn từng ngày · ma trận tổ × 7 ngày chỉ tiêu vs
 * đạt). Không bảng mới, không ai phải nhập thêm — giao chỉ tiêu cả tuần đã có
 * qua "Áp dụng đến ngày" ở màn Chỉ tiêu. Từ chối thực thể "KH-tuần" lần 3 —
 * xem plan-hoan-thien-ke-hoach-sx.md.
 */

const r2 = (n: number) => Math.round(n * 100) / 100

export type WeekShipRow = Pick<
  OverviewRow,
  'qty_needed' | 'qty_done' | 'forecast_date'
> & {
  lsx_id: string
  lsx_code: string
  customer_name: string
  ship_date: string
  /** Dự kiến xong MUỘN hơn ngày xuất (theo nhịp hiện tại). */
  forecast_late: boolean
}

export type WeekDueJob = {
  lsx_code: string
  product_code: string
  stage: string
  team_name: string | null
  status: string
  planned_end: string
}

export type WeekTeamRow = {
  team_id: string
  team_name: string
  /** 7 ô theo days: chỉ tiêu THẬT (null = không giao) + đạt từ sổ. */
  cells: { date: string; target: number | null; done: number }[]
  week_target: number
  week_done: number
}

export type WeekBoard = {
  week_start: string
  days: string[]
  ships: WeekShipRow[]
  /** Việc CHƯA XONG có hạn trong tuần, gộp theo ngày hạn. */
  due_by_day: { date: string; jobs: WeekDueJob[] }[]
  teams: WeekTeamRow[]
}

export const weekService = {
  /** Đọc: mọi NV đã đăng nhập (cùng tư thế các màn kế hoạch). */
  async board(user: User, weekStart: string): Promise<WeekBoard> {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${weekStart}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + i)
      return d.toISOString().slice(0, 10)
    })
    const weekEnd = days[6]

    const [{ rows }, stages, entries, targets, depts] = await Promise.all([
      jobsService.overview(user),
      productionRepo.listStages(),
      entriesRepo.listRange(weekStart, weekEnd),
      targetsRepo.listRange(weekStart, weekEnd),
      departmentsRepo.list(),
    ])
    const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c

    // ── Lệnh phải XUẤT trong tuần ──────────────────────────────────────────
    const ships: WeekShipRow[] = rows
      .filter(
        (r) =>
          r.lsx.ship_date && r.lsx.ship_date >= weekStart && r.lsx.ship_date <= weekEnd,
      )
      .map((r) => ({
        lsx_id: r.lsx.id,
        lsx_code: r.lsx.code,
        customer_name: r.lsx.customer_name,
        ship_date: r.lsx.ship_date!,
        qty_needed: r.qty_needed,
        qty_done: r.qty_done,
        forecast_date: r.forecast_date,
        forecast_late: !!r.forecast_date && r.forecast_date > r.lsx.ship_date!,
      }))
      .sort((a, b) => a.ship_date.localeCompare(b.ship_date))

    // ── Việc chưa xong có HẠN trong tuần ───────────────────────────────────
    const lsxIds = rows.map((r) => r.lsx.id)
    const [jobs, lines] = await Promise.all([
      jobsRepo.listByLsxBulk(lsxIds),
      lsxLinesRepo.listLinesBulk(lsxIds),
    ])
    const codeOf = new Map(rows.map((r) => [r.lsx.id, r.lsx.code]))
    const lineCodes = new Map(lines.map((l) => [l.id, l.product_code]))
    const dueByDay = new Map<string, WeekDueJob[]>()
    for (const j of jobs) {
      if (j.status === 'done' || !j.planned_end) continue
      const due = j.planned_end.slice(0, 10)
      if (due < weekStart || due > weekEnd) continue
      const arr = dueByDay.get(due) ?? []
      arr.push({
        lsx_code: codeOf.get(j.production_order_id) ?? '?',
        product_code: lineCodes.get(j.production_order_line_id ?? '') ?? '?',
        stage: labelOf(j.stage),
        team_name: j.team_name,
        status: j.status,
        planned_end: due,
      })
      dueByDay.set(due, arr)
    }

    // ── Ma trận tổ × 7 ngày: chỉ tiêu thật vs đạt ──────────────────────────
    const doneByTeamDay = new Map<string, number>()
    for (const e of entries) {
      if (!e.team_department_id) continue
      const k = `${e.team_department_id}|${e.entry_date}`
      doneByTeamDay.set(k, (doneByTeamDay.get(k) ?? 0) + e.qty)
    }
    const targetByTeamDay = new Map<string, number>()
    for (const t of targets) {
      const k = `${t.team_department_id}|${t.target_date}`
      targetByTeamDay.set(k, (targetByTeamDay.get(k) ?? 0) + t.qty)
    }
    const teams: WeekTeamRow[] = depts
      .filter((d) => d.workspace_id === 'production')
      .map((d) => {
        const cells = days.map((date) => ({
          date,
          target: targetByTeamDay.has(`${d.id}|${date}`)
            ? r2(targetByTeamDay.get(`${d.id}|${date}`)!)
            : null,
          done: r2(doneByTeamDay.get(`${d.id}|${date}`) ?? 0),
        }))
        return {
          team_id: d.id,
          team_name: d.name,
          cells,
          week_target: r2(cells.reduce((a, c) => a + (c.target ?? 0), 0)),
          week_done: r2(cells.reduce((a, c) => a + c.done, 0)),
        }
      })
      // Tổ không có gì trong tuần (không chỉ tiêu, không sổ) xếp cuối, vẫn hiện.
      .sort(
        (a, b) =>
          (b.week_target + b.week_done > 0 ? 1 : 0) -
            (a.week_target + a.week_done > 0 ? 1 : 0) || b.week_done - a.week_done,
      )

    return {
      week_start: weekStart,
      days,
      ships,
      due_by_day: days
        .filter((d) => dueByDay.has(d))
        .map((d) => ({ date: d, jobs: dueByDay.get(d)! })),
      teams,
    }
  },
}
