// CẤP QUYỀN DUYỆT ĐƠN MUA CHO VŨ PHƯƠNG THẢO — 25/09/2026.
//
//   node scripts/rbac-po-approver-thao.mjs            # dò khô
//   node scripts/rbac-po-approver-thao.mjs --apply    # ghi
//
// Chủ dự án chọn "Chỉ duyệt đơn mua" (không gán vai `director` — vai đó mang 24
// quyền: duyệt LSX/báo giá/nghỉ phép, sửa BOM/kho, khoá ngày SX…). Nên tạo vai
// RIÊNG `po_approver` với DUY NHẤT `supply.po.approve`, gán TAY cho Thảo.
//
// Làm đúng ba bước của trang /admin/permissions (rbac.service createRole →
// setRolePermissions → setUserManualRoles) và ghi rbac_audit_log đúng dạng
// handler `rbac.audit.ts` ghi. Vai gán tay (source 'manual') — cầu đồng bộ vai
// dẫn-xuất (rbac.sync) KHÔNG gỡ nó khi đổi phòng/chức danh.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const sb = await client(import.meta.url)
const TARGET = 'ketoan2@hoanggia.de' // Vũ Phương Thảo
const ACTOR = 'it@hoanggia.de' // Trần Đại Việt — IT, thực hiện theo chỉ đạo qua Claude
const ROLE = {
  key: 'po_approver',
  label: 'Duyệt đơn mua',
  description:
    'Chỉ duyệt / trả lại đơn mua (supply.po.approve). Tạo 25/09/2026 cho người duyệt đơn mua ngoài Ban Giám đốc — không kèm quyền nào khác của vai director.',
}
const PERM = 'supply.po.approve'
const WHY =
  'Theo chỉ đạo 25/09/2026 — Thảo là người ký duyệt đơn mua; chỉ cấp quyền duyệt đơn mua.'

const [{ data: target }, { data: actor }, { data: perm }, { data: existing }] =
  await Promise.all([
    sb.from('users').select('id, name, email').eq('email', TARGET).single(),
    sb.from('users').select('id, name, role').eq('email', ACTOR).single(),
    sb.from('permissions').select('key').eq('key', PERM).maybeSingle(),
    sb.from('roles').select('id, key, label').eq('key', ROLE.key).maybeSingle(),
  ])
if (!target || !actor) throw new Error('thiếu tài khoản')
if (actor.role !== 'admin') throw new Error('người thực hiện phải là admin')
if (!perm) throw new Error(`quyền ${PERM} không tồn tại`)
console.log(
  `Vai "${ROLE.label}" (${ROLE.key}): ${existing ? 'ĐÃ CÓ' : 'sẽ tạo'} · quyền ${PERM} · gán tay cho ${target.name} · người thực hiện ${actor.name}`,
)
if (!APPLY) {
  console.log('(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

const audit = (row) =>
  sb
    .from('rbac_audit_log')
    .insert({ actor_id: actor.id, reason: WHY, ...row })
    .then(({ error }) => {
      if (error) throw new Error(`audit: ${error.message}`)
    })

// 1. Vai.
let role = existing
if (!role) {
  const { data, error } = await sb
    .from('roles')
    .insert({ ...ROLE, sort_order: 100, is_system: false, is_active: true })
    .select('id, key, label')
    .single()
  if (error) throw new Error(`tạo vai: ${error.message}`)
  role = data
  await audit({
    action: 'role.created',
    target_type: 'role',
    target_id: role.id,
    target_label: role.label,
    after: { key: role.key, label: role.label },
  })
  console.log(`  + vai ${role.key}`)
}
// 2. Quyền của vai.
const { data: rp } = await sb
  .from('role_permissions')
  .select('permission_key')
  .eq('role_id', role.id)
if (!(rp ?? []).some((x) => x.permission_key === PERM)) {
  const { error } = await sb
    .from('role_permissions')
    .insert({ role_id: role.id, permission_key: PERM })
  if (error) throw new Error(`gán quyền cho vai: ${error.message}`)
  await audit({
    action: 'role.permissions_changed',
    target_type: 'role',
    target_id: role.id,
    target_label: role.label,
    before: { removed: [] },
    after: { added: [PERM] },
  })
  console.log(`  + quyền ${PERM}`)
}
// 3. Gán tay cho người dùng.
const { data: ur } = await sb
  .from('user_roles')
  .select('role_id')
  .eq('user_id', target.id)
  .eq('role_id', role.id)
if (!(ur ?? []).length) {
  const { error } = await sb
    .from('user_roles')
    .insert({
      user_id: target.id,
      role_id: role.id,
      source: 'manual',
      assigned_by: actor.id,
    })
  if (error) throw new Error(`gán vai: ${error.message}`)
  await audit({
    action: 'role.assigned',
    target_type: 'user',
    target_id: target.id,
    target_label: target.name ?? target.email,
    after: { role_key: role.key, role_label: role.label },
  })
  console.log(`  + gán ${role.key} cho ${target.name}`)
}
console.log('Xong.')
