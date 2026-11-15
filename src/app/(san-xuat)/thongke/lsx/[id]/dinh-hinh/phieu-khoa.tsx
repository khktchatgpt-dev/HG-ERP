import Link from 'next/link'

/** Phiếu sản lượng của lệnh mở thẳng ở Sổ theo ngày — chỗ DUY NHẤT xoá được phiếu chính thức. */
export const phieuHref = (docNo: string) =>
  `/thongke/da-ghi?phieu=${encodeURIComponent(docNo)}`

/**
 * CÂU GỠ KHOÁ bảng chi tiết / lộ trình khi lệnh đã có sổ (15/11/2026). Câu cũ bảo
 * "xoá phiếu ở Hồ sơ lệnh › Phiếu" — tab đó chỉ xoá phiếu NHÁP, phiếu chính thức
 * xoá ở Sổ theo ngày (khi sổ ngày chưa chốt); thống kê làm theo câu cũ không tìm
 * thấy nút. Nay bày mã từng phiếu, bấm là tới đúng phiếu.
 */
export function PhieuKhoa({
  nos,
  toiDa = 6,
}: {
  nos: readonly string[]
  toiDa?: number
}) {
  if (nos.length === 0) return null
  const bay = nos.slice(0, toiDa)
  return (
    <>
      {' '}
      (
      {bay.map((no, i) => (
        <span key={no}>
          {i > 0 && ' · '}
          <Link className="lnk" href={phieuHref(no)}>
            {no}
          </Link>
        </span>
      ))}
      {nos.length > bay.length && ` · … ${nos.length - bay.length} phiếu nữa`})
    </>
  )
}

/** "2 phiếu PBS + 1 phiếu giao" — nhãn khoá ngắn cho đầu trang / thanh trạng thái. */
export function nhanKhoa(pbs: number, pgt: number): string {
  return [pbs > 0 && `${pbs} phiếu PBS`, pgt > 0 && `${pgt} phiếu giao`]
    .filter(Boolean)
    .join(' + ')
}

/**
 * KHOÁ VÌ PHIẾU GIAO NHẬN (15/11/2026): dòng giao cascade theo chi tiết — ghi đè
 * bảng là xoá sạch dòng giao, chỉ còn vỏ phiếu. Phiếu chưa nhận huỷ được ở Giao
 * nhận; phiếu đã nhận thì bảng khoá như đã có sổ.
 */
export function KhoaGiao({ nos }: { nos: readonly string[] }) {
  if (nos.length === 0) return null
  const bay = nos.slice(0, 6)
  return (
    <>
      Lệnh có phiếu giao nhận ({bay.join(' · ')}
      {nos.length > bay.length && ` · … ${nos.length - bay.length} phiếu nữa`}) — lưu sẽ
      xoá mất dòng giao: huỷ phiếu chưa nhận ở{' '}
      <Link className="lnk" href="/thongke/giao-nhan">
        Giao nhận
      </Link>
      ; phiếu đã nhận thì bảng khoá như đã có sổ.{' '}
    </>
  )
}
