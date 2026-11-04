import { authService } from '@/modules/core/auth/auth.service'
import {
  componentsService,
  isUnshaped,
  needsRoute,
  type ShapingRow,
} from '@/modules/dept/production/components.service'
import { canEditComponents } from '@/modules/dept/production/perms'
import { loadDinhHinhProps } from '../lsx/[id]/dinh-hinh/load'
import { LoTrinhGopScreen } from './LoTrinhGopScreen'

export const metadata = { title: 'Sản xuất · Lộ trình công đoạn' }
export const dynamic = 'force-dynamic'

/**
 * LỘ TRÌNH CÔNG ĐOẠN — màn gộp (04/11/2026, bản vẽ
 * https://claude.ai/artifact/A4U5vgYDeUwYrnDUkzfCq1). Khuôn C + F trong một
 * màn: trái là lệnh đang chạy, phải là ma trận cụm × công đoạn của lệnh đang
 * chọn (`?lsx=`). Không chọn thì mở lệnh đầu tiên còn cụm chưa khai.
 *
 * TỰ NẠP KHI MỞ (chủ dự án chốt câu 3 của bản vẽ): lệnh cũ có định mức ở hồ sơ
 * mà chưa có bảng (duyệt trước 04/11) thì nạp ngay lúc mở, cùng hàm nhịp duyệt
 * dùng — Kế hoạch không phải bấm "Nạp từ BOM". Chỉ khi người xem có quyền sửa.
 */
export default async function LoTrinhGopPage({
  searchParams,
}: {
  searchParams: Promise<{ lsx?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const [all, canEdit] = await Promise.all([
    componentsService.shapingOverview(),
    canEditComponents(user),
  ])
  const rank = (r: ShapingRow) => (needsRoute(r) ? 0 : isUnshaped(r) ? 1 : 2)
  const rows = [...all].sort((a, b) => rank(a) - rank(b))

  const picked = (sp.lsx && rows.find((r) => r.lsx.id === sp.lsx)) || rows[0] || null
  let autoNap: { added: number; missing: string[] } | null = null
  if (
    picked &&
    canEdit &&
    isUnshaped(picked) &&
    picked.lines_missing_bom < picked.line_count
  ) {
    try {
      const res = await componentsService.autoShapeFromBom(picked.lsx.id)
      if (res.status === 'added') {
        autoNap = { added: res.added, missing: res.missing }
        picked.component_count = res.added
      }
    } catch (e) {
      console.error('[lo-trinh] tự nạp bảng chi tiết lỗi', picked.lsx.id, e)
    }
  }
  const lenh = picked ? await loadDinhHinhProps(user, picked.lsx.id) : null

  return <LoTrinhGopScreen rows={rows} lenh={lenh} autoNap={autoNap} />
}
