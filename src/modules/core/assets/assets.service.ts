import { BadRequest, NotFound } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { todayVn } from '@/lib/date-vn'
import {
  addDaysIso,
  addYm,
  assetCode,
  assetCounterKey,
  docNo,
  inBooks,
  inspectionSoon,
  isDown,
  isOpenIssue,
  ISSUE_STATUS,
  MOVE_LABEL,
  planDue,
  planState,
  repairStats,
  WO_KIND,
  woCost,
  ymOf,
  type Due,
  type IssueStatus,
  type PlanState,
  type RepairStats,
} from '@/lib/may-moc'
import {
  assetsRepo,
  type AssetRow,
  type EmployeeLite,
  type GroupRow,
  type IssueRow,
  type PlanRow,
  type WorkOrderRow,
} from './assets.repo'
import type {
  AssetCreateInput,
  AssetUpdateInput,
  PlanCreateInput,
  PlanDoneInput,
  ToolGiveInput,
  ToolRecallInput,
} from './assets.schema'
import {
  buildCostSheet,
  buildTemplate,
  parseImport,
  type ImportRow,
} from './assets.excel'

/**
 * MÁY MÓC & BẢO TRÌ (0270) — danh mục máy, lịch bảo trì, phiếu đã làm, chi phí
 * tháng, dụng cụ theo người. Báo hỏng ở `issues.service.ts`.
 *
 * Mọi con số hiện trên màn (máy đang dừng, quá hạn, chi phí…) đếm bằng hàm thuần
 * ở `lib/may-moc.ts` để ô việc và trang đích dùng CÙNG một hàm.
 */

// ── Kiểu trả về cho màn ────────────────────────────────────────────────────

export type AssetsMeta = {
  can_edit: boolean
  can_work: boolean
  can_approve: boolean
  can_tools: boolean
  can_cost: boolean
}

export type PersonLite = {
  id: string
  name: string
  code: string
  team: string | null
  left_on: string | null
}

export type AssetView = AssetRow & {
  group_name: string
  dept_name: string | null
  resp_name: string | null
  holder: PersonLite | null
  next_plan: {
    id: string
    task: string
    due: Due
    state: PlanState
    is_inspection: boolean
  } | null
  overdue: boolean
  open_issue: {
    id: string
    no: string
    status: IssueStatus
    priority: string
    description: string
  } | null
}

export type PlanView = PlanRow & {
  due: Due
  state: PlanState
  asset: {
    id: string
    code: string
    name: string
    dept_name: string | null
    hours: number
    hours_per_day: number
  }
}

export type HistoryMark = {
  key: string
  at: string
  label: string
  actor: string | null
  detail: string | null
  tone: 'act' | 'done' | 'warn' | 'stop'
}

// ── Ngữ cảnh dùng chung ────────────────────────────────────────────────────

export async function assetsMeta(user: User): Promise<AssetsMeta> {
  const [can_edit, can_work, can_approve, can_tools, can_cost] = await Promise.all([
    canAction(user, 'assets.asset.edit'),
    canAction(user, 'assets.work'),
    canAction(user, 'assets.approve'),
    canAction(user, 'assets.tools'),
    canAction(user, 'assets.cost.view'),
  ])
  return { can_edit, can_work, can_approve, can_tools, can_cost }
}

type Ctx = {
  today: string
  groups: Map<string, GroupRow>
  depts: Map<string, string>
  emps: Map<string, EmployeeLite>
}

async function ctx(): Promise<Ctx> {
  const [groups, depts, emps] = await Promise.all([
    assetsRepo.groups(),
    departmentsRepo.list(),
    assetsRepo.employees(),
  ])
  return {
    today: todayVn(),
    groups: new Map(groups.map((g) => [g.id, g])),
    depts: new Map(depts.map((d) => [d.id, d.name])),
    emps: new Map(emps.map((e) => [e.id, e])),
  }
}

const person = (c: Ctx, id: string | null): PersonLite | null => {
  const e = id ? c.emps.get(id) : null
  return e
    ? {
        id: e.id,
        name: e.full_name,
        code: e.code,
        team: e.team,
        left_on: e.active ? null : (e.leave_date ?? ''),
      }
    : null
}

/** Hạng mục còn tính lịch: hạng mục đang bật, máy còn trên sổ và đã đưa vào dùng. */
const planCounts = (p: PlanRow, a: AssetRow | undefined) =>
  !!a && p.active && a.kind === 'machine' && inBooks(a.status) && a.status !== 'chua_dung'

function planView(c: Ctx, p: PlanRow, a: AssetRow): PlanView {
  const due = planDue(p, a, c.today)
  return {
    ...p,
    due,
    state: planState(due.days),
    asset: {
      id: a.id,
      code: a.code,
      name: a.name,
      dept_name: a.department_id ? (c.depts.get(a.department_id) ?? null) : null,
      hours: a.hours,
      hours_per_day: a.hours_per_day,
    },
  }
}

function assetView(
  c: Ctx,
  a: AssetRow,
  plans: PlanRow[],
  open: IssueRow | undefined,
): AssetView {
  const active = plans.filter((p) => planCounts(p, a)).map((p) => planView(c, p, a))
  active.sort((x, y) => x.due.days - y.due.days)
  const np = active[0]
  return {
    ...a,
    group_name: c.groups.get(a.group_id)?.name ?? a.group_id,
    dept_name: a.department_id ? (c.depts.get(a.department_id) ?? null) : null,
    resp_name: person(c, a.resp_employee_id)?.name ?? null,
    holder: person(c, a.holder_employee_id),
    next_plan: np
      ? {
          id: np.id,
          task: np.task,
          due: np.due,
          state: np.state,
          is_inspection: np.is_inspection,
        }
      : null,
    overdue: active.some((p) => p.state === 'od'),
    open_issue: open
      ? {
          id: open.id,
          no: open.no,
          status: open.status,
          priority: open.priority,
          description: open.description,
        }
      : null,
  }
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const r of rows) {
    const k = key(r)
    const arr = m.get(k)
    if (arr) arr.push(r)
    else m.set(k, [r])
  }
  return m
}

/** Lựa chọn cho các ô chọn ở form. */
function formOptions(c: Ctx) {
  const emps = [...c.emps.values()]
  return {
    groups: [...c.groups.values()]
      .filter((g) => g.active)
      .map((g) => ({ id: g.id, name: g.name, kind: g.kind, templates: g.templates })),
    depts: [...c.depts.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    employees: emps
      .filter((e) => e.active)
      .map((e) => ({ id: e.id, name: e.full_name, code: e.code, team: e.team })),
    techs: emps
      .filter((e) => e.active && e.team === 'Tổ Cơ Điện')
      .map((e) => ({ id: e.id, name: e.full_name, code: e.code, team: e.team })),
  }
}
export type AssetFormOptions = ReturnType<typeof formOptions>

// ── Đọc ────────────────────────────────────────────────────────────────────

export const assetsService = {
  /** Danh sách máy + dụng cụ (màn Máy móc) — kèm hạn bảo trì gần nhất, phiếu đang mở. */
  async list(user: User) {
    const [c, meta, assets, plans, issues] = await Promise.all([
      ctx(),
      assetsMeta(user),
      assetsRepo.listAssets(),
      assetsRepo.listPlans(),
      assetsRepo.listIssues({ since: addDaysIso(todayVn(), -30) }),
    ])
    const byAsset = groupBy(plans, (p) => p.asset_id)
    const openBy = new Map(
      issues.filter((i) => isOpenIssue(i.status)).map((i) => [i.asset_id, i]),
    )
    return {
      meta,
      today: c.today,
      assets: assets.map((a) =>
        assetView(c, a, byAsset.get(a.id) ?? [], openBy.get(a.id)),
      ),
      options: formOptions(c),
    }
  },

  /** Hồ sơ một máy (tem QR mở thẳng trang này theo mã). */
  async detail(user: User, code: string) {
    const a = await assetsRepo.findAssetByCode(code)
    if (!a) throw NotFound(`Không có máy mã ${code}`)
    const [c, meta, plans, wos, issues, moves, siblings, approveOver] = await Promise.all(
      [
        ctx(),
        assetsMeta(user),
        assetsRepo.listPlans([a.id]),
        assetsRepo.listWorkOrders({ assetId: a.id }),
        assetsRepo.listIssues({ assetId: a.id }),
        assetsRepo.listMovements(a.id),
        assetsRepo
          .listAssets()
          .then((all) =>
            all.filter((x) => x.group_id === a.group_id && inBooks(x.status)),
          ),
        assetsRepo.approveOver(),
      ],
    )
    const open = issues.find((i) => isOpenIssue(i.status))
    const since = addDaysIso(c.today, -365)
    const stats = repairStats(wos, since)
    // Mẫu số "lần hỏng" — trung bình cùng nhóm (12 tháng), đo trên phiếu sửa thật.
    const groupWos = siblings.length
      ? await assetsRepo
          .listWorkOrders({ from: since })
          .then((w) => w.filter((x) => siblings.some((s) => s.id === x.asset_id)))
      : []
    const groupSc = groupWos.filter((w) => w.kind === 'SC').length
    const names = await usersRepo.displayNamesByIds([
      ...new Set(
        [
          ...issues.map((i) => i.reporter_user_id),
          ...moves.map((m) => m.created_by),
        ].filter((x): x is string => !!x),
      ),
    ])
    return {
      meta,
      today: c.today,
      asset: assetView(c, a, plans, open),
      plans: plans.map((p) => ({ ...planView(c, p, a), counts: planCounts(p, a) })),
      stats,
      group: { count: siblings.length, sc_12m: groupSc },
      issues: issues.map((i) => ({
        ...i,
        tech_name: person(c, i.tech_employee_id)?.name ?? null,
      })),
      history: history(c, wos, issues, moves, names),
      options: formOptions(c),
      approve_over: approveOver,
    }
  },

  /** Lịch bảo trì toàn xưởng: mọi hạng mục đang tính, xếp theo hạn. */
  async board(user: User) {
    const [c, meta, assets, plans, wos] = await Promise.all([
      ctx(),
      assetsMeta(user),
      assetsRepo.listAssets(),
      assetsRepo.listPlans(),
      assetsRepo.listWorkOrders({ from: addDaysIso(todayVn(), -30) }),
    ])
    const byId = new Map(assets.map((a) => [a.id, a]))
    const views = plans
      .filter((p) => planCounts(p, byId.get(p.asset_id)))
      .map((p) => planView(c, p, byId.get(p.asset_id)!))
      .sort((x, y) => x.due.days - y.due.days)
    const lastCost = new Map<string, number>()
    for (const w of [...wos].reverse()) if (w.plan_id) lastCost.set(w.plan_id, w.cost)
    return {
      meta,
      today: c.today,
      plans: views.map((p) => ({ ...p, last_cost: lastCost.get(p.id) ?? null })),
      done30: wos.map((w) => ({
        ...w,
        asset_code: byId.get(w.asset_id)?.code ?? '',
        asset_name: byId.get(w.asset_id)?.name ?? '',
        dept_name: (() => {
          const d = byId.get(w.asset_id)?.department_id
          return d ? (c.depts.get(d) ?? null) : null
        })(),
        tech_name: person(c, w.tech_employee_id)?.name ?? null,
      })),
      options: formOptions(c),
    }
  },

  /** Số cho trang "Việc hôm nay" — mỗi số đếm bằng đúng hàm của màn đích. */
  async home(user: User) {
    const [c, meta, assets, plans, issues, approveOver] = await Promise.all([
      ctx(),
      assetsMeta(user),
      assetsRepo.listAssets(),
      assetsRepo.listPlans(),
      assetsRepo.listIssues({ since: addDaysIso(todayVn(), -30) }),
      assetsRepo.approveOver(),
    ])
    const byId = new Map(assets.map((a) => [a.id, a]))
    const views = plans
      .filter((p) => planCounts(p, byId.get(p.asset_id)))
      .map((p) => planView(c, p, byId.get(p.asset_id)!))
      .sort((x, y) => x.due.days - y.due.days)
    const open = issues.filter((i) => isOpenIssue(i.status))
    const machines = assets.filter((a) => a.kind === 'machine' && inBooks(a.status))
    const label = (id: string) => {
      const a = byId.get(id)
      return a
        ? {
            code: a.code,
            name: a.name,
            dept_name: a.department_id ? (c.depts.get(a.department_id) ?? null) : null,
          }
        : null
    }
    const stale = machines.filter(
      (a) =>
        a.hours_per_day > 0 &&
        a.status !== 'chua_dung' &&
        (!a.hours_updated_on || a.hours_updated_on < addDaysIso(c.today, -14)),
    )
    return {
      meta,
      today: c.today,
      counts: {
        machines: machines.length,
        down: machines.filter((a) => isDown(a.status)).length,
        new_issues: open.filter((i) => i.status === 'moi').length,
        waiting: open.filter((i) => i.status === 'cho_duyet').length,
        fixing: open.filter((i) => i.status === 'dang_sua').length,
        overdue: views.filter((p) => p.state === 'od').length,
        soon: views.filter((p) => p.state === 'soon').length,
        inspections: views.filter((p) => p.is_inspection && inspectionSoon(p.due.days))
          .length,
        stale_hours: stale.length,
      },
      issues: open.map((i) => ({
        ...i,
        asset: label(i.asset_id),
        tech_name: person(c, i.tech_employee_id)?.name ?? null,
      })),
      plans: views
        .filter(
          (p) => p.state !== 'ok' || (p.is_inspection && inspectionSoon(p.due.days)),
        )
        .slice(0, 30),
      options: formOptions(c),
      approve_over: approveOver,
      assets: assets
        .filter((a) => inBooks(a.status))
        .map((a) => ({ id: a.id, code: a.code, name: a.name })),
    }
  },

  // ── Ghi: danh mục ────────────────────────────────────────────────────────

  async create(user: User, input: AssetCreateInput): Promise<AssetRow> {
    await assertAction(user, 'assets.asset.edit')
    const groups = await assetsRepo.groups()
    const g = groups.find((x) => x.id === input.group_id && x.active)
    if (!g) throw BadRequest('Nhóm máy không tồn tại')
    const n = await assetsRepo.nextNo(assetCounterKey(g.kind, g.id))
    const today = todayVn()
    const useDate = input.use_date ?? today
    const status = input.status ?? (g.kind === 'tool' ? 'chua_dung' : 'dang_dung')
    const a = await assetsRepo.insertAsset({
      code: assetCode(g.kind, g.id, n),
      name: input.name,
      group_id: g.id,
      kind: g.kind,
      model: input.model,
      serial: input.serial,
      supplier: input.supplier,
      purchase_date: input.purchase_date ?? useDate,
      use_date: useDate,
      cost: input.cost,
      qty: input.qty,
      unit: input.unit ?? (g.kind === 'machine' ? 'chiếc' : 'cái'),
      department_id: input.department_id,
      resp_employee_id: g.kind === 'machine' ? input.resp_employee_id : null,
      status,
      hours_per_day: g.kind === 'machine' ? input.hours_per_day : 0,
      hours: 0,
      hours_updated_on: today,
      note: input.note,
      created_by: user.id,
    })
    if (g.kind === 'machine') {
      const keep = input.template_idx ? new Set(input.template_idx) : null
      await assetsRepo.insertPlans(
        g.templates
          .filter(
            (t, i) => (!keep || keep.has(i)) && !(t.unit === 'h' && !a.hours_per_day),
          )
          .map((t) => ({
            asset_id: a.id,
            task: t.task,
            every_n: t.every,
            unit: t.unit,
            cost: t.cost ?? 0,
            is_inspection: !!t.inspection,
            // Máy cũ đưa vào hệ thống: lần bảo trì trước CHƯA BIẾT — tính lịch từ
            // hôm nhập, không từ ngày mua (không thì vừa nhập đã "quá 477 ngày").
            last_date: useDate < today ? today : useDate,
            last_hours: 0,
          })),
      )
    }
    await assetsRepo.insertMovement({
      no: docNo('GT', await assetsRepo.nextNo('GT')),
      type: 'GT',
      moved_on: useDate,
      asset_ids: [a.id],
      from_department_id: null,
      to_department_id: a.department_id,
      from_employee_id: null,
      to_employee_id: null,
      note: g.kind === 'machine' ? 'Thêm máy' : 'Nhập kho dụng cụ',
      created_by: user.id,
    })
    return a
  },

  async update(user: User, id: string, input: AssetUpdateInput): Promise<AssetRow> {
    await assertAction(user, 'assets.asset.edit')
    const a = await assetsRepo.findAsset(id)
    if (!a) throw NotFound('Không có máy này')
    const patch: Partial<AssetRow> = {}
    for (const k of [
      'name',
      'model',
      'serial',
      'supplier',
      'department_id',
      'resp_employee_id',
      'use_date',
      'purchase_date',
      'cost',
      'hours_per_day',
      'note',
    ] as const) {
      if (input[k] !== undefined) (patch as Record<string, unknown>)[k] = input[k]
    }
    if (input.status && input.status !== a.status) {
      if (!inBooks(a.status))
        throw BadRequest('Máy đã báo mất / thanh lý — không đổi trạng thái được nữa')
      if (await assetsRepo.openIssueOf(a.id))
        throw BadRequest('Máy đang có phiếu báo hỏng chưa xong — xử lý phiếu trước')
      if ((input.status === 'mat' || input.status === 'thanh_ly') && !input.reason) {
        throw BadRequest('Ghi lý do báo mất / thanh lý')
      }
      patch.status = input.status
      if (input.status === 'mat' || input.status === 'thanh_ly') {
        patch.disposed_on = todayVn()
        patch.holder_employee_id = null
        await assetsRepo.insertMovement({
          no: docNo(
            input.status === 'mat' ? 'BM' : 'TL',
            await assetsRepo.nextNo(input.status === 'mat' ? 'BM' : 'TL'),
          ),
          type: input.status === 'mat' ? 'BM' : 'TL',
          moved_on: todayVn(),
          asset_ids: [a.id],
          from_department_id: a.department_id,
          to_department_id: null,
          from_employee_id: a.holder_employee_id,
          to_employee_id: null,
          note: input.reason,
          created_by: user.id,
        })
      }
    }
    if (
      patch.department_id !== undefined &&
      patch.department_id !== a.department_id &&
      a.kind === 'machine'
    ) {
      await assetsRepo.insertMovement({
        no: docNo('DC', await assetsRepo.nextNo('DC')),
        type: 'DC',
        moved_on: todayVn(),
        asset_ids: [a.id],
        from_department_id: a.department_id,
        to_department_id: patch.department_id ?? null,
        from_employee_id: null,
        to_employee_id: null,
        note: input.reason ?? null,
        created_by: user.id,
      })
    }
    return assetsRepo.updateAsset(id, patch)
  },

  async setHours(user: User, id: string, hours: number): Promise<AssetRow> {
    await assertAction(user, 'assets.work')
    const a = await assetsRepo.findAsset(id)
    if (!a) throw NotFound('Không có máy này')
    if (hours < a.hours) {
      throw BadRequest(
        `Số giờ mới phải ≥ số hiện tại (${a.hours.toLocaleString('vi-VN')} giờ) — đồng hồ giờ chạy không lùi`,
      )
    }
    return assetsRepo.updateAsset(id, {
      hours: Math.round(hours),
      hours_updated_on: todayVn(),
    })
  },

  // ── Ghi: lịch bảo trì ────────────────────────────────────────────────────

  async addPlan(user: User, assetId: string, input: PlanCreateInput) {
    await assertAction(user, 'assets.work')
    const a = await assetsRepo.findAsset(assetId)
    if (!a || a.kind !== 'machine') throw NotFound('Không có máy này')
    if (input.unit === 'h' && !a.hours_per_day) {
      throw BadRequest(
        'Máy này không khai giờ chạy/ngày — chọn chu kỳ theo ngày hoặc tháng',
      )
    }
    await assetsRepo.insertPlans([
      {
        asset_id: a.id,
        task: input.task,
        every_n: input.every_n,
        unit: input.unit,
        cost: input.cost,
        is_inspection: input.is_inspection,
        last_date: todayVn(),
        last_hours: a.hours,
      },
    ])
  },

  async updatePlan(
    user: User,
    planId: string,
    patch: { task?: string; every_n?: number; cost?: number; active?: boolean },
  ) {
    await assertAction(user, 'assets.work')
    const p = await assetsRepo.findPlan(planId)
    if (!p) throw NotFound('Không có hạng mục này')
    return assetsRepo.updatePlan(planId, patch)
  },

  /** "Đã làm": ghi phiếu PBD/PKD, dời lịch sang kỳ sau, cập nhật giờ chạy nếu có. */
  async planDone(
    user: User,
    planId: string,
    input: PlanDoneInput,
  ): Promise<WorkOrderRow> {
    await assertAction(user, 'assets.work')
    const p = await assetsRepo.findPlan(planId)
    if (!p) throw NotFound('Không có hạng mục này')
    const a = await assetsRepo.findAsset(p.asset_id)
    if (!a) throw NotFound('Không có máy này')
    if (!planCounts(p, a))
      throw BadRequest('Hạng mục đang tạm dừng hoặc máy chưa dùng / đã thanh lý')
    if (input.done_on > todayVn()) throw BadRequest('Ngày làm không được sau hôm nay')
    if (!input.tech_employee_id && !input.vendor)
      throw BadRequest('Chọn người làm hoặc ghi đơn vị thực hiện')
    if (input.hours != null && input.hours < a.hours) {
      throw BadRequest(
        `Giờ chạy phải ≥ ${a.hours.toLocaleString('vi-VN')} giờ (số hiện tại)`,
      )
    }
    const hours = input.hours != null ? Math.round(input.hours) : a.hours
    const kind = p.is_inspection ? 'KD' : 'BD'
    const wo = await assetsRepo.insertWorkOrder({
      no: docNo(WO_KIND[kind].prefix, await assetsRepo.nextNo(WO_KIND[kind].prefix)),
      kind,
      asset_id: a.id,
      plan_id: p.id,
      issue_id: null,
      title: p.task,
      done_on: input.done_on,
      tech_employee_id: input.tech_employee_id,
      vendor: input.tech_employee_id ? null : input.vendor,
      parts: input.parts,
      labor: input.labor,
      cost: woCost(input.parts, input.labor),
      downtime_hours: input.downtime_hours,
      hours_reading: a.hours_per_day ? hours : null,
      note: input.note,
      created_by: user.id,
    })
    await assetsRepo.updatePlan(p.id, { last_date: input.done_on, last_hours: hours })
    if (hours !== a.hours)
      await assetsRepo.updateAsset(a.id, { hours, hours_updated_on: todayVn() })
    return wo
  },

  // ── Nhập từ Excel ────────────────────────────────────────────────────────

  async template(user: User): Promise<Buffer> {
    await assertAction(user, 'assets.asset.edit')
    const [groups, depts] = await Promise.all([
      assetsRepo.groups(),
      departmentsRepo.list(),
    ])
    return buildTemplate(
      groups.filter((g) => g.active),
      depts,
    )
  },

  /**
   * Đọc file danh sách máy. `commit=false` chỉ trả bản xem trước (dòng nào lỗi,
   * vì sao). `commit=true` ghi TẤT CẢ dòng hợp lệ; còn dòng lỗi thì không ghi gì
   * — người dùng sửa file rồi nhập lại, không để danh mục nửa vời.
   */
  async importExcel(
    user: User,
    buffer: ArrayBuffer,
    commit: boolean,
  ): Promise<{
    rows: ImportRow[]
    missingCols: string[]
    created: { code: string; name: string }[]
  }> {
    await assertAction(user, 'assets.asset.edit')
    const [groups, depts, emps] = await Promise.all([
      assetsRepo.groups(),
      departmentsRepo.list(),
      assetsRepo.employees(),
    ])
    const parsed = await parseImport(buffer, groups, depts, emps)
    const bad = parsed.missingCols.length > 0 || parsed.rows.some((r) => r.errors.length)
    if (!commit || bad || parsed.rows.length === 0) return { ...parsed, created: [] }
    const created: { code: string; name: string }[] = []
    for (const r of parsed.rows) {
      const a = await assetsService.create(user, r.input!)
      created.push({ code: a.code, name: a.name })
    }
    return { ...parsed, created }
  },

  async costExcel(user: User, ym?: string): Promise<{ month: string; buffer: Buffer }> {
    const c = await assetsService.cost(user, ym)
    const buffer = await buildCostSheet(
      c.month,
      c.rows.map((w) => ({ ...w, kind_label: WO_KIND[w.kind].label })),
    )
    return { month: c.month, buffer }
  },

  // ── Chi phí tháng ────────────────────────────────────────────────────────

  async cost(user: User, ym?: string) {
    await assertAction(user, 'assets.cost.view')
    const c = await ctx()
    const cur = ymOf(c.today)
    const month = ym && ym <= cur ? ym : cur
    const from12 = `${addYm(month, -11)}-01`
    const to = `${addYm(month, 1)}-01`
    const [assets, wos] = await Promise.all([
      assetsRepo.listAssets(),
      assetsRepo.listWorkOrders({ from: from12, to }),
    ])
    const byId = new Map(assets.map((a) => [a.id, a]))
    const inMonth = wos
      .filter((w) => ymOf(w.done_on) === month)
      .sort((x, y) => x.done_on.localeCompare(y.done_on) || x.no.localeCompare(y.no))
      .map((w) => {
        const a = byId.get(w.asset_id)
        return {
          ...w,
          asset_code: a?.code ?? '',
          asset_name: a?.name ?? '',
          dept_name: a?.department_id ? (c.depts.get(a.department_id) ?? null) : null,
          tech_name: person(c, w.tech_employee_id)?.name ?? null,
        }
      })
    const months = Array.from({ length: 12 }, (_, i) => addYm(month, i - 11))
    const series = months.map((m) => {
      const ws = wos.filter((w) => ymOf(w.done_on) === m)
      return {
        ym: m,
        bd: ws.filter((w) => w.kind !== 'SC').reduce((s, w) => s + w.cost, 0),
        sc: ws.filter((w) => w.kind === 'SC').reduce((s, w) => s + w.cost, 0),
      }
    })
    const byDept = [...groupBy(inMonth, (w) => w.dept_name ?? '(chưa gán tổ)').entries()]
      .map(([name, l]) => ({ name, cost: l.reduce((s, w) => s + w.cost, 0) }))
      .sort((x, y) => y.cost - x.cost)
    return { month, current: cur, rows: inMonth, series, by_dept: byDept }
  },

  // ── Dụng cụ theo người ───────────────────────────────────────────────────

  async tools(user: User) {
    const [c, meta, assets, moves] = await Promise.all([
      ctx(),
      assetsMeta(user),
      assetsRepo.listAssets(),
      assetsRepo.listMovements(),
    ])
    const tools = assets
      .filter((a) => a.kind === 'tool' && inBooks(a.status))
      .map((a) => ({
        ...a,
        group_name: c.groups.get(a.group_id)?.name ?? a.group_id,
        dept_name: a.department_id ? (c.depts.get(a.department_id) ?? null) : null,
      }))
    const lastGive = new Map<string, string>()
    for (const m of moves)
      if (m.type === 'CP' && m.to_employee_id && !lastGive.has(m.to_employee_id))
        lastGive.set(m.to_employee_id, m.moved_on)
    const holders = [
      ...groupBy(
        tools.filter((t) => t.holder_employee_id),
        (t) => t.holder_employee_id!,
      ).entries(),
    ]
      .map(([empId, list]) => ({
        person: person(c, empId),
        tools: list,
        last_given: lastGive.get(empId) ?? null,
      }))
      .filter((h) => h.person)
      .sort(
        (x, y) =>
          Number(!x.person!.left_on) - Number(!y.person!.left_on) ||
          x.person!.name.localeCompare(y.person!.name, 'vi'),
      )
    return {
      meta,
      today: c.today,
      holders,
      store: tools.filter((t) => !t.holder_employee_id),
      options: formOptions(c),
    }
  },

  async give(user: User, input: ToolGiveInput) {
    await assertAction(user, 'assets.tools')
    const c = await ctx()
    const emp = c.emps.get(input.employee_id)
    if (!emp || !emp.active)
      throw BadRequest('Nhân viên không còn làm việc — không giao được')
    const list = await assetsRepo.findAssets(input.asset_ids)
    if (list.length !== input.asset_ids.length) throw NotFound('Có dụng cụ không tồn tại')
    const bad = list.find(
      (a) => a.kind !== 'tool' || a.status !== 'chua_dung' || a.holder_employee_id,
    )
    if (bad) throw BadRequest(`${bad.code} không nằm trong kho — thu hồi trước khi giao`)
    await assetsRepo.updateAssets(input.asset_ids, {
      status: 'dang_dung',
      holder_employee_id: emp.id,
    })
    await assetsRepo.insertMovement({
      no: docNo('CP', await assetsRepo.nextNo('CP')),
      type: 'CP',
      moved_on: input.moved_on,
      asset_ids: input.asset_ids,
      from_department_id: null,
      to_department_id: null,
      from_employee_id: null,
      to_employee_id: emp.id,
      note: input.note,
      created_by: user.id,
    })
    return { count: list.length, employee: emp.full_name }
  },

  async recall(user: User, input: ToolRecallInput) {
    await assertAction(user, 'assets.tools')
    const list = await assetsRepo.findAssets(input.asset_ids)
    if (list.length !== input.asset_ids.length) throw NotFound('Có dụng cụ không tồn tại')
    const bad = list.find((a) => a.kind !== 'tool' || !a.holder_employee_id)
    if (bad) throw BadRequest(`${bad.code} không có ai đang giữ`)
    // Mỗi người một phiếu TH — phiếu nói rõ thu từ ai.
    for (const [empId, l] of groupBy(list, (a) => a.holder_employee_id!)) {
      await assetsRepo.insertMovement({
        no: docNo('TH', await assetsRepo.nextNo('TH')),
        type: 'TH',
        moved_on: input.moved_on,
        asset_ids: l.map((a) => a.id),
        from_department_id: null,
        to_department_id: null,
        from_employee_id: empId,
        to_employee_id: null,
        note: input.note,
        created_by: user.id,
      })
    }
    await assetsRepo.updateAssets(input.asset_ids, {
      status: input.condition === 'hong' ? 'hong' : 'chua_dung',
      holder_employee_id: null,
    })
    return { count: list.length }
  },
}

// ── Lịch sử một máy ────────────────────────────────────────────────────────

function history(
  c: Ctx,
  wos: WorkOrderRow[],
  issues: IssueRow[],
  moves: Awaited<ReturnType<typeof assetsRepo.listMovements>>,
  names: Map<string, string>,
): HistoryMark[] {
  const marks: HistoryMark[] = []
  for (const w of wos) {
    const parts = w.parts.length
      ? ` · vật tư: ${w.parts.map((p) => `${p.name} ×${p.qty}`).join(', ')}`
      : ''
    marks.push({
      key: `w${w.id}`,
      at: w.done_on,
      label: `${WO_KIND[w.kind].label} · ${w.no} · ${w.title}`,
      actor: person(c, w.tech_employee_id)?.name ?? w.vendor,
      detail: `${w.cost.toLocaleString('vi-VN')} đ${w.downtime_hours ? ` · dừng ${w.downtime_hours} giờ` : ''}${parts}`,
      tone: w.kind === 'SC' ? 'warn' : 'done',
    })
  }
  for (const i of issues) {
    marks.push({
      key: `i${i.id}`,
      at: i.reported_at,
      label: `Báo hỏng · ${i.no} · ${ISSUE_STATUS[i.status].label.toLowerCase()}`,
      actor: i.reporter_user_id ? (names.get(i.reporter_user_id) ?? null) : null,
      detail: i.description,
      tone: 'stop',
    })
  }
  for (const m of moves) {
    const to = m.to_employee_id
      ? `cho ${person(c, m.to_employee_id)?.name ?? ''}`
      : m.to_department_id
        ? `về ${c.depts.get(m.to_department_id) ?? ''}`
        : ''
    const from = m.from_employee_id
      ? `từ ${person(c, m.from_employee_id)?.name ?? ''}`
      : ''
    marks.push({
      key: `m${m.id}`,
      at: m.moved_on,
      label: `${MOVE_LABEL[m.type]} · ${m.no}`,
      actor: m.created_by ? (names.get(m.created_by) ?? null) : null,
      detail: [from, to, m.note].filter(Boolean).join(' · ') || null,
      tone: 'act',
    })
  }
  return marks.sort((x, y) => y.at.localeCompare(x.at))
}

export type { RepairStats }
