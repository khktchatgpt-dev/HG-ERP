import { authService } from '@/modules/core/auth/auth.service'
import { soDaGhiService } from '@/modules/dept/production/so-da-ghi.service'
import { SoDaGhiScreen } from './SoDaGhiScreen'

export const dynamic = 'force-dynamic'

/**
 * SỔ THEO NGÀY (tên cũ Sổ đã ghi) — thống kê tổ xem lại, soát, sửa những gì đã
 * ghi trong MỘT ngày trước khi chốt sổ (bản vẽ 13/11/2026 4ub2By9o…, 14/11 CUUfVcZx…,
 * 14/11 CpB5jKcS… Q5 bỏ chế độ 7 ngày). URL giữ `/thongke/da-ghi` cho link cũ.
 * Tham số: `date` (mặc định hôm nay) · `to` (id tổ | all; mặc định tổ của tài
 * khoản) · `phieu` (số phiếu PBS-…) · `cd` (chip công đoạn chọn sẵn).
 */
export default async function SoDaGhiPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; to?: string; phieu?: string; cd?: string }>
}) {
  const [sp, user] = await Promise.all([searchParams, authService.requirePageUser()])
  const p = await soDaGhiService.load(user, sp)
  return <SoDaGhiScreen p={p} />
}
