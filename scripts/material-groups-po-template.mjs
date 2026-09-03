// MẪU ĐƠN MUA MẶC ĐỊNH THEO NHÓM VẬT TƯ (0183) — gieo lần đầu, 03/09/2026.
//
//   node scripts/material-groups-po-template.mjs            # dò khô
//   node scripts/material-groups-po-template.mjs --apply    # ghi catalog_items.meta
//
// Bảng 21 nhóm của kế hoạch phân nhóm gắn mỗi nhóm một mẫu đơn (cột "Mẫu đơn"
// mục 3). Script này ghi đúng bảng đó vào `catalog_items.meta.po_template`, để
// vật tư MỚI khai vào nhóm tự nhận mẫu — người khai không phải nhớ.
//
// Không đụng vật tư đang có: mẫu là của vật tư/đơn (xem sổ nhớ
// `po-template-not-on-material`), đây chỉ là giá trị khởi đầu. Nhóm nào chưa
// chắc mẫu thì để trống, Cung ứng đặt sau ngay trên màn Quản lý nhóm.

import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')

/** nhãn nhóm → mẫu đơn (cột "Mẫu đơn" của bảng 21 nhóm). */
const MAP = {
  'Nhôm định hình - tấm': 'aluminium',
  Inox: 'metal_kg',
  'Sắt thép - tôn - tấm': 'metal_kg',
  'Bu lông - vít - đinh - liên kết': 'accessory',
  'Phụ kiện nội thất': 'accessory',
  'Cơ khí - vòng bi - khuôn': 'mro',
  'Ống - van - khí nén - thủy lực': 'mro',
  'Điện - chiếu sáng - điều khiển': 'mro',
  'Máy móc - thiết bị': 'mro',
  'Dụng cụ cầm tay - lưỡi mũi - nhám': 'mro',
  'Vật tư hàn - cắt': 'mro',
  'Bao bì - đóng gói - tem nhãn': 'carton',
  'Mút - xốp - nệm - gòn': 'foam',
  'Vải - da - chỉ - phụ liệu may': 'accessory',
  'Dây mây - vật liệu đan': 'rattan',
  'Sơn - keo - hoá chất': 'paint',
  'Dầu - nhớt - mỡ bôi trơn': 'chemical',
  'Gỗ - ván - chi tiết gỗ mua ngoài': 'wood',
  'Kính - mica - nhựa tấm': 'glass',
  'Văn phòng - nội bộ - bảo hộ': 'simple',
  'Dịch vụ - gia công - vận chuyển': 'simple',
}

const sb = await client(import.meta.url)
const { data, error } = await sb
  .from('catalog_items')
  .select('id, label, meta')
  .eq('type', 'material_group')
  .eq('is_active', true)
if (error) throw new Error(error.message)

const todo = []
for (const it of data) {
  const want = MAP[it.label]
  if (!want) {
    console.log(`  (bỏ qua, không có trong bảng) ${it.label}`)
    continue
  }
  const cur = it.meta?.po_template ?? null
  if (cur === want) continue
  todo.push({ ...it, want, cur })
}
for (const t of todo) console.log(`  ${t.label}: ${t.cur ?? '(chưa đặt)'} → ${t.want}`)
console.log(`\n${todo.length}/${data.length} nhóm cần đặt mẫu`)

if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
} else {
  for (const t of todo) {
    const { error: e } = await sb
      .from('catalog_items')
      .update({ meta: { ...(t.meta ?? {}), po_template: t.want } })
      .eq('id', t.id)
    if (e) throw new Error(`${t.label}: ${e.message}`)
  }
  console.log('\nXong. Bộ nhớ đệm taxonomy sống 5 phút — chờ hoặc restart dev.')
}
