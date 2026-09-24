import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { ViecCuaToScreen } from './ViecCuaToScreen'

export const dynamic = 'force-dynamic'

/**
 * M5 — VIỆC CỦA TỔ. Trang chính của bề mặt XƯỞNG.
 *
 * CHỈ ĐỌC (chủ dự án chốt 18/09/2026: "tổ trưởng chỉ xem để biết tình hình").
 * Mọi đường GHI đã bỏ khỏi màn này — sổ sản lượng chỉ có một cửa vào, là màn
 * Ghi sản lượng của thống kê.
 *
 * KHÔNG ký URL ảnh SP nữa: bản cũ ký từng ảnh một cho mỗi thẻ việc, tức mỗi
 * lần mở màn là một loạt vòng gọi Storage chỉ để trang trí. Màn mới là bảng,
 * và bảng không cần ảnh.
 */
export default async function TeamHomePage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>
}) {
  const user = await authService.requirePageUser()
  const { team } = await searchParams
  const board = await jobsService.teamBoard(user, { team })

  // Tổ viên chỉ thấy tổ mình; quản đốc/GĐ soi được tổ khác.
  const canPick = user.role !== 'employee'
  const teams = (await departmentsRepo.list())
    .filter((d) => d.workspace_id === 'production')
    .map((d) => ({ id: d.id, name: d.name }))

  return (
    <ViecCuaToScreen
      teamId={board.team_id}
      teamName={teams.find((t) => t.id === board.team_id)?.name ?? null}
      cards={board.cards.map((c) => ({ ...c, image_url: null }))}
      teams={canPick ? teams : []}
      canPick={canPick}
    />
  )
}
