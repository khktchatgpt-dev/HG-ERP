/**
 * ĐƠN BAO BÌ GHẾ BANK 2 JAWOOL — NCC CÔNG TY CP BAO BÌ 3/2, LSX 01/26-27 - JAWOLL (12/10/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-bao-bi-32-jawoll-1012.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-bao-bi-32-jawoll-1012.ts --apply   # ghi
 *
 * Tờ (ảnh): 3 dòng · VAT 8% → 34.132.514. Tờ in "Kính gửi: Hiệp Hưng · Số ĐH 4-2026 HG/HH" nhưng
 * chủ dự án chốt NCC = CÔNG TY CỔ PHẦN BAO BÌ 3/2 (mã 3/2) — số ĐH của Hiệp Hưng KHÔNG ghi vào
 * supplier_doc_no (lại trùng PO-2026-0125 "04-2026 HG/HH").
 * Chủ dự án chốt (12/10): lên NHÁP cho chị Nga · dự kiến giao 20/10/2026 · đủ 10 mục điều khoản.
 *  · Dòng 3 "Công dán + keo bồi" là DÒNG PHÍ / DỊCH VỤ (0234) — không khai vật tư.
 *  · BB-0076 / BB-0077 chị Nga tạo 12/10 cho chính tờ này.
 *  · Bỏ đơn THỬ PO-2026-0175 (Quản trị viên tạo lúc thử dòng phí, NCC Hiệp Hưng) — sao lưu JSON trước.
 * Điều khoản: 10 mục của tờ gom vào 5 ô in sẵn + ghi chú đơn (in lên phiếu NCC).
 */
import { writeFileSync } from 'node:fs'
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'
import { usersRepo } from '@/modules/core/users/users.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'

const APPLY = process.argv.includes('--apply')
const NCC = '9c310221-8627-49a0-a12f-f3147c704304' // CÔNG TY CỔ PHẦN BAO BÌ 3/2 (mã 3/2, MST 4200528940)
const LSX = '01/26-27 - JAWOLL'
const DON_THU = 'PO-2026-0175'
const BACKUP = process.env.BACKUP_DIR ?? '.'

async function one<T>(q: PromiseLike<{ data: T[] | null }>): Promise<T | null> {
  const { data } = await q
  return data?.[0] ?? null
}

const TERMS = {
  terms_quality:
    'Quy cách: đúng định lượng, đúng quy cách và kích thước theo bảng chi tiết trên; thùng vuông góc, in rõ, đúng nội dung. ' +
    'Chất lượng: hàng sản xuất đại trà phải đúng 100% theo mẫu đã được Bên đặt hàng ký xác nhận; không rách, móp, ẩm mốc, lệch màu.',
  terms_delivery_place:
    'CÔNG TY TNHH SX & TM HOÀNG GIA - Lô C3, Cụm công nghiệp Cát Nhơn, Xã Xuân An, Gia Lai. Chi phí vận chuyển và bốc xếp do Bên cung cấp chịu.',
  terms_payment:
    'Công nợ cuối tháng - thanh toán bằng chuyển khoản sau khi nhận đủ hóa đơn GTGT và chứng từ giao hàng hợp lệ. ' +
    'Khối lượng thanh toán tính theo số lượng thực nhận đạt chất lượng ghi trên phiếu giao hàng có xác nhận của hai bên.',
  terms_invoice: 'Hóa đơn GTGT, phiếu xuất kho/phiếu giao hàng có xác nhận của hai bên.',
  terms_lead_time: 'Giao hàng theo kế hoạch, từ 5 đến 7 ngày kể từ ngày nhận đơn hàng.',
  note:
    'Đóng gói/Bảo quản: đóng bó/kiện riêng theo từng loại, ngoài bó ghi rõ tên hàng và số lượng; có lót chống ẩm, không gãy góc, không trầy mặt in.\n' +
    'Kiểm tra & giao nhận: kiểm tra xác suất khi nhận hàng, đối chiếu với mẫu đã ký xác nhận. Hàng không đạt Bên cung cấp thu hồi và sản xuất bù trong vòng 03 ngày, không tính vào khối lượng thanh toán.\n' +
    'Bảo hành - đổi trả: đổi/bù 100% số lượng lỗi do in ấn, chất liệu hoặc gia công trong vòng 30 ngày kể từ ngày giao hàng; toàn bộ chi phí do Bên cung cấp chịu.',
}

async function main() {
  // 1) Tiền khớp TỜ tới từng đồng.
  const d = [557 * 43_960, 557 * 9_780, 557 * 3_000]
  const hang = d.reduce((s, x) => s + x, 0)
  const vat = Math.round(hang * 0.08)
  if (
    d.join() !== '24485720,5447460,1671000' ||
    hang !== 31_604_180 ||
    vat !== 2_528_334 ||
    hang + vat !== 34_132_514
  )
    // prettier-ignore
    throw new Error(`lệch tờ: ${d} / ${hang} / ${vat}`)
  console.log(`Tiền hàng ${hang.toLocaleString('vi-VN')} + VAT 8% ${vat.toLocaleString('vi-VN')} = ${(hang + vat).toLocaleString('vi-VN')} — khớp tờ`) // prettier-ignore

  // 2) Chống nạp đôi: đơn JAWOLL của 3/2 đã có dòng BB-0076 thì dừng.
  const lsx = await one(db().from('production_orders').select('id').eq('code', LSX))
  if (!lsx) throw new Error(`không thấy lệnh ${LSX}`)
  const lsxId = (lsx as { id: string }).id
  const vt = new Map<string, string>()
  for (const c of ['BB-0076', 'BB-0077']) {
    const r = await one(db().from('warehouse_materials').select('id').eq('code', c))
    if (!r) throw new Error(`không thấy ${c}`)
    vt.set(c, (r as { id: string }).id)
  }
  const { data: da } = await db()
    .from('supply_purchase_orders')
    .select('code, supply_purchase_order_lines!inner(material_id)')
    .eq('supplier_id', NCC)
    .eq('production_order_id', lsxId)
    .neq('status', 'cancelled')
    .eq('supply_purchase_order_lines.material_id', vt.get('BB-0076')!)
  if (da && da.length > 0)
    return console.log(`ĐÃ NẠP: ${(da[0] as { code: string }).code} — dừng.`)

  const users = await usersRepo.list()
  const nga = users.find((u) => u.email === 'kehoach1@hoanggia.de')
  if (!nga) throw new Error('thiếu chị Nga')
  if (!(await canAction(nga, 'supply.po.manage')))
    throw new Error('chị Nga thiếu quyền supply.po.manage')

  // 3) Đơn thử PO-2026-0175 — chỉ xoá nếu vẫn là nháp và vẫn là đơn thử (NCC Hiệp Hưng, 3 dòng).
  const thu = await one(
    db().from('supply_purchase_orders').select('*').eq('code', DON_THU),
  )
  const thuOk = thu && (thu as { status: string }).status === 'draft'
  console.log(`Đơn thử ${DON_THU}: ${thu ? (thuOk ? 'nháp → SẼ XOÁ (sao lưu JSON)' : `KHÔNG xoá — trạng thái ${(thu as { status: string }).status}`) : 'không còn'}`) // prettier-ignore
  console.log(`Đơn mới: NCC Bao bì 3/2 · ${LSX} · carton · VAT 8% chưa gồm · giao 20/10/2026 · người lập ${nga.name}`) // prettier-ignore
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  if (thu && thuOk) {
    const t = thu as { id: string; created_by: string }
    const { data: lines } = await db().from('supply_purchase_order_lines').select('*').eq('po_id', t.id) // prettier-ignore
    const file = `${BACKUP}/po-xoa-${DON_THU}-1012.json`
    writeFileSync(file, JSON.stringify({ po: thu, lines }, null, 2))
    const nguoiTao = users.find((u) => u.id === t.created_by)
    if (!nguoiTao) throw new Error('không thấy người tạo đơn thử')
    await posService.remove(nguoiTao, t.id)
    console.log(`✓ đã xoá ${DON_THU} (sao lưu ${file})`)
  }

  const input = poCreateSchema.parse({
    production_order_id: lsxId,
    supplier_id: NCC,
    template: 'carton',
    currency: 'VND',
    vat_rate: 8,
    price_includes_vat: false,
    expected_at: '2026-10-20',
    ...TERMS,
    lines: [
      {
        material_id: vt.get('BB-0076'),
        qty_ordered: 557,
        unit_price: 43_960,
        open_style: 'AD',
        pcs_per_ctn: 1,
        qty_demand: 557,
        inner_l_mm: 1180,
        inner_w_mm: 610,
        inner_h_mm: 170,
        area_m2: 2.97,
        price_per_m2: 14_800,
        carton_basis: 'ctn',
        note: 'Yêu cầu kỹ thuật: 175LBS · KT load cont 118x61x17 cm',
      },
      {
        material_id: vt.get('BB-0077'),
        qty_ordered: 557,
        unit_price: 9_780,
        pcs_per_ctn: 1,
        qty_demand: 557,
        area_m2: 0.13,
        carton_basis: 'ctn',
        note: 'File gởi · 30x42 · Duplex 250',
      },
      {
        material_id: null,
        line_kind: 'phi',
        line_name: 'Công dán + keo bồi',
        line_unit: 'Thùng',
        qty_ordered: 557,
        unit_price: 3_000,
        qty_demand: 557,
      },
    ],
  })
  const po = await posService.create(nga, input)
  console.log(`✓ ${po.code} (nháp) — người lập ${nga.name}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
