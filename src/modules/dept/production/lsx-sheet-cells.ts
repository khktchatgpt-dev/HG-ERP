import type { LsxSheetColumn } from '@/modules/dept/sales/lsx-template'
import type { LsxGroup, LsxLine } from './lsx-lines.repo'

/**
 * GIÁ TRỊ + TÍN HIỆU MÀU của từng ô phiếu LỆNH SẢN XUẤT — logic thuần, dùng
 * chung cho phiếu in HTML (LsxPrintSheet) và file Excel xuất ra (lsx-excel):
 * hai bản phải giống nhau từng ô, nên quy tắc chỉ được khai một chỗ ở đây.
 */

export type LsxSheetGroupData = Pick<
  LsxGroup,
  'id' | 'title' | 'buyer_name' | 'po_no' | 'ship_date' | 'ship_label' | 'note'
> & { lines: LsxLine[] }

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '')
export const fmtN = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

/**
 * Đợt xuất hiển thị: NGÀY là chính (dd/mm/yyyy).
 *
 * `ship_label` giữ lại chỉ để đọc dữ liệu cũ — từ 07/08/2026 ô nhập đã là ô
 * chọn ngày nên không sinh nhãn chữ mới nữa. Trước đó ô nhận text tự do và dữ
 * liệu thật lẫn lộn tuần ("w37.26"), ngày viết tay ("11/01/27" — lại trùng
 * `ship_date` đã có), và cả đoạn ghi chú dài; đã quy đổi hết sang ngày bằng
 * `scripts/ship-label-to-date.mjs`.
 */
export const shipText = (x: { ship_label: string | null; ship_date: string | null }) =>
  x.ship_date ? fmtD(x.ship_date) : (x.ship_label?.trim() ?? '')

/** Giá trị một ô của DÒNG (cột nhóm xử lý riêng vì phải gộp ô). */
export function lineCell(col: LsxSheetColumn, l: LsxLine): string {
  const src = col.source
  switch (src.kind) {
    case 'image':
      return '' // ảnh render riêng, không phải text
    case 'line':
      switch (src.field) {
        case 'qty':
          return fmtN(l.qty)
        case 'cbm':
          return l.cbm ? fmtN(l.cbm) : ''
        case 'ship':
          return shipText(l)
        default:
          return (l[src.field] as string | null) ?? ''
      }
    case 'total_cbm':
      return l.cbm ? fmtN(l.cbm * l.qty) : ''
    case 'spec':
      return l.specs[src.key] ?? ''
    case 'check':
      return l.checks[src.key] ?? ''
    case 'extra':
      return l.extras[src.key] ?? ''
    default:
      return ''
  }
}

export function groupCell(col: LsxSheetColumn, g: LsxSheetGroupData): string {
  if (col.source.kind !== 'group') return ''
  switch (col.source.field) {
    case 'ship':
      return shipText(g)
    case 'title':
      return g.title ?? ''
    default:
      return (g[col.source.field] as string | null) ?? ''
  }
}

const norm = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Tô theo GIÁ TRỊ — thứ xưởng cần thấy ngay mà bảng đen trắng nuốt mất:
 *   · `pending`: chưa chốt ("xác nhận sau", "Thông báo sau", "chờ ký mẫu",
 *     "đợi…") → nền cam nhạt + chữ đỏ — ô CHƯA CÓ THÔNG TIN, không phải giá trị;
 *   · `missing`: thiếu hồ sơ ("Không", "thiếu…", "chưa…" ở cột kiểm tra) → chữ
 *     đỏ đậm. MERXX bôi đỏ "Không" ở cột MẪU; YOTRIO bôi đỏ "Đợi thông tin
 *     shipping mark" — hai quy tắc gộp lại cho mọi khách.
 */
export function valueState(text: string, isCheck: boolean): 'pending' | 'missing' | null {
  const t = norm(text)
  if (!t) return null
  if (
    /(xac nhan sau|thong bao sau|cho ky|cho xac nhan|dang cho|doi thong tin|se gui|sau khi)/.test(
      t,
    )
  )
    return 'pending'
  if (isCheck && /(khong|thieu|chua)/.test(t)) return 'missing'
  return null
}

/**
 * SP đã đủ mẫu → nền xanh nhạt ở ô Mã SP. MERXX bôi xanh 9 mã trong file, đối
 * chiếu ra đúng các dòng có cột MẪU ghi "Có" trơn (không kèm "thiếu…").
 */
export function isReady(l: LsxLine): boolean {
  const mau = norm(l.checks.mau ?? '')
  return mau.startsWith('co') && !/thieu|chua/.test(mau)
}
