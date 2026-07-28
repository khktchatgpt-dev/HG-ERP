'use client'

import { useState } from 'react'
import { Boxes, PackageOpen } from 'lucide-react'
import { Card } from '@/components/shadcn/card'
import { Separator } from '@/components/shadcn/separator'
import { SectionIcon, type Tone } from '@/components/technical/ProductSpecCards'
import { cn } from '@/lib/utils'

export type PartView = {
  id: string
  /** Mã nhóm — nhãn/thứ tự tra từ `groups`, không hằng số hoá trong code (0093). */
  group_code: string
  /** Tiêu đề khối trong file BOM — hiện thành dải tiêu đề trong bảng (0095). */
  section_title: string | null
  /** "1 ghế" = định mức khối này KHÔNG tính trên 1 sản phẩm. */
  unit_basis: string | null
  material_note: string | null
  tenon: string | null
  /** "Mộng" (mm) — tham gia công thức diện tích / m³ của khối gỗ, nệm. */
  tenon_mm: number | null
  /** CỤM (`Parts/ Bộ phận`). null = dòng RỜI, trực thuộc sản phẩm. */
  cluster_id: string | null
  part_no: number | null
  total_length_m: number | null
  part_name: string
  material_code: string | null
  material_kind: string | null
  profile_shape: string | null
  profile_code: string | null
  dim_a_mm: number | null
  dim_b_mm: number | null
  wall_thickness_mm: number | null
  cut_length_mm: number | null
  /** "Phi hao chi tiết uốn" (mm) — cộng vào phôi, KHÔNG vào diện tích sơn. */
  bend_waste_mm: number | null
  /** Profile tra bảng kg/m (TD-HG04 = 0.260). */
  kg_per_m: number | null
  qty: number
  unit: string | null
  color: string | null
  weight_kg: number | null
  paint_area_m2: number | null
  /** DT theo công thức biểu mẫu (chu vi hình hộp) — để đối chiếu bảng kê giấy. */
  paint_area_box_m2: number | null
  /** Khối GỖ/POLYWOOD tính khối lượng bằng m³ (file BOM: "K. Lượng (m3)"). */
  volume_m3: number | null
  /** "Xác nhận Phôi" — xưởng phôi tick. */
  blank_confirmed_at: string | null
  note: string | null
}

/** Một CỤM của sản phẩm — dải gom các chi tiết trong tab Định mức. */
export type ClusterView = {
  id: string
  name: string
  qty_per_product: number | null
  first_stage: string | null
  final_stage: string | null
  note: string | null
  sort_order: number
}

export type SetItemView = {
  id: string
  item_label: string
  qty: number
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  net_weight_kg: number | null
}

export type PackingOptionView = {
  id: string
  option_no: number
  label: string | null
  cartons_per_set: number | null
  loading_40hc: number | null
  /** Phương án chốt dùng — nguồn ưu tiên khi bù vào ô tóm tắt (product-sections.withPackingFallback). */
  is_default: boolean
  packages: {
    id: string
    package_label: string
    carton_l_mm: number | null
    carton_w_mm: number | null
    carton_h_mm: number | null
    net_weight_kg: number | null
    gross_weight_kg: number | null
  }[]
}

/** Danh mục nhóm hạng mục, nạp từ `technical_part_groups` (0093). */
export type PartGroupView = {
  code: string
  label: string
  parent_code: string | null
  sort_order: number
}

const n = (v: number | null | undefined, d = 0) =>
  v == null ? null : v.toLocaleString('en-US', { maximumFractionDigits: d })

function CardHead({
  icon: Icon,
  tone,
  title,
  hint,
  right,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone?: Tone
  title: string
  hint?: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <SectionIcon icon={Icon} tone={tone} />
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        {hint && <span className="text-muted-foreground shrink-0 text-xs">· {hint}</span>}
      </div>
      {right}
    </div>
  )
}

/** Bộ sản phẩm gồm những món nào. */
export function SetItemsCard({ items }: { items: SetItemView[] }) {
  if (items.length === 0) return null
  return (
    <Card className="gap-0 py-0">
      <CardHead icon={Boxes} tone="amber" title="Bộ gồm" hint={`${items.length} món`} />
      <Separator />
      <div className="overflow-x-auto px-5 py-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs uppercase">
              <th className="py-2 pr-3 font-medium">Món</th>
              <th className="py-2 pr-3 text-right font-medium">SL</th>
              <th className="py-2 pr-3 font-medium">Kích thước (mm)</th>
              <th className="py-2 text-right font-medium">NW</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b last:border-0">
                <td className="py-1.5 pr-3 font-medium">{i.item_label}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{n(i.qty, 2)}</td>
                <td className="text-muted-foreground py-1.5 pr-3 tabular-nums">
                  {[i.length_mm, i.width_mm, i.height_mm].every((x) => x == null)
                    ? '—'
                    : [i.length_mm, i.width_mm, i.height_mm]
                        .map((x) => n(x, 1) ?? '?')
                        .join(' × ')}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {i.net_weight_kg != null ? `${i.net_weight_kg} kg` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/** Các phương án đóng gói — mỗi phương án nhiều kiện, số xếp cont khác nhau. */
export function PackingOptionsCard({ options }: { options: PackingOptionView[] }) {
  const [active, setActive] = useState(0)
  if (options.length === 0) return null
  const opt = options[Math.min(active, options.length - 1)]

  return (
    <Card className="gap-0 py-0">
      <CardHead
        icon={PackageOpen}
        tone="amber"
        title="Phương án đóng gói"
        hint={options.length > 1 ? `${options.length} phương án` : undefined}
      />
      <Separator />
      {options.length > 1 && (
        <div className="flex flex-wrap gap-1.5 px-5 pt-3">
          {options.map((o, i) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium',
                i === active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'hover:bg-muted text-muted-foreground',
              )}
            >
              PA {o.option_no}
              {o.loading_40hc != null && (
                <span className="ml-1 tabular-nums">· xếp {o.loading_40hc}</span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className="px-5 py-3">
        {opt.label && (
          <p className="text-muted-foreground mb-2 text-xs whitespace-pre-wrap">
            {opt.label}
          </p>
        )}
        <div className="text-muted-foreground mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {opt.cartons_per_set != null && <span>Thùng / bộ: {opt.cartons_per_set}</span>}
          {opt.loading_40hc != null && <span>Xếp 40′HC: {opt.loading_40hc}</span>}
          <span>Số kiện: {opt.packages.length}</span>
        </div>
        {opt.packages.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                  <th className="py-2 pr-3 font-medium">Kiện</th>
                  <th className="py-2 pr-3 font-medium">Carton (mm)</th>
                  <th className="py-2 text-right font-medium">GW</th>
                </tr>
              </thead>
              <tbody>
                {opt.packages.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-1.5 pr-3">{p.package_label}</td>
                    <td className="text-muted-foreground py-1.5 pr-3 tabular-nums">
                      {[p.carton_l_mm, p.carton_w_mm, p.carton_h_mm].every(
                        (x) => x == null,
                      )
                        ? '—'
                        : [p.carton_l_mm, p.carton_w_mm, p.carton_h_mm]
                            .map((x) => n(x, 1) ?? '?')
                            .join(' × ')}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {p.gross_weight_kg != null ? `${p.gross_weight_kg} kg` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  )
}
