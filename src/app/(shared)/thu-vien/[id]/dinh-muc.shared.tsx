'use client'

import { cn } from '@/lib/utils'
import type { HoSoPart } from './ho-so.shared'

/*
 * Kiểu, hằng và ô nhập của lưới định mức — tách khỏi `ho-so-dinh-muc.tsx`
 * cho dưới trần 800 dòng. Logic lưới (nháp, lưu, phím) vẫn ở file kia.
 */

/** Trường sửa được trên một dòng định mức. */
export type PartField =
  | 'cluster_id'
  | 'part_name'
  | 'note'
  | 'material_code'
  | 'profile_shape'
  | 'profile_code'
  | 'dim_a_mm'
  | 'dim_b_mm'
  | 'wall_thickness_mm'
  | 'cut_length_mm'
  | 'bend_waste_mm'
  | 'qty'
  | 'unit'

export const SO: ReadonlySet<PartField> = new Set([
  'dim_a_mm',
  'dim_b_mm',
  'wall_thickness_mm',
  'cut_length_mm',
  'bend_waste_mm',
  'qty',
])
/** Trường đổi thì kg · m² · tổng dài phải tính lại. */
export const GEO: ReadonlySet<PartField> = new Set([
  'profile_shape',
  'dim_a_mm',
  'dim_b_mm',
  'wall_thickness_mm',
  'cut_length_mm',
  'bend_waste_mm',
  'qty',
])

export type Draft = Partial<Record<PartField, string>>
/** Dòng trên lưới: dòng thật của hồ sơ, hoặc dòng MỚI chưa lưu (id `new:n`). */
export type Row = HoSoPart & { moi?: boolean }

/** "1.750" → 1750 · "1,2" → 1.2 (luật số VN: dấu chấm là nhóm nghìn). undefined = không phải số. */
export function parseVn(s: string): number | null | undefined {
  const t = s.trim()
  if (!t) return null
  const n = Number(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

export function rawOf(p: Row, field: PartField): string {
  const v = p[field]
  if (v == null) return ''
  return typeof v === 'number' ? String(v).replace('.', ',') : String(v)
}

export function dongMoi(id: string, group_code: string): Row {
  return {
    id,
    group_code,
    cluster_id: null,
    part_no: null,
    part_name: '',
    material_code: null,
    material_note: null,
    material_kind: null,
    tenon_mm: null,
    profile_shape: null,
    profile_code: null,
    dim_a_mm: null,
    dim_b_mm: null,
    wall_thickness_mm: null,
    cut_length_mm: null,
    bend_waste_mm: null,
    kg_per_m: null,
    qty: null,
    unit: null,
    total_length_m: null,
    weight_kg: null,
    paint_area_m2: null,
    volume_m3: null,
    blank_confirmed_at: null,
    note: null,
    moi: true,
  }
}

/**
 * Cột của lưới — thứ tự và tên theo biểu mẫu BOM giấy / app CodeIgniter cũ
 * (Stt · Bộ phận · Tên chi tiết · Loại · Quy cách tinh: Dày Rộng Dài δ · Phi
 * hao uốn · SL · Tự tính: Tổng dài kg m² · Ghi chú). Mỗi cột có BẬC bề rộng
 * nó cần; không đủ chỗ thì ẨN cột, KHÔNG cuộn ngang (chủ dự án 08/10/2026).
 */
export type Tier = 'sm' | 'md' | 'lg' | 'xl'
export const TIER_RANK: Record<Tier, number> = { sm: 0, md: 1, lg: 2, xl: 3 }
export type ColKey =
  | 'no'
  | 'cum'
  | 'ten'
  | 'ma'
  | 'loai'
  | 'a'
  | 'b'
  | 'dai'
  | 'd'
  | 'hao'
  | 'sl'
  | 'dvt'
  | 'tong'
  | 'kg'
  | 'm2'
  | 'note'
  | 'phoi'
  | 'act'
export type Col = {
  key: ColKey
  label: string
  w?: number
  tier: Tier
  num?: boolean
  title?: string
  /** Cột thuộc nhóm tiêu đề hai tầng: `qc` = Quy cách tinh (mm) · `fx` = Tự tính. */
  group?: 'qc' | 'fx'
}
export const COLS: Col[] = [
  { key: 'no', label: 'Stt', w: 32, tier: 'sm', num: true },
  { key: 'cum', label: 'Bộ phận', w: 92, tier: 'md' },
  { key: 'ten', label: 'Tên chi tiết', tier: 'sm' },
  { key: 'ma', label: 'Mã VT', w: 84, tier: 'md' },
  { key: 'loai', label: 'Loại', w: 140, tier: 'sm', title: 'Dạng profile · mã khuôn' },
  { key: 'a', label: 'Dày', w: 54, tier: 'sm', num: true, group: 'qc' },
  { key: 'b', label: 'Rộng', w: 54, tier: 'sm', num: true, group: 'qc' },
  { key: 'dai', label: 'Dài', w: 62, tier: 'sm', num: true, group: 'qc' },
  {
    key: 'd',
    label: 'δ',
    w: 46,
    tier: 'md',
    num: true,
    group: 'qc',
    title: 'Dày vật liệu (mm)',
  },
  {
    key: 'hao',
    label: 'Hao uốn',
    w: 56,
    tier: 'lg',
    num: true,
    title: 'Phi hao chi tiết uốn (mm)',
  },
  { key: 'sl', label: 'SL', w: 48, tier: 'sm', num: true },
  { key: 'dvt', label: 'ĐVT', w: 48, tier: 'sm' },
  { key: 'tong', label: 'Tổng dài (m)', w: 70, tier: 'md', num: true, group: 'fx' },
  { key: 'kg', label: 'kg', w: 62, tier: 'sm', num: true, group: 'fx' },
  { key: 'm2', label: 'm² sơn', w: 62, tier: 'lg', num: true, group: 'fx' },
  { key: 'note', label: 'Ghi chú', w: 150, tier: 'sm' },
  { key: 'phoi', label: 'Phôi', w: 38, tier: 'xl', title: 'Xưởng phôi đã xác nhận' },
  { key: 'act', label: '', w: 30, tier: 'sm' },
]
export const GROUP_LABEL = { qc: 'Quy cách tinh (mm)', fx: 'Tự tính' } as const

/** Bậc theo bề rộng khối (px): xl đủ 18 cột · lg · md · sm 10 cột. */
export function tierOf(w: number): Tier {
  return w >= 1240 ? 'xl' : w >= 1080 ? 'lg' : w >= 960 ? 'md' : 'sm'
}

/** Tên cột đọc được của từng ô — cho trình đọc màn hình và tooltip. */
const TEN_O: Record<PartField, string> = {
  cluster_id: 'Bộ phận',
  part_name: 'Tên chi tiết',
  note: 'Ghi chú',
  material_code: 'Mã vật tư',
  profile_shape: 'Loại / dạng',
  profile_code: 'Mã profile',
  dim_a_mm: 'Dày (mm)',
  dim_b_mm: 'Rộng (mm)',
  wall_thickness_mm: 'Dày vật liệu δ (mm)',
  cut_length_mm: 'Dài cắt (mm)',
  bend_waste_mm: 'Hao uốn (mm)',
  qty: 'Số lượng',
  unit: 'Đơn vị tính',
}

/** Một ô của lưới: ô nhập khi đang ở chế độ sửa, chữ thường khi xem. */
export function O({
  sua,
  r,
  f,
  idx,
  value,
  show,
  num,
  ph,
  onChange,
  onKey,
}: {
  sua: boolean
  r: Row
  f: PartField
  idx: number
  value: string
  /** Chữ bày khi chỉ xem (số đã định dạng); mặc định là giá trị thô. */
  show?: string
  num?: boolean
  ph?: string
  onChange: (v: string) => void
  onKey: (e: React.KeyboardEvent<HTMLInputElement>, r: Row, f: PartField) => void
}) {
  if (!sua) {
    const t = show ?? value
    return (
      <span className={cn('ro', !t && 'muted')} title={t || undefined}>
        {t || ph || ''}
      </span>
    )
  }
  return (
    <input
      className={cn('cell', num && 'num')}
      value={value}
      placeholder={ph}
      inputMode={num ? 'decimal' : undefined}
      aria-label={TEN_O[f]}
      data-r={idx}
      data-c={f}
      data-id={r.id}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => onKey(e, r, f)}
      onFocus={(e) => e.currentTarget.select()}
    />
  )
}
