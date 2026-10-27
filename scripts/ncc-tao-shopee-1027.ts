/**
 * Tạo hồ sơ NCC "Shopee" là SÀN TMĐT (0279, câu chốt 3 của bản vẽ "Đơn mua trên sàn", 27/10/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/ncc-tao-shopee-1027.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/ncc-tao-shopee-1027.ts --apply   # ghi
 *
 * CHỈ --apply SAU KHI mã đơn sàn đã lên main (bài học 26/10: ghi cấu hình DB khi main
 * chưa hiểu thì production chạy sai). Đi qua `suppliersService.create` như form, đứng tên
 * chị Nga. Đã có hồ sơ tên "Shopee" thì chỉ bật cờ sàn, không tạo đôi. Sàn khác (Lazada,
 * TikTok Shop) Cung ứng tự tạo ở màn NCC rồi tích "Đây là sàn thương mại điện tử".
 */
import { db } from '@/server/db'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')

async function main() {
  const { data: co } = await db()
    .from('supply_suppliers')
    .select('id, code, name, is_marketplace')
    .ilike('name', 'shopee')
  const nga = (await usersRepo.list()).find((u) => u.email === 'kehoach1@hoanggia.de')
  if (!nga) throw new Error('thiếu chị Nga')

  if (co && co.length > 0) {
    const s = co[0] as {
      id: string
      code: string | null
      name: string
      is_marketplace: boolean
    }
    console.log(`Đã có ${s.code ?? '—'} · ${s.name} · cờ sàn = ${s.is_marketplace}`)
    if (s.is_marketplace) return console.log('Không cần làm gì.')
    if (!APPLY) return console.log('Dò khô — --apply để bật cờ sàn.')
    await suppliersService.update(nga, s.id, { is_marketplace: true })
    return console.log('✓ Đã bật cờ sàn.')
  }

  const row = {
    code: 'SPE',
    name: 'Shopee',
    status: 'active' as const,
    type: 'Sàn thương mại điện tử',
    payment_terms: 'Trả trước khi đặt',
    payment_net_days: 0,
    is_marketplace: true,
    note: 'Hồ sơ SÀN (0279) — NCC thật là shop, ghi tên shop trên từng đơn. Đặt bằng nút "Đặt trên sàn".',
  }
  console.log('Sẽ tạo:', row)
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')
  const s = await suppliersService.create(nga, row)
  console.log(`✓ ${s.code} · ${s.name} (is_marketplace = ${s.is_marketplace})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
