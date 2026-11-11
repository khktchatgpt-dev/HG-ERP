import type { StageConfig } from '@/lib/stage-config'

/**
 * Kiểu + hằng + helper dùng chung của màn Định hình (bản vẽ duyệt 03/11/2026,
 * https://claude.ai/artifact/DUtMtTWekhhBUUzh54XM9L). Không JSX, không state.
 */

export type InitialRow = {
  production_order_line_id: string
  kind: 'part' | 'assembly'
  cluster: string | null
  name: string
  group_code: string | null
  material_id: string | null
  material_type: string | null
  spec_thickness_mm: number | null
  spec_width_mm: number | null
  spec_length_mm: number | null
  wall_thickness_mm: number | null
  unit: string | null
  qty_per_unit: number
  dm_kg: number | null
  pcs_per_bar: number | null
  qty_per_assembly: number | null
  first_stage: string | null
  final_stage: string | null
  stages?: string[] | null
  note: string | null
}

/** Một dòng đang gõ. Ô số giữ CHUỖI để gõ "0,53" không bị nhảy. */
export type Draft = {
  key: string
  production_order_line_id: string
  kind: 'part' | 'assembly'
  cluster: string
  name: string
  group_code: string
  material_id: string | null
  material_type: string | null
  spec_thickness_mm: string
  spec_width_mm: string
  spec_length_mm: string
  wall_thickness_mm: string
  unit: string
  qty_per_unit: string
  dm_kg: string
  pcs_per_bar: number | null
  qty_per_assembly: number | null
  first_stage: string | null
  final_stage: string | null
  stages: string[] | null
  note: string
}

export type OrderLine = {
  id: string
  product_code: string
  product_name: string
  qty: number
  unit: string
  group_title: string
  /** SP đã có định mức ở hồ sơ chưa — quyết định ô "Khởi tạo hồ sơ SP". */
  has_profile: boolean
}

export type DinhHinhProps = {
  lsx: { id: string; code: string; customer_name: string; status: string }
  orderLines: OrderLine[]
  initialRows: InitialRow[]
  groups: { code: string; label: string }[]
  stageCfg: StageConfig[]
  lockedByEntries: boolean
  /** Số phiếu PBS đang khoá bảng — để câu chặn nói đúng số. */
  pbsCount: number
  lsxClosed: boolean
  canEdit: boolean
  /** SP mở sẵn (id dòng lệnh) — màn Lộ trình công đoạn bản 4 chọn Lệnh → SP. */
  initialSp?: string
}

/** Cột GÕ ĐƯỢC theo thứ tự trên lưới — trục ngang của bàn phím và vùng dán. */
export type EditCol = {
  key: keyof Draft & string
  label: string
  kind: 'text' | 'num' | 'select'
  width: number
  /** Chỉ hiện khi bật "Cột quy cách". */
  spec?: boolean
  required?: boolean
}
export const EDIT_COLS: EditCol[] = [
  { key: 'cluster', label: 'Cụm', kind: 'text', width: 120 },
  { key: 'name', label: 'Tên chi tiết', kind: 'text', width: 220, required: true },
  { key: 'group_code', label: 'Nhóm vật tư', kind: 'select', width: 124 },
  { key: 'unit', label: 'ĐVT', kind: 'text', width: 52 },
  { key: 'qty_per_unit', label: 'CT/SP', kind: 'num', width: 74, required: true },
  { key: 'dm_kg', label: 'ĐM kg', kind: 'num', width: 84 },
  { key: 'spec_thickness_mm', label: 'Dày', kind: 'num', width: 56, spec: true },
  { key: 'spec_width_mm', label: 'Rộng', kind: 'num', width: 56, spec: true },
  { key: 'spec_length_mm', label: 'Dài cắt', kind: 'num', width: 70, spec: true },
  { key: 'wall_thickness_mm', label: 'δ', kind: 'num', width: 48, spec: true },
  { key: 'note', label: 'Ghi chú', kind: 'text', width: 0 },
]
export const visibleCols = (more: boolean) => EDIT_COLS.filter((c) => more || !c.spec)

let seq = 0
export const newKey = () => `r${++seq}`
const s = (v: number | null | undefined) => (v == null ? '' : String(v))
export const num = (v: string): number | null => {
  const t = v.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
export const fmt = (n: number) => n.toLocaleString('vi-VN')
export const cx = (...xs: (string | false | null | undefined | 0)[]) =>
  xs.filter(Boolean).join(' ')

export function toDraft(r: InitialRow): Draft {
  return {
    key: newKey(),
    production_order_line_id: r.production_order_line_id,
    kind: r.kind ?? 'part',
    cluster: r.cluster ?? '',
    name: r.name,
    group_code: r.group_code ?? '',
    material_id: r.material_id ?? null,
    material_type: r.material_type ?? null,
    spec_thickness_mm: s(r.spec_thickness_mm),
    spec_width_mm: s(r.spec_width_mm),
    spec_length_mm: s(r.spec_length_mm),
    wall_thickness_mm: s(r.wall_thickness_mm),
    unit: r.unit ?? '',
    qty_per_unit: s(r.qty_per_unit),
    dm_kg: s(r.dm_kg),
    pcs_per_bar: r.pcs_per_bar ?? null,
    qty_per_assembly: r.qty_per_assembly ?? null,
    first_stage: r.first_stage ?? null,
    final_stage: r.final_stage ?? null,
    stages: r.stages ?? null,
    note: r.note ?? '',
  }
}

export function emptyDraft(lineId: string): Draft {
  return toDraft({
    production_order_line_id: lineId,
    kind: 'part',
    cluster: null,
    name: '',
    group_code: '',
    material_id: null,
    material_type: null,
    spec_thickness_mm: null,
    spec_width_mm: null,
    spec_length_mm: null,
    wall_thickness_mm: null,
    unit: 'cái',
    qty_per_unit: 1,
    dm_kg: null,
    pcs_per_bar: null,
    qty_per_assembly: null,
    first_stage: null,
    final_stage: null,
    stages: null,
    note: null,
  })
}

/** Ô bắt buộc còn trống / sai trên một dòng — mỗi phần tử trỏ đúng cột. */
export function rowProblems(d: Draft): { key: EditCol['key']; msg: string }[] {
  const out: { key: EditCol['key']; msg: string }[] = []
  if (!d.name.trim()) out.push({ key: 'name', msg: 'chưa có tên' })
  if (!((num(d.qty_per_unit) ?? 0) > 0))
    out.push({ key: 'qty_per_unit', msg: 'CT/SP phải > 0' })
  return out
}

export const cellId = (key: string, col: string) => `dh-${key}-${col}`

// ── Cột quy cách — nhớ theo máy (localStorage), đọc qua useSyncExternalStore ──
const MORE_KEY = 'hg:dinh-hinh-cot-quy-cach'
const moreListeners = new Set<() => void>()
export function subscribeMore(cb: () => void) {
  moreListeners.add(cb)
  return () => {
    moreListeners.delete(cb)
  }
}
export function readMore() {
  try {
    return localStorage.getItem(MORE_KEY) === '1'
  } catch {
    return false
  }
}
export function writeMore(v: boolean) {
  try {
    localStorage.setItem(MORE_KEY, v ? '1' : '0')
  } catch {
    /* riêng tư chặn storage — phiên này vẫn đổi */
  }
  for (const cb of moreListeners) cb()
}
