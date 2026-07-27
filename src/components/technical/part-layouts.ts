import type { PartView } from '@/components/technical/ProductProfileCards'

/**
 * BỘ CỘT THEO TỪNG HỌ KHỐI — dựng từ khảo sát 246 file BOM gốc (27/07/2026).
 *
 * Biểu mẫu BOM KHÔNG có một bảng chung: mỗi khối là một bảng riêng, cột và ĐƠN VỊ
 * khác nhau. Ép tất cả vào một bảng 10 cột như trước vừa sai đơn vị (gỗ tính m³
 * lại hiện cột kg), vừa đẻ ra hàng loạt cột rỗng (ngũ kim không có kích thước
 * nào). Bốn họ tìm được, kèm số lần xuất hiện:
 *
 *  metal  ×930  Stt · Tên chi tiết · Loại · Dày/Rộng/Dài · Phí hao uốn · SL ·
 *               Tổng chiều dài (m) · Trọng lượng (kg) · Diện tích sơn (M²) · δ
 *  wood   ×646  Stt · Tên chi tiết · Dày/Rộng/Dài/MỘNG · SL · Diện Tích (m2) ·
 *               K. Lượng (m3)              ← KHÔNG có cột "Loại", KHÔNG có kg
 *  soft    ×88  như wood nhưng bỏ m³ (nệm, vải chỉ tính diện tích)
 *  supply ×383  STT · TÊN HÀNG HÓA · ĐVT · SL/SP · Vật Liệu · ĐGIÁ · TT
 *                                          ← KHÔNG có kích thước nào
 *  paint  ×506  STT · Mã hàng · Màu sơn · ĐVT · Định mức · Đơn giá · TT · NCC
 *
 * `paint` hiện dùng chung layout `supply` vì hai cột riêng của nó (Màu sơn, NCC)
 * chưa có chỗ trong bảng — chờ 0097 thêm `color`/`supplier_note`.
 */
export type LayoutKey = 'metal' | 'wood' | 'soft' | 'supply'

/**
 * `material_note` là CHUỖI GHÉP `"<quy cách> · <vật liệu>"` do đợt nạp fs_bom nối
 * lại (web cũ tách tên chi tiết và quy cách thành hai cột riêng). Hiển thị nguyên
 * chuỗi gây hai lỗi ngược nhau:
 *
 *  · Khối VẬT TƯ: tên thật là "Vít bắn gỗ M4x25" nhưng cột tên chỉ còn "Vít" —
 *    một sản phẩm có 3 dòng cùng tên "Nút", 2 dòng "Đế", không phân biệt nổi.
 *  · Khối KHUNG: "Hộp 40x40x850mm" lặp lại đúng thứ đã nằm ở các cột quy cách.
 *
 * Tách ra: đoạn CUỐI là vật liệu (Nhôm · Gỗ keo · Ngũ kim · Bao bì…), phần còn
 * lại là quy cách. Dòng chỉ có một đoạn: có chữ số thì là quy cách, không thì là
 * vật liệu (855 dòng dạng ghép, 408 dòng một đoạn — hầu hết là vật liệu thuần).
 */
export function splitNote(note: string | null): {
  spec: string | null
  material: string | null
} {
  const t = (note ?? '').trim()
  if (!t) return { spec: null, material: null }
  const parts = t
    .split(' · ')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length >= 2)
    return { spec: parts.slice(0, -1).join(' · '), material: parts[parts.length - 1] }
  return /\d/.test(parts[0])
    ? { spec: parts[0], material: null }
    : { spec: null, material: parts[0] }
}

/** Cột có thể hiện — khớp tên và đơn vị với biểu mẫu BOM gốc. */
export type PartColumn = {
  key: string
  /** Nhãn cột, ĐÚNG như file BOM (kể cả đơn vị trong ngoặc). */
  label: string
  align?: 'right'
  /** Có số/chữ để hiện không — dùng để giấu cột rỗng của riêng nhóm đó. */
  has: (p: PartView) => boolean
}

const COL = {
  spec: {
    key: 'spec',
    label: 'Quy cách',
    has: (p) => !!(p.profile_shape || p.profile_code || p.dim_a_mm != null),
  },
  dims: {
    key: 'dims',
    label: 'Dày × Rộng (mm)',
    has: (p) => p.dim_a_mm != null || p.dim_b_mm != null,
  },
  tenon: { key: 'tenon', label: 'Mộng', has: (p) => !!p.tenon },
  cut: {
    key: 'cut',
    label: 'Dài cắt (mm)',
    align: 'right',
    has: (p) => p.cut_length_mm != null,
  },
  // Biểu mẫu ghi phi hao bằng MILIMET cộng thẳng vào chiều dài cắt, không phải
  // phần trăm (0097 đổi `waste_pct` → `bend_waste_mm`).
  waste: {
    key: 'waste',
    label: 'Phi hao uốn (mm)',
    align: 'right',
    has: (p) => p.bend_waste_mm != null && p.bend_waste_mm > 0,
  },
  tenonMm: {
    key: 'tenonMm',
    label: 'Mộng (mm)',
    align: 'right',
    has: (p) => p.tenon_mm != null,
  },
  color: { key: 'color', label: 'Màu', has: (p) => !!p.color },
  /** "Xác nhận Phôi" — cột của xưởng, luôn hiện ở khối khung dù chưa ai tick. */
  blank: { key: 'blank', label: '✓ Phôi', align: 'right', has: () => true },
  qty: { key: 'qty', label: 'Số lượng', align: 'right', has: () => true },
  len: {
    key: 'len',
    label: 'Tổng chiều dài (m)',
    align: 'right',
    has: (p) => p.total_length_m != null,
  },
  kg: {
    key: 'kg',
    label: 'Trọng lượng (kg)',
    align: 'right',
    has: (p) => p.weight_kg != null,
  },
  m2: {
    key: 'm2',
    label: 'Diện tích (m²)',
    align: 'right',
    has: (p) => p.paint_area_m2 != null,
  },
  paintM2: {
    key: 'm2',
    label: 'Diện tích sơn (M²)',
    align: 'right',
    has: (p) => p.paint_area_m2 != null,
  },
  m3: {
    key: 'm3',
    label: 'K. Lượng (m³)',
    align: 'right',
    has: (p) => p.volume_m3 != null,
  },
  wall: {
    key: 'wall',
    label: 'Dày vật liệu (δ)',
    align: 'right',
    has: (p) => p.wall_thickness_mm != null,
  },
  unit: { key: 'unit', label: 'ĐVT', has: (p) => !!p.unit },
  mat: {
    key: 'mat',
    label: 'Vật liệu',
    has: (p) => !!splitNote(p.material_note).material,
  },
  code: { key: 'code', label: 'Mã vật tư', has: (p) => !!p.material_code },
  note: { key: 'note', label: 'Ghi chú', has: (p) => !!p.note },
} satisfies Record<string, PartColumn>

/** Thứ tự cột của từng họ — giữ đúng trình tự đọc của biểu mẫu gốc. */
const LAYOUTS: Record<LayoutKey, PartColumn[]> = {
  metal: [
    COL.spec,
    COL.mat,
    COL.cut,
    COL.waste,
    COL.qty,
    COL.unit,
    COL.len,
    COL.kg,
    COL.paintM2,
    COL.wall,
    COL.color,
    COL.code,
    COL.note,
    COL.blank,
  ],
  wood: [
    COL.dims,
    COL.mat,
    COL.tenonMm,
    COL.tenon,
    COL.cut,
    COL.qty,
    COL.unit,
    COL.m2,
    COL.m3,
    COL.code,
    COL.note,
  ],
  soft: [
    COL.dims,
    COL.mat,
    COL.tenonMm,
    COL.cut,
    COL.qty,
    COL.unit,
    COL.m2,
    COL.m3,
    COL.code,
    COL.note,
  ],
  // Khối ngũ kim / bao bì: KHÔNG có cột tiền nữa (0097 — định mức trả lời "cần
  // bao nhiêu", giá thuộc bảng giá NCC bên Cung ứng).
  supply: [COL.qty, COL.unit, COL.mat, COL.color, COL.code, COL.note],
}

/**
 * Nhóm hạng mục → họ khối. Dựa trên mã nhóm của 0093/0094; mã lạ rơi về `supply`
 * (bộ cột hẹp nhất, không bịa kích thước cho thứ không có).
 */
export function layoutOf(groupCode: string): LayoutKey {
  const g = groupCode.toUpperCase()
  if (g === 'FRAME') return 'metal'
  if (g === 'WOOD') return 'wood'
  if (g === 'CUSHION') return 'soft'
  return 'supply'
}

/** Cột thật sự hiện: theo họ khối, bỏ cột mà CẢ NHÓM không có giá trị nào. */
export function columnsFor(groupCode: string, rows: PartView[]): PartColumn[] {
  return LAYOUTS[layoutOf(groupCode)].filter((c) => rows.some((r) => c.has(r)))
}

/* ────────────────────────────────────────────────────────────────────────────
 * Ô NHẬP — cùng một nguồn định nghĩa với cột hiển thị ở trên.
 *
 * Trước đây lưới "Nhập tại chỗ" dùng CHUNG một bộ ô cho mọi khối, nên nhập ngũ
 * kim vẫn phải nhìn 6 ô hình học (Dạng · Dày A · Rộng B · δ · Dài cắt · Phi hao)
 * mà khối đó không có ô nào, đồng thời THIẾU hai ô nó thật sự cần (Vật liệu,
 * Màu); khối gỗ/nệm thì thiếu ô Mộng. Cùng một lỗi mà `LAYOUTS` đã chữa cho chế
 * độ xem — nay chữa nốt cho chế độ nhập.
 * ─────────────────────────────────────────────────────────────────────────── */

/** Tên trường trong bản nháp của một dòng đang nhập. */
export type InputKey =
  | 'part_no'
  | 'cluster_name'
  | 'part_name'
  | 'profile_shape'
  | 'dim_a_mm'
  | 'dim_b_mm'
  | 'wall_thickness_mm'
  | 'cut_length_mm'
  | 'bend_waste_mm'
  | 'tenon_mm'
  | 'qty'
  | 'unit'
  | 'material_note'
  | 'color'
  | 'note'

export type InputCell = {
  key: InputKey
  label: string
  /** `num` canh phải + bàn phím số; `shape` là select; `cluster` là combobox. */
  kind: 'text' | 'num' | 'shape' | 'cluster'
  /** Lớp bề rộng cột — giữ bảng không nhảy khi gõ. */
  w: string
  placeholder?: string
}

const CELL = {
  no: { key: 'part_no', label: 'STT', kind: 'num', w: 'w-10' },
  cluster: {
    key: 'cluster_name',
    label: 'Cụm',
    kind: 'cluster',
    w: 'w-28',
    placeholder: 'Cụm khung…',
  },
  name: { key: 'part_name', label: 'Tên chi tiết', kind: 'text', w: 'w-48' },
  goods: { key: 'part_name', label: 'Tên hàng hoá', kind: 'text', w: 'w-56' },
  shape: { key: 'profile_shape', label: 'Loại', kind: 'shape', w: 'w-24' },
  thick: { key: 'dim_a_mm', label: 'Dày', kind: 'num', w: 'w-16' },
  wide: { key: 'dim_b_mm', label: 'Rộng', kind: 'num', w: 'w-16' },
  wall: { key: 'wall_thickness_mm', label: 'δ', kind: 'num', w: 'w-14' },
  len: { key: 'cut_length_mm', label: 'Dài', kind: 'num', w: 'w-20' },
  bend: { key: 'bend_waste_mm', label: 'Phi hao', kind: 'num', w: 'w-16' },
  tenon: { key: 'tenon_mm', label: 'Mộng', kind: 'num', w: 'w-16' },
  qty: { key: 'qty', label: 'SL', kind: 'num', w: 'w-14' },
  unit: { key: 'unit', label: 'ĐVT', kind: 'text', w: 'w-16' },
  mat: {
    key: 'material_note',
    label: 'Vật liệu',
    kind: 'text',
    w: 'w-28',
    placeholder: 'Carton 5 lớp…',
  },
  color: { key: 'color', label: 'Màu', kind: 'text', w: 'w-20' },
  note: { key: 'note', label: 'Ghi chú', kind: 'text', w: 'w-32' },
} satisfies Record<string, InputCell>

/**
 * Thứ tự ô nhập của từng họ — bám thứ tự đọc của biểu mẫu gốc để người đã quen
 * gõ trên Excel không phải học lại: khung đi theo `Loại · Dày · Rộng · Dài`,
 * còn gỗ/nệm không có cột "Loại" nên vào thẳng ba kích thước.
 */
const INPUT_LAYOUTS: Record<LayoutKey, InputCell[]> = {
  metal: [
    CELL.no,
    CELL.cluster,
    CELL.name,
    CELL.shape,
    CELL.thick,
    CELL.wide,
    CELL.wall,
    CELL.len,
    CELL.bend,
    CELL.qty,
    CELL.unit,
    CELL.color,
    CELL.note,
  ],
  wood: [
    CELL.no,
    CELL.cluster,
    CELL.name,
    CELL.thick,
    CELL.wide,
    CELL.len,
    CELL.tenon,
    CELL.qty,
    CELL.unit,
    CELL.mat,
    CELL.note,
  ],
  soft: [
    CELL.no,
    CELL.cluster,
    CELL.name,
    CELL.thick,
    CELL.wide,
    CELL.len,
    CELL.tenon,
    CELL.qty,
    CELL.unit,
    CELL.mat,
    CELL.note,
  ],
  // Vật tư mua ngoài: KHÔNG kích thước, KHÔNG cụm (không đi công đoạn hàn/sơn).
  // Đổi lại có "Vật liệu" và "Màu" — hai thứ biểu mẫu ghi mà lưới cũ bỏ mất.
  supply: [CELL.no, CELL.goods, CELL.qty, CELL.unit, CELL.mat, CELL.color, CELL.note],
}

export function inputCellsFor(groupCode: string): InputCell[] {
  return INPUT_LAYOUTS[layoutOf(groupCode)]
}

/**
 * Tiêu đề khối mặc định — ĐÚNG chữ dùng trong biểu mẫu BOM, kể cả dấu hai chấm
 * và kiểu viết hoa. Điền sẵn để người dựng định mức mới không phải gõ lại, và để
 * bảng in ra trùng khít tờ giấy xưởng đang dùng.
 */
const DEFAULT_SECTION: Record<string, string> = {
  FRAME: 'Quy cách :',
  WOOD: 'Quy cách gỗ:',
  CUSHION: 'Quy cách Nệm:',
  NGU_KIM: 'VẬT TƯ NGŨ KIM',
  HARDWARE: 'VẬT TƯ NGŨ KIM',
  PACKAGING: 'VẬT TƯ BAO BÌ',
  SON_HC: 'SƠN & HOÁ CHẤT',
  DAY_DAN: 'DÂY ĐAN',
}

export const defaultSectionTitle = (groupCode: string): string =>
  DEFAULT_SECTION[groupCode.toUpperCase()] ?? ''

/** Cột số TỰ TÍNH hiện kèm lưới nhập — xem ngay kết quả trong lúc gõ. */
export function derivedPreviewFor(
  groupCode: string,
): { key: 'weight_kg' | 'volume_m3'; label: string; digits: number } | null {
  const l = layoutOf(groupCode)
  if (l === 'metal') return { key: 'weight_kg', label: 'KL (kg)', digits: 3 }
  if (l === 'wood' || l === 'soft') return { key: 'volume_m3', label: 'm³', digits: 6 }
  return null
}
