'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, DateInput, Empty, NoticeBar } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  deYNgay,
  gioPhut,
  laChuNhat,
  tachLuot,
  tenMay,
  tomTatMotNguoi,
} from '@/lib/cham-cong/mot-nguoi'
import type { MotNguoi } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { KhungTrang } from './khung-trang'
import { THU, dm, doiThang, thu } from './ky-cong.shared'
import { so } from './cham-cong.shared'
import { moTaDc, TEN_TINH_TRANG } from '@/lib/cham-cong/dieu-chinh'
import { DieuChinhSheet, type MoDieuChinh } from './dieu-chinh-sheet'

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
  // Tăng sau mỗi lần điều chỉnh để nạp lại (dữ liệu trang này tải ở client).
  const [lan, setLan] = useState(0)

  const sai =
    !tu || !den
      ? 'Chọn đủ từ ngày và đến ngày'
      : den < tu
        ? '"Đến ngày" phải sau hoặc bằng "Từ ngày"'
        : (Date.parse(den) - Date.parse(tu)) / 86400_000 >= 366
          ? 'Mỗi lần xem tối đa 1 năm'
          : null
  const khoa = `${ma}|${tu}|${den}|${lan}`
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

  // Đang nạp lại sau điều chỉnh: giữ bảng cũ thay vì nháy "Đang tải…".
  const xong = kq?.khoa === khoa || kq?.khoa.startsWith(`${ma}|${tu}|${den}|`) ? kq : null
  const data = xong?.data

  return (
    <div className="grid gap-3">
      {data && (
        <div>
          <div className="text-k-lg font-semibold">{data.nguoi.ten}</div>
          <dl className="text-k-sm mt-1 grid grid-cols-[repeat(4,minmax(0,auto))] justify-start gap-x-6 gap-y-0.5">
            <div>
              <dt className="text-k-label text-[var(--ink-3)]">Mã chấm công</dt>
              <dd className="num text-[var(--ink)]" style={{ textAlign: 'left' }}>
                {data.nguoi.ma}
              </dd>
            </div>
            <div>
              <dt className="text-k-label text-[var(--ink-3)]">Bộ phận</dt>
              <dd className={cn(!data.nguoi.boPhan && 'text-[var(--warn)]')}>
                {data.nguoi.boPhan ?? 'chưa có'}
              </dd>
            </div>
            <div>
              <dt className="text-k-label text-[var(--ink-3)]">Ca thường làm</dt>
              <dd>{data.nguoi.ca || '—'}</dd>
            </div>
            <div>
              <dt className="text-k-label text-[var(--ink-3)]">Quẹt ở máy</dt>
              <dd>
                {data.nguoi.maMay.length
                  ? [
                      ...new Set(data.nguoi.maMay.map((x) => tenMay(x.split(' ')[0]))),
                    ].join(', ')
                  : 'chưa ghép máy'}
              </dd>
            </div>
          </dl>
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
        <BangNgay data={data} q={q} taiLai={() => setLan((x) => x + 1)} />
      )}
    </div>
  )
}

function BangNgay({
  data,
  q,
  taiLai,
}: {
  data: MotNguoi
  q: string
  taiLai: () => void
}) {
  const t = tomTatMotNguoi(data.ngay)
  const [mo, setMo] = useState<MoDieuChinh | null>(null)
  const coDc = data.quyen.gui || data.quyen.duyet
  const coMat = data.ngay
    .map((n) => tachLuot(n.luot).coMatPhut)
    .filter((v): v is number => v != null)
  const tbCoMat = coMat.length
    ? Math.round(coMat.reduce((a, b) => a + b, 0) / coMat.length)
    : null
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
            <col style={{ width: 76 }} />
            <col style={{ width: 66 }} />
            <col style={{ width: 66 }} />
            <col />
            <col style={{ width: 92 }} />
            <col style={{ width: 92 }} />
            <col style={{ width: 52 }} />
            <col style={{ width: '28%' }} />
          </colgroup>
          <thead>
            <tr>
              <th className={h}>Ngày</th>
              <th className={h} title="Lượt quẹt đầu tiên trong ngày">
                Giờ vào
              </th>
              <th className={h} title="Lượt quẹt cuối cùng trong ngày">
                Giờ ra
              </th>
              <th className={h} title="Các lượt giữa lượt đầu và lượt cuối">
                Lượt giữa
              </th>
              <th
                className={h}
                title="Từ giờ vào tới giờ ra, chưa trừ nghỉ trưa — chỉ để xem, chưa phải giờ công"
              >
                Tổng thời gian
              </th>
              <th className={h}>Máy</th>
              <th
                className={h}
                style={{ textAlign: 'right' }}
                title="Số lượt sau khi gộp lượt bấm lặp trong 2 phút"
              >
                Số lượt
              </th>
              <th className={h}>Để ý</th>
            </tr>
          </thead>
          <tbody>
            {data.ngay.map((n) => {
              const de = deYNgay(n)
              const x = tachLuot(n.luot)
              const nen = laChuNhat(n.ngay)
                ? 'bg-[var(--chrome)]/60 text-[var(--ink-2)]'
                : de.some((y) => y.tone === 'stop')
                  ? 'bg-[var(--stop-wash)]'
                  : de.some((y) => y.tone === 'warn')
                    ? 'bg-[var(--warn-wash)]'
                    : ''
              const trai = { textAlign: 'left' as const }
              const dc = data.dieuChinh.filter(
                (d) =>
                  d.ngay === n.ngay &&
                  (d.tinhTrang === 'approved' || d.tinhTrang === 'pending'),
              )
              return (
                <tr key={n.ngay} className={nen}>
                  <td className={cn(c, 'num whitespace-nowrap')} style={trai}>
                    {dm(n.ngay)} {THU[thu(n.ngay)]}
                  </td>
                  <td className={cn(c, 'num font-semibold')} style={trai}>
                    {x.vao ?? '—'}
                  </td>
                  <td className={cn(c, 'num font-semibold')} style={trai}>
                    {x.ra ??
                      (x.vao ? (
                        <span className="font-normal text-[var(--warn)]">chưa có</span>
                      ) : (
                        '—'
                      ))}
                  </td>
                  <td className={cn(c, 'num text-[var(--ink-2)]')} style={trai}>
                    {x.giua.join(' · ')}
                  </td>
                  <td className={cn(c, 'num')} style={trai}>
                    {x.coMatPhut != null ? `${gioPhut(x.coMatPhut)}` : ''}
                  </td>
                  <td className={cn(c, 'text-[var(--ink-2)]')}>{x.may.join(', ')}</td>
                  <td className={cn(c, 'num')} style={{ textAlign: 'right' }}>
                    {n.daLay ? n.luot.length : ''}
                  </td>
                  <td
                    className={cn(
                      c,
                      de.some((y) => y.tone === 'stop') && 'text-[var(--stop)]',
                      de.some((y) => y.tone === 'warn') && 'text-[var(--warn)]',
                    )}
                  >
                    {de.map((y) => y.text).join(', ')}
                    {dc.map((d) => (
                      <span
                        key={d.id}
                        className={cn(
                          'block',
                          d.tinhTrang === 'approved'
                            ? 'text-[var(--act-text)]'
                            : 'text-[var(--warn)]',
                        )}
                      >
                        {moTaDc(d)} · {TEN_TINH_TRANG[d.tinhTrang].toLowerCase()}
                      </span>
                    ))}
                    {coDc && n.daLay && (
                      <button
                        type="button"
                        onClick={() =>
                          setMo({
                            ma: data.nguoi.ma,
                            ten: data.nguoi.ten,
                            to: data.nguoi.boPhan,
                            ca: data.nguoi.ca,
                            ngay: n.ngay,
                            luot: n.luot,
                          })
                        }
                        className="text-k-label block text-[var(--act-text)] hover:underline"
                      >
                        Điều chỉnh…
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={4}
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
                style={{ textAlign: 'left' }}
                title="Tổng thời gian trung bình — các ngày có cả giờ vào và giờ ra"
              >
                {tbCoMat != null ? `TB ${gioPhut(tbCoMat)}` : ''}
              </td>
              <td
                className={cn(
                  c,
                  'sticky bottom-0 border-t border-[var(--line)] bg-[var(--surface-raised)]',
                )}
              />
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
      <DieuChinhSheet
        mo={mo}
        dcs={data.dieuChinh}
        quyen={data.quyen}
        onClose={() => setMo(null)}
        onDoi={taiLai}
      />
    </>
  )
}
