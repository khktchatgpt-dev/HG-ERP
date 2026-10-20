/**
 * GẮN MÃ VẬT TƯ CHO DÒNG TỰ GÕ CỦA ĐƠN MUA ĐANG MỞ — 19/10/2026.
 *
 * Huy không ghi nhận được hàng về của ĐH02HGTĐ (400 + 400 ghế gỗ, trễ hẹn
 * 05/09): đơn chỉ có dòng tự gõ (0134) nên form nhận hàng ra lưới trống. Chủ
 * dự án chốt: dòng tự gõ cũng nhập kho, chưa có mã thì tự cấp. Từ nay
 * `posService` cấp mã lúc lưu đơn; script này gắn bù cho đơn ĐANG MỞ đã lưu
 * trước đó. Đơn đã nhận đủ / đóng / huỷ để nguyên (đã nghiệm thu ngoài sổ).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/gan-ma-dong-tu-go-1019.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/gan-ma-dong-tu-go-1019.ts --apply   # ghi
 *
 * Chỉ đổi `material_id` của dòng; `price_basis`/`qty2` đã lưu giữ nguyên nên
 * thành tiền không đổi (form mở lại đơn ghim "Giá theo" = price_basis đã lưu).
 */
import { db } from '@/server/db'
import { usersRepo } from '@/modules/core/users/users.repo'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'

const MO = ['draft', 'pending_approval', 'approved', 'ordered', 'confirmed', 'in_transit', 'partial'] // prettier-ignore

async function main() {
  const APPLY = process.argv.includes('--apply')
  const user = await usersRepo.findByEmail('admin@hg.com')
  if (!user) throw new Error('không thấy tài khoản admin@hg.com')

  const { data: pos, error } = await db()
    .from('supply_purchase_orders')
    .select('id, code, status')
    .in('status', MO)
  if (error) throw new Error(error.message)
  const byId = new Map((pos ?? []).map((p) => [p.id, p]))

  const { data: lines, error: e2 } = await db()
    .from('supply_purchase_order_lines')
    .select('id, po_id, line_name, line_unit, line_kind, price_basis, sort_order')
    .is('material_id', null)
    .is('line_kind', null)
    .in('po_id', [...byId.keys()])
    .order('sort_order')
  if (e2) throw new Error(e2.message)

  for (const l of lines ?? []) {
    const po = byId.get(l.po_id)!
    if (!l.line_name?.trim()) continue
    const id = APPLY
      ? await materialsService.ensureForFreeLine(user, { name: l.line_name, unit: l.line_unit }, po.code) // prettier-ignore
      : '(dò khô)'
    if (APPLY) {
      const { error: e3 } = await db()
        .from('supply_purchase_order_lines')
        .update({ material_id: id })
        .eq('id', l.id)
        .is('material_id', null)
      if (e3) throw new Error(`${po.code}: ${e3.message}`)
    }
    console.log(`${po.code.padEnd(14)} ${po.status.padEnd(10)} ${l.price_basis} · ${l.line_name} (${l.line_unit ?? '-'}) → ${id}`) // prettier-ignore
  }
  console.log(`\n${APPLY ? 'ĐÃ GẮN' : 'Sẽ gắn'} ${lines?.length ?? 0} dòng`)
}
void main()
