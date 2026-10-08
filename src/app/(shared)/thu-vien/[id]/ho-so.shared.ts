/**
 * Kiểu + hằng của màn Hồ sơ SP. File THƯỜNG (không 'use client') vì page
 * server gọi `toHoSoView` — xem bẫy ở `../thu-vien.const.ts`.
 */

import type { HoSoData } from '@/modules/dept/technical/profile.service'
import { SHAPE_OPTIONS } from '@/lib/bom-calc'

export type HoSoView = ReturnType<typeof toHoSoView>

/** Chỉ truyền xuống client thứ màn cần — `Product` đầy đủ 80 cột, phần lớn không bày. */
export function toHoSoView(d: HoSoData) {
  const p = d.product
  const ts = (p.tech_spec ?? {}) as Record<string, string | undefined>
  return {
    id: p.id,
    code: p.code,
    code_legacy: p.code_legacy,
    name: p.name,
    name_foreign: p.name_foreign,
    customer_name: p.customer_name,
    customer_item_code: p.customer_item_code,
    product_type: p.product_type,
    frame_material: p.frame_material,
    unit: p.unit,
    is_set: p.is_set,
    is_active: p.is_active,
    locked_at: p.locked_at,
    lifecycle: p.lifecycle,
    bom_status: p.bom_status,
    length_mm: p.length_mm,
    width_mm: p.width_mm,
    height_mm: p.height_mm,
    length_open_mm: p.length_open_mm,
    width_open_mm: p.width_open_mm,
    height_open_mm: p.height_open_mm,
    net_weight_kg: p.net_weight_kg,
    actual_weight_kg: p.actual_weight_kg,
    max_load_kg: p.max_load_kg,
    material: p.material,
    hs_code: p.hs_code,
    origin_country: p.origin_country,
    // Lộ trình công đoạn nằm ở cụm (`first_stage`/`final_stage`), chưa có trên SP → để trống.
    stage_route: null as string[] | null,
    tech_spec: {
      paint: ts.paint ?? '',
      wood: ts.wood ?? '',
      glass: ts.glass ?? '',
      cushion: ts.cushion ?? '',
    },
    rev: d.rev,
    creatorName: d.creatorName,
    ownerName: d.ownerName,
    imageUrl: d.imageUrl,
    imageUrls: d.imageUrls,
    parts: d.parts.map((x) => ({
      id: x.id,
      group_code: x.group_code,
      cluster_id: x.cluster_id,
      part_no: x.part_no,
      part_name: x.part_name,
      material_code: x.material_code,
      material_note: x.material_note,
      material_kind: x.material_kind,
      tenon_mm: x.tenon_mm,
      profile_shape: x.profile_shape,
      profile_code: x.profile_code,
      dim_a_mm: x.dim_a_mm,
      dim_b_mm: x.dim_b_mm,
      wall_thickness_mm: x.wall_thickness_mm,
      cut_length_mm: x.cut_length_mm,
      bend_waste_mm: x.bend_waste_mm,
      kg_per_m: x.kg_per_m,
      qty: x.qty,
      unit: x.unit,
      total_length_m: x.total_length_m,
      weight_kg: x.weight_kg,
      paint_area_m2: x.paint_area_m2,
      volume_m3: x.volume_m3,
      blank_confirmed_at: x.blank_confirmed_at,
      note: x.note,
    })),
    groups: d.groups.map((g) => ({ code: g.code, label: g.label })),
    clusters: d.clusters.map((c) => ({ id: c.id, name: c.name })),
    setItems: d.setItems,
    packingCount: d.packing.length,
    packingDefault: d.packing.find((o) => o.is_default) ?? d.packing[0] ?? null,
    files: d.files,
    hasSample: d.hasSample,
    check: d.check,
    diem: d.diem,
    thieuSo: d.thieuSo,
    plan: d.plan,
    /** Phương án đóng gói THẬT (bảng), đủ kiện. */
    packingOptions: d.packing,
    /** Ô tóm tắt đóng gói cũ (jsonb) — sửa được tại chỗ; bù khi chưa có phương án thật. */
    packingJson: (d.product.packing ?? {}) as {
      carton_l_cm?: number
      carton_w_cm?: number
      carton_h_cm?: number
      qty_per_carton?: number
      loading_40hc?: number
      pack_unit_label?: string
      nw_kg?: number
      gw_kg?: number
      cbm?: number
    },
    revisions: d.revisions,
  }
}

export type HoSoPart = HoSoView['parts'][number]

const SHAPE_LABEL: Record<string, string> = Object.fromEntries(
  SHAPE_OPTIONS.map((s) => [s.code, s.label]),
)

/** Cột "Quy cách": dạng + tiết diện + δ, rồi mã profile / ghi chú vật liệu. */
export function quyCach(p: HoSoPart): string {
  const parts: string[] = []
  if (p.profile_shape) parts.push(SHAPE_LABEL[p.profile_shape] ?? p.profile_shape)
  if (p.dim_a_mm)
    parts.push(p.dim_b_mm ? `${nz(p.dim_a_mm)}×${nz(p.dim_b_mm)}` : nz(p.dim_a_mm))
  if (p.wall_thickness_mm) parts.push(`δ${nz(p.wall_thickness_mm)}`)
  if (p.profile_code) parts.push(p.profile_code)
  if (p.material_note) parts.push(p.material_note)
  return parts.join(' ')
}

export function nz(v: number | null | undefined, digits = 1): string {
  if (v == null) return ''
  return v.toLocaleString('vi-VN', { maximumFractionDigits: digits })
}

export function dmyShort(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
