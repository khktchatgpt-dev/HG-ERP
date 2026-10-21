import { BadRequest, Conflict, NotFound } from '@/server/http'
// Handler chỉ được đăng ký khi có chỗ import `register` — bus không tự nạp
// (bẫy đã dính ở Góp ý 21/10/2026: mọi luồng chạy mà 0 thông báo).
import '@/events/register'
import { emit } from '@/events/bus'
import type { User } from '@/modules/core/users/users.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { rbacRepo } from '@/modules/core/rbac/rbac.repo'
import { todayVn } from '@/lib/date-vn'
import {
  acceptGoesTo,
  addDaysIso,
  assetOnDone,
  assetOnReport,
  assetOnStart,
  docNo,
  inBooks,
  ISSUE_FROM,
  isOpenIssue,
  shortMoney,
  WO_KIND,
  woCost,
  type IssueAction,
} from '@/lib/may-moc'
import { assetsRepo, type AssetRow, type IssueLog, type IssueRow } from './assets.repo'
import { assetsMeta } from './assets.service'
import type { IssueAcceptInput, IssueCreateInput, IssueDoneInput } from './assets.schema'

/**
 * PHIẾU BÁO HỎNG (BH) — máy trạng thái ở bản vẽ duyệt 21/10/2026:
 *
 *   moi ──nhận việc, dự toán ≤ hạn mức──▶ dang_sua ──sửa xong──▶ xong (sinh PSC)
 *    │  └──nhận việc, dự toán > hạn mức──▶ cho_duyet ──GĐ duyệt──▶ dang_sua
 *    │                                       └──GĐ không duyệt + lý do──▶ moi
 *    └──huỷ + lý do (người báo / Cơ điện)──▶ huy (máy về trạng thái trước)
 *
 * Mỗi chuyển ghi một dòng vết. Cập nhật có điều kiện trạng thái cũ, nên hai
 * người bấm cùng lúc thì người sau nhận 409 chứ không ghi đè nhau.
 */

const label = (a: AssetRow) => `${a.code} ${a.name}`

async function logLine(user: User, text: string): Promise<IssueLog> {
  const name = (await usersRepo.displayNamesByIds([user.id])).get(user.id) ?? user.email
  return { at: new Date().toISOString(), by: user.id, name, text }
}

async function load(id: string) {
  const i = await assetsRepo.findIssue(id)
  if (!i) throw NotFound('Không có phiếu báo hỏng này')
  const a = await assetsRepo.findAsset(i.asset_id)
  if (!a) throw NotFound('Máy của phiếu không còn')
  return { i, a }
}

function guard(action: IssueAction, i: IssueRow) {
  if (!ISSUE_FROM[action].includes(i.status)) {
    throw Conflict(`Phiếu ${i.no} đã chuyển trạng thái — tải lại trang để xem`)
  }
}

async function transition(
  i: IssueRow,
  action: IssueAction,
  patch: Partial<IssueRow>,
): Promise<IssueRow> {
  const r = await assetsRepo.updateIssue(i.id, [...ISSUE_FROM[action]], patch)
  if (!r) throw Conflict(`Phiếu ${i.no} vừa được người khác xử lý — tải lại trang`)
  return r
}

const maintenanceIds = () => rbacRepo.userIdsWithPermission('assets.manage')
const approverIds = () => rbacRepo.userIdsWithPermission('assets.approve')

export const issuesService = {
  /** Phiếu báo hỏng: đang mở + 60 ngày gần đây (màn Báo hỏng). */
  async list(user: User) {
    const [meta, issues, assets, emps, approveOver] = await Promise.all([
      assetsMeta(user),
      assetsRepo.listIssues({ since: addDaysIso(todayVn(), -60) }),
      assetsRepo.listAssets(),
      assetsRepo.employees(),
      assetsRepo.approveOver(),
    ])
    const byId = new Map(assets.map((a) => [a.id, a]))
    const empName = new Map(emps.map((e) => [e.id, e.full_name]))
    const reporters = await usersRepo.displayNamesByIds([
      ...new Set(issues.map((i) => i.reporter_user_id).filter((x): x is string => !!x)),
    ])
    return {
      meta,
      me: user.id,
      today: todayVn(),
      approve_over: approveOver,
      issues: issues.map((i) => {
        const a = byId.get(i.asset_id)
        return {
          ...i,
          asset: a
            ? {
                id: a.id,
                code: a.code,
                name: a.name,
                department_id: a.department_id,
                status: a.status,
              }
            : null,
          reporter_name: i.reporter_user_id
            ? (reporters.get(i.reporter_user_id) ?? null)
            : null,
          tech_name: i.tech_employee_id
            ? (empName.get(i.tech_employee_id) ?? null)
            : null,
        }
      }),
      assets: assets
        .filter((a) => inBooks(a.status))
        .map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          kind: a.kind,
          department_id: a.department_id,
        })),
      techs: emps
        .filter((e) => e.active && e.team === 'Tổ Cơ Điện')
        .map((e) => ({ id: e.id, name: e.full_name })),
    }
  },

  /** Báo hỏng — mọi người đăng nhập (quét tem QR trên máy là báo được). */
  async create(user: User, input: IssueCreateInput): Promise<IssueRow> {
    const a = await assetsRepo.findAsset(input.asset_id)
    if (!a || !inBooks(a.status)) throw NotFound('Máy không còn trên sổ')
    const open = await assetsRepo.openIssueOf(a.id)
    if (open)
      throw BadRequest(
        `Máy này đang có phiếu ${open.no} chưa xong — ghi thêm vào phiếu đó`,
      )
    const no = docNo('BH', await assetsRepo.nextNo('BH'))
    let i: IssueRow
    try {
      i = await assetsRepo.insertIssue({
        no,
        asset_id: a.id,
        reporter_user_id: user.id,
        description: input.description,
        priority: input.priority,
        status: 'moi',
        prev_asset_status: a.status,
        log: [],
      })
    } catch (e) {
      // Chỉ mục duy nhất "một máy một phiếu mở" — hai người báo cùng lúc.
      if (String(e).includes('asset_issues_one_open')) {
        throw BadRequest('Vừa có người báo hỏng máy này — tải lại trang để xem phiếu')
      }
      throw e
    }
    const files = await assetsRepo.claimFiles(input.file_ids, i.id, user.id)
    if (files.length)
      i = (await assetsRepo.updateIssue(i.id, ['moi'], { file_ids: files })) ?? i
    const next = assetOnReport(input.priority, a.status)
    if (next !== a.status) await assetsRepo.updateAsset(a.id, { status: next })
    await emit({
      name: 'asset.issue.reported',
      issue_id: i.id,
      no: i.no,
      label: label(a),
      stops: input.priority === 'dung_may',
      actor_id: user.id,
      recipient_ids: await maintenanceIds(),
    })
    return i
  },

  /** Cơ điện nhận việc: giao thợ / thuê ngoài + dự toán. Vượt hạn mức thì chờ GĐ. */
  async accept(user: User, id: string, input: IssueAcceptInput): Promise<IssueRow> {
    await assertAction(user, 'assets.work')
    const { i, a } = await load(id)
    guard('accept', i)
    const to = acceptGoesTo(input.estimate, await assetsRepo.approveOver())
    const who = input.tech_employee_id
      ? ((await assetsRepo.employees()).find((e) => e.id === input.tech_employee_id)
          ?.full_name ?? 'thợ')
      : input.vendor!
    const text =
      to === 'cho_duyet'
        ? `Dự toán ${input.estimate!.toLocaleString('vi-VN')} đ (${who}), vượt hạn mức nên chờ Giám đốc duyệt.${input.note ? ` ${input.note}` : ''}`
        : `Nhận việc, giao ${who}.${input.estimate ? ` Dự toán ${input.estimate.toLocaleString('vi-VN')} đ.` : ''}${input.note ? ` ${input.note}` : ''}`
    const r = await transition(i, 'accept', {
      status: to,
      tech_employee_id: input.tech_employee_id,
      vendor: input.tech_employee_id ? null : input.vendor,
      estimate: input.estimate,
      started_on: to === 'dang_sua' ? todayVn() : null,
      log: [...i.log, await logLine(user, text)],
    })
    if (to === 'dang_sua') {
      const next = assetOnStart(i.priority, a.status)
      if (next !== a.status) await assetsRepo.updateAsset(a.id, { status: next })
    } else {
      await emit({
        name: 'asset.issue.approval_needed',
        issue_id: i.id,
        no: i.no,
        label: label(a),
        estimate: input.estimate ?? 0,
        actor_id: user.id,
        recipient_ids: await approverIds(),
      })
    }
    return r
  },

  async approve(user: User, id: string): Promise<IssueRow> {
    await assertAction(user, 'assets.approve')
    const { i, a } = await load(id)
    guard('approve', i)
    const r = await transition(i, 'approve', {
      status: 'dang_sua',
      started_on: todayVn(),
      log: [
        ...i.log,
        await logLine(
          user,
          `Duyệt dự toán ${(i.estimate ?? 0).toLocaleString('vi-VN')} đ.`,
        ),
      ],
    })
    const next = assetOnStart(i.priority, a.status)
    if (next !== a.status) await assetsRepo.updateAsset(a.id, { status: next })
    await emit({
      name: 'asset.issue.decided',
      issue_id: i.id,
      no: i.no,
      label: label(a),
      approved: true,
      reason: null,
      actor_id: user.id,
      recipient_ids: await maintenanceIds(),
    })
    return r
  },

  async reject(user: User, id: string, reason: string): Promise<IssueRow> {
    await assertAction(user, 'assets.approve')
    const { i, a } = await load(id)
    guard('reject', i)
    const r = await transition(i, 'reject', {
      status: 'moi',
      estimate: null,
      // Trả về Cơ điện làm phương án khác — người sửa / thuê ngoài cũ không còn đúng.
      tech_employee_id: null,
      vendor: null,
      log: [
        ...i.log,
        await logLine(
          user,
          `Không duyệt dự toán ${shortMoney(i.estimate ?? 0)}: ${reason}`,
        ),
      ],
    })
    await emit({
      name: 'asset.issue.decided',
      issue_id: i.id,
      no: i.no,
      label: label(a),
      approved: false,
      reason,
      actor_id: user.id,
      recipient_ids: await maintenanceIds(),
    })
    return r
  },

  /** Sửa xong: sinh phiếu PSC (vật tư + công + giờ dừng), máy chạy lại. */
  async done(user: User, id: string, input: IssueDoneInput): Promise<IssueRow> {
    await assertAction(user, 'assets.work')
    const { i, a } = await load(id)
    guard('done', i)
    const today = todayVn()
    const wo = await assetsRepo.insertWorkOrder({
      no: docNo(WO_KIND.SC.prefix, await assetsRepo.nextNo(WO_KIND.SC.prefix)),
      kind: 'SC',
      asset_id: a.id,
      plan_id: null,
      issue_id: i.id,
      title: i.description.split(/[.\n]/)[0].slice(0, 200) || i.description.slice(0, 200),
      done_on: today,
      tech_employee_id: i.tech_employee_id,
      vendor: i.vendor,
      parts: input.parts,
      labor: input.labor,
      cost: woCost(input.parts, input.labor),
      downtime_hours: input.downtime_hours,
      hours_reading: null,
      note: input.note,
      created_by: user.id,
    })
    const r = await transition(i, 'done', {
      status: 'xong',
      work_order_id: wo.id,
      log: [
        ...i.log,
        await logLine(
          user,
          `Sửa xong (${wo.no}, ${wo.cost.toLocaleString('vi-VN')} đ): ${input.note}`,
        ),
      ],
    })
    const next = assetOnDone(a.status)
    if (next !== a.status) await assetsRepo.updateAsset(a.id, { status: next })
    await emit({
      name: 'asset.issue.done',
      issue_id: i.id,
      no: i.no,
      label: label(a),
      cost: wo.cost,
      actor_id: user.id,
      recipient_ids: i.reporter_user_id ? [i.reporter_user_id] : [],
    })
    return r
  },

  /** Huỷ phiếu chưa nhận (báo nhầm, trùng, tự hết) — người báo hoặc Cơ điện. */
  async cancel(user: User, id: string, reason: string): Promise<IssueRow> {
    const { i, a } = await load(id)
    guard('cancel', i)
    if (i.reporter_user_id !== user.id) await assertAction(user, 'assets.work')
    const r = await transition(i, 'cancel', {
      status: 'huy',
      cancel_reason: reason,
      log: [...i.log, await logLine(user, `Huỷ phiếu: ${reason}`)],
    })
    // Trả máy về trạng thái trước khi báo — chỉ khi chính phiếu này đã đổi nó.
    if (i.prev_asset_status && a.status === 'hong' && i.prev_asset_status !== 'hong') {
      await assetsRepo.updateAsset(a.id, { status: i.prev_asset_status })
    }
    return r
  },

  /** Phiếu đang mở của một máy (cho thanh cảnh báo trên hồ sơ máy). */
  isOpen: (i: IssueRow) => isOpenIssue(i.status),
}
