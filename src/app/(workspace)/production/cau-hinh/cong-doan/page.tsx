import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { stageConfigService } from '@/modules/dept/production/stage-config.service'
import { CongDoanScreen } from './CongDoanScreen'

export const metadata = { title: 'Sản xuất · Cấu hình công đoạn' }
export const dynamic = 'force-dynamic'

/**
 * CẤU HÌNH CÔNG ĐOẠN — B1 của docs/san-xuat-cau-hinh-thiet-ke.md (duyệt
 * 03/11/2026, bản vẽ C1 https://claude.ai/artifact/4VNmsX9hoLFmgic9AGrCci).
 *
 * Quản đốc / admin — "công đoạn này đếm bằng gì, tổ nào làm, phiếu ghi sổ có
 * những ô nào, lỗi gì?". Một màn cho bốn thứ đang nằm ở bốn bảng. Không kit,
 * khung `_erp` riêng của Sản xuất.
 *
 * Quyền xem = quyền sửa (`production.stage.configure`): đây là bàn điều khiển,
 * không phải trang tra cứu. Không có quyền thì về Tình hình xưởng.
 */
export default async function CongDoanPage() {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'production.stage.configure'))) redirect('/production')
  const data = await stageConfigService.get(user)
  return <CongDoanScreen data={data} />
}
