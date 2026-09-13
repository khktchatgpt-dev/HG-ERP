import { authService } from '@/modules/core/auth/auth.service'
import { loadWatchPos, todayIso } from '@/app/(workspace)/planning/_data/watch'
import { loadMeeting } from '@/app/(workspace)/planning/_data/meeting'
import { buildAgenda } from '@/lib/supply-meeting'
import {
  SUPPLY_TODO,
  SUPPLY_TODO_KINDS,
  classifyTodo,
  countIncomingSoon,
  type SupplyTodoKind,
} from '@/lib/supply-watch'
import { BanLamViecScreen, type Agenda, type Issue, type Todo } from './BanLamViecScreen'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mua hàng · Bàn làm việc' }

/**
 * BÀN LÀM VIỆC CỦA NGƯỜI MUA — chép Dynamics 365 workspace ("Purchase order
 * preparation"): MỘT trang cho một vai, gồm ba tầng cố định
 *
 *   1. ô số (summary tiles) — mỗi ô là một lời hứa, bấm ra đúng danh sách;
 *   2. danh sách theo tab (tabbed list) — việc chờ tôi / đơn cần chú ý / lệnh
 *      có nguy cơ / việc cần quyết trong họp;
 *   3. liên kết (related links) — đường tắt tới các danh sách của module.
 *
 * Đây là chỗ BỐN TRANG CŨ gộp lại (Vào việc, Chờ tôi xử lý, Vấn đề, Họp).
 * Chủ dự án chỉ ra 10/09/2026: bốn trang cho một vai là dashboard kiểu web,
 * không hệ ERP nào làm thế. Tab nằm TRONG một trang là mẫu Dynamics; bốn
 * trang trên một thanh mới là lối mòn.
 *
 * MỌI SỐ ĐẾM DÙNG ĐÚNG HÀM CỦA TRANG ĐÍCH: `classifyTodo` (hộp thư),
 * `countIncomingSoon` (khung nhìn đang về), `loadMeeting` + `buildAgenda`
 * (cùng phép tính với file Excel họp tuần). Không có nguồn số thứ hai.
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  const today = todayIso()
  const [{ rows, truncatedAt }, meeting] = await Promise.all([
    loadWatchPos(user),
    loadMeeting(user),
  ])

  const mine = rows.filter((p) => p.assigned_to === user.id)
  const counts = {} as Record<SupplyTodoKind, number>
  for (const k of SUPPLY_TODO_KINDS) counts[k] = 0
  const todos: Todo[] = []
  for (const p of mine) {
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
      expected_at: p.expected_at ?? null,
      total: p.total,
      currency: p.currency,
    })
  }
  todos.sort((a, b) => SUPPLY_TODO[a.kind].order - SUPPLY_TODO[b.kind].order)

  // Lệnh có nguy cơ — cùng nguồn với trang họp và file Excel họp tuần.
  const issues: Issue[] = meeting.issues.map((m) => ({
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
      userName={user.name ?? user.email}
      counts={counts}
      incomingSoon={countIncomingSoon(rows, today)}
      openTotal={rows.length}
      riskCounts={meeting.counts}
      todos={todos}
      issues={issues}
      agenda={agenda}
      truncatedAt={truncatedAt}
    />
  )
}
