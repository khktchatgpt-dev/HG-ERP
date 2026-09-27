import { authService } from '@/modules/core/auth/auth.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { approvalEventsRepo } from '@/modules/core/approvals/approvals.repo'
import { loadWatchPos, todayIso } from '@/app/(workspace)/planning/_data/watch'
import { buildPurchasingWatch } from '@/lib/purchasing-watch'
import { givenNames } from '@/lib/po-list-labels'
import { GiamSatMuaHangScreen } from './GiamSatMuaHangScreen'
import { ExecKitFrame } from '../_shell/KitFrame'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ban Giám đốc · Mua hàng' }

/**
 * GIÁM SÁT MUA HÀNG (/exec/purchasing) — thay trang "Mua hàng & NCC" cũ
 * (27/09/2026, chủ dự án chốt). Layout exec đã gác quyền.
 *
 * Nguồn số: `loadWatchPos` — CÙNG tập Bàn làm việc / Hộp thư Mua hàng dùng, và
 * `buildPurchasingWatch` phân loại bằng chính `classifyTodo` của Hộp thư.
 */
export default async function ExecPurchasingPage() {
  const user = await authService.requirePageUser()
  const today = todayIso()
  const [{ rows, truncatedAt }, users] = await Promise.all([
    loadWatchPos(user),
    usersRepo.list(),
  ])
  const w = buildPurchasingWatch(rows, today)

  const ownerIds = new Set(w.buyers.map((b) => b.id).filter((x): x is string => !!x))
  const people = users
    .filter((u) => ownerIds.has(u.id))
    .map((u) => ({ id: u.id, name: u.name ?? u.email }))
  const nick = givenNames(people)
  const names = Object.fromEntries(
    people.map((p) => [p.id, [nick.get(p.id) ?? p.name, p.name] as [string, string]]),
  )

  // Chờ ký lâu nhất — CÙNG mốc với hộp ký: lần gửi duyệt cuối.
  const pending = rows.filter((p) => p.status === 'pending_approval')
  const sent = await approvalEventsRepo.lastSubmittedAt(
    'po',
    pending.map((p) => p.id),
  )
  const daysSince = (iso: string) =>
    Math.max(
      0,
      Math.round((Date.parse(today) - Date.parse(iso.slice(0, 10))) / 86_400_000),
    )
  const oldestPendingDays = pending.reduce(
    (m, p) => Math.max(m, daysSince(sent.get(p.id) ?? p.created_at)),
    0,
  )

  return (
    <ExecKitFrame>
      <GiamSatMuaHangScreen
        w={w}
        names={names}
        oldestPendingDays={oldestPendingDays}
        truncatedAt={truncatedAt}
      />
    </ExecKitFrame>
  )
}
