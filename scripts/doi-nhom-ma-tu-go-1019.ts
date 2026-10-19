/**
 * ĐỔI NHÓM + MÃ cho vật tư tự cấp bị xếp nhầm nhóm Gỗ — 19/10/2026.
 *
 * Lượt gắn mã đầu (scripts/gan-ma-dong-tu-go-1019.ts) cho mọi dòng tự gõ vào
 * nhóm Gỗ; nệm và vải mái che của PO-2026-0136 phải sang nhóm của chúng. Nay
 * service đoán nhóm theo tên (`lib/nhom-dong-tu-go`) — script này áp CÙNG hàm
 * cho các mã tự cấp đã có, và cấp lại mã theo tiền tố nhóm đích (GO- → mã nhóm
 * mới). Chỉ đụng mã CHƯA có biến động kho: mã đã có phiếu thì để Kho đổi tay.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/doi-nhom-ma-tu-go-1019.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/doi-nhom-ma-tu-go-1019.ts --apply   # ghi
 */
import { db } from '@/server/db'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { NHOM_GO, nhomChoDongTuGo } from '@/lib/nhom-dong-tu-go'

async function maMoi(group: string): Promise<string> {
  const siblings = await materialsRepo.namesInGroup(group)
  const count = new Map<string, number>()
  for (const m of siblings) {
    const hit = m.code?.match(/^([A-Z]{2,3})-\d+$/)
    if (hit) count.set(hit[1], (count.get(hit[1]) ?? 0) + 1)
  }
  const prefix = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!prefix) throw new Error(`nhóm "${group}" chưa có mã dạng XX-0000 để bám tiền tố`)
  return `${prefix}-${String((await materialsRepo.maxCodeNo(prefix)) + 1).padStart(4, '0')}`
}

async function main() {
  const APPLY = process.argv.includes('--apply')
  const { data, error } = await db()
    .from('warehouse_materials')
    .select('id, code, name, group_name')
    .eq('group_name', NHOM_GO)
    .like('note', 'Tự cấp mã từ dòng tự gõ%')
  if (error) throw new Error(error.message)

  for (const m of data ?? []) {
    const group = nhomChoDongTuGo(m.name)
    if (group === NHOM_GO) continue
    const { count } = await db()
      .from('warehouse_movements')
      .select('id', { count: 'exact', head: true })
      .eq('material_id', m.id)
    if ((count ?? 0) > 0) {
      console.log(`BỎ QUA ${m.code} ${m.name}: đã có ${count} biến động kho`)
      continue
    }
    const code = APPLY ? await maMoi(group) : '(dò khô)'
    if (APPLY) {
      const { error: e2 } = await db()
        .from('warehouse_materials')
        .update({ group_name: group, code })
        .eq('id', m.id)
      if (e2) throw new Error(`${m.code}: ${e2.message}`)
    }
    console.log(`${m.code} → ${code}  ${m.name}  ⇒ ${group}`)
  }
}
void main()
