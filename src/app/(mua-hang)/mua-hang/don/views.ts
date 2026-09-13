import {
  EMPTY_FILTER,
  PO_BUCKETS,
  type PoBucket,
  type PoFilterState,
} from '@/app/(workspace)/planning/pos/po-filter'
import type { Po } from '@/app/(workspace)/planning/pos/po-types'
import { PO_STATUS_LABEL, type PoStatus } from '@/lib/po-status'

/**
 * KHUNG NHÌN CÓ TÊN — chép SAP variant / Dynamics saved view / Odoo favorite.
 *
 * Xem `docs/mua-hang-phieu-mua.md` §4.2. Ba điều màn cũ thiếu mà bốn hệ lớn
 * đều có: khung nhìn ĐẶT TÊN để nhớ, MÃ TRÊN URL để gửi link, và GOM NHÓM là
 * một điều khiển thay vì hai màn cứng.
 *
 * File này THUẦN: chỉ dữ liệu + hàm mã hoá/giải mã URL + hàm gom. Không React.
 * Lọc thì dùng lại `poMatches` của màn cũ — luật khớp đã có test, không viết
 * bản thứ hai.
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

export type NamedView = {
  id: string
  label: string
  /** Vì sao có khung nhìn này — hiện dưới tên trong menu. */
  hint: string
  state: ViewState
}

const base = (over: Partial<PoFilterState>): PoFilterState => ({
  ...EMPTY_FILTER,
  ...over,
})

/**
 * BẢY KHUNG NHÌN ĐẶT SẴN. Mỗi cái thay cho đúng một ô số / tab / chip của màn
 * cũ (bảng đối chiếu ở §4.2 của tài liệu), và thêm câu hỏi mà màn cũ không
 * hỏi được — "NCC trễ hẹn, gom theo NCC để gọi điện".
 */
export const NAMED_VIEWS: NamedView[] = [
  {
    id: 'toi',
    label: 'Đơn của tôi',
    hint: 'Mọi đơn tôi phụ trách, xếp theo lệnh',
    state: { filter: base({ mine: true }), groupBy: 'lsx', sortBy: 'moi_nhat' },
  },
  {
    id: 'cho-duyet',
    label: 'Chờ duyệt',
    hint: 'Đang nằm bàn Giám đốc',
    state: { filter: base({ bucket: 'pending' }), groupBy: 'none', sortBy: 'moi_nhat' },
  },
  {
    id: 'chua-gui',
    label: 'Đã duyệt · chưa gửi NCC',
    hint: 'Ký rồi mà chưa ra khỏi cửa — chỗ đơn nằm im lâu nhất',
    state: { filter: base({ bucket: 'ready' }), groupBy: 'ncc', sortBy: 'moi_nhat' },
  },
  {
    id: 'tre',
    label: 'NCC trễ hẹn',
    hint: 'Đã gửi, qua ngày hẹn chưa về đủ — gom theo NCC để gọi',
    state: { filter: base({ bucket: 'inflight', late: true }), groupBy: 'ncc', sortBy: 'hen_gan' }, // prettier-ignore
  },
  {
    id: 'dang-ve',
    label: 'Đang về',
    hint: 'Xếp theo tuần hẹn giao để chuẩn bị nhận',
    state: {
      filter: base({ bucket: 'inflight' }),
      groupBy: 'tuan_hen',
      sortBy: 'hen_gan',
    },
  },
  {
    id: 'chua-hen',
    label: 'Chưa hẹn giao',
    hint: 'Đơn đang mở mà không có ngày — mọi cảnh báo trễ đều bỏ qua',
    state: { filter: base({ noEta: true }), groupBy: 'none', sortBy: 'moi_nhat' },
  },
  {
    id: 'tat-ca',
    label: 'Tất cả',
    hint: 'Toàn bộ sổ, xếp theo lệnh',
    state: { filter: base({}), groupBy: 'lsx', sortBy: 'moi_nhat' },
  },
]

export const DEFAULT_VIEW_ID = 'toi'

export function namedView(id: string | null | undefined): NamedView | null {
  return NAMED_VIEWS.find((v) => v.id === id) ?? null
}

/** Trạng thái đang xem có TRÙNG HỆT một khung nhìn đặt sẵn không → trả id. */
export function matchNamedView(s: ViewState): string | null {
  const hit = NAMED_VIEWS.find((v) => sameState(v.state, s))
  return hit?.id ?? null
}

function sameState(a: ViewState, b: ViewState): boolean {
  const f = a.filter
  const g = b.filter
  return (
    a.groupBy === b.groupBy &&
    a.sortBy === b.sortBy &&
    f.q.trim() === g.q.trim() &&
    f.bucket === g.bucket &&
    f.supplierId === g.supplierId &&
    f.type === g.type &&
    f.mine === g.mine &&
    f.late === g.late &&
    f.noEta === g.noEta
  )
}

/* ── URL ────────────────────────────────────────────────────────────────
   Khung nhìn đặt sẵn → `?nhin=<id>`. Sửa đi thì rớt về dạng đầy đủ để vẫn gửi
   link được. Tên tham số tiếng Việt không dấu, ngắn, đọc được trên thanh địa
   chỉ — người dùng ERP dán link vào Zalo suốt. */

const BUCKETS = new Set<string>(['all', ...PO_BUCKETS.map((b) => b.key)])
const GROUPS = new Set<string>(Object.keys(GROUP_LABEL))
const SORTS = new Set<string>(Object.keys(SORT_LABEL))

export function decodeView(sp: Record<string, string | undefined>): ViewState {
  const named = namedView(sp.nhin)
  if (named) return named.state
  const f: PoFilterState = {
    q: sp.q ?? '',
    bucket: (BUCKETS.has(sp.trang_thai ?? '') ? sp.trang_thai : 'all') as PoBucket,
    supplierId: sp.ncc ?? 'all',
    type: sp.loai === 'lsx' || sp.loai === 'standalone' ? sp.loai : 'all',
    mine: sp.toi === '1',
    late: sp.tre === '1',
    noEta: sp.chua_hen === '1',
  }
  return {
    filter: f,
    groupBy: (GROUPS.has(sp.gom ?? '') ? sp.gom : 'none') as GroupBy,
    sortBy: (SORTS.has(sp.sap ?? '') ? sp.sap : 'moi_nhat') as SortBy,
  }
}

export function encodeView(s: ViewState): string {
  const named = matchNamedView(s)
  const p = new URLSearchParams()
  if (named) {
    p.set('nhin', named)
    return p.toString()
  }
  const f = s.filter
  if (f.q.trim()) p.set('q', f.q.trim())
  if (f.bucket !== 'all') p.set('trang_thai', f.bucket)
  if (f.supplierId !== 'all') p.set('ncc', f.supplierId)
  if (f.type !== 'all') p.set('loai', f.type)
  if (f.mine) p.set('toi', '1')
  if (f.late) p.set('tre', '1')
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
