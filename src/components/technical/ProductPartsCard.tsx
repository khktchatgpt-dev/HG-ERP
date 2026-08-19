'use client'

import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Copy, Layers, Pencil, Search, Upload } from 'lucide-react'
import { Card } from '@/components/shadcn/card'
import { Separator } from '@/components/shadcn/separator'
import { cn } from '@/lib/utils'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { RowMenu } from '@/components/erp/RowMenu'
import { PartCardEdit } from './PartCardEdit'
import { PartsCopyDialog } from './PartsCopyDialog'
import { PartsBulkEntry } from './PartsBulkEntry'
import { BomAiImport } from './BomAiImport'
import { InlineHead, PartRowInline, PartRowNew, inlineColSpan } from './PartRowInline'
import type { ClusterView, PartGroupView, PartView } from './ProductProfileCards'
import {
  columnsFor,
  defaultSectionTitle,
  layoutOf,
  splitNote,
  type LayoutKey,
  type PartColumn,
} from './part-layouts'

const n = (v: number | null | undefined, d = 0) =>
  v == null ? null : v.toLocaleString('en-US', { maximumFractionDigits: d })

/**
 * ĐÓNG BĂNG BA CỘT ĐẦU khi bảng cuộn ngang.
 *
 * Khối khung hiện trung vị 11 cột, tối đa 16 (đo trên 212 hồ sơ có định mức) —
 * kéo sang xem "Diện tích sơn" là tên chi tiết trôi khỏi màn, còn lại một dãy số
 * không biết của dòng nào. Ba cột giữ lại đúng phần ĐỊNH DANH: tick chọn · STT ·
 * tên.
 *
 * Toạ độ `left` phải khớp bề rộng cột trước nó (1.75rem + 2rem), nên có hai bộ:
 * có cột tick (quyền sửa) và không.
 *
 * BẮT BUỘC `min-w-*`, KHÔNG được dùng `w-*`. Đo trên màn 708px: bảng
 * `table-layout: auto` co cột tick từ `w-7` (28px) xuống 17px cho vừa bề ngang,
 * mốc `left` thì vẫn 1.75rem ⇒ ô tên bị đẩy sang phải 13px và ĐÈ LÊN cột "Loại"
 * — trên màn hiện ra "AI" thay vì "LOẠI", "p" thay vì "hộp" (chữ bị cắt từ bên
 * TRÁI, đó là dấu hiệu nhận ra kiểu lỗi này). `width` trong bảng auto chỉ là gợi
 * ý và bị bỏ khi chật; `min-width` thì luôn được tôn trọng.
 *
 * Nền phải ĐẶC (`bg-card`) — nền trong suốt thì chữ cột sau trôi qua dưới. Vạch
 * mép vẽ bằng `shadow` chứ không `border-r`, vì border cộng thêm 1px vào bề rộng
 * làm lệch `left` của cột kế tiếp.
 */
const FREEZE = {
  pick: 'bg-card sticky left-0 z-10 min-w-7',
  no: 'bg-card sticky left-0 z-10 min-w-8',
  noWithPick: 'bg-card sticky left-[1.75rem] z-10 min-w-8',
  name: 'bg-card sticky left-[2rem] z-10 shadow-[1px_0_0_var(--border)]',
  nameWithPick: 'bg-card sticky left-[3.75rem] z-10 shadow-[1px_0_0_var(--border)]',
} as const

const SHAPE_LABEL: Record<string, string> = {
  HOP: 'hộp',
  TRON: 'tròn',
  TRONDAC: 'tròn đặc',
  VUONG: 'vuông',
  LA: 'la',
  OVAN: 'ovan',
  OVANXR: 'ovan xẻ rãnh',
  TAM: 'tấm',
  LUOI: 'lưới',
  V: 'V',
  C: 'C',
  L: 'L',
  PF: 'profile',
}

/**
 * Quy cách gọn: "hộp 20×40 dày 1" · "tròn Ø27 dày 0.8" · "vuông 20 dày 0.8".
 * Tròn/vuông tiết diện đều nên chỉ nêu một chiều — ghi "27×27" là thừa.
 */
export function specOf(p: PartView, opts?: { withWall?: boolean }): string | null {
  if (p.profile_code) return p.profile_code
  const shape = p.profile_shape ? (SHAPE_LABEL[p.profile_shape] ?? p.profile_shape) : null
  const { dim_a_mm: a, dim_b_mm: b } = p
  let core: string | null = null
  if (p.profile_shape === 'TRON' || p.profile_shape === 'TRONDAC')
    core = a != null ? `Ø${n(a, 1)}` : null
  else if (p.profile_shape === 'VUONG') core = n(a, 1)
  else {
    const dims = [a, b].filter((x) => x != null)
    core = dims.length ? dims.map((x) => n(x, 1)).join('×') : null
  }
  // Bảng khung có CỘT RIÊNG "Dày vật liệu (δ)" — nhét độ dày vào cả chuỗi quy
  // cách nữa thì cùng một số hiện hai lần trên một dòng, đọc như số liệu vênh.
  const wall =
    opts?.withWall !== false &&
    p.wall_thickness_mm != null &&
    p.profile_shape !== 'TRONDAC' &&
    p.profile_shape !== 'LA'
      ? `dày ${n(p.wall_thickness_mm, 2)}`
      : null
  return [shape, core, wall].filter(Boolean).join(' ') || null
}

/**
 * Tên hiển thị. Khối VẬT TƯ trong biểu mẫu BOM có một cột "TÊN HÀNG HÓA" duy
 * nhất ("Vít bắn gỗ M4x25"), nhưng web cũ tách thành tên + quy cách nên nếu chỉ
 * lấy `part_name` thì ra "Vít" — một sản phẩm có 3 dòng cùng tên "Nút", 2 dòng
 * "Đế". Ghép lại cho khối vật tư; khối gia công thì quy cách đã có cột riêng.
 */
function nameOf(p: PartView, layout: LayoutKey): string {
  if (layout !== 'supply') return p.part_name
  const { spec } = splitNote(p.material_note)
  if (!spec) return p.part_name
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  // Quy cách đã chứa sẵn tên (hoặc ngược lại) thì không ghép, tránh "Vít Vít 4x15".
  if (norm(spec).includes(norm(p.part_name))) return spec
  return `${p.part_name} ${spec}`.replace(/\s+/g, ' ')
}

/**
 * Nội dung một ô theo mã cột (`part-layouts.ts`). Đơn vị và số chữ số thập phân
 * bám theo biểu mẫu BOM gốc: dài (mm) 1 số lẻ, tổng dài (m) 2, kg 3, m² 4, m³ 6.
 */
function cellOf(p: PartView, key: string): ReactNode {
  switch (key) {
    case 'spec':
      // Quy cách đã tách sẵn ra cột δ nên bỏ độ dày khỏi chuỗi. Không parse được
      // thì mới rơi về phần quy cách thô của `material_note`.
      return specOf(p, { withWall: false }) ?? splitNote(p.material_note).spec ?? '—'
    case 'dims': {
      const dims = [p.dim_a_mm, p.dim_b_mm].filter((x) => x != null)
      return dims.length ? dims.map((x) => n(x, 1)).join(' × ') : '—'
    }
    // Ba cột tiết diện tách rời — đúng bốn cột `Loại · Dày · Rộng · Dài` của file.
    case 'shape':
      return p.profile_code
        ? p.profile_code
        : p.profile_shape
          ? (SHAPE_LABEL[p.profile_shape] ?? p.profile_shape)
          : '—'
    case 'dimA':
      return n(p.dim_a_mm, 1) ?? '—'
    case 'dimB':
      return n(p.dim_b_mm, 1) ?? '—'
    case 'tenon':
      return p.tenon ?? '—'
    case 'tenonMm':
      return n(p.tenon_mm, 1) ?? '—'
    case 'cut':
      return n(p.cut_length_mm, 1) ?? '—'
    case 'waste':
      return p.bend_waste_mm ? n(p.bend_waste_mm, 1) : '—'
    case 'color':
      return p.color ?? '—'
    case 'blank':
      // "Xác nhận Phôi" — xưởng phôi tick. Chưa tick thì để vòng tròn rỗng chứ
      // không để trống, vì cột này là việc CẦN LÀM chứ không phải ô dữ liệu.
      return p.blank_confirmed_at ? (
        <span title={`Đã xác nhận phôi ${p.blank_confirmed_at.slice(0, 10)}`}>✓</span>
      ) : (
        <span className="text-muted-foreground/40">○</span>
      )
    case 'qty':
      // SL để trống (0163) — bày dấu nhắc VIỆC CẦN LÀM chứ không phải gạch ngang
      // như ô dữ liệu vắng mặt bình thường: thiếu ô này thì cả dòng không vào
      // được nhu cầu vật tư của Cung ứng.
      return p.qty == null ? (
        <span
          title="File BOM không ghi số lượng — điền vào thì dòng này mới vào nhu cầu vật tư"
          className="text-[var(--stop)]"
        >
          cần SL
        </span>
      ) : (
        n(p.qty, 4)
      )
    case 'unit':
      return p.unit ?? '—'
    case 'len':
      return p.total_length_m != null ? p.total_length_m.toFixed(2) : '—'
    case 'kg':
      return p.weight_kg != null ? p.weight_kg.toFixed(3) : '—'
    case 'm2':
      return p.paint_area_m2 != null ? p.paint_area_m2.toFixed(4) : '—'
    case 'm3':
      return p.volume_m3 != null ? p.volume_m3.toFixed(6) : '—'
    case 'wall':
      return n(p.wall_thickness_mm, 2) ?? '—'
    case 'mat':
      return splitNote(p.material_note).material ?? '—'
    /* ── Quy đổi đơn vị mua (0132) ─────────────────────────────────────── */
    case 'species':
      return p.wood_species ?? '—'
    case 'barLen':
      return n(p.bar_length_m, 2) ?? '—'
    case 'pcsBar':
      return n(p.pcs_per_bar, 0) ?? '—'
    case 'bars':
      // Số CÂY phải mua cho 1 SP — làm tròn LÊN, không ai mua nửa cây.
      return p.pcs_per_bar && p.pcs_per_bar > 0 && p.qty != null
        ? Math.ceil(p.qty / p.pcs_per_bar).toLocaleString('vi-VN')
        : '—'
    case 'roll':
      return n(p.roll_width_m, 2) ?? '—'
    case 'wastePct':
      return p.waste_pct != null ? `${n(p.waste_pct, 1)}%` : '—'
    case 'totalM':
      return p.total_length_m != null
        ? (p.total_length_m * (1 + (p.waste_pct ?? 0) / 100)).toFixed(2)
        : '—'
    // "TỔNG VẢI M2" = M² tinh × (1 + hao hụt%) — con số đem đi đặt vải.
    case 'totalM2':
      return p.paint_area_m2 != null
        ? (p.paint_area_m2 * (1 + (p.waste_pct ?? 0) / 100)).toFixed(4)
        : '—'
    case 'sheetSpec':
      return p.sheet_w_mm || p.sheet_l_mm
        ? `${n(p.sheet_w_mm, 0) ?? '?'} × ${n(p.sheet_l_mm, 0) ?? '?'}`
        : '—'
    case 'm3Sheet':
      return p.m3_per_sheet != null ? p.m3_per_sheet.toFixed(4) : '—'
    case 'note':
      return p.note ?? ''
    default:
      return null
  }
}

const haystack = (p: PartView) =>
  [
    p.part_name,
    p.section_title,
    p.material_note,
    p.tenon,
    p.color,
    p.profile_code,
    specOf(p),
    p.note,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

/** Tổng của một tập dòng — hiện ở chân cụm và chân khối, luôn TÍNH chứ không nhập. */
export type Totals = {
  qty: number
  len: number
  kg: number
  m2: number
  m3: number
}

export function sumRows(rows: PartView[]): Totals {
  return rows.reduce(
    (t, p) => ({
      qty: t.qty + (p.qty ?? 0),
      len: t.len + (p.total_length_m ?? 0),
      kg: t.kg + (p.weight_kg ?? 0),
      m2: t.m2 + (p.paint_area_m2 ?? 0),
      m3: t.m3 + (p.volume_m3 ?? 0),
    }),
    { qty: 0, len: 0, kg: 0, m2: 0, m3: 0 },
  )
}

/**
 * CỤM trong một khối. `cluster: null` = nhóm **RỜI** (dòng không thuộc cụm nào).
 *
 * Nhóm Rời luôn được dựng và luôn hiện khi có dòng — đúng 2 dòng Pát của file
 * mẫu `30x100 uống cong` bị lọt khỏi dòng "Tổng cộng" của Excel chính vì chúng
 * không thuộc cụm nào và bị bỏ quên.
 */
type ClusterBlock = {
  cluster: ClusterView | null
  rows: PartView[]
  totals: Totals
}
/** Khối định mức: một tiêu đề + các cụm thuộc nó. */
type Section = {
  title: string | null
  unitBasis: string | null
  rows: PartView[]
  blocks: ClusterBlock[]
}
type Group = {
  code: string
  label: string
  rows: PartView[]
  totals: Totals
  sections: Section[]
}

const sumKg = (rows: PartView[]) => rows.reduce((s, p) => s + (p.weight_kg ?? 0), 0)

/** Gom theo tiêu đề khối, giữ thứ tự xuất hiện. */
function toSections(rows: PartView[], clusters: ClusterView[]): Section[] {
  const out: Section[] = []
  for (const p of rows) {
    const last = out[out.length - 1]
    if (last && last.title === (p.section_title ?? null)) last.rows.push(p)
    else
      out.push({
        title: p.section_title ?? null,
        unitBasis: p.unit_basis ?? null,
        rows: [p],
        blocks: [],
      })
  }
  for (const sec of out) sec.blocks = toClusterBlocks(sec.rows, clusters)
  return out
}

/**
 * SỐ THỨ TỰ hiện trên cột STT — KHÔNG tin `part_no` khi nó vô lý.
 *
 * Bộ nạp cũ đọc lệch cột ở khối vật tư: 137 dòng đang mang ĐƠN GIÁ trong ô STT
 * (Bulong M6×25 → 1760, Tem bảo hành → 2000, Gót chân Ø25 → 3200). Một khối BOM
 * không bao giờ dài tới đó, nên số nào vượt xa số dòng của khối là chắc chắn
 * không phải số thứ tự.
 *
 * Xét theo CẢ KHỐI chứ không từng dòng: lẫn lộn "1 · 2 · 1760" khó đọc hơn là
 * đánh lại toàn khối theo vị trí. Khối nào part_no lành lặn thì vẫn giữ nguyên
 * số của tờ giấy — người đối chiếu với bản in cần đúng số đó.
 */
function seqLabels(rows: PartView[]): (string | number)[] {
  const max = Math.max(...rows.map((r) => r.part_no ?? 0))
  const plausible = max <= rows.length + 20
  return rows.map((r, i) => (plausible ? (r.part_no ?? i + 1) : i + 1))
}

/** Cụm theo thứ tự danh mục, nhóm RỜI xuống cuối. */
function toClusterBlocks(rows: PartView[], clusters: ClusterView[]): ClusterBlock[] {
  const byCluster = new Map<string, PartView[]>()
  const loose: PartView[] = []
  for (const p of rows) {
    if (p.cluster_id)
      byCluster.set(p.cluster_id, [...(byCluster.get(p.cluster_id) ?? []), p])
    else loose.push(p)
  }
  const blocks: ClusterBlock[] = clusters
    .filter((c) => byCluster.has(c.id))
    .map((c) => {
      const r = byCluster.get(c.id)!
      return { cluster: c, rows: r, totals: sumRows(r) }
    })
  if (loose.length) blocks.push({ cluster: null, rows: loose, totals: sumRows(loose) })
  return blocks
}

/**
 * Dải tiêu đề của một CỤM — tick chọn cả cụm, tên cụm, số dòng, khối lượng, lộ
 * trình công đoạn và SL cụm/SP nếu đã khai. Nhóm **RỜI** cũng có dải riêng chứ
 * không im lặng trộn vào bảng: dòng không thuộc cụm nào là thứ dễ bị bỏ quên nhất.
 */
function ClusterHead({
  block,
  colSpan,
  canEdit,
  allPicked,
  onPickAll,
  renaming,
  onStartRename,
  onRename,
  onDrop,
}: {
  block: ClusterBlock
  colSpan: number
  canEdit: boolean
  allPicked: boolean
  onPickAll: (on: boolean) => void
  renaming: boolean
  onStartRename: (id: string | null) => void
  onRename: (c: ClusterView, name: string) => void
  onDrop: (c: ClusterView) => void
}) {
  const c = block.cluster
  const route = [c?.first_stage, c?.final_stage].filter(Boolean).join(' → ')
  return (
    <tr className={cn('border-b', c ? 'bg-accent/60' : 'bg-muted/20')}>
      <td colSpan={colSpan} className="px-1 py-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {canEdit && (
            <input
              type="checkbox"
              className="size-3.5"
              aria-label={c ? `Chọn cả cụm ${c.name}` : 'Chọn các dòng rời'}
              checked={allPicked}
              onChange={(e) => onPickAll(e.target.checked)}
            />
          )}
          {renaming && c ? (
            <input
              autoFocus
              defaultValue={c.name}
              aria-label="Tên cụm"
              onBlur={(e) => {
                onRename(c, e.target.value)
                onStartRename(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') onStartRename(null)
              }}
              className="border-input bg-background w-40 rounded border px-1.5 py-0.5 text-xs font-semibold focus:border-[var(--primary)] focus:outline-none"
            />
          ) : (
            <span
              className={cn(
                'text-xs font-semibold',
                !c && 'text-muted-foreground font-medium',
              )}
            >
              {c ? `⬢ ${c.name}` : '○ Rời (không thuộc cụm)'}
            </span>
          )}
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {block.rows.length} chi tiết
            {block.totals.kg > 0 && ` · ${block.totals.kg.toFixed(3)} kg`}
            {block.totals.m3 > 0 && ` · ${block.totals.m3.toFixed(4)} m³`}
          </span>
          {route && (
            <span className="bg-muted rounded px-1.5 py-px text-[10px] font-medium">
              {route}
            </span>
          )}
          {c?.qty_per_product != null && (
            <span className="bg-muted rounded px-1.5 py-px text-[10px] font-medium tabular-nums">
              {c.qty_per_product} cụm/SP
            </span>
          )}
          {canEdit && c && (
            <span className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => onStartRename(c.id)}
                className="text-muted-foreground text-[11px] hover:underline"
              >
                Đổi tên
              </button>
              <button
                type="button"
                onClick={() => onDrop(c)}
                className="text-muted-foreground text-[11px] hover:underline"
              >
                Bỏ cụm
              </button>
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

/**
 * Dòng tổng của một cụm — chỉ điền vào những cột thực sự cộng được.
 *
 * KHÔNG dùng cho khối vật tư/bao bì: ở đó mỗi dòng một đơn vị khác nhau (cái ·
 * m² · cuộn · gói), cộng số lượng lại ra một con số vô nghĩa.
 */
function ClusterTotalRow({
  block,
  cols,
  canEdit,
}: {
  block: ClusterBlock
  cols: PartColumn[]
  canEdit: boolean
}) {
  const t = block.totals
  const val = (key: string) =>
    key === 'qty'
      ? n(t.qty, 4)
      : key === 'len'
        ? t.len.toFixed(2)
        : key === 'kg'
          ? t.kg.toFixed(3)
          : key === 'm2'
            ? t.m2.toFixed(4)
            : key === 'm3'
              ? t.m3.toFixed(6)
              : ''
  return (
    <tr className="border-b text-xs font-medium">
      {canEdit && <td />}
      <td />
      <td className="text-muted-foreground py-1 pr-3">
        Σ {block.cluster?.name ?? 'Rời'}
      </td>
      {cols.map((c) => (
        <td
          key={c.key}
          className={cn('py-1 pr-3', c.align === 'right' && 'text-right tabular-nums')}
        >
          {val(c.key)}
        </td>
      ))}
      {canEdit && <td />}
    </tr>
  )
}

/**
 * Định mức chi tiết. Hai chế độ: xem (đủ 10 cột như biểu mẫu) và **nhập tại chỗ**
 * — bật lên thì ô trong bảng thành ô nhập, mỗi khối có một dòng trống ở cuối để
 * gõ thêm. Không phải mở hộp thoại nào.
 */
export function ProductPartsCard({
  parts,
  partGroups,
  clusters,
  productId,
  baseMaterial,
  canEdit,
}: {
  parts: PartView[]
  partGroups: PartGroupView[]
  clusters: ClusterView[]
  productId: string
  /** Ô "Nhiên Liệu" của sản phẩm — mặc định vật liệu cho khối mới. */
  baseMaterial: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  /**
   * Dòng đang sửa TẠI CHỖ. Trước đây bút chì mở hộp thoại 20 ô — nhịp "bấm →
   * chờ → cuộn tìm ô → Lưu → đóng → tìm lại dòng vừa sửa" quá dài cho một bảng
   * mà người ta sửa vài chục dòng liên tiếp. Nay bút chì biến ĐÚNG dòng đó
   * thành lưới nhập, còn nút "Nhập tại chỗ" vẫn bật cả bảng khi nhập hàng loạt.
   */
  const [editRow, setEditRow] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const [bulk, setBulk] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [inline, setInline] = useState(false)
  /** Dòng đang tick để gom cụm hàng loạt. */
  const [picked, setPicked] = useState<string[]>([])
  const [grouping, setGrouping] = useState(false)
  /** Tên cụm đang gõ ở thanh gom. */
  const [newCluster, setNewCluster] = useState('')
  /** Cụm đang đổi tên tại chỗ (id) — không dùng hộp thoại. */
  const [renaming, setRenaming] = useState<string | null>(null)
  /**
   * Khối đang tạo mới. Cần riêng vì dòng nhập nằm TRONG khối, mà khối lại suy từ
   * các dòng đã có — sản phẩm chưa có định mức thì không có chỗ nào để gõ.
   */
  const [newSec, setNewSec] = useState<{
    group: string
    title: string
    unitBasis: string
    cluster: string
    material: string
  } | null>(null)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? parts.filter((p) => haystack(p).includes(needle)) : parts
  }, [parts, q])

  const groups: Group[] = useMemo(() => {
    const byGroup = new Map<string, PartView[]>()
    for (const p of filtered)
      byGroup.set(p.group_code, [...(byGroup.get(p.group_code) ?? []), p])

    const order = [...partGroups].sort((a, b) => a.sort_order - b.sort_order)
    const codes = [
      ...order.filter((g) => byGroup.has(g.code)).map((g) => [g.code, g.label] as const),
      // Mã nhóm lạ (nhóm vừa bị ẩn khỏi danh mục) vẫn phải hiện, không nuốt dòng.
      ...[...byGroup.keys()]
        .filter((c) => !order.some((g) => g.code === c))
        .map((c) => [c, c] as const),
    ]

    return codes.map(([code, label]) => {
      const rows = byGroup.get(code)!
      return {
        code,
        label,
        rows,
        totals: sumRows(rows),
        sections: toSections(rows, clusters),
      }
    })
  }, [filtered, partGroups, clusters])

  /**
   * Bộ cột RIÊNG cho từng nhóm (xem `part-layouts.ts`): biểu mẫu BOM không có
   * bảng chung — khung kim loại tính kg, gỗ tính m³, ngũ kim không có kích thước.
   * Trong mỗi họ còn giấu tiếp cột mà cả nhóm không có số nào.
   *
   * Tính trên TOÀN BỘ dòng của nhóm (`parts`, không phải `filtered`) để cột
   * không nhảy khi đang gõ ô tìm. Phải đứng TRƯỚC lệnh return sớm (rules-of-hooks).
   */
  const colsByGroup = useMemo(() => {
    const byGroup = new Map<string, PartView[]>()
    for (const p of parts)
      byGroup.set(p.group_code, [...(byGroup.get(p.group_code) ?? []), p])
    return new Map(
      [...byGroup.entries()].map(([code, rows]) => [code, columnsFor(code, rows)]),
    )
  }, [parts])

  const [closed, setClosed] = useState<string[]>(() =>
    // SP nhiều dòng thì mặc định chỉ mở nhóm đầu, tránh đổ một bảng dài lê thê.
    parts.length > 40 ? partGroups.slice(1).map((g) => g.code) : [],
  )
  const isOpen = (g: string) => !closed.includes(g) || q.trim() !== '' || inline
  const toggle = (g: string) =>
    setClosed((c) => (c.includes(g) ? c.filter((x) => x !== g) : [...c, g]))

  async function duplicate(p: PartView) {
    setBusyId(p.id)
    try {
      await api(`/api/dept/technical/products/${productId}/parts`, {
        method: 'POST',
        body: {
          group_code: p.group_code,
          section_title: p.section_title,
          unit_basis: p.unit_basis,
          part_name: `${p.part_name} (bản sao)`,
          cluster_id: p.cluster_id,
          material_kind: p.material_kind,
          material_note: p.material_note,
          tenon: p.tenon,
          tenon_mm: p.tenon_mm,
          profile_shape: p.profile_shape,
          profile_code: p.profile_code,
          dim_a_mm: p.dim_a_mm,
          dim_b_mm: p.dim_b_mm,
          wall_thickness_mm: p.wall_thickness_mm,
          cut_length_mm: p.cut_length_mm,
          bend_waste_mm: p.bend_waste_mm,
          kg_per_m: p.kg_per_m,
          qty: p.qty,
          unit: p.unit,
          color: p.color,
          weight_kg: p.weight_kg,
          note: p.note,
        },
      })
      router.refresh()
      toast.success('Đã nhân bản dòng', p.part_name)
    } catch (err) {
      toast.error('Nhân bản thất bại', apiErrorText(err))
    } finally {
      setBusyId(null)
    }
  }

  /** Gán các dòng đang tick vào một cụm — tên mới thì server tự tạo cụm. */
  async function assignPicked(target: { cluster_id: string | null } | { name: string }) {
    setGrouping(true)
    try {
      const { moved } = await api<{ moved: number }>(
        `/api/dept/technical/products/${productId}/parts/assign-cluster`,
        {
          method: 'POST',
          body:
            'name' in target
              ? { part_ids: picked, cluster_name: target.name }
              : { part_ids: picked, cluster_id: target.cluster_id },
        },
      )
      setPicked([])
      setNewCluster('')
      router.refresh()
      toast.success(
        'name' in target
          ? `Đã gom ${moved} dòng vào “${target.name}”`
          : `Đã chuyển ${moved} dòng`,
      )
    } catch (err) {
      toast.error('Gom cụm thất bại', apiErrorText(err))
    } finally {
      setGrouping(false)
    }
  }

  /** Đổi tên cụm — sửa một chỗ, mọi dòng của cụm theo, không drift. */
  async function renameCluster(c: ClusterView, name: string) {
    if (!name.trim() || name.trim() === c.name) return
    try {
      await api(`/api/dept/technical/products/${productId}/clusters/${c.id}`, {
        method: 'PATCH',
        body: { name: name.trim() },
      })
      router.refresh()
      toast.success('Đã đổi tên cụm', name.trim())
    } catch (err) {
      toast.error('Đổi tên thất bại', apiErrorText(err))
    }
  }

  async function dropCluster(c: ClusterView) {
    const ok = await confirm({
      title: `Bỏ cụm “${c.name}”?`,
      description: `Cụm biến mất khỏi bảng, nhưng ${
        parts.filter((p) => p.cluster_id === c.id).length
      } dòng chi tiết của nó KHÔNG bị xoá — chúng chuyển sang nhóm “Rời”.`,
      confirmLabel: 'Bỏ cụm',
    })
    if (!ok) return
    try {
      await api(`/api/dept/technical/products/${productId}/clusters/${c.id}`, {
        method: 'DELETE',
      })
      router.refresh()
      toast.success('Đã bỏ cụm', `Dòng của “${c.name}” về nhóm Rời`)
    } catch (err) {
      toast.error('Bỏ cụm thất bại', apiErrorText(err))
    }
  }

  if (parts.length === 0 && !canEdit) return null

  const totalKg = sumKg(parts)
  const firstGroup = partGroups[0]?.code ?? 'FRAME'
  const hasQuery = q.trim() !== ''
  const confirmed = parts.filter((p) => p.blank_confirmed_at).length
  /** Số cột của dải tiêu đề khối — STT + Chi tiết + cột riêng của nhóm + ô nút. */
  const colSpanOf = (groupCode: string) =>
    inline
      ? inlineColSpan(groupCode)
      : (canEdit ? 1 : 0) +
        2 +
        (colsByGroup.get(groupCode)?.length ?? 0) +
        (canEdit ? 1 : 0)

  /**
   * Mở khối mới với tiêu đề + vật liệu ĐIỀN SẴN: tiêu đề lấy đúng chữ của biểu
   * mẫu theo nhóm, vật liệu lấy ô "Nhiên Liệu" của sản phẩm. Dựng định mức mới
   * đáng ra chỉ cần chọn nhóm rồi gõ ngay, không phải khai 5 ô trước đã.
   */
  const openNewSection = (group = firstGroup) =>
    setNewSec({
      group,
      title: defaultSectionTitle(group),
      unitBasis: '',
      cluster: '',
      material: baseMaterial ?? '',
    })

  /** Đổi nhóm thì tiêu đề mặc định đổi theo — trừ khi người dùng đã tự sửa. */
  const changeNewGroup = (group: string) =>
    setNewSec((s) =>
      s === null
        ? s
        : {
            ...s,
            group,
            title:
              s.title === '' || s.title === defaultSectionTitle(s.group)
                ? defaultSectionTitle(group)
                : s.title,
          },
    )

  const headInp =
    'border-input bg-background focus:border-[var(--primary)] rounded border px-2 py-1 text-xs focus:outline-none'

  /** Khối mới: khai tiêu đề rồi gõ dòng ngay bên dưới. */
  const newSectionBlock = newSec && (
    <div className="bg-accent/50 mt-3 rounded-md border border-[var(--primary)]/30 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold">Khối mới</span>
        <select
          value={newSec.group}
          onChange={(e) => changeNewGroup(e.target.value)}
          className={headInp}
          aria-label="Nhóm hạng mục"
        >
          {partGroups.map((g) => (
            <option key={g.code} value={g.code}>
              {g.label}
            </option>
          ))}
        </select>
        <input
          value={newSec.title}
          onChange={(e) => setNewSec({ ...newSec, title: e.target.value })}
          className={`${headInp} w-56`}
          placeholder="Tiêu đề khối, vd: Quy cách :"
          aria-label="Tiêu đề khối"
        />
        {/* Vật liệu khung (nhôm/sắt/inox) chỉ có nghĩa với khối KHUNG — nó là
            thứ dùng để suy khối lượng. Bao bì, tem, ngũ kim không dùng bao giờ,
            bày ra chỉ khiến người tạo khối phân vân phải điền gì. */}
        {layoutOf(newSec.group) === 'metal' && (
          <select
            value={newSec.material}
            onChange={(e) => setNewSec({ ...newSec, material: e.target.value })}
            className={headInp}
            aria-label="Vật liệu"
          >
            <option value="">Vật liệu —</option>
            <option value="AL">Nhôm</option>
            <option value="IR">Sắt</option>
            <option value="IN">Inox</option>
            <option value="WD">Gỗ</option>
            <option value="RA">Mây / nhựa đan</option>
            <option value="GL">Kính</option>
          </select>
        )}
        {/* Cụm của cả khối mới — gõ tên có sẵn thì gán vào cụm đó, tên mới thì
            server tạo cụm. Bỏ trống = các dòng thuộc nhóm Rời. Biểu mẫu ngũ kim
            / bao bì KHÔNG có cột cụm nên khối đó cũng không hỏi. */}
        {layoutOf(newSec.group) !== 'supply' && (
          <input
            value={newSec.cluster}
            onChange={(e) => setNewSec({ ...newSec, cluster: e.target.value })}
            className={`${headInp} w-32`}
            placeholder="Cụm (Bộ phận)"
            aria-label="Cụm"
            list="cluster-names"
          />
        )}
        <input
          value={newSec.unitBasis}
          onChange={(e) => setNewSec({ ...newSec, unitBasis: e.target.value })}
          className={`${headInp} w-32`}
          placeholder="ĐV tính của khối"
          aria-label="Đơn vị tính của khối"
        />
        <button
          type="button"
          onClick={() => setNewSec(null)}
          className="text-muted-foreground ml-auto text-xs hover:underline"
        >
          Đóng khối
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {/* Ô nhập đổi theo nhóm hạng mục vừa chọn ở trên: chọn "Bao bì" thì
                6 ô kích thước biến mất, hiện ra ô Vật liệu + Màu. */}
            <InlineHead groupCode={newSec.group} />
          </thead>
          <tbody>
            <PartRowNew
              productId={productId}
              groupCode={newSec.group}
              sectionTitle={newSec.title.trim() || null}
              unitBasis={newSec.unitBasis.trim() || null}
              clusterName={newSec.cluster.trim() || null}
              materialKind={newSec.material || null}
            />
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Gõ tên chi tiết và số lượng rồi Enter — dòng được thêm vào khối này, con trỏ về ô
        tên để gõ tiếp.
      </p>
    </div>
  )

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-5 pt-4 pb-3">
        <Layers className="text-muted-foreground size-4 shrink-0" />
        <h2 className="text-sm font-semibold">Định mức chi tiết</h2>
        <span className="text-muted-foreground text-xs">
          · {hasQuery ? `${filtered.length}/${parts.length}` : parts.length} chi tiết
          {clusters.length > 0 && ` · ${clusters.length} cụm`}
          {totalKg > 0 && ` · ${totalKg.toFixed(2)} kg`}
          {confirmed > 0 && ` · ${confirmed}/${parts.length} ✓phôi`}
        </span>
        {/* Gợi ý tên cụm cho mọi ô nhập cụm trong thẻ này. */}
        <datalist id="cluster-names">
          {clusters.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <div className="ml-auto flex items-center gap-2">
          {parts.length > 8 && !inline && (
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm chi tiết, quy cách, mã…"
                className="border-input bg-background w-44 rounded-md border py-1 pr-2 pl-7 text-xs focus:border-[var(--primary)] focus:outline-none sm:w-56"
              />
            </div>
          )}
          {canEdit && (
            <>
              {/* BA LỐI NẠP GOM VÀO MỘT MENU. Trước đây là ba link chữ 12px xếp
                  cạnh nút "Gõ nhiều dòng" — bốn thứ trông y hệt nhau, trong khi
                  ba cái đầu là "đổ dữ liệu vào từ ngoài" (mở hộp thoại, làm một
                  lần) còn cái thứ tư đổi CHẾ ĐỘ của bảng đang xem. Gom lại thì
                  còn đúng hai nút, mỗi nút một việc. */}
              <RowMenu
                trigger={
                  <span className="inline-flex items-center gap-1">
                    <Upload className="size-3.5" />
                    Nạp định mức
                  </span>
                }
                ariaLabel="Nạp định mức"
                triggerClassName="border-input hover:bg-accent inline-flex shrink-0 items-center rounded-md border px-2 py-1 text-xs font-medium"
                items={[
                  {
                    label: 'Nhập bằng AI (đọc file BOM)',
                    onClick: () => setAiOpen(true),
                  },
                  { label: 'Dán từ Excel', onClick: () => setBulk(true) },
                  { label: 'Chép từ SP khác', onClick: () => setCopying(true) },
                ]}
              />
              <button
                type="button"
                onClick={() => {
                  setInline((v) => !v)
                  setQ('')
                }}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium',
                  inline
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'border-input hover:bg-accent text-muted-foreground',
                )}
              >
                {/* Hai lối sửa cùng tồn tại nên nhãn phải nói rõ việc của từng
                    cái: bút chì = sửa MỘT dòng (thẻ chia vùng), nút này = gõ
                    NHIỀU dòng liên tục (lưới ngang kiểu bảng tính). */}
                <Pencil className="size-3.5" />
                {inline ? 'Xong' : 'Gõ nhiều dòng'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Thanh gom cụm — chỉ nổi lên khi đã tick dòng, để bảng lúc bình thường
          không cõng thêm một hàng nút. */}
      {canEdit && picked.length > 0 && (
        <div className="bg-accent flex flex-wrap items-center gap-2 border-y px-5 py-2 text-xs">
          <span className="font-medium">Đã chọn {picked.length} dòng</span>
          <input
            value={newCluster}
            onChange={(e) => setNewCluster(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCluster.trim()) {
                e.preventDefault()
                void assignPicked({ name: newCluster.trim() })
              }
            }}
            placeholder="Tên cụm, vd: Cụm khung"
            aria-label="Tên cụm mới"
            list="cluster-names"
            className="border-input bg-background w-44 rounded border px-2 py-1 focus:border-[var(--primary)] focus:outline-none"
          />
          <button
            type="button"
            disabled={grouping || !newCluster.trim()}
            onClick={() => void assignPicked({ name: newCluster.trim() })}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-2.5 py-1 font-medium disabled:opacity-50"
          >
            Gom thành cụm
          </button>
          {clusters.length > 0 && (
            <select
              disabled={grouping}
              value=""
              onChange={(e) => {
                if (e.target.value) void assignPicked({ cluster_id: e.target.value })
              }}
              className="border-input bg-background rounded border px-2 py-1"
              aria-label="Chuyển sang cụm có sẵn"
            >
              <option value="">Chuyển sang cụm…</option>
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={grouping}
            onClick={() => void assignPicked({ cluster_id: null })}
            className="text-muted-foreground hover:underline disabled:opacity-50"
          >
            Đưa về Rời
          </button>
          <button
            type="button"
            onClick={() => setPicked([])}
            className="text-muted-foreground ml-auto hover:underline"
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {inline && (
        <p className="text-muted-foreground bg-accent/50 border-y px-5 py-2 text-xs">
          Sửa thẳng trong ô, rời khỏi dòng hoặc bấm Enter là lưu. Dòng trống cuối mỗi khối
          để gõ thêm — Enter xong con trỏ tự về ô tên để nhập tiếp. Khối lượng, tổng dài
          và diện tích sơn tự tính.
        </p>
      )}
      {!inline && <Separator />}

      {filtered.length === 0 ? (
        <div className="px-5 py-4">
          {hasQuery ? (
            <p className="text-muted-foreground text-center text-sm">
              Không có dòng nào khớp “{q.trim()}”.
            </p>
          ) : (
            !newSec && (
              /**
               * SP chưa có định mức. Trước đây chỗ này chỉ là một dòng chữ + nút
               * "Tạo khối đầu tiên" — người dùng phải đoán "khối" là gì. Nay bày
               * thẳng các khối của biểu mẫu: bấm một cái là vào gõ ngay, tiêu đề
               * khối và vật liệu đã điền sẵn.
               */
              <div className="mx-auto max-w-lg py-2 text-center">
                <p className="text-sm font-medium">Chưa có định mức</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Chọn một khối để bắt đầu gõ — hoặc dán cả bảng từ file BOM.
                </p>
                {canEdit && (
                  <>
                    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                      {partGroups
                        .filter((gr) => !gr.parent_code)
                        .map((gr) => (
                          <button
                            key={gr.code}
                            type="button"
                            onClick={() => {
                              setInline(true)
                              openNewSection(gr.code)
                            }}
                            className="hover:border-primary hover:text-primary rounded-md border px-2.5 py-1 text-xs font-medium"
                          >
                            + {gr.label}
                          </button>
                        ))}
                    </div>
                    <div className="text-muted-foreground mt-3 text-xs">
                      hoặc{' '}
                      <button
                        type="button"
                        onClick={() => setBulk(true)}
                        className="text-primary font-medium hover:underline"
                      >
                        dán từ Excel
                      </button>{' '}
                      ·{' '}
                      <button
                        type="button"
                        onClick={() => setCopying(true)}
                        className="text-primary font-medium hover:underline"
                      >
                        chép từ SP khác
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          )}
          {newSec && newSectionBlock}
        </div>
      ) : (
        <div className="divide-y">
          {groups.map((g) => {
            const open = isOpen(g.code)
            return (
              <div key={g.code}>
                <button
                  type="button"
                  onClick={() => toggle(g.code)}
                  className="hover:bg-muted/50 flex w-full items-center gap-2 px-5 py-2.5 text-left"
                >
                  <ChevronRight
                    className={cn(
                      'text-muted-foreground size-4 shrink-0 transition-transform',
                      open && 'rotate-90',
                    )}
                  />
                  <span className="text-sm font-medium">{g.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {g.rows.length} dòng
                  </span>
                  {g.totals.kg > 0 && (
                    <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                      {g.totals.kg.toFixed(2)} kg
                    </span>
                  )}
                </button>

                {open && (
                  <div className="px-5 pb-3">
                    {
                      <div>
                        <div className="overflow-x-auto">
                          {/* Chế độ NHẬP phải `w-max`, chế độ XEM thì `w-full`.
                              Lưới nhập của khối khung có 20 cột: để `w-full` thì
                              bảng auto-layout nén cho vừa bề ngang và bóp mọi ô
                              xuống 24–60px bất kể `w-*` khai trong part-layouts
                              (đo thật: ô "Tên chi tiết" khai `w-48` = 192px, ra
                              còn 69px) — gõ vào ô rộng 24px là không gõ được.
                              `w-max` cho bảng nở đúng nhu cầu rồi để khung ngoài
                              cuộn ngang; `min-w-full` giữ bảng vẫn phủ hết bề
                              ngang khi ít cột. Chế độ xem KHÔNG dùng `w-max` vì
                              tiêu đề xuống dòng được, ép ra một dòng chỉ tổ đẻ
                              thanh cuộn ở màn rộng. */}
                          <table
                            className={cn(
                              'text-sm',
                              inline ? 'w-max min-w-full' : 'w-full',
                            )}
                          >
                            <thead>
                              {inline ? (
                                // Ô nhập theo ĐÚNG họ khối — ngũ kim không có ô
                                // kích thước nào, gỗ/nệm có ô Mộng. Xem
                                // `part-layouts.ts`.
                                <InlineHead groupCode={g.code} />
                              ) : (
                                <tr className="text-muted-foreground border-b text-left text-[11px] uppercase">
                                  {canEdit && (
                                    <th className={cn('w-7 py-1.5', FREEZE.pick)} />
                                  )}
                                  <th
                                    className={cn(
                                      'w-8 py-1.5 pr-2 text-right font-medium',
                                      canEdit ? FREEZE.noWithPick : FREEZE.no,
                                    )}
                                  >
                                    STT
                                  </th>
                                  {/* "TÊN HÀNG HÓA" cho khối vật tư/ngũ kim,
                                      "Tên chi tiết" cho khối gia công — đúng
                                      chữ dùng trong biểu mẫu BOM gốc. */}
                                  <th
                                    className={cn(
                                      'py-1.5 pr-3 font-medium',
                                      canEdit ? FREEZE.nameWithPick : FREEZE.name,
                                    )}
                                  >
                                    {layoutOf(g.code) === 'supply'
                                      ? 'Tên hàng hoá'
                                      : 'Tên chi tiết'}
                                  </th>
                                  {(colsByGroup.get(g.code) ?? []).map((c) => (
                                    <th
                                      key={c.key}
                                      className={cn(
                                        'py-1.5 pr-3 font-medium',
                                        c.align === 'right' && 'text-right',
                                      )}
                                    >
                                      {c.label}
                                    </th>
                                  ))}
                                  {canEdit && <th className="w-14 py-1.5" />}
                                </tr>
                              )}
                            </thead>
                            <tbody>
                              {g.sections.map((sec, sx) => (
                                <Fragment key={`${sec.title ?? ''}-${sx}`}>
                                  {sec.title && (
                                    <tr className="bg-muted/40">
                                      <td
                                        colSpan={colSpanOf(g.code)}
                                        className="px-1 py-1.5"
                                      >
                                        <span className="text-xs font-semibold">
                                          {sec.title}
                                        </span>
                                        {sec.unitBasis && (
                                          <span className="ml-2 rounded bg-[var(--warn)]/10 px-1.5 py-px text-[10px] font-medium text-[var(--warn)]">
                                            định mức tính cho {sec.unitBasis}, không phải
                                            1 sản phẩm
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  )}

                                  {sec.blocks.map((blk) => (
                                    <Fragment key={blk.cluster?.id ?? '__loose'}>
                                      <ClusterHead
                                        block={blk}
                                        colSpan={colSpanOf(g.code)}
                                        canEdit={canEdit}
                                        allPicked={blk.rows.every((r) =>
                                          picked.includes(r.id),
                                        )}
                                        onPickAll={(on) =>
                                          setPicked((cur) => {
                                            const ids = blk.rows.map((r) => r.id)
                                            return on
                                              ? [...new Set([...cur, ...ids])]
                                              : cur.filter((x) => !ids.includes(x))
                                          })
                                        }
                                        renaming={renaming === blk.cluster?.id}
                                        onStartRename={setRenaming}
                                        onRename={renameCluster}
                                        onDrop={dropCluster}
                                      />

                                      {seqLabels(blk.rows).map((seq, pi) => {
                                        const p = blk.rows[pi]
                                        return inline ? (
                                          <PartRowInline
                                            key={p.id}
                                            productId={productId}
                                            part={p}
                                            groupCode={g.code}
                                            clusterName={blk.cluster?.name ?? null}
                                            onDeleted={() => {
                                              setBusyId(null)
                                              setEditRow(null)
                                            }}
                                          />
                                        ) : editRow === p.id ? (
                                          // Thẻ chia vùng bung NGAY DƯỚI vị trí dòng,
                                          // chiếm trọn bề ngang bảng — không đè lên
                                          // các dòng khác, vẫn đối chiếu được trên dưới.
                                          <tr
                                            key={p.id}
                                            className="border-b last:border-0"
                                          >
                                            <td
                                              colSpan={inlineColSpan(g.code)}
                                              className="p-2"
                                            >
                                              <PartCardEdit
                                                productId={productId}
                                                part={p}
                                                groupCode={g.code}
                                                clusterName={blk.cluster?.name ?? null}
                                                onClose={() => setEditRow(null)}
                                              />
                                            </td>
                                          </tr>
                                        ) : (
                                          <tr
                                            key={p.id}
                                            className={cn(
                                              'group border-b last:border-0',
                                              canEdit && 'hover:bg-muted/40',
                                              busyId === p.id && 'opacity-50',
                                            )}
                                          >
                                            {canEdit && (
                                              <td className={cn('py-1.5', FREEZE.pick)}>
                                                <input
                                                  type="checkbox"
                                                  className="size-3.5 align-middle"
                                                  aria-label={`Chọn ${p.part_name}`}
                                                  checked={picked.includes(p.id)}
                                                  onChange={(e) =>
                                                    setPicked((cur) =>
                                                      e.target.checked
                                                        ? [...cur, p.id]
                                                        : cur.filter((x) => x !== p.id),
                                                    )
                                                  }
                                                />
                                              </td>
                                            )}
                                            {/* Dòng nạp từ nguồn cũ không có part_no —
                                            đánh số theo vị trí, không để cột trống */}
                                            <td
                                              className={cn(
                                                'text-muted-foreground py-1.5 pr-2 text-right text-xs tabular-nums',
                                                canEdit ? FREEZE.noWithPick : FREEZE.no,
                                              )}
                                            >
                                              {seq}
                                            </td>
                                            <td
                                              className={cn(
                                                'py-1.5 pr-3',
                                                canEdit
                                                  ? FREEZE.nameWithPick
                                                  : FREEZE.name,
                                              )}
                                            >
                                              {nameOf(p, layoutOf(g.code))}
                                            </td>
                                            {(colsByGroup.get(g.code) ?? []).map((c) => (
                                              <td
                                                key={c.key}
                                                className={cn(
                                                  'py-1.5 pr-3',
                                                  c.align === 'right' &&
                                                    'text-right tabular-nums',
                                                  c.key !== 'qty' &&
                                                    'text-muted-foreground',
                                                  (c.key === 'spec' ||
                                                    c.key === 'dims' ||
                                                    c.key === 'note' ||
                                                    c.key === 'mat') &&
                                                    'text-xs',
                                                  c.key === 'note' && 'max-w-40 truncate',
                                                )}
                                                title={
                                                  c.key === 'spec' &&
                                                  specOf(p) &&
                                                  p.material_note
                                                    ? p.material_note
                                                    : c.key === 'note'
                                                      ? (p.note ?? undefined)
                                                      : undefined
                                                }
                                              >
                                                {cellOf(p, c.key)}
                                              </td>
                                            ))}
                                            {canEdit && (
                                              <td className="py-1.5">
                                                {/* Hiện khi rê chuột / focus bàn phím */}
                                                <div className="flex justify-end gap-0.5 opacity-100 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 sm:opacity-0">
                                                  <button
                                                    type="button"
                                                    title="Nhân bản dòng"
                                                    disabled={busyId === p.id}
                                                    onClick={() => void duplicate(p)}
                                                    className="hover:bg-muted rounded p-1 disabled:opacity-40"
                                                  >
                                                    <Copy className="text-muted-foreground size-3.5" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    title="Sửa ngay trên dòng"
                                                    onClick={(e) => {
                                                      // Thẻ nằm trong bảng cuộn
                                                      // ngang; đang kéo sang phải mà
                                                      // mở thẻ thì nửa trái thẻ nằm
                                                      // ngoài màn. Kéo bảng về đầu.
                                                      e.currentTarget
                                                        .closest('.overflow-x-auto')
                                                        ?.scrollTo({ left: 0 })
                                                      setEditRow(p.id)
                                                    }}
                                                    className="hover:bg-muted rounded p-1"
                                                  >
                                                    <Pencil className="text-muted-foreground size-3.5" />
                                                  </button>
                                                </div>
                                              </td>
                                            )}
                                          </tr>
                                        )
                                      })}

                                      {/* Tổng của cụm — luôn TÍNH, không nhập.
                                          Dòng "Tổng cộng" của file Excel bỏ sót
                                          2 dòng vì dải SUM chưa nới. */}
                                      {!inline &&
                                        blk.rows.length > 1 &&
                                        layoutOf(g.code) !== 'supply' && (
                                          <ClusterTotalRow
                                            block={blk}
                                            cols={colsByGroup.get(g.code) ?? []}
                                            canEdit={canEdit}
                                          />
                                        )}

                                      {/* Dòng trống cuối CỤM — vòng "tạo trực tiếp",
                                          gõ xong là dòng mới vào đúng cụm đó. */}
                                      {inline && (
                                        <PartRowNew
                                          productId={productId}
                                          groupCode={g.code}
                                          sectionTitle={sec.title}
                                          unitBasis={sec.unitBasis}
                                          clusterName={blk.cluster?.name ?? null}
                                          materialKind={
                                            blk.rows[0]?.material_kind ?? null
                                          }
                                        />
                                      )}
                                    </Fragment>
                                  ))}
                                </Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    }

                    {canEdit && !hasQuery && !inline && (
                      <button
                        type="button"
                        onClick={() =>
                          setNewSec({
                            group: g.code,
                            title: defaultSectionTitle(g.code),
                            unitBasis: '',
                            cluster: '',
                            material: baseMaterial ?? '',
                          })
                        }
                        className="text-primary mt-2 text-xs font-medium hover:underline"
                      >
                        + Thêm dòng vào “{g.label}”
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Thêm KHỐI mới vào định mức đã có — dòng nhập chỉ nằm trong khối. */}
          {inline && !hasQuery && (
            <div className="px-5 py-3">
              {newSec ? (
                newSectionBlock
              ) : (
                <button
                  type="button"
                  onClick={() => openNewSection()}
                  className="text-primary text-xs font-medium hover:underline"
                >
                  + Khối mới
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {bulk && (
        <PartsBulkEntry
          productId={productId}
          groups={partGroups}
          defaultGroup={firstGroup}
          onClose={() => setBulk(false)}
        />
      )}

      {aiOpen && (
        <BomAiImport
          productId={productId}
          groups={partGroups}
          onClose={() => setAiOpen(false)}
        />
      )}

      {copying && (
        <PartsCopyDialog
          productId={productId}
          hasParts={parts.length > 0}
          onClose={() => setCopying(false)}
        />
      )}
    </Card>
  )
}
