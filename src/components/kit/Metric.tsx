import type { ReactNode } from 'react'

const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

/* ══════════════════════════════════════════════════════════════════════
   13. HỒ SƠ DANH MỤC — mảng kit thiếu, lộ ra khi dựng màn nhà cung cấp
   (Khuôn E) ngày 10/09/2026.

   Chứng từ và hồ sơ danh mục KHÔNG dùng chung bộ đầu trang:

     · chứng từ có vòng đời duyệt  → `StatusTrack` (đang ở bước nào);
     · hồ sơ danh mục KHÔNG có     → `MetricStrip` (làm ăn ra sao).

   Nhét hồ sơ vào khuôn chứng từ thì phải bịa ra một vòng đời cho nó, và
   người dùng đi tìm nút "gửi duyệt" trên một thứ không ai duyệt bao giờ.
   ══════════════════════════════════════════════════════════════════════ */

export function MetricStrip({
  children,
  size = 'md',
}: {
  /** Các `Metric`. Lưới tự xếp, mỗi ô tối thiểu 148px; vạch ngăn vẽ bằng bóng đổ nên hàng thiếu ô không lộ nền xám. */
  children: ReactNode
  /**
   * Cỡ con số. `md` (mặc định) = 15px, dải đầu hồ sơ / chứng từ. `lg` = 18px
   * (`--fs-title`) + mẫu số 12px — dải tóm tắt của màn BÁO CÁO, nơi bốn con số
   * là thứ người đọc nhìn trước nhất (bản vẽ "Giá trị đơn theo lệnh", 03/10/2026).
   */
  size?: 'md' | 'lg'
}) {
  return (
    <div className={cx('k-metrics', size === 'lg' && 'k-metrics-lg')}>{children}</div>
  )
}

/**
 * MỘT Ô ĐO trên hồ sơ danh mục.
 *
 * `basis` BẮT BUỘC, không phải optional — cùng thủ pháp với `reason`/`next`
 * của `Empty`. Lý do: một tỉ lệ không kèm mẫu số là con số KHÔNG KIỂM ĐƯỢC.
 * "Giao đúng hẹn 89%" tính trên 9 đơn và trên 900 đơn là hai mức tin cậy
 * khác hẳn nhau, mà hai cái ô thì trông y hệt. Người duyệt chi vài trăm
 * triệu dựa vào ô đó, nên mẫu số phải nằm ngay dưới con số.
 *
 * `value = null` nghĩa là CHƯA ĐO ĐƯỢC, khác hẳn 0. Hiện "chưa đo được" chứ
 * không hiện 0% — 0% đọc thành "làm ăn tệ" trong khi sự thật là "chưa có gì
 * để chấm", và đó là hai kết luận trái ngược về cùng một nhà cung cấp.
 */
export function Metric({
  label,
  value,
  basis,
  tone,
}: {
  /** Tên chỉ số, chữ hoa nhỏ ("Giao đúng hẹn", "QC loại"). */
  label: string
  /** Con số đã định dạng ("89%", "1,2 ngày"). null = chưa đủ dữ liệu để tính — ô hiện chữ "chưa đo được". KHÔNG được thay bằng 0. */
  value: string | null
  /** Mẫu số / cỡ mẫu, in ngay dưới con số ("8 / 9 đơn có hẹn ngày"). Bắt buộc: tỉ lệ không kèm mẫu số là con số không kiểm được. */
  basis: string
  /** Màu CON SỐ theo đánh giá: `done` tốt, `warn` cần để ý, `stop` xấu. Bỏ trống = trung tính. Bị bỏ qua khi `value` là null. */
  tone?: 'stop' | 'warn' | 'done'
}) {
  return (
    <div
      className={cx(
        'k-metric',
        value == null ? 'k-metric-none' : tone && `k-metric-${tone}`,
      )}
    >
      <div className="k-metric-l">{label}</div>
      <div className="k-metric-v">{value ?? 'chưa đo được'}</div>
      <div className="k-metric-b">{basis}</div>
    </div>
  )
}
