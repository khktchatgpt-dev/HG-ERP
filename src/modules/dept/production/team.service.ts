import { productionRepo, type ProductionOrder } from './production.repo'
import { routesRepo } from './routes.repo'
import { productionService } from './production.service'
import {
  departmentsRepo,
  type Department,
} from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'
import { hasPermission } from '@/modules/core/rbac/rbac.service'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { assessLateRisk } from '@/lib/late-risk'
import { BadRequest, Forbidden } from '@/server/http'

/**
 * Màn "Việc của tổ" (tách vai 07/2026): Kanban thẻ = LSX × công đoạn của TỔ
 * MÌNH. Trạng thái thẻ SUY từ sổ production_progress sẵn có (không bảng mới):
 * chưa có bản ghi = Chưa làm · 'start' = Đang làm · 'done' = Hoàn thành.
 * Ghi vẫn đi qua productionService.updateStage — một điểm ghi duy nhất.
 */

export type TeamCardStatus = 'todo' | 'doing' | 'done'

export type TeamCard = {
  lsx_id: string
  lsx_code: string
  order_code: string
  customer_name: string
  ship_date: string | null
  late: 'overdue' | 'at_risk' | null
  status: TeamCardStatus
  /** false = lệnh cũ chưa định hình lộ trình — vào bảng tự do, cần lưu ý. */
  routed: boolean
  /** Lần cập nhật tiến độ gần nhất ở công đoạn này (ISO) — null nếu chưa. */
  last_update: string | null
}

export type TeamWorkloadRow = {
  department_id: string
  department_name: string
  stage: string
  stage_label: string
  todo: number
  doing: number
  done: number
}

type ProgressRow = { stage: string; action: string; created_at: string }

/**
 * Suy trạng thái thẻ từ progress của 1 LSX: bản ghi start/done MỚI NHẤT của
 * đúng công đoạn thắng (done rồi start lại = làm lại → doing); received /
 * cancelled không tính. rows phải sort tăng theo created_at. Pure — có test.
 */
export function deriveCardStatus(rows: ProgressRow[], stage: string): TeamCardStatus {
  let status: TeamCardStatus = 'todo'
  for (const r of rows) {
    if (r.stage !== stage) continue
    if (r.action === 'start') status = 'doing'
    else if (r.action === 'done') status = 'done'
  }
  return status
}

type ActiveLsx = {
  id: string
  code: string
  order_code: string
  customer_name: string
  ship_date: string | null
  late: 'overdue' | 'at_risk' | null
}

/** LSX đang chạy (approved | in_progress) từ view tracking + cờ trễ hạn. */
async function listActiveLsx(): Promise<ActiveLsx[]> {
  const tracking = await productionRepo.listTracking()
  const today = new Date().toISOString().slice(0, 10)
  return tracking
    .filter(
      (r) =>
        r.production_order_id &&
        (r.lsx_status === 'approved' || r.lsx_status === 'in_progress'),
    )
    .map((r) => ({
      id: r.production_order_id!,
      code: r.lsx_code ?? '?',
      order_code: r.code,
      customer_name: r.customer_name,
      ship_date: r.ship_date,
      late: (assessLateRisk(r, today)?.level ?? null) as ActiveLsx['late'],
    }))
}

/** Thẻ của 1 công đoạn từ dữ liệu đã nạp sẵn (dùng chung board + workload). */
function cardsForStage(
  stage: string,
  active: ActiveLsx[],
  unions: Map<string, Set<string>>,
  progressByLsx: Map<string, ProgressRow[]>,
): TeamCard[] {
  const cards: TeamCard[] = []
  for (const lsx of active) {
    const union = unions.get(lsx.id)
    const routed = !!union && union.size > 0
    // Lệnh đã định hình mà công đoạn này không nằm trên lộ trình → không phải
    // việc của tổ. Lệnh CHƯA định hình vẫn hiện (đơn cũ — cùng chính sách sổ
    // sản lượng: nhập tự do), gắn cờ routed=false để tổ biết.
    if (routed && !union.has(stage)) continue
    const rows = progressByLsx.get(lsx.id) ?? []
    const stageRows = rows.filter((r) => r.stage === stage)
    cards.push({
      lsx_id: lsx.id,
      lsx_code: lsx.code,
      order_code: lsx.order_code,
      customer_name: lsx.customer_name,
      ship_date: lsx.ship_date,
      late: lsx.late,
      status: deriveCardStatus(rows, stage),
      routed,
      last_update: stageRows.length ? stageRows[stageRows.length - 1].created_at : null,
    })
  }
  return cards
}

async function loadBoardData() {
  const [active, unions] = await Promise.all([
    listActiveLsx(),
    routesRepo.stageUnionsByLsx(),
  ])
  const progress = await productionRepo.listProgressBulk(active.map((l) => l.id))
  const progressByLsx = new Map<string, ProgressRow[]>()
  for (const p of progress) {
    const list = progressByLsx.get(p.production_order_id) ?? []
    list.push(p)
    progressByLsx.set(p.production_order_id, list)
  }
  return { active, unions, progressByLsx }
}

export const teamService = {
  /**
   * Bảng việc theo công đoạn. NV xưởng đã gán tổ → khoá đúng công đoạn tổ
   * mình; admin/manager (hoặc NV xưởng chưa gán tổ) chọn qua opts.stage.
   */
  async board(
    user: User,
    opts: { stage?: string } = {},
  ): Promise<{
    stage: string | null
    stage_label: string | null
    team: { id: string; name: string } | null
    cards: TeamCard[]
  }> {
    if (!(await hasPermission(user, 'production.team.manage'))) {
      throw Forbidden('Chỉ bộ phận sản xuất hoặc Ban quản lý xem bảng việc của tổ')
    }
    const stages = await productionRepo.listStages()
    const dept = user.department_id
      ? await departmentsRepo.findById(user.department_id)
      : null
    const isTeamMember = user.role === 'employee' && dept?.workspace_id === 'production'
    const ownStage = isTeamMember ? resolveTeamStage(dept, stages) : null

    // Quyền mềm trong tổ nhưng KHÔNG xem nhầm việc tổ khác: NV xưởng đã gán
    // công đoạn bị khoá đúng công đoạn đó; còn lại được chọn.
    const stage = ownStage ?? opts.stage ?? null
    if (!stage) {
      return { stage: null, stage_label: null, team: null, cards: [] }
    }
    if (!stages.some((s) => s.code === stage)) {
      throw BadRequest('Công đoạn không có trong danh mục')
    }

    const { active, unions, progressByLsx } = await loadBoardData()
    return {
      stage,
      stage_label: stages.find((s) => s.code === stage)?.label ?? stage,
      team: ownStage && dept ? { id: dept.id, name: dept.name } : null,
      cards: cardsForStage(stage, active, unions, progressByLsx),
    }
  },

  /**
   * Tổ đánh dấu thẻ: Bắt đầu / Xong công đoạn. Quyền mềm theo TỔ — mọi thành
   * viên tổ được thao tác ĐÚNG công đoạn tổ mình; admin/manager mọi công đoạn.
   * Ghi delegate updateStage (guard + progress + emit bàn giao ở một chỗ).
   */
  async markStage(
    user: User,
    lsxId: string,
    input: { stage: string; action: 'start' | 'done'; note?: string | null },
  ): Promise<ProductionOrder> {
    if (user.role === 'employee') {
      const stages = await productionRepo.listStages()
      const dept = user.department_id
        ? await departmentsRepo.findById(user.department_id)
        : null
      const ownStage =
        dept?.workspace_id === 'production' ? resolveTeamStage(dept, stages) : null
      if (!ownStage || ownStage !== input.stage) {
        throw Forbidden('Chỉ được cập nhật công đoạn tổ mình phụ trách')
      }
    }
    return productionService.updateStage(user, lsxId, input)
  },

  /**
   * Tải việc theo tổ cho màn quản đốc: mỗi tổ xưởng đã gán công đoạn → đếm
   * thẻ Chưa làm / Đang làm / Hoàn thành trên các lệnh đang chạy.
   */
  async workloadByTeam(): Promise<TeamWorkloadRow[]> {
    const [stages, depts] = await Promise.all([
      productionRepo.listStages(),
      departmentsRepo.list(),
    ])
    const teams = depts
      .map((d: Department) => ({ dept: d, stage: resolveTeamStage(d, stages) }))
      .filter(
        (t): t is { dept: Department; stage: string } =>
          t.dept.workspace_id === 'production' && !!t.stage,
      )
    if (!teams.length) return []

    const { active, unions, progressByLsx } = await loadBoardData()
    return teams.map(({ dept, stage }) => {
      const cards = cardsForStage(stage, active, unions, progressByLsx)
      return {
        department_id: dept.id,
        department_name: dept.name,
        stage,
        stage_label: stages.find((s) => s.code === stage)?.label ?? stage,
        todo: cards.filter((c) => c.status === 'todo').length,
        doing: cards.filter((c) => c.status === 'doing').length,
        done: cards.filter((c) => c.status === 'done').length,
      }
    })
  },
}
