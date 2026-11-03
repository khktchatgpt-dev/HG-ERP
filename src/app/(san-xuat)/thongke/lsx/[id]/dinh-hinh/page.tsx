import Link from 'next/link'
import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { componentsService } from '@/modules/dept/production/components.service'
import { entriesService } from '@/modules/dept/production/entries.service'
import { canEditComponents } from '@/modules/dept/production/perms'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxLinesRepo } from '@/modules/dept/production/lsx-lines.repo'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
import { partGroupsRepo, productsRepo } from '@/modules/dept/technical/technical.repo'
import { resolveStageConfigs } from '@/lib/stage-config'
import { lineUnit } from '@/lib/finish-stages'
import { Rong, SxKhung } from '@/app/(workspace)/production/_erp/khung'
import { DinhHinhScreen } from './DinhHinhScreen'

export const dynamic = 'force-dynamic'

/**
 * BẢNG ĐỊNH HÌNH của lệnh: nháp từ BOM Kỹ thuật / chép lệnh trước → thống kê
 * soát → chốt SNAPSHOT per lệnh (ghi đè trọn bộ). 03/11/2026: dựng lại không
 * kit theo bản vẽ https://claude.ai/artifact/DUtMtTWekhhBUUzh54XM9L — hai tab
 * Chi tiết · Lộ trình theo cụm. Tải song song mọi thứ không phụ thuộc nhau.
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

  const [data, groups, rawLines, canEdit, catalog, partGroups, pbs] = await Promise.all([
    componentsService.list(user, id),
    lsxLinesRepo.listGroups(id),
    lsxLinesRepo.listLines(id),
    canEditComponents(user),
    catalogsService.list(user, 'production_stage'),
    partGroupsRepo.list(),
    entriesService.docsOfLsx(user, id),
  ])
  // SP đã có định mức ở hồ sơ chưa — quyết định ô "Khởi tạo hồ sơ SP" và câu
  // nói ở dòng chưa định hình. Dùng bom_status của hồ sơ: 'done' = có.
  const products = await productsRepo.listPickByIds([
    ...new Set(rawLines.map((l) => l.product_id).filter((x): x is string => !!x)),
  ])
  const bomStatus = new Map(products.map((p) => [p.id, p.bom_status]))
  const groupTitle = new Map(groups.map((g) => [g.id, g.title ?? '']))

  if (rawLines.length === 0) {
    return (
      <SxKhung bare label="Định hình">
        <Rong
          tieuDe={`Lệnh ${lsx.code} chưa có dòng sản phẩm`}
          lyDo="Soạn dòng lệnh trước rồi mới định hình chi tiết — không có SP thì không có gì để bóc."
          tiep={
            <Link href={`/thongke/lsx/${lsx.id}`} className="sx-btn p">
              Về hồ sơ lệnh
            </Link>
          }
        />
      </SxKhung>
    )
  }

  return (
    <DinhHinhScreen
      lsx={{
        id: lsx.id,
        code: lsx.code,
        customer_name: lsx.customer_name,
        status: lsx.status,
      }}
      orderLines={rawLines.map((l) => ({
        id: l.id,
        product_code: l.product_code,
        product_name: l.name_vi ?? l.product_code,
        qty: l.qty,
        unit: lineUnit(l.unit),
        group_title: groupTitle.get(l.group_id) ?? '',
        has_profile: l.product_id ? bomStatus.get(l.product_id) === 'done' : false,
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
        stages: r.stages ?? null,
        note: r.note,
      }))}
      groups={partGroups.map((g) => ({ code: g.code, label: g.label }))}
      stageCfg={resolveStageConfigs(catalog.filter((s) => s.is_active))}
      lockedByEntries={data.locked_by_entries}
      pbsCount={pbs.length}
      lsxClosed={data.lsx_status === 'completed' || data.lsx_status === 'cancelled'}
      canEdit={canEdit}
    />
  )
}
