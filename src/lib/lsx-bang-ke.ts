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
  from_products?: { code: string; name: string; qty: number; per: number; confirmed: boolean }[]
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
  material?: { material_code: string; material_name: string; unit: string; group_name: string | null }
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
  from_products: { code: string; name: string; qty: number; per: number; confirmed: boolean }[]
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
          (a.qty_needed === 0 && draftNeeded > 0 ? 'bom_draft' : a.source)
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
