'use client'

import Link from 'next/link'
import { ApNhom, ApNut, DauTrang, SxKhung, ThanhTT } from './_erp/khung'
import { STALE_DAYS, isStale } from '@/lib/lsx-holder'
import type {
  OverviewRow,
  TeamWorkloadRow,
  TodayPulse,
} from '@/modules/dept/production/jobs.service'

/**
 * TÌNH HÌNH XƯỞNG — trang vào việc của khu Sản xuất (khuôn A), dựng lại KHÔNG
 * kit ở B6 (03/11/2026). Trả lời: "hôm nay lệnh nào kẹt, ai phải gỡ?".
 *
 * Ba luật của khuôn A giữ nguyên từ bản kit:
 *  1. Ô việc là CỬA VÀO VIỆC: mỗi ô là link sang Lệnh sản xuất đã lọc đúng
 *     điều kiện nó vừa đếm (`?view=`) — bấm vào phải ra đúng chừng ấy dòng.
 *  2. Số 0 không phải lúc nào cũng xấu: chỉ tô màu khi CÓ việc.
 *  3. KHÔNG chép cả bảng lệnh xuống đây (chủ dự án chốt 05/09): KPI + vài
 *     dòng nổi bật + đường dẫn.
 */

const fmt = (n: number) => n.toLocaleString('vi-VN')
const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const cx = (...xs: (string | false | null | undefined | 0)[]) =>
  xs.filter(Boolean).join(' ')

function OViec({
  label,
  count,
  hint,
  href,
  tone,
}: {
  label: string
  count: number
  hint: string
  href: string
  tone: 'stop' | 'warn'
}) {
  return (
    <Link
      href={href}
      className={cx('sx-tile', count === 0 ? 'zero' : tone === 'stop' ? 's' : 'w')}
    >
      <span className="d">{label}</span>
      <span className="v">{fmt(count)}</span>
      <span className="s">{hint}</span>
    </Link>
  )
}

export function TinhHinhScreen({
  rows,
  workload,
  pulse,
  canRecord,
}: {
  rows: OverviewRow[]
  workload: TeamWorkloadRow[]
  pulse: TodayPulse
  canRecord: boolean
}) {
  const late = rows.filter((r) => r.lsx.late === 'overdue')
  const short = rows.filter((r) => (r.materials?.missing_count ?? 0) > 0)
  const noshape = rows.filter((r) => r.component_count === 0)
  const stale = rows.filter((r) => isStale(r.holder))
  const bottleneck = workload.filter((w) => w.bottleneck_stages.length > 0)
  // Tổ ĐANG HOẠT ĐỘNG mà chưa chốt sổ — tổ không có việc gì hôm nay thì không nợ ai.
  const unlocked = workload.filter(
    (w) => !w.locked_today && (w.today_qty > 0 || w.todo + w.doing > 0),
  )
  // Lệnh cần chú ý: trễ hạn trước, rồi nằm im lâu nhất. Chỉ 5 dòng.
  const spotlight = [...rows]
    .sort((a, b) => {
      const la = a.lsx.late === 'overdue' ? 0 : 1
      const lb = b.lsx.late === 'overdue' ? 0 : 1
      if (la !== lb) return la - lb
      return (b.holder.days ?? 0) - (a.holder.days ?? 0)
    })
    .slice(0, 5)
  const pctNgay = pulse.target > 0 ? pulse.qty / pulse.target : null

  return (
    <SxKhung label="Tình hình xưởng">
      <div className="sx-body">
        <DauTrang
          crumb="Điều hành"
          title="Tình hình xưởng"
          ctx={
            <>
              hôm nay <b>{dmy(pulse.date)}</b> · {rows.length} lệnh đang chạy ·{' '}
              {workload.length} tổ
            </>
          }
          actions={
            <>
              <ApNhom>
                <ApNut href="/kehoach-sx/tuan">Xem theo tuần</ApNut>
                <ApNut href="/kehoach-sx/theo-to">Luỹ kế theo tổ</ApNut>
                <ApNut href="/thongke/bao-cao">Báo cáo</ApNut>
              </ApNhom>
              <ApNhom>
                <ApNut primary href="/thongke/lenh">
                  Lệnh sản xuất · {fmt(rows.length)}
                </ApNut>
              </ApNhom>
            </>
          }
        />

        <div className="sx-tiles">
          <OViec
            label="Lệnh trễ hạn xuất"
            count={late.length}
            hint="đã quá ngày xuất mà lệnh chưa đóng"
            href="/thongke/lenh?view=late"
            tone="stop"
          />
          <OViec
            label={`Nằm im ≥ ${STALE_DAYS} ngày`}
            count={stale.length}
            hint="bóng ở một phòng mà không ai động vào"
            href="/thongke/lenh?view=stale"
            tone="warn"
          />
          <OViec
            label="Thiếu vật tư"
            count={short.length}
            hint="còn mã vật tư chưa về đủ theo định mức"
            href="/thongke/lenh?view=short"
            tone="warn"
          />
          <OViec
            label="Chưa định hình"
            count={noshape.length}
            hint="chưa có bảng chi tiết nên chưa ghi sổ được"
            href="/thongke/lenh?view=noshape"
            tone="warn"
          />
          <OViec
            label="Tổ chưa chốt sổ"
            count={unlocked.length}
            hint="tổ có việc hôm nay mà chưa chốt sổ ngày"
            href="/thongke/ngay"
            tone="warn"
          />
          <OViec
            label="Tổ đang nghẽn"
            count={bottleneck.length}
            hint="tồn tại tổ vượt nhịp làm của chính tổ"
            href="/thongke/lenh"
            tone="warn"
          />
        </div>

        <div className="sx-sec">Nhịp hôm nay · {dmy(pulse.date)}</div>
        <div className="sx-tiles">
          <div
            className={cx(
              'sx-tile',
              pctNgay != null && pctNgay < 0.8 ? 'w' : pulse.qty === 0 && 'zero',
            )}
          >
            <span className="d">Sản lượng đạt</span>
            <span className="v">{fmt(pulse.qty)}</span>
            <span className="s">
              {pulse.target > 0 ? `/ ${fmt(pulse.target)} chỉ tiêu` : 'chưa có chỉ tiêu'}
            </span>
          </div>
          <div className={cx('sx-tile', pulse.defect > 0 ? 'w' : 'zero')}>
            <span className="d">Phế hôm nay</span>
            <span className="v">{fmt(pulse.defect)}</span>
            <span className="s">
              {pulse.qty > 0 ? `trên ${fmt(pulse.qty)} đạt` : 'chưa có sổ'}
            </span>
          </div>
          {pulse.rework > 0 && (
            <div className="sx-tile w">
              <span className="d">Chờ sửa lại</span>
              <span className="v">{fmt(pulse.rework)}</span>
              <span className="s">chưa tính vào đạt</span>
            </div>
          )}
          <div
            className={cx(
              'sx-tile',
              pulse.teams_active > 0 && pulse.teams_locked < pulse.teams_active && 'w',
            )}
          >
            <span className="d">Tổ đã chốt sổ</span>
            <span className="v">{fmt(pulse.teams_locked)}</span>
            <span className="s">/ {fmt(pulse.teams_active)} tổ có việc</span>
          </div>
          <div className={cx('sx-tile', pulse.kg === 0 && 'zero')}>
            <span className="d">Khối lượng</span>
            <span className="v">{pulse.kg > 0 ? fmt(pulse.kg) : '—'}</span>
            <span className="s">kg ghi trong sổ hôm nay</span>
          </div>
        </div>

        <div className="sx-grid">
          <div className="sx-sec">
            Tổ hôm nay
            <span
              className="mut"
              style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}
            >
              chỉ nói HÔM NAY — luỹ kế theo tổ ở màn riêng
            </span>
          </div>
          <table className="sx-tb" style={{ minWidth: 760 }}>
            <colgroup>
              <col style={{ width: 180 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 100 }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>Tổ</th>
                <th className="r">Chỉ tiêu</th>
                <th className="r">Đạt</th>
                <th className="r">Phế</th>
                <th className="r">Tồn tại tổ</th>
                <th className="r">Việc đang làm</th>
                <th>Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {workload.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="mut"
                    style={{ height: 48, textAlign: 'center' }}
                  >
                    Chưa có tổ xưởng nào — tạo phòng ban thuộc khu Sản xuất
                  </td>
                </tr>
              )}
              {workload.map((w) => (
                <tr key={w.department_id} className="d">
                  <td>{w.department_name}</td>
                  <td className={cx('r num', w.today_target === 0 && 'empty')}>
                    {w.today_target > 0 ? fmt(w.today_target) : '—'}
                  </td>
                  <td
                    className={cx(
                      'r num',
                      w.today_target > 0 && w.today_qty < w.today_target && 'warn',
                      w.today_qty === 0 && 'empty',
                    )}
                  >
                    {fmt(w.today_qty)}
                  </td>
                  <td className={cx('r num', w.today_defect > 0 ? 'warn' : 'empty')}>
                    {w.today_defect > 0 ? fmt(w.today_defect) : '—'}
                  </td>
                  <td className={cx('r num', w.wip === 0 && 'empty')}>
                    {w.wip > 0 ? fmt(w.wip) : '—'}
                  </td>
                  <td className="r num">{fmt(w.todo + w.doing)}</td>
                  <td>
                    {w.bottleneck_stages.map((s) => (
                      <span key={s} className="pill w">
                        nghẽn {s}
                      </span>
                    ))}
                    {w.locked_today && <span className="pill d">đã chốt sổ</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="sx-sec">
            Lệnh cần chú ý
            <Link className="lnk" href="/thongke/lenh">
              Xem tất cả {fmt(rows.length)} lệnh
            </Link>
          </div>
          <table className="sx-tb" style={{ minWidth: 760 }}>
            <colgroup>
              <col style={{ width: 150 }} />
              <col />
              <col style={{ width: 100 }} />
              <col style={{ width: 220 }} />
              <col style={{ width: 150 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Lệnh</th>
                <th>Khách hàng</th>
                <th>Hạn xuất</th>
                <th>Ai đang giữ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {spotlight.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="mut"
                    style={{ height: 48, textAlign: 'center' }}
                  >
                    Không có lệnh nào đang chạy
                  </td>
                </tr>
              )}
              {spotlight.map((r) => (
                <tr key={r.lsx.id} className="d">
                  <td className="ma">
                    <Link className="lnk" href={`/thongke/lsx/${r.lsx.id}`}>
                      {r.lsx.code}
                    </Link>
                  </td>
                  <td title={r.lsx.customer_name}>{r.lsx.customer_name}</td>
                  <td className={cx('num', r.lsx.late === 'overdue' && 'stop')}>
                    {r.lsx.ship_date ? dmy(r.lsx.ship_date) : '—'}
                  </td>
                  <td className={cx(isStale(r.holder) && 'warn')}>
                    {r.holder.who}
                    {r.holder.days != null &&
                      !r.holder.closed &&
                      ` · ${r.holder.days} ngày`}
                  </td>
                  <td>
                    {canRecord && r.component_count > 0 && (
                      <Link className="lnk" href={`/thongke/ghi?lsx=${r.lsx.id}`}>
                        Ghi sổ
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ThanhTT
          left="Mỗi ô việc dẫn sang Lệnh sản xuất đã lọc đúng điều kiện nó đếm — bấm vào ra đúng chừng ấy dòng"
          right="jobs.service.overview · lib/lsx-holder"
        />
      </div>
    </SxKhung>
  )
}
