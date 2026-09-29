'use client'

import type { ReactNode } from 'react'

/**
 * Ghép class. Dùng HÀM chứ không phải chuỗi mẫu `${cond ? ' x' : ''}` — xem
 * lý do đầy đủ ở bản gốc trong `Erp.tsx`.
 */
const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

/* ══════════════════════════════════════════════════════════════════════
   14. BẢNG NHẬP LIỆU — mảng kit thiếu, lộ ra khi dựng màn soạn đơn
   (Khuôn F) ngày 10/09/2026. Tách khỏi Erp.tsx ngày 28/09/2026 (file chạm
   trần dòng) — HeadChips/HeadChip/HeadField không phụ thuộc gì khác trong
   Erp.tsx nên tách sạch, không đổi hành vi.

   Khuôn D và Khuôn F đều có một lưới, nhưng vai của lưới ngược nhau:

     · Khuôn D — người dùng ĐỌC một tờ. Lưới là một khối trong đó, đầu
       chứng từ được phép chiếm 15 dòng lưới nhãn–giá trị;
     · Khuôn F — người dùng GÕ 40 dòng. Mỗi hàng đầu trang là một hàng lưới
       bị lấy mất, nên đầu đơn co thành dải chip và lưới chiếm phần còn lại.

   Đo trên màn thật `/planning/pos/new`: đầu đơn thật đúng là một dải chip
   (Mẫu · LSX · NCC · Hẹn giao · Khác), không phải lưới nhãn–giá trị. Bộ này
   chỉ đặt tên cho thứ màn đó đã tự chế.
   ══════════════════════════════════════════════════════════════════════ */

export function HeadChips({
  children,
}: {
  /** Các `HeadChip` / `HeadField`, xếp một hàng và tự xuống dòng. Muốn đẩy một thứ sát phải thì bọc nó trong phần tử có `margin-left: auto`. */
  children: ReactNode
}) {
  return <div className="k-headchips">{children}</div>
}

/**
 * MỘT Ô ĐẦU ĐƠN, thu về cỡ một chip.
 *
 * `value = null` nghĩa là CHƯA KHAI. Chip bắt buộc (`need`) tự đeo viền đỏ
 * ngay lúc đó, không đợi bấm Lưu mới báo — người dùng đã gõ xong 40 dòng rồi
 * mới biết thiếu nhà cung cấp là mất công vô ích, và đó là lỗi web kinh điển:
 * cho làm rồi mới kiểm.
 */
export function HeadChip({
  label,
  value,
  need = false,
  muted = false,
  plain = false,
  onClick,
  id,
}: {
  /** Tên ô đầu đơn, chữ hoa nhỏ ("NCC", "Hẹn giao"). Cũng ghép vào tooltip "Chưa khai … — bắt buộc". */
  label: string
  /** Giá trị đang có. null hoặc chuỗi rỗng = chưa khai: chip hiện "chưa chọn" nếu `need`, "—" nếu không. */
  value: ReactNode | null
  /** Bắt buộc phải có trước khi lưu — trống thì viền đỏ + nền đỏ nhạt NGAY, không đợi bấm Lưu. */
  need?: boolean
  /** Làm nhạt giá trị (chữ phụ, nét thường) cho ô ít đổi, như tiền tệ theo NCC. Chỉ có tác dụng khi đã có giá trị. */
  muted?: boolean
  /** KHÔNG KHUNG — một dòng chữ label:value, không chiếm riêng một "ô". Dùng cho vài chip phụ đứng cuối dải để khỏi vỡ dòng còn 1-2 ô trống nửa hàng. */
  plain?: boolean
  /** Bấm chip — mở chỗ sửa hoặc đi tới chứng từ cha. Bỏ trống thì chip là phần tử TĨNH (không nhận Tab, không phải nút) — chỉ bày giá trị. */
  onClick?: () => void
  /** Id của phần tử chip — để `CommitBar.onGoBlocked` tìm và đưa tiêu điểm tới chip bắt buộc còn trống. */
  id?: string
}) {
  const trong = value == null || value === ''
  const cls = cx(
    'k-headchip',
    trong && need && 'k-headchip-need',
    muted && !trong && 'k-headchip-muted',
    plain && 'k-headchip-plain',
    !onClick && 'k-headchip-ro',
  )
  const title = trong && need ? `Chưa khai ${label} — bắt buộc` : undefined
  const noiDung = (
    <>
      <span>{label}</span>
      <span>{trong ? (need ? 'chưa chọn' : '—') : value}</span>
    </>
  )
  /*
    KHÔNG `onClick` THÌ KHÔNG PHẢI NÚT (B7½, 24/09/2026) — cùng luật `StatusTrack`
    đã chốt 14/09: một nút nhận Tab mà bấm không làm gì là hứa một thao tác không
    tồn tại. Màn nhập hoá đơn NCC có ba chip kế thừa (NCC, Đơn mua, Tiền tệ)
    không `onClick` — ba điểm dừng Tab câm đứng trước ô người ta phải gõ.
  */
  return onClick ? (
    <button type="button" id={id} onClick={onClick} className={cls} title={title}>
      {noiDung}
    </button>
  ) : (
    <span id={id} className={cls} title={title}>
      {noiDung}
    </span>
  )
}

/**
 * Ô ĐẦU ĐƠN GÕ THẲNG — cùng hình dạng `HeadChip`, nhưng chứa ô nhập thật.
 *
 * VÌ SAO PHẢI CÓ CÁI THỨ HAI: `HeadChip` là một `<button>` — nó BÀY một giá trị
 * và mở chỗ sửa khi bấm. Nhét ô nhập vào trong nó là **nút lồng nút**: HTML
 * không hợp lệ và React hỏng hydration. Vấp thật 11/09/2026 khi dựng màn nhập
 * hoá đơn NCC — `DateInput` có nút mở lịch bên trong, cả trang đổ.
 *
 * Dùng `HeadChip` cho giá trị KẾ THỪA (nhà cung cấp, đơn mua, tiền tệ — lấy từ
 * chứng từ cha, bấm để đi tới). Dùng `HeadField` cho thứ người ta **gõ tại chỗ**
 * (số hoá đơn, ngày, thuế suất). Là `<label>` nên bấm vào nhãn là con trỏ nhảy
 * vào ô — thứ `HeadChip` không làm được.
 */
export function HeadField({
  label,
  children,
  need = false,
  empty = false,
  width,
}: {
  /** Nhãn chữ hoa nhỏ đứng trước ô nhập. Là phần của `<label>` bọc ngoài, nên bấm vào nhãn thì con trỏ nhảy vào ô. */
  label: string
  /** Ô nhập thật (`TextInput`, `DateInput`, `NumInput`). Vẫn truyền `label`/`aria-label` riêng cho ô — tên đó mới là tên trình đọc màn hình đọc. */
  children: ReactNode
  /**
   * Bắt buộc trước khi lưu — trống thì đeo viền đỏ NGAY, không đợi bấm Lưu.
   * Kèm chữ ẩn "(bắt buộc)" trong nhãn cho trình đọc màn hình.
   */
  need?: boolean
  /** Ô đang trống. Người gọi tự quyết vì "trống" của mỗi kiểu ô mỗi khác. */
  empty?: boolean
  /** Bề rộng (px) của phần chứa ô nhập. Bỏ trống thì ô tự co theo nội dung. */
  width?: number
}) {
  /*
    "BẮT BUỘC" PHẢI TỚI ĐƯỢC TRÌNH ĐỌC (B7½, 24/09/2026). Tới đây nó chỉ là
    viền đỏ — màu thì không đến tai ai. Chọn chữ ẩn trong nhãn chứ không
    `aria-required`: vỏ là `<label>`, mà `aria-required` trên label là thuộc
    tính không hợp lệ (label không có vai nhận nó); còn gắn lên ô bên trong thì
    kit không với tới — ô do người gọi truyền vào.

    Giới hạn, ghi thật: ô có `aria-label` riêng thì tên đó THẮNG nhãn bọc
    ngoài, nên chữ ẩn chỉ nghe được khi đọc tuần tự, không nghe khi Tab vào ô.
  */
  return (
    <label
      className={cx('k-headchip', 'k-headfield', need && empty && 'k-headchip-need')}
    >
      <span>
        {label}
        {need && <span className="sr-only"> (bắt buộc)</span>}
      </span>
      <span style={width ? { width } : undefined}>{children}</span>
    </label>
  )
}
