/**
 * PO-2026-0133 (Nguyễn Anh Thi, nháp, mẫu gỗ): VÁN MDF GIÁ THEO TẤM — 03/10/2026.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-0133-van-theo-tam-1003.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-0133-van-theo-tam-1003.ts --apply   # ghi
 *
 * Dòng GO-0001 Ván MDF 2.5mm 152 tấm × 81.000đ/tấm bị mẫu gỗ tính theo m³
 * (1,094 m³ × 81.000 = 88.614đ). Đã sửa luật (`deriveLine` — dòng vật tư danh mục
 * của mẫu gỗ giá theo ĐVT mua), nhưng dòng ĐÃ LƯU giữ cơ sở giá cũ khi mở lại, nên
 * đổi `price_basis` của đúng dòng này sang 'unit' → 12.312.000đ. Chỉ khi đơn còn
 * nháp và dòng còn đúng như lúc kiểm. Sao lưu: backups/po-0133-van-theo-tam-1003.json.
 */
import { writeFileSync } from 'node:fs'
import { db } from '@/server/db'

const APPLY = process.argv.includes('--apply')

async function main() {
  const { data: po, error } = await db().from('supply_purchase_orders').select('id, code, status').eq('code', 'PO-2026-0133').single() // prettier-ignore
  if (error || !po) throw new Error(`không thấy đơn: ${error?.message}`)
  const { data: ls } = await db().from('supply_purchase_order_lines').select('*').eq('po_id', po.id) // prettier-ignore
  const dong = (ls ?? []).filter((l) => l.price_basis === 'unit2' && l.material_id && l.qty_ordered === 152 && Number(l.unit_price) === 81_000) // prettier-ignore
  console.log(`${po.code} · ${po.status} · ${ls?.length} dòng · cần đổi ${dong.length}`)
  console.log(`Tiền dòng: ${(Number(dong[0]?.qty2) * 81_000).toLocaleString('vi-VN')} → ${(152 * 81_000).toLocaleString('vi-VN')}`) // prettier-ignore
  if (po.status !== 'draft' || dong.length !== 1)
    throw new Error('Đơn không còn nháp hoặc dòng đã đổi — dừng')
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')
  writeFileSync('backups/po-0133-van-theo-tam-1003.json', JSON.stringify({ at: new Date().toISOString(), lines: ls }, null, 1)) // prettier-ignore
  const { error: ue } = await db().from('supply_purchase_order_lines').update({ price_basis: 'unit' }).eq('id', dong[0].id).eq('price_basis', 'unit2') // prettier-ignore
  if (ue) throw new Error(ue.message)
  console.log('✓ Đã đổi sang giá theo tấm')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
