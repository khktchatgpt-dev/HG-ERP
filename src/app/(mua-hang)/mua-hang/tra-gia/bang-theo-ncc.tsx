'use client'

import Link from 'next/link'
import { gomTheoNcc } from '@/lib/tra-gia-chon'
import { NUM, TD, TF, TH } from '../_erp/ui'
import type { TraGiaCtx } from './useTraGia'
import { nganNcc, ngay, tien } from './tra-gia.shared'

/**
 * LƯỚI "THEO NHÀ CUNG CẤP" — câu ngược lại: NCC này bán được bao nhiêu món trong
 * danh sách, rẻ nhất ở mấy món, các món đang chọn họ thành bao nhiêu tiền. Dùng
 * khi muốn gom đơn về ít NCC. Đếm bằng `gomTheoNcc` — cùng hàm với tờ Excel.
 */
export function BangTheoNcc({ d }: { d: TraGiaCtx }) {
  const nam = d.homNay.slice(0, 4)
  const rows = gomTheoNcc(
    d.tinh.map((t) => ({ nhan: t.m.kq?.quy_cach?.label ?? t.m.text, ds: t.ds, re: t.re, chon: t.chon, tien: t.tien })), // prettier-ignore
  )
  const tong = rows.reduce((s, h) => s + h.tien, 0)
  return (
    <table
      className="w-full border-separate border-spacing-0"
      aria-label="So sánh giá theo nhà cung cấp"
    >
      <thead>
        <tr>
          <th className={TH}>Nhà cung cấp</th>
          <th
            className={`${TH} text-right`}
            title="Số món trong danh sách NCC này từng bán (giá chốt hoặc giá hỏi)"
          >
            Món có giá
          </th>
          <th className={`${TH} text-right`}>Rẻ nhất ở</th>
          <th className={`${TH} text-right`}>Đang chọn</th>
          <th className={TH}>Các món NCC này có giá (đậm = đang chọn)</th>
          <th className={TH}>Lần gần nhất</th>
          <th className={`${TH} text-right`}>Tiền các món đang chọn</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td
              colSpan={7}
              className="px-4 py-8 text-center text-[13px] text-[var(--ink-2)]"
            >
              <b className="text-[var(--ink)]">
                Chưa có NCC nào có giá cho các món trong danh sách
              </b>
              <div className="mt-1 text-[12px]">
                Món chưa mua thì gọi hỏi giá rồi ghi vào ở lưới “Theo món”.
              </div>
            </td>
          </tr>
        )}
        {rows.map((h) => (
          <tr
            key={h.key}
            className={
              h.chon.length ? 'bg-[var(--act-wash)]' : 'hover:bg-[var(--surface-hover)]'
            }
          >
            <td
              className={`${TD} whitespace-nowrap ${h.chon.length ? 'shadow-[inset_3px_0_0_var(--act)]' : ''}`}
            >
              {h.id ? (
                <Link
                  href={`/mua-hang/ncc/${h.id}`}
                  className="font-semibold hover:underline"
                  title={h.ten}
                >
                  {nganNcc(h.ten)}
                </Link>
              ) : (
                <span className="font-semibold">
                  {h.ten}{' '}
                  <span className="font-normal text-[var(--ink-3)]">(giá hỏi)</span>
                </span>
              )}
            </td>
            <td className={`${TD} ${NUM}`}>
              {h.mon.length} / {d.tinh.length}
            </td>
            <td className={`${TD} ${NUM}`}>
              {h.re ? (
                <b className="text-[var(--done)]">{h.re}</b>
              ) : (
                <span className="text-[var(--ink-3)]">0</span>
              )}
            </td>
            <td className={`${TD} ${NUM}`}>
              {h.chon.length || <span className="text-[var(--ink-3)]">0</span>}
            </td>
            <td className={`${TD} text-[12px]`}>
              {h.mon.map((m, i) => (
                <span key={`${m}-${i}`}>
                  {i > 0 && <span className="text-[var(--ink-3)]"> · </span>}
                  {h.chon.includes(m) ? (
                    <b>{m}</b>
                  ) : (
                    <span className="text-[var(--ink-3)]">{m}</span>
                  )}
                </span>
              ))}
            </td>
            <td className={`${TD} font-mono text-[12px] text-[var(--ink-3)]`}>
              {h.last ? ngay(h.last, nam) : ''}
            </td>
            <td className={`${TD} ${NUM} ${h.tien ? 'font-bold' : ''}`}>
              {h.tien ? tien(h.tien) : <span className="text-[var(--ink-3)]">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
      {rows.length > 0 && (
        <tfoot>
          <tr>
            <td colSpan={6} className={TF}>
              Cộng {rows.length} NCC có giá ít nhất một món
              <span className="ml-1.5 font-normal text-[var(--ink-3)]">
                — KHÔNG gồm: NCC chỉ có giá tham khảo cùng loại, đơn nháp; chưa VAT
              </span>
            </td>
            <td className={`${TF} ${NUM}`}>{tien(tong)}</td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}
