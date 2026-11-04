import { authService } from '@/modules/core/auth/auth.service'
import {
  componentsService,
  isUnshaped,
  needsRoute,
  type ShapingRow,
} from '@/modules/dept/production/components.service'
import { lsxDossierService } from '@/modules/dept/production/lsx-dossier.service'
import { canEditComponents } from '@/modules/dept/production/perms'
import { todayVn } from '@/lib/date-vn'
import { loadDinhHinhProps } from '../lsx/[id]/dinh-hinh/load'
import { LoTrinhGopScreen } from './LoTrinhGopScreen'

export const metadata = { title: 'Sản xuất · Lộ trình công đoạn' }
export const dynamic = 'force-dynamic'

/**
 * LỘ TRÌNH CÔNG ĐOẠN — bản vẽ 4 (04/11/2026,
 * https://claude.ai/artifact/QMcpzoEfCob2J55PKbZdTZ): chọn LỆNH → chọn SẢN PHẨM
 * → dải thông tin SP + ma trận của riêng SP đó. Không `?lsx=` → bảng danh sách
 * khuôn C; `?lsx=&sp=` → một SP; thiếu `sp` thì mở SP đầu tiên còn cụm chưa khai.
 *
 * TỰ NẠP KHI MỞ: lệnh cũ có định mức ở hồ sơ mà chưa có bảng thì nạp ngay, cùng
 * hàm nhịp duyệt dùng. Chỉ khi người xem có quyền sửa.
 */
export default async function LoTrinhGopPage({
  searchParams,
}: {
  searchParams: Promise<{ lsx?: string; sp?: string }>
}) {
  const user = await authService.requirePageUser()
  const q = await searchParams
  const today = todayVn()
  const [all, canEdit] = await Promise.all([
    componentsService.shapingOverview(),
    canEditComponents(user),
  ])
  const rank = (r: ShapingRow) => (needsRoute(r) ? 0 : isUnshaped(r) ? 1 : 2)
  const rows = [...all].sort((a, b) => rank(a) - rank(b))

  const picked = q.lsx ? (rows.find((r) => r.lsx.id === q.lsx) ?? null) : null
  if (!picked) {
    return (
      <LoTrinhGopScreen
        rows={rows}
        canEdit={canEdit}
        lenh={null}
        nav={null}
        autoNap={null}
        daXong={{}}
        today={today}
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
  // Dải thông tin SP cần "đã xong" — lấy từ CÙNG hàm Hồ sơ lệnh (bộ đồng bộ),
  // không tự cộng lại. Nuốt lỗi: thiếu số này màn vẫn dùng được.
  const [lenh, daXong] = await Promise.all([
    loadDinhHinhProps(user, picked.lsx.id),
    lsxDossierService
      .get(user, picked.lsx.id)
      .then((d) =>
        Object.fromEntries(d.lines.map((l) => [l.order_line_id, l.synced_sets])),
      )
      .catch((e) => {
        console.error('[lo-trinh] đọc hồ sơ lệnh lỗi', picked.lsx.id, e)
        return {} as Record<string, number>
      }),
  ])
  if (lenh) {
    // SP mở sẵn: `?sp=` hợp lệ, không thì SP đầu tiên còn cụm chưa khai, không
    // thì SP đầu tiên của lệnh.
    const lineIds = new Set(lenh.orderLines.map((l) => l.id))
    const unrouted = new Set(
      lenh.initialRows
        .filter((r) => r.kind === 'assembly' && !(r.stages && r.stages.length))
        .map((r) => r.production_order_line_id),
    )
    lenh.initialSp =
      q.sp && lineIds.has(q.sp)
        ? q.sp
        : (lenh.orderLines.find((l) => unrouted.has(l.id))?.id ?? lenh.orderLines[0]?.id)
  }

  // ‹ › lệnh: chỉ đi qua các lệnh CÒN cụm chưa khai.
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
      daXong={daXong}
      today={today}
    />
  )
}
