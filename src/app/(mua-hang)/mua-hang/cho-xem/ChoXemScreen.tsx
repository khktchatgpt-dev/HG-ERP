'use client'

import '@/app/(workspace)/exec/approvals/hop-ky.css'
import './cho-xem.css'
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ExternalLink, Lock, Undo2 } from 'lucide-react'
import { ngayGioVn } from '@/lib/date-vn'
import {
  congTheoTien,
  daGui,
  GIU_DUYET_THAY_NGAY,
  tichDuoc,
  tienVn,
  type HopXem,
  type XemDon,
} from '@/lib/cho-xem'
import { useChoXem, type ChoXemCtx, type GomXem, type TabXem } from './useChoXem'
import { XemNhanh } from './xem-nhanh'

/**
 * CHỜ TÔI XEM (/mua-hang/cho-xem) — trưởng phòng Cung ứng xem đơn chờ duyệt
 * trước khi lên bàn Giám đốc (05/11/2026, bản vẽ
 * https://claude.ai/artifact/RcqWLU7F1z33btAR97gZBo khung 1 + 2, Q1–Q6 duyệt).
 *
 * KHÔNG KIT: cùng lưới với hộp ký Giám đốc (hop-ky.css) + phần thêm ở
 * cho-xem.css. Ba tab: chưa xem · đã xem chờ GĐ · GĐ duyệt khi tôi chưa xem
 * (7 ngày, chỉ xem). Bấm dòng = mở xem nhanh dưới dòng (dòng hàng + giá đơn
 * trước cùng NCC + ghi chú cho GĐ). Đơn giá trị lớn không có ô tích (Q2).
 */
export function ChoXemScreen({ box }: { box: HopXem }) {
  const d = useChoXem(box)
  /* CHỐT CHIỀU CAO = 100dvh − đỉnh màn (như hộp ký): chỉ lưới cuộn, đầu/chân dính. */
  const goc = useRef<HTMLDivElement>(null)
  const [cao, setCao] = useState('calc(100dvh - 60px)')
  useLayoutEffect(() => {
    const el = goc.current
    if (!el) return
    const doi = () =>
      setCao(`calc(100dvh - ${Math.round(el.getBoundingClientRect().top)}px)`)
    doi()
    window.addEventListener('resize', doi)
    return () => window.removeEventListener('resize', doi)
  }, [])
  return (
    <div className="hk cx" ref={goc} style={{ height: cao }}>
      <div className="hk-ph">
        <span className="hk-crumb">Mua hàng ›</span>
        <h1>Chờ tôi xem</h1>
        <div className="hk-ap" role="toolbar" aria-label="Xem đơn">
          <div>
            <button
              type="button"
              className="hk-btn p"
              disabled={d.busy || d.tab !== 'cho'}
              onClick={d.daXem}
            >
              <Check size={15} aria-hidden />
              {d.daTich.length > 0
                ? `Đã xem — trình GĐ (${d.daTich.length})`
                : 'Đã xem — trình GĐ'}
            </button>
            <button
              type="button"
              className="hk-btn"
              disabled={d.busy || d.tab === 'thay'}
              onClick={d.moTraLai}
            >
              <Undo2 size={15} aria-hidden />
              Trả lại để sửa
            </button>
          </div>
          <div>
            {d.dangMo ? (
              <Link href={d.dangMo.href} className="hk-btn">
                <ExternalLink size={15} aria-hidden />
                Mở đơn
              </Link>
            ) : (
              <button
                type="button"
                className="hk-btn"
                disabled
                title="Bấm vào một đơn trước"
              >
                <ExternalLink size={15} aria-hidden />
                Mở đơn
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="hk-ptabs" role="tablist" aria-label="Đơn cần trưởng phòng xem">
        <Tab d={d} t="cho" ten="Chờ tôi xem" n={d.cho.length} hot />
        <Tab d={d} t="da" ten="Đã xem, chờ GĐ" n={d.da.length} />
        <Tab d={d} t="thay" ten="GĐ duyệt khi tôi chưa xem" n={box.duyet_thay.length} />
      </div>

      <DaiTaiCho d={d} />

      {d.tab !== 'thay' && (
        <div className="hk-fb">
          <span className={d.daTich.length ? 'hk-sel' : undefined}>
            {d.daTich.length
              ? `Đã tích ${d.daTich.length} đơn · ${congTheoTien(d.daTich)
                  .map((t) => tienVn(t.value, t.currency))
                  .join(' · ')}`
              : d.dangMo
                ? `Đang mở: ${d.dangMo.code} · ${d.dangMo.ncc}`
                : 'Chưa tích đơn nào'}
          </span>
          <input
            type="search"
            value={d.q}
            onChange={(e) => d.setQ(e.target.value)}
            placeholder="Tìm mã đơn, NCC, vật tư, người lập…"
            aria-label="Tìm đơn"
          />
          <span className="hk-seg" role="group" aria-label="Gom theo">
            {(
              [
                ['nguoi', 'Theo người lập'],
                ['lenh', 'Theo lệnh'],
                ['khong', 'Không gom'],
              ] as [GomXem, string][]
            ).map(([k, ten]) => (
              <button
                key={k}
                type="button"
                aria-pressed={d.gom === k}
                onClick={() => d.setGom(k)}
              >
                {ten}
              </button>
            ))}
          </span>
        </div>
      )}

      {d.tab === 'thay' ? <LuoiDuyetThay d={d} /> : <LuoiDon d={d} />}

      <div className="hk-sb">
        <span>
          {d.tab === 'cho'
            ? 'Đơn chờ duyệt mà trưởng phòng chưa xem'
            : d.tab === 'da'
              ? 'Đơn anh đã xem, đang chờ Giám đốc'
              : `Giám đốc duyệt khi anh chưa xem · ${GIU_DUYET_THAY_NGAY} ngày qua · chỉ xem`}
        </span>
        {d.tab !== 'thay' && (
          <span>khoá = giá trị lớn — mở ra đọc rồi xác nhận riêng</span>
        )}
        <span style={{ marginLeft: 'auto' }}>cập nhật {ngayGioVn(box.at).slice(11)}</span>
      </div>
    </div>
  )
}

function Tab({
  d,
  t,
  ten,
  n,
  hot = false,
}: {
  d: ChoXemCtx
  t: TabXem
  ten: string
  n: number
  hot?: boolean
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={d.tab === t}
      className="hk-pt lp-all"
      onClick={() => d.doiTab(t)}
    >
      <span className="ten">{ten}</span>
      <span className={n === 0 || !hot ? 'hk-badge zero' : 'hk-badge'}>{n}</span>
    </button>
  )
}

/**
 * Dải TẠI CHỖ dưới thanh hành động (bản vẽ khung 2·B, 2·C): câu chặn, dải lý
 * do trả lại, kết quả lượt bấm. Không toast.
 */
function DaiTaiCho({ d }: { d: ChoXemCtx }) {
  const kq = d.ketQua
  const tra = d.traLai ? d.box.items.find((x) => x.id === d.traLai!.id) : null
  return (
    <>
      {tra && d.traLai && (
        <div className="cx-tra">
          <label htmlFor="ly-do-tra" className="hk-b">
            Lý do trả lại {tra.code}
          </label>
          <input
            id="ly-do-tra"
            className="cx-inp"
            type="text"
            maxLength={1000}
            autoComplete="off"
            value={d.traLai.lyDo}
            onChange={(e) => d.setTraLai({ id: tra.id, lyDo: e.target.value })}
            placeholder="Người lập sửa theo câu này"
          />
          <button
            type="button"
            className={d.lyDoDu ? 'hk-btn p' : 'hk-btn cx-khoa'}
            aria-disabled={!d.lyDoDu || d.busy}
            onClick={() => d.lyDoDu && !d.busy && d.guiTraLai()}
          >
            Gửi trả lại
          </button>
          <button
            type="button"
            className="hk-btn cx-vien"
            onClick={() => d.setTraLai(null)}
          >
            Huỷ
          </button>
          {!d.lyDoDu && <span className="hk-warn">Ghi lý do ít nhất 5 ký tự</span>}
        </div>
      )}
      {(d.chan || (kq && (kq.ok.length > 0 || kq.loi.length > 0 || kq.traLai))) && (
        <div className="cx-dai" role="status">
          {d.chan && (
            <div className="cx-band wn">
              <span className="k">Chưa chọn đơn</span>
              <span>{d.chan}</span>
            </div>
          )}
          {kq && kq.ok.length > 0 && (
            <div className="cx-band ok">
              <span className="k">✓ {kq.ok.length} đơn đã trình GĐ</span>
              <span>
                {kq.ok
                  .map((x) => `${x.code} · ${x.ncc} · ${tienVn(x.value, x.currency)}`)
                  .join(' — ')}
              </span>
              <button
                type="button"
                className="hk-btn x"
                onClick={() => d.setKetQua(null)}
              >
                Đóng
              </button>
            </div>
          )}
          {kq?.traLai && (
            <div className="cx-band ok">
              <span className="k">✓ Đã trả lại {kq.traLai}</span>
              <span>
                Đơn ở nháp, người lập nhận lý do trong Trao đổi của đơn — rời hộp này tới
                khi được sửa lại.
              </span>
              <button
                type="button"
                className="hk-btn x"
                onClick={() => d.setKetQua(null)}
              >
                Đóng
              </button>
            </div>
          )}
          {kq?.loi.map((l) => (
            <div key={l.code} className="cx-band st">
              <span className="k">Không ghi được</span>
              <span>{l.msg.startsWith(l.code) ? l.msg : `${l.code}: ${l.msg}`}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

const COT = [
  { w: 34, nhan: '' },
  { w: 136, nhan: 'Mã đơn' },
  { w: 140, nhan: 'Nhà cung cấp' },
  { nhan: 'Mua gì' },
  { w: 130, nhan: 'Lệnh' },
  { w: 78, nhan: 'Hẹn giao', r: true },
  { w: 140, nhan: 'Giá trị (gồm VAT)', r: true },
  { w: 74, nhan: 'Chờ', r: true },
] as const

function LuoiDon({ d }: { d: ChoXemCtx }) {
  if (d.rows.length === 0) return <Rong d={d} />
  const now = new Date(d.box.at)
  const cot = COT.map((c, i) =>
    i === 7 && d.tab === 'da' ? { ...c, nhan: 'Đã xem' } : c,
  )
  return (
    <div className="hk-grid">
      <table className="hk-tb" aria-label="Đơn chờ trưởng phòng xem">
        <colgroup>
          {cot.map((c, i) => (
            <col key={i} style={'w' in c ? { width: c.w } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {cot.map((c, i) => (
              <th
                key={i}
                className={'r' in c ? 'r' : undefined}
                aria-label={i === 0 ? 'Tích' : undefined}
              >
                {c.nhan}
              </th>
            ))}
          </tr>
        </thead>
        {d.khoi.map((g) => {
          const tichDuocKhoi = g.rows.filter(tichDuoc)
          const caKhoi =
            tichDuocKhoi.length > 0 && tichDuocKhoi.every((x) => d.tich.has(x.id))
          return (
            <tbody key={g.key}>
              {g.ten && (
                <tr className="grp lp-all">
                  <th scope="rowgroup" colSpan={cot.length}>
                    <span className="ten">{g.ten}</span> ·{' '}
                    <b className="hk-num">{g.rows.length}</b> đơn ·{' '}
                    {congTheoTien(g.rows)
                      .map((t) => tienVn(t.value, t.currency))
                      .join(' · ')}
                    {d.tab === 'cho' && tichDuocKhoi.length > 1 && (
                      <span className="rr">
                        <label>
                          <input
                            type="checkbox"
                            checked={caKhoi}
                            onChange={(e) => d.tichKhoi(g.rows, e.target.checked)}
                            aria-label={`Tích ${tichDuocKhoi.length} đơn dưới ngưỡng trong khối ${g.ten}`}
                          />
                          Tích {tichDuocKhoi.length} đơn dưới ngưỡng
                        </label>
                      </span>
                    )}
                  </th>
                </tr>
              )}
              {g.rows.map((x, i) => (
                <Fragment key={x.id}>
                  <DongDon d={d} x={x} z={i % 2 === 1} now={now} />
                  {d.mo === x.id && <XemNhanh x={x} d={d} cot={cot.length} />}
                </Fragment>
              ))}
            </tbody>
          )
        })}
        <tfoot>
          <tr>
            <td colSpan={6}>
              Cộng {d.rows.length} đơn · cộng riêng từng loại tiền, không quy đổi
            </td>
            <td className="r hk-num">
              {congTheoTien(d.rows).map((t) => (
                <div key={t.currency}>{tienVn(t.value, t.currency)}</div>
              ))}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function DongDon({ d, x, z, now }: { d: ChoXemCtx; x: XemDon; z: boolean; now: Date }) {
  const mua = [x.loai, x.materials.slice(0, 2).join(', ')].filter(Boolean).join(' · ')
  const them = x.materials.length - 2
  const lenh = x.lsx ?? x.ngoai_lenh ?? 'Ngoài lệnh'
  const conLai = x.expected_at
    ? Math.round(
        (Date.parse(x.expected_at) - Date.parse(d.box.at.slice(0, 10))) / 86_400_000,
      )
    : null
  // Nháp thiếu điều kiện trình (hẹn giao, dòng hàng…) → khoá, nói thiếu gì; không
  // thì giá trị lớn → mở ra đọc rồi xác nhận riêng (Q2).
  const khoaVi = x.chan
    ? `Chưa trình được: ${x.chan}`
    : 'Giá trị lớn — mở ra đọc rồi xác nhận riêng'
  return (
    <tr
      className={['d', d.mo === x.id ? 'on' : '', z ? 'z' : ''].filter(Boolean).join(' ')}
      onClick={() => d.moDong(x.id)}
      aria-selected={d.mo === x.id}
      aria-expanded={d.mo === x.id}
    >
      <td onClick={(e) => e.stopPropagation()}>
        {d.tab !== 'cho' ? null : tichDuoc(x) ? (
          <input
            type="checkbox"
            checked={d.tich.has(x.id)}
            onChange={() => d.batTich(x)}
            aria-label={`Tích ${x.code}`}
          />
        ) : (
          <span className="hk-mut" title={khoaVi} style={{ display: 'inline-flex' }}>
            <Lock size={13} aria-label={khoaVi} />
          </span>
        )}
      </td>
      <td>
        <Link href={x.href} className="hk-ma" onClick={(e) => e.stopPropagation()}>
          {x.code}
        </Link>
        {/* Đường thường là NHÁP; đơn NV đã gửi thẳng GĐ thì GĐ có thể ký trước
            khi anh kịp xem — nói ra để anh ưu tiên. */}
        {d.tab === 'cho' && !x.nhap && (
          <span
            className="hk-tag hk-warn"
            title="NV đã gửi thẳng Giám đốc — đơn đang trên bàn GĐ, anh xem bổ sung"
          >
            đã ở GĐ
          </span>
        )}
        {/* Nháp thiếu điều kiện: nói thiếu gì ngay trên dòng, không chỉ trong tooltip. */}
        {d.tab === 'cho' && x.chan && (
          <span className="hk-tag hk-warn" title={x.chan}>
            {x.chan.split(' — ')[0].split('. ')[0]}
          </span>
        )}
        {d.tab === 'cho' && x.tra_lai && (
          <span
            className="hk-tag hk-mut"
            title={`Trả lại ${x.tra_lai.by_name ? `bởi ${x.tra_lai.by_name} ` : ''}— ${x.tra_lai.reason ?? 'không ghi lý do'}`}
          >
            đã sửa sau khi trả lại
          </span>
        )}
      </td>
      <td className="hk-b" title={x.ncc_day_du}>
        {x.ncc}
      </td>
      <td title={[x.loai, ...x.materials].filter(Boolean).join(' · ')}>
        {mua || '—'}
        {them > 0 && <span className="hk-mut"> +{them} mã</span>}
      </td>
      <td className="hk-mut" title={lenh}>
        {lenh}
      </td>
      <td
        className={conLai != null && conLai <= 2 ? 'r hk-num hk-warn' : 'r hk-num'}
        title={conLai == null ? 'Chưa hẹn giao' : conLai < 0 ? `Hẹn giao đã qua ${-conLai} ngày` : `Còn ${conLai} ngày`} // prettier-ignore
      >
        {x.expected_at
          ? `${x.expected_at.slice(8, 10)}/${x.expected_at.slice(5, 7)}`
          : 'chưa hẹn'}
      </td>
      <td className="r hk-num hk-b">{tienVn(x.value, x.currency)}</td>
      <td className="r">
        {d.tab === 'da' && x.mark
          ? ngayGioVn(x.mark.at).slice(11)
          : daGui(x.submitted_at, now)}
      </td>
    </tr>
  )
}

/** Rỗng: một dòng — vì sao rỗng + việc làm tiếp. */
function Rong({ d }: { d: ChoXemCtx }) {
  const timKiem = d.q.trim() !== ''
  return (
    <div
      className="hk-empty"
      style={{ flex: 1, padding: '14px 16px', textAlign: 'left' }}
    >
      {timKiem ? (
        <>Ô tìm không khớp đơn nào trong tab này.</>
      ) : d.tab === 'cho' ? (
        <>
          Không đơn nào chờ anh xem
          {d.da.length > 0 ? (
            <>
              {' '}
              — {d.da.length} đơn anh đã xem đang chờ GĐ duyệt.{' '}
              <button
                type="button"
                className="hk-btn cx-vien"
                onClick={() => d.doiTab('da')}
              >
                Mở tab Đã xem, chờ GĐ
              </button>
            </>
          ) : (
            '. Đơn mới gửi duyệt sẽ hiện ở đây.'
          )}
        </>
      ) : (
        <>Chưa có đơn nào anh đã xem đang chờ Giám đốc.</>
      )}
    </div>
  )
}

function LuoiDuyetThay({ d }: { d: ChoXemCtx }) {
  const rows = d.box.duyet_thay
  if (rows.length === 0)
    return (
      <div
        className="hk-empty"
        style={{ flex: 1, padding: '14px 16px', textAlign: 'left' }}
      >
        {GIU_DUYET_THAY_NGAY} ngày qua Giám đốc không duyệt đơn nào khi anh chưa xem.
      </div>
    )
  return (
    <div className="hk-grid">
      <table className="hk-tb" aria-label="Đơn Giám đốc duyệt khi trưởng phòng chưa xem">
        <colgroup>
          <col style={{ width: 136 }} />
          <col style={{ width: 160 }} />
          <col />
          <col style={{ width: 146 }} />
          <col style={{ width: 170 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 140 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Mã đơn</th>
            <th>Nhà cung cấp</th>
            <th>Mua gì</th>
            <th>Lệnh</th>
            <th>GĐ duyệt</th>
            <th className="r">Sau khi gửi</th>
            <th className="r">Giá trị (gồm VAT)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x, i) => (
            <tr key={x.id} className={i % 2 ? 'd z' : 'd'}>
              <td>
                <Link href={x.href} className="hk-ma">
                  {x.code}
                </Link>
              </td>
              <td className="hk-b">{x.ncc}</td>
              <td title={[x.loai, ...x.materials].filter(Boolean).join(' · ')}>
                {[x.loai, x.materials.slice(0, 2).join(', ')]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </td>
              <td className="hk-mut">{x.lsx ?? 'Ngoài lệnh'}</td>
              <td>
                {x.by_name ?? '—'} ·{' '}
                <span className="hk-num">{ngayGioVn(x.at).slice(0, 16)}</span>
              </td>
              <td className="r hk-warn">
                {x.sau_phut == null
                  ? '—'
                  : x.sau_phut < 60
                    ? `${x.sau_phut} phút`
                    : `${Math.round(x.sau_phut / 60)} giờ`}
              </td>
              <td className="r hk-num hk-b">{tienVn(x.value, x.currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7}>
              {rows.length} đơn trong {GIU_DUYET_THAY_NGAY} ngày · bấm mã để mở đơn, ghi
              trao đổi nếu thấy vướng
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/** Người không phải trưởng phòng mở thẳng /mua-hang/cho-xem. */
export function ChoXemKhongQuyen() {
  return (
    <div className="hk cx" style={{ height: 'auto' }}>
      <div className="hk-ph">
        <span className="hk-crumb">Mua hàng ›</span>
        <h1>Chờ tôi xem</h1>
      </div>
      <div className="hk-empty" style={{ padding: '14px 16px', textAlign: 'left' }}>
        Hộp này dành cho trưởng phòng Cung ứng — xem đơn trước khi lên bàn Giám đốc. Đơn
        bạn gửi duyệt nằm ở{' '}
        <Link
          href="/mua-hang/don"
          style={{ color: 'var(--hk-act)', textDecoration: 'underline' }}
        >
          sổ Đơn mua
        </Link>
        .
      </div>
    </div>
  )
}
