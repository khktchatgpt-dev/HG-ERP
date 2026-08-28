'use client'

import { useMemo } from 'react'
import { AlertTriangle, Scale, ShoppingCart, Sigma } from 'lucide-react'
import { Card } from '@/components/shadcn/card'
import { Separator } from '@/components/shadcn/separator'
import { SectionIcon } from '@/components/technical/ProductSpecCards'
import { MATERIAL_DENSITY } from '@/lib/bom-calc'
import { layoutOf, nameOf, splitNote } from './part-layouts'
import type { PartView } from './ProductProfileCards'

/**
 * Khối cuối của biểu mẫu BOM (`Nhôm+ Sơn + gỗ + dây`) — BẢN BAO QUÁT (21/08/2026).
 *
 * Bản trước chỉ gộp thứ SUY được từ quy cách (kg khung, m³ gỗ…) rồi ghi chú
 * "vật tư mua rời nằm ở khối phía trên" — tức người mua vẫn phải cuộn ngược lên
 * nhặt từng khối. User chê "không đủ bao quát", và đúng: tổng hợp mà không đủ
 * để đi đặt hàng thì không phải tổng hợp. Nay thẻ trả lời trọn câu hỏi của
 * Cung ứng bằng ba phần:
 *
 *  A. VẬT LIỆU TÍNH TỪ QUY CÁCH — như cũ (kg theo hệ, sơn, m³/m² theo họ).
 *  B. VẬT TƯ MUA RỜI — MỌI dòng ngũ kim / bao bì / tem / dây đan / sơn nhập
 *     tay, mỗi dòng một mặt hàng kèm ĐVT + SL. Đây là phần bị thiếu.
 *  C. CẢNH BÁO THIẾU SỐ — dòng chưa có SL, dòng khung chưa ra KL, dòng gỗ chưa
 *     ra m³. 204/212 hồ sơ từng hiện thẻ RỖNG mà không nói lý do — thẻ trống
 *     lặng thinh đọc như "SP này không cần vật tư", trong khi sự thật là "chưa
 *     ai điền đủ số để tính".
 *
 * Mọi số vẫn TÍNH từ định mức chi tiết, không ô nào sửa được ở đây.
 */

const MATERIAL_LABEL: Record<string, string> = {
  AL: 'Nhôm',
  IR: 'Sắt / thép',
  IN: 'Inox',
}

/** Nhãn nhóm dự phòng khi danh mục không có mã đó — theo họ khối. */
const FALLBACK_GROUP: Record<string, string> = {
  supply: 'Ngũ kim / bao bì',
  rope: 'Dây đan',
  paint: 'Sơn & hoá chất',
}

const fmt = (v: number, d: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

/** SL viết như người gõ: nguyên thì nguyên, lẻ giữ tối đa 4 số. */
const fmtQty = (v: number) =>
  v.toLocaleString('en-US', { maximumFractionDigits: Number.isInteger(v) ? 0 : 4 })

type Line = { name: string; unit: string; qty: number; digits: number; from: string }
type BuyLine = {
  id: string
  name: string
  unit: string
  qty: number | null
  groupLabel: string
  detail: string | null
}

export function PartsRollupCard({
  parts,
  paintCoverage,
  actualWeightKg,
  groups = [],
}: {
  parts: PartView[]
  paintCoverage: number | null
  /** KL thực tế / bảng kê của SP — để đối chiếu với Σ KL tính được. */
  actualWeightKg?: number | null
  /** Danh mục nhóm — cột "Nhóm" của phần mua rời gọi đúng tên (Ngũ kim ≠ Bao bì). */
  groups?: { code: string; label: string }[]
}) {
  const coverage = paintCoverage && paintCoverage > 0 ? paintCoverage : 5

  const derived = useMemo<Line[]>(() => {
    const out: Line[] = []

    // Kim loại gộp theo hệ vật liệu, KHÔNG gộp chung một dòng "kim loại": một SP
    // có thể vừa khung Sắt vừa đế Nhôm, cộng chung thì Cung ứng mua sai thứ.
    const kgByMaterial = new Map<string, number>()
    for (const p of parts) {
      if (p.weight_kg == null || !p.material_kind) continue
      if (!(p.material_kind in MATERIAL_DENSITY)) continue
      kgByMaterial.set(
        p.material_kind,
        (kgByMaterial.get(p.material_kind) ?? 0) + p.weight_kg,
      )
    }
    for (const [kind, kg] of kgByMaterial) {
      if (kg <= 0) continue
      out.push({
        name: MATERIAL_LABEL[kind] ?? kind,
        unit: 'kg',
        qty: kg,
        digits: 3,
        from: 'Σ khối lượng các dòng khung',
      })
    }

    // CHỈ cộng diện tích của khối KHUNG. Cột `paint_area_m2` gánh hai nghĩa
    // khác hẳn nhau theo biểu mẫu: khối khung là "Diện tích sơn (M²)", còn khối
    // gỗ/nệm là "Diện Tích (m2)" của vải bọc — cộng chung vào thì ra lượng sơn
    // gấp 5 lần (nệm mê 210×2250 to hơn cả bộ khung), tức mua thừa sơn.
    const paintM2 = parts.reduce(
      (s, p) => s + (layoutOf(p.group_code) === 'metal' ? (p.paint_area_m2 ?? 0) : 0),
      0,
    )
    // Dòng sơn TỰ TÍNH chỉ dùng khi hồ sơ CHƯA có khối "Sơn & hoá chất" nhập
    // tay — có cả hai thì cùng một lượng sơn hiện hai lần, người mua cộng nhầm.
    const hasPaintBlock = parts.some((p) => layoutOf(p.group_code) === 'paint')
    if (paintM2 > 0 && !hasPaintBlock)
      out.push({
        name: 'Sơn',
        unit: 'kg',
        qty: paintM2 / coverage,
        digits: 3,
        from: `${fmt(paintM2, 4)} m² bề mặt khung ÷ ${coverage} m²/kg`,
      })

    // DIỆN TÍCH và THỂ TÍCH gộp THEO TỪNG HỌ, mang đúng tên và ĐƠN VỊ MUA của
    // họ đó — dồn một dòng "Vải / bề mặt bọc" từng làm SP toàn nan gỗ cũng hiện
    // "Vải 4,6 m²", người mua đặt sai thứ.
    const FAMILIES: { fam: string; label: string; units: ('m3' | 'm2')[] }[] = [
      { fam: 'wood', label: 'Gỗ tự nhiên', units: ['m3'] },
      { fam: 'sheet', label: 'Polywood / ván ép / mặt bàn', units: ['m2', 'm3'] },
      { fam: 'soft', label: 'Nệm / mút / gòn', units: ['m3'] },
      { fam: 'fabric', label: 'Vải / textilene', units: ['m2'] },
    ]
    for (const { fam, label, units } of FAMILIES) {
      const rows = parts.filter((p) => layoutOf(p.group_code) === fam)
      if (rows.length === 0) continue
      for (const u of units) {
        const qty = rows.reduce(
          (s, p) => s + ((u === 'm3' ? p.volume_m3 : p.paint_area_m2) ?? 0),
          0,
        )
        if (qty <= 0) continue
        out.push({
          name: label,
          unit: u === 'm3' ? 'm³' : 'm²',
          qty,
          digits: u === 'm3' ? 6 : 4,
          from:
            u === 'm3'
              ? `Σ K. Lượng (m³) của ${rows.length} dòng`
              : `Σ Diện tích (m²) của ${rows.length} dòng`,
        })
      }
    }

    return out
  }, [parts, coverage])

  /**
   * Phần B — mọi dòng MUA RỜI, kê từng mặt hàng. Không gộp: "Vít M4x25" và
   * "Vít M5x40" là hai đơn đặt khác nhau, gộp "vít 32 con" là vô dụng.
   */
  const buys = useMemo<BuyLine[]>(() => {
    const groupLabel = new Map(groups.map((g) => [g.code, g.label]))
    return parts
      .filter((p) => {
        const l = layoutOf(p.group_code)
        return l === 'supply' || l === 'rope' || l === 'paint'
      })
      .map((p) => {
        const l = layoutOf(p.group_code)
        return {
          id: p.id,
          name: nameOf(p, l),
          // Dây đan định mức bằng kg/SP; sơn nhập tay cũng kg — thiếu ĐVT thì
          // nói theo họ chứ không bịa "cái".
          unit: p.unit ?? (l === 'rope' || l === 'paint' ? 'kg' : ''),
          qty: p.qty,
          groupLabel:
            groupLabel.get(p.group_code) ?? FALLBACK_GROUP[l] ?? p.group_code,
          detail:
            [p.color, splitNote(p.material_note).material].filter(Boolean).join(' · ') ||
            null,
        }
      })
  }, [parts, groups])

  /** Phần C — đếm chỗ THIẾU, kèm lý do vì sao nó đáng quan tâm. */
  const gaps = useMemo(() => {
    const missingQty = parts.filter((p) => p.qty == null).length
    const metalNoKg = parts.filter(
      (p) => layoutOf(p.group_code) === 'metal' && p.weight_kg == null,
    ).length
    const volFams = new Set(['wood', 'sheet', 'soft'])
    const noVolume = parts.filter(
      (p) => volFams.has(layoutOf(p.group_code)) && p.volume_m3 == null,
    ).length
    const fabricNoArea = parts.filter(
      (p) => layoutOf(p.group_code) === 'fabric' && p.paint_area_m2 == null,
    ).length
    return { missingQty, metalNoKg, noVolume, fabricNoArea }
  }, [parts])

  const warnings: string[] = []
  if (gaps.missingQty > 0)
    warnings.push(
      `${gaps.missingQty} dòng chưa có Số lượng — chưa vào được nhu cầu vật tư của Cung ứng`,
    )
  if (gaps.metalNoKg > 0)
    warnings.push(
      `${gaps.metalNoKg} dòng khung chưa ra Khối lượng — điền đủ Loại · Dày · Rộng · δ · Dài (hoặc gõ thẳng KL) thì hệ tự tính`,
    )
  if (gaps.noVolume > 0)
    warnings.push(
      `${gaps.noVolume} dòng gỗ / ván / nệm chưa ra m³ — điền đủ ba kích thước hoặc gõ thẳng m³`,
    )
  if (gaps.fabricNoArea > 0)
    warnings.push(`${gaps.fabricNoArea} dòng vải chưa ra m² — điền khổ và chiều dài cắt`)

  if (parts.length === 0) return null

  const frameKg = derived
    .filter((l) => l.unit === 'kg' && l.name !== 'Sơn')
    .reduce((s, l) => s + l.qty, 0)

  const th = 'text-muted-foreground py-2 pr-3 text-left text-xs font-medium uppercase'
  const band =
    'text-[11px] font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-1.5 px-5 pt-3 pb-1'

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-2.5 px-5 pt-4 pb-3">
        <SectionIcon icon={Sigma} tone="emerald" />
        <h2 className="text-sm font-semibold">Tổng hợp vật tư</h2>
        <span className="text-muted-foreground text-xs">
          · tự tính từ định mức — Cung ứng đọc bảng này
        </span>
        {/* Đối chiếu nhanh: Σ KL khung tính được vs KL cân thật của SP. Hai số
            không cần bằng nhau (KL thật gồm cả gỗ, ngũ kim…) — bày cạnh nhau để
            người rà thấy ngay khi số tính vênh hẳn khỏi thực tế. */}
        {frameKg > 0 && (
          <span className="text-muted-foreground ml-auto inline-flex items-center gap-1 text-xs tabular-nums">
            <Scale className="size-3.5" />
            KL khung tính: <b className="text-foreground">{fmt(frameKg, 2)} kg</b>
            {actualWeightKg != null && actualWeightKg > 0 && (
              <> · SP cân thật: {fmt(actualWeightKg, 2)} kg</>
            )}
          </span>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="mx-5 mb-3 rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/5 px-3 py-2">
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-1.5 py-0.5 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--warn)]" />
              <span>{w}</span>
            </p>
          ))}
        </div>
      )}

      <Separator />

      {derived.length > 0 && (
        <>
          <div className={band}>
            <Sigma className="size-3.5" /> Vật liệu tính từ quy cách
          </div>
          <div className="overflow-x-auto px-5 pb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className={th}>Tên hàng hoá</th>
                  <th className={`${th} w-16`}>ĐVT</th>
                  <th className={`${th} w-28 text-right`}>SL / SP</th>
                  <th className={`${th} hidden sm:table-cell`}>Lấy từ</th>
                </tr>
              </thead>
              <tbody>
                {derived.map((l) => (
                  <tr key={`${l.name}-${l.unit}`} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 font-medium">
                      <span className="text-muted-foreground mr-1" title="số tự tính">
                        ƒ
                      </span>
                      {l.name}
                    </td>
                    <td className="text-muted-foreground py-1.5 pr-3">{l.unit}</td>
                    <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                      {fmt(l.qty, l.digits)}
                    </td>
                    <td className="text-muted-foreground hidden py-1.5 text-xs sm:table-cell">
                      {l.from}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {derived.length === 0 && warnings.length === 0 && buys.length === 0 && (
        <p className="text-muted-foreground px-5 py-3 text-sm">
          Chưa đủ số liệu để tổng hợp — các dòng định mức còn thiếu khối lượng / diện tích
          / m³.
        </p>
      )}

      {buys.length > 0 && (
        <>
          <Separator />
          <div className={band}>
            <ShoppingCart className="size-3.5" /> Vật tư mua rời — {buys.length} mặt hàng
          </div>
          <div className="overflow-x-auto px-5 pb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className={th}>Tên hàng hoá</th>
                  <th className={`${th} w-16`}>ĐVT</th>
                  <th className={`${th} w-28 text-right`}>SL / SP</th>
                  <th className={`${th} hidden sm:table-cell`}>Nhóm</th>
                </tr>
              </thead>
              <tbody>
                {buys.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">
                      {b.name}
                      {b.detail && (
                        <span className="text-muted-foreground ml-1.5 text-xs">
                          {b.detail}
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground py-1.5 pr-3">{b.unit}</td>
                    <td className="py-1.5 pr-3 text-right font-medium tabular-nums">
                      {b.qty != null ? (
                        fmtQty(b.qty)
                      ) : (
                        <span className="text-[var(--stop)]">cần SL</span>
                      )}
                    </td>
                    <td className="text-muted-foreground hidden py-1.5 text-xs sm:table-cell">
                      {b.groupLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-muted-foreground px-5 pt-1 pb-3 text-xs">
        ƒ = số tự tính từ quy cách chi tiết — muốn đổi thì sửa dòng gốc ở bảng trên.
      </p>
    </Card>
  )
}
