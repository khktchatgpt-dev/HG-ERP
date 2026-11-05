/**
 * Bổ sung NCC An Khương theo tin nhắn NCC gửi chị Nga (03/11/2026): tên pháp lý đầy đủ,
 * MST 4101616459, đại diện Trương Đại Chúng (Giám đốc). NCC ĐÃ CÓ trong danh mục từ
 * 02/08 ("CÔNG TY TNHH SX TM AN KHƯƠNG", cùng địa chỉ, liên hệ Mr Đại Chúng, 0 đơn) —
 * sửa bản ghi đó, KHÔNG tạo NCC thứ hai. Đổi cả `name` vì phiếu in đơn "Kính gửi:" lấy
 * ô name. Giao chị Nga phụ trách (buyer_id). Đi qua suppliersService.update (soát MST trùng).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/ncc-an-khuong-1103.ts [--apply]
 */
import { db } from '@/server/db'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { supplierUpdateSchema } from '@/modules/dept/supply/suppliers.schema'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const ID = '38fee098-34d2-409f-a9d1-53dfbfea4b1e'
const DIA_CHI = 'Số 21 Trần Thúc Tự, Phường Quy Nhơn Đông, Tỉnh Gia Lai, Việt Nam'

async function main() {
  const { data: s, error } = await db().from('supply_suppliers').select('id, name, tax_no, address, contact_name, buyer_id').eq('id', ID).single() // prettier-ignore
  if (error || !s) throw new Error(`không thấy NCC: ${error?.message}`)
  console.log('TRƯỚC:', JSON.stringify(s))
  const trung = await db().from('supply_suppliers').select('name').eq('tax_no', '4101616459').neq('id', ID) // prettier-ignore
  if (trung.data?.length) throw new Error(`MST đã thuộc NCC khác: ${trung.data[0].name}`)
  const users = await usersRepo.list()
  const nga = users.find((u) => u.email === 'kehoach1@hoanggia.de')
  const admin = users.find((u) => u.email === 'admin@hg.com')
  if (!nga || !admin) throw new Error('thiếu chị Nga / admin')
  const patch = supplierUpdateSchema.parse({
    name: 'CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI AN KHƯƠNG',
    company_name: 'CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI AN KHƯƠNG',
    short_name: 'An Khương',
    tax_no: '4101616459',
    legal_rep: 'Trương Đại Chúng — Giám đốc',
    registered_address: DIA_CHI,
    address: DIA_CHI,
    buyer_id: nga.id,
  })
  console.log('SỬA:', JSON.stringify(patch))
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')
  const saved = await suppliersService.update(admin, ID, patch)
  console.log(`✓ ${saved.name} · MST ${saved.tax_no} · phụ trách ${nga.name}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
