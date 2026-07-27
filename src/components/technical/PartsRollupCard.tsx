'use client'

import { useMemo } from 'react'
import { Sigma } from 'lucide-react'
import { Card } from '@/components/shadcn/card'
import { Separator } from '@/components/shadcn/separator'
import { MATERIAL_DENSITY } from '@/lib/bom-calc'
import { layoutOf } from './part-layouts'
import type { PartView } from './ProductProfileCards'

/**
 * Khối cuối của biểu mẫu BOM (`Nhôm+ Sơn + gỗ + dây`).
 *
 * Bỏ 2 cột tiền theo quyết định D4, khối này còn lại đúng phần có giá trị: THỨ
 * GÌ, BAO NHIÊU, ĐƠN VỊ NÀO — chính là đầu vào Cung ứng cần. Mọi dòng ở đây đều
 * TÍNH từ định mức chi tiết, nên không có ô nào sửa được: muốn đổi số thì sửa
 * dòng gốc. (Trong file gốc khối này gõ tay, và đó là chỗ sinh ra lỗi cộng nhầm
 * dải ô — xem docs/dinh-muc-redesign-plan.md §1.5.)
 */

const MATERIAL_LABEL: Record<string, string> = {
  AL: 'Nhôm',
  IR: 'Sắt / thép',
  IN: 'Inox',
}

const fmt = (v: number, d: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

type Line = { name: string; unit: string; qty: number; digits: number; from: string }

export function PartsRollupCard({
  parts,
  paintCoverage,
}: {
  parts: PartView[]
  paintCoverage: number | null
}) {
  const coverage = paintCoverage && paintCoverage > 0 ? paintCoverage : 5

  const lines = useMemo<Line[]>(() => {
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
    if (paintM2 > 0)
      out.push({
        name: 'Sơn',
        unit: 'kg',
        qty: paintM2 / coverage,
        digits: 3,
        from: `${fmt(paintM2, 4)} m² bề mặt khung ÷ ${coverage} m²/kg`,
      })

    const softM2 = parts.reduce(
      (s, p) => s + (layoutOf(p.group_code) === 'metal' ? 0 : (p.paint_area_m2 ?? 0)),
      0,
    )
    if (softM2 > 0)
      out.push({
        name: 'Vải / bề mặt bọc',
        unit: 'm²',
        qty: softM2,
        digits: 4,
        from: 'Σ diện tích các dòng gỗ, nệm, vải',
      })

    const m3 = parts.reduce(
      (s, p) => s + (layoutOf(p.group_code) === 'metal' ? 0 : (p.volume_m3 ?? 0)),
      0,
    )
    if (m3 > 0)
      out.push({
        name: 'Gỗ / vật liệu khối',
        unit: 'm³',
        qty: m3,
        digits: 6,
        from: 'Σ khối lượng các dòng gỗ, nệm',
      })

    return out
  }, [parts, coverage])

  if (lines.length === 0) return null

  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center gap-2 px-5 pt-4 pb-3">
        <Sigma className="text-muted-foreground size-4 shrink-0" />
        <h2 className="text-sm font-semibold">Tổng hợp vật tư</h2>
        <span className="text-muted-foreground text-xs">
          · tự tính từ định mức — Cung ứng đọc bảng này
        </span>
      </div>
      <Separator />
      <div className="overflow-x-auto px-5 py-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs uppercase">
              <th className="py-2 pr-3 font-medium">Tên hàng hoá</th>
              <th className="py-2 pr-3 font-medium">ĐVT</th>
              <th className="py-2 pr-3 text-right font-medium">SL / SP</th>
              <th className="py-2 font-medium">Lấy từ</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.name} className="border-b last:border-0">
                <td className="py-1.5 pr-3 font-medium">
                  <span className="text-muted-foreground mr-1" title="số tự tính">
                    ƒ
                  </span>
                  {l.name}
                </td>
                <td className="text-muted-foreground py-1.5 pr-3">{l.unit}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {fmt(l.qty, l.digits)}
                </td>
                <td className="text-muted-foreground py-1.5 text-xs">{l.from}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground px-5 pb-3 text-xs">
        Vật tư mua rời (dây đan, ngũ kim, bao bì) nằm ở các khối tương ứng phía trên —
        bảng này chỉ gộp thứ suy ra được từ quy cách chi tiết.
      </p>
    </Card>
  )
}
