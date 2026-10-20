'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LOAI_NGHI, KY_NGHI } from '@/lib/cham-cong/dieu-chinh'
import { nhanTc, type TongCong } from '@/lib/cham-cong/chi-tiet-cong'
import type { GioCongCtx } from './useGioCong'
import { so } from './gio-cong.shared'

/**
 * NGĂN TỔNG HỢP của Bảng công — mỗi người một dòng, cột theo tờ "Xuất tổng" của phần mềm
 * chấm công cũ (bản vẽ duyệt 20/10/2026): ngày công thường / CN / lễ, giờ công, TC1–TC3,
 * vào trễ, về sớm, vắng, thiếu lượt, nghỉ có lý do. Số cộng bằng `tongCong` — cùng hàm
 * cột tổng của lưới và trang Chấm công một người. Ô trống = 0, để số đáng chú ý nổi lên.
 */
export function TongHop({ d }: { d: GioCongCtx }) {
  const { b, dong } = d
  const p1 = b.phutMotCong
  const tc = nhanTc(b.thamSo)
  const rong: TongCong = {
    hcThuong: 0,
    hcCn: 0,
    hcLe: 0,
    tc1: 0,
    tc2: 0,
    tc3: 0,
    lanTre: 0,
    phutTre: 0,
    lanSom: 0,
    phutSom: 0,
    thieu: 0,
    vang: 0,
    nghi: {},
    ngayThuong: 0,
    chuNhat: 0,
    cnCoLam: 0,
    ngayLe: 0,
  }
  const hang = dong.map((n) => ({ n, t: d.congCua(n.ma)?.tong ?? rong }))
  const cong = (f: (t: TongCong) => number) => hang.reduce((s, x) => s + f(x.t), 0)
  const z = (v: number, le = 0) => (v ? so(v, le) : '')

  const c = 'border-b border-[var(--line-faint)]/40 px-1 py-1 whitespace-nowrap'
  const h = cn(
    c,
    'sticky top-[22px] z-[2] border-[var(--line)] bg-[var(--surface-raised)] text-[11px] leading-tight font-semibold text-[var(--ink-2)]',
  )
  const hg = cn(
    'sticky top-0 z-[2] h-[22px] border-b border-[var(--line-faint)]/40 bg-[var(--surface-raised)] px-1.5 text-center text-[11px] font-semibold text-[var(--ink-2)]',
  )
  const f = cn(
    c,
    'num sticky bottom-0 z-[2] border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold',
  )
  const g = 'border-l border-[var(--line)]'
  const tcx = 'text-[var(--grp-1-ink)]'
  const r = { textAlign: 'right' as const }

  return (
    <div
      className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]"
      role="region"
      aria-label="Bảng công tổng hợp"
      tabIndex={0}
    >
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={hg} colSpan={2} />
            <th className={cn(hg, g)} colSpan={4}>
              Ngày công
            </th>
            <th className={cn(hg, g, tcx, 'bg-[var(--grp-1-wash)]')} colSpan={3}>
              Tăng ca (giờ)
            </th>
            <th className={cn(hg, g)} colSpan={2}>
              Vào trễ
            </th>
            <th className={cn(hg, g)} colSpan={2}>
              Về sớm
            </th>
            <th className={cn(hg, g)} colSpan={2} />
            <th className={cn(hg, g)} colSpan={LOAI_NGHI.length}>
              Nghỉ có lý do (ngày)
            </th>
          </tr>
          <tr>
            <th className={h} style={r}>
              #
            </th>
            <th className={h} style={{ textAlign: 'left' }}>
              Mã · Họ tên
            </th>
            <th className={cn(h, g)} style={r}>
              Thường
            </th>
            <th className={h} style={r}>
              CN
            </th>
            <th className={h} style={r}>
              Lễ
            </th>
            <th className={h} style={r} title="Giờ ca hành chính (gồm làm trưa đã tick)">
              Giờ công
            </th>
            {(['tc1', 'tc2', 'tc3'] as const).map((k, i) => (
              <th key={k} className={cn(h, tcx, i === 0 && g)} style={r}>
                {k.toUpperCase()}
                <span className="block font-normal">{tc[k]}</span>
              </th>
            ))}
            <th className={cn(h, g)} style={r}>
              Lần
            </th>
            <th className={h} style={r}>
              Phút
            </th>
            <th className={cn(h, g)} style={r}>
              Lần
            </th>
            <th className={h} style={r}>
              Phút
            </th>
            <th
              className={cn(h, g)}
              style={r}
              title="Ngày thường đã lấy dữ liệu, không quẹt, không nghỉ có lý do"
            >
              Vắng
            </th>
            <th
              className={h}
              style={r}
              title="Có lượt mà không tính được giờ — cần bổ sung"
            >
              Thiếu lượt
            </th>
            {LOAI_NGHI.map((k, i) => (
              <th key={k} className={cn(h, i === 0 && g)} style={r}>
                {KY_NGHI[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hang.map(({ n, t }, i) => (
            <tr key={n.ma} className="hover:bg-[var(--surface-hover)]">
              <td className={cn(c, 'num text-[var(--ink-3)]')} style={r}>
                {i + 1}
              </td>
              <td className={c}>
                <Link
                  href={`/hr/cham-cong/nguoi/${encodeURIComponent(n.ma)}?thang=${b.thang}`}
                  className="block max-w-[140px] truncate hover:text-[var(--act-text)] hover:underline"
                  title={n.ten}
                >
                  <span className="mr-1 font-mono text-[11px] text-[var(--ink-3)]">
                    {n.ma}
                  </span>
                  {n.ten}
                </Link>
              </td>
              <td className={cn(c, g, 'num font-semibold')} style={r}>
                {z(t.hcThuong / p1, 2)}
              </td>
              <td className={cn(c, 'num')} style={r}>
                {z(t.hcCn / p1, 2)}
              </td>
              <td className={cn(c, 'num')} style={r}>
                {z(t.hcLe / p1, 2)}
              </td>
              <td className={cn(c, 'num')} style={r}>
                {z((t.hcThuong + t.hcCn + t.hcLe) / 60, 2)}
              </td>
              {(['tc1', 'tc2', 'tc3'] as const).map((k, j) => (
                <td key={k} className={cn(c, 'num', tcx, j === 0 && g)} style={r}>
                  {z(t[k] / 60, 2)}
                </td>
              ))}
              <td className={cn(c, g, 'num')} style={r}>
                {z(t.lanTre)}
              </td>
              <td className={cn(c, 'num')} style={r}>
                {z(t.phutTre)}
              </td>
              <td className={cn(c, g, 'num')} style={r}>
                {z(t.lanSom)}
              </td>
              <td className={cn(c, 'num')} style={r}>
                {z(t.phutSom)}
              </td>
              <td className={cn(c, g, 'num')} style={r}>
                {z(t.vang)}
              </td>
              <td
                className={cn(
                  c,
                  'num',
                  t.thieu > 0 && 'font-semibold text-[var(--stop)]',
                )}
                style={r}
              >
                {z(t.thieu)}
              </td>
              {LOAI_NGHI.map((k, j) => (
                <td key={k} className={cn(c, 'num', j === 0 && g)} style={r}>
                  {z(t.nghi[k] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={f} />
            <td className={cn(f, 'font-sans')} style={{ textAlign: 'left' }}>
              <span title={`Công = giờ ca hành chính ÷ ${so(p1 / 60)}`}>
                Cộng {so(hang.length)} người
              </span>
            </td>
            <td className={cn(f, g)} style={r}>
              {so(cong((t) => t.hcThuong) / p1, 2)}
            </td>
            <td className={f} style={r}>
              {so(cong((t) => t.hcCn) / p1, 2)}
            </td>
            <td className={f} style={r}>
              {z(cong((t) => t.hcLe) / p1, 2)}
            </td>
            <td className={f} style={r}>
              {so(cong((t) => t.hcThuong + t.hcCn + t.hcLe) / 60, 1)}
            </td>
            {(['tc1', 'tc2', 'tc3'] as const).map((k, j) => (
              <td key={k} className={cn(f, tcx, j === 0 && g)} style={r}>
                {so(cong((t) => t[k]) / 60, 1)}
              </td>
            ))}
            <td className={cn(f, g)} style={r}>
              {z(cong((t) => t.lanTre))}
            </td>
            <td className={f} style={r}>
              {z(cong((t) => t.phutTre))}
            </td>
            <td className={cn(f, g)} style={r}>
              {z(cong((t) => t.lanSom))}
            </td>
            <td className={f} style={r}>
              {z(cong((t) => t.phutSom))}
            </td>
            <td className={cn(f, g)} style={r}>
              {z(cong((t) => t.vang))}
            </td>
            <td className={cn(f, 'text-[var(--stop)]')} style={r}>
              {z(cong((t) => t.thieu))}
            </td>
            {LOAI_NGHI.map((k, j) => (
              <td key={k} className={cn(f, j === 0 && g)} style={r}>
                {z(cong((t) => t.nghi[k] ?? 0))}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
