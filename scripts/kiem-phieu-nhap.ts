/**
 * SOÁT PHIẾU NHẬP — CHỈ ĐỌC (05/10/2026, bước 5 đợt "phiếu nhập Cung ứng ghi đủ").
 *
 * Đo trước / sau khi NV Cung ứng dùng thật ba thay đổi 04/10:
 *  · đầu phiếu: người giao · số phiếu NCC · ghi chú có được ghi không;
 *  · "Sửa thông tin" từ trang chi tiết: phiếu đổi + vết vào Trao đổi của đơn;
 *  · lịch sử + "Nhập cho" của một phiếu, đúng như trang chi tiết bày.
 *
 * Không ghi gì. Chạy:
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/kiem-phieu-nhap.ts --tu 2026-10-05
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/kiem-phieu-nhap.ts --ma PNK-2026-0093
 */
import { db } from '@/server/db'
import { loadChiTietPhieuNhap } from '@/modules/dept/supply/phieu-nhap-chi-tiet.repo'

const arg = (k: string) => {
  const i = process.argv.indexOf(k)
  return i > 0 ? process.argv[i + 1] : undefined
}
const co = (v: string | null | undefined) => (v?.trim() ? '✓' : '·')

async function tongQuan(tu: string) {
  const { data, error } = await db()
    .from('warehouse_docs')
    .select(
      'code, doc_date, created_at, counterparty, supplier_doc_no, note, reversal_of_doc_id, actor:users!warehouse_docs_created_by_fkey(name)',
    )
    .eq('kind', 'receipt')
    .eq('status', 'posted')
    .gte('created_at', `${tu}T00:00:00+07:00`)
    .order('created_at')
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as {
    code: string
    doc_date: string
    created_at: string
    counterparty: string | null
    supplier_doc_no: string | null
    note: string | null
    actor: { name: string | null } | { name: string | null }[] | null
  }[]
  console.log(`Phiếu nhập ghi sổ từ ${tu}: ${rows.length}`)
  console.log('  mã             ngày CT     người lập                 giao NCC# ghi chú')
  for (const r of rows) {
    const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
    console.log(
      `  ${r.code}  ${r.doc_date.slice(0, 10)}  ${(a?.name ?? '?').padEnd(25)} ${co(r.counterparty)}    ${co(r.supplier_doc_no)}    ${co(r.note)}`,
    )
  }
  const n = rows.length || 1
  const pct = (k: number) => `${k}/${rows.length} (${Math.round((k / n) * 100)}%)`
  console.log(
    `  → có người giao ${pct(rows.filter((r) => r.counterparty?.trim()).length)} · có số phiếu NCC ${pct(rows.filter((r) => r.supplier_doc_no?.trim()).length)} · có ghi chú ${pct(rows.filter((r) => r.note?.trim()).length)}`,
  )

  const { data: notes, error: e2 } = await db()
    .from('doc_notes')
    .select('created_at, body, author:users!doc_notes_author_id_fkey(name)')
    .eq('doc_type', 'po')
    .gte('created_at', `${tu}T00:00:00+07:00`)
    .or(
      'body.like.Sửa thông tin PNK-%,body.like.Điều chỉnh PNK-%,body.like.Ghi kg cân bổ sung%',
    )
    .order('created_at')
  if (e2) throw new Error(e2.message)
  console.log(
    `\nVết sửa phiếu nhập trong Trao đổi của đơn từ ${tu}: ${notes?.length ?? 0}`,
  )
  for (const v of (notes ?? []) as {
    created_at: string
    body: string
    author: { name: string | null } | null
  }[])
    // prettier-ignore
    console.log(`  ${v.created_at.slice(0, 16)}  ${v.author?.name ?? '?'} — ${v.body.slice(0, 140)}`)
}

async function motPhieu(ma: string) {
  const { data } = await db()
    .from('warehouse_docs')
    .select('id')
    .eq('code', ma)
    .maybeSingle()
  if (!data) return console.log(`Không có phiếu ${ma}`)
  const ct = await loadChiTietPhieuNhap((data as { id: string }).id)
  if (ct === null || ct === 'khong-theo-don')
    return console.log(`${ma}: ${ct ?? 'không có'} — không phải phiếu nhập theo đơn mua`)
  const r = ct.row
  console.log(
    `${ma} · ${r.phieu.reversed ? 'ĐÃ ĐẢO' : 'đang hiệu lực'} · đơn ${r.po_code} · ${r.supplier_name}`,
  )
  console.log(`  Nhập cho: ${JSON.stringify(ct.nhap_cho)}`)
  console.log(`  Người giao: ${r.counterparty ?? '—'} · Số phiếu NCC: ${r.supplier_doc_no ?? '—'} · Ghi chú: ${r.ghi_chu ?? '—'}`) // prettier-ignore
  console.log(
    `  Dòng: ${ct.dong.length} (${ct.dong.filter((d) => !d.con_noi_don).length} dòng đơn đã gỡ)`,
  )
  console.log('  Lịch sử:')
  for (const m of ct.lich_su)
    console.log(`    ${m.at.slice(0, 16)}  ${m.label} · ${m.actor ?? 'hệ thống'}${m.detail ? ` — ${m.detail.slice(0, 120)}` : ''}`) // prettier-ignore
}

async function main() {
  const ma = arg('--ma')
  if (ma) return motPhieu(ma)
  await tongQuan(arg('--tu') ?? new Date().toISOString().slice(0, 10))
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
