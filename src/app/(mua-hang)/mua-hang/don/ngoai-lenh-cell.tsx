import Link from 'next/link'
import { nhanNgoaiLenh } from '@/lib/po-muc-dich'

/**
 * Ô "Lệnh SX" của đơn NGOÀI LỆNH — hai dòng gọn: hạng mục (0230, bấm mở hồ sơ
 * hạng mục), rồi loại việc. Đơn cũ chưa gắn hạng mục rơi về chữ mục đích 0229.
 *
 * Trần 200px, chữ thừa cắt "…", rê chuột đọc đủ: bản đầu ghi một dòng dài không
 * xuống hàng, đo 11/10 ở 1536px cột Lệnh nở ra 477px và ép cột Vật tư.
 */
export function NgoaiLenhCell({
  p,
}: {
  p: {
    project_id?: string | null
    project_code?: string | null
    project_name?: string | null
    project_kind?: string | null
    standalone_purpose?: string | null
    standalone_ref?: string | null
  }
}) {
  const dong1 = p.project_code
    ? nhanNgoaiLenh(p)
    : `Ngoài lệnh · ${p.standalone_purpose?.trim() || 'chưa chọn hạng mục'}`
  const dong2 = p.project_code ? p.project_kind : p.standalone_ref?.trim()
  return (
    <span className="flex max-w-[200px] flex-col leading-tight" title={nhanNgoaiLenh(p)}>
      {p.project_id ? (
        <Link
          href={`/mua-hang/hang-muc/${p.project_id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-k-label truncate text-[var(--act)] hover:underline"
        >
          {dong1}
        </Link>
      ) : (
        <span className="text-k-label truncate text-[var(--ink-2)]">{dong1}</span>
      )}
      {dong2 && <span className="text-k-label truncate text-[var(--ink-3)]">{dong2}</span>}
    </span>
  )
}
