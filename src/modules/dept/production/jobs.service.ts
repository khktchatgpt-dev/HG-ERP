import { jobsRepo, type Job } from './jobs.repo'
import { lsxLinesRepo } from './lsx-lines.repo'
import { productionRepo, type ProductionOrderWithOrders } from './production.repo'
import { componentsRepo } from './components.repo'
import { entriesRepo } from './entries.repo'
import { dayLocksRepo } from './day-locks.repo'
import { transfersRepo } from './transfers.repo'
import { targetsRepo } from './targets.repo'
import {
  deriveDailyTarget,
  forecastFinishDate,
  isTeamStageBottleneck,
  resolveDailyTargets,
  summarizeTeamWip,
  type TeamStageQty,
} from '@/lib/production-summary'
import '@/events/register' // Đăng ký handler event ở lần import đầu tiên.
import { emit } from '@/events/bus'
import { calcComponent } from '@/lib/component-needs'
import { LATE_RISK_HORIZON_DAYS } from '@/lib/late-risk'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

/**
 * CÔNG VIỆC theo tổ (production_jobs — 0084). Vai:
 *  - Tổ trưởng (điện thoại): xem việc tổ mình, đối chiếu số thống kê nhập,
 *    XÁC NHẬN xong công đoạn — service CHẶN khi số chưa đủ (một nguồn sự thật).
 *  - Quản đốc/GĐ: toàn cảnh xưởng, tải việc theo tổ, ép xác nhận kèm lý do.
 * Xác nhận xong → event production.stage.done → notify tổ công đoạn kế tiếp.
 */

const EPS = 1e-9

/** Trễ theo NGÀY XUẤT của lệnh (ship_date): quá hạn / sát hạn (≤7 ngày). */
export function lateByShipDate(
  shipDate: string | null,
  todayIso: string,
): 'overdue' | 'at_risk' | null {
  if (!shipDate) return null
  if (shipDate < todayIso) return 'overdue'
  const horizon = new Date(`${todayIso}T00:00:00Z`)
  horizon.setUTCDate(horizon.getUTCDate() + LATE_RISK_HORIZON_DAYS)
  return shipDate <= horizon.toISOString().slice(0, 10) ? 'at_risk' : null
}

export type JobShortfall = {
  component_id: string
  name: string
  needed: number
  done: number
  missing: number
}

export type JobProgress = {
  /** Tổng cần / đã làm gộp các chi tiết của dòng SP tại công đoạn này. */
  needed: number
  done: number
  /** true = đủ số để xác nhận xong. */
  ready: boolean
  /** Chi tiết còn thiếu (needed > done). */
  shortfalls: JobShortfall[]
  /** false = dòng SP chưa có bảng chi tiết — không đối chiếu được. */
  has_components: boolean
}

export type TeamJobCard = Job & {
  stage_label: string
  lsx_code: string
  order_code: string
  customer_name: string
  ship_date: string | null
  priority: number
  late: 'overdue' | 'at_risk' | null
  product_code: string
  product_name: string
  line_qty: number
  /** File id ảnh SP — page ký URL rồi map sang image_url cho client. */
  image_file_id: string | null
  /** Thông số SX in trên LSX (đã gộp override) — tổ trưởng xem tại thẻ. */
  /** Spec sản xuất của dòng lệnh — bộ khoá theo MẪU CỘT của khách (0114). */
  spec: Record<string, string>
  progress: JobProgress
}

export type StageChip = {
  stage: string
  label: string
  total: number
  done: number
  doing: number
}

/** Tình trạng vật tư của lệnh CHƯA nhận đủ (null = Kho đã xác nhận về đủ). */
export type OverviewMaterials = {
  /** Số vật tư còn thiếu theo v_lsx_material_status (0 = chưa chốt định mức
   *  hoặc chưa bóc được nhu cầu — badge rơi về "Chưa nhận vật tư" như cũ). */
  missing_count: number
  missing_names: string[]
  /** materials_due_at đã quá bao nhiêu ngày (null = chưa quá hẹn / không hẹn). */
  due_overdue_days: number | null
}

export type OverviewRow = {
  /** Σ cần / đã làm (lũy kế, cap theo cần) của MỌI công đoạn — %SL của lệnh. */
  qty_needed: number
  qty_done: number
  /** Ngày DỰ KIẾN xong = còn lại ÷ nhịp 7 ngày có sổ của lệnh; null = chưa có
   *  nhịp hoặc đã đủ số. */
  forecast_date: string | null
  lsx: {
    id: string
    code: string
    /** Mã các đơn lệnh đang chạy (0113 — một lệnh gộp nhiều đơn). */
    order_codes: string[]
    customer_name: string
    status: string
    priority: number
    ship_date: string | null
    materials_received_at: string | null
    late: 'overdue' | 'at_risk' | null
  }
  chips: StageChip[]
  jobs_total: number
  jobs_done: number
  /** Hạn kế hoạch trễ nhất đã quá mà job chưa xong (planned_end < hôm nay). */
  plan_overdue: number
  materials: OverviewMaterials | null
}

export type TeamWorkloadRow = {
  department_id: string
  department_name: string
  todo: number
  doing: number
  done: number
  /** Sổ thống kê HÔM NAY của tổ — SL đạt / phế (entry_date = hôm nay UTC,
   *  cùng quy ước ngày với logbook). */
  today_qty: number
  today_defect: number
  /** Tổ đã chốt sổ hôm nay (production_day_locks). */
  locked_today: boolean
  /** Chỉ tiêu hôm nay của tổ — SUY từ lộ trình (GĐ2 bước 1), 0 = không có
   *  việc nào lên kế hoạch rơi vào hôm nay. */
  today_target: number
  /** Tồn WIP tại tổ = Σ giao − trả − đã làm (kẹp 0 per công đoạn) — GĐ3. */
  wip: number
  /** Nhãn công đoạn đang NGHẼN ở tổ này (tồn > nhịp × ngưỡng). */
  bottleneck_stages: string[]
}

/** 1 dòng màn TIẾN ĐỘ THEO TỔ (/kehoach-sx/theo-to). */
export type TeamProgressRow = {
  department_id: string
  department_name: string
  todo: number
  doing: number
  done: number
  /** Σ cần của các (dòng SP × công đoạn) tổ đang giữ trên lệnh active. */
  needed: number
  done_qty: number
  remaining: number
  pct: number
  forecast_date: string | null
  latest_planned_end: string | null
  /** Dự kiến xong MUỘN hơn hạn kế hoạch muộn nhất của tổ. */
  late_forecast: boolean
}

/** Nhịp sản lượng HÔM NAY toàn xưởng — đọc từ sổ thống kê + khoá sổ. */
export type TodayPulse = {
  date: string
  qty: number
  kg: number
  defect: number
  /** Σ chỉ tiêu hôm nay suy từ lộ trình (deriveDailyTarget) — 0 = chưa lệnh
   *  nào lên kế hoạch. So với `qty` để ra % tiến độ ngày. */
  target: number
  /** Tổ ĐANG HOẠT ĐỘNG: còn việc chưa xong hoặc có ghi sổ hôm nay. */
  teams_active: number
  /** Trong số đó, đã chốt sổ hôm nay. */
  teams_locked: number
}

/**
 * Số ngày ĐÃ QUÁ mốc hẹn, so theo NGÀY (dương = trễ) — null khi chưa quá hạn
 * hoặc không có hẹn. Thuần — có test.
 */
export function overdueDays(dueAt: string | null, todayIso: string): number | null {
  if (!dueAt) return null
  const due = dueAt.slice(0, 10)
  if (due >= todayIso) return null
  return Math.round((Date.parse(todayIso) - Date.parse(due)) / 86_400_000)
}

/** ID Giám đốc/Ban QL (trừ người thao tác) — nhận báo điều phối. */
async function coordinatorIds(excludeId: string): Promise<string[]> {
  const users = await usersRepo.list()
  return users
    .filter((u) => (u.role === 'admin' || u.role === 'manager') && u.id !== excludeId)
    .map((u) => u.id)
}

type ComponentWithQty = Awaited<ReturnType<typeof componentsRepo.listByLsxBulk>>[number]

/**
 * Đối chiếu số của 1 job: các chi tiết dòng SP có đi qua công đoạn (theo lộ
 * trình jobs của dòng, cắt tại final_stage của chi tiết) — needed vs done từ sổ.
 * Thuần — có test.
 */
export function assessJobProgress(
  job: Pick<Job, 'production_order_line_id' | 'stage'>,
  lineStages: string[],
  components: Pick<
    ComponentWithQty,
    | 'id'
    | 'production_order_line_id'
    | 'name'
    | 'qty_per_unit'
    | 'dm_kg'
    | 'pcs_per_bar'
    | 'first_stage'
    | 'final_stage'
    | 'line_qty'
  >[],
  doneByCompStage: Map<string, number>,
): JobProgress {
  const mine = components.filter((c) => {
    if (c.production_order_line_id !== job.production_order_line_id) return false
    if (lineStages.length) {
      const idx = lineStages.indexOf(job.stage)
      // Chi tiết dừng ở final_stage: công đoạn SAU final_stage không tính nó.
      if (c.final_stage) {
        const cut = lineStages.indexOf(c.final_stage)
        if (cut >= 0 && idx > cut) return false
      }
      // Cụm bắt đầu ở first_stage: công đoạn TRƯỚC first_stage không tính nó
      // (0088 — cụm không có mặt ở phôi).
      if (c.first_stage) {
        const startCut = lineStages.indexOf(c.first_stage)
        if (startCut >= 0 && idx >= 0 && idx < startCut) return false
      }
    }
    return true
  })
  let needed = 0
  let done = 0
  const shortfalls: JobShortfall[] = []
  for (const c of mine) {
    const n = calcComponent(
      { qty_per_unit: c.qty_per_unit, dm_kg: c.dm_kg, pcs_per_bar: c.pcs_per_bar },
      c.line_qty,
    ).total_needed
    const d = doneByCompStage.get(`${c.id}|${job.stage}`) ?? 0
    needed += n
    done += d
    if (n - d > EPS) {
      shortfalls.push({
        component_id: c.id,
        name: c.name,
        needed: n,
        done: d,
        missing: Math.round((n - d) * 100) / 100,
      })
    }
  }
  return {
    needed,
    done,
    ready: mine.length > 0 && shortfalls.length === 0,
    shortfalls,
    has_components: mine.length > 0,
  }
}

/** Sổ đã gộp theo (chi tiết | công đoạn) — đầu vào assessJobProgress. */
function aggregateDone(
  entries: { component_id: string; stage: string; qty: number }[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of entries) {
    const k = `${e.component_id}|${e.stage}`
    map.set(k, (map.get(k) ?? 0) + Number(e.qty))
  }
  return map
}

async function loadActiveContext(lsxIds?: string[]) {
  const active = await productionRepo.listActive()
  const scoped = lsxIds ? active.filter((l) => lsxIds.includes(l.id)) : active
  const ids = scoped.map((l) => l.id)
  const [jobs, components, entries] = await Promise.all([
    jobsRepo.listByLsxBulk(ids),
    componentsRepo.listByLsxBulk(ids),
    entriesRepo.listByLsxBulk(ids),
  ])
  return {
    active: scoped,
    jobs,
    components,
    entries,
    doneByCompStage: aggregateDone(entries),
  }
}

function lineStagesOf(jobs: Job[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const j of [...jobs].sort((a, b) => a.seq - b.seq)) {
    const key = `${j.production_order_id}|${j.production_order_line_id}`
    const arr = map.get(key) ?? []
    arr.push(j.stage)
    map.set(key, arr)
  }
  return map
}

export const jobsService = {
  /**
   * Việc của TỔ (màn tổ trưởng — mobile). NV xưởng bị khoá tổ mình;
   * admin/manager (quản đốc) chọn tổ qua opts.team.
   */
  async teamBoard(
    user: User,
    opts: { team?: string } = {},
  ): Promise<{ team_id: string | null; cards: TeamJobCard[] }> {
    await assertAction(user, 'production.team.board')
    const teamId =
      user.role === 'employee' ? (user.department_id ?? null) : (opts.team ?? null)
    if (!teamId) return { team_id: null, cards: [] }

    const [{ active, jobs, components, doneByCompStage }, stages] = await Promise.all([
      loadActiveContext(),
      productionRepo.listStages(),
    ])
    const byLsx = new Map(active.map((l) => [l.id, l]))
    const stagesByLine = lineStagesOf(jobs)
    const today = new Date().toISOString().slice(0, 10)

    // Thông tin dòng SP per lệnh tổ có việc — dùng dòng IN LSX (kèm ảnh +
    // thông số kỹ thuật đã gộp override) để tổ trưởng thấy đúng thứ in trên lệnh.
    const lsxOfTeam = [
      ...new Set(
        jobs
          .filter((j) => j.team_department_id === teamId)
          .map((j) => j.production_order_id),
      ),
    ].filter((id) => byLsx.has(id))
    type LineInfo = {
      product_code: string
      product_name: string
      order_code: string
      qty: number
      image_file_id: string | null
      spec: TeamJobCard['spec']
    }
    const lineInfo = new Map<string, LineInfo>()
    await Promise.all(
      lsxOfTeam.map(async (id) => {
        const [lines, groups] = await Promise.all([
          lsxLinesRepo.listLines(id),
          lsxLinesRepo.listGroups(id),
        ])
        const groupTitle = new Map(groups.map((g) => [g.id, g.title ?? '']))
        for (const l of lines) {
          lineInfo.set(l.id, {
            product_code: l.product_code,
            product_name: l.name_vi ?? l.product_code,
            order_code: groupTitle.get(l.group_id) ?? '',
            qty: l.qty,
            image_file_id: l.image_file_id,
            // Spec của dòng lệnh là bộ cột theo khách → thẻ việc hiện nguyên văn.
            spec: l.specs,
          })
        }
      }),
    )

    const cards: TeamJobCard[] = jobs
      .filter((j) => j.team_department_id === teamId && byLsx.has(j.production_order_id))
      .map((j) => {
        const lsx = byLsx.get(j.production_order_id)!
        const info = lineInfo.get(j.production_order_line_id)
        const lineStages =
          stagesByLine.get(`${j.production_order_id}|${j.production_order_line_id}`) ?? []
        return {
          ...j,
          stage_label: stages.find((s) => s.code === j.stage)?.label ?? j.stage,
          lsx_code: lsx.code,
          // Lệnh gộp nhiều đơn → mã đơn lấy theo DÒNG SP, không theo lệnh (0113).
          order_code: info?.order_code ?? '?',
          customer_name: lsx.customer_name,
          ship_date: lsx.ship_date,
          priority: lsx.priority,
          late: lateByShipDate(lsx.ship_date, today),
          product_code: info?.product_code ?? '?',
          product_name: info?.product_name ?? '?',
          line_qty: info?.qty ?? 0,
          image_file_id: info?.image_file_id ?? null,
          spec: info?.spec ?? {},
          progress: assessJobProgress(j, lineStages, components, doneByCompStage),
        }
      })
      // Ưu tiên lệnh trước, việc chưa xong trước.
      .sort(
        (a, b) =>
          (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) ||
          b.priority - a.priority ||
          (a.ship_date ?? '9999').localeCompare(b.ship_date ?? '9999'),
      )
    return { team_id: teamId, cards }
  },

  /**
   * Toàn cảnh xưởng (quản đốc/GĐ + trang chủ SX) — đọc: mọi NV đã đăng nhập
   * (chủ đích, xem comment page.tsx: menu ẩn theo vai nhưng URL không chặn).
   * GĐ2 cần needed/done per job (chỉ tiêu suy từ lộ trình) nên quay lại
   * loadActiveContext — components + entries bulk giờ ĐƯỢC dùng thật.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async overview(_user: User): Promise<{
    rows: OverviewRow[]
    workload: TeamWorkloadRow[]
    stages: { code: string; label: string }[]
    pulse: TodayPulse
  }> {
    // "Hôm nay" theo UTC-day — CÙNG quy ước với entry_date của sổ thống kê
    // (LogbookScreen), để KPI đọc đúng ngày sổ mà thống kê đang ghi.
    const today = new Date().toISOString().slice(0, 10)
    const [
      { active, jobs, components, entries, doneByCompStage },
      stages,
      todayEntries,
      todayLocks,
      todayTargets,
    ] = await Promise.all([
      loadActiveContext(),
      productionRepo.listStages(),
      entriesRepo.listByDate(today),
      dayLocksRepo.listByDate(today),
      targetsRepo.listByDate(today),
    ])
    const [shortages, transfers] = await Promise.all([
      productionRepo.materialShortagesByLsx(
        active.filter((l) => !l.materials_received_at).map((l) => l.id),
      ),
      transfersRepo.listRawByLsxBulk(active.map((l) => l.id)),
    ])
    const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c

    const jobsByLsx = new Map<string, Job[]>()
    for (const j of jobs) {
      const arr = jobsByLsx.get(j.production_order_id) ?? []
      arr.push(j)
      jobsByLsx.set(j.production_order_id, arr)
    }

    // ── %SL + dự kiến xong per lệnh (plan-hoan-thien-ke-hoach-sx #4/#9) ────
    const stagesByLine = lineStagesOf(jobs)
    const lsxQty = new Map<string, { needed: number; done: number }>()
    for (const j of jobs) {
      const p = assessJobProgress(
        j,
        stagesByLine.get(`${j.production_order_id}|${j.production_order_line_id}`) ?? [],
        components,
        doneByCompStage,
      )
      const acc = lsxQty.get(j.production_order_id) ?? { needed: 0, done: 0 }
      acc.needed += p.needed
      acc.done += Math.min(p.done, p.needed) // làm dư không kéo % lệnh quá 100
      lsxQty.set(j.production_order_id, acc)
    }
    const lsxDaily = new Map<string, Map<string, number>>()
    for (const e of entries) {
      const daily = lsxDaily.get(e.production_order_id) ?? new Map<string, number>()
      daily.set(e.entry_date, (daily.get(e.entry_date) ?? 0) + e.qty)
      lsxDaily.set(e.production_order_id, daily)
    }
    const recentOf = (daily: Map<string, number> | undefined) =>
      daily
        ? [...daily.entries()]
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 7)
            .map(([, q]) => q)
        : []

    const rows: OverviewRow[] = active.map((lsx) => {
      const js = jobsByLsx.get(lsx.id) ?? []
      const byStage = new Map<string, { total: number; done: number; doing: number }>()
      // Giữ thứ tự danh mục cho dải chip.
      for (const s of stages) {
        const mine = js.filter((j) => j.stage === s.code)
        if (!mine.length) continue
        byStage.set(s.code, {
          total: mine.length,
          done: mine.filter((j) => j.status === 'done').length,
          doing: mine.filter((j) => j.status === 'doing').length,
        })
      }
      const qty = lsxQty.get(lsx.id) ?? { needed: 0, done: 0 }
      return {
        qty_needed: Math.round(qty.needed * 100) / 100,
        qty_done: Math.round(qty.done * 100) / 100,
        forecast_date: forecastFinishDate(
          qty.needed - qty.done,
          recentOf(lsxDaily.get(lsx.id)),
          today,
        ),
        lsx: {
          id: lsx.id,
          code: lsx.code,
          order_codes: lsx.order_codes,
          customer_name: lsx.customer_name,
          status: lsx.status,
          priority: lsx.priority,
          ship_date: lsx.ship_date,
          materials_received_at: lsx.materials_received_at,
          late: lateByShipDate(lsx.ship_date, today),
        },
        chips: [...byStage.entries()].map(([stage, v]) => ({
          stage,
          label: labelOf(stage),
          ...v,
        })),
        jobs_total: js.length,
        jobs_done: js.filter((j) => j.status === 'done').length,
        plan_overdue: js.filter(
          (j) => j.status !== 'done' && j.planned_end && j.planned_end < today,
        ).length,
        materials: lsx.materials_received_at
          ? null
          : {
              missing_count: shortages.get(lsx.id)?.missing_count ?? 0,
              missing_names: shortages.get(lsx.id)?.missing_names ?? [],
              due_overdue_days: overdueDays(lsx.materials_due_at, today),
            },
      }
    })

    // Nhịp hôm nay từ sổ thống kê — gom toàn xưởng + per tổ.
    const todayByTeam = new Map<string, { qty: number; defect: number }>()
    let pulseQty = 0
    let pulseKg = 0
    let pulseDefect = 0
    for (const e of todayEntries) {
      pulseQty += e.qty
      pulseKg += e.kg ?? 0
      pulseDefect += e.defect_qty
      if (e.team_department_id) {
        const t = todayByTeam.get(e.team_department_id) ?? { qty: 0, defect: 0 }
        t.qty += e.qty
        t.defect += e.defect_qty
        todayByTeam.set(e.team_department_id, t)
      }
    }
    const lockedTeams = new Set(todayLocks.map((l) => l.team_department_id))

    // ── CHỈ TIÊU HÔM NAY (GĐ2): số SUY từ lộ trình, bị chỉ tiêu THẬT đè ────
    // needed/done per job từ bảng chi tiết; done chỉ tính ĐẾN HẾT HÔM QUA để
    // chỉ tiêu hôm nay không tự teo đi khi tổ ghi sổ trong ngày. (Tổ × công
    // đoạn) có dòng trong production_daily_targets (0168) thì số của Kế hoạch
    // thắng — kể cả 0.
    const doneBeforeToday = aggregateDone(entries.filter((e) => e.entry_date < today))
    const derivedTargets: TeamStageQty[] = []
    for (const j of jobs) {
      if (j.status === 'done') continue
      const lineStages =
        stagesByLine.get(`${j.production_order_id}|${j.production_order_line_id}`) ?? []
      const p = assessJobProgress(j, lineStages, components, doneBeforeToday)
      const t = deriveDailyTarget({
        needQty: p.needed,
        doneQty: p.done,
        plannedStart: j.planned_start,
        plannedEnd: j.planned_end,
        todayIso: today,
      })
      if (t == null || t <= 0) continue
      derivedTargets.push({
        team_department_id: j.team_department_id,
        stage: j.stage,
        qty: t,
      })
    }
    const resolvedTargets = resolveDailyTargets(
      derivedTargets,
      todayTargets.map((t) => ({
        team_department_id: t.team_department_id,
        stage: t.stage,
        qty: t.qty,
      })),
    )
    const planTarget = resolvedTargets.total
    const targetByTeam = resolvedTargets.by_team

    // ── Tồn WIP + nghẽn per (tổ × công đoạn) từ sổ bàn giao (GĐ3) ──────────
    const usedByTS = new Map<string, number>()
    const dailyByTS = new Map<string, Map<string, number>>()
    for (const e of entries) {
      if (!e.team_department_id) continue
      const k = `${e.team_department_id}|${e.stage}`
      usedByTS.set(k, (usedByTS.get(k) ?? 0) + e.qty + e.defect_qty)
      const daily = dailyByTS.get(k) ?? new Map<string, number>()
      daily.set(e.entry_date, (daily.get(e.entry_date) ?? 0) + e.qty)
      dailyByTS.set(k, daily)
    }
    const transfersByTS = new Map<
      string,
      { direction: 'issue' | 'return'; qty: number }[]
    >()
    const lastIssueByTS = new Map<string, string>()
    for (const t of transfers) {
      const k = `${t.team_department_id}|${t.stage}`
      const arr = transfersByTS.get(k) ?? []
      arr.push({ direction: t.direction, qty: t.qty })
      transfersByTS.set(k, arr)
      if (t.direction === 'issue') {
        const cur = lastIssueByTS.get(k)
        if (!cur || t.entry_date > cur) lastIssueByTS.set(k, t.entry_date)
      }
    }
    const daysAgo = (iso: string) =>
      Math.round((Date.parse(today) - Date.parse(iso)) / 86_400_000)
    const wipByTeam = new Map<string, number>()
    const bottleneckByTeam = new Map<string, string[]>()
    for (const [k, list] of transfersByTS) {
      const [teamId, stage] = k.split('|')
      const wip = summarizeTeamWip(list, usedByTS.get(k) ?? 0)
      const avail = Math.max(wip.available, 0)
      wipByTeam.set(teamId, (wipByTeam.get(teamId) ?? 0) + avail)
      const daily = dailyByTS.get(k)
      // 7 ngày CÓ ghi sổ gần nhất — ngày trống không kéo tụt nhịp.
      const recentDaily = daily
        ? [...daily.entries()]
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 7)
            .map(([, q]) => q)
        : []
      const lastActivity = daily ? [...daily.keys()].sort().at(-1) : lastIssueByTS.get(k)
      const idleDays = lastActivity ? daysAgo(lastActivity) : 0
      if (isTeamStageBottleneck(avail, recentDaily, idleDays)) {
        const arr = bottleneckByTeam.get(teamId) ?? []
        arr.push(labelOf(stage))
        bottleneckByTeam.set(teamId, arr)
      }
    }

    // Tải việc theo tổ (mọi tổ có job trên lệnh đang chạy).
    const byTeam = new Map<string, TeamWorkloadRow>()
    for (const j of jobs) {
      if (!j.team_department_id) continue
      const row = byTeam.get(j.team_department_id) ?? {
        department_id: j.team_department_id,
        department_name: j.team_name ?? '?',
        todo: 0,
        doing: 0,
        done: 0,
        today_qty: todayByTeam.get(j.team_department_id)?.qty ?? 0,
        today_defect: todayByTeam.get(j.team_department_id)?.defect ?? 0,
        locked_today: lockedTeams.has(j.team_department_id),
        today_target: Math.round(targetByTeam.get(j.team_department_id) ?? 0),
        wip: Math.round((wipByTeam.get(j.team_department_id) ?? 0) * 100) / 100,
        bottleneck_stages: bottleneckByTeam.get(j.team_department_id) ?? [],
      }
      row[j.status] += 1
      byTeam.set(j.team_department_id, row)
    }
    const workload = [...byTeam.values()]

    // Tổ ĐANG HOẠT ĐỘNG = còn việc chưa xong HOẶC có ghi sổ hôm nay — mẫu số
    // của "Tổ chốt sổ x/y" (tổ hết việc từ tuần trước không bị đòi chốt sổ).
    const activeTeamIds = new Set<string>([
      ...workload.filter((w) => w.todo + w.doing > 0).map((w) => w.department_id),
      ...todayByTeam.keys(),
    ])
    const pulse: TodayPulse = {
      date: today,
      qty: pulseQty,
      kg: Math.round(pulseKg * 10) / 10,
      defect: pulseDefect,
      target: Math.round(planTarget),
      teams_active: activeTeamIds.size,
      teams_locked: [...activeTeamIds].filter((id) => lockedTeams.has(id)).length,
    }

    return { rows, workload, stages, pulse }
  },

  /**
   * TIẾN ĐỘ THEO TỔ (plan-hoan-thien-ke-hoach-sx #5): per tổ trên các lệnh
   * đang chạy — KH (Σ cần các công đoạn tổ giữ), đã làm, còn, %, nhịp, DỰ
   * KIẾN xong so hạn muộn nhất. Đọc: mọi NV (màn tra cứu của Kế hoạch).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async teamProgress(_user: User): Promise<{ rows: TeamProgressRow[] }> {
    const today = new Date().toISOString().slice(0, 10)
    const { jobs, components, entries, doneByCompStage } = await loadActiveContext()
    const stagesByLine = lineStagesOf(jobs)

    type Acc = TeamProgressRow & { daily: Map<string, number> }
    const byTeam = new Map<string, Acc>()
    const ensure = (j: Job): Acc => {
      const cur = byTeam.get(j.team_department_id!)
      if (cur) return cur
      const row: Acc = {
        department_id: j.team_department_id!,
        department_name: j.team_name ?? '?',
        todo: 0,
        doing: 0,
        done: 0,
        needed: 0,
        done_qty: 0,
        remaining: 0,
        pct: 0,
        forecast_date: null,
        latest_planned_end: null,
        late_forecast: false,
        daily: new Map(),
      }
      byTeam.set(j.team_department_id!, row)
      return row
    }
    for (const j of jobs) {
      if (!j.team_department_id) continue
      const acc = ensure(j)
      acc[j.status] += 1
      const p = assessJobProgress(
        j,
        stagesByLine.get(`${j.production_order_id}|${j.production_order_line_id}`) ?? [],
        components,
        doneByCompStage,
      )
      acc.needed += p.needed
      acc.done_qty += Math.min(p.done, p.needed)
      if (j.status !== 'done' && j.planned_end) {
        const end = j.planned_end.slice(0, 10)
        if (!acc.latest_planned_end || end > acc.latest_planned_end) {
          acc.latest_planned_end = end
        }
      }
    }
    for (const e of entries) {
      if (!e.team_department_id) continue
      const acc = byTeam.get(e.team_department_id)
      if (!acc) continue
      acc.daily.set(e.entry_date, (acc.daily.get(e.entry_date) ?? 0) + e.qty)
    }
    const r2 = (n: number) => Math.round(n * 100) / 100
    const rows = [...byTeam.values()].map(({ daily, ...row }) => {
      const recent = [...daily.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 7)
        .map(([, q]) => q)
      const remaining = Math.max(row.needed - row.done_qty, 0)
      const forecast = forecastFinishDate(remaining, recent, today)
      return {
        ...row,
        needed: r2(row.needed),
        done_qty: r2(row.done_qty),
        remaining: r2(remaining),
        pct: row.needed > 0 ? Math.min(row.done_qty / row.needed, 1) : 0,
        forecast_date: forecast,
        late_forecast:
          !!forecast && !!row.latest_planned_end && forecast > row.latest_planned_end,
      }
    })
    // Tổ chậm nhịp nhất lên đầu để Kế hoạch nhìn thấy trước.
    rows.sort((a, b) => a.pct - b.pct)
    return { rows }
  },

  /** Tổ đánh dấu BẮT ĐẦU (tuỳ chọn — có sổ là tự doing rồi). */
  async start(user: User, jobId: string): Promise<Job> {
    const job = await this.assertJobActor(user, jobId)
    if (job.status !== 'todo') return job
    return jobsRepo.patch(jobId, { status: 'doing' })
  },

  /**
   * XÁC NHẬN XONG công đoạn — điểm bàn giao. CHẶN khi số thống kê nhập chưa đủ
   * so với bảng chi tiết (hoặc dòng SP chưa có bảng chi tiết). Admin/manager
   * được ép qua (override) kèm lý do — ghi vào note.
   */
  async confirmDone(
    user: User,
    jobId: string,
    opts: { override?: boolean; note?: string | null } = {},
  ): Promise<Job> {
    const job = await this.assertJobActor(user, jobId)
    if (job.status === 'done') return job

    const { components, doneByCompStage, jobs } = await loadActiveContext([
      job.production_order_id,
    ])
    const lineStages =
      lineStagesOf(jobs).get(
        `${job.production_order_id}|${job.production_order_line_id}`,
      ) ?? []
    const progress = assessJobProgress(job, lineStages, components, doneByCompStage)

    if (!progress.ready) {
      if (!opts.override) {
        const detail = progress.has_components
          ? progress.shortfalls
              .map((s) => `${s.name}: còn thiếu ${s.missing} (đã ${s.done}/${s.needed})`)
              .join('; ')
          : 'dòng SP chưa có bảng chi tiết để đối chiếu'
        throw BadRequest(
          `Chưa đủ số để xong công đoạn — ${detail}. Nhờ thống kê ghi sổ đủ, hoặc Ban quản lý ép xác nhận kèm lý do.`,
          'JOB_NOT_READY',
        )
      }
      if (user.role !== 'admin' && user.role !== 'manager') {
        throw Forbidden('Chỉ Ban quản lý được ép xác nhận khi chưa đủ số')
      }
      if (!opts.note?.trim()) {
        throw BadRequest('Ép xác nhận phải ghi lý do')
      }
    }

    const done = await jobsRepo.patch(jobId, {
      status: 'done',
      done_by: user.id,
      done_at: new Date().toISOString(),
      note: opts.note?.trim()
        ? `${opts.override && !progress.ready ? '[ép xác nhận] ' : ''}${opts.note.trim()}`
        : job.note,
    })

    // Bàn giao: báo tổ giữ công đoạn KẾ TIẾP trên lộ trình dòng SP + quản đốc.
    const lsx = (await productionRepo.findById(
      job.production_order_id,
    )) as ProductionOrderWithOrders
    const stages = await productionRepo.listStages()
    const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c
    const next = jobs
      .filter(
        (j) =>
          j.production_order_line_id === job.production_order_line_id &&
          j.seq > job.seq &&
          j.status !== 'done',
      )
      .sort((a, b) => a.seq - b.seq)[0]
    let notifyNext: string[] = []
    if (next?.team_department_id) {
      const users = await usersRepo.list()
      notifyNext = users
        .filter((u) => u.department_id === next.team_department_id)
        .map((u) => u.id)
    }
    await emit({
      name: 'production.stage.done',
      production_order_id: job.production_order_id,
      code: lsx?.code ?? '?',
      stage: job.stage,
      stage_label: labelOf(job.stage),
      next_stages: next ? [next.stage] : [],
      next_stage_labels: next ? [labelOf(next.stage)] : [],
      done_by: user.id,
      notify_next_ids: notifyNext,
      coordinator_ids: await coordinatorIds(user.id),
    })
    return done
  },

  /** Tổ trưởng sửa ghi chú việc của tổ mình (yêu cầu: sửa được thông tin/ghi chú). */
  async updateNote(user: User, jobId: string, note: string | null): Promise<Job> {
    await this.assertJobActor(user, jobId)
    return jobsRepo.patch(jobId, { note })
  },

  /**
   * Guard chung thao tác trên job: quyền jobs.confirm + row-level "đúng tổ
   * mình" cho NV xưởng; lệnh phải đang chạy.
   */
  async assertJobActor(user: User, jobId: string): Promise<Job> {
    await assertAction(user, 'production.jobs.confirm')
    const job = await jobsRepo.findById(jobId)
    if (!job) throw NotFound('Công việc không tồn tại')
    if (user.role === 'employee') {
      if (!job.team_department_id || job.team_department_id !== user.department_id) {
        throw Forbidden('Chỉ thao tác được việc tổ mình phụ trách')
      }
    }
    const lsx = await productionRepo.findById(job.production_order_id)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status !== 'approved' && lsx.status !== 'in_progress') {
      throw BadRequest('LSX không ở trạng thái đang chạy')
    }
    return job
  },
}
