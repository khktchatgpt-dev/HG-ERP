import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'
import { HttpError } from '@/server/http'
import { PhieuDemScreen } from './PhieuDemScreen'
import type { DongDem, DotDem } from './phieu-dem.shared'

export const metadata = { title: 'Kho · Phiếu đếm kiểm kê' }
export const dynamic = 'force-dynamic'

/**
 * PHIẾU ĐẾM CỦA MỘT ĐỢT KIỂM KÊ — `/warehouse/kiem-ke/[id]` (Kho B7b, bản vẽ
 * KK-3 duyệt 19/10/2026: https://claude.ai/artifact/ACMarfdaHqyud9RrdYMyzX).
 *
 * Đếm mù giữ ở SERVER: `stocktakesService.detail` xoá số sổ khỏi dòng khi đợt
 * còn mở / đang đếm, nên trang này không thể lỡ gửi số sổ xuống trình duyệt.
 */
export default async function PhieuDemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const [d, canWrite] = await Promise.all([
    stocktakesService.detail(user, id).catch((e: unknown) => {
      if (e instanceof HttpError && e.status === 404) return null
      throw e
    }),
    canAction(user, 'warehouse.stock.write'),
  ])
  if (!d) notFound()
  const t = d.take
  const dot: DotDem = {
    id: t.id,
    code: t.code,
    status: t.status,
    nhom:
      t.scope_kind === 'group'
        ? ((t.scope_ref.groups as string[] | undefined) ?? [])
        : [],
    scope_count: t.scope_count,
    freeze_at: t.freeze_at,
    blind: t.blind_count,
    nguoi_dem: t.assigned_to_name,
    note: t.note,
    reject_reason: t.reject_reason,
  }
  const dong: DongDem[] = d.lines.map((l) => ({
    id: l.id,
    material_id: l.material_id,
    code: l.material_code ?? '?',
    name: l.material_name ?? '(vật tư không còn trong danh mục)',
    unit: l.material_unit ?? '',
    ke: l.material_shelf,
    so_so: l.book_qty_frozen,
    dem: l.counted_qty,
    note: l.note,
    luc: l.counted_at,
  }))
  dong.sort(
    (a, b) => (a.ke ?? '').localeCompare(b.ke ?? '') || a.code.localeCompare(b.code),
  )
  return <PhieuDemScreen dot={dot} dong={dong} canWrite={canWrite} />
}
