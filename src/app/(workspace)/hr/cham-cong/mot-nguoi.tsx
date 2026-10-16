'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, DateInput, Empty, NoticeBar } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { cn } from '@/lib/utils'
import { deYNgay, laChuNhat, tomTatMotNguoi } from '@/lib/cham-cong/mot-nguoi'
import type { MotNguoi } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { KhungTrang } from './khung-trang'
import { THU, dm, doiThang, thu } from './ky-cong.shared'
import { so } from './cham-cong.shared'

/** Kỳ đang xem — chỉ cần ngần này để đặt khoảng mặc định và nút nhanh. */
export type KyXem = { thang: string; tu: string; den: string; homNay: string }

/**
 * TRANG "CHẤM CÔNG MỘT NGƯỜI" (bản vẽ MotNguoi.dc.html, duyệt 16/10/2026; thành
 * trang riêng 17/10/2026 khi tách trang — link gửi được). Mọi ngày trong khoảng
 * Từ–Đến, kể cả ngày không quẹt; xuất Excel đúng khoảng đang xem. Mở từ tên ở trang
 * Lượt quẹt, Có mặt theo tổ và Hồ sơ nhân viên. Chỉ bày lượt — chưa tính công.
 */
export function MotNguoiScreen({ ky, ma }: { ky: KyXem; ma: string }) {
  const router = useRouter()
  return (
    <KhungTrang
      ten="Chấm công một người"
      actions={
        <Btn icon="quayLai" onClick={() => router.back()}>
          Quay lại
        </Btn>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-card)] px-[var(--gutter)] py-3">
        <NoiDung key={ma} ky={ky} ma={ma} />
      </div>
    </KhungTrang>
  )
}

const congNgay = (iso: string, n: number) => {
  const t = new Date(`${iso}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}
const cuoiThang = (t: string) => {
  const [y, m] = t.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

function NoiDung({ ky: k, ma }: { ky: KyXem; ma: string }) {
  const homNay = k.homNay
  const denKy = homNay < k.den ? homNay : k.den
  const [tu, setTu] = useState(k.tu)
  const [den, setDen] = useState(denKy)
  const [kq, setKq] = useState<{ khoa: string; data?: MotNguoi; loi?: string } | null>(
    null,
  )

  const sai =
    !tu || !den
      ? 'Chọn đủ từ ngày và đến ngày'
      : den < tu
        ? '"Đến ngày" phải sau hoặc bằng "Từ ngày"'
        : (Date.parse(den) - Date.parse(tu)) / 86400_000 >= 366
          ? 'Mỗi lần xem tối đa 1 năm'
          : null
  const khoa = `${ma}|${tu}|${den}`
  const q = `ma=${encodeURIComponent(ma)}&tu=${tu}&den=${den}`

  useEffect(() => {
    if (sai) return
    let huy = false
    api<MotNguoi>(`/api/dept/hr/cham-cong/nguoi?${q}`)
      .then((data) => !huy && setKq({ khoa, data }))
      .catch((e) => !huy && setKq({ khoa, loi: apiErrorText(e) }))
    return () => {
      huy = true
    }
  }, [q, khoa, sai])

  const thangTruoc = doiThang(k.thang, -1)
  const nhanh: { ten: string; tu: string; den: string }[] = [
    { ten: 'Kỳ này', tu: k.tu, den: denKy },
    { ten: 'Kỳ trước', tu: `${thangTruoc}-01`, den: cuoiThang(thangTruoc) },
    { ten: '7 ngày', tu: congNgay(homNay, -6), den: homNay },
    { ten: '30 ngày', tu: congNgay(homNay, -29), den: homNay },
  ]

  const xong = kq?.khoa === khoa ? kq : null
  const data = xong?.data

  return (
    <div className="grid gap-3">
      {data && (
        <div>
          <div className="text-k-lg font-semibold">
            <span className="num text-[var(--act-text)]">{data.nguoi.ma}</span>{' '}
            {data.nguoi.ten}
          </div>
          <div className="text-k-label text-[var(--ink-2)]">
            {data.nguoi.boPhan ?? '(chưa có bộ phận)'} · ca thường làm {data.nguoi.ca} ·
            mã máy {data.nguoi.maMay.join(', ') || '—'}
          </div>
        </div>
      )}
      {data?.nguoi.khongChamCong && (
        <NoticeBar tone="neutral" tag="Không chấm công">
          Người này không quẹt máy — không quẹt không có nghĩa là vắng.
        </NoticeBar>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <DateInput label="Từ ngày" value={tu} onChange={setTu} />
        <DateInput label="Đến ngày" value={den} onChange={setDen} />
        {nhanh.map((n) => {
          const on = n.tu === tu && n.den === den
          return (
            <button
              key={n.ten}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setTu(n.tu)
                setDen(n.den)
              }}
              className={cn(
                'text-k-sm h-7 border px-2.5',
                on
                  ? 'border-[var(--act)] bg-[var(--act-wash)] text-[var(--act-text)]'
                  : 'border-[var(--line)] bg-[var(--surface-card)] hover:bg-[var(--surface-hover)]',
              )}
            >
              {n.ten}
            </button>
          )
        })}
      </div>

      {sai ? (
        <NoticeBar tone="stop" tag="Khoảng ngày">
          {sai}
        </NoticeBar>
      ) : xong?.loi ? (
        <NoticeBar tone="stop" tag="Chưa tải được">
          {xong.loi}
        </NoticeBar>
      ) : !data ? (
        <p className="text-k-sm text-[var(--ink-2)]">Đang tải…</p>
      ) : (
        <BangNgay data={data} q={q} />
      )}
    </div>
  )
}

function BangNgay({ data, q }: { data: MotNguoi; q: string }) {
  const t = tomTatMotNguoi(data.ngay)
  const o = 'min-w-0 border-r border-[var(--line)] px-2.5 py-1.5 last:border-r-0'
  // Không cuộn ngang (17/10/2026): cột cố định bề rộng, ô dài được xuống dòng.
  const c = 'border-b border-[var(--line-faint)]/40 px-2 py-1 align-top'
  const h = cn(
    c,
    'sticky top-0 z-[1] border-[var(--line)] bg-[var(--surface-raised)] text-left font-semibold whitespace-nowrap text-[var(--ink-2)]',
  )
  if (data.ngay.every((n) => !n.daLay))
    return (
      <Empty
        headline="Khoảng này chưa có dữ liệu chấm công"
        reason="Cả công ty chưa có lượt nào trong khoảng — dữ liệu chỉ vào ERP khi bấm “Lấy về từ máy”."
        next="Chọn khoảng khác, hoặc lấy dữ liệu về ở bước ① trước."
      />
    )
  return (
    <>
      <div className="grid grid-cols-5 border border-[var(--line)]">
        <div className={o}>
          <div className="text-k-label text-[var(--ink-2)]">Có quẹt / ngày thường</div>
          <div className="num text-[18px] font-semibold">
            {so(t.coQuet)}
            <span className="text-k-sm font-normal text-[var(--ink-2)]">
              {' '}
              / {so(t.ngayThuong)}
            </span>
          </div>
        </div>
        <div className={o}>
          <div className="text-k-label text-[var(--ink-2)]">Không quẹt</div>
          <div
            className={cn(
              'num text-[18px] font-semibold',
              t.khongQuet > 0 && 'text-[var(--stop)]',
            )}
          >
            {so(t.khongQuet)}
          </div>
        </div>
        <div className={o}>
          <div className="text-k-label text-[var(--ink-2)]">Chỉ 1 lượt</div>
          <div
            className={cn(
              'num text-[18px] font-semibold',
              t.motLuot > 0 && 'text-[var(--warn)]',
            )}
          >
            {so(t.motLuot)}
          </div>
        </div>
        <div className={o}>
          <div className="text-k-label text-[var(--ink-2)]">Từ 3 lượt</div>
          <div className="num text-[18px] font-semibold">{so(t.tuBaLuot)}</div>
        </div>
        <div className={o}>
          <div className="text-k-label text-[var(--ink-2)]">Quẹt chủ nhật</div>
          <div className="num text-[18px] font-semibold">{so(t.quetChuNhat)}</div>
        </div>
      </div>

      <div className="overflow-y-auto border border-[var(--line)]">
        <table className="text-k-sm w-full table-fixed border-separate border-spacing-0">
          <colgroup>
            <col style={{ width: 72 }} />
            <col />
            <col style={{ width: 44 }} />
            <col style={{ width: '30%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className={h}>Ngày</th>
              <th className={h}>Các lượt (giờ · máy)</th>
              <th className={h} style={{ textAlign: 'right' }}>
                Lượt
              </th>
              <th className={h}>Để ý</th>
            </tr>
          </thead>
          <tbody>
            {data.ngay.map((n) => {
              const de = deYNgay(n)
              const nen = laChuNhat(n.ngay)
                ? 'bg-[var(--chrome)]/60 text-[var(--ink-2)]'
                : de.some((x) => x.tone === 'stop')
                  ? 'bg-[var(--stop-wash)]'
                  : de.some((x) => x.tone === 'warn')
                    ? 'bg-[var(--warn-wash)]'
                    : ''
              return (
                <tr key={n.ngay} className={nen}>
                  <td className={cn(c, 'num whitespace-nowrap')}>
                    {dm(n.ngay)} {THU[thu(n.ngay)]}
                  </td>
                  <td className={cn(c, 'num')}>
                    {n.luot.length
                      ? n.luot.map((l, i) => (
                          <span
                            key={i}
                            className="mr-2 inline-block whitespace-nowrap"
                            title={l.gio}
                          >
                            {l.gio.slice(0, 5)}{' '}
                            <span className="text-[var(--ink-3)]">{l.may}</span>
                          </span>
                        ))
                      : '—'}
                  </td>
                  <td className={cn(c, 'num')} style={{ textAlign: 'right' }}>
                    {n.daLay ? n.luot.length : ''}
                  </td>
                  <td
                    className={cn(
                      c,
                      de.some((x) => x.tone === 'stop') && 'text-[var(--stop)]',
                      de.some((x) => x.tone === 'warn') && 'text-[var(--warn)]',
                    )}
                  >
                    {de.map((x) => x.text).join(', ')}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={2}
                className={cn(
                  c,
                  'sticky bottom-0 border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold',
                )}
              >
                {so(data.ngay.length)} ngày · {so(t.coQuet)}/{so(t.ngayThuong)} ngày
                thường có quẹt
                {t.chuaLay > 0 && (
                  <span className="font-normal text-[var(--ink-2)]">
                    {' '}
                    · {so(t.chuaLay)} ngày chưa lấy dữ liệu (không tính vắng)
                  </span>
                )}
              </td>
              <td
                className={cn(
                  c,
                  'num sticky bottom-0 border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold',
                )}
                style={{ textAlign: 'right' }}
              >
                {so(t.tongLuot)}
              </td>
              <td
                className={cn(
                  c,
                  'sticky bottom-0 border-t border-[var(--line)] bg-[var(--surface-raised)]',
                )}
              />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex">
        <Btn
          icon="excel"
          onClick={() =>
            window.location.assign(`/api/dept/hr/cham-cong/nguoi/excel?${q}`)
          }
        >
          Xuất Excel người này
        </Btn>
      </div>
    </>
  )
}
