/**
 * AI ĐANG GIỮ LỆNH SẢN XUẤT, VÀ ĐÃ BAO LÂU.
 *
 * Vá LỖ HỔNG D của `docs/san-xuat-quy-trinh-vai-tro.md`: trạng thái "đã duyệt"
 * không có người giữ bóng. Đo 18/09/2026: **13/19 lệnh** đang nằm ở đó, không
 * ai chịu trách nhiệm đẩy tiếp, và không đồng hồ nào đếm nó đã nằm bao lâu.
 * Tiêu chí 2.3 của `tieu-chi-workflow-erp.md` gọi thẳng tên: mỗi bước phải có
 * MỘT người giữ bóng và phải đếm được thời gian giữ.
 *
 * HAI ĐIỀU TỆP NÀY CỐ Ý LÀM:
 *
 * 1. **"Đã duyệt" TÁCH LÀM HAI.** Cùng một trạng thái trong DB nhưng hai tình
 *    huống khác hẳn nhau: chưa có vật tư thì bóng ở Cung ứng, có vật tư rồi mà
 *    xưởng chưa ghi sổ thì bóng ở Xưởng. Nói chung chung "chờ sản xuất" là
 *    đúng mà vô dụng — người đọc vẫn không biết gọi ai.
 *
 * 2. **Nói VIỆC, không nói tên trạng thái.** "Chờ vật tư về kho" thay vì
 *    "approved". Nguyên tắc 2 của /design-lab.
 *
 * KHÔNG đọc DB, không gọi service: hàm thuần để cả trang chi tiết lẫn danh
 * sách dùng chung một câu trả lời, và để test được.
 */

export type HolderInput = {
  status: string
  created_at: string
  approved_at: string | null
  materials_received_at: string | null
  completed_at: string | null
  updated_at?: string | null
}

export type Holder = {
  /** Ai đang giữ — nói theo VAI, không theo tên người. */
  who: string
  /** Việc họ phải làm. Câu này là thứ người đọc dùng để hành động. */
  what: string
  /** Mốc bắt đầu giữ (ISO). null = không đếm được. */
  since: string | null
  /** Bóng đã nằm bao nhiêu ngày. null = không đếm được. */
  days: number | null
  /** Lệnh đã khép — không còn ai phải làm gì. */
  closed: boolean
}

/** Số ngày trọn từ `iso` tới `now`, không âm. */
export function daysHeld(iso: string | null, now: Date): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const d = Math.floor((now.getTime() - t) / 86400000)
  return d < 0 ? 0 : d
}

/**
 * NGƯỠNG NẰM IM — quá bao nhiêu ngày thì coi là kẹt.
 *
 * 3 ngày, cùng ngưỡng mà `thiet-ke-huong-erp.md` đã chốt cho đơn mua ("cảnh
 * báo đơn nằm im ≥3 ngày"). Một hệ thống hai ngưỡng cho cùng một khái niệm là
 * hai câu trả lời cho cùng một câu hỏi.
 */
export const STALE_DAYS = 3

export function resolveHolder(lsx: HolderInput, now: Date = new Date()): Holder {
  const at = (iso: string | null) => ({ since: iso, days: daysHeld(iso, now) })

  switch (lsx.status) {
    case 'draft':
      return {
        who: 'Bán hàng',
        what: 'đang soạn lệnh — gửi Giám đốc duyệt để xưởng vào việc',
        closed: false,
        ...at(lsx.created_at),
      }

    case 'pending_approval':
      return {
        who: 'Giám đốc',
        what: 'chờ ký duyệt',
        closed: false,
        // Không có cột `submitted_at`; `updated_at` là mốc gần nhất lệnh bị
        // đụng vào, đủ dùng để đếm và KHÔNG bịa ra độ chính xác không có.
        ...at(lsx.updated_at ?? lsx.created_at),
      }

    case 'rejected':
      return {
        who: 'Bán hàng',
        what: 'Giám đốc trả lại — sửa rồi gửi duyệt lần nữa',
        closed: false,
        ...at(lsx.updated_at ?? lsx.created_at),
      }

    case 'approved':
      // ĐÂY là chỗ lỗ hổng D nằm. Một trạng thái, hai người giữ.
      return lsx.materials_received_at
        ? {
            who: 'Xưởng sản xuất',
            what: 'vật tư đã về — chưa ai ghi sổ, lệnh vẫn chưa vào xưởng',
            closed: false,
            ...at(lsx.materials_received_at),
          }
        : {
            who: 'Cung ứng',
            what: 'chờ vật tư về kho — xưởng chưa vào việc được',
            closed: false,
            ...at(lsx.approved_at ?? lsx.created_at),
          }

    case 'in_progress':
      return {
        who: 'Xưởng sản xuất',
        what: 'đang chạy — ghi sổ hằng ngày, xong thì đóng lệnh',
        closed: false,
        ...at(lsx.materials_received_at ?? lsx.approved_at ?? lsx.created_at),
      }

    case 'completed':
      return {
        who: 'Bán hàng',
        what: 'xưởng đã xong — tới lượt giao hàng',
        closed: true,
        ...at(lsx.completed_at),
      }

    case 'cancelled':
      return {
        who: '—',
        what: 'lệnh đã huỷ theo đơn khách',
        closed: true,
        ...at(lsx.updated_at ?? lsx.created_at),
      }

    default:
      // Trạng thái lạ (thêm sau mà quên sửa đây) → nói THẬT là không biết, chứ
      // đừng đoán một cái tên vai rồi người đọc đi gọi nhầm người.
      return {
        who: '—',
        what: `trạng thái "${lsx.status}" chưa khai người giữ`,
        closed: false,
        ...at(lsx.updated_at ?? lsx.created_at),
      }
  }
}

/** Bóng nằm im quá ngưỡng — chỉ có nghĩa với lệnh CHƯA khép. */
export function isStale(h: Holder): boolean {
  return !h.closed && h.days != null && h.days >= STALE_DAYS
}
