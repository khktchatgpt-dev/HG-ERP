import { componentsService } from '@/modules/dept/production/components.service'
import { entriesService } from '@/modules/dept/production/entries.service'
import { canEditComponents } from '@/modules/dept/production/perms'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxLinesRepo } from '@/modules/dept/production/lsx-lines.repo'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
import {
  partGroupsRepo,
  productProfileRepo,
  productsRepo,
} from '@/modules/dept/technical/technical.repo'
import { resolveStageConfigs } from '@/lib/stage-config'
import { lineUnit } from '@/lib/finish-stages'
import { khoaCum } from '@/lib/khoa-cum'
import type { User } from '@/modules/core/users/users.repo'
import type { DinhHinhProps } from './dinh-hinh.shared'

/**
 * Tải trọn dữ liệu một lệnh cho hook `useDinhHinh` — dùng chung cho màn Bảng
 * chi tiết (`/thongke/lsx/[id]/dinh-hinh`) và màn gộp Lộ trình công đoạn
 * (`/thongke/lo-trinh?lsx=`, 04/11/2026). Tải song song mọi thứ không phụ
 * thuộc nhau. Trả `null` khi lệnh không tồn tại; lệnh không có dòng SP thì
 * `orderLines` rỗng — màn tự nói.
 */
export async function loadDinhHinhProps(
  user: User,
  lsxId: string,
): Promise<DinhHinhProps | null> {
  const lsx = await productionRepo.findById(lsxId)
  if (!lsx) return null

  const [data, groups, rawLines, canEdit, catalog, partGroups, pbs] = await Promise.all([
    componentsService.list(user, lsxId),
    lsxLinesRepo.listGroups(lsxId),
    lsxLinesRepo.listLines(lsxId),
    canEditComponents(user),
    catalogsService.list(user, 'production_stage'),
    partGroupsRepo.list(),
    entriesService.docsOfLsx(user, lsxId),
  ])
  // SP đã có định mức ở hồ sơ chưa — quyết định ô "Khởi tạo hồ sơ SP" và câu
  // "chờ Kỹ thuật". Đọc "có dòng định mức" HOẶC bom_status 'done' (04/11/2026:
  // chỉ đọc bom_status thì SP có 55 dòng vẫn bị gọi là chờ Kỹ thuật).
  const productIds = [
    ...new Set(rawLines.map((l) => l.product_id).filter((x): x is string => !!x)),
  ]
  const [products, coDinhMuc, hoSoCum] = await Promise.all([
    productsRepo.listPickByIds(productIds),
    productProfileRepo.productsWithParts(productIds),
    productProfileRepo.clustersByProducts(productIds),
  ])
  // Cụm Kỹ thuật ĐÃ khai SL cụm / SP — còn lại ô CT/SP của dòng cụm để trống,
  // ghi "chưa có" (13/11/2026: chưa có định mức thì nói chưa có, không bày 1).
  const cumDaKhai = new Set(
    hoSoCum
      .filter((c) => c.qty_per_product != null)
      .map((c) => `${c.product_id}|${khoaCum(c.name)}`),
  )
  const productOfLine = new Map(rawLines.map((l) => [l.id, l.product_id]))
  const bomDone = new Set(
    products.filter((p) => p.bom_status === 'done').map((p) => p.id),
  )
  const groupTitle = new Map(groups.map((g) => [g.id, g.title ?? '']))

  return {
    lsx: {
      id: lsx.id,
      code: lsx.code,
      customer_name: lsx.customer_name,
      status: lsx.status,
    },
    orderLines: rawLines.map((l) => ({
      id: l.id,
      product_code: l.product_code,
      product_name: l.name_vi ?? l.product_code,
      qty: l.qty,
      unit: lineUnit(l.unit),
      group_title: groupTitle.get(l.group_id) ?? '',
      has_profile:
        !!l.product_id && (coDinhMuc.has(l.product_id) || bomDone.has(l.product_id)),
    })),
    initialRows: data.lines.map((r) => ({
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
      cum_chua_khai:
        r.kind === 'assembly' &&
        !!r.cluster &&
        !cumDaKhai.has(
          `${productOfLine.get(r.production_order_line_id)}|${khoaCum(r.cluster)}`,
        ),
    })),
    groups: partGroups.map((g) => ({ code: g.code, label: g.label })),
    stageCfg: resolveStageConfigs(catalog.filter((s) => s.is_active)),
    lockedByEntries: data.locked_by_entries,
    pbsCount: pbs.length,
    lsxClosed: data.lsx_status === 'completed' || data.lsx_status === 'cancelled',
    canEdit,
  }
}
