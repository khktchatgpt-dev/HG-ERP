import type { PoTemplate } from '@/lib/po-template'

/**
 * KẾ HOẠCH MUA · BƯỚC 3 "LÊN ĐƠN" — phần thuần (22/10/2026).
 *
 * Mỗi NCC một đơn NHÁP gắn lệnh (Q5 bản vẽ WE12EjR5…). Hai việc phải đúng tuyệt
 * đối vì đi thẳng vào tiền:
 *  · MẪU ĐƠN gợi ý — mẫu quyết định cột và công thức tiền.
 *  · ĐỔI GIÁ về đúng cơ sở dòng đơn sẽ dùng: mẫu nhôm/thép có kg/m (kg/cây) thì
 *    `deriveLine` tính tiền theo KG (đơn giá = đ/kg), thiếu thì theo CÂY. Giá chọn
 *    ở bước 2 có thể là đ/kg hay đ/cây — mang nguyên sang là sai cả chục lần.
 */

export type CoSoGia = 'unit' | 'kg'

/**
 * Giá đổi sang cơ sở ĐÍCH của dòng đơn: 'unit2' = đ/kg, 'unit' = đ/ĐVT mua.
 * Không đổi được (thiếu kg/cây) → null: để trống cho người mua điền, không đoán.
 */
export function giaTheoCoSo(
  price: number | null,
  coSo: CoSoGia,
  dich: 'unit' | 'unit2',
  kgMoiDv: number | null,
): number | null {
  if (price == null) return null
  const tron = (v: number) => Math.round(v * 100) / 100
  if (dich === 'unit2') {
    if (coSo === 'kg') return price
    return kgMoiDv && kgMoiDv > 0 ? tron(price / kgMoiDv) : null
  }
  if (coSo === 'unit') return price
  return kgMoiDv && kgMoiDv > 0 ? tron(price * kgMoiDv) : null
}

/** Nhóm hàng (danh mục) → mẫu đơn khi NCC chưa có thói quen. */
function mauTheoNhom(group: string | null, sub: string | null): PoTemplate {
  const g = `${group ?? ''} ${sub ?? ''}`.toLowerCase()
  if (/nhôm/.test(g)) return 'aluminium'
  if (/sắt|thép|tôn|inox/.test(g)) return 'metal_kg'
  if (/mút|xốp|nệm|gòn/.test(g)) return 'foam'
  if (/tem|nhãn|decal/.test(g)) return 'label'
  if (/carton/.test(g)) return 'carton'
  if (/kính|mica/.test(g)) return 'glass'
  if (/gỗ|ván/.test(g)) return 'wood'
  if (/mây|đan/.test(g)) return 'rattan'
  if (/sơn/.test(g)) return 'paint'
  return 'accessory'
}

/**
 * Mẫu đơn gợi ý cho một NCC:
 *  1. Có dòng tính theo KG → mẫu kim loại (nhôm hay thép theo nhóm) — mẫu khác
 *     không có cột kg, tiền ra sai.
 *  2. NCC đã có đơn → mẫu đơn gần nhất của NCC (thói quen của phòng với NCC đó).
 *  3. Không thì theo nhóm hàng chiếm nhiều dòng nhất.
 */
export function goiYMauDon(
  lines: { group_name: string | null; sub_group: string | null; co_so: CoSoGia }[],
  mauGanNhat?: PoTemplate | null,
): PoTemplate {
  const kg = lines.filter((l) => l.co_so === 'kg')
  if (kg.length > 0)
    return kg.some((l) => /nhôm/i.test(`${l.group_name} ${l.sub_group}`))
      ? 'aluminium'
      : 'metal_kg'
  if (mauGanNhat) return mauGanNhat
  const dem = new Map<PoTemplate, number>()
  for (const l of lines) {
    const m = mauTheoNhom(l.group_name, l.sub_group)
    dem.set(m, (dem.get(m) ?? 0) + 1)
  }
  return [...dem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'accessory'
}
