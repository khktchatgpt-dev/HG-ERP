'use client'

import { Fragment, useState } from 'react'
import { Btn, Empty, NoticeBar } from '@/components/kit'
import { cn } from '@/lib/utils'
import { tenMay } from '@/lib/cham-cong/mot-nguoi'
import { SO_CAP, ghiChuNgay, tongCong } from '@/lib/cham-cong/chi-tiet-cong'
import { moTaDc, TEN_NGHI, TEN_TINH_TRANG } from '@/lib/cham-cong/dieu-chinh'
import type { MotNguoiCong } from '@/modules/dept/hr/cham-cong/gio-cong.service'
import { THU, dm, thu } from './ky-cong.shared'
import { so } from './cham-cong.shared'
import { DieuChinhSheet, type MoDieuChinh } from './dieu-chinh-sheet'
import { khongTheoKhung, TEN_CACH_TINH } from '@/lib/cham-cong/ky-gio-cong'

/**
 * BẢNG CÔNG TỪNG NGÀY CỦA MỘT NGƯỜI — bố cục tờ "Chi tiết" của phần mềm chấm công cũ
 * (bản vẽ duyệt 20/10/2026): dải tổng đầu trang, mỗi ngày một dòng Lượt máy · Giờ được
 * tính · Trễ · Sớm · Công · Giờ · TC1–TC3. Giờ do Bảng công tính (`chiTietNguoi`), trang
 * này chỉ bày. Không cuộn ngang: cột cố định bề rộng, Ghi chú co giãn.
 */

const gio = (phut: number, le = 1) => (phut ? so(phut / 60, le) : '')

/** Chỉ số cặp Vào/Ra bày thành cột: 0, 1, 2 (đoạn thứ 4 trở đi ghi ở Ghi chú). */
const CAP = Array.from({ length: SO_CAP }, (_, i) => i)

/** '04:12(+1)' → 04:12 kèm dấu +1 nhỏ: giờ ra rơi sang hôm sau (ca qua đêm). */
function Gio({ g }: { g: string }) {
  const m = /^(\d\d:\d\d)\(\+(\d)\)$/.exec(g)
  if (!m) return <>{g}</>
  return (
    <span title={`${m[1]} hôm sau`}>
      {m[1]}
      <sup className="text-[9px] text-[var(--warn)]">+{m[2]}</sup>
    </span>
  )
}

function O({
  nhan,
  so: gt,
  phu,
  tone,
}: {
  nhan: string
  so: string
  phu: string
  tone?: 'stop'
}) {
  return (
    <div className="min-w-0 border-r border-[var(--line)] px-2.5 py-1.5 last:border-r-0">
      <div className="text-k-label text-[var(--ink-3)]">{nhan}</div>
      {/* `.kit .num` căn phải và thắng Tailwind — ô tổng căn trái theo nhãn, đè inline. */}
      <div
        className={cn(
          'num text-[15px] font-semibold',
          tone === 'stop' && 'text-[var(--stop)]',
        )}
        style={{ textAlign: 'left' }}
      >
        {gt}
      </div>
      <div className="text-k-label leading-tight text-[var(--ink-2)]">{phu}</div>
    </div>
  )
}

export function CongTungNgay({
  data,
  q,
  taiLai,
}: {
  data: MotNguoiCong
  q: string
  taiLai: () => void
}) {
  const [mo, setMo] = useState<MoDieuChinh | null>(null)
  const coDc = data.quyen.gui || data.quyen.duyet
  const tinh = 'loi' in data.tinh ? null : data.tinh
  const congCua = new Map(tinh?.ngay.map((x) => [x.ngay, x]) ?? [])
  const daLay = new Set(data.ngay.filter((n) => n.daLay).map((n) => n.ngay))
  const t = tinh ? tongCong(tinh.ngay, (iso) => daLay.has(iso)) : null
  const p1 = tinh?.phutMotCong ?? 480
  const cong = (phut: number) => so(phut / p1, 2)
  const nhanTc = tinh?.nhanTc ?? { tc1: '', tc2: '', tc3: '' }
  const tongTc = t ? t.tc1 + t.tc2 + t.tc3 : 0
  const nghi = t ? Object.entries(t.nghi) : []

  if (data.ngay.every((n) => !n.daLay))
    return (
      <Empty
        headline="Khoảng này chưa có dữ liệu chấm công"
        reason="Cả công ty chưa có lượt nào trong khoảng — dữ liệu chỉ vào ERP khi lấy về từ máy."
        next="Chọn khoảng khác, hoặc vào Lấy dữ liệu từ máy trước."
      />
    )

  const c = 'border-b border-[var(--line-faint)]/40 px-1.5 py-1 align-top'
  const r = { textAlign: 'right' as const }
  const l = { textAlign: 'left' as const }
  const h = cn(
    c,
    'sticky top-0 z-[1] border-[var(--line)] bg-[var(--surface-raised)] font-semibold leading-tight text-[var(--ink-2)]',
  )
  const f = cn(
    c,
    'num sticky bottom-0 border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold',
  )
  const tc = 'text-[var(--grp-1-ink)]'
  const g = 'border-l border-[var(--line)]'

  return (
    <>
      {'loi' in data.tinh && (
        <NoticeBar tone="neutral" tag="Chưa tính công">
          {data.tinh.loi}
        </NoticeBar>
      )}
      {t && (
        <div className="grid grid-cols-8 border border-[var(--line)]">
          <O
            nhan="Công ngày thường"
            so={cong(t.hcThuong)}
            phu={`/ ${so(t.ngayThuong)} ngày làm việc`}
          />
          <O
            nhan="Công chủ nhật"
            so={cong(t.hcCn)}
            phu={`${so(t.cnCoLam)} / ${so(t.chuNhat)} CN có làm`}
          />
          <O
            nhan="Công lễ"
            so={cong(t.hcLe)}
            phu={t.ngayLe ? `${so(t.ngayLe)} ngày lễ trong khoảng` : 'không có ngày lễ'}
          />
          <O
            nhan="Tăng ca (giờ)"
            so={so(tongTc / 60, 1)}
            phu={`TC1 ${so(t.tc1 / 60, 1)} · TC2 ${so(t.tc2 / 60, 1)} · TC3 ${so(t.tc3 / 60, 1)}`}
          />
          <O
            nhan="Vào trễ"
            so={`${so(t.lanTre)} lần`}
            phu={t.phutTre ? `${so(t.phutTre)} phút` : 'quá ân hạn sau giờ vào ca'}
          />
          <O
            nhan="Về sớm"
            so={`${so(t.lanSom)} lần`}
            phu={t.phutSom ? `${so(t.phutSom)} phút` : 'ra trước giờ tan ca'}
          />
          <O
            nhan="Thiếu lượt"
            so={`${so(t.thieu)} ngày`}
            phu={t.thieu ? 'bổ sung ở cột Ghi chú' : 'không có'}
            tone={t.thieu ? 'stop' : undefined}
          />
          <O
            nhan="Vắng"
            so={so(t.vang)}
            phu={
              nghi.length
                ? `nghỉ có lý do: ${nghi.map(([k, v]) => `${TEN_NGHI[k as keyof typeof TEN_NGHI]} ${v}`).join(', ')}`
                : 'ngày thường không quẹt'
            }
          />
        </div>
      )}

      <div className="border border-[var(--line)]">
        <table className="text-k-sm w-full table-fixed border-separate border-spacing-0">
          <colgroup>
            <col style={{ width: 68 }} />
            {CAP.map((i) => (
              <Fragment key={i}>
                <col style={{ width: 50 }} />
                <col style={{ width: 50 }} />
              </Fragment>
            ))}
            <col style={{ width: 96 }} />
            <col style={{ width: 40 }} />
            <col style={{ width: 40 }} />
            <col style={{ width: 46 }} />
            <col style={{ width: 40 }} />
            <col style={{ width: 50 }} />
            <col style={{ width: 50 }} />
            <col style={{ width: 50 }} />
            <col style={{ width: 58 }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th className={h} style={l}>
                Ngày
              </th>
              {CAP.map((i) => (
                <Fragment key={i}>
                  <th
                    className={cn(h, g)}
                    style={l}
                    title={`Giờ máy ghi — lượt vào của đoạn làm thứ ${i + 1}`}
                  >
                    Vào {i + 1}
                  </th>
                  <th
                    className={h}
                    style={l}
                    title={`Giờ máy ghi — lượt ra của đoạn làm thứ ${i + 1}`}
                  >
                    Ra {i + 1}
                  </th>
                </Fragment>
              ))}
              <th
                className={cn(h, g)}
                style={l}
                title="Giờ vào → giờ ra sau ân hạn và làm tròn — giờ dùng để tính công, mỗi đoạn một dòng"
              >
                Giờ được tính
              </th>
              <th
                className={h}
                style={r}
                title="Phút vào sau giờ vào ca, khi đã quá ân hạn (theo giờ máy)"
              >
                Trễ
              </th>
              <th className={h} style={r} title="Phút ra trước giờ tan ca (theo giờ máy)">
                Sớm
              </th>
              <th className={cn(h, g)} style={r} title="Giờ ca hành chính ÷ giờ một công">
                Công
              </th>
              <th
                className={h}
                style={r}
                title="Giờ ca hành chính (gồm làm trưa đã tick)"
              >
                Giờ
              </th>
              <th className={cn(h, g, tc)} style={r}>
                TC1
                <span className="block font-normal">{nhanTc.tc1}</span>
              </th>
              <th className={cn(h, tc)} style={r}>
                TC2
                <span className="block font-normal">{nhanTc.tc2}</span>
              </th>
              <th className={cn(h, tc)} style={r}>
                TC3
                <span className="block font-normal">{nhanTc.tc3}</span>
              </th>
              <th className={cn(h, g)} style={l}>
                Máy
              </th>
              <th className={h} style={l}>
                Ghi chú
              </th>
            </tr>
          </thead>
          <tbody>
            {data.ngay.map((n) => {
              const x = congCua.get(n.ngay)
              const ghi = ghiChuNgay(n, x)
              const dc = data.dieuChinh.filter(
                (d) =>
                  d.ngay === n.ngay &&
                  (d.tinhTrang === 'approved' || d.tinhTrang === 'pending'),
              )
              const nen = x?.thieu
                ? 'bg-[var(--stop-wash)]'
                : x?.loai === 'le'
                  ? 'bg-[var(--warn-wash)]'
                  : thu(n.ngay) === 0
                    ? 'bg-[var(--grp-2-wash)]/60'
                    : ''
              const coGio = !!x?.tinhDuoc
              return (
                <tr key={n.ngay} className={cn('group', nen)}>
                  <td className={cn(c, 'num whitespace-nowrap')} style={l}>
                    {dm(n.ngay)} {THU[thu(n.ngay)]}
                  </td>
                  {CAP.map((i) => {
                    const p = x?.cap[i]
                    return (
                      <Fragment key={i}>
                        <td className={cn(c, g, 'num font-semibold')} style={l}>
                          {p && <Gio g={p.vao} />}
                        </td>
                        <td className={cn(c, 'num font-semibold')} style={l}>
                          {p?.ra ? (
                            <Gio g={p.ra} />
                          ) : p && x?.thieu ? (
                            <span
                              className="text-[var(--stop)]"
                              title="Thiếu lượt ra — bổ sung ở cột Ghi chú"
                            >
                              ?
                            </span>
                          ) : null}
                        </td>
                      </Fragment>
                    )
                  })}
                  <td className={cn(c, g, 'num text-[var(--ink-2)]')} style={l}>
                    {x?.cap.some((p) => p.vaoTinh)
                      ? x.cap.map((p, i) => (
                          <span key={i} className="block whitespace-nowrap">
                            <Gio g={p.vaoTinh ?? ''} />→<Gio g={p.raTinh ?? ''} />
                          </span>
                        ))
                      : coGio
                        ? 'có quẹt'
                        : ''}
                  </td>
                  <td className={cn(c, 'num')} style={r}>
                    {x?.tre ? so(x.tre) : ''}
                  </td>
                  <td className={cn(c, 'num')} style={r}>
                    {x?.som ? so(x.som) : ''}
                  </td>
                  <td className={cn(c, g, 'num font-semibold')} style={r}>
                    {coGio ? cong(x!.hc) : ''}
                  </td>
                  <td className={cn(c, 'num')} style={r}>
                    {coGio ? so(x!.hc / 60, 2) : ''}
                  </td>
                  <td className={cn(c, g, 'num', tc)} style={r}>
                    {gio(x?.tc1 ?? 0, 2)}
                  </td>
                  <td className={cn(c, 'num', tc)} style={r}>
                    {gio(x?.tc2 ?? 0, 2)}
                  </td>
                  <td className={cn(c, 'num', tc)} style={r}>
                    {gio(x?.tc3 ?? 0, 2)}
                  </td>
                  <td
                    className={cn(c, g, 'num whitespace-nowrap text-[var(--ink-2)]')}
                    style={l}
                  >
                    {/* Tiêu đề cột đã là "Máy" — ô chỉ số máy, không xuống dòng (22/10/2026: "Máy / 203" làm mọi hàng cao gấp đôi). */}
                    {[
                      ...new Set(n.luot.map((y) => tenMay(y.may).replace(/^Máys*/, ''))),
                    ].join(', ')}
                  </td>
                  <td className={c} style={l}>
                    {ghi.map((y) => (
                      <span
                        key={y.text}
                        className={cn(
                          'mr-2 inline-block',
                          y.tone === 'stop' && 'font-semibold text-[var(--stop)]',
                          y.tone === 'warn' && 'text-[var(--warn)]',
                          y.tone === 'mute' && 'text-[var(--ink-3)]',
                        )}
                      >
                        {y.text}
                      </span>
                    ))}
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
                        className={cn(
                          'text-k-label hover:underline',
                          // Ngày thiếu lượt luôn hiện "Bổ sung lượt…"; ngày bình thường chỉ hiện "Điều chỉnh…"
                          // khi rê / Tab tới hàng — trước đó dòng nào cũng có chữ này, nhiễu cả cột.
                          x?.thieu
                            ? 'font-semibold text-[var(--act-text)]'
                            : 'text-[var(--act-text)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                        )}
                      >
                        {x?.thieu ? 'Bổ sung lượt…' : 'Điều chỉnh…'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          {t && (
            <tfoot>
              <tr>
                <td colSpan={2 + 2 * SO_CAP} className={cn(f, 'font-sans')} style={l}>
                  Cộng {so(data.ngay.length)} ngày
                  {t.thieu > 0 && (
                    <span className="font-normal text-[var(--ink-2)]">
                      {' '}
                      · không gồm {so(t.thieu)} ngày thiếu lượt (0 giờ tới khi bổ sung)
                    </span>
                  )}
                </td>
                <td className={f} style={r}>
                  {t.phutTre ? so(t.phutTre) : ''}
                </td>
                <td className={f} style={r}>
                  {t.phutSom ? so(t.phutSom) : ''}
                </td>
                <td className={cn(f, g)} style={r}>
                  {cong(t.hcThuong + t.hcCn + t.hcLe)}
                </td>
                <td className={f} style={r}>
                  {so((t.hcThuong + t.hcCn + t.hcLe) / 60, 2)}
                </td>
                <td className={cn(f, g, tc)} style={r}>
                  {so(t.tc1 / 60, 2)}
                </td>
                <td className={cn(f, tc)} style={r}>
                  {so(t.tc2 / 60, 2)}
                </td>
                <td className={cn(f, tc)} style={r}>
                  {so(t.tc3 / 60, 2)}
                </td>
                <td className={cn(f, g)} />
                <td className={f} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Btn
          icon="excel"
          onClick={() =>
            window.location.assign(`/api/dept/hr/cham-cong/nguoi/excel?${q}`)
          }
        >
          Xuất Excel người này
        </Btn>
        {tinh && (
          <span className="text-k-label text-[var(--ink-3)]">
            Giờ lấy từ Bảng công
            {tinh.ban != null ? ` · cách tính Bản ${tinh.ban}` : ' · cách tính mặc định'}
            {tinh.daChot ? ' · có kỳ đã chốt (số theo bản chốt)' : ''}
            {khongTheoKhung(tinh.cachTinh)
              ? ` · bộ phận tính ${TEN_CACH_TINH[tinh.cachTinh].toLowerCase()}`
              : ''}
          </span>
        )}
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
