import { hadSendStep, type PoStatus } from '@/lib/po-status'
import { ngayGioVn } from '@/lib/date-vn'

export { hadSendStep }

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
  /**
   * Lần GỬI DUYỆT cuối (approval_events 'submitted') — mốc thật của bước chờ
   * duyệt. Thiếu thì lùi về `updated_at`, vốn bị MỌI lượt sửa đặt lại đồng hồ.
   */
  submitted_at?: string | null
  /**
   * Bước TRƯỞNG PHÒNG CƯ XEM khi đơn chờ duyệt (0293, 05/11/2026). null/thiếu =
   * không áp (chưa ai giữ vai). `reviewed_at` có = bóng đã sang Giám đốc.
   */
  review?: {
    lead_ids: string[]
    lead_name: string | null
    reviewed_at: string | null
    /** Nháp bị trả lại mà NV chưa sửa — bóng ở NV (lib/po-review `traLaiNhap`). */
    tra_lai_at?: string | null
    /** Nháp còn thiếu điều kiện trình (lib/po-review `lyDoChuaTrinh`) — bóng ở NV. */
    thieu?: string | null
  } | null
}

/** Bóng ở TRƯỞNG PHÒNG CƯ (0293/0294) — với chính anh ấy là "đến lượt bạn". */
function choTruongPhongGiu(
  r: NonNullable<PoLike['review']>,
  since: string | null,
  meId: string | null,
): Holder {
  const mine = !!meId && r.lead_ids.includes(meId)
  return {
    who: mine
      ? (r.lead_name ?? 'Trưởng phòng Cung ứng')
      : `Trưởng phòng Cung ứng${r.lead_name ? ` · ${r.lead_name}` : ''}`,
    what: 'Xem rồi trình Giám đốc',
    since,
    mine,
  }
}

/**
 * AI ĐANG GIỮ ĐƠN.
 *
 * Trả về cả `since` để màn hình đếm ngày — "chờ duyệt" 1 tiếng và "chờ
 * duyệt" 9 ngày là hai tình huống khác hẳn nhau mà tên trạng thái giấu mất.
 */
export function poHolder(po: PoLike, meId: string | null): Holder {
  switch (po.status) {
    case 'draft': {
      /*
        LUỒNG CHỐT 05/11/2026 chiều (không có mốc "gửi trưởng phòng"): nháp đủ
        điều kiện là nằm ở bàn trưởng phòng; còn thiếu / vừa bị trả lại thì bóng
        ở người soạn, câu việc nói rõ phải làm gì.
      */
      const r = po.review
      const nv = !!meId && (po.assigned_to === meId || po.created_by === meId)
      if (r?.tra_lai_at)
        return {
          who: 'Cung ứng',
          what: 'Sửa theo lý do trưởng phòng trả lại — lưu xong đơn quay lại bàn trưởng phòng',
          since: r.tra_lai_at,
          mine: nv,
        }
      if (r?.thieu)
        return {
          who: 'Cung ứng',
          what: `Soạn tiếp (${r.thieu.split(' — ')[0].split('. ')[0].toLowerCase()}) — đủ thì trưởng phòng xem, trình Giám đốc`,
          since: po.updated_at ?? po.created_at ?? null,
          mine: nv,
        }
      if (r) return choTruongPhongGiu(r, po.updated_at ?? po.created_at ?? null, meId)
      return {
        who: 'Cung ứng',
        what: 'Soạn xong thì gửi Giám đốc duyệt',
        since: po.updated_at ?? po.created_at ?? null,
        mine: nv,
      }
    }
    case 'pending_approval': {
      /*
        TRƯỞNG PHÒNG XEM TRƯỚC (0293): chưa xem thì bóng ở trưởng phòng CƯ — với
        chính anh ấy là "đến lượt bạn". Xem rồi thì bóng sang Giám đốc, đếm giờ
        từ lúc xem. Giám đốc vẫn duyệt được khi chưa xem — "đang giữ" chỉ nói
        ai nên động vào trước.
      */
      const r = po.review
      if (r && !r.reviewed_at)
        return choTruongPhongGiu(r, po.submitted_at ?? po.updated_at ?? null, meId)
      return {
        who: 'Giám đốc',
        what: r?.reviewed_at
          ? `Trưởng phòng đã xem ${ngayGioVn(r.reviewed_at).slice(0, 5)} ${ngayGioVn(r.reviewed_at).slice(11)} — chờ Giám đốc duyệt`
          : 'Chờ Giám đốc duyệt hoặc từ chối',
        since: r?.reviewed_at ?? po.submitted_at ?? po.updated_at ?? null,
        // Người soạn KHÔNG phải người giữ bóng ở bước này — nói "đến lượt
        // bạn" với họ là đẩy họ đi giục nhầm chỗ.
        mine: false,
      }
    }
    case 'approved':
      return {
        who: 'Cung ứng',
        what: 'Đã duyệt — gọi NCC chốt đơn rồi ghi NCC xác nhận',
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
        what: 'NCC đã xác nhận — chờ giao hàng',
        since: po.confirmed_at ?? null,
        mine: false,
      }
    case 'in_transit':
      return {
        who: 'Nhà cung cấp',
        what: 'Hàng đang trên đường — nhận hàng khi xe tới',
        since: po.updated_at ?? null,
        mine: false,
      }
    // Tên đúng trong `PO_STATUSES` là 'partial', KHÔNG phải
    // 'partially_received' — viết theo trí nhớ là rơi vào default.
    //
    // Về một phần: bóng ở NGƯỜI MUA (01/10/2026, bản vẽ F3). Từ khi Cung ứng
    // nhận hàng thay Kho, việc còn lại là của người phụ trách đơn: giục NCC giao
    // bù (đợt mới) hoặc chốt thiếu khi NCC không giao nữa — không phải "chờ Kho".
    case 'partial':
      return {
        who: 'Cung ứng',
        what: 'Còn dòng chưa về — hẹn NCC giao bù, hoặc chốt thiếu nếu NCC không giao nữa',
        since: po.updated_at ?? null,
        mine: !!meId && (po.assigned_to === meId || po.created_by === meId),
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
    ...(hadSendStep(po)
      ? [
          {
            key: 'ordered',
            at: po.ordered_at ?? null,
            label: 'Gửi nhà cung cấp',
            tone: 'act' as const,
          },
        ]
      : []),
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
