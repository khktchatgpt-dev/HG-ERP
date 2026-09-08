import type { PoStatus } from '@/lib/po-status'

/**
 * LÕI LUỒNG — thuần, không React, test được.
 *
 * Đặt ở đây chứ không nội trong component vì cùng một câu trả lời phải dùng
 * được ở BA nơi: trang chi tiết chứng từ, cột "ai giữ" trên bảng danh sách,
 * và màn "Chờ tôi xử lý". Tính ở ba chỗ thì ba chỗ lệch nhau — đúng thứ làm
 * người dùng hết tin hệ thống.
 */

/** Ai đang giữ bóng. */
export type Holder = {
  /** Bộ phận/người đang giữ, viết như người ta gọi nhau ở công ty. */
  who: string
  /** Việc phải làm, lời nghiệp vụ chứ không phải tên trạng thái. */
  what: string
  /** Mốc bắt đầu nằm ở bước này — để đếm "đã bao nhiêu ngày". */
  since: string | null
  /** Có phải người đang xem không. */
  mine: boolean
}

export type PoLike = {
  /*
    KIỂU CHẶT, KHÔNG PHẢI `string`.

    Bản đầu khai `status: string` nên TypeScript không kêu gì khi tôi viết
    'partially_received' — trong khi hệ thống dùng 'partial' — và bỏ sót hẳn
    'confirmed' + 'in_transit'. Ba trạng thái đó rơi vào `default` và màn
    hình hiện "—" rỗng thay vì nói ai đang giữ đơn. Lỗi câm, test tự viết
    cũng không bắt được vì tôi bịa tên theo trí nhớ chứ không đọc
    `PO_STATUSES`.

    Dùng đúng kiểu của lib thì thiếu nhánh nào là `satisfies` chỉ ngay.
  */
  status: PoStatus | (string & {})
  created_at?: string | null
  created_by?: string | null
  assigned_to?: string | null
  approved_at?: string | null
  ordered_at?: string | null
  confirmed_at?: string | null
  updated_at?: string | null
  expected_at?: string | null
}

/**
 * AI ĐANG GIỮ ĐƠN.
 *
 * Trả về cả `since` để màn hình đếm ngày — "chờ duyệt" 1 tiếng và "chờ
 * duyệt" 9 ngày là hai tình huống khác hẳn nhau mà tên trạng thái giấu mất.
 */
export function poHolder(po: PoLike, meId: string | null): Holder {
  switch (po.status) {
    case 'draft':
      return {
        who: 'Cung ứng',
        what: 'Soạn xong thì gửi Giám đốc duyệt',
        since: po.updated_at ?? po.created_at ?? null,
        mine: !!meId && (po.assigned_to === meId || po.created_by === meId),
      }
    case 'pending_approval':
      return {
        who: 'Giám đốc',
        what: 'Chờ Giám đốc duyệt hoặc từ chối',
        since: po.updated_at ?? null,
        // Người soạn KHÔNG phải người giữ bóng ở bước này — nói "đến lượt
        // bạn" với họ là đẩy họ đi giục nhầm chỗ.
        mine: false,
      }
    case 'approved':
      return {
        who: 'Cung ứng',
        what: 'Đã duyệt — gửi đơn cho nhà cung cấp',
        since: po.approved_at ?? null,
        mine: !!meId && (po.assigned_to === meId || po.created_by === meId),
      }
    case 'ordered':
      return {
        who: 'Nhà cung cấp',
        what: 'Chờ NCC xác nhận đã nhận đơn',
        since: po.ordered_at ?? null,
        mine: false,
      }
    case 'confirmed':
      return {
        who: 'Nhà cung cấp',
        what: 'NCC đã nhận đơn — chờ xếp hàng giao',
        since: po.confirmed_at ?? null,
        mine: false,
      }
    case 'in_transit':
      return {
        who: 'Nhà cung cấp',
        what: 'Hàng đang trên đường — Kho nhận khi xe tới',
        since: po.updated_at ?? null,
        mine: false,
      }
    // Tên đúng trong `PO_STATUSES` là 'partial', KHÔNG phải
    // 'partially_received' — viết theo trí nhớ là rơi vào default.
    case 'partial':
      return {
        who: 'Kho',
        what: 'Còn dòng chưa về — Kho nhận tiếp khi hàng tới',
        since: po.updated_at ?? null,
        mine: false,
      }
    case 'received':
      return { who: '—', what: 'Đơn đã xong', since: po.updated_at ?? null, mine: false }
    case 'cancelled':
      return { who: '—', what: 'Đơn đã huỷ', since: po.updated_at ?? null, mine: false }
    default:
      return { who: '—', what: '', since: null, mine: false }
  }
}

/** Số ngày nằm ở bước hiện tại. null = không rõ mốc. */
export function daysHeld(since: string | null, now: Date = new Date()): number | null {
  if (!since) return null
  const d = Math.floor((now.getTime() - new Date(since).getTime()) / 86400000)
  return d < 0 ? 0 : d
}

/**
 * Nằm im quá lâu?
 *
 * 3 ngày: một chứng từ nằm qua cuối tuần là bình thường; sang ngày thứ ba
 * thì nhiều khả năng người giữ nó KHÔNG BIẾT là mình đang giữ. Đó mới là
 * lúc đáng báo, không phải ngay khi vừa gửi đi.
 */
export function isStale(since: string | null, now: Date = new Date()): boolean {
  const d = daysHeld(since, now)
  return d != null && d >= 3
}

export type FlowMark = {
  key: string
  at: string | null
  label: string
  actor?: string | null
  detail?: string | null
  tone?: 'act' | 'done' | 'warn' | 'stop'
}

/**
 * DỰNG DÒNG THỜI GIAN TỪ CHÍNH CÁC MỐC CÓ SẴN trên đơn.
 *
 * Không cần bảng sự kiện riêng: đơn đã có created_at / approved_at /
 * ordered_at / confirmed_at. Bản v3 bỏ sót `created_at` nên đơn nháp — vốn
 * có đủ dữ liệu — vẫn ra "0 mốc", rồi empty state đổ lỗi "chưa phát sinh sự
 * kiện nào". Một chứng từ tồn tại thì ít nhất đã có người tạo ra nó.
 *
 * Mốc CHƯA xảy ra vẫn trả về với `at: null` để màn hình bày mờ — người đọc
 * thấy còn mấy bước nữa mà không cần thuộc quy trình.
 */
export function buildPoMarks(
  po: PoLike,
  opts: { creatorName?: string | null; approverName?: string | null } = {},
): FlowMark[] {
  const huy = po.status === 'cancelled'
  return [
    {
      key: 'created',
      at: po.created_at ?? null,
      label: 'Soạn đơn',
      actor: opts.creatorName ?? null,
      tone: 'act',
    },
    {
      key: 'submitted',
      // Không có mốc gửi duyệt riêng trong DB: khi đơn ĐANG chờ duyệt thì
      // updated_at chính là lúc gửi. Suy ra chứ không bịa thêm cột.
      at: po.status === 'pending_approval' ? (po.updated_at ?? null) : null,
      label: 'Gửi Giám đốc duyệt',
      tone: 'act',
    },
    {
      key: 'approved',
      at: po.approved_at ?? null,
      label: 'Giám đốc duyệt',
      actor: opts.approverName ?? null,
      tone: 'done',
    },
    { key: 'ordered', at: po.ordered_at ?? null, label: 'Gửi nhà cung cấp', tone: 'act' },
    {
      key: 'confirmed',
      at: po.confirmed_at ?? null,
      label: 'NCC xác nhận đơn',
      tone: 'done',
    },
    {
      key: 'in_transit',
      // Không có cột mốc riêng cho lúc hàng lên đường: khi đơn ĐANG ở
      // 'in_transit' thì updated_at chính là lúc đó. Suy ra, không bịa cột.
      at: po.status === 'in_transit' ? (po.updated_at ?? null) : null,
      label: 'Hàng lên đường',
      tone: 'act',
    },
    ...(huy
      ? [
          {
            key: 'cancelled',
            at: po.updated_at ?? null,
            label: 'Đơn bị huỷ',
            tone: 'stop' as const,
          },
        ]
      : []),
  ]
}
