/**
 * PXK-2026-0029 (đảo PNK-2026-0066, PO-2026-0045 Kimpack): CHÉP GIÁ VỐN — 02/10/2026.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/pxk-0029-chep-gia-1002.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/pxk-0029-chep-gia-1002.ts --apply   # ghi
 *
 * `stockService.reverseDoc` từng KHÔNG chép `unit_cost` sang dòng đảo (vá cùng đợt C,
 * 02/10/2026). PXK-0029 do vậy 0/15 dòng có giá → sổ công nợ (chỉ cộng dòng CÓ giá)
 * vẫn tính PNK-0066 lẫn PNK-0077: PO-0045 ra 80.152.004đ thay vì 40.076.002đ.
 *
 * Chỉ ghi cột `unit_cost` của 15 dòng PXK-0029 — giá lấy đúng dòng gốc cùng vật tư +
 * dòng đơn + số lượng. Không đổi số lượng, không đổi tồn. Sao lưu trước khi ghi:
 * backups/pxk-0029-chep-gia-1002.json. Đã chủ dự án đồng ý 02/10/2026.
 */
import { writeFileSync } from 'node:fs'
import { db } from '@/server/db'

const APPLY = process.argv.includes('--apply')

type Mv = {
  id: string
  material_id: string
  po_line_id: string | null
  direction: string
  qty: unknown
  unit_cost: unknown
}

async function docId(code: string): Promise<string> {
  const { data, error } = await db()
    .from('warehouse_docs')
    .select('id')
    .eq('code', code)
    .single()
  if (error || !data) throw new Error(`Không thấy ${code}: ${error?.message}`)
  return data.id
}

async function lines(id: string): Promise<Mv[]> {
  const { data, error } = await db()
    .from('warehouse_movements')
    .select('id, material_id, po_line_id, direction, qty, unit_cost')
    .eq('doc_id', id)
  if (error) throw new Error(error.message)
  return (data ?? []) as Mv[]
}

/** Công nợ theo phiếu nhập của một đơn — cùng luật `payablesRepo.receiptValues`. */
async function congNo(poCode: string): Promise<number> {
  const { data: po } = await db()
    .from('supply_purchase_orders')
    .select('id')
    .eq('code', poCode)
    .single()
  const { data: pl } = await db()
    .from('supply_purchase_order_lines')
    .select('id')
    .eq('po_id', po!.id)
  const { data: mv } = await db()
    .from('warehouse_movements')
    .select('direction, qty, unit_cost')
    .in(
      'po_line_id',
      (pl ?? []).map((l) => l.id),
    )
    .not('unit_cost', 'is', null)
  return Math.round(
    ((mv ?? []) as Mv[]).reduce((s, m) => s + (m.direction === 'out' ? -1 : 1) * Number(m.qty) * Number(m.unit_cost), 0), // prettier-ignore
  )
}

async function main() {
  const [gocId, daoId] = await Promise.all([
    docId('PNK-2026-0066'),
    docId('PXK-2026-0029'),
  ])
  const { data: dao } = await db().from('warehouse_docs').select('reversal_of_doc_id').eq('id', daoId).single() // prettier-ignore
  if (dao?.reversal_of_doc_id !== gocId)
    throw new Error('PXK-0029 không phải phiếu đảo của PNK-0066')
  const [goc, dong] = await Promise.all([lines(gocId), lines(daoId)])

  const dung = new Set<string>()
  const ke: { id: string; unit_cost: number | null }[] = []
  for (const d of dong) {
    if (d.direction !== 'out')
      throw new Error(`Dòng ${d.id} của phiếu đảo không phải chiều xuất`)
    const g = goc.find(
      (x) =>
        !dung.has(x.id) &&
        x.direction === 'in' &&
        x.material_id === d.material_id &&
        x.po_line_id === d.po_line_id &&
        Number(x.qty) === Number(d.qty),
    )
    if (!g) throw new Error(`Không khớp được dòng gốc cho dòng đảo ${d.id}`)
    dung.add(g.id)
    if (d.unit_cost != null)
      throw new Error(`Dòng đảo ${d.id} đã có giá — dừng, không ghi đè`)
    ke.push({ id: d.id, unit_cost: g.unit_cost == null ? null : Number(g.unit_cost) })
  }
  const coGia = ke.filter((k) => k.unit_cost != null)
  const truoc = await congNo('PO-2026-0045')
  console.log(`Khớp ${ke.length}/${dong.length} dòng · sẽ ghi giá ${coGia.length} dòng (dòng gốc không giá thì giữ trống)`) // prettier-ignore
  console.log(
    `Công nợ theo phiếu nhập PO-2026-0045 hiện: ${truoc.toLocaleString('vi-VN')}đ`,
  )
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  writeFileSync(
    'backups/pxk-0029-chep-gia-1002.json',
    JSON.stringify(
      { at: new Date().toISOString(), pnk_0066: goc, pxk_0029_truoc: dong, se_ghi: ke },
      null,
      1,
    ),
  )
  for (const k of coGia) {
    const { error } = await db().from('warehouse_movements').update({ unit_cost: k.unit_cost }).eq('id', k.id).is('unit_cost', null) // prettier-ignore
    if (error) throw new Error(error.message)
  }
  const sau = await congNo('PO-2026-0045')
  console.log(`Đã ghi ${coGia.length} dòng. Công nợ PO-2026-0045: ${truoc.toLocaleString('vi-VN')}đ → ${sau.toLocaleString('vi-VN')}đ`) // prettier-ignore
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
