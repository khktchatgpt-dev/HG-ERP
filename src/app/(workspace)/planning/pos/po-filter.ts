import { assessPoLate, isMissingEta } from '@/lib/late-risk'
import type { PoStatus } from '@/lib/po-status'
import type { Po } from './po-types'

/**
 * BỘ LỌC CỦA MÀN ĐƠN ĐẶT HÀNG — phần thuần, không dính React.
 *
 * Thiết kế lại quanh một quan sát: người mua không nghĩ theo 9 trạng thái, họ
 * nghĩ theo SÁU CHỖ ĐƠN CÓ THỂ ĐANG NẰM, mà bốn trong số đó ứng với một việc
 * phải làm:
 *
 *   Nháp                 → của tôi, chưa gửi ai      → soạn nốt rồi gửi
 *   Chờ duyệt            → đang nằm bàn Giám đốc     → chờ, hoặc rút về sửa
 *   Đã duyệt · chưa gửi  → ký rồi mà chưa ra khỏi cửa → GỬI NCC (dễ quên nhất)
 *   Đang về              → NCC đang lo               → giục khi trễ
 *   Về đủ / Đã huỷ       → đóng sổ                   → chỉ tra cứu
 *
 * `approved` được tách riêng khỏi bốn trạng thái "đang về" chính vì nó là chỗ
 * đơn hay nằm im: duyệt xong ai cũng tưởng xong. Bảng điều phối Cung ứng đã có
 * ô "Đã duyệt · chưa gửi NCC" theo đúng cách chia này.
 *
 * BA CÔNG TẮC riêng — của tôi / quá hẹn / chưa hẹn giao — nhân VỚI nhóm ở trên
 * chứ không thay nó. Bản cũ nhét "quá hẹn" và "chưa hẹn giao" vào chung ô với 9
 * trạng thái, nên câu hỏi thường gặp nhất của trưởng phòng — "đơn CHỜ DUYỆT nào
 * đang quá hẹn" — không hỏi được.
 */

export type PoBucket =
  'all' | 'draft' | 'pending' | 'ready' | 'inflight' | 'received' | 'cancelled'

export const PO_BUCKETS: {
  key: Exclude<PoBucket, 'all'>
  label: string
  statuses: readonly PoStatus[]
  /** Nhóm cần người dùng động tay — tô màu nhắc, không để lẫn với nhóm đã xong. */
  actionable?: boolean
}[] = [
  { key: 'draft', label: 'Nháp', statuses: ['draft'], actionable: true },
  {
    key: 'pending',
    label: 'Chờ duyệt',
    statuses: ['pending_approval'],
    actionable: true,
  },
  {
    key: 'ready',
    label: 'Đã duyệt · chưa gửi',
    statuses: ['approved'],
    actionable: true,
  },
  {
    key: 'inflight',
    label: 'Đang về',
    statuses: ['ordered', 'confirmed', 'in_transit', 'partial'],
  },
  { key: 'received', label: 'Về đủ', statuses: ['received'] },
  { key: 'cancelled', label: 'Đã huỷ', statuses: ['cancelled'] },
]

const BUCKET_OF = new Map<PoStatus, Exclude<PoBucket, 'all'>>(
  PO_BUCKETS.flatMap((b) => b.statuses.map((s) => [s, b.key] as const)),
)

export function bucketOf(status: PoStatus) {
  return BUCKET_OF.get(status) ?? null
}

export type PoFilterState = {
  q: string
  bucket: PoBucket
  supplierId: string
  type: 'all' | 'lsx' | 'standalone'
  /** Ba công tắc dưới đây CỘNG DỒN với nhau và với `bucket`. */
  mine: boolean
  late: boolean
  noEta: boolean
}

export const EMPTY_FILTER: PoFilterState = {
  q: '',
  bucket: 'all',
  supplierId: 'all',
  type: 'all',
  mine: false,
  late: false,
  noEta: false,
}

export function isFilterActive(f: PoFilterState): boolean {
  return (
    f.q.trim() !== '' ||
    f.bucket !== 'all' ||
    f.supplierId !== 'all' ||
    f.type !== 'all' ||
    f.mine ||
    f.late ||
    f.noEta
  )
}

export function poMatches(
  p: Po,
  f: PoFilterState,
  ctx: { meId: string | null; today: string },
): boolean {
  if (f.bucket !== 'all' && bucketOf(p.status) !== f.bucket) return false
  if (f.mine && p.assigned_to !== ctx.meId) return false
  if (f.late && assessPoLate(p, ctx.today) !== 'overdue') return false
  if (f.noEta && !isMissingEta(p)) return false
  if (f.supplierId !== 'all' && p.supplier_id !== f.supplierId) return false
  if (f.type === 'lsx' && !p.lsx_code) return false
  if (f.type === 'standalone' && p.lsx_code) return false
  const ql = f.q.trim().toLowerCase()
  // Có cả MÃ ĐƠN HÀNG của khách: người mua hay được hỏi ngược từ phía Sale
  // ("đơn 17984 đã đặt nhôm chưa"), mà bản cũ tìm mã đó không ra gì.
  if (
    ql &&
    !`${p.code} ${p.supplier_name} ${p.lsx_code ?? ''} ${p.order_code ?? ''} ${p.assignee_name ?? ''}`
      .toLowerCase()
      .includes(ql)
  )
    return false
  return true
}

export type PoCounts = Record<Exclude<PoBucket, 'all'>, number> & {
  all: number
  mine: number
  late: number
  noEta: number
}

/**
 * Số trên chip. Đếm trên TOÀN BỘ đơn, không phải trên kết quả đã lọc: chip là
 * lối đi, mà lối đi thì phải nói có bao nhiêu thứ ở đầu kia — kể cả khi bộ lọc
 * hiện tại đang giấu chúng đi.
 */
export function countPos(pos: Po[], meId: string | null, today: string): PoCounts {
  const c: PoCounts = {
    all: pos.length,
    draft: 0,
    pending: 0,
    ready: 0,
    inflight: 0,
    received: 0,
    cancelled: 0,
    mine: 0,
    late: 0,
    noEta: 0,
  }
  for (const p of pos) {
    const b = bucketOf(p.status)
    if (b) c[b]++
    if (meId && p.assigned_to === meId) c.mine++
    if (assessPoLate(p, today) === 'overdue') c.late++
    if (isMissingEta(p)) c.noEta++
  }
  return c
}
