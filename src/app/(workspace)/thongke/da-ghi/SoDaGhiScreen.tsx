'use client'

import Link from 'next/link'
import {
  ApNhom,
  ApNut,
  DauTrang,
  Rong,
  SxKhung,
  TabNgang,
  ThanhTT,
} from '@/app/(workspace)/production/_erp/khung'
import { shiftIso } from '@/lib/local-date'
import type { SoDaGhiPayload } from '@/modules/dept/production/so-da-ghi.service'
import { useSoDaGhi, type SoDaGhiCtx, type TabSdg } from './useSoDaGhi'
import { BangDaGhi } from './bang-da-ghi'
import { cx, dm, dmy, fmt, gio } from './so-da-ghi.shared'

/**
 * SỔ ĐÃ GHI — khuôn C, KHÔNG kit (bản vẽ 13/11/2026
 * https://claude.ai/artifact/4ub2By9o62SJN4wCcXGrFe, duyệt Q1–Q7).
 *
 * Trả lời: "tổ tôi đã ghi những gì, dòng nào có thể sai, và sửa ở đâu trước
 * khi chốt sổ?". Trước màn này thống kê ghi xong là lưới xoá trắng, không chỗ
 * nào bày lại dòng; phiếu chính thức không sửa được ô nào. Chép sheet "Năng
 * suất" của sổ Excel (sổ phẳng lọc theo ngày) + SAP CO14 (xem lại xác nhận).
 */
export function SoDaGhiScreen({ p }: { p: SoDaGhiPayload }) {
  const d = useSoDaGhi(p)
  const team = p.team_id ? p.teams.find((t) => t.id === p.team_id) : null
  const lockHom = d.lockOf(p.team_id, p.date)
  const excel = `/api/dept/production/so-da-ghi?${new URLSearchParams({
    date: p.date,
    xem: p.xem,
    to: p.team_id ?? 'all',
    ...(p.phieu ? { phieu: p.phieu.doc_no } : {}),
  }).toString()}`

  return (
    <SxKhung label="Sổ đã ghi">
      <div className="sx-body">
        <DauTrang
          crumb="Thống kê sản xuất › Ghi sổ hằng ngày"
          title="Sổ đã ghi"
          ctx={
            <>
              {team?.name ?? 'Mọi tổ'} ·{' '}
              {p.phieu ? (
                <>
                  phiếu <b>{p.phieu.doc_no}</b> · {dmy(p.date)}
                </>
              ) : p.xem === 'tuan' ? (
                <b>
                  {dm(p.from)} → {dm(p.to)}
                </b>
              ) : (
                <b>{dmy(p.date)}</b>
              )}{' '}
              · {fmt(p.docs.length)} phiếu · <b>{fmt(p.lines.length)}</b> dòng
              {team &&
                p.xem === 'ngay' &&
                (lockHom ? ' · sổ ngày đã chốt' : ' · sổ ngày chưa chốt')}
            </>
          }
          actions={
            <>
              <ApNhom>
                <a className="sx-btn" href={excel}>
                  Xuất Excel
                </a>
                <ApNut href={`/thongke/ngay?date=${p.date}`}>Sổ ngày &amp; chốt sổ</ApNut>
              </ApNhom>
              <ApNhom>
                <ApNut primary href="/thongke/ghi">
                  Ghi sản lượng
                </ApNut>
              </ApNhom>
            </>
          }
        />

        <TabNgang
          label="Lọc dòng sổ"
          tabs={(
            [
              ['all', 'Tất cả'],
              ['soat', 'Cần soát'],
              ['nhap', 'Nháp'],
              ['chinh', 'Chính thức'],
            ] as [TabSdg, string][]
          ).map(([k, label]) => ({
            key: k,
            label,
            n: d.counts[k],
            on: d.tab === k,
            onClick: () => d.setTab(k),
          }))}
        />

        <ThanhLoc d={d} />

        {d.counts.soat > 0 && d.tab !== 'soat' && <DaiSoat d={d} />}
        {d.loi && (
          <div className="sx-note stop">
            <span>{d.loi}</span>
            <button type="button" className="lnk mut" onClick={() => d.setLoi(null)}>
              Đóng
            </button>
          </div>
        )}
        {d.thongBao && !d.loi && (
          <div className="sx-note ok">
            <span>{d.thongBao}</span>
            <button type="button" className="lnk mut" onClick={() => d.setThongBao(null)}>
              Đóng
            </button>
          </div>
        )}

        {p.lines.length === 0 ? (
          <Rong
            tieuDe={
              p.phieu
                ? `Phiếu ${p.phieu.doc_no} không còn dòng nào`
                : `${team?.name ?? 'Xưởng'} chưa ghi dòng nào ${p.xem === 'tuan' ? `từ ${dm(p.from)} tới ${dm(p.to)}` : `ngày ${dmy(p.date)}`}`
            }
            lyDo="Sổ chỉ bày dòng đã Lưu nháp hoặc Ghi sổ ở màn Ghi sản lượng."
            tiep={
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <Link href="/thongke/ghi" className="sx-btn p">
                  Ghi sản lượng
                </Link>
                {p.xem === 'ngay' && !p.phieu && (
                  <Link href={d.href({ xem: 'tuan' })} className="sx-btn">
                    Xem 7 ngày
                  </Link>
                )}
              </span>
            }
          />
        ) : d.shown.length === 0 ? (
          <Rong
            tieuDe="Không dòng nào khớp"
            lyDo={
              d.tim.trim()
                ? `Không dòng nào có “${d.tim.trim()}” ở tab đang chọn.`
                : 'Con số trên tab là 0 nên bảng trống đúng, không phải hỏng.'
            }
            tiep={
              <button
                type="button"
                className="sx-btn"
                onClick={() => {
                  d.setTab('all')
                  d.setTim('')
                }}
              >
                Xem tất cả dòng
              </button>
            }
          />
        ) : (
          <BangDaGhi d={d} />
        )}

        {d.nThayDoi > 0 && <ThanhLuu d={d} />}

        <ThanhTT
          left={
            team && p.xem === 'ngay' ? (
              <>
                Sổ ngày {team.name} {dm(p.date)}:{' '}
                <b>{lockHom ? `đã chốt ${gio(lockHom.at)}` : 'chưa chốt'}</b> ·{' '}
                <Link href={`/thongke/ngay?date=${p.date}`} className="lnk">
                  {lockHom ? 'Mở khoá ở Sổ ngày ›' : 'Chốt ở Sổ ngày ›'}
                </Link>
              </>
            ) : (
              'Ô vàng sửa được tới khi chốt sổ ngày của tổ'
            )
          }
          right="Phải làm · Đã làm lấy đúng ô Hồ sơ lệnh"
        />
      </div>
    </SxKhung>
  )
}

function ThanhLoc({ d }: { d: SoDaGhiCtx }) {
  const { p } = d
  if (p.phieu)
    return (
      <div className="sx-hc">
        <span className="c on">
          Phiếu <b>{p.phieu.doc_no}</b>
        </span>
        <Link href={d.href({ phieu: null })} className="lnk">
          Bỏ lọc phiếu — xem cả ngày {dm(p.date)}
        </Link>
        <TimO d={d} />
      </div>
    )
  const buoc = p.xem === 'tuan' ? 7 : 1
  const truoc = shiftIso(p.date, -buoc)
  const sau = shiftIso(p.date, buoc)
  return (
    <div className="sx-hc">
      <Link href={d.href({ date: truoc })} className="c">
        ‹ {p.xem === 'tuan' ? 'tuần trước' : 'hôm trước'}
      </Link>
      <span className="c on">
        <b>{p.xem === 'tuan' ? `${dm(p.from)} → ${dm(p.to)}` : dmy(p.date)}</b>
      </span>
      {p.date < p.today ? (
        <Link href={d.href({ date: sau > p.today ? p.today : sau })} className="c">
          {p.xem === 'tuan' ? 'tuần sau' : 'hôm sau'} ›
        </Link>
      ) : (
        <span className="c" style={{ color: 'var(--sx-empty)' }}>
          {p.xem === 'tuan' ? 'tuần sau' : 'hôm sau'} ›
        </span>
      )}
      {p.date !== p.today && (
        <Link href={d.href({ date: p.today })} className="c">
          Hôm nay
        </Link>
      )}
      <span className="sep" />
      <Link href={d.href({ xem: 'ngay' })} className={cx('c', p.xem === 'ngay' && 'on')}>
        Ngày
      </Link>
      <Link href={d.href({ xem: 'tuan' })} className={cx('c', p.xem === 'tuan' && 'on')}>
        7 ngày
      </Link>
      <span className="sep" />
      <label className="c">
        Tổ
        <select
          value={p.team_id ?? 'all'}
          onChange={(e) =>
            d.go(d.href({ to: e.target.value === 'all' ? null : e.target.value }))
          }
          aria-label="Chọn tổ"
        >
          <option value="all">Mọi tổ</option>
          {p.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.stage_label}
            </option>
          ))}
        </select>
      </label>
      <TimO d={d} />
    </div>
  )
}

function TimO({ d }: { d: SoDaGhiCtx }) {
  return (
    <>
      <input
        className="sx-in"
        value={d.tim}
        onChange={(e) => d.setTim(e.target.value)}
        placeholder="Tìm mã hàng, chi tiết, phiếu"
        aria-label="Tìm mã hàng, chi tiết, phiếu"
        style={{ width: 220 }}
      />
    </>
  )
}

/** Dải "Cần soát" — tối đa 4 dòng, bấm là nhảy tới dòng; còn lại ở tab. */
function DaiSoat({ d }: { d: SoDaGhiCtx }) {
  const ds = d.p.lines.filter((l) => d.flagOf(l.id).length > 0)
  return (
    <div className="sx-note stop sx-soat">
      <b>Cần soát {fmt(ds.length)} dòng:</b>
      {ds.slice(0, 4).map((l) => (
        <button key={l.id} type="button" className="lnk" onClick={() => d.denDong(l)}>
          <span className="ma">{l.product_code ?? ''}</span> {l.name}:{' '}
          {d.flagOf(l.id)[0].text}
        </button>
      ))}
      {ds.length > 4 && (
        <button type="button" className="lnk mut" onClick={() => d.setTab('soat')}>
          và {fmt(ds.length - 4)} dòng nữa ›
        </button>
      )}
    </div>
  )
}

/** Thanh chốt đáy — chỉ hiện khi có ô đã sửa / dòng chờ xoá (ngoại lệ khuôn F). */
function ThanhLuu({ d }: { d: SoDaGhiCtx }) {
  return (
    <div className="sx-cb" role="region" aria-label="Thay đổi chưa lưu">
      <span className="sum">
        {d.edits.length > 0 && (
          <>
            <b>{fmt(d.edits.length)}</b> dòng đã sửa
          </>
        )}
        {d.edits.length > 0 && d.xoa.size > 0 && ' · '}
        {d.xoa.size > 0 && (
          <>
            <b>{fmt(d.xoa.size)}</b> dòng sẽ xoá
          </>
        )}{' '}
        — chưa lưu
      </span>
      {d.chanO && (
        <span className="blk">
          {d.chanO.msg}
          <button
            type="button"
            className="lnk"
            onClick={() => d.toiO(d.chanO!.id, d.chanO!.field)}
          >
            Tới ô
          </button>
        </span>
      )}
      <span className="sp">
        <button type="button" className="sx-btn" onClick={d.boSua} disabled={d.busy}>
          Bỏ sửa
        </button>
        <button
          type="button"
          className="sx-btn p"
          onClick={() => void d.luu()}
          disabled={d.busy}
          aria-busy={d.busy || undefined}
        >
          {d.busy ? 'Đang lưu…' : 'Lưu thay đổi'}
        </button>
      </span>
    </div>
  )
}
