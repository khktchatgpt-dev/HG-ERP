import { authService } from '@/modules/core/auth/auth.service'
import { execService } from '@/modules/core/exec/exec.service'
import { ApprovalCenterScreen, type ApprovalKind } from './ApprovalCenterScreen'

/**
 * TRUNG TÂM PHÊ DUYỆT (/exec/approvals) — 15/08/2026.
 *
 * Lịch sử route này: danh sách + buồng lái master-detail → redirect về Hộp ký
 * (14/08) → bản này. Hộp ký chuyển từ trang chủ về đây; trang chủ /exec thành
 * Tổng quan. Link cũ trong thông báo (/exec/approvals/*) vẫn đúng chỗ.
 *
 * `?loai=lsx|po` — thẻ "Chờ tôi phê duyệt" ở Tổng quan lọc sẵn loại phiếu.
 */
export default async function ApprovalCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ loai?: string }>
}) {
  const [user, { loai }] = await Promise.all([
    authService.requirePageUser(),
    searchParams,
  ])
  const box = await execService.signBox(user)
  const initialKind: ApprovalKind = loai === 'lsx' || loai === 'po' ? loai : 'all'
  return <ApprovalCenterScreen box={box} initialKind={initialKind} />
}
