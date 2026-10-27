'use client'

import type { OLich, OLichKey } from '@/lib/kho-lich-hang-ve'

/**
 * DẢI LỊCH HÀNG VỀ — thay hàng tab mốc hẹn của Nhận hàng (27/10/2026, bản vẽ N1
 * https://claude.ai/artifact/5iNGTXFgVaL9ZLcNJEEpVp). Mỗi ô là một tab: số chính
 * = đơn đang về, dòng phụ = "+N sắp đặt" (đơn GĐ đã duyệt, NCC chưa xác nhận —
 * chỉ để biết, không cộng vào số chính). Ô bằng 0 chữ xám, không tô đỏ; chỉ Quá
 * hẹn mang màu dừng. Mở từ `?hen=week` thì cả 7 ô ngày cùng sáng.
 */
export function LichHangVe({
  lich,
  chon,
  onChon,
  treKhoang,
  gon,
}: {
  lich: OLich[]
  chon: OLichKey
  onChon: (k: OLichKey) => void
  /** "trễ 1–19 ngày" — dòng phụ của ô Quá hẹn. */
  treKhoang: string | null
  /** Khung hẹp (< 900px): bỏ dòng phụ, ngày ngắn lại — số vẫn đủ ở nhãn đọc màn hình. */
  gon: boolean
}) {
  return (
    <div
      className={gon ? 'kh-lich gon' : 'kh-lich'}
      role="tablist"
      aria-label="Lịch hàng về"
    >
      {lich.map((o) => {
        const on = o.key === chon || (chon === 'week' && o.loai === 'ngay')
        // Ô hôm nay: nhãn chỉ "Hôm nay", ngày xuống dòng phụ (ô ~97px ở 1280 cắt mất ngày).
        const nay = o.loai === 'nay'
        const phu =
          o.loai === 'tre' && o.n > 0 && treKhoang
            ? treKhoang
            : o.sapDat > 0
              ? `+${o.sapDat} sắp đặt`
              : nay
                ? o.nhan.replace(/^Hôm nay /, '')
                : null
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={`${o.nhan} — ${o.n} đơn đang về${o.sapDat > 0 ? `, ${o.sapDat} đơn sắp đặt` : ''}`}
            className={['o', o.loai, o.n === 0 ? 'zero' : null, on ? 'on' : null].filter(Boolean).join(' ')} // prettier-ignore
            onClick={() => onChon(o.key)}
          >
            <span className="d">{nay ? 'Hôm nay' : o.nhan}</span>
            <span className="n">{o.n}</span>
            {!gon && <span className="s">{phu ?? ' '}</span>}
          </button>
        )
      })}
    </div>
  )
}
