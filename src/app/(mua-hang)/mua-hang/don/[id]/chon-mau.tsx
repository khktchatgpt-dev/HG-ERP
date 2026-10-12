'use client'

import { PO_TEMPLATE_META, type PoTemplate } from '@/lib/po-template'

/**
 * Ô CHỌN MẪU ĐƠN — một ô cho cả đầu đơn lẫn thanh lưới (12/10/2026).
 *
 * Đơn mới KHÔNG có mẫu cho tới khi người soạn chọn (`value` null → dòng "— Chọn
 * mẫu đơn —"). Mẫu NCC hay dùng chỉ là GỢI Ý: đứng đầu danh sách, kèm tên NCC —
 * không tự áp như bản 26/09, vì một NCC có thể giao nhiều loại hàng (Hiệp Hưng
 * giao cả thùng carton lẫn tem nhãn).
 */
export function ChonMau({
  value,
  goiY,
  nccTen,
  onChon,
  className,
}: {
  value: PoTemplate | null
  goiY?: PoTemplate | null
  nccTen?: string | null
  onChon: (t: PoTemplate) => void
  className?: string
}) {
  const all = Object.values(PO_TEMPLATE_META)
  const ds = goiY ? [PO_TEMPLATE_META[goiY], ...all.filter((m) => m.key !== goiY)] : all
  return (
    <select
      aria-label="Mẫu đơn"
      className={className}
      value={value ?? ''}
      onChange={(e) => {
        if (e.target.value) onChon(e.target.value as PoTemplate)
      }}
    >
      {value == null && (
        <option value="" disabled>
          — Chọn mẫu đơn —
        </option>
      )}
      {ds.map((m) => (
        <option key={m.key} value={m.key} title={m.hint}>
          {m.label}
          {m.key === goiY ? ` · ${nccTen?.trim() || 'NCC này'} hay dùng` : ''}
        </option>
      ))}
    </select>
  )
}
