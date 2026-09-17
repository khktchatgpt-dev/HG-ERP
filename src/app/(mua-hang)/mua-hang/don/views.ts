import {
  EMPTY_FILTER,
  PO_BUCKETS,
  type PoBucket,
  type PoFilterState,
} from '@/app/(workspace)/planning/pos/po-filter'
import type { Po } from '@/app/(workspace)/planning/pos/po-types'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'

/**
 * TRẠNG THÁI XEM của màn Phiếu mua — bộ lọc + gom + sắp, mã hoá lên URL.
 *
 * File này THUẦN: chỉ dữ liệu + hàm mã hoá/giải mã URL + hàm gom. Không React.
 * Lọc thì dùng lại `poMatches` của màn cũ — luật khớp đã có test, không viết
 * bản thứ hai.
 *
 * KHUNG NHÌN ĐẶT TÊN ĐÃ GỠ (16/09/2026). Bảy khung nhìn đặt sẵn từng đứng ở
 * đầu thanh lọc, chép SAP variant / Dynamics saved view. Chủ dự án chốt là
 * không dùng tới chúng — và chúng làm màn rối theo một cách đo được: mỗi khung
 * nhìn gói sẵn lọc+gom+sắp, nhưng MỌI mảnh của nó vẫn bày rời ngay cạnh (chip
 * "Của tôi", ô "Rổ trạng thái", ô "Gom theo"), nên một việc có hai đường làm,
 * và động vào ô nào thì khung nhìn rơi về "tuỳ chỉnh" — người dùng không bao
 * giờ biết mình đang đứng ở đâu.
 *
 * Đường lùi: `git revert`. Bỏ chúng KHÔNG mất khả năng gửi link — `encodeView`
 * vốn đã sinh dạng đầy đủ (`?toi=1&gom=lsx`) cho mọi trạng thái không trùng
 * khung nhìn nào, và đó giờ là dạng duy nhất.
 */

export type GroupBy = 'none' | 'lsx' | 'ncc' | 'trang_thai' | 'phu_trach' | 'tuan_hen'
export type SortBy = 'moi_nhat' | 'hen_gan' | 'tien' | 'ma'

export const GROUP_LABEL: Record<GroupBy, string> = {
  none: 'Không gom',
  lsx: 'Lệnh sản xuất',
  ncc: 'Nhà cung cấp',
  trang_thai: 'Trạng thái',
  phu_trach: 'Người phụ trách',
  tuan_hen: 'Tuần hẹn giao',
}

export const SORT_LABEL: Record<SortBy, string> = {
  moi_nhat: 'Mới tạo trước',
  hen_gan: 'Hẹn giao gần trước',
  tien: 'Giá trị lớn trước',
  ma: 'Theo mã đơn',
}

export type ViewState = {
  filter: PoFilterState
  groupBy: GroupBy
  sortBy: SortBy
}

/* ── MẶC ĐỊNH ───────────────────────────────────────────────────────────
   Hai trạng thái xuất phát, thay cho hai khung nhìn đặt sẵn đã gỡ. Giữ ĐÚNG
   hành vi cũ, chỉ hết đi qua một cái tên. */

const base = (over: Partial<PoFilterState>): PoFilterState => ({
  ...EMPTY_FILTER,
  ...over,
})

/**
 * CẢ SỔ, gom theo lệnh sản xuất. Vừa là trạng thái vào trang, vừa là chỗ nút
 * "Xem tất cả" ở trạng thái rỗng nhảy về.
 *
 * KHÔNG TỰ LỌC `mine` NỮA (16/09/2026). Trước đó vào trang là đã lọc sẵn "đơn
 * tôi phụ trách" — chủ dự án chốt bỏ, và có lý do đo được: sổ 67 đơn mà màn mở
 * ra chỉ thấy 2, không có gì nói rõ vì sao, nên người dùng đọc thành "hệ thống
 * mất đơn" chứ không đọc thành "đang lọc". Ai muốn xem việc của mình thì bấm
 * thẻ "Của tôi" ở đầu trang — một cú bấm, và lúc đó họ BIẾT mình đang lọc.
 *
 * Gom theo lệnh thì GIỮ: gom không giấu dòng nào, và nó trả lời đúng câu "đơn
 * nào của lệnh nào".
 */
export const DEFAULT_VIEW: ViewState = {
  filter: base({}),
  groupBy: 'lsx',
  sortBy: 'moi_nhat',
}

/** Cùng một thứ, tên riêng cho chỗ gọi nói rõ ý "về cả sổ". */
export const ALL_VIEW = DEFAULT_VIEW

/* ── URL ────────────────────────────────────────────────────────────────
   Mọi trạng thái xem đều mã hoá thành tham số đầy đủ (`?toi=1&gom=lsx`). Tên
   tham số tiếng Việt không dấu, ngắn, đọc được trên thanh địa chỉ — người
   dùng ERP dán link vào Zalo suốt. */

const BUCKETS = new Set<string>(['all', ...PO_BUCKETS.map((b) => b.key)])
const GROUPS = new Set<string>(Object.keys(GROUP_LABEL))
const SORTS = new Set<string>(Object.keys(SORT_LABEL))

/**
 * Ngày hợp lệ trên URL — chỉ yyyy-mm-dd.
 *
 * Viết bằng `String.raw` vì regex này từng bị công cụ sửa file nuốt mất dấu
 * `\`, thành `/^d{4}-d{2}-d{2}$/` — không khớp gì và HỎNG IM LẶNG: bộ lọc ngày
 * trên URL luôn bị coi là rỗng, không lỗi nào nổi lên. Cùng hạng bẫy đã ghi
 * trong CLAUDE.md cho regex của luật ESLint.
 */
const YMD = new RegExp(String.raw`^\d{4}-\d{2}-\d{2}$`)
const isYmd = (v?: string): boolean => !!v && YMD.test(v)

export function decodeView(sp: Record<string, string | undefined>): ViewState {
  const f: PoFilterState = {
    q: sp.q ?? '',
    bucket: (BUCKETS.has(sp.trang_thai ?? '') ? sp.trang_thai : 'all') as PoBucket,
    supplierId: sp.ncc ?? 'all',
    lsxId: sp.lsx ?? 'all',
    type: sp.loai === 'lsx' || sp.loai === 'standalone' ? sp.loai : 'all',
    // Chỉ nhận yyyy-mm-dd; rác trên thanh địa chỉ thì coi như không lọc, đừng
    // để một tham số hỏng làm màn trống trơn mà không nói gì.
    fromDate: isYmd(sp.tu) ? sp.tu! : '',
    toDate: isYmd(sp.den) ? sp.den! : '',
    mine: sp.toi === '1',
    late: sp.tre === '1',
    lateSide:
      sp.tre_ben === 'sent' || sp.tre_ben === 'unsent' ? sp.tre_ben : ('any' as const),
    noEta: sp.chua_hen === '1',
  }
  return {
    filter: f,
    groupBy: (GROUPS.has(sp.gom ?? '') ? sp.gom : 'none') as GroupBy,
    sortBy: (SORTS.has(sp.sap ?? '') ? sp.sap : 'moi_nhat') as SortBy,
  }
}

export function encodeView(s: ViewState): string {
  const p = new URLSearchParams()
  const f = s.filter
  if (f.q.trim()) p.set('q', f.q.trim())
  if (f.bucket !== 'all') p.set('trang_thai', f.bucket)
  if (f.supplierId !== 'all') p.set('ncc', f.supplierId)
  if (f.lsxId !== 'all') p.set('lsx', f.lsxId)
  if (f.type !== 'all') p.set('loai', f.type)
  if (f.fromDate) p.set('tu', f.fromDate)
  if (f.toDate) p.set('den', f.toDate)
  if (f.mine) p.set('toi', '1')
  if (f.late) p.set('tre', '1')
  if (f.late && f.lateSide !== 'any') p.set('tre_ben', f.lateSide)
  if (f.noEta) p.set('chua_hen', '1')
  if (s.groupBy !== 'none') p.set('gom', s.groupBy)
  if (s.sortBy !== 'moi_nhat') p.set('sap', s.sortBy)
  return p.toString()
}

/* ── SẮP XẾP ─────────────────────────────────────────────────────────── */

export function sortPos(pos: Po[], by: SortBy): Po[] {
  const arr = [...pos]
  switch (by) {
    case 'hen_gan':
      // Chưa hẹn dồn xuống cuối — chúng không có chỗ trên trục thời gian.
      return arr.sort((a, b) =>
        (a.expected_at ?? '9999').localeCompare(b.expected_at ?? '9999'),
      )
    case 'tien':
      return arr.sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
    case 'ma':
      return arr.sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }))
    case 'moi_nhat':
    default:
      return arr.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
}

/* ── GOM NHÓM ──────────────────────────────────────────────────────────
   Gom theo LỆNH SX dùng `groupPosByLsx` của màn cũ (đã có test, biết tiền theo
   tệ và đơn mượn). Bốn trục còn lại đơn giản hơn nhiều nên gom ở đây. */

export type SimpleGroup = {
  key: string
  name: string
  meta: string
  pos: Po[]
}

/** Tuần ISO của một ngày yyyy-mm-dd — "Tuần 37 · 07/09–13/09". */
export function isoWeekLabel(iso: string): { key: string; label: string } {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  const day = d.getUTCDay() || 7
  const thu = new Date(d)
  thu.setUTCDate(d.getUTCDate() + 4 - day)
  const y = thu.getUTCFullYear()
  const jan1 = new Date(Date.UTC(y, 0, 1))
  const week = Math.ceil(((thu.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7)
  const mon = new Date(d)
  mon.setUTCDate(d.getUTCDate() - day + 1)
  const sun = new Date(mon)
  sun.setUTCDate(mon.getUTCDate() + 6)
  const dm = (x: Date) =>
    `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}`
  return { key: `${y}-W${String(week).padStart(2, '0')}`, label: `Tuần ${week} · ${dm(mon)}–${dm(sun)}` } // prettier-ignore
}

function money(pos: Po[]): string {
  // Tiền cộng THEO TỪNG LOẠI TIỀN, không quy đổi — cộng USD vào VND ra một con
  // số vô nghĩa mà nhìn vẫn như thật.
  const by = new Map<string, number>()
  for (const p of pos) {
    if (p.status === 'cancelled') continue
    by.set(p.currency, (by.get(p.currency) ?? 0) + (p.total ?? 0))
  }
  return [...by.entries()]
    .filter(([, v]) => v > 0)
    .map(([c, v]) => `${v.toLocaleString('vi-VN')} ${c}`)
    .join(' · ')
}

export function groupSimple(
  pos: Po[],
  by: Exclude<GroupBy, 'none' | 'lsx'>,
): SimpleGroup[] {
  // `last` là cờ tường minh thay cho mẹo ký tự '~' — so theo locale thì dấu
  // câu đứng TRƯỚC chữ số, nên nhóm "chưa hẹn" từng chui lên đầu (test bắt).
  const map = new Map<string, { name: string; order: string; last: boolean; pos: Po[] }>()
  const put = (key: string, name: string, order: string, p: Po, last = false) => {
    let g = map.get(key)
    if (!g) {
      g = { name, order, last, pos: [] }
      map.set(key, g)
    }
    g.pos.push(p)
  }
  for (const p of pos) {
    switch (by) {
      case 'ncc':
        put(p.supplier_id, p.supplier_name, p.supplier_name, p)
        break
      case 'trang_thai':
        put(p.status, PO_STATUS_LABEL[p.status as PoStatus] ?? p.status, String(STATUS_ORDER.indexOf(p.status)).padStart(2, '0'), p) // prettier-ignore
        break
      case 'phu_trach':
        put(p.assigned_to ?? '@none', p.assignee_name ?? 'Chưa giao ai', p.assignee_name ?? '', p, !p.assigned_to) // prettier-ignore
        break
      case 'tuan_hen': {
        if (!p.expected_at) {
          put('@no_eta', 'Chưa hẹn giao', '', p, true)
        } else {
          const w = isoWeekLabel(p.expected_at)
          put(w.key, w.label, w.key, p)
        }
        break
      }
    }
  }
  return [...map.entries()]
    .sort(([, a], [, b]) =>
      a.last !== b.last
        ? Number(a.last) - Number(b.last)
        : a.order.localeCompare(b.order, 'vi', { numeric: true }),
    )
    .map(([key, g]) => ({
      key,
      name: g.name,
      meta: `${g.pos.length} đơn${money(g.pos) ? ' · ' + money(g.pos) : ''}`,
      pos: g.pos,
    }))
}

const STATUS_ORDER: string[] = [
  'draft',
  'pending_approval',
  'approved',
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
  'received',
  'cancelled',
]

/**
 * MỌI TÊN THAM SỐ mà `encodeView` có thể sinh ra — suy từ chính nó.
 *
 * Trang dùng tập này để biết URL có mang bộ lọc riêng hay không. Suy ra thay
 * vì gõ tay, vì mảng gõ tay đã lỗi thời hai lần trong hai ngày (thiếu `lsx`,
 * rồi thiếu `tu`/`den`) và hỏng IM LẶNG: bấm chip thì chạy, dán link thì mất
 * bộ lọc.
 *
 * Cách suy: mã hoá một trạng thái đã bật MỌI bộ lọc rồi lấy tên khoá. Bộ lọc
 * mới quên thêm vào đây là không thể — trừ khi nó cũng quên vào `encodeView`,
 * mà lúc đó thì URL vốn đã không mang nó rồi.
 */
export const PARAM_KEYS: ReadonlySet<string> = new Set(
  new URLSearchParams(
    encodeView({
      filter: {
        q: 'x',
        bucket: 'draft',
        supplierId: 'x',
        lsxId: 'x',
        type: 'lsx',
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
        mine: true,
        late: true,
        lateSide: 'sent',
        noEta: true,
      },
      groupBy: 'ncc',
      sortBy: 'ma',
    }),
  ).keys(),
)
