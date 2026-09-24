import { jobsRepo, type Job } from './jobs.repo'
import { resolveHolder, type Holder } from '@/lib/lsx-holder'
import { lsxLinesRepo } from './lsx-lines.repo'
import { withProductImage } from './lsx-lines.service'
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
import { clipRoute, resolveComponentRoute } from '@/lib/stage-route'
import { finishRouteOverride } from '@/lib/finish-stages'
import { LATE_RISK_HORIZON_DAYS } from '@/lib/late-risk'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Forbidden, NotFound } from '@/server/http'
import { vnTodayIso } from '@/lib/local-date'

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
  /**
   * Số dòng CHI TIẾT đã định hình của lệnh (`production_components`).
   *
   * Tách hẳn khỏi `qty_needed`: hai con số này trông giống nhau nhưng trả lời
   * hai câu khác nhau, và gộp chúng là nói dối. `qty_needed` tính từ KẾ HOẠCH
   * (jobs) nên bằng 0 ở mọi lệnh chưa ai lên lộ trình — kể cả lệnh đã định
   * hình 306 chi tiết. Dùng nó để đếm "chưa định hình" thì màn danh sách báo
   * 14/14 lệnh chưa định hình trong khi 7 lệnh đã có 875 dòng (đo 18/09/2026).
   */
  component_count: number
  /**
   * Ai đang giữ lệnh + đã bao lâu (lib/lsx-holder).
   *
   * Tính Ở ĐÂY chứ không đẩy dãy mốc thời gian xuống client: hai màn dùng
   * chung (danh sách + chi tiết) thì phải cùng một câu trả lời, và luật "đã
   * duyệt tách làm hai người giữ" không nên có hai bản.
   */
  holder: Holder
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
  /** Đang chờ sửa (0206) — không nằm trong `qty`, món chưa mất cũng chưa xong. */
  rework: number
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

/**
 * LỘ TRÌNH CỦA DÒNG SP — suy từ CHI TIẾT khi chưa ai lên kế hoạch.
 *
 * VÌ SAO PHẢI CÓ (bug đo 23/09/2026). `lineStagesOf` đọc `production_jobs`, mà
 * cả DB chỉ có **4 dòng jobs**, đều của một lệnh. Nên dải công đoạn ở màn danh
 * sách RỖNG ở 13/14 lệnh, và `qty_needed` bằng 0 ở cả 14 ⇒ cột "Bộ xong" hiện
 * `—` khắp nơi. Trong khi mở đúng lệnh đó ra `/thongke/lsx/[id]` thì có 8 công
 * đoạn × 150 bộ: **một lệnh, hai màn, hai câu trả lời ngược nhau.**
 *
 * Màn chi tiết (`worklist.service`) không đọc jobs — nó suy lộ trình từ
 * `group_code` của chi tiết qua `lib/stage-route`. Hàm này dùng ĐÚNG module đó,
 * nên hai màn có chung MỘT nguồn lộ trình thay vì hai.
 *
 * Kế hoạch vẫn thắng khi có: `resolveComponentRoute` nhận `planned` làm đối số
 * đầu. Suy theo nhóm chỉ là đường lùi cho lệnh chưa lên kế hoạch.
 *
 * GIỚI HẠN CÓ CHỦ ĐÍCH: bốn chặng sau sơn chỉ vào lộ trình khi dòng thành phẩm
 * ĐÃ vật chất hoá (`finishRouteOverride`). `worklist` thì thêm cả bốn cho mọi
 * dòng SP kể cả khi chưa ghi gì. Ở đây không bịa: chip vẽ theo `needed` lấy từ
 * chi tiết có thật, nên thêm một công đoạn không có chi tiết nào chỉ tạo ra ô
 * 0/0 — vô nghĩa hơn là không vẽ. Hệ quả: dải ở màn danh sách có thể NGẮN hơn
 * danh sách công đoạn ở màn chi tiết cho tới khi thống kê ghi mẻ đầu.
 */
function lineStagesFromComponents(
  components: Pick<
    ComponentWithQty,
    | 'production_order_id'
    | 'production_order_line_id'
    | 'group_code'
    | 'kind'
    | 'first_stage'
    | 'final_stage'
  >[],
  planned: Map<string, string[]>,
  stageOrder: Map<string, number>,
): Map<string, string[]> {
  const byLine = new Map<string, Set<string>>()
  for (const c of components) {
    if (!c.production_order_line_id) continue
    const key = `${c.production_order_id}|${c.production_order_line_id}`
    const route =
      finishRouteOverride(c) ??
      clipRoute(
        resolveComponentRoute(planned.get(key), c.group_code),
        c.first_stage,
        c.final_stage,
      )
    if (route.length === 0) continue
    const set = byLine.get(key) ?? new Set<string>()
    for (const s of route) set.add(s)
    byLine.set(key, set)
  }
  const out = new Map<string, string[]>()
  for (const [key, set] of byLine) {
    out.set(
      key,
      [...set].sort((a, b) => (stageOrder.get(a) ?? 99) - (stageOrder.get(b) ?? 99)),
    )
  }
  return out
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
    const today = vnTodayIso()
    // MỘT mốc giờ cho cả lượt tính: mỗi dòng gọi new Date() riêng thì hai lệnh
    // cạnh nhau có thể lệch ngày nếu lượt chạy rơi đúng nửa đêm.
    const nowTs = new Date()

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
          // Thẻ việc của tổ là chỗ ảnh SP có giá trị nhất — công nhân đối chiếu
          // hàng trên tay với ảnh. Dòng lệnh chỉ giữ BẢN CHỤP lúc phát lệnh, nên
          // phải lùi về hồ sơ SP khi bản chụp trống.
          lsxLinesRepo.listLines(id).then(withProductImage),
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
    const today = vnTodayIso()
    // MỘT mốc giờ cho cả lượt tính: gọi `new Date()` riêng ở mỗi dòng thì hai
    // lệnh cạnh nhau có thể lệch một ngày nếu lượt chạy rơi đúng nửa đêm.
    const nowTs = new Date()
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
    //
    // ĐẾM THEO (DÒNG SP × CÔNG ĐOẠN) SUY TỪ CHI TIẾT, không theo `production_jobs`.
    // Lý do đầy đủ ở `lineStagesFromComponents` — tóm tắt: DB có 4 dòng jobs,
    // nên bản cũ trả 0 cho gần như mọi lệnh và cột "Bộ xong" hiện `—` ở 14/14.
    const stageOrder = new Map(stages.map((s, i) => [s.code, i]))
    const stagesByLine = lineStagesFromComponents(
      components,
      lineStagesOf(jobs),
      stageOrder,
    )
    const lsxQty = new Map<string, { needed: number; done: number }>()
    /** (lệnh → công đoạn → cần/đạt), đơn vị chi tiết — nguồn của dải chip. */
    const stageQty = new Map<string, Map<string, { needed: number; done: number }>>()
    for (const [key, lineStages] of stagesByLine) {
      const [lsxId, lineId] = key.split('|')
      for (const stage of lineStages) {
        const p = assessJobProgress(
          { production_order_line_id: lineId, stage },
          lineStages,
          components,
          doneByCompStage,
        )
        if (!p.has_components) continue
        const acc = lsxQty.get(lsxId) ?? { needed: 0, done: 0 }
        acc.needed += p.needed
        acc.done += Math.min(p.done, p.needed) // làm dư không kéo % lệnh quá 100
        lsxQty.set(lsxId, acc)

        const byStage = stageQty.get(lsxId) ?? new Map()
        const s = byStage.get(stage) ?? { needed: 0, done: 0 }
        s.needed += p.needed
        s.done += Math.min(p.done, p.needed)
        byStage.set(stage, s)
        stageQty.set(lsxId, byStage)
      }
    }
    // Đã định hình bao nhiêu dòng chi tiết — đếm thẳng từ `components` đang
    // cầm sẵn, không thêm truy vấn nào.
    const componentCount = new Map<string, number>()
    for (const c of components) {
      componentCount.set(
        c.production_order_id,
        (componentCount.get(c.production_order_id) ?? 0) + 1,
      )
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
      //
      // `total`/`done` nay là SỐ CHI TIẾT cần/đạt, không còn là SỐ JOB. Dải chip
      // vẽ theo tỉ lệ `done/total` nên hình dạng không đổi, nhưng ý nghĩa thì
      // đổi hẳn: trước là "3/5 job đã đánh dấu xong" — một con số do kế hoạch
      // tự khai, không ai ghi sổ cũng thành 100%; nay là phần việc THẬT đã vào
      // sổ. `doing` giữ nguồn jobs vì "đang làm" là trạng thái kế hoạch đặt.
      const qtyByStage = stageQty.get(lsx.id)
      for (const s of stages) {
        const q = qtyByStage?.get(s.code)
        if (!q || q.needed <= 0) continue
        byStage.set(s.code, {
          total: Math.round(q.needed * 100) / 100,
          done: Math.round(q.done * 100) / 100,
          doing: js.filter((j) => j.stage === s.code && j.status === 'doing').length,
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
        component_count: componentCount.get(lsx.id) ?? 0,
        holder: resolveHolder(lsx, nowTs),
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
    let pulseRework = 0
    for (const e of todayEntries) {
      pulseQty += e.qty
      pulseKg += e.kg ?? 0
      pulseDefect += e.defect_qty
      pulseRework += e.rework_qty ?? 0
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
      rework: pulseRework,
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
    const today = vnTodayIso()
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
}
