import { transfersRepo, type Transfer, type TransferJoined } from './transfers.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { entriesRepo } from './entries.repo'
import { jobsRepo } from './jobs.repo'
import { summarizeTeamWip, type TeamWipSummary } from '@/lib/production-summary'
import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Forbidden, NotFound } from '@/server/http'
import type { TransferRecordInput } from './transfers.schema'

/**
 * BÀN GIAO NỘI BỘ (0090) — thống kê ghi "SL giao" phôi/WIP vào tổ theo đợt
 * (như cột SL giao 1..4 của sheet tổ trong Excel). Đối chiếu tồn WIP tại tổ
 * per (chi tiết × công đoạn × tổ) tính ở lib production-summary — sản lượng
 * đã ghi (kể cả phế) trừ dần vào số được giao.
 */

export type TransferTriple = {
  component_id: string
  component_name: string | null
  component_cluster: string | null
  stage: string
  team_department_id: string
  team_name: string | null
  wip: TeamWipSummary
}

/** Gộp đã dùng = Σ(qty + defect) của entries theo khoá comp|stage|team. */
function usedByTriple(
  entries: {
    component_id: string
    stage: string
    team_department_id: string | null
    qty: number
    defect_qty: number
  }[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of entries) {
    if (!e.team_department_id) continue
    const k = `${e.component_id}|${e.stage}|${e.team_department_id}`
    map.set(k, (map.get(k) ?? 0) + Number(e.qty) + Number(e.defect_qty))
  }
  return map
}

export const transfersService = {
  /** Sổ bàn giao + đối chiếu per (chi tiết × công đoạn × tổ). Đọc: mọi NV. */
  async list(
    _user: User,
    lsxId: string,
  ): Promise<{ entries: TransferJoined[]; triples: TransferTriple[] }> {
    const lsx = await productionRepo.findById(lsxId)
    if (!lsx) throw NotFound('LSX không tồn tại')
    const [transfers, produced] = await Promise.all([
      transfersRepo.listByLsx(lsxId),
      entriesRepo.listByLsx(lsxId),
    ])
    const used = usedByTriple(produced)
    const byTriple = new Map<string, TransferJoined[]>()
    for (const t of transfers) {
      const k = `${t.component_id}|${t.stage}|${t.team_department_id}`
      const arr = byTriple.get(k) ?? []
      arr.push(t)
      byTriple.set(k, arr)
    }
    const triples: TransferTriple[] = [...byTriple.entries()].map(([k, list]) => ({
      component_id: list[0].component_id,
      component_name: list[0].component_name,
      component_cluster: list[0].component_cluster,
      stage: list[0].stage,
      team_department_id: list[0].team_department_id,
      team_name: list[0].team_name,
      wip: summarizeTeamWip(list, used.get(k) ?? 0),
    }))
    return { entries: transfers, triples }
  },

  /** Ghi 1 dòng giao/trả lại. Trả warnings (trả lại vượt số đã giao — không chặn). */
  async record(
    user: User,
    lsxId: string,
    input: TransferRecordInput,
  ): Promise<{ warnings: string[] }> {
    await assertAction(user, 'production.transfers.record')
    const lsx = await productionRepo.findById(lsxId)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status !== 'approved' && lsx.status !== 'in_progress') {
      throw BadRequest('Chỉ ghi bàn giao cho LSX đã duyệt / đang sản xuất')
    }
    const components = await componentsRepo.listByLsx(lsxId)
    const comp = components.find((c) => c.id === input.component_id)
    if (!comp) throw BadRequest('Chi tiết không thuộc lệnh này')

    // Công đoạn giao ∈ kế hoạch của dòng SP (dòng chưa lên KH → tự do) — cùng
    // chính sách với sổ sản lượng.
    const jobs = await jobsRepo.listByLsx(lsxId)
    const route = jobs
      .filter((j) => j.production_order_line_id === comp.production_order_line_id)
      .sort((a, b) => a.seq - b.seq)
      .map((j) => j.stage)
    if (route.length > 0 && !route.includes(input.stage)) {
      throw BadRequest(
        `Chi tiết "${comp.name}" không đi qua công đoạn này theo kế hoạch — kiểm tra lại hoặc sửa kế hoạch ở màn Kế hoạch SX`,
      )
    }

    const warnings: string[] = []
    if (input.direction === 'return') {
      const raw = await transfersRepo.listRawByLsx(lsxId)
      const same = raw.filter(
        (t) =>
          t.component_id === input.component_id &&
          t.stage === input.stage &&
          t.team_department_id === input.team_department_id,
      )
      const wip = summarizeTeamWip(same, 0)
      if (input.qty > wip.issued - wip.returned + 0.001) {
        warnings.push(
          `${comp.name}: trả lại ${input.qty} nhưng tổ mới được giao ${wip.issued} (đã trả ${wip.returned}) — kiểm tra lại số`,
        )
      }
    }

    await transfersRepo.insert({
      production_order_id: lsxId,
      component_id: input.component_id,
      stage: input.stage,
      team_department_id: input.team_department_id,
      direction: input.direction,
      entry_date: input.entry_date,
      qty: input.qty,
      reason: input.direction === 'return' ? (input.reason ?? null) : null,
      note: input.note ?? null,
      created_by: user.id,
    })
    return { warnings }
  },

  /** Xoá dòng ghi nhầm: người tạo hoặc GĐ/QL; lệnh kết thúc thì khoá. */
  async deleteEntry(user: User, transferId: string): Promise<void> {
    const entry = await transfersRepo.findById(transferId)
    if (!entry) throw NotFound('Bản ghi bàn giao không tồn tại')
    const allowed =
      user.role === 'admin' || user.role === 'manager' || entry.created_by === user.id
    if (!allowed) throw Forbidden('Chỉ người nhập hoặc Ban quản lý xoá được bản ghi')
    const lsx = await productionRepo.findById(entry.production_order_id)
    if (lsx && (lsx.status === 'completed' || lsx.status === 'cancelled')) {
      throw BadRequest('LSX đã kết thúc — sổ bàn giao khoá')
    }
    await transfersRepo.delete(transferId)
  },
}

export type { Transfer, TransferJoined }
