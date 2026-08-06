import { valueState } from './lsx-sheet-cells'

/**
 * DÒNG LỆNH: NGUỒN DỮ LIỆU + ĐỘ ĐẦY ĐỦ — logic thuần, client import được.
 *
 * Dòng lệnh được nạp sẵn từ HỒ SƠ SP + DÒNG ĐƠN (`draftFromOrders`), nhưng màn
 * soạn dòng không cho Sales biết ô nào máy điền, ô nào tự nhập, ô nào đã lệch
 * khỏi hồ sơ. File này khai một lần các luật đó để màn soạn (client) và gate
 * gửi duyệt (server) dùng CHUNG — hai bên lệch nhau là lỗi khó thấy nhất.
 *
 * ── ĐỦ THÔNG TIN (chốt 06/08/2026) ───────────────────────────────────────────
 * Mức A — BẮT BUỘC, chặn gửi GĐ duyệt: mã SP · số lượng > 0 · ĐVT.
 *   DB cho ba trường này rỗng (`default ''`/`0`) vì bản nháp phải lưu được dở,
 *   nên chốt chặn buộc phải nằm ở tầng gửi duyệt. Dòng thiếu chúng là dòng rác:
 *   xưởng không biết làm gì, mà nó vẫn sinh job và vẫn cộng vào tổng phiếu.
 *
 * Mức B — NÊN CÓ, chỉ cảnh báo: vật liệu · đóng gói · CBM · đợt xuất · kiểm tra
 *   hồ sơ · tên tiếng Việt. Không chặn vì triết lý sẵn có của lệnh (0114): mã SP
 *   được phép là "Thông báo sau", checklist là TEXT chứ không phải boolean,
 *   lệch số lượng thì cảnh báo không chặn.
 *
 * Vật liệu CHỈ đòi những spec mà HỒ SƠ SP có giá trị: ghế nhôm không có Kính/Gỗ,
 * đòi đủ 5 ô là tạo báo động giả rồi Sales học cách phớt lờ cảnh báo.
 *
 * `name_foreign`/`barcode`/`customer_item_code` KHÔNG tính vào độ đủ của dòng —
 * chúng thuần tuý là bản sao hồ sơ SP, thiếu là lỗi HỒ SƠ (báo ở kênh gap).
 *
 * ── PLACEHOLDER ("Thông báo sau", "xác nhận sau") ────────────────────────────
 * Nhận diện bằng `valueState` (dùng chung với phiếu in + Excel):
 *   · mức A: TÍNH LÀ ĐÃ ĐIỀN — chặn nó là chặn một luồng nghiệp vụ hợp lệ;
 *   · mức B: đếm riêng thành "chờ chốt" — khác hẳn "còn trống": một cái Sales
 *     đã biết và đang chờ khách, một cái Sales quên.
 *   · "Không"/"thiếu…" ở cột kiểm tra = ĐÃ TRẢ LỜI, không phải thiếu. Tính là
 *     thiếu thì Sales sẽ gõ "Có" giả để tắt cảnh báo — phản tác dụng.
 */

/** Ánh xạ tech_spec cũ (machine/cushion/…) sang khoá spec của mẫu chuẩn. */
export const SPEC_FROM_PRODUCT: Record<string, string> = {
  machine: 'may', // "machine" là tên cũ đặt sai — dữ liệu vốn là MÂY/dây đan
  cushion: 'nem',
  paint: 'son',
  glass: 'kinh',
  wood: 'go',
}

/** Tab hồ sơ SP chứa trường đang thiếu — để dẫn Sales tới đúng chỗ sửa. */
export type ProfileTab = 'thong-so' | 'dong-goi'

export type ProfileGapKey =
  'name_foreign' | 'barcode' | 'may' | 'nem' | 'son' | 'kinh' | 'go' | 'packing' | 'cbm'

export type ProfileGap = { key: ProfileGapKey; label: string; tab: ProfileTab }

/** Map khoá → tab: dùng KHOÁ chứ không nhãn tiếng Việt (nhãn đổi là hỏng link). */
export const GAP_TAB: Record<ProfileGapKey, ProfileTab> = {
  name_foreign: 'thong-so',
  barcode: 'thong-so',
  may: 'thong-so',
  nem: 'thong-so',
  son: 'thong-so',
  kinh: 'thong-so',
  go: 'thong-so',
  packing: 'dong-goi',
  cbm: 'dong-goi',
}

export const TAB_LABEL: Record<ProfileTab, string> = {
  'thong-so': 'Thông số',
  'dong-goi': 'Đóng gói',
}

/**
 * Ảnh chụp hồ sơ SP đã chuẩn hoá về ĐÚNG DẠNG dòng lệnh — để so ô-với-ô.
 * Phải sinh bằng chính hàm mà `draftFromOrders` dùng, nếu không hai bên trôi
 * lệch và mọi ô sẽ hiện "khác hồ sơ" một cách sai.
 */
export type ProfileSnapshot = {
  specs: Record<string, string>
  name_foreign: string | null
  barcode: string | null
  customer_item_code: string | null
  /** Chuỗi "4 cái/thùng" — dựng bằng `packingText`. */
  packing: string | null
  cbm: number | null
  gaps: ProfileGap[]
}

export type ProfileMap = Record<string, ProfileSnapshot>

/** Dòng lệnh ở dạng tối thiểu mà các hàm dưới cần (client truyền bản đang sửa). */
export type LineLike = {
  product_id?: string | null
  sales_order_line_id?: string | null
  product_code?: string | null
  customer_item_code?: string | null
  name_foreign?: string | null
  name_vi?: string | null
  barcode?: string | null
  unit?: string | null
  qty?: number | null
  packing?: string | null
  cbm?: number | null
  ship_date?: string | null
  ship_label?: string | null
  specs?: Record<string, string> | null
  checks?: Record<string, string> | null
}

/* ── Dựng / phân tích giá trị ───────────────────────────────────────────────── */

/** "4 cái/thùng" — một khuôn duy nhất cho cả nạp dòng lẫn dữ liệu tham chiếu. */
export function packingText(
  qty?: number | null,
  unit?: string | null,
  label?: string | null,
): string | null {
  if (!qty) return null
  return `${qty} ${(unit ?? '').trim() || 'cái'}/${(label ?? '').trim() || 'thùng'}`
}

/**
 * Tách "4 cái/thùng" → { qty: 4, label: 'thùng' }. Chấp mọi biến thể khoảng
 * trắng Sales gõ tay ("4 cái / thùng", "12/ Thùng"); không khớp → null.
 */
export function parsePacking(s?: string | null): { qty: number; label: string } | null {
  const m = (s ?? '').trim().match(/^(\d+)[^/]*\/\s*(.+)$/)
  if (!m) return null
  return { qty: Number(m[1]), label: m[2].trim() }
}

const norm = (v?: string | null) => (v ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

/** So đóng gói theo Ý NGHĨA (số + nhãn kiện), không so chuỗi thô. */
export function samePacking(a?: string | null, b?: string | null): boolean {
  const pa = parsePacking(a)
  const pb = parsePacking(b)
  if (pa && pb) return pa.qty === pb.qty && norm(pa.label) === norm(pb.label)
  return norm(a) === norm(b)
}

/**
 * So CBM có dung sai: hồ sơ tính `L*W*H/1e6` ra 0.5760000000000001 còn dòng lưu
 * 0.576 — so bằng `===` là báo "khác hồ sơ" cho hầu hết SP. Phiếu in cũng chỉ
 * hiện 3 chữ số thập phân nên lệch dưới ngưỡng đó là không ai thấy.
 */
export function sameCbm(a?: number | null, b?: number | null): boolean {
  if (a == null || b == null) return a == null && b == null
  return Math.abs(a - b) <= 5e-4
}

/* ── Nguồn của một ô ────────────────────────────────────────────────────────── */

export type FieldOrigin =
  /** giống hệt hồ sơ SP */
  | 'profile'
  /** hồ sơ có giá trị nhưng dòng ghi khác (Sales sửa, HOẶC hồ sơ đổi sau) */
  | 'edited'
  /** hồ sơ trống — giá trị này là của riêng dòng */
  | 'own'
  /** sinh từ dòng đơn hàng, không có nguồn hồ sơ để so */
  | 'order'
  | null

export function originOf(
  value: string | null | undefined,
  ref: string | null | undefined,
): FieldOrigin {
  const hasRef = !!(ref ?? '').trim()
  if (!hasRef) return 'own'
  return norm(value) === norm(ref) ? 'profile' : 'edited'
}

/**
 * Nguồn của từng ô trong một dòng. Các trường sinh từ ĐƠN (qty/unit/name_vi/…)
 * gắn nhãn tĩnh 'order' — đọc lại dòng đơn để so là thêm một query cho thông
 * tin mà Sales vốn được sửa tự do.
 */
export function lineOrigins(
  l: LineLike,
  snap?: ProfileSnapshot,
): Record<string, FieldOrigin> {
  const fromOrder: FieldOrigin = l.sales_order_line_id ? 'order' : null
  const out: Record<string, FieldOrigin> = {
    product_code: fromOrder,
    name_vi: fromOrder,
    unit: fromOrder,
    qty: fromOrder,
    // Sales tự nhập, không nguồn nào khác.
    ship_label: null,
    note: null,
  }
  if (!snap) return out

  out.customer_item_code = originOf(l.customer_item_code, snap.customer_item_code)
  out.name_foreign = originOf(l.name_foreign, snap.name_foreign)
  out.barcode = originOf(l.barcode, snap.barcode)
  for (const specKey of Object.values(SPEC_FROM_PRODUCT)) {
    out[`spec.${specKey}`] = originOf(l.specs?.[specKey], snap.specs[specKey])
  }
  out.packing = !snap.packing
    ? 'own'
    : samePacking(l.packing, snap.packing)
      ? 'profile'
      : 'edited'
  out.cbm =
    snap.cbm == null ? 'own' : sameCbm(l.cbm ?? null, snap.cbm) ? 'profile' : 'edited'
  return out
}

/* ── Độ đầy đủ của một dòng ─────────────────────────────────────────────────── */

export type MeterState = 'ok' | 'partial' | 'missing'
export type Issue = { key: string; label: string }
export type Meter = { key: string; label: string; state: MeterState; title: string }

export type LineReadiness = {
  level: 'block' | 'warn' | 'ok'
  /** Mức A — thiếu là không gửi duyệt được. */
  blocking: Issue[]
  /** Mức B — thiếu chỉ cảnh báo. */
  warn: Issue[]
  /** Số ô đang ghi placeholder ("xác nhận sau") — đã khai là CHƯA CHỐT. */
  pending: number
  meters: Meter[]
}

export type ReadinessOpts = {
  /** Khoá spec của mẫu cột khách (thường may/nem/son/kinh/go). */
  specKeys: { key: string; label: string }[]
  /** Khoá checklist hồ sơ (bom/ban_ve/mau/showroom). */
  checkKeys: { key: string; label: string }[]
  /** Mẫu cột có cột CBM hay không — không có thì thiếu CBM cũng chẳng sao. */
  needCbm: boolean
}

/** Ô có chữ, và chữ đó không phải placeholder "chờ chốt". */
const settled = (v?: string | null) => {
  const t = (v ?? '').trim()
  return !!t && valueState(t, false) !== 'pending'
}
const isPending = (v?: string | null) => {
  const t = (v ?? '').trim()
  return !!t && valueState(t, false) === 'pending'
}

/**
 * MỨC A — thiếu là không gửi duyệt được. Tách riêng vì SERVER chốt bằng đúng
 * hàm này (`lsxService.submit`): chặn chỉ ở client thì lách được qua API và bug
 * UI sẽ lọt thẳng xuống xưởng. Placeholder ("Thông báo sau") vẫn tính là đã
 * điền — chỉ ô RỖNG mới chặn.
 */
export function blockingIssues(l: LineLike): Issue[] {
  const out: Issue[] = []
  if (!(l.product_code ?? '').trim()) out.push({ key: 'product_code', label: 'Mã SP' })
  if (!(Number(l.qty) > 0)) out.push({ key: 'qty', label: 'Số lượng' })
  if (!(l.unit ?? '').trim()) out.push({ key: 'unit', label: 'ĐVT' })
  return out
}

export function lineReadiness(
  l: LineLike,
  snap: ProfileSnapshot | undefined,
  opts: ReadinessOpts,
): LineReadiness {
  const blocking = blockingIssues(l)
  const warn: Issue[] = []
  let pending = 0

  const countPending = (v?: string | null) => {
    if (isPending(v)) pending++
  }

  // ── Vật liệu: chỉ đòi spec mà HỒ SƠ SP có giá trị; không có hồ sơ thì đòi ≥1.
  const wanted = opts.specKeys.filter((c) => !snap || !!(snap.specs[c.key] ?? '').trim())
  const specMissing: string[] = []
  for (const c of opts.specKeys) {
    countPending(l.specs?.[c.key])
  }
  for (const c of wanted) {
    if (!settled(l.specs?.[c.key])) specMissing.push(c.label)
  }
  const anySpec = opts.specKeys.some((c) => settled(l.specs?.[c.key]))
  const specOk = wanted.length ? specMissing.length === 0 : anySpec
  if (!specOk) {
    warn.push({
      key: 'specs',
      label: specMissing.length ? `Vật liệu (${specMissing.join(', ')})` : 'Vật liệu',
    })
  }

  // ── Đóng gói + CBM.
  countPending(l.packing)
  const packOk = settled(l.packing)
  if (!packOk) warn.push({ key: 'packing', label: 'Đóng gói' })
  const cbmOk = !opts.needCbm || (l.cbm != null && l.cbm > 0)
  if (!cbmOk) warn.push({ key: 'cbm', label: 'CBM' })

  // ── Đợt xuất.
  countPending(l.ship_label)
  const shipOk = settled(l.ship_label) || !!(l.ship_date ?? '').trim()
  if (!shipOk) warn.push({ key: 'ship', label: 'Đợt xuất' })

  // ── Kiểm tra hồ sơ: "Không" cũng là đã trả lời.
  const checkAnswered = opts.checkKeys.filter((c) => !!(l.checks?.[c.key] ?? '').trim())
  if (checkAnswered.length < opts.checkKeys.length) {
    warn.push({
      key: 'checks',
      label: `Kiểm tra hồ sơ (${checkAnswered.length}/${opts.checkKeys.length})`,
    })
  }

  // ── Tên tiếng Việt (thường có sẵn từ đơn; cảnh báo cho dòng thêm tay).
  if (!settled(l.name_vi)) warn.push({ key: 'name_vi', label: 'Tên tiếng Việt' })

  const meters: Meter[] = [
    {
      key: 'specs',
      label: 'Vật liệu',
      state: specOk ? 'ok' : anySpec ? 'partial' : 'missing',
      title: specOk
        ? `Vật liệu: đủ (${opts.specKeys
            .filter((c) => settled(l.specs?.[c.key]))
            .map((c) => c.label)
            .join(' · ')})`
        : specMissing.length
          ? `Vật liệu: thiếu ${specMissing.join(' · ')} — hồ sơ SP có giá trị này`
          : 'Vật liệu: chưa có ô nào',
    },
    {
      key: 'packing',
      label: 'Đóng gói',
      state: packOk && cbmOk ? 'ok' : packOk || cbmOk ? 'partial' : 'missing',
      title: [
        packOk ? `Đóng gói: ${l.packing}` : 'Đóng gói: chưa có',
        opts.needCbm ? (cbmOk ? `CBM: ${l.cbm}` : 'CBM: chưa có') : null,
      ]
        .filter(Boolean)
        .join(' · '),
    },
    {
      key: 'ship',
      label: 'Đợt xuất',
      state: shipOk ? 'ok' : 'missing',
      title: shipOk
        ? `Đợt xuất: ${l.ship_label || l.ship_date}`
        : 'Đợt xuất: chưa có — cột này bôi đỏ trên phiếu',
    },
    {
      key: 'checks',
      label: 'Kiểm tra hồ sơ',
      state:
        checkAnswered.length === opts.checkKeys.length
          ? 'ok'
          : checkAnswered.length
            ? 'partial'
            : 'missing',
      title: `Kiểm tra hồ sơ: đã trả lời ${checkAnswered.length}/${opts.checkKeys.length}${
        checkAnswered.length
          ? ` (${checkAnswered.map((c) => `${c.label}: ${l.checks?.[c.key]}`).join(' · ')})`
          : ''
      }`,
    },
  ]

  return {
    level: blocking.length ? 'block' : warn.length ? 'warn' : 'ok',
    blocking,
    warn,
    pending,
    meters,
  }
}

/* ── Tổng hợp cả phiếu ──────────────────────────────────────────────────────── */

export type SheetRef = { groupTitle: string; index: number; code: string; issues: string }

export type SheetReadiness = {
  total: number
  ok: number
  pending: number
  blocked: SheetRef[]
  warned: SheetRef[]
}

export function sheetReadiness(
  rows: { groupTitle: string; index: number; line: LineLike; readiness: LineReadiness }[],
): SheetReadiness {
  const blocked: SheetRef[] = []
  const warned: SheetRef[] = []
  let ok = 0
  let pending = 0
  for (const r of rows) {
    pending += r.readiness.pending
    const ref = (issues: Issue[]): SheetRef => ({
      groupTitle: r.groupTitle,
      index: r.index,
      code: (r.line.product_code ?? '').trim() || '(chưa có mã)',
      issues: issues.map((i) => i.label).join(', '),
    })
    if (r.readiness.level === 'block') blocked.push(ref(r.readiness.blocking))
    else if (r.readiness.level === 'warn') warned.push(ref(r.readiness.warn))
    else ok++
  }
  return { total: rows.length, ok, pending, blocked, warned }
}
