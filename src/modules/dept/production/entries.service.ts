import { entriesRepo, type ProductionEntry } from './entries.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { jobsRepo, type Job } from './jobs.repo'
import { dayLocksRepo } from './day-locks.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { lsxLinesRepo } from './lsx-lines.repo'
import { calcComponent } from '@/lib/component-needs'
import {
  assemblyWipWarning,
  backflushKg,
  overrunWarning,
  summarizeComponent,
  stageChainWarning,
  summarizeTeamWip,
  syncedSets,
  teamWipShortageWarning,
  type ComponentSummary,
} from '@/lib/production-summary'
import { transfersRepo } from './transfers.repo'
import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'

/**
 * SỔ SỐ LIỆU sản xuất (thống kê xưởng nhập tập trung — 0084). Nguồn SỐ duy
 * nhất; trạng thái nằm ở production_jobs:
 *  - có sản lượng đầu tiên ở (dòng SP × công đoạn) → job todo tự nhích doing;
 *  - lần ghi đầu của lệnh approved → lệnh in_progress + đơn in_production.
 * Nhập vượt tổng cần KHÔNG chặn — trả warnings (FR-PR-07 giữ lại).
 */

type RecordInput = {
  stage: string
  entry_date: string
  team_department_id?: string | null
  entries: {
    component_id: string
    qty: number
    kg?: number | null
    defect_qty?: number
    defect_reason?: string | null
    machine_note?: string | null
    worker_name?: string | null
    finish_state?: 'tran' | 'dang_may' | null
    note?: string | null
  }[]
}

export type ComponentOutputView = {
  id: string
  order_line_id: string
  /** 'part' = chi tiết (đếm ở phôi); 'assembly' = cụm (đếm từ hàn — 0088). */
  kind: 'part' | 'assembly'
  cluster: string | null
  name: string
  total_needed: number
  /** ĐM kg/đơn vị — lưới nhập gợi ý kg = ĐM × SL (0090). */
  dm_kg: number | null
  /** Lộ trình công đoạn của dòng SP (jobs theo seq); null = chưa lên kế hoạch. */
  allowed_stages: string[] | null
  summary: ComponentSummary
}

async function loadLsxContext(lsxId: string) {
  const lsx = await productionRepo.findById(lsxId)
  if (!lsx) throw NotFound('LSX không tồn tại')
  const [components, orderLines, groups, jobs] = await Promise.all([
    componentsRepo.listByLsx(lsxId),
    lsxLinesRepo.listLines(lsxId),
    lsxLinesRepo.listGroups(lsxId),
    jobsRepo.listByLsx(lsxId),
  ])
  // Dòng lệnh thuộc NHÓM, nhóm mới gắn đơn (0114) → tra đơn qua nhóm.
  const orderIdByGroup = new Map(groups.map((g) => [g.id, g.sales_order_id]))
  const qtyByLine = new Map(orderLines.map((l) => [l.id, l.qty]))
  const totalByComponent = new Map(
    components.map((c) => [
      c.id,
      calcComponent(
        { qty_per_unit: c.qty_per_unit, dm_kg: c.dm_kg, pcs_per_bar: c.pcs_per_bar },
        qtyByLine.get(c.production_order_line_id) ?? 0,
      ).total_needed,
    ]),
  )
  // Lộ trình CÓ THỨ TỰ per dòng SP = jobs theo seq (thay bảng routes cũ).
  const routeByLine = new Map<string, string[]>()
  for (const j of [...jobs].sort((a, b) => a.seq - b.seq)) {
    const arr = routeByLine.get(j.production_order_line_id) ?? []
    arr.push(j.stage)
    routeByLine.set(j.production_order_line_id, arr)
  }
  return {
    lsx,
    components,
    orderLines,
    orderIdByGroup,
    jobs,
    totalByComponent,
    routeByLine,
  }
}

export const entriesService = {
  /**
   * Nhập sổ theo LÔ (1 công đoạn + 1 ngày + 1 tổ, nhiều chi tiết).
   * Công đoạn phải thuộc kế hoạch của dòng SP (dòng chưa lên KH → nhập tự do).
   */
  async record(
    user: User,
    lsxId: string,
    input: RecordInput,
  ): Promise<{ warnings: string[] }> {
    await assertAction(user, 'production.entries.record')
    const { lsx, components, orderLines, orderIdByGroup, totalByComponent, routeByLine } =
      await loadLsxContext(lsxId)
    if (lsx.status !== 'approved' && lsx.status !== 'in_progress') {
      throw BadRequest('Chỉ nhập sổ cho LSX đã duyệt / đang sản xuất')
    }
    const byId = new Map(components.map((c) => [c.id, c]))
    for (const e of input.entries) {
      if (!byId.has(e.component_id)) {
        throw BadRequest('Có dòng sổ gắn chi tiết không thuộc lệnh này')
      }
    }

    // Chốt sổ: tổ đã chốt ngày này → cấm ghi thêm, quản lý mở khoá trước.
    const team = input.team_department_id ?? user.department_id ?? null
    if (team) {
      const lock = await dayLocksRepo.find(team, input.entry_date)
      if (lock) {
        throw BadRequest(
          `Sổ ngày ${input.entry_date} của tổ đã chốt — nhờ quản lý mở khoá trước khi ghi thêm`,
        )
      }
    }

    // Công đoạn nhập ∈ kế hoạch của dòng SP chứa chi tiết (dòng chưa lên KH
    // thì nhập tự do — cùng chính sách lệnh cũ).
    for (const e of input.entries) {
      const comp = byId.get(e.component_id)!
      const route = routeByLine.get(comp.production_order_line_id)
      if (route && !route.includes(input.stage)) {
        throw BadRequest(
          `Chi tiết "${comp.name}" không đi qua công đoạn này theo kế hoạch — kiểm tra lại hoặc sửa kế hoạch ở màn Kế hoạch SX`,
        )
      }
    }

    // Cảnh báo vượt: đã làm hiện có + sắp nhập > tổng cần (không chặn).
    const existing = await entriesRepo.listByLsx(lsxId)
    const doneByCompStage = new Map<string, number>()
    for (const en of existing) {
      const k = `${en.component_id}|${en.stage}`
      doneByCompStage.set(k, (doneByCompStage.get(k) ?? 0) + Number(en.qty))
    }
    // Đã dùng đầu vào per (chi tiết × công đoạn × tổ) — phế cũng ăn đầu vào.
    const usedByTriple = new Map<string, number>()
    for (const en of existing) {
      if (!en.team_department_id) continue
      const k = `${en.component_id}|${en.stage}|${en.team_department_id}`
      usedByTriple.set(
        k,
        (usedByTriple.get(k) ?? 0) + Number(en.qty) + Number(en.defect_qty),
      )
    }
    const warnings: string[] = []
    for (const e of input.entries) {
      const comp = byId.get(e.component_id)
      if (!comp) continue
      const w = overrunWarning(
        comp.name,
        input.stage,
        doneByCompStage.get(`${e.component_id}|${input.stage}`) ?? 0,
        e.qty,
        totalByComponent.get(e.component_id) ?? 0,
      )
      if (w) warnings.push(w)
    }

    // Cảnh báo WIP LIÊN CẤP (0088): nhập CỤM ở công đoạn ĐẦU của nó (vd hàn) mà
    // số cụm vượt số chi tiết con đã xong ở công đoạn cuối của chúng. Không chặn.
    const addingByComp = new Map<string, number>()
    for (const e of input.entries) {
      addingByComp.set(e.component_id, (addingByComp.get(e.component_id) ?? 0) + e.qty)
    }

    // Cảnh báo WIP ÂM THEO CHUỖI (24/08): công đoạn sau vượt số đã xong công
    // đoạn TRƯỚC của cùng chi tiết. Cần lộ trình dòng để biết công đoạn trước;
    // công đoạn ĐẦU của chính chi tiết/cụm thì bỏ (cụm đã có cảnh báo liên cấp).
    for (const [compId, adding] of addingByComp) {
      const comp = byId.get(compId)!
      const route = routeByLine.get(comp.production_order_line_id)
      if (!route) continue
      const idx = route.indexOf(input.stage)
      if (idx <= 0) continue
      if (comp.first_stage === input.stage) continue
      const prev = route[idx - 1]
      const w = stageChainWarning(
        comp.name,
        input.stage,
        prev,
        doneByCompStage.get(`${compId}|${prev}`) ?? 0,
        doneByCompStage.get(`${compId}|${input.stage}`) ?? 0,
        adding,
      )
      if (w) warnings.push(w)
    }
    for (const [compId, adding] of addingByComp) {
      const asm = byId.get(compId)
      if (!asm || asm.kind !== 'assembly') continue
      // Chỉ đối chiếu tiêu hao chi tiết ở công đoạn đầu của cụm (nơi ghép lại).
      if (asm.first_stage && input.stage !== asm.first_stage) continue
      const assembliesAfter =
        (doneByCompStage.get(`${compId}|${input.stage}`) ?? 0) + adding
      const children = components
        .filter(
          (c) =>
            c.kind !== 'assembly' &&
            c.production_order_line_id === asm.production_order_line_id &&
            c.cluster != null &&
            c.cluster === asm.cluster &&
            c.qty_per_assembly != null &&
            c.final_stage != null,
        )
        .map((c) => ({
          name: c.name,
          qtyPerAssembly: Number(c.qty_per_assembly),
          partDone: doneByCompStage.get(`${c.id}|${c.final_stage}`) ?? 0,
        }))
      const w = assemblyWipWarning(asm.name, assembliesAfter, children)
      if (w) warnings.push(w)
    }

    // Cảnh báo VƯỢT SỐ ĐƯỢC GIAO (0090): tổ có đi qua sổ bàn giao (issued > 0)
    // mà ghi quá available = giao − trả − đã dùng. Không chặn (FR-PR-07).
    if (team) {
      const transfers = await transfersRepo.listRawByLsx(lsxId)
      const byTriple = new Map<string, { direction: 'issue' | 'return'; qty: number }[]>()
      for (const t of transfers) {
        const k = `${t.component_id}|${t.stage}|${t.team_department_id}`
        const arr = byTriple.get(k) ?? []
        arr.push(t)
        byTriple.set(k, arr)
      }
      for (const [compId, addingQty] of addingByComp) {
        const k = `${compId}|${input.stage}|${team}`
        const same = byTriple.get(k)
        if (!same?.length) continue
        const addingDefect = input.entries
          .filter((e) => e.component_id === compId)
          .reduce((a, e) => a + (e.defect_qty ?? 0), 0)
        const wip = summarizeTeamWip(same, usedByTriple.get(k) ?? 0)
        const w = teamWipShortageWarning(
          byId.get(compId)!.name,
          input.stage,
          wip,
          addingQty + addingDefect,
        )
        if (w) warnings.push(w)
      }
    }

    await entriesRepo.insertMany(
      input.entries.map((e) => ({
        production_order_id: lsxId,
        component_id: e.component_id,
        stage: input.stage,
        team_department_id: team,
        entry_date: input.entry_date,
        qty: e.qty,
        // Bỏ trống kg → backflush ĐM × SL (Excel cũng tính, không nhập tay).
        kg: backflushKg(e.kg, byId.get(e.component_id)!.dm_kg, e.qty),
        defect_qty: e.defect_qty ?? 0,
        defect_reason: (e.defect_qty ?? 0) > 0 ? (e.defect_reason ?? null) : null,
        machine_note: e.machine_note ?? null,
        worker_name: e.worker_name ?? null,
        finish_state: e.finish_state ?? null,
        note: e.note ?? null,
        created_by: user.id,
      })),
    )

    // Job (dòng SP × công đoạn) tự nhích todo → doing khi có số đầu tiên.
    const affectedLines = new Set(
      input.entries.map((e) => byId.get(e.component_id)!.production_order_line_id),
    )
    await Promise.all(
      [...affectedLines].map((lineId) => jobsRepo.markDoing(lsxId, lineId, input.stage)),
    )

    // Lần ghi sổ đầu tiên của lệnh đã duyệt → lệnh sang "đang sản xuất".
    if (lsx.status === 'approved') {
      await productionRepo.patch(lsxId, { status: 'in_progress' })
    }
    // Lệnh gộp nhiều đơn (0113): chỉ ĐƠN có dòng vừa được ghi sổ mới sang "đang
    // sản xuất" — đơn cùng lệnh nhưng chưa ai làm thì vẫn là "đã phát lệnh".
    const orderIdsOfLines = new Set(
      orderLines
        .filter((l) => affectedLines.has(l.id))
        .map((l) => orderIdByGroup.get(l.group_id))
        .filter((x): x is string => !!x),
    )
    const started = await ordersRepo.listByProductionOrder(lsxId)
    await Promise.all(
      started
        .filter((o) => orderIdsOfLines.has(o.id) && o.status === 'lsx_issued')
        .map((o) => ordersRepo.patch(o.id, { status: 'in_production' })),
    )
    return { warnings }
  },

  /**
   * Tổng hợp per chi tiết × công đoạn + đồng bộ per SP + sổ nhập + jobs —
   * một payload cho màn hồ sơ lệnh/bảng tổng. Đọc: mọi NV đã đăng nhập.
   */
  async summary(_user: User, lsxId: string) {
    const {
      components,
      orderLines,
      orderIdByGroup,
      jobs,
      totalByComponent,
      routeByLine,
    } = await loadLsxContext(lsxId)
    const [entries, stages] = await Promise.all([
      entriesRepo.listByLsx(lsxId),
      productionRepo.listStages(),
    ])
    // Fallback khi dòng chưa lên kế hoạch (nhập tự do) — thứ tự danh mục.
    const stageOrder = stages.map((s) => s.code)

    // Gộp sản lượng theo (chi tiết, công đoạn).
    const agg = new Map<string, Map<string, { done: number; defect: number }>>()
    for (const en of entries) {
      const perStage = agg.get(en.component_id) ?? new Map()
      const cur = perStage.get(en.stage) ?? { done: 0, defect: 0 }
      cur.done += Number(en.qty)
      cur.defect += Number(en.defect_qty)
      perStage.set(en.stage, cur)
      agg.set(en.component_id, perStage)
    }

    const views: ComponentOutputView[] = components.map((c) => {
      const perStage = agg.get(c.id) ?? new Map()
      const outputs = [...perStage.entries()].map(([stage, v]) => ({
        stage,
        done: v.done,
        defect: v.defect,
      }))
      const route = routeByLine.get(c.production_order_line_id) ?? null
      return {
        id: c.id,
        order_line_id: c.production_order_line_id,
        kind: c.kind,
        cluster: c.cluster,
        name: c.name,
        total_needed: totalByComponent.get(c.id) ?? 0,
        dm_kg: c.dm_kg,
        allowed_stages: route,
        summary: summarizeComponent(
          totalByComponent.get(c.id) ?? 0,
          route ?? stageOrder,
          outputs,
          c.final_stage,
          c.first_stage,
        ),
      }
    })

    // Đồng bộ per dòng SP: min theo bộ phận "đầu ra cuối" của floor(done_final /
    // đơn-vị-trên-SP). Chỉ tính component TOP-LEVEL (cụm + chi tiết KHÔNG bị gộp
    // vào cụm) — chi tiết đã hàn thành cụm thì cụm quyết định đồng bộ, không đếm
    // trùng (0088). Lệnh không có cụm → mọi chi tiết đều top-level = như cũ.
    const synced = orderLines.map((l) => {
      const lineComps = components.filter((c) => c.production_order_line_id === l.id)
      const assemblyClusters = new Set(
        lineComps.filter((c) => c.kind === 'assembly' && c.cluster).map((c) => c.cluster),
      )
      const comps = lineComps
        .filter(
          (c) =>
            c.kind === 'assembly' ||
            !(c.cluster != null && assemblyClusters.has(c.cluster)),
        )
        .map((c) => ({
          qty_per_unit: c.qty_per_unit,
          done_final: views.find((v) => v.id === c.id)?.summary.done_final ?? 0,
        }))
      return {
        order_line_id: l.id,
        /** Đơn chứa dòng — lệnh gộp nhiều đơn nên %HT tách được theo đơn (0113). */
        order_id: orderIdByGroup.get(l.group_id) ?? '',
        product_code: l.product_code,
        product_name: l.name_vi ?? l.product_code,
        qty: l.qty,
        synced_sets: comps.length ? syncedSets(comps) : 0,
        has_components: lineComps.length > 0,
      }
    })

    return {
      stages,
      components: views,
      synced_by_line: synced,
      entries,
      jobs,
    }
  },

  /** Sổ toàn xưởng 1 ngày + trạng thái chốt — đọc: mọi NV đã đăng nhập. */
  async listDay(_user: User, date: string) {
    const [entries, locks] = await Promise.all([
      entriesRepo.listByDate(date),
      dayLocksRepo.listByDate(date),
    ])
    return { entries, locks }
  },

  /** Xoá bản ghi nhập nhầm: người tạo hoặc GĐ/QL; lệnh đã kết thúc thì khoá. */
  async deleteEntry(user: User, entryId: string): Promise<void> {
    const entry = await entriesRepo.findById(entryId)
    if (!entry) throw NotFound('Bản ghi sổ không tồn tại')
    const allowed =
      user.role === 'admin' || user.role === 'manager' || entry.created_by === user.id
    if (!allowed) throw Forbidden('Chỉ người nhập hoặc Ban quản lý xoá được bản ghi')
    // Ngày đã chốt thì cấm xoá KỂ CẢ admin — mở khoá trước (giữ vết ai mở).
    if (entry.team_department_id) {
      const lock = await dayLocksRepo.find(entry.team_department_id, entry.entry_date)
      if (lock) {
        throw BadRequest('Sổ ngày của tổ đã chốt — mở khoá trước khi xoá bản ghi')
      }
    }
    const lsx = await productionRepo.findById(entry.production_order_id)
    if (lsx && (lsx.status === 'completed' || lsx.status === 'cancelled')) {
      throw BadRequest('LSX đã kết thúc — sổ khoá')
    }
    await entriesRepo.delete(entryId)
  },

  /**
   * Chốt sổ cuối ngày theo tổ. NV xưởng bị ép tổ mình; GĐ/QL chốt hộ tổ
   * chỉ định. Đã chốt rồi → Conflict.
   */
  async lockDay(
    user: User,
    input: { entry_date: string; team_department_id?: string | null },
  ): Promise<void> {
    await assertAction(user, 'production.daylock.lock')
    let team = input.team_department_id ?? user.department_id ?? null
    if (user.role === 'employee') team = user.department_id ?? null
    if (!team) throw BadRequest('Chưa xác định được tổ để chốt sổ')
    const { duplicate } = await dayLocksRepo.insert({
      team_department_id: team,
      entry_date: input.entry_date,
      locked_by: user.id,
    })
    if (duplicate) throw Conflict('Tổ đã chốt sổ ngày này', 'DAY_LOCKED')
  },

  /** Mở lại sổ ngày (GĐ/QL) — để sửa nhầm lẫn có kiểm soát. */
  async unlockDay(user: User, teamId: string, date: string): Promise<void> {
    await assertAction(user, 'production.daylock.unlock')
    await dayLocksRepo.deleteByTeamDate(teamId, date)
  },
}

export type { ProductionEntry, Job }
