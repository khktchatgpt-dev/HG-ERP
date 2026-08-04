import { z } from 'zod'
import { productionRepo } from './production.repo'
import { jobsRepo, type Job } from './jobs.repo'
import { planRepo } from './plan.repo'
import type { linePlanSchema } from './plan.schema'
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
    const [orderLines, jobs, stages, depts] = await Promise.all([
      lsxLinesRepo.listLines(lsxId),
      jobsRepo.listByLsx(lsxId),
      productionRepo.listStages(),
      departmentsRepo.list(),
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

    await jobsRepo.replaceForLine(
      lsxId,
      input.order_line_id,
      input.stages.map((s) => ({
        stage: s.stage,
        team_department_id: s.team_department_id ?? teamByStage.get(s.stage) ?? null,
        planned_start: s.planned_start ?? null,
        planned_end: s.planned_end ?? null,
      })),
    )

    // Lộ trình mặc định gắn vào SP — dòng lệnh chưa gắn SP (mã "Thông báo sau")
    // thì không có chỗ để lưu, bỏ qua im lặng.
    if (input.save_as_default && input.stages.length && line.product_id) {
      await planRepo.saveDefaultRoute(
        line.product_id,
        input.stages.map((s) => s.stage),
      )
    }
  },

  /** Ưu tiên lệnh (số lớn = làm trước) — xếp hàng đợi xưởng. */
  async setPriority(user: User, lsxId: string, priority: number): Promise<void> {
    await assertAction(user, 'production.plan.manage')
    const lsx = await lsxOrThrow(lsxId)
    assertEditable(lsx.status)
    await productionRepo.patch(lsxId, { priority })
  },

  /** Sửa 1 job: giao tổ / hạn / ghi chú (không đụng trạng thái). */
  async patchJob(
    user: User,
    jobId: string,
    patch: {
      team_department_id?: string | null
      planned_start?: string | null
      planned_end?: string | null
      note?: string | null
    },
  ): Promise<Job> {
    await assertAction(user, 'production.plan.manage')
    const job = await jobsRepo.findById(jobId)
    if (!job) throw NotFound('Công việc không tồn tại')
    const lsx = await lsxOrThrow(job.production_order_id)
    assertEditable(lsx.status)
    return jobsRepo.patch(jobId, patch)
  },
}
