import { transferDocsRepo, type TransferDoc } from './transfer-docs.repo'
import { transfersRepo, type Transfer } from './transfers.repo'
import { componentsRepo, type ComponentRow } from './components.repo'
import { productionRepo } from './production.repo'
import { entriesRepo } from './entries.repo'
import { jobsRepo } from './jobs.repo'
import { lsxLinesRepo, type LsxLine } from './lsx-lines.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { countingOf, type Counting } from '@/lib/stage-config'
import { componentRoute } from '@/lib/stage-route'
import { finishRouteOverride, lineUnit } from '@/lib/finish-stages'
import {
  DEFAULT_ASSEMBLY_NAME,
  defaultAssemblyId,
  defaultAssemblyLineId,
  defaultAssemblyOutputs,
  isDefaultAssemblyId,
  resolveCountingPlan,
} from '@/lib/default-assembly'
import { calcComponent } from '@/lib/component-needs'
import { materializeDefaultAssembly } from './default-assembly.materialize'
import { countsAsOfficial, type EntryDocStatus } from '@/lib/entry-doc-flow'
import { totalKey, transferTotals, wipNumbers } from '@/lib/wip-numbers'
import { vnTodayIso } from '@/lib/local-date'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Forbidden, NotFound } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'
import type {
  TransferDocActionInput,
  TransferDocCreateInput,
} from './transfer-docs.schema'

/**
 * PHIẾU GIAO TỔ (PGT, 0289) — B4 của docs/san-xuat-cau-hinh-thiet-ke.md.
 *
 * Hai nhịp: tổ giao lập (da_giao) → tổ nhận xác nhận (da_nhan). Huỷ khi chưa
 * nhận (ghi lý do). Đã nhận thì KHÔNG sửa — lập phiếu ĐẢO (from/to hoán đổi,
 * `reverses_doc_id`), sinh ra đã-nhận luôn vì là bút toán sửa. Năm con số
 * (xong · đã giao · đã nhận · tồn · khả dụng) tính ở lib/wip-numbers — cùng
 * hàm với Ghi sản lượng.
 *
 * Không bắt lập phiếu: ghi sổ công đoạn sau vẫn được, chỉ cảnh báo vượt khả
 * dụng. Phiếu là thứ làm "tồn tại công đoạn" có nghĩa, không phải cổng chặn.
 */

export type PgtLineView = {
  id: string
  component_id: string
  name: string
  cluster: string | null
  product_code: string
  unit: string | null
  qty: number
  received_qty: number | null
  diff_reason: string | null
}

export type PgtDocView = {
  id: string
  doc_no: string
  lsx_id: string
  lsx_code: string
  customer_name: string
  ship_date: string | null
  from_stage: string
  from_team_id: string | null
  to_stage: string
  to_team_id: string | null
  entry_date: string
  status: TransferDoc['status']
  note: string | null
  cancel_reason: string | null
  reverses_doc_id: string | null
  reverses_doc_no: string | null
  received_at: string | null
  lines: PgtLineView[]
}

export type GiaoNhanPayload = {
  /** Tổ của người xem (phòng ban thuộc xưởng), null nếu không thuộc tổ nào. */
  me: { team_id: string; stage: string | null } | null
  teams: { id: string; name: string; stage_code: string | null }[]
  stages: { code: string; label: string }[]
  lsx: { id: string; code: string; customer_name: string; ship_date: string | null }[]
  docs: PgtDocView[]
  today: string
  can_record: boolean
}

export type TransferSourceRow = {
  component_id: string
  name: string
  cluster: string | null
  product_code: string
  unit: string | null
  kind: 'part' | 'assembly'
  /** Σ đạt chính thức ở công đoạn giao. */
  done: number
  /** Σ phiếu giao đi từ công đoạn này (trừ đã đảo). */
  shipped: number
  on_hand: number
  /** Công đoạn kế tiếp trên lộ trình của dòng — gợi ý "đến". */
  next_stage: string | null
  /** Cụm mặc nhiên chưa vật chất hoá (id ảo) — lập phiếu sẽ sinh dòng thật. */
  virtual?: boolean
}

const isMgmt = (u: User) => u.role === 'admin' || u.role === 'manager'

async function loadLsx(lsxId: string) {
  const lsx = await productionRepo.findById(lsxId)
  if (!lsx) throw NotFound('Lệnh không tồn tại')
  if (lsx.status !== 'approved' && lsx.status !== 'in_progress') {
    throw BadRequest('Chỉ lập phiếu giao cho lệnh đã duyệt / đang sản xuất')
  }
  return lsx
}

/**
 * Nguồn lập phiếu + ngữ cảnh đã tải (để `create` vật chất hoá cụm mặc nhiên
 * mà không đọc lệnh lần hai). Thuật toán số: cùng `wipNumbers` với Ghi sản
 * lượng và Hồ sơ lệnh — ba màn một số.
 */
async function loadSource(
  _user: User,
  lsxId: string,
  stage: string,
): Promise<{
  rows: TransferSourceRow[]
  ctx: {
    components: ComponentRow[]
    lines: LsxLine[]
    planned: Map<string, string[]>
    counting: Counting
  }
}> {
  await loadLsx(lsxId)
  const [components, lines, jobs, entries, docs, rawLines, stagesCat] = await Promise.all(
    [
      componentsRepo.listByLsx(lsxId),
      lsxLinesRepo.listLines(lsxId),
      jobsRepo.listByLsx(lsxId),
      entriesRepo.listByLsxWithStatusBulk([lsxId]),
      transferDocsRepo.listByLsxBulk([lsxId]),
      transfersRepo.listRawByLsx(lsxId),
      productionRepo.listStages(),
    ],
  )
  const counting = countingOf(stagesCat)
  const planned = new Map<string, string[]>()
  for (const j of [...jobs].sort((a, b) => a.seq - b.seq)) {
    const arr = planned.get(j.production_order_line_id) ?? []
    arr.push(j.stage)
    planned.set(j.production_order_line_id, arr)
  }
  const done = new Map<string, number>()
  for (const e of entries) {
    if (e.stage !== stage || !countsAsOfficial(e.doc_status as EntryDocStatus)) continue
    done.set(e.component_id, (done.get(e.component_id) ?? 0) + Number(e.qty))
  }
  const totals = transferTotals(docs, rawLines)
  const rows: TransferSourceRow[] = []
  for (const line of lines) {
    const lineComps = components.filter((c) => c.production_order_line_id === line.id)
    const plan = resolveCountingPlan(lineComps, planned.get(line.id), counting)
    for (const c of lineComps) {
      const route =
        finishRouteOverride(c, counting.finish) ??
        plan.own_route.get(c.id) ??
        componentRoute(planned.get(line.id), c)
      const i = route.indexOf(stage)
      if (i < 0) continue
      const t = totals.get(totalKey(c.id, stage))
      const n = wipNumbers({
        done: done.get(c.id) ?? 0,
        shipped: t?.shipped ?? 0,
        received: null,
        used: 0,
      })
      // Chi tiết bị gộp: lộ trình riêng bị cắt trước mốc ghép, nên bước kế
      // tiếp của nó là chính mốc ghép (tổ Phôi giao cho tổ Hàn) — không phải
      // "không còn gì".
      const absorbed = plan.own_route.has(c.id)
      const next =
        route[i + 1] ?? (absorbed && i === route.length - 1 ? counting.join : null)
      rows.push({
        component_id: c.id,
        name: c.name,
        cluster: c.cluster,
        product_code: line.product_code,
        unit: c.unit,
        kind: c.kind,
        done: n.done,
        shipped: n.shipped,
        on_hand: n.on_hand,
        next_stage: next,
      })
    }
    // Cụm mặc nhiên chưa vật chất hoá: xong = SUY từ sổ chi tiết bị gộp tại
    // công đoạn này (min chi tiết chậm nhất, cùng `defaultAssemblyOutputs` với
    // Ghi sản lượng); chưa có id thật nên "đã giao" = 0.
    const vi = plan.virtual_stages.indexOf(stage)
    if (vi >= 0) {
      const absorbed = lineComps
        .filter((c) => plan.own_route.has(c.id))
        .map((c) => ({
          total_needed: calcComponent(
            { qty_per_unit: c.qty_per_unit, dm_kg: c.dm_kg, pcs_per_bar: c.pcs_per_bar },
            line.qty,
          ).total_needed,
          outputs: [{ stage, done: done.get(c.id) ?? 0, defect: 0 }],
        }))
      const out = defaultAssemblyOutputs([stage], line.qty, absorbed)[0]
      const n = wipNumbers({ done: out.done, shipped: 0, received: null, used: 0 })
      rows.push({
        component_id: defaultAssemblyId(line.id),
        name: DEFAULT_ASSEMBLY_NAME,
        cluster: null,
        product_code: line.product_code,
        unit: lineUnit(line.unit),
        kind: 'assembly',
        done: n.done,
        shipped: n.shipped,
        on_hand: n.on_hand,
        next_stage: plan.virtual_stages[vi + 1] ?? null,
        virtual: true,
      })
    }
  }
  return { rows, ctx: { components, lines, planned, counting } }
}

export const transferDocsService = {
  /** Hộp giao nhận: mọi phiếu của các lệnh đang chạy (lọc một lệnh nếu có). */
  async inbox(user: User, filter: { lsxId?: string } = {}): Promise<GiaoNhanPayload> {
    const active = await productionRepo.listActive()
    const scope = filter.lsxId ? active.filter((l) => l.id === filter.lsxId) : active
    const ids = scope.map((l) => l.id)
    const [docs, rawLines, components, lines, depts, stagesCat] = await Promise.all([
      transferDocsRepo.listByLsxBulk(ids),
      transfersRepo.listRawByLsxBulk(ids),
      componentsRepo.listByLsxBulk(ids),
      lsxLinesRepo.listLinesBulk(ids),
      departmentsRepo.list(),
      productionRepo.listStages(),
    ])
    const compById = new Map(components.map((c) => [c.id, c]))
    const lineById = new Map(lines.map((l) => [l.id, l]))
    const lsxById = new Map(scope.map((l) => [l.id, l]))
    const docNo = new Map(docs.map((d) => [d.id, d.doc_no]))
    const linesByDoc = new Map<string, Transfer[]>()
    for (const t of rawLines) {
      if (!t.doc_id) continue
      const arr = linesByDoc.get(t.doc_id) ?? []
      arr.push(t)
      linesByDoc.set(t.doc_id, arr)
    }
    const teams = depts
      .filter((d) => d.workspace_id === 'production')
      .map((d) => ({
        id: d.id,
        name: d.name,
        stage_code: resolveTeamStage(d, stagesCat),
      }))
    const myTeam = user.department_id
      ? teams.find((t) => t.id === user.department_id)
      : null
    return {
      me: myTeam ? { team_id: myTeam.id, stage: myTeam.stage_code } : null,
      teams,
      stages: stagesCat.map((s) => ({ code: s.code, label: s.label })),
      lsx: active.map((l) => ({
        id: l.id,
        code: l.code,
        customer_name: l.customer_name,
        ship_date: l.ship_date,
      })),
      docs: docs.map((d) => {
        const own = lsxById.get(d.production_order_id)
        return {
          id: d.id,
          doc_no: d.doc_no,
          lsx_id: d.production_order_id,
          lsx_code: own?.code ?? '',
          customer_name: own?.customer_name ?? '',
          ship_date: own?.ship_date ?? null,
          from_stage: d.from_stage,
          from_team_id: d.from_team_id,
          to_stage: d.to_stage,
          to_team_id: d.to_team_id,
          entry_date: d.entry_date,
          status: d.status,
          note: d.note,
          cancel_reason: d.cancel_reason,
          reverses_doc_id: d.reverses_doc_id,
          reverses_doc_no: d.reverses_doc_id
            ? (docNo.get(d.reverses_doc_id) ?? null)
            : null,
          received_at: d.received_at,
          lines: (linesByDoc.get(d.id) ?? []).map((t) => {
            const c = compById.get(t.component_id)
            return {
              id: t.id,
              component_id: t.component_id,
              name: c?.name ?? '(dòng đã xoá)',
              cluster: c?.cluster ?? null,
              product_code: c
                ? (lineById.get(c.production_order_line_id)?.product_code ?? '')
                : '',
              unit: c?.unit ?? null,
              qty: t.qty,
              received_qty: t.received_qty,
              diff_reason: t.diff_reason,
            }
          }),
        }
      }),
      today: vnTodayIso(),
      can_record: true,
    }
  },

  /**
   * Nguồn để LẬP PHIẾU: dòng của lệnh có đi qua `stage`, kèm xong · đã giao ·
   * tồn tại công đoạn đó.
   *
   * Cụm mặc nhiên (BOM phẳng, lib/default-assembly) CHƯA vật chất hoá cũng
   * được bày — với id ảo `default-asm:<line>` và "xong" SUY từ sổ chi tiết,
   * y như Ghi sản lượng. Trước 06/11/2026 chỉ dòng thật được bày, nên tổ Hàn
   * không giao được cụm cho Nguội trước lượt ghi sổ đầu — trong khi xưởng
   * thật là hàng đi trước sổ. `create` vật chất hoá nó lúc lập phiếu.
   */
  async source(user: User, lsxId: string, stage: string): Promise<TransferSourceRow[]> {
    return (await loadSource(user, lsxId, stage)).rows
  },

  /** Tổ giao lập phiếu → da_giao. Giao vượt tồn: cảnh báo, không chặn. */
  async create(
    user: User,
    input: TransferDocCreateInput,
  ): Promise<{ doc_no: string; id: string; warnings: string[] }> {
    await assertAction(user, 'production.transfers.record')
    const lsx = await loadLsx(input.production_order_id)
    const [depts, stagesCat] = await Promise.all([
      departmentsRepo.list(),
      productionRepo.listStages(),
    ])
    const stageLabel = (c: string) => stagesCat.find((s) => s.code === c)?.label ?? c
    if (!stagesCat.some((s) => s.code === input.from_stage)) {
      throw BadRequest('Công đoạn giao không có trong danh mục')
    }
    if (!stagesCat.some((s) => s.code === input.to_stage)) {
      throw BadRequest('Công đoạn nhận không có trong danh mục')
    }
    const teamOk = (id: string) =>
      depts.some((d) => d.id === id && d.workspace_id === 'production')
    if (!teamOk(input.from_team_id) || !teamOk(input.to_team_id)) {
      throw BadRequest('Tổ giao / tổ nhận phải là tổ xưởng')
    }
    // Nguồn đọc TRƯỚC khi vật chất hoá: hàng cụm mặc nhiên còn mang "xong" suy
    // từ sổ chi tiết; sau khi thành dòng thật nó chưa có sổ riêng (= 0) và
    // cảnh báo vượt tồn sẽ kêu oan.
    const { rows: src, ctx } = await loadSource(user, lsx.id, input.from_stage)
    const byId = new Map(ctx.components.map((c) => [c.id, c]))
    const onHand = new Map(src.map((r) => [r.component_id, r]))
    const warnings: string[] = []
    for (const l of input.lines) {
      const r = onHand.get(l.component_id)
      if (!r) {
        const known = byId.get(l.component_id)
        if (!known && !isDefaultAssemblyId(l.component_id)) {
          throw BadRequest('Có dòng không thuộc lệnh này')
        }
        throw BadRequest(
          `"${known?.name ?? DEFAULT_ASSEMBLY_NAME}" không đi qua công đoạn ${stageLabel(input.from_stage)} — không giao từ đó được`,
        )
      }
      if (l.qty - r.on_hand > 0.001) {
        warnings.push(
          `${r.name}: giao ${l.qty} nhưng tồn tại ${stageLabel(input.from_stage)} chỉ ${r.on_hand} (xong ${r.done} − đã giao ${r.shipped})`,
        )
      }
    }
    // Cụm mặc nhiên → dòng thật (cùng hàm với Ghi sản lượng), rồi trỏ phiếu
    // vào id thật. Hai dòng cùng dòng SP trong một phiếu thì schema đã chặn.
    const idRemap = new Map<string, string>()
    for (const vid of input.lines
      .map((l) => l.component_id)
      .filter(isDefaultAssemblyId)) {
      const lineId = defaultAssemblyLineId(vid)!
      const line = ctx.lines.find((l) => l.id === lineId)
      if (!line) throw BadRequest('Có dòng gắn cụm mặc nhiên không thuộc lệnh này')
      const { real, created } = await materializeDefaultAssembly({
        lsxId: lsx.id,
        line,
        lineComps: ctx.components.filter((c) => c.production_order_line_id === lineId),
        plannedRoute: ctx.planned.get(lineId),
        counting: ctx.counting,
      })
      if (created) ctx.components.push(real)
      idRemap.set(vid, real.id)
    }
    const doc = await transferDocsRepo.insert({
      doc_no: await transferDocsRepo.nextDocNo(),
      production_order_id: lsx.id,
      from_stage: input.from_stage,
      from_team_id: input.from_team_id,
      to_stage: input.to_stage,
      to_team_id: input.to_team_id,
      entry_date: input.entry_date,
      note: input.note?.trim() || null,
      reverses_doc_id: null,
      created_by: user.id,
    })
    // Dòng = 'issue' VÀO tổ nhận cho công đoạn nhận (đúng nghĩa 0090).
    await transferDocsRepo.insertLines(
      input.lines.map((l) => ({
        production_order_id: lsx.id,
        component_id: idRemap.get(l.component_id) ?? l.component_id,
        stage: input.to_stage,
        team_department_id: input.to_team_id,
        direction: 'issue' as const,
        entry_date: input.entry_date,
        qty: l.qty,
        reason: null,
        note: null,
        created_by: user.id,
        doc_id: doc.id,
        received_qty: null,
        diff_reason: null,
      })),
    )
    return { doc_no: doc.doc_no, id: doc.id, warnings }
  },

  /** Nhận · huỷ · đảo — một cửa, kiểm trạng thái + quyền theo tổ. */
  async act(
    user: User,
    docId: string,
    input: TransferDocActionInput,
  ): Promise<{ doc_no: string }> {
    await assertAction(user, 'production.transfers.record')
    const doc = await transferDocsRepo.findById(docId)
    if (!doc) throw NotFound('Phiếu giao không tồn tại')
    const lines = await transferDocsRepo.listLines(doc.id)
    const inTeam = (teamId: string | null) =>
      isMgmt(user) || (teamId != null && user.department_id === teamId)

    if (input.action === 'nhan') {
      if (doc.status !== 'da_giao') throw BadRequest('Phiếu không ở trạng thái chờ nhận')
      if (!inTeam(doc.to_team_id))
        throw Forbidden('Chỉ tổ nhận (hoặc Ban quản lý) xác nhận được')
      const byId = new Map((input.lines ?? []).map((l) => [l.transfer_id, l]))
      for (const t of lines) {
        const got = byId.get(t.id)
        const received = got ? got.received_qty : t.qty
        const diff = Math.round((received - t.qty) * 100) / 100
        const reason = got?.diff_reason?.trim() || null
        if (diff !== 0 && !reason) {
          throw BadRequest(`Nhận ${received} khác giao ${t.qty} — phải ghi lý do chênh`)
        }
        await transferDocsRepo.setReceived(t.id, received, diff !== 0 ? reason : null)
      }
      await transferDocsRepo.patch(doc.id, {
        status: 'da_nhan',
        received_by: user.id,
        received_at: new Date().toISOString(),
      })
      return { doc_no: doc.doc_no }
    }

    if (input.action === 'huy') {
      if (doc.status !== 'da_giao')
        throw BadRequest('Chỉ huỷ được phiếu chưa nhận — đã nhận thì đảo')
      if (!inTeam(doc.from_team_id) && doc.created_by !== user.id) {
        throw Forbidden('Chỉ tổ giao / người lập (hoặc Ban quản lý) huỷ được')
      }
      await transferDocsRepo.patch(doc.id, {
        status: 'da_huy',
        cancel_reason: input.reason,
      })
      return { doc_no: doc.doc_no }
    }

    // ── đảo ──
    if (doc.status !== 'da_nhan')
      throw BadRequest('Chỉ đảo được phiếu đã nhận — chưa nhận thì huỷ')
    if (doc.reverses_doc_id)
      throw BadRequest('Phiếu đảo không đảo tiếp — lập phiếu giao mới')
    if (!inTeam(doc.to_team_id) && !inTeam(doc.from_team_id)) {
      throw Forbidden('Chỉ hai tổ trên phiếu (hoặc Ban quản lý) đảo được')
    }
    const want = new Map((input.lines ?? []).map((l) => [l.transfer_id, l.qty]))
    const rev = lines
      .map((t) => ({
        t,
        qty: want.has(t.id) ? want.get(t.id)! : (t.received_qty ?? t.qty),
      }))
      .filter((x) => x.qty > 0)
    if (!rev.length) throw BadRequest('Không có dòng nào để đảo')
    for (const x of rev) {
      const max = x.t.received_qty ?? x.t.qty
      if (x.qty - max > 0.001) {
        throw BadRequest(`Đảo ${x.qty} vượt số đã nhận ${max} của dòng`)
      }
    }
    const now = new Date().toISOString()
    const ndoc = await transferDocsRepo.insert({
      doc_no: await transferDocsRepo.nextDocNo(),
      production_order_id: doc.production_order_id,
      from_stage: doc.to_stage,
      from_team_id: doc.to_team_id,
      to_stage: doc.from_stage,
      to_team_id: doc.from_team_id,
      entry_date: vnTodayIso(),
      note: `Đảo ${doc.doc_no}: ${input.reason}`,
      reverses_doc_id: doc.id,
      created_by: user.id,
      status: 'da_nhan',
      received_by: user.id,
      received_at: now,
    })
    // Dòng đảo = 'return' trên cùng (công đoạn, tổ) của phiếu gốc → cảnh báo
    // WIP cũ (issued − returned) vẫn đúng.
    await transferDocsRepo.insertLines(
      rev.map((x) => ({
        production_order_id: doc.production_order_id,
        component_id: x.t.component_id,
        stage: doc.to_stage,
        team_department_id: doc.to_team_id ?? x.t.team_department_id,
        direction: 'return' as const,
        entry_date: vnTodayIso(),
        qty: x.qty,
        reason: input.reason,
        note: null,
        created_by: user.id,
        doc_id: ndoc.id,
        received_qty: x.qty,
        diff_reason: null,
      })),
    )
    return { doc_no: ndoc.doc_no }
  },
}
