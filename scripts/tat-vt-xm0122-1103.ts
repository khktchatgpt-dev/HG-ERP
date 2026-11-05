/**
 * Ngừng dùng XM-0122 "MOuse ghế 1" (725x695x140) — tạo trùng MUT0206 "Mút D20 725X695X140"
 * sáng 03/11 vì ô tìm vật tư gõ "Mousse" không ra mã "Mút". Đã kiểm: 0 dòng ở 12 bảng có
 * khoá ngoại tới vật tư + 0 dòng định mức. Đi qua materialsService.setActive (bắt lý do,
 * phát material.changed để ghi vết) như nút "Ngừng dùng" trên màn. User duyệt 03/11.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/tat-vt-xm0122-1103.ts [--apply]
 */
import { db } from '@/server/db'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const LY_DO =
  'Trùng MUT0206 (Mút D20 725X695X140) — tạo nhầm 03/11 khi lập đơn mút GIGA 01; dùng MUT0206'

async function main() {
  const { data: m, error } = await db().from('warehouse_materials').select('id, code, name, spec, is_active').eq('code', 'XM-0122').single() // prettier-ignore
  if (error || !m) throw new Error(`không thấy XM-0122: ${error?.message}`)
  const { data: goc } = await db().from('warehouse_materials').select('code, name, is_active').eq('code', 'MUT0206').single() // prettier-ignore
  console.log(`${m.code} "${m.name}" ${m.spec} · đang dùng: ${m.is_active} · mã giữ lại: ${goc?.code} "${goc?.name}" (${goc?.is_active ? 'đang dùng' : 'NGỪNG'})`) // prettier-ignore
  if (!goc?.is_active) throw new Error('MUT0206 không còn dùng — dừng')
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')
  const admin = (await usersRepo.list()).find((u) => u.email === 'admin@hg.com')
  if (!admin) throw new Error('thiếu admin@hg.com')
  const saved = await materialsService.setActive(admin, m.id, { active: false, reason: LY_DO })
  console.log(`✓ ${saved.code} is_active = ${saved.is_active}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
