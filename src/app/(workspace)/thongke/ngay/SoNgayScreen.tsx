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
import { STATUS_LABEL } from '@/lib/entry-doc-flow'
import { useSoNgay, type SoNgayCtx, type SoNgayInput } from './useSoNgay'
import {
  cauChot,
  cauSo,
  CHIPS,
  cx,
  dauO,
  dm,
  dmy,
  fmt,
  gio,
  isDraft,
  nutHang,
  thu,
  type ToRow,
} from './so-ngay.shared'

/**
 * SỔ NGÀY & CHỐT SỔ — khuôn C, dựng lại KHÔNG kit theo bản vẽ 1 (11/11/2026,
 * https://claude.ai/artifact/QSwyPC46SM81EEQfJiAycT, duyệt Q1–Q7).
 *
 * Trả lời: "hôm nay tổ nào đã ghi gì, đủ chưa, tổ nào chưa chốt — và tuần này
 * còn ngày nào quên chốt?". Thay NgayScreen kit (mỗi tổ một thẻ, chỉ tổ có
 * phiếu mới hiện; ma trận có hàng Toàn xưởng cộng dọc). Một hàng một tổ KỲ
 * VỌNG (Q1), phiếu là hàng con gập mở (Q2), chốt sổ xác nhận dưới hàng — cho
 * chốt khi còn nháp kèm cảnh báo (Q3), cho chốt trống (Q4); mở khoá bắt lý do
 * (Q5, nhật ký 0295); tab 7 ngày không hàng Toàn xưởng (Q6); tổ của người xem
 * lên đầu (Q7). Màn kit cuối của hai khu Sản xuất / Thống kê.
 */
export function SoNgayScreen(p: SoNgayInput) {
  const d = useSoNgay(p)
  const { date, today, rows } = d
  const coSo = rows.filter((r) => r.docs.length > 0).length
  const daChot = rows.filter((r) => r.lock).length
  const soPhieu = p.docs.length

  return (
    <SxKhung label="Sổ ngày và chốt sổ">
      <div className="sx-body">
        <DauTrang
          crumb="Thống kê sản xuất › Ghi sổ hằng ngày"
          title="Sổ ngày & chốt sổ"
          ctx={
            <>
              <b>
                {thu(date)} {dmy(date)}
              </b>{' '}
              · {fmt(rows.length)} tổ · <b>{fmt(coSo)}</b> có sổ · <b>{fmt(daChot)}</b> đã
              chốt · {fmt(soPhieu)} phiếu
            </>
          }
          actions={
            <>
              <ApNhom>
                <ApNut href="/thongke/giao-nhan">Giao nhận</ApNut>
                <ApNut href="/thongke/bao-cao">Báo cáo</ApNut>
              </ApNhom>
              {p.canLock && (
                <ApNhom>
                  <ApNut primary href="/thongke/ghi">
                    Ghi sản lượng
                  </ApNut>
                </ApNhom>
              )}
            </>
          }
        />

        <TabNgang
          label="Khung nhìn"
          tabs={[
            {
              key: 'ngay',
              label: 'Ngày',
              n: rows.length,
              on: d.tab === 'ngay',
              onClick: () => d.setTab('ngay'),
            },
            {
              key: 'tuan',
              label: '7 ngày',
              on: d.tab === 'tuan',
              onClick: () => d.setTab('tuan'),
            },
          ]}
        />

        {d.tab === 'ngay' ? <TabNgay d={d} /> : <TabTuan d={d} />}

        <ThanhTT
          left="Vào việc đếm “tổ có việc hôm nay chưa chốt sổ” và Báo cáo đếm “chốt sổ n/N ngày” bằng đúng danh sách này"
          right={
            p.teams.length < rows.length
              ? undefined
              : 'tổ không gắn công đoạn không bày — gắn ở Cấu hình công đoạn'
          }
        />
      </div>
    </SxKhung>
  )
}

function TabNgay({ d }: { d: SoNgayCtx }) {
  const { date, today } = d
  const chipLabel = CHIPS.find((c) => c.id === d.chip)?.label ?? ''
  const tongPhieu = d.shown.reduce((a, r) => a + r.docs.length, 0)
  const tongNhap = d.shown.reduce((a, r) => a + r.drafts, 0)
  return (
    <>
      <div className="sx-hc" role="tablist" aria-label="Ngày và trạng thái sổ">
        <button type="button" className="c" onClick={d.homTruoc}>
          ‹ hôm trước
        </button>
        <span className="c on">
          <b>
            {thu(date)} · {dmy(date)}
          </b>
        </span>
        {date < today ? (
          <button type="button" className="c" onClick={d.homSau}>
            hôm sau ›
          </button>
        ) : (
          <span className="c" style={{ color: 'var(--sx-empty)' }}>
            hôm sau ›
          </span>
        )}
        {date !== today && (
          <button type="button" className="c" onClick={() => d.go(today)}>
            Hôm nay
          </button>
        )}
        {CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={d.chip === c.id}
            className={cx('c', d.chip === c.id && 'on', d.counts[c.id] === 0 && 'z')}
            onClick={() => d.setChip(c.id)}
          >
            {c.label} <b>{fmt(d.counts[c.id] ?? 0)}</b>
          </button>
        ))}
        <span className="sp">chốt sổ = khoá ghi / sửa / xoá phiếu của tổ trong ngày</span>
      </div>

      {d.unlockedPast.length > 0 && (
        <div className="sx-note">
          <b>Quên chốt:</b>
          <span>
            {d.unlockedPast.map((u, i) => (
              <span key={`${u.entry_date}|${u.team_id}`}>
                {i > 0 && ' · '}
                <Link href={`/thongke/ngay?date=${u.entry_date}`} className="lnk">
                  {u.team_name} — {dm(u.entry_date)}
                </Link>
              </span>
            ))}
          </span>
          <span className="mut">(7 ngày gần nhất, tổ có sổ mà chưa chốt)</span>
        </div>
      )}

      {d.msg && (
        <div className={cx('sx-note', d.msg.ok ? 'ok' : 'stop')}>
          <span>{d.msg.text}</span>
        </div>
      )}

      {d.rows.length === 0 ? (
        <Rong
          tieuDe="Chưa tổ nào gắn công đoạn"
          lyDo="Sổ ngày bày theo tổ được kỳ vọng ghi sổ. Gắn công đoạn cho từng tổ xong là hàng tự hiện."
          tiep={
            <Link href="/production/cau-hinh/cong-doan" className="sx-btn">
              Cấu hình công đoạn
            </Link>
          }
        />
      ) : d.shown.length === 0 ? (
        <Rong
          tieuDe={`Không tổ nào ở “${chipLabel}”`}
          lyDo="Con số trên chip là 0 nên bảng trống đúng, không phải hỏng."
          tiep={
            <button type="button" className="sx-btn" onClick={() => d.setChip('all')}>
              Xem tất cả tổ
            </button>
          }
        />
      ) : (
        <div className="sx-grid">
          <table className="sx-tb sx-sn" style={{ minWidth: 1100 }}>
            <colgroup>
              <col style={{ width: 170 }} />
              <col style={{ width: 184 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 64 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 124 }} />
              <col />
              <col style={{ width: 150 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="pin">Tổ</th>
                <th>Công đoạn · đơn vị</th>
                <th className="r">Phiếu</th>
                <th className="r">Σ đạt</th>
                <th className="r">Phế</th>
                <th className="r">Sửa lại</th>
                <th>Người ghi</th>
                <th>Sổ ngày</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {d.shown.map((r) => (
                <HangTo key={r.id} d={d} r={r} />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pin">{fmt(d.shown.length)} tổ</td>
                <td colSpan={8} className="mut" style={{ fontWeight: 400 }}>
                  {fmt(tongPhieu)} phiếu · {fmt(tongPhieu - tongNhap)} chính thức ·{' '}
                  {fmt(tongNhap)} nháp · không cộng Σ đạt toàn xưởng — chi tiết, cụm, bộ
                  là ba đơn vị
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}

function HangTo({ d, r }: { d: SoNgayCtx; r: ToRow }) {
  const so = cauSo(r)
  const nut = nutHang(r, { canLock: d.canLock, canUnlock: d.canUnlock })
  const mo = d.open.has(r.id) && r.docs.length > 0
  const xn = d.xacNhan?.teamId === r.id ? d.xacNhan : null
  return (
    <>
      <tr className={cx('d', r.docs.length > 0 || r.lock ? 'grp' : 'nil')}>
        <td className="pin">
          {r.docs.length > 0 ? (
            <button
              type="button"
              className="tg"
              onClick={() => d.toggle(r.id)}
              aria-expanded={mo}
              aria-label={`${mo ? 'Gập' : 'Mở'} phiếu của ${r.name}`}
            >
              {mo ? '▾' : '▸'}
            </button>
          ) : (
            <span className="tg" aria-hidden>
              ·
            </span>
          )}
          {r.name}
        </td>
        <td>
          {r.stage_label}
          {r.unit && <span className="mut"> · {r.unit}</span>}
        </td>
        <td className={cx('r num', r.docs.length === 0 && 'empty')}>
          {r.docs.length === 0 ? '—' : fmt(r.docs.length)}
          {r.drafts > 0 && <span className="mut"> · {fmt(r.drafts)} nháp</span>}
        </td>
        <td className={cx('r num', r.officials === 0 && 'empty')}>
          {r.officials === 0 ? '—' : fmt(r.qty)}
        </td>
        <td className={cx('r num', r.defect > 0 ? 'warn' : 'empty')}>
          {r.defect > 0 ? fmt(r.defect) : '—'}
        </td>
        <td className={cx('r num', r.rework > 0 ? 'warn' : 'empty')}>
          {r.rework > 0 ? fmt(r.rework) : '—'}
        </td>
        <td
          className={cx(r.writers.length === 0 && 'empty')}
          title={r.writers.join(', ')}
        >
          {r.writers.length === 0 ? '—' : r.writers.join(', ')}
        </td>
        <td>
          <i className={cx('sx-dot', so.tone === 'g' && 'g', so.tone === 'w' && 'w')} />
          {so.text}
          {so.sub && <span className="mut"> · {so.sub}</span>}
        </td>
        <td>
          {nut === 'ghi' && (
            <Link href={`/thongke/ghi?team=${r.id}&date=${d.date}`} className="lnk">
              Ghi sổ ›
            </Link>
          )}
          {nut === 'ghi' && d.canLock && (
            <>
              {' '}
              <button
                type="button"
                className="lnk mut"
                onClick={() => d.hoi({ teamId: r.id, kind: 'chot' })}
              >
                chốt trống
              </button>
            </>
          )}
          {nut === 'chot' && (
            <button
              type="button"
              className="lnk"
              onClick={() => d.hoi(xn ? null : { teamId: r.id, kind: 'chot' })}
            >
              Chốt sổ ›
            </button>
          )}
          {nut === 'mo_khoa' && (
            <button
              type="button"
              className="lnk"
              onClick={() => d.hoi(xn ? null : { teamId: r.id, kind: 'mo_khoa' })}
            >
              Mở khoá ›
            </button>
          )}
        </td>
      </tr>
      {xn && <HangXacNhan d={d} r={r} kind={xn.kind} />}
      {mo &&
        r.docs.map((x) => (
          <tr key={x.id} className="d t2">
            <td className="pin">
              <Link href={`/thongke/lsx/${x.lsx_id}`} className="lnk ma">
                {x.doc_no}
              </Link>
            </td>
            <td
              className="ma"
              style={{ color: 'var(--sx-ink2)' }}
              title={x.lsx_code ?? undefined}
            >
              {x.lsx_code ?? '—'}
            </td>
            <td className="r num">{fmt(x.line_count)} dòng</td>
            <td className="r num">{fmt(x.total_qty)}</td>
            <td className={cx('r num', x.total_defect > 0 ? 'warn' : 'empty')}>
              {x.total_defect > 0 ? fmt(x.total_defect) : '—'}
            </td>
            <td className={cx('r num', x.total_rework > 0 ? 'warn' : 'empty')}>
              {x.total_rework > 0 ? fmt(x.total_rework) : '—'}
            </td>
            <td className="mut">
              {x.created_by_name ?? '—'} · {gio(x.created_at)}
            </td>
            <td>
              <i className={cx('sx-dot', isDraft(x.status) ? 'w' : 'g')} />
              {isDraft(x.status) ? (
                <>
                  {STATUS_LABEL[x.status].toUpperCase()}{' '}
                  <span className="mut">— chưa vào số</span>
                </>
              ) : (
                'chính thức'
              )}
            </td>
            <td>
              <Link href={`/thongke/lsx/${x.lsx_id}`} className="lnk">
                {isDraft(x.status) ? 'Ghi chính thức ›' : 'Mở ›'}
              </Link>
            </td>
          </tr>
        ))}
    </>
  )
}

function HangXacNhan({
  d,
  r,
  kind,
}: {
  d: SoNgayCtx
  r: ToRow
  kind: 'chot' | 'mo_khoa'
}) {
  if (kind === 'chot') {
    const c = cauChot(r, d.date)
    return (
      <tr className="cf">
        <td colSpan={9}>
          <div className="sx-cf">
            <span>{c.text}</span>
            {c.warn && (
              <span className="w">
                {c.warn}{' '}
                <button type="button" className="lnk" onClick={() => d.toggle(r.id)}>
                  Xem phiếu ›
                </button>
              </span>
            )}
            <span className="sp">
              <button
                type="button"
                className={cx('sx-btn', !c.empty && 'p')}
                disabled={d.busy}
                onClick={() => void d.chot(r.id, r.name)}
              >
                {d.busy ? 'Đang chốt…' : c.empty ? 'Chốt sổ trống' : 'Chốt sổ'}
              </button>
              <button type="button" className="sx-btn" onClick={() => d.hoi(null)}>
                Thôi
              </button>
            </span>
          </div>
        </td>
      </tr>
    )
  }
  const du = d.lyDo.trim().length >= 5
  return (
    <tr className="cf">
      <td colSpan={9}>
        <div className="sx-cf">
          <span>
            Mở khoá sổ{' '}
            <b>
              {r.name} · {dm(d.date)}
            </b>
            {r.lock?.by ? ` (${r.lock.by} chốt ${gio(r.lock.at)})` : ''} — lý do:
          </span>
          <input
            type="text"
            className="sx-cf-in"
            value={d.lyDo}
            onChange={(e) => d.setLyDo(e.target.value)}
            placeholder="ví dụ: ghi nhầm 40 cụm thành 400"
            aria-label="Lý do mở khoá"
            autoFocus
          />
          <span className="mut">{du ? 'có lưu vết' : 'ít nhất 5 ký tự'}</span>
          <span className="sp">
            <button
              type="button"
              className="sx-btn p"
              disabled={!du || d.busy}
              onClick={() => void d.moKhoa(r.id, r.name)}
            >
              {d.busy ? 'Đang mở…' : 'Mở khoá'}
            </button>
            <button type="button" className="sx-btn" onClick={() => d.hoi(null)}>
              Thôi
            </button>
          </span>
        </div>
      </td>
    </tr>
  )
}

function TabTuan({ d }: { d: SoNgayCtx }) {
  const { matrix, today } = d
  // Hàng = tổ kỳ vọng (thứ tự tab Ngày) ∪ tổ có sổ trong 7 ngày mà ngoài danh sách.
  const ids = new Set(d.rows.map((r) => r.id))
  const extra = matrix.teams.filter((t) => !ids.has(t.id))
  const hang = [
    ...d.rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit })),
    ...extra.map((t) => ({ id: t.id, name: t.name ?? '?', unit: '' })),
  ]
  return (
    <div className="sx-grid">
      <table className="sx-tb sx-sn" style={{ minWidth: 900 }}>
        <colgroup>
          <col style={{ width: 170 }} />
          <col style={{ width: 100 }} />
          {matrix.days.map((x) => (
            <col key={x} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="pin">Tổ</th>
            <th>Đơn vị</th>
            {matrix.days.map((x) => (
              <th key={x} className={cx('r', x === d.date && 'today')}>
                {thu(x)} {dm(x)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hang.map((t) => (
            <tr key={t.id} className="d">
              <td className="pin" style={{ fontWeight: 600 }}>
                {t.name}
              </td>
              <td className="mut">{t.unit || '—'}</td>
              {matrix.days.map((x) => {
                const c = matrix.cells[`${t.id}|${x}`]
                const dau = dauO(c, x, today)
                return (
                  <td key={x} className={cx('r num', x === d.date && 'today')}>
                    <Link
                      href={`/thongke/ngay?date=${x}`}
                      className="sx-wk"
                      title={
                        c
                          ? `${t.name} — ${dmy(x)}: đạt ${fmt(c.qty)}${c.defect ? ` · phế ${fmt(c.defect)}` : ''}${c.drafts ? ` · ${fmt(c.drafts)} nháp` : ''}${c.locked ? ' · đã chốt' : x < today && c.qty > 0 ? ' · QUÊN CHỐT' : ''}`
                          : `${t.name} — ${dmy(x)}: chưa có sổ`
                      }
                    >
                      {c && c.qty > 0 ? (
                        <b>{fmt(c.qty)}</b>
                      ) : (
                        <span className="empty">·</span>
                      )}
                      {dau && (
                        <span
                          className={cx(
                            'dau',
                            dau === '✓' ? 'ok' : dau === '●' ? 'warn' : 'stop',
                          )}
                        >
                          {' '}
                          {dau}
                        </span>
                      )}
                    </Link>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pin">{fmt(hang.length)} tổ</td>
            <td
              colSpan={matrix.days.length + 1}
              className="mut"
              style={{ fontWeight: 400 }}
            >
              số = Σ đạt chính thức của tổ (một đơn vị) · ✓ đã chốt · ● còn nháp · ! có sổ
              mà quên chốt · bấm ô là mở ngày đó — không có hàng Toàn xưởng
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
