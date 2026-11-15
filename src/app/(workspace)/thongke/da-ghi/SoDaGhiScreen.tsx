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
import { TongNgay } from './khoi-tong'
import { cx, dm, dmy, fmt, gio, thuDai } from './so-da-ghi.shared'

/**
 * SỔ THEO NGÀY (tên cũ Sổ đã ghi) — khuôn C, KHÔNG kit (bản vẽ 13/11/2026
 * https://claude.ai/artifact/4ub2By9o62SJN4wCcXGrFe, duyệt Q1–Q7; 14/11
 * CpB5jKcS… Q5: chỉ một ngày, nhiều ngày thì Sổ công đoạn — như sổ Excel thật
 * tách mỗi công đoạn một tờ).
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
  // "Xem cả tháng ›" (Q6): tờ công đoạn đang chọn chip, không thì công đoạn đầu có dòng.
  const cdThang = d.cd ?? d.cdCounts[0]?.code ?? null
  const thangHref = `/thongke/so-cong-doan?${new URLSearchParams({
    thang: p.date.slice(0, 7),
    ...(cdThang ? { cd: cdThang } : {}),
  }).toString()}`
  const excel = `/api/dept/production/so-da-ghi?${new URLSearchParams({
    date: p.date,
    to: p.team_id ?? 'all',
    ...(p.phieu ? { phieu: p.phieu.doc_no } : {}),
  }).toString()}`

  return (
    <SxKhung label="Sổ theo ngày">
      <div className="sx-body">
        <DauTrang
          crumb="Thống kê sản xuất › Ghi sổ hằng ngày"
          title="Sổ theo ngày"
          ctx={
            <>
              {team?.name ?? 'Mọi tổ'} ·{' '}
              {p.phieu ? (
                <>
                  phiếu <b>{p.phieu.doc_no}</b> · {dmy(p.date)}
                </>
              ) : (
                <b>{dmy(p.date)}</b>
              )}{' '}
              · {fmt(p.docs.length)} phiếu · <b>{fmt(p.lines.length)}</b> dòng
              {team && (lockHom ? ' · sổ ngày đã chốt' : ' · sổ ngày chưa chốt')}
            </>
          }
          actions={
            <>
              {d.nPhieuBay > 1 && (
                <ApNhom>
                  <ApNut onClick={() => d.moHet(!d.tatCaMo)}>
                    {d.tatCaMo ? 'Gập hết' : 'Mở hết'}
                  </ApNut>
                </ApNhom>
              )}
              <ApNhom>
                <a className="sx-btn" href={excel}>
                  Xuất Excel
                </a>
                <ApNut href={thangHref}>Xem cả tháng</ApNut>
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
            <span>
              {d.thongBao}
              {d.taiLai && <span className="mut"> · đang tải lại số mới…</span>}
            </span>
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
                : `${team?.name ?? 'Xưởng'} chưa ghi dòng nào ngày ${dmy(p.date)}`
            }
            lyDo="Sổ chỉ bày dòng đã Lưu nháp hoặc Ghi sổ ở màn Ghi sản lượng."
            tiep={
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <Link href="/thongke/ghi" className="sx-btn p">
                  Ghi sản lượng
                </Link>
              </span>
            }
          />
        ) : (
          <>
            {/* Khối Tổng ngày đứng ngoài vùng cuộn của lưới (bản vẽ 14/11 CUUfVcZx… Q3). */}
            <TongNgay d={d} />
            <LuoiDong d={d} />
          </>
        )}

        {d.nThayDoi > 0 && <ThanhLuu d={d} />}

        <ThanhTT
          left={
            team ? (
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

/**
 * Lưới dòng, hoặc câu rỗng khi tab / chip / ô tìm lọc hết (ngày không có dòng
 * nào thì màn đã nói ở trên, không tới đây).
 */
function LuoiDong({ d }: { d: SoDaGhiCtx }) {
  if (d.shown.length > 0) return <BangDaGhi d={d} />
  return (
    <Rong
      tieuDe="Không dòng nào khớp"
      lyDo={
        d.tim.trim()
          ? `Không dòng nào có “${d.tim.trim()}” ở tab và công đoạn đang chọn.`
          : 'Con số trên tab / chip công đoạn là 0 nên bảng trống đúng, không phải hỏng.'
      }
      tiep={
        <button
          type="button"
          className="sx-btn"
          onClick={() => {
            d.setTab('all')
            d.setTim('')
            d.chonCd(null)
          }}
        >
          Xem tất cả dòng
        </button>
      }
    />
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
  const truoc = shiftIso(p.date, -1)
  const sau = shiftIso(p.date, 1)
  return (
    <div className="sx-hc">
      <Link href={d.href({ date: truoc })} className="c">
        ‹ hôm trước
      </Link>
      <span className="c on">
        <b>{dmy(p.date)}</b>
      </span>
      {p.date < p.today ? (
        <Link href={d.href({ date: sau > p.today ? p.today : sau })} className="c">
          hôm sau ›
        </Link>
      ) : (
        <span className="c" style={{ color: 'var(--sx-empty)' }}>
          hôm sau ›
        </span>
      )}
      {p.date !== p.today && (
        <Link href={d.href({ date: p.today })} className="c">
          Hôm nay
        </Link>
      )}
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
      <ChipCongDoan d={d} />
      <TimO d={d} />
    </div>
  )
}

/**
 * Chip công đoạn (bản vẽ 14/11 Q2) — chỉ công đoạn CÓ dòng trong kỳ, theo lộ
 * trình; số = số dòng bảng bày khi bấm (đã qua tab + ô tìm). Một công đoạn thì
 * không có gì để lọc — không bày.
 */
function ChipCongDoan({ d }: { d: SoDaGhiCtx }) {
  if (d.cdCounts.length < 2) return null
  const tatCa = d.cdCounts.reduce((a, c) => a + c.n, 0)
  return (
    <>
      <span className="sep" />
      <span role="group" aria-label="Lọc theo công đoạn" style={{ display: 'contents' }}>
        {[{ code: null as string | null, label: 'Tất cả', n: tatCa }, ...d.cdCounts].map(
          (c) => {
            const on = d.cd === c.code
            return (
              <button
                key={c.code ?? 'all'}
                type="button"
                className={cx('c', on && 'on', c.n === 0 && 'z')}
                aria-pressed={on}
                onClick={() => d.chonCd(on && c.code ? null : c.code)}
              >
                {c.label} <b className="num">{fmt(c.n)}</b>
              </button>
            )
          },
        )}
      </span>
    </>
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
