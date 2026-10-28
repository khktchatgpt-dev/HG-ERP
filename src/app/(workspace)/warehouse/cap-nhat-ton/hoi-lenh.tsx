'use client'

import {
  conThieu,
  hutCua,
  phanBu,
  type DongCapNhat,
  type LoiDong,
} from '@/lib/kho-cap-nhat-ton'

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })

/** Lỗi nằm ở phần xuất bù — thanh chốt nhảy tới ô số đầu của khối này. */
export const BU_LOI: readonly LoiDong['reason'][] = ['thieu_lenh', 'bu_sai', 'bu_vuot']

/**
 * HỎI "THIẾU HÀNG CỦA LỆNH, VÌ SAO?" (Q3) — kèm chia phần tổ đã lấy cho TỪNG lệnh
 * (K6, 28/10/2026: trước đó cả phần hụt dồn vào một lệnh). Máy chia sẵn theo phần
 * lệnh đang giữ (`chiaBuMacDinh`); sửa một ô là chuyển sang số gõ tay cho cả dòng.
 * Phần không lệnh nào nhận nói ra ngay: "còn N → ghi thiếu".
 *
 * Dùng chung cho màn Cập nhật số thực tế (lưới nhiều mã) và khối cập nhật trong
 * khung mã Tồn kho. Ô giữ CHỮ (`bu_go`) — gõ "12," không bị nắn thành "12" giữa
 * chừng; ô đầu có id `${idGoc}-0` để thanh chốt nhảy tới.
 */
export function HoiLenh({
  r,
  onDoi,
  ten,
  idGoc,
  need,
  busy,
}: {
  r: DongCapNhat
  /** Đổi chế độ hoặc số gõ tay của dòng. */
  onDoi: (p: Pick<DongCapNhat, 'che_do' | 'bu_go'>) => void
  /** `name` của nhóm radio — duy nhất trên màn. */
  ten: string
  /** Tiền tố id các ô số (`${idGoc}-${k}`). */
  idGoc: string
  /** Đã bấm ghi mà phần xuất bù sai — tô viền các ô số. */
  need?: boolean
  busy?: boolean
}) {
  const hut = hutCua(r)
  const phan = phanBu(r)
  const con = conThieu(r)
  const chu = (p: (typeof phan)[number]) =>
    r.bu_go ? (r.bu_go[p.lsx_id] ?? '') : fmt(p.qty)
  const go = (lsx: string, v: string) =>
    onDoi({
      che_do: 'xuat_bu',
      bu_go: { ...Object.fromEntries(phan.map((p) => [p.lsx_id, chu(p)])), [lsx]: v },
    })

  return (
    <fieldset className="kh-hoi-lenh" disabled={busy}>
      <legend>
        Thiếu{' '}
        <b className="kh-num">
          {fmt(hut)} {r.unit}
        </b>{' '}
        — hàng của lệnh, vì sao?
      </legend>
      <label className="chon">
        <input
          type="radio"
          name={ten}
          checked={r.che_do === 'xuat_bu'}
          onChange={() => onDoi({ che_do: 'xuat_bu', bu_go: r.bu_go })}
        />
        Tổ đã lấy → ghi xuất bù cho lệnh
      </label>
      {r.che_do === 'xuat_bu' && (
        <div className="bu" role="group" aria-label={`Tổ đã lấy ${r.code} theo lệnh`}>
          {phan.map((p, k) => (
            <label key={p.lsx_id}>
              {/* Tên lệnh + phần giữ chung một ô: khung hẹp (khung mã 300px) tự xuống dòng thay vì cắt tên. */}
              <span className="ten">
                <span className="ma">{p.code}</span>
                <span className="kh-mut kh-num" title="Phần tồn đang giữ cho lệnh này">
                  giữ {fmt(p.chia)}
                </span>
              </span>
              <input
                id={`${idGoc}-${k}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className={need ? 'kh-o num need' : 'kh-o num'}
                value={chu(p)}
                placeholder="0"
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => go(p.lsx_id, e.target.value)}
                aria-label={`Tổ đã lấy ${r.code} cho ${p.code}`}
              />
            </label>
          ))}
          {con > 0 && (
            <span className="con kh-mut">
              Còn{' '}
              <b className="kh-num">
                {fmt(con)} {r.unit}
              </b>{' '}
              không lệnh nào nhận → ghi thiếu
            </span>
          )}
        </div>
      )}
      <label className="chon">
        <input
          type="radio"
          name={ten}
          checked={r.che_do === 'thieu'}
          onChange={() => onDoi({ che_do: 'thieu', bu_go: r.bu_go })}
        />
        Hỏng / mất thật → ghi thiếu cả {fmt(hut)}
      </label>
    </fieldset>
  )
}
