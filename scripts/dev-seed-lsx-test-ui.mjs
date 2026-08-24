import { createClient } from '@supabase/supabase-js'
import { SignJWT } from 'jose'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('D:/HG-ERP/.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)

const iso = (d) => d.toISOString().slice(0, 10)
const today = new Date()
const day = (n) => {
  const d = new Date(today)
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}

async function must(q, label) {
  const { data, error } = await q
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

// ── Dữ liệu nền thật ────────────────────────────────────────────────────────
const [admin] = await must(
  db.from('users').select('id, email, password_changed_at').eq('role', 'admin').limit(1),
  'admin',
)
const [customer] = await must(
  db.from('sales_customers').select('id, name').limit(1),
  'customer',
)
const [product] = await must(
  db.from('technical_products').select('id, code, name').limit(1),
  'product',
)
const materials = await must(
  db.from('warehouse_materials').select('id, code, name, unit').limit(2),
  'materials',
)
const stages = await must(
  db
    .from('catalog_items')
    .select('code, label')
    .eq('type', 'production_stage')
    .eq('is_active', true)
    .order('sort_order')
    .limit(3),
  'stages',
)
const teams = await must(
  db.from('departments').select('id, name').eq('workspace_id', 'production').limit(2),
  'teams',
)
if (stages.length < 3 || teams.length < 1 || materials.length < 2) {
  throw new Error(
    `Thiếu nền: stages=${stages.length}, teams=${teams.length}, materials=${materials.length}`,
  )
}
const [s1, s2, s3] = stages.map((s) => s.code)
const T1 = teams[0].id
const T2 = teams[1]?.id ?? teams[0].id
console.log('Nền:', {
  admin: admin.email,
  customer: customer.name,
  product: product.code,
  materials: materials.map((m) => m.code),
  stages: stages.map((s) => `${s.code}(${s.label})`),
  teams: teams.map((t) => t.name),
})

// ── Dọn bản test cũ (chạy lại an toàn) ──────────────────────────────────────
const { data: old } = await db
  .from('production_orders')
  .select('id')
  .eq('code', 'LSX-TEST-UI')
for (const o of old ?? []) {
  for (const t of [
    'production_entries',
    'production_transfers',
    'production_jobs',
    'production_components',
    'production_order_boms',
    'production_order_lines',
    'production_order_groups',
  ]) {
    await db.from(t).delete().eq('production_order_id', o.id)
  }
  await db.from('production_orders').delete().eq('id', o.id)
  console.log('Đã dọn LSX test cũ', o.id)
}
await db
  .from('production_day_locks')
  .delete()
  .eq('entry_date', day(0))
  .eq('team_department_id', T1)

// ── Lệnh test ───────────────────────────────────────────────────────────────
const [lsx] = await must(
  db
    .from('production_orders')
    .insert({
      code: 'LSX-TEST-UI',
      customer_id: customer.id,
      status: 'approved',
      priority: 1,
      ship_date: day(5),
      received_date: day(-5),
      materials_due_at: `${day(-1)}T00:00:00Z`, // trễ hẹn vật tư 1 ngày
      created_by: admin.id,
      issued_by: admin.id,
      issued_at: new Date().toISOString(),
      note: 'Lệnh TEST giao diện — xoá sau khi nghiệm thu (node scripts cleanup)',
    })
    .select('id'),
  'lsx',
)
const [group] = await must(
  db
    .from('production_order_groups')
    .insert({ production_order_id: lsx.id, title: 'TEST-UI', sort_order: 0 })
    .select('id'),
  'group',
)
const [line] = await must(
  db
    .from('production_order_lines')
    .insert({
      production_order_id: lsx.id,
      group_id: group.id,
      product_id: product.id,
      product_code: product.code,
      name_vi: product.name,
      qty: 100,
      unit: 'bộ',
      sort_order: 0,
    })
    .select('id'),
  'line',
)

const comps = await must(
  db
    .from('production_components')
    .insert([
      {
        production_order_id: lsx.id,
        production_order_line_id: line.id,
        name: 'TAY TEST',
        qty_per_unit: 2, // cần 200
        dm_kg: 0.5,
        material_id: materials[0].id,
        unit: 'cái',
        sort_order: 1,
      },
      {
        production_order_id: lsx.id,
        production_order_line_id: line.id,
        name: 'CHÂN TEST',
        qty_per_unit: 4, // cần 400
        dm_kg: 0.25,
        material_id: materials[1].id,
        unit: 'cái',
        sort_order: 2,
      },
    ])
    .select('id, name'),
  'components',
)
const c1 = comps.find((c) => c.name === 'TAY TEST').id
const c2 = comps.find((c) => c.name === 'CHÂN TEST').id

await must(
  db
    .from('production_jobs')
    .insert([
      // s1 xong; s2 đang chạy trong kế hoạch; s3 todo ĐÃ QUÁ HẠN kế hoạch.
      {
        production_order_id: lsx.id,
        production_order_line_id: line.id,
        stage: s1,
        seq: 0,
        team_department_id: T1,
        planned_start: day(-4),
        planned_end: day(-2),
        status: 'done',
        done_by: admin.id,
        done_at: new Date().toISOString(),
      },
      {
        production_order_id: lsx.id,
        production_order_line_id: line.id,
        stage: s2,
        seq: 1,
        team_department_id: T1,
        planned_start: day(-2),
        planned_end: day(2),
        status: 'doing',
      },
      {
        production_order_id: lsx.id,
        production_order_line_id: line.id,
        stage: s3,
        seq: 2,
        team_department_id: T2,
        planned_start: day(-3),
        planned_end: day(-1),
        status: 'todo',
      },
    ])
    .select('id'),
  'jobs',
)

await must(
  db
    .from('production_entries')
    .insert([
      // s1 đủ số từ 3 ngày trước.
      {
        production_order_id: lsx.id,
        component_id: c1,
        stage: s1,
        team_department_id: T1,
        entry_date: day(-3),
        qty: 200,
        kg: 100,
        defect_qty: 0,
        worker_name: 'Nguyễn Văn Test',
        created_by: admin.id,
      },
      {
        production_order_id: lsx.id,
        component_id: c2,
        stage: s1,
        team_department_id: T1,
        entry_date: day(-3),
        qty: 400,
        kg: 100,
        defect_qty: 0,
        worker_name: 'Trần Thị Test',
        created_by: admin.id,
      },
      // s2 hôm qua: 130 (5 phế trầy xước).
      {
        production_order_id: lsx.id,
        component_id: c1,
        stage: s2,
        team_department_id: T1,
        entry_date: day(-1),
        qty: 50,
        kg: 25,
        defect_qty: 0,
        worker_name: 'Nguyễn Văn Test',
        created_by: admin.id,
      },
      {
        production_order_id: lsx.id,
        component_id: c2,
        stage: s2,
        team_department_id: T1,
        entry_date: day(-1),
        qty: 80,
        kg: 20,
        defect_qty: 5,
        defect_reason: 'Trầy xước',
        worker_name: 'Trần Thị Test',
        created_by: admin.id,
      },
      // s2 HÔM NAY: 70 đạt, 2 phế sai kích thước.
      {
        production_order_id: lsx.id,
        component_id: c1,
        stage: s2,
        team_department_id: T1,
        entry_date: day(0),
        qty: 30,
        kg: 15,
        defect_qty: 0,
        worker_name: 'Nguyễn Văn Test',
        created_by: admin.id,
      },
      {
        production_order_id: lsx.id,
        component_id: c2,
        stage: s2,
        team_department_id: T1,
        entry_date: day(0),
        qty: 40,
        kg: 10,
        defect_qty: 2,
        defect_reason: 'Sai kích thước',
        worker_name: 'Trần Thị Test',
        created_by: admin.id,
      },
    ])
    .select('id'),
  'entries',
)

await must(
  db
    .from('production_transfers')
    .insert([
      // Giao dồn phôi vào tổ ở công đoạn s2 → tồn WIP lớn → cảnh báo nghẽn.
      {
        production_order_id: lsx.id,
        component_id: c1,
        stage: s2,
        team_department_id: T1,
        direction: 'issue',
        entry_date: day(-2),
        qty: 500,
        created_by: admin.id,
      },
      {
        production_order_id: lsx.id,
        component_id: c2,
        stage: s2,
        team_department_id: T1,
        direction: 'issue',
        entry_date: day(-2),
        qty: 600,
        created_by: admin.id,
      },
    ])
    .select('id'),
  'transfers',
)

await must(
  db
    .from('production_day_locks')
    .insert({ team_department_id: T1, entry_date: day(0), locked_by: admin.id })
    .select('id'),
  'day lock',
)

await must(
  db
    .from('production_order_boms')
    .insert([
      {
        production_order_id: lsx.id,
        product_id: product.id,
        material_code: materials[0].code,
        qty_per_unit: 1,
        snapped_by: admin.id,
      },
      {
        production_order_id: lsx.id,
        product_id: product.id,
        material_code: materials[1].code,
        qty_per_unit: 0.5,
        snapped_by: admin.id,
      },
    ])
    .select('material_code'),
  'boms',
)

// Đối chiếu view vật tư.
const { data: mat } = await db
  .from('v_lsx_material_status')
  .select('*')
  .eq('production_order_id', lsx.id)
console.log(
  'v_lsx_material_status:',
  (mat ?? []).map(
    (r) =>
      `${r.material_code}: cần ${r.qty_needed}, xuất ${r.qty_issued}, thiếu ${r.qty_remaining}`,
  ),
)

// ── Session token cho phiên test UI (JWT HS256 như session.ts) ──────────────
const token = await new SignJWT({
  email: admin.email,
  pv: admin.password_changed_at ?? '',
})
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(admin.id)
  .setIssuedAt()
  .setExpirationTime('7d')
  .sign(new TextEncoder().encode(env.SESSION_SECRET))
console.log('LSX id:', lsx.id)
console.log('SESSION_TOKEN=' + token)
