import { z } from 'zod'
import { productionRepo } from './production.repo'
import { jobsRepo, type Job } from './jobs.repo'
import { planRepo, type PlanChangeDiff, type PlanChangeRow } from './plan.repo'
import type { linePlanSchema, lsxPlanSchema } from './plan.schema'
import { lsxLinesRepo } from './lsx-lines.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, NotFound } from '@/server/http'

/**
 * KẾ HOẠCH SẢN XUẤT per LSX (vai Trưởng phòng Kế hoạch — thiết kế lại 0084):
 * lộ trình công đoạn per dòng SP (tạo production_jobs theo seq) + giao tổ +
 * hạn per công đoạn + ưu tiên lệnh. Sửa kế hoạch KHÔNG reset việc đã chạy:
 * job trùng công đoạn giữ status/xác nhận; xoá công đoạn đã chạy bị chặn.
 */

export type PlanLine = {
  /** id DÒNG LỆNH (production_order_lines) — 0114. */
  order_line_id: string
  /** Tên nhóm chứa dòng (số PO / bộ sưu tập) để planner biết dòng của đơn nào. */
  group_title: string
  product_id: string | null
  product_code: string
  product_name: string
  qty: number
  /** Lộ trình mặc định của SP (technical_products.stage_route) — gợi ý điền. */
  default_route: string[] | null
  jobs: Job[]
}

export type PlanView = {
  lsx: {
    id: string
    code: string
    status: string
    priority: number
    ship_date: string | null
    order_codes: string[]
    customer_name: string
  }
  lines: PlanLine[]
  stages: { code: string; label: string }[]
  /** Tổ xưởng (workspace production) + công đoạn phụ trách để giao việc. */
  teams: { id: string; name: string; stage_code: string | null }[]
  /** Nhật ký điều chỉnh kế hoạch (0169) — mới nhất trước. */
  history: PlanChangeRow[]
}

async function lsxOrThrow(lsxId: string) {
  const lsx = await productionRepo.findById(lsxId)
  if (!lsx) throw NotFound('LSX không tồn tại')
  return lsx
}

function assertEditable(status: string): void {
  if (status === 'completed' || status === 'cancelled') {
    throw BadRequest('LSX đã kết thúc — kế hoạch chỉ còn để tra cứu')
  }
  if (status === 'pending_approval' || status === 'rejected') {
    throw BadRequest('LSX chưa được duyệt — chờ Giám đốc duyệt rồi lên kế hoạch')
  }
}

export const planService = {
  /** Đọc: mọi NV đã đăng nhập (xưởng/kho/GĐ tra cứu kế hoạch). */
  async get(_user: User, lsxId: string): Promise<PlanView> {
    const lsx = await lsxOrThrow(lsxId)
    const [orderLines, jobs, stages, depts, history] = await Promise.all([
      lsxLinesRepo.listLines(lsxId),
      jobsRepo.listByLsx(lsxId),
      productionRepo.listStages(),
      departmentsRepo.list(),
      planRepo.listChanges(lsxId),
    ])
    const defaults = await planRepo.defaultRoutesByProducts([
      ...new Set(orderLines.map((l) => l.product_id).filter((x): x is string => !!x)),
    ])
    const groupTitle = new Map(
      (await lsxLinesRepo.listGroups(lsxId)).map((g) => [g.id, g.title ?? '']),
    )
    const jobsByLine = new Map<string, Job[]>()
    for (const j of jobs) {
      const arr = jobsByLine.get(j.production_order_line_id) ?? []
      arr.push(j)
      jobsByLine.set(j.production_order_line_id, arr)
    }
    return {
      lsx: {
        id: lsx.id,
        code: lsx.code,
        status: lsx.status,
        priority: lsx.priority,
        ship_date: lsx.ship_date,
        order_codes: lsx.order_codes,
        customer_name: lsx.customer_name,
      },
      lines: orderLines.map((l) => ({
        order_line_id: l.id,
        group_title: groupTitle.get(l.group_id) ?? '',
        product_id: l.product_id,
        product_code: l.product_code,
        product_name: l.name_vi ?? l.product_code,
        qty: l.qty,
        default_route: l.product_id ? (defaults.get(l.product_id) ?? null) : null,
        jobs: jobsByLine.get(l.id) ?? [],
      })),
      stages,
      teams: depts
        .filter((d) => d.workspace_id === 'production')
        .map((d) => ({
          id: d.id,
          name: d.name,
          stage_code: resolveTeamStage(d, stages),
        })),
      history,
    }
  },

  /**
   * Ghi kế hoạch 1 dòng SP: lộ trình theo thứ tự + giao tổ + hạn. Tổ bỏ trống
   * → tự gán tổ phụ trách công đoạn (departments.stage_code). Chặn xoá công
   * đoạn đã chạy (doing/done) — sửa số phải xử lý sổ trước.
   */
  async saveLinePlan(
    user: User,
    lsxId: string,
    input: z.infer<typeof linePlanSchema>,
  ): Promise<void> {
    await assertAction(user, 'production.plan.manage')
    const lsx = await lsxOrThrow(lsxId)
    assertEditable(lsx.status)

    const orderLines = await lsxLinesRepo.listLines(lsxId)
    const line = orderLines.find((l) => l.id === input.order_line_id)
    if (!line) throw BadRequest('Dòng SP không thuộc lệnh này')

    const stages = await productionRepo.listStages()
    const validCodes = new Set(stages.map((s) => s.code))
    const seen = new Set<string>()
    for (const s of input.stages) {
      if (!validCodes.has(s.stage)) {
        throw BadRequest(`Công đoạn "${s.stage}" không có trong danh mục`)
      }
      if (seen.has(s.stage)) {
        throw BadRequest(`Công đoạn "${s.stage}" bị lặp trên lộ trình`)
      }
      seen.add(s.stage)
      if (s.planned_start && s.planned_end && s.planned_end < s.planned_start) {
        throw BadRequest('Hạn kết thúc công đoạn phải sau ngày bắt đầu')
      }
    }

    // Chặn xoá công đoạn đã chạy — việc đã có trạng thái/sổ không được biến mất.
    const existing = (await jobsRepo.listByLsx(lsxId)).filter(
      (j) => j.production_order_line_id === input.order_line_id,
    )
    const removedActive = existing.filter(
      (j) => j.status !== 'todo' && !seen.has(j.stage),
    )
    if (removedActive.length) {
      const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c
      throw BadRequest(
        `Không bỏ được công đoạn đã chạy: ${removedActive
          .map((j) => labelOf(j.stage))
          .join(', ')} — xử lý sổ/trạng thái trước khi sửa lộ trình`,
      )
    }

    // Tổ mặc định theo công đoạn (0064 departments.stage_code).
    const depts = await departmentsRepo.list()
    const teamByStage = new Map<string, string>()
    for (const d of depts) {
      if (d.workspace_id !== 'production') continue
      const st = resolveTeamStage(d, stages)
      if (st && !teamByStage.has(st)) teamByStage.set(st, d.id)
    }

    const resolved = input.stages.map((s) => ({
      stage: s.stage,
      team_department_id: s.team_department_id ?? teamByStage.get(s.stage) ?? null,
      planned_start: s.planned_start ?? null,
      planned_end: s.planned_end ?? null,
    }))

    // ── Diff điều chỉnh (0169) — so bản CŨ với bản SẼ GHI (tổ đã resolve) ──
    const day = (v: string | null) => (v ? v.slice(0, 10) : null)
    const existingByStage = new Map(existing.map((j) => [j.stage, j]))
    const diff = {
      added: resolved.filter((s) => !existingByStage.has(s.stage)).map((s) => s.stage),
      removed: existing.filter((j) => !seen.has(j.stage)).map((j) => j.stage),
      changed: [] as {
        stage: string
        field: 'team' | 'planned_start' | 'planned_end'
        from: string | null
        to: string | null
      }[],
    }
    for (const s of resolved) {
      const j = existingByStage.get(s.stage)
      if (!j) continue
      if ((j.team_department_id ?? null) !== s.team_department_id) {
        diff.changed.push({
          stage: s.stage,
          field: 'team',
          from: j.team_department_id,
          to: s.team_department_id,
        })
      }
      if (day(j.planned_start) !== s.planned_start) {
        diff.changed.push({
          stage: s.stage,
          field: 'planned_start',
          from: day(j.planned_start),
          to: s.planned_start,
        })
      }
      if (day(j.planned_end) !== s.planned_end) {
        diff.changed.push({
          stage: s.stage,
          field: 'planned_end',
          from: day(j.planned_end),
          to: s.planned_end,
        })
      }
    }
    const hasDiff =
      diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0
    // Dòng SP ĐÃ CHẠY (có việc doing/done) mà đổi kế hoạch → bắt lý do — không
    // sửa đè im lặng (plan-hoan-thien-ke-hoach-sx #6). Lập lần đầu thì không.
    const lineActive = existing.some((j) => j.status !== 'todo')
    if (hasDiff && lineActive && !input.reason?.trim()) {
      throw BadRequest(
        'Dòng SP đã có việc chạy — điều chỉnh kế hoạch phải ghi LÝ DO (ai đọc lại sau còn hiểu vì sao đổi)',
        'PLAN_REASON_REQUIRED',
      )
    }

    await jobsRepo.replaceForLine(lsxId, input.order_line_id, resolved)

    if (hasDiff) {
      await planRepo.insertChange({
        production_order_id: lsxId,
        production_order_line_id: input.order_line_id,
        changes: diff,
        reason: input.reason?.trim() || null,
        created_by: user.id,
      })
    }

    // Lộ trình mặc định gắn vào SP — dòng lệnh chưa gắn SP (mã "Thông báo sau")
    // thì không có chỗ để lưu, bỏ qua im lặng.
    if (input.save_as_default && input.stages.length && line.product_id) {
      await planRepo.saveDefaultRoute(
        line.product_id,
        input.stages.map((s) => s.stage),
      )
    }
  },

  /**
   * Kế hoạch CẢ LỆNH (thiết kế lại 24/08): người điều độ lập MỘT lộ trình
   * công đoạn + tổ + hạn cho toàn lệnh, hệ rải xuống từng dòng SP — dòng có
   * lộ trình mặc định riêng (stage_route) chỉ nhận các công đoạn nằm TRONG lộ
   * trình đó; dòng chưa có lộ trình nhận đủ. Lý do: lệnh thật vài chục dòng ×
   * 6 công đoạn, bắt gõ per dòng là hàng trăm cặp ngày — không ai làm (11/11
   * lệnh trống kế hoạch). Tầng dòng SP giữ nguyên để tinh chỉnh ngoại lệ.
   */
  async saveLsxPlan(
    user: User,
    lsxId: string,
    input: z.infer<typeof lsxPlanSchema>,
  ): Promise<{ lines_planned: number; lines_kept: number }> {
    await assertAction(user, 'production.plan.manage')
    const lsx = await lsxOrThrow(lsxId)
    assertEditable(lsx.status)

    const stages = await productionRepo.listStages()
    const validCodes = new Set(stages.map((s) => s.code))
    const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c
    const seen = new Set<string>()
    for (const s of input.stages) {
      if (!validCodes.has(s.stage)) {
        throw BadRequest(`Công đoạn "${s.stage}" không có trong danh mục`)
      }
      if (seen.has(s.stage)) {
        throw BadRequest(`Công đoạn "${s.stage}" bị lặp trên lộ trình`)
      }
      seen.add(s.stage)
      if (s.planned_start && s.planned_end && s.planned_end < s.planned_start) {
        throw BadRequest(`${labelOf(s.stage)}: hạn kết thúc phải sau ngày bắt đầu`)
      }
    }

    const [orderLines, allJobs, depts] = await Promise.all([
      lsxLinesRepo.listLines(lsxId),
      jobsRepo.listByLsx(lsxId),
      departmentsRepo.list(),
    ])
    if (!orderLines.length) throw BadRequest('Lệnh không có dòng SP nào')
    const routes = await planRepo.defaultRoutesByProducts([
      ...new Set(orderLines.map((l) => l.product_id).filter((x): x is string => !!x)),
    ])

    const teamByStage = new Map<string, string>()
    for (const d of depts) {
      if (d.workspace_id !== 'production') continue
      const st = resolveTeamStage(d, stages)
      if (st && !teamByStage.has(st)) teamByStage.set(st, d.id)
    }
    // Sắp theo thứ tự danh mục — thứ tự client gửi không tin được.
    const order = new Map(stages.map((s, i) => [s.code, i]))
    const resolvedAll = [...input.stages]
      .sort((a, b) => (order.get(a.stage) ?? 99) - (order.get(b.stage) ?? 99))
      .map((s) => ({
        stage: s.stage,
        team_department_id: s.team_department_id ?? teamByStage.get(s.stage) ?? null,
        planned_start: s.planned_start ?? null,
        planned_end: s.planned_end ?? null,
      }))

    const jobsByLine = new Map<string, Job[]>()
    for (const j of allJobs) {
      const arr = jobsByLine.get(j.production_order_line_id) ?? []
      arr.push(j)
      jobsByLine.set(j.production_order_line_id, arr)
    }

    // Rải per dòng: lộ trình SP là bộ lọc; kiểm TOÀN BỘ trước khi ghi dòng nào
    // (một dòng vướng công đoạn đã chạy là chặn cả lượt — không ghi nửa vời).
    // Mặc định KHÔNG ghi đè: dòng đã có kế hoạch (lập tay/tinh chỉnh) giữ
    // nguyên, chỉ dòng trống nhận bản lệnh; ghi đè phải bật cờ overwrite.
    const day = (v: string | null) => (v ? v.slice(0, 10) : null)
    const perLine: { lineId: string; target: typeof resolvedAll }[] = []
    const blockers: string[] = []
    const diff: PlanChangeDiff = { added: [], removed: [], changed: [] }
    const addedSet = new Set<string>()
    const removedSet = new Set<string>()
    const changedSet = new Set<string>()
    let anyActive = false
    let anyDiff = false
    let linesKept = 0

    for (const line of orderLines) {
      const route = line.product_id ? (routes.get(line.product_id) ?? null) : null
      const routeSet = route ? new Set(route) : null
      const target = routeSet
        ? resolvedAll.filter((s) => routeSet.has(s.stage))
        : resolvedAll
      const targetSet = new Set(target.map((s) => s.stage))
      const existing = jobsByLine.get(line.id) ?? []
      if (!input.overwrite && existing.length > 0) {
        linesKept++
        continue
      }
      const existingByStage = new Map(existing.map((j) => [j.stage, j]))

      const removedActive = existing.filter(
        (j) => j.status !== 'todo' && !targetSet.has(j.stage),
      )
      if (removedActive.length) {
        blockers.push(
          `${line.product_code}: ${removedActive.map((j) => labelOf(j.stage)).join(', ')}`,
        )
        continue
      }
      if (existing.some((j) => j.status !== 'todo')) anyActive = true

      for (const s of target) {
        const j = existingByStage.get(s.stage)
        if (!j) {
          anyDiff = true
          if (!addedSet.has(s.stage)) {
            addedSet.add(s.stage)
            diff.added.push(s.stage)
          }
          continue
        }
        for (const f of ['team', 'planned_start', 'planned_end'] as const) {
          const from = f === 'team' ? (j.team_department_id ?? null) : day(j[f])
          const to = f === 'team' ? s.team_department_id : s[f]
          if (from !== to) {
            anyDiff = true
            const key = `${s.stage}|${f}`
            if (!changedSet.has(key)) {
              changedSet.add(key)
              diff.changed.push({ stage: s.stage, field: f, from, to })
            }
          }
        }
      }
      for (const j of existing) {
        if (!targetSet.has(j.stage)) {
          anyDiff = true
          if (!removedSet.has(j.stage)) {
            removedSet.add(j.stage)
            diff.removed.push(j.stage)
          }
        }
      }
      perLine.push({ lineId: line.id, target })
    }

    if (blockers.length) {
      throw BadRequest(
        `Không bỏ được công đoạn đã chạy — tinh chỉnh riêng các dòng: ${blockers.join('; ')}`,
      )
    }
    if (!perLine.length) {
      throw BadRequest(
        'Mọi dòng SP đã có kế hoạch — bật "Ghi đè" nếu muốn áp lại bản cả lệnh',
      )
    }
    if (anyDiff && anyActive && !input.reason?.trim()) {
      throw BadRequest(
        'Lệnh đã có việc chạy — điều chỉnh kế hoạch cả lệnh phải ghi LÝ DO',
        'PLAN_REASON_REQUIRED',
      )
    }

    for (const { lineId, target } of perLine) {
      await jobsRepo.replaceForLine(lsxId, lineId, target)
    }
    if (anyDiff) {
      await planRepo.insertChange({
        production_order_id: lsxId,
        production_order_line_id: null, // null = điều chỉnh CẢ LỆNH
        changes: diff,
        reason: input.reason?.trim() || null,
        created_by: user.id,
      })
    }
    return { lines_planned: perLine.length, lines_kept: linesKept }
  },

  /** Ưu tiên lệnh (số lớn = làm trước) — xếp hàng đợi xưởng. */
  async setPriority(user: User, lsxId: string, priority: number): Promise<void> {
    await assertAction(user, 'production.plan.manage')
    const lsx = await lsxOrThrow(lsxId)
    assertEditable(lsx.status)
    await productionRepo.patch(lsxId, { priority })
  },

  /**
   * Sửa 1 job: giao tổ / hạn / ghi chú (không đụng trạng thái). Đổi tổ/hạn
   * cũng vào nhật ký điều chỉnh (0169) như sửa qua PlanEditor — job đã chạy
   * (doing/done) thì bắt lý do; ghi chú không phải kế hoạch nên không log.
   */
  async patchJob(
    user: User,
    jobId: string,
    patch: {
      team_department_id?: string | null
      planned_start?: string | null
      planned_end?: string | null
      note?: string | null
      reason?: string | null
    },
  ): Promise<Job> {
    await assertAction(user, 'production.plan.manage')
    const job = await jobsRepo.findById(jobId)
    if (!job) throw NotFound('Công việc không tồn tại')
    const lsx = await lsxOrThrow(job.production_order_id)
    assertEditable(lsx.status)

    const { reason, ...fields } = patch
    const day = (v: string | null) => (v ? v.slice(0, 10) : null)
    const changed: PlanChangeDiff['changed'] = []
    if (
      fields.team_department_id !== undefined &&
      (job.team_department_id ?? null) !== fields.team_department_id
    ) {
      changed.push({
        stage: job.stage,
        field: 'team',
        from: job.team_department_id,
        to: fields.team_department_id ?? null,
      })
    }
    if (
      fields.planned_start !== undefined &&
      day(job.planned_start) !== (fields.planned_start ?? null)
    ) {
      changed.push({
        stage: job.stage,
        field: 'planned_start',
        from: day(job.planned_start),
        to: fields.planned_start ?? null,
      })
    }
    if (
      fields.planned_end !== undefined &&
      day(job.planned_end) !== (fields.planned_end ?? null)
    ) {
      changed.push({
        stage: job.stage,
        field: 'planned_end',
        from: day(job.planned_end),
        to: fields.planned_end ?? null,
      })
    }
    if (changed.length && job.status !== 'todo' && !reason?.trim()) {
      throw BadRequest(
        'Công đoạn đã chạy — điều chỉnh giao tổ/hạn phải ghi LÝ DO (ai đọc lại sau còn hiểu vì sao đổi)',
        'PLAN_REASON_REQUIRED',
      )
    }

    const updated = await jobsRepo.patch(jobId, fields)
    if (changed.length) {
      await planRepo.insertChange({
        production_order_id: job.production_order_id,
        production_order_line_id: job.production_order_line_id,
        changes: { added: [], removed: [], changed },
        reason: reason?.trim() || null,
        created_by: user.id,
      })
    }
    return updated
  },
}
