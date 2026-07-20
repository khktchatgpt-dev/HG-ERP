import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isProductionStaff } from '@/modules/dept/production/production.service'
import { teamService } from '@/modules/dept/production/team.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { TeamKanban } from './TeamKanban'

/**
 * Menu "Việc của tổ" (tách vai 07/2026) — Kanban thẻ LSX × công đoạn của TỔ
 * MÌNH: Chưa làm / Đang làm / Hoàn thành. NV tổ bị khoá đúng công đoạn tổ;
 * admin/manager chọn tổ để soi (?stage=).
 */
export default async function TeamBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>
}) {
  const user = (await authService.currentUser())!
  const canView =
    user.role === 'admin' || user.role === 'manager' || (await isProductionStaff(user))
  if (!canView) redirect('/production')

  const { stage } = await searchParams
  const stages = await productionRepo.listStages()
  // Stage lạ trên URL → coi như chưa chọn (đỡ nổ trang vì gõ tay).
  const wanted = stages.some((s) => s.code === stage) ? stage : undefined
  const board = await teamService.board(user, { stage: wanted })

  return (
    <TeamKanban
      board={board}
      stages={stages}
      // Không bị khoá theo tổ (manager/admin/NV chưa gán tổ) → được chọn tổ.
      canPick={!board.team}
    />
  )
}
