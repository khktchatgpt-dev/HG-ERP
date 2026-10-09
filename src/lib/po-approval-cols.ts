import { PO_PRINT_ORDER, poField, poFieldText, type PoFieldLine } from './po-fields'
import { isPoTemplate } from './po-template'

/**
 * BỘ CỘT LƯỚI DÒNG HÀNG Ở MÀN KÝ ĐƠN MUA — theo đúng phiếu in gửi NCC.
 *
 * 07/10/2026 — chủ dự án: màn duyệt "không hiển đủ thông tin các dòng hàng".
 * Đo: lưới ký có 7 cột cố định, trong khi 266/528 dòng có Vật liệu / SL đơn
 * hàng, 329 dòng có ghi chú — Giám đốc ký mà không thấy thứ NCC sẽ nhận.
 *
 * Đọc chung `PO_PRINT_ORDER` + `poFieldText` với phiếu in, khác ba chỗ:
 *  · cột khai báo TRỐNG Ở MỌI DÒNG thì bỏ — màn ký hẹp hơn tờ A4 ngang;
 *  · `@note` không làm cột: ghi chú nằm dưới tên vật tư, cột cuối bên phải
 *    là thứ đầu tiên bị đẩy ra ngoài mép khi màn hẹp (user duyệt 07/10);
 *  · `@stt` do lưới tự vẽ; "Giá lần trước" do màn ký tự chèn sau `@price`.
 */

export type ApprovalColLine = PoFieldLine & {
  spec?: string | null
  dimension_text?: string | null
}

export type ApprovalCol =
  | { kind: 'fixed'; key: '@name' | '@unit' | '@qty' | '@price' | '@amount' }
  | {
      kind: 'field'
      key: string
      label: string
      /** Trường DB của dòng mà cột đọc — để biết quy cách đã có cột riêng chưa. */
      field: string | null
      right: boolean
      /** Cột hệ thống tự tính từ qty2 (Tổng kg / m² / m³). */
      calc: boolean
      text: (l: ApprovalColLine) => string
    }

const FIXED = new Set(['@name', '@unit', '@qty', '@price', '@amount'])

export function approvalLineCols(
  template: string | null | undefined,
  lines: ApprovalColLine[],
): ApprovalCol[] {
  const t = isPoTemplate(template) ? template : 'simple'
  const out: ApprovalCol[] = []
  for (const key of PO_PRINT_ORDER[t]) {
    if (key.startsWith('@')) {
      if (FIXED.has(key)) out.push({ kind: 'fixed', key: key as never })
      continue
    }
    const f = poField(t, key)
    if (!f) continue
    // "Kích thước" của mẫu inox/sắt: chưa nhập thì lấy tạm quy cách — như phiếu in.
    const text =
      f.key === 'dim'
        ? (l: ApprovalColLine) => l.dimension_text ?? l.spec ?? ''
        : (l: ApprovalColLine) => poFieldText(f, l)
    if (!lines.some((l) => text(l) !== '')) continue
    out.push({
      kind: 'field',
      key,
      label: f.printLabel ?? f.label,
      field: f.field ?? null,
      right:
        f.align === 'right' ||
        f.kind === 'number' ||
        f.kind === 'area' ||
        f.kind === 'calc' ||
        f.kind === 'm3sheet',
      calc: f.kind === 'calc',
      text,
    })
  }
  return out
}
