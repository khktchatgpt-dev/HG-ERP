import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { componentsService } from '@/modules/dept/production/components.service'
import { canEditComponents } from '@/modules/dept/production/perms'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxLinesRepo } from '@/modules/dept/production/lsx-lines.repo'
import { DinhHinhScreen } from './DinhHinhScreen'

export const dynamic = 'force-dynamic'

/**
 * BẢNG ĐỊNH HÌNH của lệnh (dựng lại 27/08 — bản cũ xoá 26/08): nháp từ BOM
 * Kỹ thuật / chép lệnh trước → thống kê sửa → chốt SNAPSHOT per lệnh.
 * suggest('bom') giờ tự sinh cả dòng CỤM chuẩn + chốt khoảng đếm (bậc 1 thang
 * đơn vị đếm); lưu có tuỳ chọn khởi tạo hồ sơ SP cho SP chưa có định mức.
 */
export default async function DinhHinhPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const lsx = await productionRepo.findById(id)
  if (!lsx) notFound()

  const [data, groups, canEdit] = await Promise.all([
    componentsService.list(user, id),
    lsxLinesRepo.listGroups(id),
    canEditComponents(user),
  ])
  const groupTitle = new Map(groups.map((g) => [g.id, g.title ?? '']))
  const rawLines = await lsxLinesRepo.listLines(id)

  return (
    <DinhHinhScreen
      lsx={{ id: lsx.id, code: lsx.code, customer_name: lsx.customer_name }}
      orderLines={rawLines.map((l) => ({
        id: l.id,
        product_code: l.product_code,
        product_name: l.name_vi ?? l.product_code,
        qty: l.qty,
        group_title: groupTitle.get(l.group_id) ?? '',
      }))}
      initialRows={data.lines.map((r) => ({
        production_order_line_id: r.production_order_line_id,
        kind: r.kind,
        cluster: r.cluster,
        name: r.name,
        group_code: r.group_code,
        material_id: r.material_id,
        material_type: r.material_type,
        spec_thickness_mm: r.spec_thickness_mm,
        spec_width_mm: r.spec_width_mm,
        spec_length_mm: r.spec_length_mm,
        wall_thickness_mm: r.wall_thickness_mm,
        unit: r.unit,
        qty_per_unit: r.qty_per_unit,
        dm_kg: r.dm_kg,
        pcs_per_bar: r.pcs_per_bar,
        qty_per_assembly: r.qty_per_assembly,
        first_stage: r.first_stage,
        final_stage: r.final_stage,
        note: r.note,
      }))}
      lockedByEntries={data.locked_by_entries}
      lsxClosed={data.lsx_status === 'completed' || data.lsx_status === 'cancelled'}
      canEdit={canEdit}
    />
  )
}
