import { productionRepo } from './production.repo'
import { productionService } from './production.service'
import { outputsRepo } from './outputs.repo'
import { outputsService, type ComponentOutputView } from './outputs.service'
import { teamService, type TeamWorkloadRow } from './team.service'
import { incidentsService } from './incidents.service'
import { defectCodesRepo } from './defect-codes.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { posService } from '@/modules/dept/supply/pos.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { stockRepo } from '@/modules/dept/warehouse/stock.repo'
import { poLineAmount } from '@/lib/po-line'
import { assessLateRisk, assessPoLate, type LateRisk } from '@/lib/late-risk'
import {
  bucketByWeek,
  defectByTeam,
  defectStats,
  orderSyncPct,
  teamStatusColor,
  topDefectReasons,
  wipBetweenStages,
  type SlimOutputEntry,
} from '@/lib/exec-ops'
import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'

/**
 * Data cho khu Ban Giám Đốc (Báo cáo CEO /exec + Tháp điều hành /exec/ops).
 * Guard đọc registry: exec.tower.view (assertAction ở call-site).
 */
async function assertExec(user: User): Promise<void> {
  await assertAction(user, 'exec.tower.view')
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** LSX đang chạy × tổng hợp sản lượng (pattern BoardScreen) — WIP + đơn trọng điểm. */
async function loadActiveSummaries(user: User) {
  const { rows } = await productionRepo.list({ page: 1, page_size: 50 })
  const active = rows.filter((l) => l.status === 'approved' || l.status === 'in_progress')
  const summaries = []
  for (const lsx of active) {
    summaries.push({ lsx, summary: await outputsService.summary(user, lsx.id) })
  }
  return summaries
}

// ── Kiểu trả về (serializable cho server component) ─────────────────────────

export type CeoOverview = {
  red_flags: {
    overdue_orders: {
      order_id: string
      code: string
      customer_name: string
      due_date: string | null
      reasons: string[]
    }[]
    open_incidents: { id: string; message: string; department_name: string | null }[]
    late_pos: {
      id: string
      code: string
      supplier_name: string
      expected_at: string | null
    }[]
    low_stock: {
      material_id: string
      code: string
      name: string
      on_hand: number
      min_stock: number
      unit: string
    }[]
  }
  pending: {
    lsx: {
      id: string
      code: string
      order_code: string
      customer_name: string
      created_at: string
    }[]
    pos: {
      id: string
      code: string
      supplier_name: string
      lsx_code: string
      order_code: string | null
      expected_at: string | null
      created_at: string
      currency: string
      total: number
      lines_count: number
    }[]
  }
  key_orders: {
    order_id: string
    code: string
    customer_name: string
    due_date: string | null
    stage_label: string | null
    pct: number
    bom_pending: number
    pos_open: number
    late_level: LateRisk['level'] | null
  }[]
  weekly_output: { week_start: string; qty: number; defect: number }[]
  pipeline: { status: string; count: number }[]
}

export type OpsTeam = TeamWorkloadRow & {
  today_qty: number
  open_incidents: number
  wip_before: number
  color: 'red' | 'yellow' | 'green'
}

export type OpsTower = {
  teams: OpsTeam[]
  wip_strip: {
    from: string
    from_label: string
    to: string
    to_label: string
    wip: number
  }[]
  quality: {
    last7: { qty: number; defect: number; rate: number }
    prev7: { qty: number; defect: number; rate: number }
    by_team: {
      team_id: string | null
      team_name: string
      qty: number
      defect: number
      rate: number
      reasons: { code: string | null; label: string; count: number }[]
    }[]
  }
  supply: {
    late_pos: {
      id: string
      code: string
      supplier_name: string
      expected_at: string | null
    }[]
    low_stock: {
      material_id: string
      code: string
      name: string
      on_hand: number
      min_stock: number
      unit: string
    }[]
  }
  incidents: {
    id: string
    message: string
    lsx_code: string | null
    stage: string | null
    department_name: string | null
    reported_by_name: string | null
    created_at: string
  }[]
}

export const opsService = {
  /** Data màn Báo cáo CEO (/exec) — vĩ mô hoạt động, management-by-exception. */
  async ceoOverview(user: User): Promise<CeoOverview> {
    await assertExec(user)
    const today = new Date().toISOString().slice(0, 10)

    const [
      tracking,
      pendingLsx,
      pendingPos,
      allPos,
      openIncidents,
      lowStock,
      stages,
      summaries,
      outputs8w,
    ] = await Promise.all([
      productionService.tracking(),
      productionService.list(user, {
        status: 'pending_approval',
        page: 1,
        page_size: 200,
      }),
      posService.list(user, { status: 'pending_approval', page: 1, page_size: 200 }),
      posService.list(user, { page: 1, page_size: 500 }),
      incidentsService.list(user, { status: 'open' }),
      stockRepo.list({ low_only: true }),
      productionRepo.listStages(),
      loadActiveSummaries(user),
      outputsRepo.listRange(addDaysIso(today, -55), today),
    ])

    // Tổng tiền PO chờ duyệt — chuẩn poLineAmount (price_basis unit2 đúng giá).
    const pendingPoRows = await Promise.all(
      pendingPos.rows.map(async (p) => {
        const lines = await posRepo.listLines(p.id)
        return {
          id: p.id,
          code: p.code,
          supplier_name: p.supplier_name,
          lsx_code: p.lsx_code,
          order_code: p.order_code,
          expected_at: p.expected_at,
          created_at: p.created_at,
          currency: p.currency,
          total: lines.reduce((s, l) => s + poLineAmount(l), 0),
          lines_count: lines.length,
        }
      }),
    )

    const FINAL = new Set(['completed', 'delivered', 'cancelled'])
    const running = tracking.filter((r) => !FINAL.has(r.status))
    const stageLabel = (code: string | null) =>
      code ? (stages.find((s) => s.code === code)?.label ?? code) : null

    // Đơn trọng điểm = đơn có LSX đang chạy; %HT từ synced_by_line của LSX đó.
    const summaryByOrderId = new Map(
      summaries.map((s) => [s.lsx.sales_order_id, s.summary]),
    )
    const key_orders = running
      .filter((r) => r.production_order_id)
      .map((r) => {
        const sum = summaryByOrderId.get(r.id)
        const risk = assessLateRisk(r, today)
        return {
          order_id: r.id,
          code: r.code,
          customer_name: r.customer_name,
          due_date: r.due_date,
          stage_label: stageLabel(r.current_stage),
          pct: sum ? orderSyncPct(sum.synced_by_line) : 0,
          bom_pending: r.lines_bom_pending,
          pos_open: r.pos_open,
          late_level: risk?.level ?? null,
        }
      })

    const overdue = running
      .map((r) => ({ r, risk: assessLateRisk(r, today) }))
      .filter((x) => x.risk?.level === 'overdue')

    const pipelineOrder = [
      'confirmed',
      'lsx_pending',
      'lsx_issued',
      'in_production',
      'completed',
      'delivered',
    ]
    const pipeline = pipelineOrder.map((status) => ({
      status,
      count: tracking.filter((r) => r.status === status).length,
    }))

    return {
      red_flags: {
        overdue_orders: overdue.map(({ r, risk }) => ({
          order_id: r.id,
          code: r.code,
          customer_name: r.customer_name,
          due_date: r.due_date,
          reasons: risk!.reasons,
        })),
        open_incidents: openIncidents.map((i) => ({
          id: i.id,
          message: i.message,
          department_name: i.department_name,
        })),
        late_pos: allPos.rows
          .filter((p) => assessPoLate(p, today) === 'overdue')
          .map((p) => ({
            id: p.id,
            code: p.code,
            supplier_name: p.supplier_name,
            expected_at: p.expected_at,
          })),
        low_stock: lowStock.map((s) => ({
          material_id: s.material_id,
          code: s.code,
          name: s.name,
          on_hand: s.on_hand,
          min_stock: s.min_stock,
          unit: s.unit,
        })),
      },
      pending: {
        lsx: pendingLsx.rows.map((l) => ({
          id: l.id,
          code: l.code,
          order_code: l.order_code,
          customer_name: l.customer_name,
          created_at: l.created_at,
        })),
        pos: pendingPoRows,
      },
      key_orders,
      weekly_output: bucketByWeek(outputs8w, 8, today),
      pipeline,
    }
  },

  /** Data màn Tháp điều hành COO (/exec/ops) — real-time vận hành. */
  async opsTower(user: User): Promise<OpsTower> {
    await assertExec(user)
    const today = new Date().toISOString().slice(0, 10)

    const [
      workload,
      stages,
      depts,
      openIncidents,
      allPos,
      lowStock,
      defectCodes,
      summaries,
      outputs14,
      outputsToday,
    ] = await Promise.all([
      teamService.workloadByTeam(),
      productionRepo.listStages(),
      departmentsRepo.list(),
      incidentsService.list(user, { status: 'open' }),
      posService.list(user, { page: 1, page_size: 500 }),
      stockRepo.list({ low_only: true }),
      defectCodesRepo.listAll(),
      loadActiveSummaries(user),
      outputsRepo.listRange(addDaysIso(today, -13), today),
      outputsRepo.listRange(today, today),
    ])

    const stageLabel = (code: string) =>
      stages.find((s) => s.code === code)?.label ?? code

    // WIP giữa các cặp công đoạn kế tiếp (mọi chi tiết của mọi lệnh đang chạy).
    const components: ComponentOutputView[] = summaries.flatMap(
      (s) => s.summary.components,
    )
    const wip = wipBetweenStages(
      components.map((c) => ({ stages: c.summary.stages })),
      stages.map((s) => s.code),
    )
    const wip_strip = wip.map((w) => ({
      ...w,
      from_label: stageLabel(w.from),
      to_label: stageLabel(w.to),
    }))
    // BTP ứ TRƯỚC 1 công đoạn = wip của cặp kết thúc tại công đoạn đó.
    const wipBeforeStage = new Map(wip.map((w) => [w.to, w.wip]))

    const todayByTeam = new Map<string | null, number>()
    for (const e of outputsToday) {
      todayByTeam.set(
        e.team_department_id,
        (todayByTeam.get(e.team_department_id) ?? 0) + Number(e.qty),
      )
    }
    const incidentsByDept = new Map<string | null, number>()
    for (const i of openIncidents) {
      incidentsByDept.set(
        i.department_id,
        (incidentsByDept.get(i.department_id) ?? 0) + 1,
      )
    }

    const teams: OpsTeam[] = workload.map((w) => {
      const today_qty = todayByTeam.get(w.department_id) ?? 0
      const open = incidentsByDept.get(w.department_id) ?? 0
      const wip_before = wipBeforeStage.get(w.stage) ?? 0
      return {
        ...w,
        today_qty,
        open_incidents: open,
        wip_before,
        color: teamStatusColor({
          hasOpenIncident: open > 0,
          doing: w.doing,
          todayQty: today_qty,
          wipBefore: wip_before,
        }),
      }
    })

    // Chất lượng: 14 ngày chia đôi → so tuần này với tuần trước.
    const split = addDaysIso(today, -6)
    const last7 = outputs14.filter((e) => e.entry_date >= split)
    const prev7 = outputs14.filter((e) => e.entry_date < split)
    const labelByCode = new Map(defectCodes.map((c) => [c.code, c.label]))
    const deptName = new Map(depts.map((d) => [d.id, d.name]))
    const by_team = [...defectByTeam(last7 as SlimOutputEntry[]).entries()]
      .map(([team_id, agg]) => ({
        team_id,
        team_name: team_id === null ? 'Không rõ tổ' : (deptName.get(team_id) ?? '?'),
        qty: agg.qty,
        defect: agg.defect,
        rate: agg.qty > 0 ? agg.defect / agg.qty : 0,
        reasons: topDefectReasons(last7 as SlimOutputEntry[], team_id, labelByCode),
      }))
      .sort((a, b) => b.rate - a.rate)

    return {
      teams,
      wip_strip,
      quality: { last7: defectStats(last7), prev7: defectStats(prev7), by_team },
      supply: {
        late_pos: allPos.rows
          .filter((p) => assessPoLate(p, today) === 'overdue')
          .map((p) => ({
            id: p.id,
            code: p.code,
            supplier_name: p.supplier_name,
            expected_at: p.expected_at,
          })),
        low_stock: lowStock.map((s) => ({
          material_id: s.material_id,
          code: s.code,
          name: s.name,
          on_hand: s.on_hand,
          min_stock: s.min_stock,
          unit: s.unit,
        })),
      },
      incidents: openIncidents.map((i) => ({
        id: i.id,
        message: i.message,
        lsx_code: i.lsx_code,
        stage: i.stage,
        department_name: i.department_name,
        reported_by_name: i.reported_by_name,
        created_at: i.created_at,
      })),
    }
  },
}
