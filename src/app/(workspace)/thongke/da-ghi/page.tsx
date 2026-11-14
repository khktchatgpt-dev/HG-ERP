import { authService } from '@/modules/core/auth/auth.service'
import { soDaGhiService } from '@/modules/dept/production/so-da-ghi.service'
import { SoDaGhiScreen } from './SoDaGhiScreen'

export const dynamic = 'force-dynamic'

/**
 * SỔ ĐÃ GHI — thống kê tổ xem lại, soát, sửa những gì đã ghi trước khi chốt sổ
 * ngày (bản vẽ 13/11/2026 https://claude.ai/artifact/4ub2By9o62SJN4wCcXGrFe).
 * Tham số: `date` (ngày neo, mặc định hôm nay) · `xem=tuan` (7 ngày) · `to`
 * (id tổ | all; mặc định tổ của tài khoản) · `phieu` (số phiếu PBS-…).
 */
export default async function SoDaGhiPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; xem?: string; to?: string; phieu?: string }>
}) {
  const [sp, user] = await Promise.all([searchParams, authService.requirePageUser()])
  const p = await soDaGhiService.load(user, sp)
  return <SoDaGhiScreen p={p} />
}
