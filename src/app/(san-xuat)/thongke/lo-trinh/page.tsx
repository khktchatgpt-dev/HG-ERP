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
 * LỘ TRÌNH CÔNG ĐOẠN — bản vẽ 3 (04/11/2026,
 * https://claude.ai/artifact/A4U5vgYDeUwYrnDUkzfCq1). Không `?lsx=` → bảng danh
 * sách (khuôn C); có → ma trận một lệnh trọn chiều ngang, ‹ › nhảy giữa các lệnh
 * còn cụm chưa khai.
 *
 * TỰ NẠP KHI MỞ (câu 3 bản vẽ 2): lệnh cũ có định mức ở hồ sơ mà chưa có bảng
 * (duyệt trước 04/11) thì nạp ngay lúc mở, cùng hàm nhịp duyệt dùng. Chỉ khi
 * người xem có quyền sửa.
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

  const picked = sp.lsx ? (rows.find((r) => r.lsx.id === sp.lsx) ?? null) : null
  if (!picked) {
    return (
      <LoTrinhGopScreen
        rows={rows}
        canEdit={canEdit}
        lenh={null}
        nav={null}
        autoNap={null}
      />
    )
  }

  let autoNap: { added: number; missing: string[] } | null = null
  if (canEdit && isUnshaped(picked) && picked.lines_missing_bom < picked.line_count) {
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
  const lenh = await loadDinhHinhProps(user, picked.lsx.id)

  // ‹ › chỉ đi qua các lệnh CÒN cụm chưa khai (việc còn treo); lệnh đang mở
  // không thuộc nhóm thì pos = 0 và ‹ › dẫn tới lệnh đầu / cuối của nhóm.
  const can = rows.filter(needsRoute)
  const idx = can.findIndex((r) => r.lsx.id === picked.lsx.id)
  const nav = {
    pos: idx + 1,
    total: can.length,
    prev:
      idx > 0
        ? can[idx - 1].lsx.id
        : idx < 0 && can.length
          ? can[can.length - 1].lsx.id
          : null,
    next:
      idx >= 0 && idx < can.length - 1
        ? can[idx + 1].lsx.id
        : idx < 0 && can.length
          ? can[0].lsx.id
          : null,
  }

  return (
    <LoTrinhGopScreen
      rows={rows}
      canEdit={canEdit}
      lenh={lenh}
      nav={nav}
      autoNap={autoNap}
    />
  )
}
