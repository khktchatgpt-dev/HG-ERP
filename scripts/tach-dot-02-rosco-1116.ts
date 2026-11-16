/**
 * TÁCH ĐỢT XUẤT lệnh 02/26-27 - ROSCO (IBIZA) theo file thống kê "ROSCO IBIZA_THEO
 * DÕI KHUNG SẮT 14.11.26.xlsx" (16/11/2026, chủ dự án chốt "Chốt theo đề xuất").
 *
 * Lệnh có 6 dòng SP, không ngày xuất, không gắn đơn; file có 9 đợt. Đi qua ĐÚNG
 * `lsxLinesService.save` (màn soạn lệnh của Sales dùng): lệnh đã duyệt → bản chỉnh
 * sửa rev+1 kèm lý do, đánh dấu dòng đổi, báo Cung ứng. Đợt đầu giữ id dòng cũ.
 * Phần lệch giữa SL lệnh và tổng file (đều theo bộ: 334 · 300) để thành MỘT dòng
 * riêng "Chưa rõ đợt" — không cộng vào "Còn lại" để số còn lại khớp file.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/tach-dot-02-rosco-1116.ts [--apply]
 */
import { lsxLinesService } from '@/modules/dept/production/lsx-lines.service'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const LSX_ID = 'ade0b4a0-ad23-4302-b7f5-b95bcba2ee0c'
const ACTOR = '2d47facc-c8ce-43ec-b5bc-6c9435825bc8' // Quản trị viên

/** Đợt theo file: [ngày | null, nhãn]. Thứ tự = thứ tự dòng trên lệnh. */
const DOT: [string | null, string][] = [
  ['2026-11-11', 'Xuất 11.11'],
  ['2026-11-12', 'Xuất 12.11'],
  ['2026-11-15', 'Xuất 15.11'],
  ['2026-11-20', 'Xuất 20.11'],
  ['2026-11-22', 'Xuất 22.11'],
  ['2026-11-23', 'Xuất 23.11'],
  ['2026-11-24', 'Xuất 24.11'],
  ['2026-11-25', 'Tăng cường T11 25.11'],
  [null, 'Còn lại (file chưa có ngày)'],
]
/** SL SP theo đợt (cùng thứ tự DOT) — đọc từ file, SL cụm ÷ SL cụm/SP. */
const SL: Record<string, number[]> = {
  '2723874': [126, 42, 42, 84, 42, 42, 42, 0, 1286], // Bàn vuông
  '2723876-B': [126, 42, 42, 84, 42, 42, 42, 0, 1110], // Bàn tròn
  'BN0229HG-IR': [252, 84, 84, 168, 84, 84, 84, 0, 3948], // Băng 1 (Ghế bank 1)
  '2723876-A': [126, 42, 42, 84, 42, 42, 42, 0, 1110], // Sofa
  '2722239': [56, 168, 0, 0, 0, 56, 0, 280, 1344], // Bàn chữ nhật
  '2722875': [224, 672, 0, 0, 0, 224, 0, 1120, 5376], // Ghế xoay
}
const NHAN_LECH = 'Chưa rõ đợt — lệch file theo dõi 14/11'

async function main() {
  const user = await usersRepo.findById(ACTOR)
  if (!user) throw new Error('không thấy tài khoản thực hiện')
  const sheet = await lsxLinesService.sheet(user, LSX_ID)
  type Line = (typeof sheet.groups)[number]['lines'][number]
  if (sheet.groups.length !== 1)
    throw new Error(`lệnh có ${sheet.groups.length} nhóm, chờ 1`)
  const g = sheet.groups[0]
  const daTach = g.lines.some((l: Line) => l.ship_date || l.ship_label)
  if (daTach) throw new Error('lệnh đã có dòng mang ngày/nhãn xuất — không tách lại')

  const out: Record<string, unknown>[] = []
  let sort = 0
  for (const l of g.lines as Line[]) {
    const sl = SL[l.product_code]
    if (!sl) throw new Error(`dòng lạ: ${l.product_code}`)
    const tongFile = sl.reduce((a, b) => a + b, 0)
    const lech = Number(l.qty) - tongFile
    if (lech < 0)
      throw new Error(`${l.product_code}: file (${tongFile}) nhiều hơn lệnh (${l.qty})`)
    const base = {
      product_id: l.product_id,
      sales_order_line_id: l.sales_order_line_id,
      product_code: l.product_code,
      customer_item_code: l.customer_item_code,
      name_foreign: l.name_foreign,
      name_vi: l.name_vi,
      name_customs: l.name_customs,
      barcode: l.barcode,
      unit: l.unit ?? '',
      packing: l.packing,
      cbm: l.cbm,
      specs: l.specs ?? {},
      checks: l.checks ?? {},
      extras: l.extras ?? {},
      note: l.note,
      important_note: l.important_note,
      image_file_id: l.image_file_id,
    }
    let giuId = true
    const dong = DOT.map(([ngay, nhan], i) => ({ ngay, nhan, qty: sl[i] })).filter(
      (d) => d.qty > 0,
    )
    if (lech > 0) dong.push({ ngay: null, nhan: NHAN_LECH, qty: lech })
    for (const d of dong) {
      out.push({
        ...(giuId ? { id: l.id } : {}),
        ...base,
        qty: d.qty,
        ship_date: d.ngay,
        ship_label: d.nhan,
        sort_order: sort++,
      })
      giuId = false
    }
    console.log(
      `${l.product_code.padEnd(12)} ${String(l.qty).padStart(6)} = ` +
        dong
          .map(
            (d) =>
              `${d.nhan.split(' ')[0] === 'Xuất' ? d.nhan.slice(5) : d.nhan.split(' (')[0].split(' —')[0]}:${d.qty}`,
          )
          .join(' · ') +
        ` → tổng ${dong.reduce((a, d) => a + d.qty, 0)}`,
    )
  }
  console.log(`\n${g.lines.length} dòng → ${out.length} dòng`)
  if (!APPLY) return console.log('Dò khô — thêm --apply để lưu (bản chỉnh sửa rev+1).')

  const res = await lsxLinesService.save(user, LSX_ID, {
    groups: [{ ...g, id: g.id, lines: out } as never],
    revision_note:
      'Tách đợt xuất theo file thống kê "ROSCO IBIZA - THEO DÕI KHUNG SẮT 14.11.26": 9 đợt; phần lệch giữa SL lệnh và tổng file để dòng "Chưa rõ đợt".',
  })
  const n = res.groups.reduce((a, x) => a + x.lines.length, 0)
  console.log(`Đã lưu: ${n} dòng.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
