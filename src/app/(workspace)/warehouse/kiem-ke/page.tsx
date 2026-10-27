import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'
import { tienDoDem } from '@/modules/dept/warehouse/stocktakes.repo'
import { KiemKeScreen } from './KiemKeScreen'
import { RO_DOT, type DotRow, type RoDot } from './kiem-ke.shared'

export const metadata = { title: 'Kho · Kiểm kê' }
export const dynamic = 'force-dynamic'

/**
 * SỔ ĐỢT KIỂM KÊ — `/warehouse/kiem-ke` (Kho B7a, bản vẽ KK-1/KK-2 duyệt
 * 19/10/2026: https://claude.ai/artifact/ACMarfdaHqyud9RrdYMyzX).
 *
 * Sổ chỉ gửi số đếm của từng đợt, không gửi dòng. Dữ liệu hộp Mở đợt (~2 s vì
 * tính hàng của từng lệnh) tải khi bấm mở hộp, không làm chậm sổ.
 */
export default async function KiemKePage({
  searchParams,
}: {
  searchParams: Promise<{ ro?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const [ds, canManage] = await Promise.all([
    stocktakesService.list(user, { page: 1, page_size: 100 }),
    canAction(user, 'warehouse.stock.write'),
  ])
  const tienDo = await tienDoDem(ds.rows.map((t) => t.id))
  const rows: DotRow[] = ds.rows.map((t) => {
    const td = tienDo.get(t.id)
    return {
      id: t.id,
      code: t.code,
      status: t.status,
      nhom:
        t.scope_kind === 'group'
          ? ((t.scope_ref.groups as string[] | undefined) ?? [])
          : [],
      scope_kind: t.scope_kind,
      nhanh: t.scope_kind === 'list' && t.scope_ref.nhanh === true,
      scope_count: t.scope_count,
      nguoi_dem: t.assigned_to_name,
      freeze_at: t.freeze_at,
      tong: td?.total ?? 0,
      da_dem: td?.counted ?? 0,
      doc_code: t.doc_code,
      reject_reason: t.reject_reason,
      created_by: t.created_by,
      created_at: t.created_at,
    }
  })
  const ro: RoDot | null = (RO_DOT as readonly string[]).includes(sp.ro ?? '')
    ? (sp.ro as RoDot)
    : null
  return (
    <KiemKeScreen
      rows={rows}
      roUrl={ro}
      canManage={canManage}
      laAdmin={user.role === 'admin'}
      userId={user.id}
    />
  )
}
