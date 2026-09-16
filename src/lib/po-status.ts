/**
 * TRẠNG THÁI ĐƠN ĐẶT VẬT TƯ (PO) — MỘT NGUỒN DUY NHẤT.
 *
 * Trước tệp này, bảng nhãn/màu của 9 trạng thái được chép tay ở 5 nơi: màn Cung
 * ứng (`planning/pos/PosManager`), `lib/supply-readiness`, hai màn Giám đốc
 * (`exec/ExecDashboard`, `exec/purchasing/PurchasingOverview`) và hồ sơ NCC
 * (`planning/suppliers/[id]/SupplierDetail`). Không phải lo xa: chúng ĐÃ lệch —
 * `in_transit` là hổ phách ở màn Cung ứng nhưng xanh dương ở hồ sơ NCC, còn hai
 * màn Giám đốc thì thiếu hẳn `cancelled` nên đơn đã huỷ hiện ra mã thô
 * "cancelled". Bản chép trong `supply-readiness` thậm chí có comment tự dặn
 * "GIỮ ĐỒNG BỘ với PosManager" — dấu hiệu rõ nhất rằng cách này không giữ nổi.
 *
 * Quy ước MÀU (đọc theo hàng dọc, không theo từng dòng):
 *   xám   — chưa đi đâu cả (nháp)
 *   hổ phách — ĐANG CHỜ AI ĐÓ: chờ GĐ gật, chờ hàng về, về chưa đủ
 *   xanh dương — đã chốt, đang chạy đúng đường
 *   xanh lá — xong
 *   đỏ    — đã huỷ
 *
 * Ai thêm trạng thái mới: khai vào `PO_STATUSES` là TypeScript sẽ chỉ ngay ra
 * mọi bảng còn thiếu (các `Record<PoStatus, …>` bên dưới), không sót chỗ nào.
 */

/** Thứ tự khai = thứ tự vòng đời, dùng luôn cho ô lọc và stepper. */
export const PO_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
  'received',
  'cancelled',
] as const

export type PoStatus = (typeof PO_STATUSES)[number]

/** Tập tone của `components/Badge` mà trạng thái PO dùng tới. */
export type PoStatusTone = 'gray' | 'amber' | 'blue' | 'green' | 'red'

export const PO_STATUS_LABEL: Record<PoStatus, string> = {
  draft: 'Nháp',
  pending_approval: 'Chờ duyệt',
  approved: 'Đã duyệt',
  ordered: 'Đã gửi NCC',
  confirmed: 'NCC xác nhận',
  in_transit: 'Đang giao',
  partial: 'Về một phần',
  received: 'Về đủ',
  cancelled: 'Đã huỷ',
}

export const PO_STATUS_TONE: Record<PoStatus, PoStatusTone> = {
  draft: 'gray',
  pending_approval: 'amber',
  approved: 'blue',
  ordered: 'blue',
  confirmed: 'blue',
  in_transit: 'amber',
  partial: 'amber',
  received: 'green',
  cancelled: 'red',
}

/** Việc kế tiếp — hiện dưới pill để người mua biết bước sau là gì. */
export const PO_NEXT_HINT: Partial<Record<PoStatus, string>> = {
  draft: 'kiểm tra rồi gửi GĐ duyệt',
  pending_approval: 'chờ GĐ duyệt',
  approved: 'gửi NCC',
  ordered: 'chờ NCC xác nhận',
  confirmed: 'chờ giao',
  in_transit: 'chờ nhận hàng',
  partial: 'nhận tiếp',
}

/**
 * ĐƠN ĐANG MỞ — đã qua cửa duyệt, chưa về đủ và chưa huỷ. Đây là tập "tiền đang
 * cam kết với NCC", dùng cho ô thống kê và số cộng đầu nhóm LSX.
 *
 * KHÔNG gồm `draft`/`pending_approval`: đơn chưa duyệt thì chưa cam kết gì.
 */
export const PO_OPEN_STATUSES: readonly PoStatus[] = [
  'approved',
  'ordered',
  'confirmed',
  'in_transit',
  'partial',
]

/** Trạng thái đã đóng sổ — không còn thao tác nào ngoài xem lại. */
export const PO_CLOSED_STATUSES: readonly PoStatus[] = ['received', 'cancelled']

export function isPoStatus(status: string): status is PoStatus {
  return (PO_STATUSES as readonly string[]).includes(status)
}

/**
 * Ba helper dưới đây nhận `string`, không phải `PoStatus`.
 *
 * Cố ý: các màn Giám đốc đọc thẳng số liệu tổng hợp từ API nên chỉ có `string`
 * trong tay. Bắt chúng ép kiểu chỉ đẩy rủi ro sang chỗ khác; thà nhận string rồi
 * dội về giá trị an toàn — mã thô hiện nguyên hình thay vì ô trống bí ẩn.
 */
export function poStatusLabel(status: string): string {
  return isPoStatus(status) ? PO_STATUS_LABEL[status] : status
}

export function poStatusTone(status: string): PoStatusTone {
  return isPoStatus(status) ? PO_STATUS_TONE[status] : 'gray'
}

export function isPoOpen(status: string): boolean {
  return isPoStatus(status) && PO_OPEN_STATUSES.includes(status)
}

/** Options cho ô lọc trạng thái — đúng thứ tự vòng đời. */
export function poStatusOptions(): { value: PoStatus; label: string }[] {
  return PO_STATUSES.map((s) => ({ value: s, label: PO_STATUS_LABEL[s] }))
}

/**
 * MÀU VẠCH TRẠNG THÁI ở mép trái mỗi dòng (xem `.spine` trong globals.css).
 *
 * Không dùng lại `PO_STATUS_TONE`: pill trong dòng phân biệt 9 trạng thái, còn
 * vạch thì đọc bằng khoé mắt nên chỉ được phép nói BỐN điều — chưa ra khỏi nhà,
 * đang chờ ai đó, xong, bỏ. Nhiều hơn bốn màu thì vạch thành hoa văn.
 */
export function poSpineColor(status: PoStatus): string {
  switch (status) {
    case 'draft':
      return 'var(--muted-foreground)'
    case 'pending_approval':
    case 'approved':
      return 'var(--warn)'
    case 'received':
      return 'var(--done)'
    case 'cancelled':
      return 'transparent'
    default:
      return 'var(--primary)'
  }
}

/** Sáu bước của trục PHÁT HÀNH đơn — từ bàn soạn tới lúc hàng lên đường. */
export const PO_TRACK_STEPS = [
  'Nháp',
  'Chờ duyệt',
  'Đã duyệt',
  'Đã gửi',
  'NCC xác nhận',
  'Đang giao',
] as const

/**
 * ĐƠN ĐANG Ở BƯỚC NÀO trên trục phát hành — và bước đó đọc ra màu gì.
 *
 * VÌ SAO PHẢI CÓ HÀM NÀY. Màn chứng từ trước đây tính thẳng tại chỗ:
 *
 *     Math.max(0, ['draft','pending_approval','approved','ordered',
 *                  'confirmed','in_transit'].indexOf(po.status))
 *
 * Danh sách đó thiếu ba trạng thái CUỐI vòng đời — `partial`, `received`,
 * `cancelled`. `indexOf` trả -1, `Math.max(0, -1)` kéo về 0, nên đơn ĐÃ VỀ MỘT
 * PHẦN, đơn ĐÃ VỀ ĐỦ và đơn ĐÃ HUỶ đều hiện là **"Nháp"**. Ba trong chín trạng
 * thái hiện sai, và đúng ba trạng thái mà người đọc cần biết nhất (chủ dự án
 * báo 15/09/2026: "rất khó nhận biết tình trạng đơn").
 *
 * `Math.max(0, …)` là thứ che mất lỗi: nó biến "không tìm thấy" thành "bước
 * đầu tiên" một cách im lặng. Hàm này khai TƯỜNG MINH cả chín trạng thái, và
 * có test cho từng cái — thêm trạng thái mới mà quên khai là test đỏ ngay.
 *
 * `at >= steps.length` nghĩa là ĐÃ QUA HẾT trục: hàng bắt đầu về rồi thì việc
 * phát hành đơn xong từ lâu, không còn bước nào "đang" cả — lúc đó trục nhận
 * hàng mới là trục đang chạy.
 */
export function poTrackStep(status: PoStatus): {
  /** Chỉ số bước đang ở. `PO_TRACK_STEPS.length` = đã qua hết; `-1` = trục không còn nghĩa. */
  at: number
  /** Màu của bước đang ở — huỷ thì đỏ, còn lại là màu hành động. */
  tone: 'act' | 'stop'
  /** Bậc KẾT THÚC ngoài trục — chỉ đơn huỷ mới có. */
  terminal?: string
} {
  switch (status) {
    case 'draft':
      return { at: 0, tone: 'act' }
    case 'pending_approval':
      return { at: 1, tone: 'act' }
    case 'approved':
      return { at: 2, tone: 'act' }
    case 'ordered':
      return { at: 3, tone: 'act' }
    case 'confirmed':
      return { at: 4, tone: 'act' }
    case 'in_transit':
      return { at: 5, tone: 'act' }
    // Hàng đã bắt đầu về → cả trục phát hành đã xong.
    case 'partial':
    case 'received':
      return { at: PO_TRACK_STEPS.length, tone: 'act' }
    /*
      HUỶ KHÔNG PHẢI MỘT BƯỚC, nó là chỗ vòng đời DỪNG LẠI.

      Hai cách sai đã thử: để bước cuối cùng đơn đi tới thì nói dối, vì cột
      `status` bị ghi đè nên không còn biết đơn huỷ lúc nháp hay huỷ sau khi đã
      gửi NCC. Cho "qua hết trục" thì cả sáu bước tick xanh — đọc ra thành
      "hoàn thành tốt đẹp", đúng thứ ngược hẳn sự thật.

      Nên: `at: -1` — không bước nào đã qua, không bước nào đang chạy, cả trục
      lùi về nhạt vì nó KHÔNG CÒN NGHĨA với đơn này — kèm một bậc KẾT THÚC màu
      dừng đặt ngoài trục.
    */
    case 'cancelled':
      return { at: -1, tone: 'stop', terminal: 'Đã huỷ' }
  }
}
