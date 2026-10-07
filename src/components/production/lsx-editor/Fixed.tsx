/**
 * Ô chỉ đọc + ảnh SP của bảng soạn dòng lệnh — tách khỏi LsxSheetEditor
 * 07/10/2026 để file không vượt trần dòng riêng (size-baseline). Không state.
 */

/**
 * Ô CHỈ ĐỌC cho thông tin sản phẩm cố định (chốt 07/08/2026: "thông tin sản
 * phẩm có tính cố định không cho sửa trong giao diện LSX").
 *
 * Cố tình KHÔNG dùng `<Input disabled>`: ô nhập xám vẫn trông như ô nhập, người
 * dùng bấm vào rồi mới biết gõ không được. Chữ trơn nói ngay "cái này lấy từ
 * nơi khác". `bad` = trường trống mà gate gửi duyệt đang chặn.
 */
export function Fixed({
  value,
  mono,
  right,
  bad,
}: {
  value?: string | null
  mono?: boolean
  right?: boolean
  bad?: boolean
}) {
  const v = (value ?? '').trim()
  return (
    <div
      className={`px-2 py-1.5 text-xs ${mono ? 'font-mono' : ''} ${
        right ? 'text-right tabular-nums' : ''
      } ${bad ? 'rounded-md ring-1 ring-red-400' : ''} ${
        v ? '' : 'text-muted-foreground'
      }`}
      title={v || undefined}
    >
      {v || '—'}
    </div>
  )
}

/** Ảnh SP trong bảng soạn dòng — nhận mặt hàng bằng mắt, khỏi dò mã. */
export function LineImage({ url }: { url?: string }) {
  if (!url) return <div className="bg-muted size-9 rounded" aria-hidden />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="size-9 rounded object-contain" />
}
