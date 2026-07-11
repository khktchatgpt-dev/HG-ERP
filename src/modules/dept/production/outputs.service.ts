import { outputsRepo, type OutputEntry } from './outputs.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { isProductionStaff } from './production.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { calcComponent } from '@/lib/component-needs'
import {
  overrunWarning,
  summarizeComponent,
  syncedSets,
  type ComponentSummary,
} from '@/lib/production-summary'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

/**
 * Sản lượng hằng ngày theo công đoạn/tổ (SX-P3 — FR-PR). Ai nhập: xưởng
 * (thống kê tổ), KH-CƯ (bấm thay), GĐ/QL — khớp canTrackProgress.
 */
async function canRecordOutput(user: User): Promise<boolean> {
  return (
    user.role === 'admin' ||
    user.role === 'manager' ||
    (await isSupplyStaff(user)) ||
    (await isProductionStaff(user))
  )
}

type RecordInput = {
  stage: string
  entry_date: string
  team_department_id?: string | null
  entries: {
    component_id: string
    qty: number
    kg?: number | null
    defect_qty?: number
    machine_note?: string | null
    note?: string | null
  }[]
}

export type ComponentOutputView = {
  id: string
  order_line_id: string
  cluster: string | null
  name: string
  total_needed: number
  summary: ComponentSummary
}

async function loadLsxContext(lsxId: string) {
  const lsx = await productionRepo.findById(lsxId)
  if (!lsx) throw NotFound('LSX không tồn tại')
  const [components, orderLines] = await Promise.all([
    componentsRepo.listByLsx(lsxId),
    ordersRepo.listLines(lsx.sales_order_id),
  ])
  const qtyByLine = new Map(orderLines.map((l) => [l.id, l.qty]))
  const totalByComponent = new Map(
    components.map((c) => [
      c.id,
      calcComponent(
        { qty_per_unit: c.qty_per_unit, dm_kg: c.dm_kg, pcs_per_bar: c.pcs_per_bar },
        qtyByLine.get(c.order_line_id) ?? 0,
      ).total_needed,
    ]),
  )
  return { lsx, components, orderLines, totalByComponent }
}

export const outputsService = {
  /**
   * Nhập sản lượng theo LÔ (1 công đoạn + 1 ngày + 1 tổ, nhiều chi tiết).
   * FR-PR-07: nhập vượt tổng cần KHÔNG chặn — trả warnings để UI hiện.
   */
  async record(
    user: User,
    lsxId: string,
    input: RecordInput,
  ): Promise<{ warnings: string[] }> {
    if (!(await canRecordOutput(user))) {
      throw Forbidden('Chỉ Xưởng / Kế hoạch - Cung ứng / Ban quản lý nhập sản lượng')
    }
    const { lsx, components, totalByComponent } = await loadLsxContext(lsxId)
    if (lsx.status !== 'approved' && lsx.status !== 'in_progress') {
      throw BadRequest('Chỉ nhập sản lượng cho LSX đã duyệt / đang sản xuất')
    }
    const byId = new Map(components.map((c) => [c.id, c]))
    for (const e of input.entries) {
      if (!byId.has(e.component_id)) {
        throw BadRequest('Có dòng sản lượng gắn chi tiết không thuộc lệnh này')
      }
    }

    // Cảnh báo vượt: đã làm hiện có + sắp nhập > tổng cần (không chặn — FR-PR-07).
    const existing = await outputsRepo.listByLsx(lsxId)
    const doneByCompStage = new Map<string, number>()
    for (const en of existing) {
      const k = `${en.component_id}|${en.stage}`
      doneByCompStage.set(k, (doneByCompStage.get(k) ?? 0) + Number(en.qty))
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

    await outputsRepo.insertMany(
      input.entries.map((e) => ({
        production_order_id: lsxId,
        component_id: e.component_id,
        stage: input.stage,
        team_department_id: input.team_department_id ?? user.department_id ?? null,
        entry_date: input.entry_date,
        qty: e.qty,
        kg: e.kg ?? null,
        defect_qty: e.defect_qty ?? 0,
        machine_note: e.machine_note ?? null,
        note: e.note ?? null,
        created_by: user.id,
      })),
    )
    return { warnings }
  },

  /**
   * Tổng hợp per chi tiết × công đoạn + đồng bộ per SP (FR-PR-04/05/06)
   * + sổ nhập gần nhất. Đọc: mọi NV đã đăng nhập.
   */
  async summary(_user: User, lsxId: string) {
    const { components, orderLines, totalByComponent } = await loadLsxContext(lsxId)
    const [entries, stages] = await Promise.all([
      outputsRepo.listByLsx(lsxId),
      productionRepo.listStages(),
    ])
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
      return {
        id: c.id,
        order_line_id: c.order_line_id,
        cluster: c.cluster,
        name: c.name,
        total_needed: totalByComponent.get(c.id) ?? 0,
        summary: summarizeComponent(
          totalByComponent.get(c.id) ?? 0,
          stageOrder,
          outputs,
          c.final_stage,
        ),
      }
    })

    // Đồng bộ per dòng SP: min theo chi tiết của floor(done_final / CT-trên-SP).
    const synced = orderLines.map((l) => {
      const comps = components
        .filter((c) => c.order_line_id === l.id)
        .map((c) => ({
          qty_per_unit: c.qty_per_unit,
          done_final: views.find((v) => v.id === c.id)?.summary.done_final ?? 0,
        }))
      return {
        order_line_id: l.id,
        product_code: l.product_code,
        product_name: l.product_name,
        qty: l.qty,
        synced_sets: comps.length ? syncedSets(comps) : 0,
        has_components: comps.length > 0,
      }
    })

    return { stages, components: views, synced_by_line: synced, entries }
  },

  /** Xoá bản ghi nhập nhầm: người tạo hoặc GĐ/QL; lệnh đã kết thúc thì khoá. */
  async deleteEntry(user: User, entryId: string): Promise<void> {
    const entry = await outputsRepo.findById(entryId)
    if (!entry) throw NotFound('Bản ghi sản lượng không tồn tại')
    const allowed =
      user.role === 'admin' || user.role === 'manager' || entry.created_by === user.id
    if (!allowed) throw Forbidden('Chỉ người nhập hoặc Ban quản lý xoá được bản ghi')
    const lsx = await productionRepo.findById(entry.production_order_id)
    if (lsx && (lsx.status === 'completed' || lsx.status === 'cancelled')) {
      throw BadRequest('LSX đã kết thúc — sổ sản lượng khoá')
    }
    await outputsRepo.delete(entryId)
  },
}

export type { OutputEntry }
