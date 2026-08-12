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
/**
 * BỔ SUNG 11/08/2026 — quét đủ 187 file (`docs/dinh-muc-nhom-theo-bom-187-file.md`)
 * cho thấy bốn họ chưa phủ hết:
 *
 *  sheet   45 file  "Quy cách Nan Polywood" + 14 file kính/mặt đá/mặt bàn —
 *                   tính m²/m³ như gỗ nhưng MUA THEO TẤM, cần quy cách tấm
 *  fabric   7 file  "VẢI"/"VẢI TEXTILEN" — bộ cột không giống nhóm nào:
 *                   khổ vải · mét tới · % hao hụt (2% vải, 3% textilene)
 *
 * và `soft` bị bỏ mất cột m³ trong khi cả ba thứ nó gánh (nệm · mút · gòn) đều
 * cần: nệm ra m³, mút mua theo TẤM (m³/tấm), gòn mua theo KG.
 */
export type LayoutKey = 'metal' | 'wood' | 'sheet' | 'soft' | 'fabric' | 'supply'

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
  /* ── Ba cột tiết diện TÁCH RỜI, đúng như biểu mẫu ────────────────────────
   * Bảng cũ gộp thành một ô "hộp 30×100" cho gọn, nhưng người nhập đọc ngang
   * từ tờ Excel sang thì mất dấu: file có bốn cột `Loại · Dày · Rộng · Dài`,
   * màn hình chỉ có hai. Giữ đúng số cột và đúng nhãn của biểu mẫu.
   *
   * Lưu ý nghĩa thật của cột "Dày": KHÔNG phải độ dày vật liệu mà là tiết diện
   * thứ nhất — Ø với ống tròn (19|19 = Ø19), bề dày với la (2|20), cạnh với
   * hộp. Độ dày thành nằm ở cột riêng `Dày vật liệu (δ)`. */
  shape: {
    key: 'shape',
    label: 'Loại',
    has: (p) => !!(p.profile_shape || p.profile_code),
  },
  dimA: {
    key: 'dimA',
    label: 'Dày',
    align: 'right',
    has: (p) => p.dim_a_mm != null,
  },
  dimB: {
    key: 'dimB',
    label: 'Rộng',
    align: 'right',
    has: (p) => p.dim_b_mm != null,
  },
  dims: {
    key: 'dims',
    label: 'Dày × Rộng (mm)',
    has: (p) => p.dim_a_mm != null || p.dim_b_mm != null,
  },
  tenon: { key: 'tenon', label: 'Mộng', has: (p) => !!p.tenon },
  cut: {
    key: 'cut',
    // Đứng ngay sau Dày · Rộng nên đúng chữ "Dài" của biểu mẫu là đủ nghĩa.
    label: 'Dài',
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
  /* ── Cột quy đổi ĐƠN VỊ MUA (0132) ───────────────────────────────────────
   * Cung ứng đặt cây / tấm / mét khổ, không đặt "mét" hay "m³". Thiếu mấy cột
   * này thì định mức dừng ở nửa đường và người mua phải tự quy đổi tay. */
  species: { key: 'species', label: 'Loại gỗ', has: (p) => !!p.wood_species },
  barLen: {
    key: 'barLen',
    label: 'Dài cây (m)',
    align: 'right',
    has: (p) => p.bar_length_m != null,
  },
  pcsBar: {
    key: 'pcsBar',
    label: 'CT / cây',
    align: 'right',
    has: (p) => p.pcs_per_bar != null,
  },
  bars: {
    key: 'bars',
    label: 'Số cây',
    align: 'right',
    has: (p) => p.pcs_per_bar != null && p.pcs_per_bar > 0,
  },
  roll: {
    key: 'roll',
    label: 'Khổ (m)',
    align: 'right',
    has: (p) => p.roll_width_m != null,
  },
  wastePct: {
    key: 'wastePct',
    label: 'Hao hụt (%)',
    align: 'right',
    has: (p) => p.waste_pct != null,
  },
  totalM: {
    key: 'totalM',
    label: 'Tổng mét (đã hao hụt)',
    align: 'right',
    has: (p) => p.total_length_m != null,
  },
  sheetSpec: {
    key: 'sheetSpec',
    label: 'Quy cách tấm (mm)',
    has: (p) => p.sheet_w_mm != null || p.sheet_l_mm != null,
  },
  m3Sheet: {
    key: 'm3Sheet',
    label: 'm³ / tấm',
    align: 'right',
    has: (p) => p.m3_per_sheet != null,
  },
} satisfies Record<string, PartColumn>

/** Thứ tự cột của từng họ — giữ đúng trình tự đọc của biểu mẫu gốc. */
const LAYOUTS: Record<LayoutKey, PartColumn[]> = {
  /**
   * THỨ TỰ CỘT BÁM ĐÚNG TỜ EXCEL, rồi mới tới cột riêng của hệ.
   *
   * Người nhập đọc ngang từ file BOM sang màn hình. Bản trước xen cột của hệ
   * (mã VT, ĐVT, màu, dài cây…) vào giữa dãy cột biểu mẫu, nên mắt trượt dòng.
   * Nay 12 cột đầu của khối khung XẾP ĐÚNG như biểu mẫu:
   *   Loại · Dày · Rộng · Dài · Phi hao uốn · SL · Tổng dài · KL · DT sơn · δ
   *   · Ghi chú · ✓ Phôi
   * mọi cột hệ thêm vào đẩy hết xuống sau — cột nào cả nhóm bỏ trống thì tự ẩn.
   */
  metal: [
    COL.shape,
    COL.dimA,
    COL.dimB,
    COL.cut,
    COL.waste,
    COL.qty,
    COL.len,
    COL.kg,
    COL.paintM2,
    COL.wall,
    COL.note,
    COL.blank,
    // ── hết phần biểu mẫu, dưới đây là cột của hệ ──
    COL.code,
    COL.barLen,
    COL.pcsBar,
    COL.bars,
    COL.unit,
    COL.mat,
    COL.color,
  ],
  // Biểu mẫu gỗ: Dày · Rộng · Dài · Mộng · SL · Diện tích (m2) · K.Lượng (m3) · Ghi chú
  wood: [
    COL.dimA,
    COL.dimB,
    COL.cut,
    COL.tenonMm,
    COL.qty,
    COL.m2,
    COL.m3,
    COL.note,
    COL.species,
    COL.code,
    COL.unit,
    COL.mat,
    COL.tenon,
  ],
  // Polywood / ván ép / kính / mặt đá: tính như gỗ nhưng mua theo TẤM.
  sheet: [
    COL.dimA,
    COL.dimB,
    COL.cut,
    COL.qty,
    COL.m2,
    COL.m3,
    COL.note,
    COL.sheetSpec,
    COL.code,
    COL.unit,
    COL.mat,
  ],
  // Nệm · mút · gòn: m³ trả lại (mút mua theo tấm nên cần m³/tấm).
  soft: [
    COL.dimA,
    COL.dimB,
    COL.cut,
    COL.tenonMm,
    COL.qty,
    COL.m2,
    COL.m3,
    COL.note,
    COL.m3Sheet,
    COL.code,
    COL.unit,
    COL.mat,
  ],
  // Vải / textilene: đặt theo MÉT của khổ, cộng hao hụt cắt.
  fabric: [
    COL.dimA,
    COL.dimB,
    COL.cut,
    COL.qty,
    COL.m2,
    COL.note,
    COL.roll,
    COL.wastePct,
    COL.totalM,
    COL.code,
    COL.unit,
    COL.mat,
  ],
  // Biểu mẫu ngũ kim / bao bì: Dày · Rộng · Dài · ĐVT · SL/SP · Vật Liệu · Ghi chú.
  // KHÔNG có cột tiền (0097 — định mức trả lời "cần bao nhiêu", giá ở Cung ứng).
  supply: [
    COL.dimA,
    COL.dimB,
    COL.cut,
    COL.unit,
    COL.qty,
    COL.mat,
    COL.note,
    COL.code,
    COL.color,
  ],
}

/**
 * Nhóm hạng mục → họ khối. Dựa trên mã nhóm của 0093/0094; mã lạ rơi về `supply`
 * (bộ cột hẹp nhất, không bịa kích thước cho thứ không có).
 */
export function layoutOf(groupCode: string): LayoutKey {
  const g = groupCode.toUpperCase()
  if (g === 'FRAME') return 'metal'
  if (g === 'WOOD') return 'wood'
  if (g === 'POLYWOOD' || g === 'PANEL') return 'sheet'
  if (g === 'CUSHION') return 'soft'
  if (g === 'FABRIC') return 'fabric'
  // LABEL · ZIPPER · NGU_KIM · SON_HC · PACKAGING · DAY_DAN · OTHER → đếm theo ĐVT.
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
  | 'material_code'
  | 'profile_code'
  | 'kg_per_m'
  | 'wood_species'
  | 'bar_length_m'
  | 'pcs_per_bar'
  | 'roll_width_m'
  | 'waste_pct'
  | 'sheet_w_mm'
  | 'sheet_l_mm'
  | 'm3_per_sheet'

export type InputCell = {
  key: InputKey
  label: string
  /**
   * `num` canh phải + bàn phím số · `shape` là select · `cluster` là combobox ·
   * `material` là ô tìm danh mục kho · `die` là ô tìm danh mục khuôn (chọn xong
   * kéo theo kg/m, ĐVT, chiều dài cây — bớt được mấy ô gõ tay).
   */
  kind: 'text' | 'num' | 'shape' | 'cluster' | 'material' | 'die'
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
  matCode: { key: 'material_code', label: 'Mã VT kho', kind: 'material', w: 'w-40' },
  die: { key: 'profile_code', label: 'Mã khuôn', kind: 'die', w: 'w-28' },
  kgm: { key: 'kg_per_m', label: 'kg/m', kind: 'num', w: 'w-16' },
  /* Ô quy đổi đơn vị mua — chỉ hiện ở đúng họ cần (0132). */
  species: {
    key: 'wood_species',
    label: 'Loại gỗ',
    kind: 'text',
    w: 'w-24',
    placeholder: 'Keo / Teck…',
  },
  barLen: { key: 'bar_length_m', label: 'Dài cây', kind: 'num', w: 'w-16' },
  pcsBar: { key: 'pcs_per_bar', label: 'CT/cây', kind: 'num', w: 'w-14' },
  roll: { key: 'roll_width_m', label: 'Khổ (m)', kind: 'num', w: 'w-16' },
  wastePct: { key: 'waste_pct', label: 'Hao %', kind: 'num', w: 'w-14' },
  sheetW: { key: 'sheet_w_mm', label: 'Tấm R', kind: 'num', w: 'w-16' },
  sheetL: { key: 'sheet_l_mm', label: 'Tấm D', kind: 'num', w: 'w-16' },
  m3Sheet: { key: 'm3_per_sheet', label: 'm³/tấm', kind: 'num', w: 'w-16' },
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
    CELL.die,
    CELL.kgm,
    CELL.barLen,
    CELL.pcsBar,
    CELL.matCode,
    CELL.note,
  ],
  wood: [
    CELL.no,
    CELL.cluster,
    CELL.name,
    CELL.species,
    CELL.thick,
    CELL.wide,
    CELL.len,
    CELL.tenon,
    CELL.qty,
    CELL.unit,
    CELL.mat,
    CELL.matCode,
    CELL.note,
  ],
  sheet: [
    CELL.no,
    CELL.cluster,
    CELL.name,
    CELL.thick,
    CELL.wide,
    CELL.len,
    CELL.qty,
    CELL.unit,
    CELL.sheetW,
    CELL.sheetL,
    CELL.mat,
    CELL.matCode,
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
    CELL.m3Sheet,
    CELL.mat,
    CELL.matCode,
    CELL.note,
  ],
  fabric: [
    CELL.no,
    CELL.cluster,
    CELL.name,
    CELL.roll,
    CELL.wide,
    CELL.len,
    CELL.qty,
    CELL.unit,
    CELL.wastePct,
    CELL.mat,
    CELL.matCode,
    CELL.note,
  ],
  // Vật tư mua ngoài: KHÔNG kích thước, KHÔNG cụm (không đi công đoạn hàn/sơn).
  // Đổi lại có "Vật liệu" và "Màu" — hai thứ biểu mẫu ghi mà lưới cũ bỏ mất.
  supply: [
    CELL.no,
    CELL.goods,
    CELL.qty,
    CELL.unit,
    CELL.mat,
    CELL.color,
    CELL.matCode,
    CELL.note,
  ],
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

/* ────────────────────────────────────────────────────────────────────────────
 * VÙNG — cùng bộ ô của `inputCellsFor`, nhưng GOM THEO NGHĨA và có nhãn.
 *
 * Lưới ngang trả đúng ô theo họ khối, nhưng đổ hết lên một hàng: khối khung 18
 * ô, nhãn nằm tận hàng tiêu đề của bảng, kéo ngang một cái là mất nhãn. Trên
 * cùng một hàng lại trộn ba thứ khác nghĩa vụ — ô của biểu mẫu BOM (bắt buộc),
 * ô hệ thêm để Cung ứng mua được, và ô hệ TỰ TÍNH — mà trông y hệt nhau.
 *
 * Thẻ sửa dựng theo bảng này: mỗi vùng một nhãn, vùng nào biểu mẫu của nhóm đó
 * không có thì không hiện. Nguồn ô vẫn là `CELL` — không đẻ định nghĩa thứ hai.
 * ──────────────────────────────────────────────────────────────────────────── */

export type PartZone = {
  /** null = vùng đầu thẻ (STT · Cụm · Tên) — không cần nhãn, tự hiểu. */
  label: string | null
  cells: InputCell[]
}

const ZONES: Record<LayoutKey, PartZone[]> = {
  metal: [
    { label: null, cells: [CELL.no, CELL.cluster, CELL.name] },
    { label: 'Quy cách tinh (mm)', cells: [CELL.shape, CELL.thick, CELL.wide, CELL.wall] },
    { label: 'Cắt và số lượng', cells: [CELL.len, CELL.bend, CELL.qty] },
    {
      label: 'Để cung ứng mua',
      cells: [CELL.matCode, CELL.die, CELL.kgm, CELL.barLen, CELL.pcsBar],
    },
    { label: 'Khác', cells: [CELL.unit, CELL.color, CELL.note] },
  ],
  wood: [
    { label: null, cells: [CELL.no, CELL.cluster, CELL.name] },
    { label: 'Loại gỗ', cells: [CELL.species] },
    {
      label: 'Quy cách tinh (mm)',
      cells: [CELL.thick, CELL.wide, CELL.len, CELL.tenon],
    },
    { label: 'Số lượng', cells: [CELL.qty, CELL.unit] },
    { label: 'Vật liệu và mã kho', cells: [CELL.mat, CELL.matCode] },
    { label: 'Khác', cells: [CELL.note] },
  ],
  sheet: [
    { label: null, cells: [CELL.no, CELL.cluster, CELL.name] },
    { label: 'Quy cách tinh (mm)', cells: [CELL.thick, CELL.wide, CELL.len] },
    { label: 'Số lượng', cells: [CELL.qty, CELL.unit] },
    { label: 'Quy cách tấm (mm)', cells: [CELL.sheetW, CELL.sheetL] },
    { label: 'Vật liệu và mã kho', cells: [CELL.mat, CELL.matCode] },
    { label: 'Khác', cells: [CELL.note] },
  ],
  soft: [
    { label: null, cells: [CELL.no, CELL.cluster, CELL.name] },
    {
      label: 'Quy cách tinh (mm)',
      cells: [CELL.thick, CELL.wide, CELL.len, CELL.tenon],
    },
    { label: 'Số lượng', cells: [CELL.qty, CELL.unit] },
    { label: 'Mua theo tấm', cells: [CELL.m3Sheet] },
    { label: 'Vật liệu và mã kho', cells: [CELL.mat, CELL.matCode] },
    { label: 'Khác', cells: [CELL.note] },
  ],
  fabric: [
    { label: null, cells: [CELL.no, CELL.cluster, CELL.name] },
    { label: 'Loại vải và khổ', cells: [CELL.mat, CELL.roll] },
    { label: 'Quy cách cắt (mm)', cells: [CELL.wide, CELL.len] },
    { label: 'Số lượng', cells: [CELL.qty, CELL.unit] },
    { label: 'Hao hụt và mã kho', cells: [CELL.wastePct, CELL.matCode] },
    { label: 'Khác', cells: [CELL.note] },
  ],
  // Ngũ kim / bao bì / tem / dây kéo: biểu mẫu KHÔNG có cột cụm và không có
  // kích thước nào — thẻ vì thế cũng không được bày ra.
  supply: [
    { label: null, cells: [CELL.no, CELL.goods] },
    { label: 'Số lượng', cells: [CELL.unit, CELL.qty] },
    { label: 'Vật liệu', cells: [CELL.mat, CELL.color] },
    { label: 'Mã kho', cells: [CELL.matCode] },
    { label: 'Khác', cells: [CELL.note] },
  ],
}

/** Các vùng của thẻ sửa một dòng — theo nhóm hạng mục. */
export function zonesFor(groupCode: string): PartZone[] {
  return ZONES[layoutOf(groupCode)]
}
