import { authService } from '@/modules/core/auth/auth.service'
import { nxtService } from '@/modules/dept/warehouse/nxt.service'
import { docKy } from '@/lib/kho-nxt'
import { todayVn } from '@/lib/date-vn'
import { BaoCaoScreen } from './BaoCaoScreen'

export const metadata = { title: 'Kho · Nhập–Xuất–Tồn' }
export const dynamic = 'force-dynamic'

/**
 * BÁO CÁO NHẬP–XUẤT–TỒN THEO KỲ — `/warehouse/bao-cao` (Kho đợt 2 · B6, bản vẽ
 * https://claude.ai/artifact/XCqeNa92MkBZ5oGGwcGrjS duyệt 19/10/2026).
 *
 * Kỳ trên URL (`?tu=&den=`, mặc định tháng hiện tại). Một lượt đọc sổ — báo cáo
 * cần cả lịch sử để ra tồn đầu và giá trị tồn đầu (~0,7 s với 893 dòng).
 */
export default async function BaoCaoPage({
  searchParams,
}: {
  searchParams: Promise<{ tu?: string; den?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const bc = await nxtService.baoCao(user, docKy(sp.tu, sp.den, todayVn()))
  return <BaoCaoScreen bc={bc} />
}
