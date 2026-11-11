/**
 * Dọn 2 hồ sơ SP lệch — 29/10/2026 (CH0293HG-AL · 28256-228).
 *
 *   npx tsx --conditions=react-server --env-file=D:/HG-ERP/.env.local scripts/don-2-ho-so-lech-1029.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=D:/HG-ERP/.env.local scripts/don-2-ho-so-lech-1029.ts --apply   # ghi
 *
 * User chốt: "có đụng chạm lsx nào không nếu không thì oke" → làm mọi việc
 * KHÔNG chạm lệnh SX:
 *  · CH0293HG-AL (bản trùng CH0020, 0 tham chiếu, đã ẩn): xoá ảnh qua
 *    `filesService.delete`, xoá hồ sơ qua `productsService.remove` (cascade 14 dòng ĐM).
 *  · 28256-228 Riva Treviso (seed 08/07 gõ nhầm mã khách 22028-209 → dính dữ liệu
 *    Bàn xếp Santorin): giữ hồ sơ; mã khách → 28256-228; gỡ 40 dòng ĐM + ảnh + file
 *    BOM Santorin; xoá ghi chú ảnh C0114; tech_spec theo file LSX 06; xoá giá KH
 *    40,91 USD (giá Bàn xếp, SP này không nằm trên lệnh nào → không đổi lãi/lỗ lệnh).
 *
 * CỐ Ý KHÔNG LÀM (đụng lệnh):
 *  · 16 dòng ảnh chụp ĐM mồ côi của 28256-228 ở lệnh 06/26-27 - MX — để nguyên.
 *  · Chuyển giá KH 40,91 USD sang TB0174HG-AL — TB0174 nằm ở lệnh 01 + 13, đặt giá
 *    là đổi bảng lãi/lỗ của hai lệnh đó. Giá cũ nằm trong file sao lưu.
 *
 * File owner null ⇒ chỉ admin xoá được → chạy bằng Quản trị viên.
 */
import fs from 'node:fs'
import { db } from '@/server/db'
import { usersRepo } from '@/modules/core/users/users.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { filesService } from '@/modules/core/files/files.service'

const APPLY = process.argv.includes('--apply')
const ADMIN_ID = '2d47facc-c8ce-43ec-b5bc-6c9435825bc8'
const CH0293 = 'cd1ee29f-53d6-47bb-9c1b-80788ac02683'
const RIVA = '893dad44-a4e4-4471-9393-343488d739f6'
const TB0174 = '9999b62a-9e6c-479a-a503-dfb1f5a01eda'
const F_CH0293_IMG = '351c52da-c998-40b9-9e7d-11f4a4dccf82'
const F_RIVA_IMG = '03b7ad0c-94f0-4898-846b-6dee175b4f5a'
const F_RIVA_BOM = '74f85e71-6471-4bb3-83dc-7c1e5bb7fa10'
const BACKUP = `D:/HG-ERP/backups/don-ch0293-28256-228-${new Date()
  .toISOString()
  .replace(/[:.]/g, '-')
  .slice(0, 19)}.json`

const RIVA_PATCH = {
  customer_item_code: '28256-228',
  image_file_id: null,
  notes: null,
  tech_spec: { machine: 'F2264B', cushion: 'HG-P180-M21 (M21)', paint: 'Đen cát' },
  plan_price: null,
  plan_currency: null,
  plan_direct_cost: null,
  plan_overhead: null,
  plan_profit: null,
  plan_fx_rate: null,
  plan_breakdown: null,
  plan_source: null,
  plan_at: null,
  plan_by: null,
}

async function rows<T = Record<string, unknown>>(
  q: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as T[]
}

async function count(table: string, col: string, id: string): Promise<number> {
  const { count: n, error } = await db()
    .from(table)
    .select(col, { count: 'exact', head: true })
    .eq(col, id)
  if (error) throw new Error(`${table}.${col}: ${error.message}`)
  return n ?? 0
}

async function main() {
  const admin = await usersRepo.findById(ADMIN_ID)
  if (!admin || admin.role !== 'admin') throw new Error('Không thấy tài khoản admin')
  for (const a of [
    'technical.product.remove',
    'technical.product.update',
    'technical.bom.save',
  ]) {
    if (!(await canAction(admin, a))) throw new Error(`${admin.name} thiếu quyền ${a}`)
  }

  // ── Sao lưu ──────────────────────────────────────────────────────────────
  const ids = [CH0293, RIVA, TB0174]
  const [products, parts, files, snaps] = await Promise.all([
    rows(db().from('technical_products').select('*').in('id', ids)),
    rows<{ id: string; product_id: string }>(
      db().from('technical_product_parts').select('*').in('product_id', [CH0293, RIVA]),
    ),
    rows(db().from('files').select('*').in('id', [F_CH0293_IMG, F_RIVA_IMG, F_RIVA_BOM])),
    rows(db().from('production_order_boms').select('*').eq('product_id', RIVA)),
  ])
  const byId = new Map(products.map((p) => [p.id as string, p]))
  const ch = byId.get(CH0293)
  const riva = byId.get(RIVA)
  if (!ch || !riva) throw new Error('Thiếu hồ sơ — đã có ai dọn rồi?')

  // ── Lưới an toàn: trạng thái phải đúng như lúc rà ─────────────────────────
  const guard: string[] = []
  if (ch.code !== 'CH0293HG-AL' || ch.is_active !== false)
    guard.push('CH0293 khác lúc rà')
  if (riva.code !== '28256-228' || riva.customer_item_code !== '22028-209')
    guard.push('28256-228 khác lúc rà')
  if (ch.locked_at || riva.locked_at) guard.push('hồ sơ đang khoá')
  for (const id of [CH0293, RIVA]) {
    for (const [t, c] of [
      ['production_order_lines', 'product_id'],
      ['sales_order_lines', 'product_id'],
      ['sales_quote_lines', 'product_id'],
      ['technical_samples', 'product_id'],
      ['supply_lsx_material_plan', 'product_id'],
    ] as const) {
      const n = await count(t, c, id)
      if (n > 0) guard.push(`${id === CH0293 ? 'CH0293' : '28256-228'}: ${t} = ${n}`)
    }
  }
  if ((await count('production_order_boms', 'product_id', CH0293)) > 0)
    guard.push('CH0293 có ảnh chụp ĐM lệnh')
  const chParts = parts.filter((p) => p.product_id === CH0293)
  const rivaParts = parts.filter((p) => p.product_id === RIVA)
  if (chParts.length !== 14) guard.push(`CH0293 có ${chParts.length} dòng ĐM (rà: 14)`)
  if (rivaParts.length !== 40)
    guard.push(`28256-228 có ${rivaParts.length} dòng ĐM (rà: 40)`)
  if (files.length !== 3 || files.some((f) => f.deleted_at))
    guard.push('file khác lúc rà')
  if (snaps.length !== 16)
    guard.push(`ảnh chụp lệnh của 28256-228 = ${snaps.length} (rà: 16)`)

  console.log(
    `CH0293: ${chParts.length} dòng ĐM · 28256-228: ${rivaParts.length} dòng ĐM · ` +
      `file: ${files.length} · ảnh chụp lệnh (để nguyên): ${snaps.length}`,
  )
  if (guard.length) {
    console.error('DỪNG — trạng thái lệch so với lúc rà:\n  ' + guard.join('\n  '))
    process.exit(1)
  }
  console.log('28256-228 sẽ đổi:', JSON.stringify(RIVA_PATCH))
  if (!APPLY) {
    console.log('Dò khô xong — thêm --apply để ghi.')
    return
  }

  fs.writeFileSync(
    BACKUP,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        note: 'Trước khi dọn CH0293HG-AL (xoá) + 28256-228 (gỡ dữ liệu Bàn xếp Santorin). TB0174 chỉ để tham chiếu, không sửa. production_order_boms để nguyên.',
        products,
        parts,
        files,
        production_order_boms_untouched: snaps,
      },
      null,
      2,
    ),
  )
  console.log('Đã sao lưu:', BACKUP)

  // ── CH0293HG-AL: xoá ─────────────────────────────────────────────────────
  await filesService.delete(admin, F_CH0293_IMG)
  console.log('✓ xoá ảnh CH0293HG-AL.png')
  await productsService.remove(admin, CH0293)
  console.log('✓ xoá hồ sơ CH0293HG-AL (+14 dòng ĐM)')

  // ── 28256-228: gỡ dữ liệu Bàn xếp Santorin ────────────────────────────────
  // Bỏ trỏ ảnh TRƯỚC khi xoá file — không lúc nào hồ sơ trỏ vào file đã gỡ.
  await productsService.update(admin, RIVA, RIVA_PATCH as never)
  console.log('✓ 28256-228: mã khách, ảnh chính, ghi chú, thông số, giá KH')
  for (const p of rivaParts) await productsService.removePart(admin, RIVA, p.id)
  console.log(`✓ 28256-228: gỡ ${rivaParts.length} dòng ĐM`)
  await filesService.delete(admin, F_RIVA_IMG)
  await filesService.delete(admin, F_RIVA_BOM)
  console.log('✓ 28256-228: gỡ ảnh + file BOM Bàn xếp Santorin')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
