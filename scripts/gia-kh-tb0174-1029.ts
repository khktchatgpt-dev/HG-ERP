/**
 * Giá KH 40,91 USD (chỉ FOB) → TB0174HG-AL Bàn xếp Santorin — 29/10/2026.
 *
 *   npx tsx --conditions=react-server --env-file=D:/HG-ERP/.env.local scripts/gia-kh-tb0174-1029.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=D:/HG-ERP/.env.local scripts/gia-kh-tb0174-1029.ts --apply   # ghi
 *
 * User: "Đặt giá cho TB0174". Giá này nạp 03/10 (`plan-cost-nap-drive-ma-1003.mjs`)
 * vào nhầm 28256-228 vì seed gõ nhầm mã khách 22028-209; dòng nguồn (order HG
 * 2026-2027 › 17976 dòng 22, "Balkonklapptisch…Alu/Akazie, graphit FSC 100%") là
 * Bàn xếp Santorin — đơn 17976 HG-MX có TB0174 ×120. Đã xoá ở 28256-228 cùng ngày
 * (`don-2-ho-so-lech-1029.ts`, giá cũ trong backup đó).
 *
 * Ghi qua `planCostService.save` (đường của màn Giá thành KH). plan_by giữ theo
 * luật lượt nạp 03/10: Sale phụ trách giá — Phương; ngày = hôm nay (service đặt).
 * Đổi bảng lãi/lỗ lệnh 01 + 13 (TB0174 nằm trên hai lệnh đó) — user đã đồng ý.
 */
import { db } from '@/server/db'
import { usersRepo } from '@/modules/core/users/users.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { planCostService } from '@/modules/dept/technical/plan-cost.service'
import { planCostBulkSchema } from '@/modules/dept/technical/plan-cost.schema'

const APPLY = process.argv.includes('--apply')
const TB0174 = '9999b62a-9e6c-479a-a503-dfb1f5a01eda'
const PHUONG = 'e589c8de-66f5-48be-bf33-55bc2fa9fef9'
const SOURCE =
  'order HG 2026-2027.xlsx › 17976 (Drive 1s9vmBxQ1DCEMEn2dLkSil-0CbLIMwhtX) · dòng 22'

async function main() {
  const phuong = await usersRepo.findById(PHUONG)
  if (!phuong) throw new Error('Không thấy tài khoản Phương')
  const ok = await canAction(phuong, 'technical.plan_cost.manage')
  console.log(`${phuong.name} (${phuong.role}) technical.plan_cost.manage = ${ok}`)

  const { data: p, error } = await db()
    .from('technical_products')
    .select('code, customer_item_code, plan_price, plan_currency, plan_source')
    .eq('id', TB0174)
    .single()
  if (error) throw new Error(error.message)
  console.log('TB0174 trước:', JSON.stringify(p))
  if (p.code !== 'TB0174HG-AL' || p.customer_item_code !== '22028-209')
    throw new Error('TB0174 khác lúc rà')
  if (p.plan_price != null) throw new Error('TB0174 đã có giá KH — dừng, không đè')
  if (!ok) throw new Error('Phương thiếu quyền — dừng')

  const input = planCostBulkSchema.parse({
    items: [
      {
        product_id: TB0174,
        price: 40.91,
        breakdown: [
          {
            label: 'Balkonklapptisch, mit Ablagefläche, Alu/Akazie, graphit FSC 100%',
            amount: 40.91,
          },
        ],
      },
    ],
    currency: 'USD',
    source: SOURCE,
  })
  if (!APPLY) {
    console.log('Sẽ ghi:', JSON.stringify(input))
    console.log('Dò khô xong — thêm --apply để ghi.')
    return
  }
  console.log(await planCostService.save(phuong, input))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
