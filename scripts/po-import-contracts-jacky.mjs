// NẠP 2 HỢP ĐỒNG NHẬP KHẨU của TAIZHOU XU-DAN (JACKY) — 03/09/2026.
//
//   node scripts/po-import-contracts-jacky.mjs            # dò khô
//   node scripts/po-import-contracts-jacky.mjs --apply    # ghi
//
// Hai file PDF chị Nga gửi:
//   · `contract 02.2026 HG SWIVEL BASE.pdf` — 8.600 mâm xoay 2 vòng bi, 1,25 USD/pc
//   · `contract 03.26HG painted glass.pdf` — 8 quy cách kính sơn màu, 16.818,64 USD
//
// KHÁC đơn trong nước ở ba điểm, và cả ba đều phải giữ đúng:
//   · TIỀN USD (`currency`), KHÔNG VAT ở đây — thuế nhập khẩu/VAT khâu nhập là
//     việc của tờ khai hải quan, nhét 8% vào đơn là cộng khống vào giá thành.
//   · Có SỐ HỢP ĐỒNG (`contract_no`) — đây là hợp đồng ngoại thương, không phải
//     đơn đặt nội địa; số này là thứ kế toán và hải quan tra.
//   · Điều khoản lấy nguyên văn từ các ARTICLE của hợp đồng (giao hàng, thanh
//     toán, bảo hành, cảng đi/đến).
//
// Số liệu ở đây gõ tay từ chính hai file PDF (đọc bằng pdf2json), KHÔNG đoán:
// mã HS, quy cách, số lượng, đơn giá, thành tiền đều có trên giấy.

import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const OWNER_EMAIL = 'kehoach1@hoanggia.de' // Đặng Thị Thanh Nga

const SELLER = {
  name: 'TAIZHOU XU-DAN HOME TECHNOLOGY CO., LTD.',
  code: 'TXD',
  address:
    'Room 201, Building 4, No. 4, Area 2, Taxia village, No. 528 Hebin Road, Taiping Town, Wenling City, Taizhou City, Zhejiang Province, China',
  currency: 'USD',
  bank_name: 'BANK OF TAIZHOU CO., LTD. (SWIFT TZBKCNBTXXX)',
  bank_account: '550085638700020',
  swift_code: 'TZBKCNBTXXX',
  note: 'Đại diện: JACKY FANG. Ngân hàng trung gian: The Bank of New York Mellon (SWIFT IRVTUS3NXXX).',
  type: 'Nguyên vật liệu',
  import_export: 'import',
  country: 'Trung Quốc',
}

/** Điều khoản chung của cả hai hợp đồng (ARTICLE 2–6). */
const TERMS = {
  quality: 'As confirmed samples (theo mẫu đã duyệt)',
  payment: 'TTR — đặt cọc 20%, 80% còn lại khi nhận bản sao vận đơn gốc',
  invoice:
    'Commercial Invoice · Packing List · C/O form E · Full set (3/3) clean shipped-on-board B/L',
  lead: 'Ba đến bốn tuần sau khi ký hợp đồng · dung sai số lượng ±10%',
}

const CONTRACTS = [
  {
    contract_no: '02.26HG-JACKY',
    date: '01/09/2026',
    file: 'contract 02.2026 HG SWIVEL BASE.pdf',
    template: 'accessory',
    group: 'Cơ khí - vòng bi - khuôn',
    place: 'CIF Ho Chi Minh — cảng đi Shanghai, cảng đến TP. Hồ Chí Minh',
    warranty: 'Bảo hành 12 tháng',
    total: 10750,
    lines: [
      {
        name: 'Mâm xoay 2 vòng bi 360 độ 160x160x2mm (swivel base)',
        grade: 'Steel',
        spec: '160x160x2mm',
        unit: 'Cái',
        qty: 8600,
        price: 1.25,
        note: 'HS 94019990 · Double bearing swivel base 360 degrees',
      },
    ],
  },
  {
    contract_no: '03.26HG-JACKY',
    date: '01/09/2026',
    file: 'contract 03.26HG painted glass.pdf',
    template: 'glass',
    group: 'Kính - mica - nhựa tấm',
    place: 'Cảng đi Shanghai — cảng đến Quy Nhơn',
    warranty: 'Bảo hành 12 tháng',
    total: 16818.64,
    // Cột trên hợp đồng: mã SP · mô tả · màu kính · quy cách · m²/tấm · số tấm ·
    // đơn giá USD/tấm. Mẫu `glass` của app có đúng bộ này.
    lines: [
      {
        name: 'Kính sơn màu 625x399x5mm — Dark grey',
        product_code: '26443-217',
        grade: 'Dark grey',
        dim: '625 x 399 x 5mm',
        m2: 0.2494,
        qty: 1350,
        amount: 2895.75,
      },
      {
        name: 'Kính sơn màu 625x399x5mm — Dolphin grey',
        product_code: '26443-219',
        grade: 'Dolphin grey',
        dim: '625 x 399 x 5mm',
        m2: 0.2494,
        qty: 600,
        amount: 1287,
      },
      {
        name: 'Kính sơn màu 748x833x5mm — Dark grey',
        grade: 'Dark grey',
        dim: '748 x 833 x 5mm',
        m2: 0.6231,
        qty: 100,
        amount: 535.9,
      },
      {
        name: 'Kính sơn màu 698x833x5mm — Dark grey',
        grade: 'Dark grey',
        dim: '698 x 833 x 5mm',
        m2: 0.5814,
        qty: 50,
        amount: 250,
      },
      {
        name: 'Kính sơn màu 748x833x5mm — Dolphin grey',
        grade: 'Dolphin grey',
        dim: '748 x 833 x 5mm',
        m2: 0.6231,
        qty: 200,
        amount: 1071.8,
      },
      {
        name: 'Kính sơn màu 698x833x5mm — Dolphin grey',
        grade: 'Dolphin grey',
        dim: '698 x 833 x 5mm',
        m2: 0.5814,
        qty: 100,
        amount: 500.1,
      },
      {
        name: 'Kính sơn màu 1034x998x5mm — Dark grey',
        product_code: '26473-217',
        grade: 'Dark grey',
        dim: '1034 x 998 x 5mm',
        m2: 1.0319,
        qty: 510,
        amount: 4526.25,
      },
      {
        name: 'Kính sơn màu 1034x998x5mm — Dolphin grey',
        product_code: '26473-219',
        grade: 'Dolphin grey',
        dim: '1034 x 998 x 5mm',
        m2: 1.0319,
        qty: 240,
        amount: 2130,
      },
      {
        name: 'Kính sơn màu 1034x1098x5mm — Dolphin grey',
        grade: 'Dolphin grey',
        dim: '1034 x 1098 x 5mm',
        m2: 1.1353,
        qty: 240,
        amount: 2343.36,
      },
      {
        name: 'Kính sơn màu 1034x1198x5mm — Dolphin grey',
        grade: 'Dolphin grey',
        dim: '1034 x 1198 x 5mm',
        m2: 1.2387,
        qty: 120,
        amount: 1278.48,
      },
    ],
  },
]

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const sb = await client(import.meta.url)
const [{ data: users }, { data: sups }, { data: pos }] = await Promise.all([
  sb.from('users').select('id, name').eq('email', OWNER_EMAIL),
  sb.from('supply_suppliers').select('id, code, name'),
  sb.from('supply_purchase_orders').select('code, contract_no').limit(2000),
])
const owner = users?.[0]
if (!owner) throw new Error('Không thấy tài khoản ' + OWNER_EMAIL)

for (const c of CONTRACTS) {
  const dup = (pos ?? []).find((p) => p.contract_no === c.contract_no)
  const tien = c.lines.reduce((s, l) => s + (l.amount ?? l.qty * l.price), 0)
  console.log(
    `${c.contract_no} · ${c.template.padEnd(9)} · ${c.lines.length} dòng · ${tien.toLocaleString('en-US')} USD ` +
      `(hợp đồng ghi ${c.total.toLocaleString('en-US')})${dup ? ` — ĐÃ NẠP (${dup.code})` : ''}`,
  )
}

if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

// NCC: một hồ sơ dùng chung cho cả hai hợp đồng.
let seller = (sups ?? []).find((s) => norm(s.name).includes('taizhou xu dan'))
if (!seller) {
  const { data: ns, error } = await sb
    .from('supply_suppliers')
    .insert({
      ...SELLER,
      status: 'active',
      is_active: true,
      can_order: true,
      created_by: owner.id,
      updated_by: owner.id,
    })
    .select('id, code, name')
    .single()
  if (error) throw new Error('khai NCC: ' + error.message)
  seller = ns
  console.log(`+ NCC mới ${ns.code} — ${ns.name}`)
}

for (const c of CONTRACTS) {
  if ((pos ?? []).some((p) => p.contract_no === c.contract_no)) {
    console.log(`${c.contract_no}: đã nạp trước đó, bỏ qua`)
    continue
  }
  // Vật tư: khai mới nếu chưa có (kính sơn màu nhập khẩu là hàng mới với danh mục).
  const ids = []
  for (const l of c.lines) {
    const { data: found } = await sb
      .from('warehouse_materials')
      .select('id, code, name')
      .eq('name', l.name)
      .limit(1)
    if (found?.[0]) {
      ids.push(found[0].id)
      continue
    }
    const prefix = c.template === 'glass' ? 'KIM' : 'CKH'
    const { data: sib } = await sb
      .from('warehouse_materials')
      .select('code')
      .like('code', `${prefix}%`)
      .limit(2000)
    let no = 0
    for (const row of sib ?? []) {
      const m = String(row.code ?? '').match(/^([A-Z]+)-?(\d+)$/)
      if (m && m[1] === prefix) no = Math.max(no, Number(m[2]))
    }
    const { data: ins, error } = await sb
      .from('warehouse_materials')
      .insert({
        code: `${prefix}${String(no + 1).padStart(4, '0')}`,
        name: l.name,
        unit: l.unit ?? 'Tấm',
        group_name: c.group,
        spec: l.dim ?? l.spec ?? null,
        material_grade: l.grade ?? null,
        po_template: c.template,
        needs_review: true,
        is_active: true,
      })
      .select('id, code')
      .single()
    if (error) throw new Error(`khai vật tư "${l.name}": ${error.message}`)
    console.log(`  + vật tư ${ins.code} — ${l.name}`)
    ids.push(ins.id)
  }

  const { data: code, error: ce } = await sb.rpc('next_doc_code', { p_kind: 'PO' })
  if (ce) throw new Error('cấp số đơn: ' + ce.message)
  const { data: po, error: pe } = await sb
    .from('supply_purchase_orders')
    .insert({
      code,
      production_order_id: null, // hợp đồng nhập mua cho nhiều lệnh, không gắn một lệnh
      supplier_id: seller.id,
      status: 'draft',
      template: c.template,
      currency: 'USD',
      vat_rate: 0,
      price_includes_vat: false,
      contract_no: c.contract_no,
      supplier_doc_no: c.contract_no,
      note: `Nạp từ hợp đồng nhập khẩu "${c.file}". Ngày ký: ${c.date}. Tổng theo hợp đồng: ${c.total.toLocaleString('en-US')} USD.`,
      terms_quality: TERMS.quality,
      terms_delivery_place: c.place,
      terms_payment: TERMS.payment,
      terms_invoice: TERMS.invoice,
      terms_lead_time: TERMS.lead,
      signer_role: 'NGƯỜI LẬP',
      created_by: owner.id,
      assigned_to: owner.id,
    })
    .select('id, code')
    .single()
  if (pe) throw new Error(`tạo đơn ${c.contract_no}: ${pe.message}`)

  const payload = c.lines.map((l, i) => ({
    po_id: po.id,
    material_id: ids[i],
    qty_ordered: l.qty,
    unit_price: l.amount != null ? Number((l.amount / l.qty).toFixed(6)) : l.price,
    sort_order: i,
    qty_basis: 'manual',
    price_basis: 'unit',
    spec: l.spec ?? null,
    material_grade: l.grade ?? null,
    dimension_text: l.dim ?? null,
    area_m2: l.m2 ?? null,
    product_code: l.product_code ?? null,
    note: l.note ?? null,
    warranty_text: c.warranty,
  }))
  const { error: le } = await sb.from('supply_purchase_order_lines').insert(payload)
  if (le) throw new Error(`dòng đơn ${po.code}: ${le.message}`)
  console.log(`✓ ${po.code} — ${c.contract_no}, ${payload.length} dòng`)
}
