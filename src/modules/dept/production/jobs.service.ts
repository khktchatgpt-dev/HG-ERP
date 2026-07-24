import { jobsRepo, type Job } from './jobs.repo'
import {
  listLsxPrintLines,
  productionRepo,
  type ProductionOrderWithOrder,
} from './production.repo'
import { componentsRepo } from './components.repo'
import { entriesRepo } from './entries.repo'
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
  spec: { machine: string; cushion: string; paint: string; glass: string; wood: string }
  progress: JobProgress
}

export type StageChip = {
  stage: string
  label: string
  total: number
  done: number
  doing: number
}

export type OverviewRow = {
  lsx: {
    id: string
    code: string
    order_code: string
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
}

export type TeamWorkloadRow = {
  department_id: string
  department_name: string
  todo: number
  doing: number
  done: number
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
  job: Pick<Job, 'order_line_id' | 'stage'>,
  lineStages: string[],
  components: Pick<
    ComponentWithQty,
    | 'id'
    | 'order_line_id'
    | 'name'
    | 'qty_per_unit'
    | 'dm_kg'
    | 'pcs_per_bar'
    | 'final_stage'
    | 'line_qty'
  >[],
  doneByCompStage: Map<string, number>,
): JobProgress {
  const mine = components.filter((c) => {
    if (c.order_line_id !== job.order_line_id) return false
    // Chi tiết dừng ở final_stage: công đoạn SAU final_stage không tính nó.
    if (c.final_stage && lineStages.length) {
      const cut = lineStages.indexOf(c.final_stage)
      const idx = lineStages.indexOf(job.stage)
      if (cut >= 0 && idx > cut) return false
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
  return { active: scoped, jobs, components, doneByCompStage: aggregateDone(entries) }
}

function lineStagesOf(jobs: Job[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const j of [...jobs].sort((a, b) => a.seq - b.seq)) {
    const key = `${j.production_order_id}|${j.order_line_id}`
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
      qty: number
      image_file_id: string | null
      spec: TeamJobCard['spec']
    }
    const lineInfo = new Map<string, LineInfo>()
    await Promise.all(
      lsxOfTeam.map(async (id) => {
        const lines = await listLsxPrintLines(id, byLsx.get(id)!.sales_order_id)
        for (const l of lines) {
          lineInfo.set(l.order_line_id, {
            product_code: l.product_code,
            product_name: l.name_vi,
            qty: l.qty,
            image_file_id: l.image_file_id,
            spec: {
              machine: l.tech_spec.machine ?? '',
              cushion: l.tech_spec.cushion ?? '',
              paint: l.tech_spec.paint ?? '',
              glass: l.tech_spec.glass ?? '',
              wood: l.tech_spec.wood ?? '',
            },
          })
        }
      }),
    )

    const cards: TeamJobCard[] = jobs
      .filter((j) => j.team_department_id === teamId && byLsx.has(j.production_order_id))
      .map((j) => {
        const lsx = byLsx.get(j.production_order_id)!
        const info = lineInfo.get(j.order_line_id)
        const lineStages =
          stagesByLine.get(`${j.production_order_id}|${j.order_line_id}`) ?? []
        return {
          ...j,
          stage_label: stages.find((s) => s.code === j.stage)?.label ?? j.stage,
          lsx_code: lsx.code,
          order_code: lsx.order_code,
          customer_name: lsx.customer_name,
          ship_date: lsx.ship_date,
          priority: lsx.priority,
          late: lateByShipDate(lsx.ship_date, today),
          product_code: info?.product_code ?? '?',
          product_name: info?.product_name ?? '?',
          line_qty: info?.qty ?? 0,
          image_file_id: info?.image_file_id ?? null,
          spec: info?.spec ?? { machine: '', cushion: '', paint: '', glass: '', wood: '' },
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

  /** Toàn cảnh xưởng (quản đốc/GĐ + trang chủ SX) — đọc: mọi NV đã đăng nhập. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async overview(_user: User): Promise<{
    rows: OverviewRow[]
    workload: TeamWorkloadRow[]
    stages: { code: string; label: string }[]
  }> {
    const [{ active, jobs }, stages] = await Promise.all([
      loadActiveContext(),
      productionRepo.listStages(),
    ])
    const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c
    const today = new Date().toISOString().slice(0, 10)

    const jobsByLsx = new Map<string, Job[]>()
    for (const j of jobs) {
      const arr = jobsByLsx.get(j.production_order_id) ?? []
      arr.push(j)
      jobsByLsx.set(j.production_order_id, arr)
    }

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
      return {
        lsx: {
          id: lsx.id,
          code: lsx.code,
          order_code: lsx.order_code,
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
      }
    })

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
      }
      row[j.status] += 1
      byTeam.set(j.team_department_id, row)
    }

    return { rows, workload: [...byTeam.values()], stages }
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
      lineStagesOf(jobs).get(`${job.production_order_id}|${job.order_line_id}`) ?? []
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
    )) as ProductionOrderWithOrder
    const stages = await productionRepo.listStages()
    const labelOf = (c: string) => stages.find((s) => s.code === c)?.label ?? c
    const next = jobs
      .filter(
        (j) =>
          j.order_line_id === job.order_line_id && j.seq > job.seq && j.status !== 'done',
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
