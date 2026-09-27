import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import {
  loadWatchPos,
  todayIso,
  type WatchPo,
} from '@/app/(workspace)/planning/_data/watch'
import { loadMeeting } from '@/app/(workspace)/planning/_data/meeting'
import { buildAgenda, type MeetingRiskLevel } from '@/lib/supply-meeting'
import {
  SUPPLY_TODO,
  SUPPLY_TODO_KINDS,
  classifyTodo,
  countIncomingSoon,
  incomingBucket,
  type SupplyTodoKind,
} from '@/lib/supply-watch'
import { defaultScope, isMyPo, myLsxIds, parseScope, poOwner } from '@/lib/supply-scope'
import {
  BanLamViecScreen,
  type Agenda,
  type BuyerRow,
  type Desk,
  type Issue,
  type PendingRow,
  type Todo,
} from './BanLamViecScreen'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mua hàng · Bàn làm việc' }

/**
 * BÀN LÀM VIỆC CỦA NGƯỜI MUA — chép Dynamics 365 workspace ("Purchase order
 * preparation"): MỘT trang cho một vai, gồm ba tầng cố định
 *
 *   1. ô số (summary tiles) — mỗi ô là một lời hứa, bấm ra đúng danh sách;
 *   2. danh sách theo tab (tabbed list);
 *   3. liên kết (related links) — đường tắt tới các danh sách của module.
 *
 * CÁ NHÂN HOÁ (27/09/2026, chốt theo khuyến nghị): trang tính sẵn HAI bàn —
 * "của tôi" và "cả phòng" — bằng CÙNG các hàm (`classifyTodo`,
 * `countIncomingSoon`, `loadMeeting`); công tắc phạm vi chỉ chọn bàn nào hiện,
 * không tính lại gì. "Của tôi" theo một nghĩa duy nhất ở `lib/supply-scope`
 * (đơn tôi phụ trách, lệnh tôi có đơn).
 *
 * Người có quyền DUYỆT đơn mua (chị Thảo, Giám đốc) mặc định nhìn cả phòng và
 * có thêm hai tab: "Chờ tôi duyệt" (cũ nhất trước) và "Theo người mua" — ai
 * đang kẹt ở đâu, bấm vào xem đúng bàn làm việc của người đó (`?nguoi=`, CHỈ
 * XEM: mọi thao tác ghi vẫn đi qua trang đơn và bị server gác như cũ).
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ pham_vi?: string; nguoi?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const today = todayIso()
  const canApprove = user.role === 'admin' || (await canAction(user, 'supply.po.approve'))
  const [{ rows, truncatedAt }, meeting, extraLsx, users] = await Promise.all([
    loadWatchPos(user),
    loadMeeting(user),
    posRepo.listAllExtraLsx(),
    usersRepo.list(),
  ])
  const nameOf = (id: string | null) => {
    const u = id ? users.find((x) => x.id === id) : null
    return u ? (u.name ?? u.email) : '—'
  }

  // XEM BÀN CỦA NGƯỜI KHÁC — chỉ người duyệt, và chỉ người có thật.
  const viewAsUser =
    canApprove && sp.nguoi && sp.nguoi !== user.id
      ? (users.find((u) => u.id === sp.nguoi) ?? null)
      : null
  const subjectId = viewAsUser?.id ?? user.id

  const withLsx = rows.map((p) => ({
    ...p,
    extra_lsx_ids: (extraLsx.get(p.id) ?? []).map((x) => x.id),
  }))

  const buildDesk = (set: WatchPo[], lsxFilter: Set<string> | null): Desk => {
    const counts = {} as Record<SupplyTodoKind, number>
    for (const k of SUPPLY_TODO_KINDS) counts[k] = 0
    const todos: Todo[] = []
    for (const p of set) {
      const k = classifyTodo(p, today)
      if (!k) continue
      counts[k] += 1
      todos.push({
        id: p.id,
        code: p.code,
        kind: k,
        action: SUPPLY_TODO[k].action,
        supplier: p.supplier_name ?? '—',
        lsx: p.lsx_code ?? null,
        owner: nameOf(poOwner(p)),
        expected_at: p.expected_at ?? null,
        total: p.total,
        currency: p.currency,
      })
    }
    todos.sort((a, b) => SUPPLY_TODO[a.kind].order - SUPPLY_TODO[b.kind].order)
    const inLsx = meeting.rows.filter((m) => !lsxFilter || lsxFilter.has(m.row.id))
    const riskCounts = { stop: 0, warn: 0, watch: 0, inflight: 0, ready: 0 } as Record<
      MeetingRiskLevel,
      number
    >
    for (const m of inLsx) riskCounts[m.risk.level]++
    const issues: Issue[] = meeting.issues
      .filter((m) => !lsxFilter || lsxFilter.has(m.row.id))
      .map((m) => ({
        id: m.row.id,
        code: m.row.code,
        customer: m.row.customer_name,
        level: m.risk.level,
        label: m.risk.label,
        reason: m.risk.reason,
        owner: m.risk.owner,
        due: m.risk.due?.date ?? null,
        poCount: m.row.pos.length,
      }))
    return {
      counts,
      todos,
      incomingSoon: countIncomingSoon(set, today),
      openTotal: set.length,
      riskCounts,
      issues,
      lsxCount: lsxFilter ? lsxFilter.size : meeting.rows.length,
    }
  }

  const mineRows = rows.filter((p) => isMyPo(p, subjectId))
  const desks = {
    toi: buildDesk(mineRows, myLsxIds(withLsx, subjectId)),
    phong: buildDesk(rows, null),
  }

  let approver: { pending: PendingRow[]; buyers: BuyerRow[] } | null = null
  if (canApprove && !viewAsUser) {
    const pending: PendingRow[] = rows
      .filter((p) => p.status === 'pending_approval')
      .sort((a, b) =>
        (a.updated_at ?? a.created_at).localeCompare(b.updated_at ?? b.created_at),
      )
      .map((p) => ({
        id: p.id,
        code: p.code,
        owner: nameOf(poOwner(p)),
        supplier: p.supplier_name ?? '—',
        lsx: p.lsx_code ?? null,
        total: p.total,
        currency: p.currency,
        since: (p.updated_at ?? p.created_at).slice(0, 10),
      }))
    // Theo người mua: người đang cầm ít nhất một đơn còn chạy.
    const byOwner = new Map<string, WatchPo[]>()
    for (const p of rows) {
      if (p.status === 'received' || p.status === 'cancelled') continue
      const o = poOwner(p)
      if (!o) continue
      byOwner.set(o, [...(byOwner.get(o) ?? []), p])
    }
    const buyers: BuyerRow[] = [...byOwner.entries()]
      .map(([id, list]) => {
        const kinds = list.map((p) => classifyTodo(p, today))
        return {
          id,
          name: nameOf(id),
          open: list.length,
          todo: kinds.filter(Boolean).length,
          pending: list.filter((p) => p.status === 'pending_approval').length,
          unconfirmed: kinds.filter((k) => k === 'unconfirmed').length,
          noEta: kinds.filter((k) => k === 'no_eta').length,
          overdue: kinds.filter((k) => k === 'overdue').length,
          incomingSoon: list.filter((p) => {
            const b = incomingBucket(p, today)
            return b === 'today' || b === 'week'
          }).length,
          lsx: myLsxIds(withLsx, id).size,
        }
      })
      .sort((a, b) => b.open - a.open)
    approver = { pending, buyers }
  }

  const agenda: Agenda[] = buildAgenda(meeting.rows).map((a) => ({
    dept: a.dept,
    action: a.action,
    codes: a.rows.map((r) => r.row.code),
    due: a.due,
    rank: a.rank,
  }))

  return (
    <BanLamViecScreen
      today={today}
      meId={user.id}
      userName={user.name ?? user.email}
      viewAs={viewAsUser ? { id: viewAsUser.id, name: viewAsUser.name ?? viewAsUser.email } : null} // prettier-ignore
      defaultScope={viewAsUser ? 'toi' : defaultScope({ canApprove })}
      urlScope={viewAsUser ? 'toi' : parseScope(sp.pham_vi)}
      desks={desks}
      approver={approver}
      agenda={agenda}
      truncatedAt={truncatedAt}
    />
  )
}
