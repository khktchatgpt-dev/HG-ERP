/**
 * BẢNG KÊ VẬT TƯ CỦA LỆNH — logic thuần, có test. Màn nhân viên Cung ứng mở đầu
 * tiên và nhìn suốt tuần (khuôn theo sheet "Thao_BK thép" trong sổ Excel của
 * phòng): mỗi mã vật tư một dòng — cần, tồn, đã đặt, đã về, còn phải đặt, và
 * trạng thái "chưa đặt / đặt chưa đủ / đang về / đủ".
 *
 * Ba tầng nguồn số "cần" hợp nhất THEO MÃ (user chốt 05/09/2026): bảng kê
 * Cung ứng nhập tay ghi đè từng mã → bảng định hình của Sản xuất (chỉ dòng đã
 * gắn mã) → định mức × số lượng. Mỗi dòng ghi rõ nguồn để người mua biết tin
 * tới đâu; dòng tay lệch định mức thì gắn cờ, không tự sửa.
 *
 * "Còn phải đặt" dùng ĐÚNG `suggestForMaterial` của form soạn đơn — không viết
 * công thức thứ hai để hai chỗ nói hai con số.
 */

import { suggestForMaterial } from './po-suggestion'

export type BangKeSource = 'manual' | 'components' | 'bom' | 'bom_draft'

/** Nhu cầu TỰ ĐỘNG của lệnh (định hình / định mức) — một dòng một mã. */
export type BangKeNeed = {
  material_id: string
  material_code: string
  material_name: string
  unit: string
  group_name?: string | null
  /** LOẠI theo định mức — xem BangKeRow.kind. */
  kind?: string | null
  /** Tên chi tiết dùng mã này — cột "Vị trí lắp ráp". */
  positions?: string[]
  /** Số cần từ định mức ĐÃ XÁC NHẬN (BOM đã kiểm tra hoặc hồ sơ đã khoá). */
  qty_needed: number
  /**
   * Số cần từ định mức CHƯA xác nhận — giữ riêng, chỉ cộng vào khi người dùng
   * bật "tính cả BOM chưa xác nhận". Mua theo bản nháp là mua sai (user chốt
   * 05/09/2026), nhưng giấu số đi thì người mua không biết vì sao bảng trống.
   */
  qty_needed_draft?: number
  qty_issued: number
  qty_remaining: number
  source: Exclude<BangKeSource, 'manual'>
  /** Bảng định hình thiếu hệ số nên số chỉ là tham khảo. */
  incomplete?: boolean
  /** SP nào sinh ra số này — giải thích trên dòng, và chỉ ra ai cần chốt BOM. */
  from_products?: {
    code: string
    name: string
    qty: number
    per: number
    confirmed: boolean
    explain?: string
  }[]
}

/** Dòng Cung ứng nhập tay (B2) — ghi đè số cần của đúng mã đó. */
export type BangKeManual = {
  material_id: string
  material_code: string
  material_name: string
  unit: string
  group_name?: string | null
  qty_needed: number
  note?: string | null
  /** Ai sửa gần nhất và lúc nào — chỉ dòng nhập tay mới có. */
  edited_by?: string | null
  edited_at?: string | null
}

/** Đơn mua có dòng cho mã này (trong lệnh, kể cả đơn mua chung). */
export type BangKePoRef = {
  id: string
  code: string
  supplier_name: string
  status: string
  expected_at: string | null
  qty_ordered: number
  qty_received: number
  late: boolean
}

export type BangKeFacts = {
  on_hand: number
  reserved_others: number
  /** Σ qty_open của đơn đã duyệt (chưa về, chưa chốt thiếu). */
  ordered: number
  /** Σ SL trên đơn đang chờ Giám đốc ký. */
  pending: number
  /** Σ SL trên đơn còn NHÁP — chưa ai ngoài người soạn nhìn thấy. */
  draft: number
  /** Σ đã nhận trên các đơn của lệnh. */
  received: number
  pos: BangKePoRef[]
  /** Tên/ĐVT của mã CHỈ có trên đơn (ngoài định mức) — nguồn cần không biết nó. */
  material?: {
    material_code: string
    material_name: string
    unit: string
    group_name: string | null
  }
}

export type BangKeStatus =
  /** Còn phải đặt mà chưa có đơn nào (kể cả nháp). */
  | 'none'
  /** Còn phải đặt, đã có đơn nháp / chờ ký nhưng chưa có đơn nào đã duyệt. */
  | 'pending'
  /** Còn phải đặt dù đã có đơn duyệt — đặt chưa đủ. */
  | 'short'
  /** Đã đặt đủ, hàng đang về. */
  | 'inflight'
  /** Đủ: tồn/đã về đã phủ hết phần còn cần. */
  | 'done'
  /** Có đơn mua nhưng không nằm trong nhu cầu của lệnh. */
  | 'extra'
  /** Dòng nhập tay chưa điền số cần (vừa thêm mã) — chưa nói được gì. */
  | 'blank'
  /** Chỉ có định mức từ BOM CHƯA xác nhận — chưa được dùng để mua. */
  | 'unconfirmed'

export const BANG_KE_STATUS: Record<
  BangKeStatus,
  { label: string; tone: 'stop' | 'warn' | 'primary' | 'done' | 'muted'; order: number }
> = {
  unconfirmed: { label: 'BOM chưa xác nhận', tone: 'warn', order: -2 },
  blank: { label: 'Chưa có số', tone: 'muted', order: -1 },
  none: { label: 'Chưa đặt', tone: 'stop', order: 0 },
  short: { label: 'Đặt chưa đủ', tone: 'warn', order: 1 },
  pending: { label: 'Đơn chưa duyệt', tone: 'warn', order: 2 },
  inflight: { label: 'Đang về', tone: 'primary', order: 3 },
  done: { label: 'Đủ', tone: 'done', order: 4 },
  extra: { label: 'Ngoài định mức', tone: 'muted', order: 5 },
}

export const BANG_KE_STATUSES = (Object.keys(BANG_KE_STATUS) as BangKeStatus[]).sort(
  (a, b) => BANG_KE_STATUS[a].order - BANG_KE_STATUS[b].order,
)

export type BangKeRow = {
  material_id: string
  material_code: string
  material_name: string
  unit: string
  group_name: string | null
  source: BangKeSource | 'none'
  /** Dòng tay lệch định mức tự động > 10% — Kỹ thuật nên xem lại. */
  deviates: boolean
  /** Số cần theo nguồn tự động, để so với dòng tay. */
  auto_needed: number | null
  /** Số cần từ BOM chưa xác nhận (0 nếu không có) — hiện làm ghi chú trên dòng. */
  draft_needed: number
  edited_by: string | null
  edited_at: string | null
  from_products: {
    code: string
    name: string
    qty: number
    per: number
    confirmed: boolean
    explain?: string
  }[]
  incomplete: boolean
  qty_needed: number
  qty_issued: number
  qty_remaining: number
  on_hand: number
  reserved_others: number
  available: number
  ordered: number
  pending: number
  draft: number
  received: number
  /** Còn phải đặt = max(còn cần − khả dụng − đã đặt, 0). */
  suggest: number
  status: BangKeStatus
  note: string | null
  pos: BangKePoRef[]
  /**
   * LOẠI theo định mức (NGU_KIM / PACKAGING / WOOD…) — trục chia khối chính của
   * bảng kê từ 07/09/2026. Rỗng với mã chỉ có trên đơn (ngoài định mức): những
   * dòng đó rơi về nhóm kho.
   */
  kind?: string | null
  /** Nhóm phụ trong danh mục kho — tầng chia thứ hai khi một loại quá dài. */
  sub_group?: string | null
  /**
   * VỊ TRÍ LẮP RÁP — tên các chi tiết dùng mã này, gộp từ mọi sản phẩm của
   * lệnh. Cột này có trong mọi bảng kê tay của phòng; nó trả lời "con vít này
   * bắt vào đâu", thứ mà mã và tên vật tư không nói được.
   */
  positions?: string[]
  /**
   * Quy cách của mã trong danh mục vật tư. Đi hỏi giá mà chỉ có tên ("Nhôm hộp
   * 15x25x1li") thì nhà cung cấp vẫn hỏi lại độ dày / chiều dài cây.
   */
  spec?: string | null
  /**
   * GIÁ MUA GẦN NHẤT — lấy từ DÒNG ĐƠN thật, không phải cột
   * `warehouse_materials.last_purchase_price`: đo 07/09/2026 thì cột danh mục
   * chỉ điền được 14/105 mã từng mua (13%), còn dòng đơn có giá ở 97/105 (92%).
   * Rỗng = mã chưa mua bao giờ, người mua phải đi hỏi giá.
   */
  last_price?: {
    unit_price: number
    currency: string
    /** Để dựng link soạn đơn cho đúng NCC đó. */
    supplier_id: string | null
    supplier_name: string
    po_code: string
    /** ISO timestamp của đơn gần nhất có giá mã này. */
    at: string
  } | null
}

/**
 * Tiền TẠM TÍNH — gộp theo TỪNG TIỀN TỆ vì bảng kê có cả đơn VND lẫn USD, cộng
 * chung ra một con số không có nghĩa.
 *
 * Tính trên số CÒN PHẢI ĐẶT — đúng con số người mua đang nhìn trên dòng.
 */
export function estimateByCurrency(rows: BangKeRow[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rows) {
    if (!r.last_price || r.suggest <= 0) continue
    const cur = r.last_price.currency
    out.set(cur, (out.get(cur) ?? 0) + r.suggest * r.last_price.unit_price)
  }
  return out
}

const EMPTY_FACTS: BangKeFacts = {
  on_hand: 0,
  reserved_others: 0,
  ordered: 0,
  pending: 0,
  draft: 0,
  received: 0,
  pos: [],
  material: undefined,
}

/** Lệch > 10% giữa số tay và số tự động thì gắn cờ. */
const DEVIATION = 0.1

export function classifyBangKe(r: {
  draft_needed?: number
  qty_needed: number
  qty_remaining: number
  suggest: number
  ordered: number
  pending: number
  draft: number
  source: BangKeRow['source']
}): BangKeStatus {
  if (r.source === 'none') return 'extra'
  // Chỉ có số từ bản nháp BOM: chưa được dùng để mua, và cũng không phải "đủ".
  if (r.source === 'bom_draft' && r.qty_needed === 0 && (r.draft_needed ?? 0) > 0) {
    return 'unconfirmed'
  }
  // Vừa "Thêm mã" xong, số cần còn 0: không phải "đủ", là chưa điền.
  if (r.source === 'manual' && r.qty_needed === 0) return 'blank'
  if (r.suggest > 0) {
    if (r.ordered > 0) return 'short'
    if (r.pending > 0 || r.draft > 0) return 'pending'
    return 'none'
  }
  // Không còn phải đặt: có đơn đang mở thì hàng đang về, không thì đã đủ.
  return r.ordered > 0 ? 'inflight' : 'done'
}

/**
 * Dựng bảng kê: hợp nhất nguồn cần theo mã, ghép số tồn/đặt/về, xếp việc gấp
 * lên đầu. `facts` thiếu mã nào thì coi như 0 — không đoán.
 */
export function buildBangKe(input: {
  needs: BangKeNeed[]
  manual: BangKeManual[]
  facts: Map<string, BangKeFacts>
  /** Tính cả định mức từ BOM chưa xác nhận (mặc định KHÔNG — user chốt 05/09/2026). */
  includeDraft?: boolean
}): BangKeRow[] {
  const includeDraft = input.includeDraft ?? false
  const auto = new Map(input.needs.map((n) => [n.material_id, n]))
  const manual = new Map(input.manual.map((m) => [m.material_id, m]))
  const ids = new Set<string>([...auto.keys(), ...manual.keys(), ...input.facts.keys()])

  const rows: BangKeRow[] = []
  for (const id of ids) {
    const a = auto.get(id)
    const m = manual.get(id)
    const f = input.facts.get(id) ?? EMPTY_FACTS
    // Mã chỉ có ở facts (có đơn mua) mà không ở nguồn cần nào → ngoài định mức.
    if (!a && !m && f.pos.length === 0) continue

    const draftNeeded = a?.qty_needed_draft ?? 0
    const autoQty = (a?.qty_needed ?? 0) + (includeDraft ? draftNeeded : 0)
    const qtyNeeded = m ? m.qty_needed : autoQty
    const qtyIssued = a?.qty_issued ?? 0
    const qtyRemaining = Math.max(qtyNeeded - qtyIssued, 0)
    const s = suggestForMaterial({
      material_id: id,
      needed: qtyRemaining,
      on_hand: f.on_hand,
      reserved_others: f.reserved_others,
      ordered: f.ordered,
      pending: f.pending,
    })
    const source: BangKeRow['source'] = m
      ? 'manual'
      : a
        ? // Mã chỉ có ở bản nháp thì nói thẳng nguồn là nháp, kể cả khi đang bật
          // "tính cả nháp" — người mua phải luôn thấy số này kém tin hơn.
          a.qty_needed === 0 && draftNeeded > 0
          ? 'bom_draft'
          : a.source
        : 'none'
    const autoNeeded = a ? autoQty : null
    const deviates =
      !!m &&
      autoNeeded != null &&
      Math.abs(m.qty_needed - autoNeeded) > Math.max(autoNeeded, 1) * DEVIATION
    const base = {
      draft_needed: draftNeeded,
      qty_needed: qtyNeeded,
      qty_remaining: qtyRemaining,
      suggest: s.suggest,
      ordered: s.ordered,
      pending: s.pending,
      draft: f.draft,
      source,
    }
    const ref = a ?? m ?? f.material
    rows.push({
      material_id: id,
      material_code: ref?.material_code ?? '',
      material_name: ref?.material_name ?? '',
      unit: ref?.unit ?? '',
      group_name: ref?.group_name ?? null,
      // Loại chỉ đến từ định mức. Dòng nhập tay và mã chỉ có trên đơn không có
      // loại — màn hình cho chúng rơi về nhóm kho chứ không đoán.
      kind: a?.kind ?? null,
      positions: a?.positions ?? [],
      deviates,
      auto_needed: autoNeeded,
      from_products: a?.from_products ?? [],
      incomplete: a?.incomplete ?? false,
      qty_issued: qtyIssued,
      on_hand: s.on_hand,
      reserved_others: s.reserved_others,
      available: s.available,
      received: f.received,
      status: classifyBangKe(base),
      note: m?.note ?? null,
      edited_by: m?.edited_by ?? null,
      edited_at: m?.edited_at ?? null,
      pos: f.pos,
      ...base,
    })
  }

  return rows.sort(compareBangKe)
}

/** Gấp lên đầu: theo trạng thái, rồi còn phải đặt nhiều trước, rồi mã. */
export function compareBangKe(a: BangKeRow, b: BangKeRow): number {
  const so = BANG_KE_STATUS[a.status].order - BANG_KE_STATUS[b.status].order
  if (so !== 0) return so
  if (a.suggest !== b.suggest) return b.suggest - a.suggest
  return a.material_code.localeCompare(b.material_code, 'vi', { numeric: true })
}

export function summarizeBangKe(rows: BangKeRow[]): Record<BangKeStatus, number> & {
  total: number
  needed: number
} {
  const out = {
    unconfirmed: 0,
    blank: 0,
    none: 0,
    short: 0,
    pending: 0,
    inflight: 0,
    done: 0,
    extra: 0,
    total: 0,
    needed: 0,
  }
  for (const r of rows) {
    out[r.status]++
    out.total++
    if (r.source !== 'none' && r.status !== 'unconfirmed') out.needed++
  }
  return out
}

/**
 * VỊ TRÍ LẮP RÁP ĐÁNG BÀY — lọc tên chi tiết chỉ chép lại tên vật tư.
 *
 * Ở khối ngũ kim, Kỹ thuật thường đặt tên chi tiết bằng chính tên vật tư ("Vít
 * dù 4x18 7M", "Túi vải") — bày ra là một cột chép lại cột bên cạnh, có khi lặp
 * hai lần chỉ khác hoa/thường. Giữ lại cái thật sự chỉ chỗ ("Tay vịn", "Giang
 * mặt cánh", "LK hộp trượt").
 *
 * Ở LÕI THUẦN chứ không ở màn hình: màn lọc mà file Excel không lọc thì hai bên
 * nói hai chuyện về cùng một dòng — đúng ca đã xảy ra 07/09/2026.
 */
export function viTriLapRap(r: {
  material_name: string
  positions?: string[]
}): string[] {
  // Khoá so sánh CHỈ CÒN CHỮ VÀ SỐ: hồ sơ hay lệch đúng một dấu phẩy hoặc một
  // dấu cách đôi ("Vít dù  4x18 7M" vs "Vít dù 4x18 7M"), so nguyên văn là
  // không khớp và cột lại đầy dòng chép lại tên vật tư.
  const key = (t: string) =>
    t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
  const ten = key(r.material_name)
  const seen = new Set<string>()
  return (r.positions ?? []).filter((p) => {
    const v = key(p)
    if (!v || v === ten || ten.includes(v) || v.includes(ten)) return false
    if (seen.has(v)) return false
    seen.add(v)
    return true
  })
}

/** Một khối "đặt cho ai" — mỗi khối là một tờ đơn sắp soạn. */
export type NccBlock = {
  supplier_id: string | null
  supplier_name: string
  rows: BangKeRow[]
  /** Tiền tạm tính cho phần còn phải đặt, gộp theo từng tiền tệ. */
  tien: Map<string, number>
}

/** Tên khối cho những mã chưa mua lần nào — dùng chung màn hình và file. */
export const NCC_CHUA_BIET = 'Chưa biết mua ở đâu'

/**
 * GỘP THEO NHÀ CUNG CẤP — nửa phải sổ tay của phòng (sheet BKVT file YOTRIO:
 * "STT | NCC | Tên vật tư | ĐVT | Tổng SL cần đặt"). Đây là bảng để CẮT ĐƠN.
 *
 * Chỉ lấy dòng CÒN PHẢI ĐẶT: người đang cắt đơn không quan tâm mã đã đủ.
 *
 * NCC lấy theo lần mua GẦN NHẤT của chính mã đó. Mã chưa mua bao giờ gom vào
 * một khối riêng và KHÔNG đoán NCC — đoán sai thì đơn gửi nhầm chỗ. Khối đó
 * xuống cuối vì nó là việc đi hỏi giá, không phải việc cắt đơn.
 *
 * Ở LÕI THUẦN vì cả màn hình lẫn file Excel đều phải cắt y hệt nhau; hai bản
 * dựng riêng thì sớm muộn một bên đổi luật và hai bên chia đơn khác nhau.
 */
export function groupBySupplier(rows: BangKeRow[]): NccBlock[] {
  const map = new Map<string, NccBlock>()
  for (const r of rows) {
    if (r.suggest <= 0) continue
    const key = r.last_price?.supplier_id ?? r.last_price?.supplier_name ?? '_'
    const cur = map.get(key)
    if (cur) cur.rows.push(r)
    else
      map.set(key, {
        supplier_id: r.last_price?.supplier_id ?? null,
        supplier_name: r.last_price?.supplier_name ?? NCC_CHUA_BIET,
        rows: [r],
        tien: new Map(),
      })
  }
  return [...map.values()]
    .map((b) => ({ ...b, tien: estimateByCurrency(b.rows) }))
    .sort((a, b) =>
      !a.supplier_id !== !b.supplier_id
        ? a.supplier_id
          ? -1
          : 1
        : b.rows.length - a.rows.length ||
          a.supplier_name.localeCompare(b.supplier_name, 'vi'),
    )
}

/** Khối của bảng kê: một LOẠI, có thể chia tiếp thành nhóm phụ. */
export type BangKeSection = {
  name: string
  rank: number
  rows: BangKeRow[]
  short: number
  subs: { name: string | null; rows: BangKeRow[] }[]
}

/** Khối KHÔNG có loại (mã chỉ có trên đơn, dòng nhập tay) luôn xuống cuối. */
const NGOAI_DINH_MUC_RANK = 900

/** Dưới ngưỡng này thì một khối đọc thẳng được, chia thêm tầng chỉ tổ rối. */
const NGUONG_CHIA = 15

function buildSubs(rows: BangKeRow[]): BangKeSection['subs'] {
  if (rows.length <= NGUONG_CHIA) return [{ name: null, rows }]
  const map = new Map<string, BangKeRow[]>()
  for (const r of rows) {
    const k = r.sub_group?.trim() || r.group_name?.trim() || 'Chưa có nhóm phụ'
    const cur = map.get(k)
    if (cur) cur.push(r)
    else map.set(k, [r])
  }
  // Cả khối cùng một nhóm phụ thì dòng tiêu đề chỉ lặp lại tên khối ở trên.
  if (map.size < 2) return [{ name: null, rows }]
  return [...map.entries()]
    .map(([name, list]) => ({ name, rows: list }))
    .sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name, 'vi'))
}

/**
 * CHIA KHỐI BẢNG KÊ theo LOẠI trong định mức, khối dài thì chia tiếp nhóm phụ.
 *
 * Thứ tự khối CỐ ĐỊNH theo biểu mẫu định mức (khung → gỗ → ngũ kim → nệm/vải →
 * sơn → bao bì → tem), KHÔNG xếp theo "khối nào thiếu nhiều nhất": trật tự nhảy
 * theo dữ liệu thì mỗi lần mở lại thấy bảng khác nhau, người dùng mất luôn trí
 * nhớ vị trí.
 *
 * Ở lõi thuần vì màn hình và file Excel phải chia y hệt nhau.
 */
export function groupForBangKe(
  rows: BangKeRow[],
  label: (kind: string | null | undefined) => string | null,
  rank: (kind: string | null | undefined) => number,
): BangKeSection[] {
  const map = new Map<string, { rank: number; rows: BangKeRow[] }>()
  for (const r of rows) {
    const loai = label(r.kind)
    const name = loai ?? r.group_name ?? 'Chưa phân loại'
    const cur = map.get(name)
    if (cur) cur.rows.push(r)
    else map.set(name, { rank: loai ? rank(r.kind) : NGOAI_DINH_MUC_RANK, rows: [r] })
  }
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      rank: v.rank,
      rows: v.rows,
      short: v.rows.filter((x) => x.suggest > 0).length,
      subs: buildSubs(v.rows),
    }))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'vi'))
}
