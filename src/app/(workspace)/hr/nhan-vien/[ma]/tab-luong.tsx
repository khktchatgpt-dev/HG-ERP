'use client'

import { Btn, Empty } from '@/components/kit'
import { KhoaRieng } from './tab-ca-nhan'
import { Dong, Khoi, LUOI } from './khoi-cong-viec'
import type { HoSoCtx } from './useHoSoNv'

const tien = (n: number | null) => (n == null ? '—' : n.toLocaleString('vi-VN'))
const kyVn = (t: string) => `${t.slice(5)}/${t.slice(0, 4)}`

/**
 * Lương & ngân hàng của một người — CÙNG dữ liệu màn Hồ sơ lương, nhìn theo một người (Q4
 * lượt 2). Chỉ xem; sửa ở Hồ sơ lương (bản có hiệu lực theo kỳ, đặt đơn giá cả tổ, nạp Excel).
 */
export function TabLuong({ d }: { d: HoSoCtx }) {
  const l = d.h.luong
  if (!l)
    return (
      <KhoaRieng viec="Chỉ người phụ trách lương (Nhân sự được giao) và Kế toán xem được mục này." />
    )
  const sua = <Btn href={`/ho-so-luong?thang=${l.thang}`}>Sửa ở Hồ sơ lương</Btn>
  const b = l.ban
  return (
    <div className="min-h-0 overflow-auto">
      {b ? (
        <Khoi ten={`Bản đang áp cho kỳ ${kyVn(l.thang)} · từ kỳ ${kyVn(b.tuKy)}`}>
          <div className={LUOI}>
            <Dong nhan="Cách trả">{b.cachTra}</Dong>
            <Dong nhan="Đơn giá / lương tháng">
              <span className="num">
                {b.donGia != null
                  ? `${tien(b.donGia)} /công`
                  : b.luongThang != null
                    ? `${tien(b.luongThang)} /tháng`
                    : '—'}
              </span>
            </Dong>
            <Dong nhan="Lương đóng BH">
              <span className="num">{b.coBh ? tien(b.luongBh) : 'không đóng'}</span>
            </Dong>
            <Dong nhan="Phụ cấp">
              {b.phuCap.length ? (
                <span className="num">
                  {b.phuCap.map((p) => `${p.ten} ${tien(p.muc)}`).join(' · ')}
                </span>
              ) : (
                '—'
              )}
            </Dong>
            <Dong nhan="Người phụ thuộc">
              <span className="num">{b.npt}</span>
            </Dong>
          </div>
        </Khoi>
      ) : (
        <Empty
          level={2}
          headline={`Chưa có hồ sơ lương áp cho kỳ ${kyVn(l.thang)}`}
          reason={
            l.soBan
              ? `Có ${l.soBan} bản nhưng đều từ kỳ sau kỳ này.`
              : 'Chưa ai đặt đơn giá / lương tháng cho người này — bảng lương sẽ báo thiếu.'
          }
          next={sua}
        />
      )}
      <Khoi ten="Ngân hàng & thuế">
        <div className={LUOI}>
          <Dong nhan="Ngân hàng">
            {l.nganHang ?? <span className="text-[var(--warn)]">chưa có</span>}
          </Dong>
          <Dong nhan="Số tài khoản">
            {l.stkChe ? (
              <span className="num">{l.stkChe}</span>
            ) : (
              <span className="text-[var(--warn)]">chưa có</span>
            )}
          </Dong>
          <Dong nhan="Mã số thuế">
            {l.mstChe ? (
              <span className="num">{l.mstChe}</span>
            ) : (
              <span className="text-[var(--ink-3)]">chưa có</span>
            )}
          </Dong>
        </div>
        <p className="text-k-label mt-2 text-[var(--ink-3)]">
          Số đã che. Hiện số thật (có ghi nhật ký) và sửa ở Hồ sơ lương.
        </p>
      </Khoi>
      {b && <div className="px-[var(--gutter)] py-2.5">{sua}</div>}
    </div>
  )
}
