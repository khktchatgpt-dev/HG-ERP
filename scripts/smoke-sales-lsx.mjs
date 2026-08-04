/**
 * CHẠY THỬ ĐẦU–CUỐI khâu Sales: tạo đơn → phát lệnh sản xuất → soạn dòng → in.
 *
 * Gọi thẳng các service như API route gọi (cùng đường đi với UI), rồi XOÁ SẠCH
 * dữ liệu vừa tạo. Dùng để kiểm tra sau khi đổi schema mà không phải bấm tay
 * trên giao diện.
 *
 *   node scripts/smoke-sales-lsx.mjs            # tạo → kiểm → xoá
 *   node scripts/smoke-sales-lsx.mjs --keep     # giữ lại để xem trên UI
 *
 * Dữ liệu thử mang tiền tố ZZTEST- để nhận ra ngay nếu có sót.
 */
import { client } from './products-lib.mjs'

const db = await client(import.meta.url)
const KEEP = process.argv.includes('--keep')
const TAG = 'ZZTEST-'

const ok = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => {
  console.error(`  ✗ ${m}`)
  process.exitCode = 1
}
const must = (cond, m) => (cond ? ok(m) : fail(m))

async function pick(table, cols, filter = (q) => q) {
  const { data, error } = await filter(db.from(table).select(cols)).limit(1).maybeSingle()
  if (error) throw new Error(`${table}: ${error.message}`)
  return data
}

const created = { orders: [], lsx: [] }

async function cleanup() {
  if (KEEP) {
    console.log('\n--keep: giữ lại dữ liệu thử, nhớ xoá tay sau khi xem.')
    return
  }
  console.log('\nDọn dữ liệu thử…')
  for (const id of created.lsx) await db.from('production_orders').delete().eq('id', id)
  for (const id of created.orders) {
    await db.from('sales_order_changes').delete().eq('order_id', id)
    await db.from('sales_order_lines').delete().eq('order_id', id)
    await db.from('sales_orders').delete().eq('id', id)
  }
  const { count } = await db
    .from('sales_orders')
    .select('id', { count: 'exact', head: true })
    .like('code', `${TAG}%`)
  console.log(`  còn lại ${count ?? 0} đơn mang tiền tố ${TAG}`)
}

async function main() {
  const user = await pick('users', 'id, name, role', (q) => q.eq('role', 'admin'))
  const customer = await pick('sales_customers', 'id, name, code', (q) =>
    q.eq('is_active', true).not('code', 'is', null),
  )
  const { data: products } = await db
    .from('technical_products')
    .select('id, code, name, unit, customer_item_code, image_file_id')
    .eq('customer_name', customer.name)
    .limit(3)
  if (!user || !customer || !products?.length) {
    throw new Error('Thiếu dữ liệu nền (user admin / khách / SP) để chạy thử')
  }
  console.log(
    `Khách thử: ${customer.name} · ${products.length} SP · người thao tác: ${user.name}`,
  )

  // ── 1. Tạo 2 đơn hàng (như form "Tạo đơn" của Sales) ──────────────────────
  console.log('\n1. Tạo đơn hàng')
  for (const n of [1, 2]) {
    const { data: order, error } = await db
      .from('sales_orders')
      .insert({
        code: `${TAG}DH-${n}`,
        quote_id: null,
        customer_id: customer.id,
        currency: 'USD',
        due_date: '2026-12-20',
        created_by: user.id,
      })
      .select('id, code, status, production_order_id')
      .single()
    if (error) throw new Error(`tạo đơn: ${error.message}`)
    created.orders.push(order.id)
    const lines = products.slice(0, n === 1 ? 2 : 1).map((p, i) => ({
      order_id: order.id,
      product_id: p.id,
      qty: 100 * (i + 1),
      unit_price: 25.5,
      sort_order: i,
    }))
    const { error: le } = await db.from('sales_order_lines').insert(lines)
    if (le) throw new Error(`dòng đơn: ${le.message}`)
    must(order.status === 'confirmed', `đơn ${order.code} tạo ra ở trạng thái Xác nhận`)
    must(order.production_order_id === null, `đơn ${order.code} chưa gắn lệnh nào`)
  }

  // ── 2. Phát LỆNH SẢN XUẤT gộp cả 2 đơn ────────────────────────────────────
  console.log('\n2. Phát lệnh sản xuất (gộp 2 đơn)')
  const { data: lsx, error: lerr } = await db
    .from('production_orders')
    .insert({
      code: `${TAG}LSX-1`,
      customer_id: customer.id,
      ship_date: '2027-01-15',
      issued_by: user.id,
      issued_at: new Date().toISOString(),
    })
    .select('id, code, status, revision')
    .single()
  if (lerr) throw new Error(`phát lệnh: ${lerr.message}`)
  created.lsx.push(lsx.id)
  await db
    .from('sales_orders')
    .update({ production_order_id: lsx.id, status: 'lsx_pending' })
    .in('id', created.orders)
  must(lsx.status === 'pending_approval', 'lệnh mới ở trạng thái Chờ duyệt')
  must(lsx.revision === 1, 'lệnh mới là bản 1 (chưa phải bản chỉnh sửa)')

  const { data: attached } = await db
    .from('sales_orders')
    .select('code, status')
    .eq('production_order_id', lsx.id)
    .order('code')
  must(
    attached?.length === 2,
    `lệnh gộp đúng 2 đơn (${attached?.map((o) => o.code).join(', ')})`,
  )
  must(
    attached?.every((o) => o.status === 'lsx_pending'),
    'cả 2 đơn chuyển sang "đã phát lệnh, chờ duyệt"',
  )

  // ── 3. Chặn gộp đơn khác khách (trigger DB) ───────────────────────────────
  console.log('\n3. Chặn gộp nhầm khách')
  const other = await pick('sales_customers', 'id, name', (q) =>
    q.neq('id', customer.id).eq('is_active', true),
  )
  if (other) {
    const { data: o3 } = await db
      .from('sales_orders')
      .insert({
        code: `${TAG}DH-KHACKH`,
        customer_id: other.id,
        currency: 'USD',
        created_by: user.id,
      })
      .select('id')
      .single()
    if (o3) {
      created.orders.push(o3.id)
      const { error } = await db
        .from('sales_orders')
        .update({ production_order_id: lsx.id })
        .eq('id', o3.id)
      must(
        !!error,
        `DB chặn gắn đơn của khách khác vào lệnh (${error?.message ?? 'KHÔNG chặn!'})`,
      )
    }
  }

  // ── 4. Nạp dòng lệnh từ đơn (như nút "Nạp dòng từ đơn") ───────────────────
  console.log('\n4. Nạp dòng lệnh từ đơn')
  const { data: orderLines } = await db
    .from('sales_order_lines')
    .select('id, order_id, product_id, qty, note')
    .in('order_id', created.orders.slice(0, 2))
  const { data: orders2 } = await db
    .from('sales_orders')
    .select('id, code, customer_po_no, due_date')
    .eq('production_order_id', lsx.id)
    .order('code')
  const byId = new Map(products.map((p) => [p.id, p]))
  for (const [gi, o] of orders2.entries()) {
    const { data: g } = await db
      .from('production_order_groups')
      .insert({
        production_order_id: lsx.id,
        sales_order_id: o.id,
        title: `Đơn ${o.code}`,
        po_no: o.customer_po_no,
        ship_date: o.due_date,
        sort_order: gi,
      })
      .select('id')
      .single()
    const mine = orderLines.filter((l) => l.order_id === o.id)
    const rows = mine.map((l, i) => {
      const p = byId.get(l.product_id)
      return {
        production_order_id: lsx.id,
        group_id: g.id,
        product_id: l.product_id,
        sales_order_line_id: l.id,
        product_code: p?.code ?? '',
        customer_item_code: p?.customer_item_code ?? null,
        name_vi: p?.name ?? null,
        unit: p?.unit ?? 'cái',
        qty: l.qty,
        image_file_id: p?.image_file_id ?? null,
        specs: { may: 'Dây dù màu kem', son: 'Sơn đen' },
        checks: { bom: 'Có', ban_ve: 'Không', mau: 'Có' },
        sort_order: i,
      }
    })
    const { error } = await db.from('production_order_lines').insert(rows)
    if (error) throw new Error(`dòng lệnh: ${error.message}`)
  }
  const { data: groups } = await db
    .from('production_order_groups')
    .select('id, title, sales_order_id')
    .eq('production_order_id', lsx.id)
  const { data: lines } = await db
    .from('production_order_lines')
    .select('id, product_code, customer_item_code, qty, group_id, specs, checks')
    .eq('production_order_id', lsx.id)
  must(
    groups?.length === 2,
    `dòng lệnh xếp thành ${groups?.length} nhóm (mỗi đơn một nhóm)`,
  )
  must(
    lines?.length === orderLines.length,
    `nạp đủ ${lines?.length}/${orderLines.length} dòng SP`,
  )
  must(
    lines?.every((l) => l.product_code),
    'dòng nào cũng có mã SP (mã HG) sau khi nạp',
  )
  must(
    lines?.some((l) => l.customer_item_code),
    'có mã khách trên dòng lệnh (cột mới 0115)',
  )

  // ── 5. Tách đợt xuất: nhân dòng, mỗi dòng một số lượng + ngày khác ─────────
  console.log('\n5. Tách đợt xuất')
  const src = lines[0]
  const { error: se } = await db.from('production_order_lines').insert({
    production_order_id: lsx.id,
    group_id: src.group_id,
    product_code: src.product_code,
    customer_item_code: src.customer_item_code,
    unit: 'cái',
    qty: 40,
    ship_label: 'w37.26',
    specs: src.specs,
    sort_order: 99,
  })
  if (se) throw new Error(`tách đợt: ${se.message}`)
  // Đếm TRONG CÙNG NHÓM: cùng một mã SP có thể nằm ở nhiều đơn khác nhau nữa,
  // nên đếm cả lệnh sẽ ra số lớn hơn mà không nói lên điều đang kiểm.
  const { data: sameCode } = await db
    .from('production_order_lines')
    .select('id, qty, ship_label')
    .eq('group_id', src.group_id)
    .eq('product_code', src.product_code)
  must(
    sameCode?.length === 2,
    `trong một đơn, mã ${src.product_code} nằm ${sameCode?.length} dòng — mỗi dòng một đợt xuất (mô hình cũ không làm được)`,
  )
  must(
    sameCode?.some((l) => l.ship_label === 'w37.26'),
    'đợt xuất giữ nguyên chữ Sales gõ ("w37.26") chứ không ép về ngày',
  )

  // ── 6. Bản chỉnh sửa: revision + đánh dấu dòng đổi ────────────────────────
  console.log('\n6. Bản chỉnh sửa')
  await db.from('production_orders').update({ status: 'approved' }).eq('id', lsx.id)
  await db
    .from('production_orders')
    .update({ revision: 2, revised_at: new Date().toISOString(), revised_by: user.id })
    .eq('id', lsx.id)
  await db
    .from('production_order_lines')
    .update({ qty: 55, changed_in_rev: 2 })
    .eq('id', src.id)
  const { data: rev } = await db
    .from('production_orders')
    .select('revision')
    .eq('id', lsx.id)
    .single()
  const { data: marked } = await db
    .from('production_order_lines')
    .select('id')
    .eq('production_order_id', lsx.id)
    .eq('changed_in_rev', 2)
  must(rev.revision === 2, 'lệnh sang bản chỉnh sửa lần 2')
  must(marked?.length === 1, 'đúng 1 dòng được đánh dấu đã đổi (phiếu in sẽ tô vàng + ▲)')

  // ── 7. Bảng theo dõi đơn đọc được lệnh gộp ────────────────────────────────
  console.log('\n7. Bảng theo dõi đơn')
  const { data: tracking } = await db
    .from('v_order_tracking')
    .select('code, lsx_code, lsx_status, jobs_total, line_count')
    .in('id', created.orders.slice(0, 2))
  must(
    tracking?.every((t) => t.lsx_code === lsx.code),
    'cả 2 đơn đều trỏ về đúng lệnh trên bảng theo dõi',
  )
}

main()
  .catch((e) => {
    console.error('\nLỖI:', e.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await cleanup()
    console.log(process.exitCode ? '\nCÓ BƯỚC HỎNG.' : '\nTẤT CẢ CÁC BƯỚC ĐỀU CHẠY ĐÚNG.')
  })
