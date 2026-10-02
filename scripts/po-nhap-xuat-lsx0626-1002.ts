/**
 * NHẬP ĐỦ + XUẤT CHO LỆNH 14 ĐƠN MUA CỦA LỆNH 06/26-27 - MX — 02/10/2026.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-nhap-xuat-lsx0626-1002.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-nhap-xuat-lsx0626-1002.ts --apply   # ghi
 *
 * Chủ dự án (02/10): "LSX 06 về hết rồi trừ PO-2026-0043, xử lí giúp cho chị Nga vì
 * các đơn này trước khi phổ biến hệ thống". Chọn: nhập đủ + xuất luôn cho lệnh,
 * ngày phiếu hôm nay, ngày giao thật ghi vào ghi chú.
 *
 * Vì sao XUẤT LUÔN: hàng về từ 04–11/09, trước khi Kho dùng hệ thống, và đã đưa vào
 * sản xuất. Kiểm kê KK-2026-0004 (15/09) đếm tồn các mã này = 0. Chỉ nhập thì tồn
 * tăng ảo đúng bằng số đặt. Mỗi đơn: một PNK đủ SL còn mở (qua
 * `stockService.createReceiptDoc` — giá vốn dòng, BR-08 trạng thái đơn, chốt đợt)
 * rồi PXK cho lệnh đúng các lượng đó (`createIssueDoc`, mã X1 vào giá thành lệnh).
 * Tồn từng mã trước = sau = 0.
 *
 * PHẦN CỦA LỆNH 07: bốn đơn dùng chung hai lệnh (TN2 0044, thùng Kimpack 0045, khớp
 * nối Hoài Thương 0119, TEM PQ 0123). Dòng nào chỉ ra được SP của lệnh 07 (theo mã
 * khách in trên dòng) thì xuất cho lệnh 07: TEM 22080-309 và 26441-205; thùng
 * "2644127" 380 cái = 300 (26441-217, lệnh 06) + 80 (26441-205, lệnh 07). Dòng gộp
 * không tách được (bulon, khớp nối theo kg, lót tấm) xuất cho lệnh 06 — lệnh chính.
 *
 * Người lập: Đặng Thị Thanh Nga (Cung ứng tạm nhận hàng thay Kho từ 01/10). Event bus
 * không đăng ký trong script → không phát thông báo (việc ghi hộ, báo lại là nhiễu).
 * Đơn đã có hàng nhập (dù một phần) thì DỪNG — script chỉ nhận đơn chưa có gì trên sổ.
 */
import { db } from '@/server/db'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import type { User } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const LSX_CODE = '06/26-27 - MX'
const LSX7_CODE = '07/26-27 - MX'
const SKIP = ['PO-2026-0043'] // Tường Nguyên — hàng CHƯA về đủ
const OWNER_EMAIL = 'kehoach1@hoanggia.de' // Đặng Thị Thanh Nga
const DOC_DATE = '2026-10-02'
/** product_code dòng đơn → SL thuộc lệnh 07 (Infinity = cả dòng). */
const TO_LSX7: Record<string, number> = {
  '22080-309': Infinity,
  '26441-205': Infinity,
  '2644127': 80,
}

type Line = {
  id: string
  material_id: string | null
  qty_ordered: number
  qty_received: number
  qty_open: number
  product_code: string | null
}

const vnDates = (body: string) => {
  const part = body.slice(body.indexOf('Cột theo dõi'))
  const ds = [...part.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)].map(
    ([, d, m, y]) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
  )
  return [...new Set(ds)].sort().map((s) => s.split('-').reverse().join('/'))
}

async function main() {
  const sb = db()
  const { data: nga, error: ue } = await sb
    .from('users')
    .select('*')
    .eq('email', OWNER_EMAIL)
    .single()
  if (ue || !nga) throw new Error('không thấy chị Nga')
  const user = nga as User
  const lenh = async (code: string) => {
    const { data } = await sb
      .from('production_orders')
      .select('id, code, status')
      .eq('code', code)
      .single()
    if (!data) throw new Error(`không thấy lệnh ${code}`)
    return data as { id: string; code: string; status: string }
  }
  const [lsx, lsx7] = await Promise.all([lenh(LSX_CODE), lenh(LSX7_CODE)])
  const { data: pos, error: pe } = await sb
    .from('supply_purchase_orders')
    .select('id, code, status, supplier_doc_no, sup:supply_suppliers(name)')
    .eq('production_order_id', lsx.id)
    .in('status', ['ordered', 'confirmed', 'in_transit'])
    .order('code')
  if (pe) throw pe
  const todo = (pos ?? []).filter((p) => !SKIP.includes(p.code))
  console.log(
    `Lệnh ${lsx.code} (${lsx.status}) · lệnh ${lsx7.code} (${lsx7.status}) · ${todo.length} đơn · bỏ ${SKIP.join(', ')}`,
  )

  const plans = []
  for (const p of todo) {
    const [st, pcs, notes] = await Promise.all([
      sb
        .from('supply_po_line_status')
        .select('id, material_id, qty_ordered, qty_received, qty_open')
        .eq('po_id', p.id)
        .order('sort_order'),
      sb.from('supply_purchase_order_lines').select('id, product_code').eq('po_id', p.id),
      sb
        .from('doc_notes')
        .select('body')
        .eq('doc_id', p.id)
        .ilike('body', '%Cột theo dõi%'),
    ])
    if (st.error) throw st.error
    if (pcs.error) throw pcs.error
    const pcOf = new Map((pcs.data ?? []).map((x) => [x.id as string, x.product_code]))
    const ls: Line[] = (st.data ?? []).map((l) => ({
      id: l.id as string,
      material_id: l.material_id as string | null,
      qty_ordered: Number(l.qty_ordered),
      qty_received: Number(l.qty_received),
      qty_open: Number(l.qty_open),
      product_code: (pcOf.get(l.id as string) as string | null) ?? null,
    }))
    if (ls.some((l) => l.qty_received > 0))
      throw new Error(`${p.code} đã có hàng nhập — không nhận hộ bằng script`)
    if (ls.some((l) => !l.material_id)) throw new Error(`${p.code} có dòng chưa gắn mã`)
    const open = ls.filter((l) => l.qty_open > 0)
    // Chia SL xuất từng dòng: phần lệnh 07 / phần lệnh 06.
    const split = open.map((l) => {
      const q7 = Math.min(l.qty_open, TO_LSX7[l.product_code ?? ''] ?? 0)
      return { l, q6: l.qty_open - q7, q7 }
    })
    const dates = notes.data?.[0] ? vnDates(notes.data[0].body as string) : []
    const supName = (p.sup as unknown as { name: string } | null)?.name ?? ''
    plans.push({ p, supName, open, split, dates })
    console.log(
      `  ${p.code} ${p.status.padEnd(9)} ${supName.slice(0, 44).padEnd(44)} ${String(open.length).padStart(2)}/${ls.length} dòng · giao thật ${dates.length ? dates.join(', ') : '(file không ghi)'}`,
    )
    for (const x of split.filter((x) => x.q7 > 0))
      console.log(`      → lệnh 07: ${x.l.product_code} ${x.q7} (lệnh 06 còn ${x.q6})`)
  }
  if (!APPLY) {
    console.log('\n(dò khô — thêm --apply để ghi)')
    return
  }

  for (const { p, supName, open, split, dates } of plans) {
    const when = dates.length
      ? `ngày giao thật theo cột theo dõi trên file: ${dates.join(', ')}`
      : 'file không ghi ngày giao'
    const rec = await stockService.createReceiptDoc(user, {
      po_id: p.id,
      counterparty: supName,
      supplier_doc_no: p.supplier_doc_no ?? null,
      doc_date: DOC_DATE,
      note: `Ghi hộ 02/10/2026 theo chỉ đạo: hàng đã về đủ trước khi dùng hệ thống (${when}). Đã đưa vào sản xuất — xuất cho lệnh cùng ngày.`,
      lines: open.map((l) => ({
        material_id: l.material_id!,
        qty: l.qty_open,
        po_line_id: l.id,
      })),
    })
    const issueFor = async (target: { id: string; code: string }, pick: 'q6' | 'q7') => {
      const need = new Map<string, number>()
      for (const x of split)
        if (x[pick] > 0)
          need.set(x.l.material_id!, (need.get(x.l.material_id!) ?? 0) + x[pick])
      if (need.size === 0) return null
      const iss = await stockService.createIssueDoc(user, {
        kind: 'lsx',
        production_order_id: target.id,
        doc_date: DOC_DATE,
        note: `Ghi hộ 02/10/2026: vật tư của ${p.code} (${rec.code}) đã đưa vào sản xuất lệnh ${target.code} trước khi dùng hệ thống — xuất cùng ngày nhập để tồn đúng thực tế (KK-2026-0004 đếm = 0).`,
        lines: [...need].map(([material_id, qty]) => ({ material_id, qty })),
      })
      return iss.code
    }
    const x6 = await issueFor(lsx, 'q6')
    const x7 = await issueFor(lsx7, 'q7')
    console.log(
      `  ✓ ${p.code} → ${rec.po_status} · ${rec.code} + ${[x6, x7 && `${x7} (lệnh 07)`].filter(Boolean).join(' + ')}`,
    )
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
