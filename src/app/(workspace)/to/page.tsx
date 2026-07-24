import { authService } from '@/modules/core/auth/auth.service'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { jobsService } from '@/modules/dept/production/jobs.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { filesService } from '@/modules/core/files/files.service'
import { TeamScreen } from './TeamScreen'

export const dynamic = 'force-dynamic'

/**
 * VIỆC CỦA TỔ — trang chính workspace Tổ sản xuất (0084/0087): chỉ thẻ việc
 * (ảnh SP + thông số + tiến độ + nút Xong). Lệnh đang chạy và Quá trình tổ
 * tách trang riêng trên menu.
 */
export default async function TeamHomePage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>
}) {
  const user = (await authService.currentUser())!
  const { team } = await searchParams
  const board = await jobsService.teamBoard(user, { team })

  // Ảnh SP: ký URL 1 lượt (lỗi ảnh không chặn màn).
  const imageUrls = new Map<string, string>()
  await Promise.all(
    [...new Set(board.cards.map((c) => c.image_file_id).filter(Boolean))].map(
      async (fid) => {
        try {
          imageUrls.set(
            fid as string,
            await filesService.getDownloadUrl(user, fid as string),
          )
        } catch {
          /* ignore */
        }
      },
    ),
  )

  const canPick = user.role !== 'employee'
  const teams = canPick
    ? (await departmentsRepo.list())
        .filter((d) => d.workspace_id === 'production')
        .map((d) => ({ id: d.id, name: d.name }))
    : []

  return (
    <TeamScreen
      teamId={board.team_id}
      cards={board.cards.map((c) => ({
        ...c,
        image_url: c.image_file_id ? (imageUrls.get(c.image_file_id) ?? null) : null,
      }))}
      teams={teams}
      canPick={canPick}
      canConfirm={
        user.role === 'admin' ||
        user.role === 'manager' ||
        (await isProductionStaff(user))
      }
      isManager={user.role === 'admin' || user.role === 'manager'}
    />
  )
}
