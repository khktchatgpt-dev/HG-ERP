import { laDvtKg } from './dvt-kg'
import { foamM3PerSheet, type PoTemplate } from './po-template'

/**
 * HAI CỘT GIÁ — "Đơn giá" theo ĐVT đặt và "Đơn giá /kg · /m³ · /m²" (09/10/2026
 * xốp; 10/10/2026 nhôm, sắt/inox, gỗ, kính — sếp: "ngoài giá theo ĐVT cần có giá
 * theo kg hoặc m³", và Giám đốc cũng phải thấy). Dòng chỉ lưu MỘT đơn giá theo
 * cơ sở tiền của nó; giá kia là số QUY ĐỔI qua lượng của MỘT ĐVT.
 *
 * Bao bì KHÔNG có: đã có cột "Đơn giá/m²" riêng, và giá thùng = m² × giá/m² + bản
 * in — không phải phép quy đổi thuần, bày thêm cột m² là hai số cãi nhau.
 *
 * Một nguồn cho lưới soạn đơn (`don/_lib/po-line.ts`) lẫn màn ký của Giám đốc.
 */
export const HAI_GIA: Partial<Record<PoTemplate, { dv: string; thieu: string }>> = {
  aluminium: { dv: 'kg', thieu: 'cần kg/m + dài cây' },
  metal_kg: { dv: 'kg', thieu: 'cần kg / đơn vị' },
  wood: { dv: 'm³', thieu: 'cần m³ / SP' },
  glass: { dv: 'm²', thieu: 'cần m² / tấm' },
  foam: { dv: 'm³', thieu: 'cần D×R×Dày' },
}

/** Dòng ĐÃ LƯU (số thật hoặc null) — đủ để quy đổi giá ở màn ký. */
export type HaiGiaLine = {
  qty_ordered: number | null
  unit_price: number | null
  price_basis: 'unit' | 'unit2' | null
  qty2: number | null
  /** ĐVT đặt — dòng ĐVT Kg (mẫu nhôm / sắt) thì giá /kg = đơn giá. */
  material_unit?: string | null
  weight_per_m?: number | null
  bar_length_m?: number | null
  weight_per_unit?: number | null
  m3_per_unit?: number | null
  area_m2?: number | null
  inner_l_mm?: number | null
  inner_w_mm?: number | null
  inner_h_mm?: number | null
}

/**
 * Lượng quy đổi của MỘT ĐVT theo công thức của mẫu (kg/cây, kg/đơn vị, m³/SP,
 * m²/tấm, m³/tấm) — chưa tính tổng chốt/gõ đè. Thiếu số → null.
 */
export function dv2TheoCongThuc(
  t: PoTemplate,
  l: Omit<HaiGiaLine, 'qty_ordered' | 'unit_price' | 'price_basis' | 'qty2'>,
): number | null {
  // prettier-ignore
  const per =
    t === 'aluminium'
      ? (Number(l.weight_per_m) || 0) * (Number(l.bar_length_m) || 0)
      : t === 'metal_kg'
        ? Number(l.weight_per_unit) || 0
        : t === 'wood'
          ? Number(l.m3_per_unit) || 0
          : t === 'glass'
            ? Number(l.area_m2) || 0
            : t === 'foam'
              ? (foamM3PerSheet(l.inner_l_mm, l.inner_w_mm, l.inner_h_mm) ?? 0)
              : 0
  return per > 0 ? per : null
}

/**
 * Hai giá của một dòng ĐÃ LƯU. Tổng đã chốt (`qty2` — có thể là số làm tròn theo
 * tờ NCC) thắng công thức, chia cho SL. Mẫu không có hai giá → null.
 */
export function poHaiGia(
  t: PoTemplate,
  l: HaiGiaLine,
): {
  dv: string
  theo: 'dvt' | 'dv2'
  donGia: number | null
  gia2: number | null
} | null {
  const cfg = HAI_GIA[t]
  if (!cfg) return null
  const theo = l.price_basis === 'unit2' && l.qty2 != null ? 'dv2' : 'dvt'
  const q = Number(l.qty_ordered) || 0
  const tong = Number(l.qty2) || 0
  const per =
    cfg.dv === 'kg' && laDvtKg(l.material_unit)
      ? 1
      : q > 0 && tong > 0
        ? tong / q
        : dv2TheoCongThuc(t, l)
  const p = l.unit_price
  if (p == null) return { dv: cfg.dv, theo, donGia: null, gia2: null }
  if (theo === 'dv2') return { dv: cfg.dv, theo, gia2: p, donGia: per == null ? null : p * per } // prettier-ignore
  return { dv: cfg.dv, theo, donGia: p, gia2: per == null ? null : p / per }
}
