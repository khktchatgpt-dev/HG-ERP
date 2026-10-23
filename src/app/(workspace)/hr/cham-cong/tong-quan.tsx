'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Btn } from '@/components/kit'
import { cn } from '@/lib/utils'
import { tinhCoMat } from '@/lib/cham-cong/co-mat'
import { useKyCong } from './useKyCong'
import { KhungTrang } from './khung-trang'
import { THU, dm, thu, type KyCong } from './ky-cong.shared'
import { so } from './cham-cong.shared'

/** Từ mức này coi là "sắp đầy" — cùng ngưỡng trang Lấy dữ liệu. */
const SAP_DAY = 85

/**
 * TỔNG QUAN CHẤM CÔNG — cửa ngõ của nhóm Chấm công (bản vẽ TongQuan.dc.html, duyệt
 * 17/10/2026): "hôm nay ai có mặt, tháng này có gì cần xử lý?". Chỉ ô đếm + vài
 * dòng nổi bật + link sang trang làm việc thật (mỗi trang một vai trò). Mọi số đếm
 * bằng ĐÚNG hàm trang đích dùng (`tinhCoMat`, cờ của Hồ sơ nhân viên).
 */
export function TongQuanScreen({ k }: { k: KyCong }) {
  const d = useKyCong(k)
  const nv = k.nv!
  const m = useMemo(
    () =>
      tinhCoMat({
        theoNgay: k.du.theoNgay,
        dong: k.du.dong,
        nhanSu: [...k.du.nhanSu, ...k.du.daNghi],
        homNay: k.homNay,
      }),
    [k],
  )
  // Ngày gần nhất đã có dữ liệu (thường là hôm qua — hôm nay chưa lấy về).
  const iCuoi = m.tong.findLastIndex((v) => v != null)
  const ngayCuoi = iCuoi >= 0 ? m.ngays[iCuoi] : null
  const chuaLay = m.ngays.filter((_, i) => m.tong[i] == null)
  const tenMay = nv.ds.filter((n) => n.active && n.tenTuMay).length
  const chuaBp = nv.ds.filter((n) => n.active && !n.boPhan).length
  const mayDay = k.du.may
    .map((x) => ({
      x,
      p: x.luot != null && x.sucChua ? Math.round((x.luot / x.sucChua) * 100) : null,
    }))
    .filter((y) => y.p != null)
    .sort((a, b) => b.p! - a.p!)[0]
  const toThap = ngayCuoi
    ? m.tos
        .filter((t) => t.ds.length > 0)
        .map((t) => ({
          t,
          n: t.ngay[iCuoi] ?? 0,
          r: t.mau[iCuoi] ? (t.ngay[iCuoi] ?? 0) / t.mau[iCuoi] : 1,
        }))
        .sort((a, b) => a.r - b.r || b.t.ds.length - a.t.ds.length)
    : []
  const q = `?thang=${k.thang}`

  const viec: { ten: string; vi: string; href: string; nut: string }[] = []
  if (chuaLay.length)
    viec.push({
      ten: `Lấy dữ liệu ${chuaLay.length === 1 ? `ngày ${dm(chuaLay[0])}` : `${chuaLay.length} ngày (${dm(chuaLay[0])} → ${dm(chuaLay.at(-1)!)})`}`,
      vi: 'Ngày chưa lấy về thì bảng có mặt và lượt quẹt để trống — không phải vắng.',
      href: `/hr/cham-cong/lay-du-lieu${q}`,
      nut: 'Lấy dữ liệu',
    })
  if (tenMay)
    viec.push({
      ten: `Gõ họ tên đầy đủ cho ${so(tenMay)} người`,
      vi: 'Máy chỉ ghi 2 chữ cuối (vd "THI HOA") — chưa biết là ai.',
      href: '/hr/nhan-vien',
      nut: 'Hồ sơ nhân viên',
    })
  if (chuaBp)
    viec.push({
      ten: `Gán bộ phận cho ${so(chuaBp)} người`,
      vi: 'Không có bộ phận thì không vào đúng tổ ở bảng có mặt.',
      href: '/hr/nhan-vien',
      nut: 'Hồ sơ nhân viên',
    })
  if (nv.maChuaGhep.length)
    viec.push({
      ten: `Ghép ${so(nv.maChuaGhep.length)} mã có quẹt chưa thuộc về ai`,
      vi: 'Lượt của các mã này chưa vào bảng có mặt của ai.',
      href: '/hr/nhan-vien',
      nut: 'Hồ sơ nhân viên',
    })
  if (mayDay && mayDay.p! >= SAP_DAY)
    viec.push({
      ten: `${mayDay.x.ten} sắp đầy (${mayDay.p}%)`,
      vi: 'Chỉ dọn log trên máy SAU KHI đã lấy về đủ các tháng cũ.',
      href: `/hr/cham-cong/lay-du-lieu${q}`,
      nut: 'Lấy dữ liệu',
    })

  const o =
    'min-w-0 flex-1 border-r border-[var(--line)] px-3.5 py-2 last:border-r-0 hover:bg-[var(--surface-hover)]'
  const c = 'border-b border-[var(--line-faint)]/40 px-2.5 py-1'
  const h = cn(
    c,
    'border-[var(--line)] bg-[var(--surface-raised)] text-left font-semibold text-[var(--ink-2)]',
  )

  return (
    <KhungTrang
      ten="Tổng quan chấm công"
      thang={k.thang}
      khoang={{ tu: k.tu, den: k.den }}
      onThang={d.xemThang}
      facts={[{ label: 'Hôm nay', value: dm(k.homNay) }]}
      actions={
        <Btn
          icon="excel"
          onClick={() =>
            window.location.assign(
              `/api/dept/hr/cham-cong/du-lieu/excel?tu=${k.tu}&den=${k.den}`,
            )
          }
        >
          Xuất Excel tháng
        </Btn>
      }
    >
      <div className="flex border-b border-[var(--line)] bg-[var(--surface-card)]">
        <Link href={`/hr/cham-cong/co-mat${q}`} className={o}>
          <span className="text-k-label block text-[var(--ink-2)]">
            Có mặt {ngayCuoi ? `${THU[thu(ngayCuoi)]} ${dm(ngayCuoi)}` : '—'}
          </span>
          <span className="num block text-[20px] leading-7 font-semibold">
            {ngayCuoi ? so(m.tong[iCuoi]!) : '—'}
            <span className="text-k-sm font-normal text-[var(--ink-2)]">
              {' '}
              / {so(iCuoi >= 0 ? m.tongMau[iCuoi] : m.tongNguoi)}
            </span>
          </span>
          <span className="text-k-label block text-[var(--ink-2)]">
            TB ngày thường {m.tbTong == null ? '—' : `${Math.round(m.tbTong * 100)}%`}
          </span>
        </Link>
        <Link href={`/hr/cham-cong/lay-du-lieu${q}`} className={o}>
          <span className="text-k-label block text-[var(--ink-2)]">
            Ngày chưa lấy dữ liệu
          </span>
          <span
            className={cn(
              'num block text-[20px] leading-7 font-semibold',
              chuaLay.length > 0 && 'text-[var(--warn)]',
            )}
          >
            {so(chuaLay.length)}
          </span>
          <span className="text-k-label block text-[var(--ink-2)]">
            {chuaLay.length ? `từ ${dm(chuaLay[0])}` : 'đã lấy đủ tới hôm nay'}
          </span>
        </Link>
        <Link href="/hr/nhan-vien" className={o}>
          <span className="text-k-label block text-[var(--ink-2)]">
            Còn tên lấy từ máy
          </span>
          <span
            className={cn(
              'num block text-[20px] leading-7 font-semibold',
              tenMay > 0 && 'text-[var(--warn)]',
            )}
          >
            {so(tenMay)}
          </span>
          <span className="text-k-label block text-[var(--ink-2)]">
            {so(chuaBp)} chưa có bộ phận
          </span>
        </Link>
        <Link href="/hr/nhan-vien" className={o}>
          <span className="text-k-label block text-[var(--ink-2)]">
            Mã có quẹt chưa ghép
          </span>
          <span
            className={cn(
              'num block text-[20px] leading-7 font-semibold',
              nv.maChuaGhep.length > 0 && 'text-[var(--stop)]',
            )}
          >
            {so(nv.maChuaGhep.length)}
          </span>
          <span className="text-k-label block text-[var(--ink-2)]">
            {nv.maChuaGhep.length ? 'lượt chưa thuộc về ai' : 'mọi lượt đều có chủ'}
          </span>
        </Link>
        <Link href={`/hr/cham-cong/lay-du-lieu${q}`} className={o}>
          <span className="text-k-label block text-[var(--ink-2)]">
            {mayDay ? `${mayDay.x.ten} đã dùng` : 'Máy chấm công'}
          </span>
          <span
            className={cn(
              'num block text-[20px] leading-7 font-semibold',
              mayDay && mayDay.p! >= SAP_DAY && 'text-[var(--warn)]',
            )}
          >
            {mayDay ? `${mayDay.p}%` : '—'}
          </span>
          <span className="text-k-label block text-[var(--ink-2)]">
            {mayDay
              ? `${so(mayDay.x.luot!)} / ${so(mayDay.x.sucChua!)} lượt`
              : 'chưa kiểm'}
          </span>
        </Link>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 overflow-y-auto bg-[var(--surface-card)]">
        <section
          aria-label="Đi làm theo tổ"
          className="min-w-0 border-r border-[var(--line)]"
        >
          <h2 className="text-k-sm flex justify-between border-b border-[var(--line)] px-3.5 py-2 font-semibold">
            Đi làm theo tổ {ngayCuoi ? `${THU[thu(ngayCuoi)]} ${dm(ngayCuoi)}` : ''}
            <Link
              href={`/hr/cham-cong/co-mat${q}`}
              className="font-normal text-[var(--act-text)] hover:underline"
            >
              Mở Có mặt theo tổ →
            </Link>
          </h2>
          {toThap.length === 0 ? (
            <p className="text-k-sm px-3.5 py-3 text-[var(--ink-2)]">
              Tháng này chưa có ngày nào có dữ liệu — lấy về ở trang Lấy dữ liệu.
            </p>
          ) : (
            <table className="text-k-sm w-full table-fixed border-separate border-spacing-0">
              <colgroup>
                <col />
                <col style={{ width: 84 }} />
                <col style={{ width: 56 }} />
                <col style={{ width: 80 }} />
              </colgroup>
              <thead>
                <tr>
                  <th className={h}>Tổ</th>
                  <th className={h} style={{ textAlign: 'right' }}>
                    Có mặt
                  </th>
                  <th className={h} style={{ textAlign: 'right' }}>
                    %
                  </th>
                  <th className={h} style={{ textAlign: 'right' }}>
                    TB tháng
                  </th>
                </tr>
              </thead>
              <tbody>
                {toThap.map(({ t, n, r }) => (
                  <tr key={t.to}>
                    <td className={cn(c, 'truncate')} title={t.to}>
                      <Link
                        href={`/hr/cham-cong/gio-cong${q}&bp=${encodeURIComponent(t.to)}`}
                        className="text-[var(--act-text)] hover:underline"
                      >
                        {t.to}
                      </Link>
                    </td>
                    <td className={cn(c, 'num')} style={{ textAlign: 'right' }}>
                      {n} / {t.mau[iCuoi] ?? t.ds.length}
                    </td>
                    <td
                      className={cn(
                        c,
                        'num',
                        r < 0.6
                          ? 'text-[var(--stop)]'
                          : r < 0.85
                            ? 'text-[var(--warn)]'
                            : '',
                      )}
                      style={{ textAlign: 'right' }}
                    >
                      {Math.round(r * 100)}%
                    </td>
                    <td className={cn(c, 'num')} style={{ textAlign: 'right' }}>
                      {t.tb == null ? '—' : `${Math.round(t.tb * 100)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-k-label px-3.5 py-1.5 text-[var(--ink-3)]">
            Ô = người có ít nhất 1 lượt quẹt · không gồm {so(k.du.khongCham)} người Không
            chấm công
          </p>
        </section>

        <section aria-label="Việc cần làm" className="min-w-0">
          <h2 className="text-k-sm border-b border-[var(--line)] px-3.5 py-2 font-semibold">
            Việc cần làm
          </h2>
          {viec.length === 0 ? (
            <p className="text-k-sm px-3.5 py-3 text-[var(--ink-2)]">
              Không có việc tồn — dữ liệu đã lấy đủ, nhân viên đã ghép hết.
            </p>
          ) : (
            viec.map((x) => (
              <Link
                key={x.ten}
                href={x.href}
                className="flex justify-between gap-3 border-b border-[var(--line-faint)]/60 px-3.5 py-2.5 hover:bg-[var(--surface-hover)]"
              >
                <span className="min-w-0">
                  <b className="font-semibold">{x.ten}</b>
                  <span className="text-k-label block text-[var(--ink-2)]">{x.vi}</span>
                </span>
                <span className="text-k-sm shrink-0 text-[var(--act-text)]">
                  {x.nut} →
                </span>
              </Link>
            ))
          )}
        </section>
      </div>
    </KhungTrang>
  )
}
