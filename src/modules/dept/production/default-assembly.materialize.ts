import { componentsRepo, type ComponentRow } from './components.repo'
import { DEFAULT_ASSEMBLY_NAME, resolveCountingPlan } from '@/lib/default-assembly'
import { isFinishRow, lineUnit } from '@/lib/finish-stages'
import type { Counting } from '@/lib/stage-config'
import { BadRequest } from '@/server/http'

/**
 * VẬT CHẤT HOÁ cụm mặc nhiên (lib/default-assembly) — một hàm cho MỌI đường
 * ghi vào nó, để cụm sinh ra ở Ghi sản lượng và cụm sinh ra ở Phiếu giao tổ là
 * CÙNG MỘT DÒNG với cùng tên / nhóm / mốc đầu-cuối.
 *
 * Trước 06/11/2026 khối này nằm trong `entriesService.record`, nên phiếu giao
 * tổ không có cách nào trỏ vào cụm mặc nhiên: tổ Hàn muốn giao cụm cho Nguội
 * phải ghi sổ hàn trước (lượt ghi đầu mới sinh dòng). Thực tế xưởng là hàng đi
 * trước sổ — nên phiếu giao cũng phải vật chất hoá được.
 *
 * Lượt gọi ĐẦU TIÊN biến cụm ảo thành dòng production_components thật và chốt
 * công đoạn cuối cho chi tiết bị gộp (chúng dừng trước mốc ghép); các lượt sau
 * tìm thấy dòng thật và dùng lại. `lineComps` được SỬA TẠI CHỖ (final_stage
 * của chi tiết bị gộp) để ngữ cảnh người gọi đang cầm đi tiếp đúng.
 */

/** Dòng cụm mặc nhiên ĐÃ vật chất hoá của một dòng SP, nếu có. */
export function findDefaultAssembly(
  lineComps: ComponentRow[],
  counting: Counting,
): ComponentRow | undefined {
  // Loại dòng THÀNH PHẨM ra: nó cũng là assembly/cluster null nhưng bắt đầu ở
  // lắp ráp — vớ nhầm nó thì sổ hàn ghi vào dòng đóng gói.
  return lineComps.find(
    (c) => c.kind === 'assembly' && c.cluster == null && !isFinishRow(c, counting.finish),
  )
}

export async function materializeDefaultAssembly(args: {
  lsxId: string
  line: { id: string; qty: number; unit: string | null | undefined }
  /** Mọi dòng của dòng SP đó — sửa TẠI CHỖ `final_stage` chi tiết bị gộp; dòng mới KHÔNG tự thêm vào. */
  lineComps: ComponentRow[]
  plannedRoute: string[] | null | undefined
  counting: Counting
}): Promise<{ real: ComponentRow; created: boolean }> {
  const { lsxId, line, lineComps, plannedRoute, counting } = args
  const existing = findDefaultAssembly(lineComps, counting)
  if (existing) return { real: existing, created: false }

  const plan = resolveCountingPlan(lineComps, plannedRoute, counting)
  if (plan.virtual_stages.length === 0) {
    throw BadRequest('Dòng SP này không (còn) cụm mặc nhiên — tải lại màn rồi ghi lại')
  }
  const absorbed = lineComps.filter((c) => plan.own_route.has(c.id))
  const lastOwn = (c: ComponentRow) => {
    const r = plan.own_route.get(c.id)!
    return r[r.length - 1]
  }
  const fields = {
    production_order_id: lsxId,
    production_order_line_id: line.id,
    kind: 'assembly' as const,
    cluster: null,
    name: DEFAULT_ASSEMBLY_NAME,
    // Kế thừa nhóm vật tư của chi tiết bị gộp (FRAME) — nhờ đó lộ trình của
    // cụm suy được cả khi dòng chưa lên kế hoạch SX.
    group_code: absorbed.find((c) => c.group_code)?.group_code ?? null,
    unit: lineUnit(line.unit),
    qty_per_unit: 1,
    first_stage: plan.virtual_stages[0],
    final_stage: plan.virtual_stages[plan.virtual_stages.length - 1],
    note: null,
  }
  const newId = await componentsRepo.insertOne(fields)
  await componentsRepo.setFinalStages(
    absorbed.map((c) => ({ id: c.id, final_stage: lastOwn(c) })),
  )
  for (const c of absorbed) c.final_stage = lastOwn(c)
  const real: ComponentRow = {
    ...fields,
    id: newId,
    stages: null,
    material_id: null,
    material_type: null,
    spec_thickness_mm: null,
    spec_width_mm: null,
    spec_length_mm: null,
    wall_thickness_mm: null,
    dm_kg: null,
    pcs_per_bar: null,
    qty_per_assembly: null,
    sort_order: 9999,
    material_code: null,
    material_name: null,
    material_unit: null,
  }
  return { real, created: true }
}
