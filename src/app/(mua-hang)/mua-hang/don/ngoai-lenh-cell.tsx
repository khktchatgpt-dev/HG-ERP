import { nhanNgoaiLenh } from '@/lib/po-muc-dich'

/**
 * Ô "Lệnh SX" của đơn NGOÀI LỆNH (0229) — hai dòng gọn: mục đích, rồi cho ai.
 *
 * Bản đầu ghi cả cụm "Ngoài lệnh · Đơn khách chưa ra lệnh · PHIPPS — đế chân
 * bàn…" trên một dòng không xuống hàng: đo 11/10 ở 1536px cột Lệnh nở ra 477px
 * và ép cột Vật tư — vì một đơn ngoài lệnh mà cả bảng xô lệch. Nay trần 200px,
 * chữ thừa cắt "…", rê chuột đọc đủ.
 */
export function NgoaiLenhCell({
  p,
}: {
  p: { standalone_purpose?: string | null; standalone_ref?: string | null }
}) {
  return (
    <span className="flex max-w-[200px] flex-col leading-tight" title={nhanNgoaiLenh(p)}>
      <span className="text-k-label truncate text-[var(--ink-2)]">
        Ngoài lệnh · {p.standalone_purpose?.trim() || 'chưa ghi mục đích'}
      </span>
      {p.standalone_ref?.trim() && (
        <span className="text-k-label truncate text-[var(--ink-3)]">
          {p.standalone_ref}
        </span>
      )}
    </span>
  )
}
