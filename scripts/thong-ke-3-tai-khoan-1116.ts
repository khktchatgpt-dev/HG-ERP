/**
 * TÀI KHOẢN THỐNG KÊ THEO NGƯỜI (16/11/2026). Chủ dự án: "hiện tại chỉ có 3 thống
 * kê là Loan, Hằng và Xuân Hồng", "3 thống kê này có thể thống kê tất cả các công
 * đoạn và họ đang tự phân công", "đổi tên tài khoản cho hợp lí" → chọn
 * "thongke1–3 theo người".
 *
 * Trước đó có 7 tài khoản CHUNG theo tổ (thongke.han / .phoi / .sonsat / .codien /
 * .may / .nguoi / .sonnhom — tên "Thống kê Tổ …", không gắn người, 0 dòng sổ, 0
 * phiếu). Đổi ba cái đã từng đăng nhập thành tài khoản của từng người, theo quy ước
 * đặt tên phòng + số (sales1, kehoach1, qc1…), gắn hồ sơ nhân viên; khoá bốn cái
 * còn lại (mở lại được ở Admin). Ba cái giữ vai thống kê + phòng thuộc khu Sản xuất
 * nên đăng nhập vẫn vào thẳng khu Thống kê. Ghi sổ chọn tổ trên phiếu, không theo
 * phòng của tài khoản — một người ghi được mọi công đoạn.
 *
 * Tên / khoá / gắn NV đi qua hàm của màn Admin (usersService.update,
 * nhanVienTaiKhoanService.gan — có nhật ký). Ứng dụng KHÔNG có đường đổi email nên
 * email ghi thẳng + một dòng nhật ký `update`. Không đụng mật khẩu.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/thong-ke-3-tai-khoan-1116.ts [--apply]
 */
import { db } from '@/server/db'
import { usersRepo, userAuditRepo } from '@/modules/core/users/users.repo'
import { usersService } from '@/modules/core/users/users.service'
import { nhanVienTaiKhoanService } from '@/modules/core/users/nhan-vien-tai-khoan.service'

const APPLY = process.argv.includes('--apply')
const ACTOR = '2d47facc-c8ce-43ec-b5bc-6c9435825bc8' // Quản trị viên
const LY_DO = 'Tài khoản thống kê theo người (16/11/2026): 3 thống kê ghi mọi công đoạn'

/** [email cũ, email mới, mã NV]. */
const DOI: [string, string, string][] = [
  ['thongke.han@hoanggia.de', 'thongke1@hoanggia.de', '521'], // Nguyễn Thị Kim Loan
  ['thongke.phoi@hoanggia.de', 'thongke2@hoanggia.de', '494'], // Trương Thị Ngọc Hằng
  ['thongke.sonsat@hoanggia.de', 'thongke3@hoanggia.de', '167'], // Nguyễn Thị Xuân Hồng
]
const KHOA = [
  'thongke.codien@hoanggia.de',
  'thongke.may@hoanggia.de',
  'thongke.nguoi@hoanggia.de',
  'thongke.sonnhom@hoanggia.de',
]

async function main() {
  const actor = await usersRepo.findById(ACTOR)
  if (!actor) throw new Error('không thấy tài khoản thực hiện')

  const viec: (() => Promise<void>)[] = []
  for (const [cu, moi, ma] of DOI) {
    const u = (await usersRepo.findByEmail(cu)) ?? (await usersRepo.findByEmail(moi))
    if (!u) throw new Error(`không thấy ${cu}`)
    const { data: nv, error } = await db()
      .from('hr_employees')
      .select('id, code, full_name, active')
      .eq('code', ma)
      .single()
    if (error || !nv) throw new Error(`không thấy nhân viên mã ${ma}`)
    if (!nv.active) throw new Error(`${nv.full_name} đã nghỉ`)
    if (u.email !== moi && (await usersRepo.existsByEmail(moi)))
      throw new Error(`${moi} đã có người dùng`)
    console.log(
      `${u.email} "${u.name}" → ${moi} "${nv.full_name}" · gắn NV ${nv.code}${u.employee_id === nv.id ? ' (đã gắn)' : ''}`,
    )
    viec.push(async () => {
      if (u.email !== moi) {
        const { error: e } = await db()
          .from('users')
          .update({ email: moi })
          .eq('id', u.id)
        if (e) throw new Error(e.message)
        await userAuditRepo.insert({
          target_user_id: u.id,
          actor_id: actor.id,
          action: 'update',
          before: { email: u.email },
          after: { email: moi },
          reason: LY_DO,
        })
      }
      await usersService.update(actor, u.id, { name: nv.full_name, title: 'Thống kê' })
      if (u.employee_id !== nv.id)
        await nhanVienTaiKhoanService.gan(actor, u.id, nv.id, LY_DO)
    })
  }
  for (const email of KHOA) {
    const u = await usersRepo.findByEmail(email)
    if (!u) throw new Error(`không thấy ${email}`)
    console.log(`${email} "${u.name}" → khoá${u.is_active ? '' : ' (đã khoá)'}`)
    if (u.is_active)
      viec.push(async () => {
        await usersService.update(actor, u.id, { is_active: false })
      })
  }

  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')
  for (const f of viec) await f()
  console.log(`Đã ghi ${viec.length} việc.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
