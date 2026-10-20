/**
 * PO-2026-0045 (Kimpack, lệnh 06/26-27 - MX): GỠ 2 DÒNG BÀN ELOS — 02/10/2026.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-0045-bo-dong-elos-1002.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-0045-bo-dong-elos-1002.ts --apply   # ghi
 *
 * Chủ dự án: "PO-0045 mã này xoá đi để xác nhận lại kích thước lên sau". Hai dòng
 * của bàn Elos (21711-217) — "BB bàn Elos" 100 thùng và "Tấm lớp 3L 2 đầu" 200 tấm —
 * tờ chưa có kích thước nên giá = 0. Kích thước chốt xong thì thêm lại (dòng mới).
 *
 * Hai dòng đã nằm trong PNK-2026-0066 / PXK-2026-0018 (lệnh 06) / PXK-2026-0019
 * (lệnh 07) ghi ngày 02/10 (`po-nhap-xuat-lsx0626-1002.ts`). Sổ kho không đảo được
 * từng dòng, nên:
 *   1. đảo PXK-0018 + PXK-0019 (hàng về lại kho), rồi đảo PNK-0066 — qua
 *      `stockService.reverseDoc`, tồn từng mã về đúng như trước;
 *   2. xoá 2 dòng đơn (tiền dòng = 0 nên tổng đơn không đổi) + ghi chú nội bộ;
 *   3. nhập lại 13 dòng còn lại + xuất lại cho lệnh 06 / lệnh 07 như cũ.
 */
import { db } from '@/server/db'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import type { User } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const PO_CODE = 'PO-2026-0045'
const DROP = [
  '19663205-6dc3-4973-87a9-91756936846f',
  '3e525a62-f56a-4d2e-8d97-efc20c6f3e52',
]
const REVERSE = ['PXK-2026-0018', 'PXK-2026-0019', 'PNK-2026-0066'] // xuất trước, nhập sau
const OWNER_EMAIL = 'kehoach1@hoanggia.de' // Đặng Thị Thanh Nga
const DOC_DATE = '2026-10-02'
const REASON =
  'Gỡ 2 dòng bàn Elos (BB bàn Elos, Tấm lớp 3L 2 đầu) khỏi PO-2026-0045 — chưa có kích thước, xác nhận lại rồi lên sau. Ghi lại phiếu cho các dòng còn lại.'
/** Phần lệnh 07 của dòng "2644127" (380 = 300 lệnh 06 + 80 lệnh 07). */
const TO_LSX7: Record<string, number> = { '2644127': 80 }

async function main() {
  const sb = db()
  const { data: nga } = await sb
    .from('users')
    .select('*')
    .eq('email', OWNER_EMAIL)
    .single()
  if (!nga) throw new Error('không thấy chị Nga')
  const user = nga as User
  const { data: po } = await sb
    .from('supply_purchase_orders')
    .select('id, code, status, supplier_doc_no, sup:supply_suppliers(name)')
    .eq('code', PO_CODE)
    .single()
  if (!po) throw new Error(`không thấy ${PO_CODE}`)
  const lenh = async (code: string) => {
    const { data } = await sb
      .from('production_orders')
      .select('id, code')
      .eq('code', code)
      .single()
    if (!data) throw new Error(`không thấy lệnh ${code}`)
    return data as { id: string; code: string }
  }
  const [lsx6, lsx7] = await Promise.all([lenh('06/26-27 - MX'), lenh('07/26-27 - MX')])
  const { data: docs } = await sb
    .from('warehouse_docs')
    .select('id, code, status, reversal_of_doc_id')
    .in('code', REVERSE)
  const { data: lines } = await sb
    .from('supply_purchase_order_lines')
    .select(
      'id, material_id, qty_ordered, unit_price, product_code, m:warehouse_materials(code, name)',
    )
    .eq('po_id', po.id)
    .order('sort_order')
  const drop = (lines ?? []).filter((l) => DROP.includes(l.id))
  const keep = (lines ?? []).filter((l) => !DROP.includes(l.id))
  if (drop.length !== 2) throw new Error(`thấy ${drop.length}/2 dòng cần gỡ`)
  if (drop.some((l) => Number(l.unit_price) !== 0))
    throw new Error('dòng cần gỡ có giá — dừng')
  if ((docs ?? []).length !== 3) throw new Error('thiếu phiếu cần đảo')

  console.log(`${po.code} · ${po.status} · ${keep.length + drop.length} dòng`)
  for (const l of drop) {
    const m = l.m as unknown as { code: string; name: string }
    console.log(`  − gỡ ${m.code} ${m.name} ${l.qty_ordered}`)
  }
  console.log(
    `  đảo ${REVERSE.join(', ')} → nhập lại ${keep.length} dòng + xuất lại lệnh 06/07`,
  )
  if (!APPLY) {
    console.log('\n(dò khô — thêm --apply để ghi)')
    return
  }

  // 1. Đảo phiếu (xuất trước để hàng về kho, rồi mới đảo phiếu nhập).
  for (const code of REVERSE) {
    const d = docs!.find((x) => x.code === code)!
    const r = await stockService.reverseDoc(user, d.id, REASON)
    console.log(`  ✓ đảo ${code} bằng ${r.code}`)
  }
  // 2. Xoá 2 dòng + vết.
  const { error: de } = await sb
    .from('supply_purchase_order_lines')
    .delete()
    .in('id', DROP)
  if (de) throw new Error(`xoá dòng: ${de.message}`)
  const { error: ne } = await sb.from('doc_notes').insert({
    doc_type: 'po',
    doc_id: po.id,
    author_id: user.id,
    audience: 'internal',
    body: `${REASON} Phiếu đảo: ${REVERSE.join(', ')}. Hai dòng đã gỡ: BB bàn Elos 100 thùng (21711-217) và Tấm lớp 3L 2 đầu 200 tấm (lót bàn Elos) — đơn giá 0 trên tờ nên tổng đơn không đổi.`,
  })
  if (ne) throw new Error(`ghi chú: ${ne.message}`)
  console.log('  ✓ đã xoá 2 dòng + ghi chú nội bộ')

  // 3. Nhập lại + xuất lại.
  const supName = (po.sup as unknown as { name: string } | null)?.name ?? ''
  const rec = await stockService.createReceiptDoc(user, {
    po_id: po.id,
    counterparty: supName,
    supplier_doc_no: po.supplier_doc_no ?? null,
    doc_date: DOC_DATE,
    note: `Ghi hộ 02/10/2026 theo chỉ đạo: hàng đã về đủ trước khi dùng hệ thống (file không ghi ngày giao). Lập lại thay PNK-2026-0066 sau khi gỡ 2 dòng bàn Elos. Đã đưa vào sản xuất — xuất cho lệnh cùng ngày.`,
    lines: keep.map((l) => ({
      material_id: l.material_id as string,
      qty: Number(l.qty_ordered),
      po_line_id: l.id,
    })),
  })
  console.log(`  ✓ ${rec.code} · đơn → ${rec.po_status}`)
  const issue = async (
    target: { id: string; code: string },
    part: (l: (typeof keep)[0]) => number,
  ) => {
    const need = new Map<string, number>()
    for (const l of keep) {
      const q = part(l)
      if (q > 0)
        need.set(l.material_id as string, (need.get(l.material_id as string) ?? 0) + q)
    }
    if (need.size === 0) return
    const iss = await stockService.createIssueDoc(user, {
      kind: 'lsx',
      production_order_id: target.id,
      doc_date: DOC_DATE,
      note: `Ghi hộ 02/10/2026: vật tư của ${po.code} (${rec.code}) đã đưa vào sản xuất lệnh ${target.code} trước khi dùng hệ thống — xuất cùng ngày nhập để tồn đúng thực tế (KK-2026-0004 đếm = 0).`,
      lines: [...need].map(([material_id, qty]) => ({ material_id, qty })),
    })
    console.log(`  ✓ ${iss.code} cho lệnh ${target.code}`)
  }
  const q7 = (l: (typeof keep)[0]) =>
    Math.min(Number(l.qty_ordered), TO_LSX7[l.product_code ?? ''] ?? 0)
  await issue(lsx6, (l) => Number(l.qty_ordered) - q7(l))
  await issue(lsx7, q7)
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
