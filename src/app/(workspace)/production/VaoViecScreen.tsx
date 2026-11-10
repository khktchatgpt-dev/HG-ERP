'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ApNhom, ApNut, DauTrang, SxKhung, ThanhTT } from './_erp/khung'
import { KhiXuongChay } from './khi-xuong-chay'
import { datHomNayText, type Buoc, type Viec } from '@/lib/vao-viec-sx'
import type {
  OverviewRow,
  TeamWorkloadRow,
  TodayPulse,
} from '@/modules/dept/production/jobs.service'

/**
 * VÀO VIỆC — trang đầu khu Sản xuất (khuôn A), dựng theo bản vẽ 10/11/2026
 * https://claude.ai/artifact/AMZpLvxJAaZKCDimF93qJL (duyệt Q1–Q6). Thay Tình
 * hình xưởng làm cửa vào vì chủ dự án (10/11): "nhìn vào phần sản xuất không
 * biết nên bắt đầu từ đâu" — trang cũ trả lời "cái gì đang hỏng", hôm nay
 * toàn số 0.
 *
 * Ba khối: (1) dải SÁU BƯỚC đường đi của lệnh — mỗi ô: ai làm · số lệnh đang
 * CHỜ · nút sang màn; (2) "Việc của bạn hôm nay" ≤ 5 dòng theo quyền (Kế
 * hoạch / quản đốc), lệnh trễ trước, gom lệnh cùng hạn (Q5); (3) "Khi xưởng
 * chạy" = Tình hình xưởng cũ nguyên hàm đếm, gập khi chưa có sổ. Mọi số tính
 * ở server + lib/vao-viec-sx (thuần, có test); màn không cộng gì.
 */

const fmt = (n: number) => n.toLocaleString('vi-VN')
const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const cx = (...xs: (string | false | null | undefined | 0)[]) =>
  xs.filter(Boolean).join(' ')

export function VaoViecScreen({
  rows,
  workload,
  pulse,
  canRecord,
  buoc,
  viecKH,
  viecQD,
  today,
}: {
  rows: OverviewRow[]
  workload: TeamWorkloadRow[]
  pulse: TodayPulse
  canRecord: boolean
  buoc: Buoc[]
  /** null = người này không có quyền Kế hoạch. */
  viecKH: Viec[] | null
  /** null = không có quyền điều hành. */
  viecQD: Viec[] | null
  today: string
}) {
  const coSo = pulse.qty > 0 || rows.some((r) => r.qty_done > 0)
  const [moXuong, setMoXuong] = useState(coSo)

  return (
    <SxKhung label="Vào việc">
      <div className="sx-body">
        <DauTrang
          crumb="Sản xuất"
          title="Vào việc"
          ctx={
            <>
              hôm nay <b>{dmy(today)}</b> · <b>{fmt(rows.length)}</b> lệnh đang chạy ·{' '}
              {coSo
                ? `đạt hôm nay ${datHomNayText(pulse.by_unit)}`
                : 'chưa có sổ hôm nay'}
            </>
          }
          actions={
            <ApNhom>
              <ApNut href="/thongke/lenh">Lệnh sản xuất</ApNut>
              <ApNut href="/thongke/bao-cao">Báo cáo</ApNut>
            </ApNhom>
          }
        />

        <div className="sx-sec">Đường đi của lệnh — số lệnh đang chờ ở từng bước</div>
        <div className="sx-duong" role="list">
          {buoc.map((b) => (
            <div
              key={b.so}
              role="listitem"
              className={cx('sx-buoc', b.tone === 'warn' && 'w')}
            >
              <span className="k">
                {b.label} <i>{b.so}</i>
              </span>
              <span className="ai">{b.ai}</span>
              <Link
                href={b.href}
                className={cx(
                  'n lnk',
                  b.tone === 'warn' && 'w',
                  b.tone === 'stop' && 's',
                  b.tone === 'zero' && 'z',
                )}
                style={{ textDecoration: 'none' }}
                title={`${b.n} lệnh — mở danh sách`}
              >
                {fmt(b.n)}
                <small>{b.donVi}</small>
              </Link>
              <span className="d">{b.moTa}</span>
              <span className="go">
                <Link
                  className={cx('sx-btn sm', b.so === 4 && b.n > 0 && 'p')}
                  href={b.href}
                >
                  {b.nut}
                </Link>
                {b.nut2 && (
                  <Link className="sx-btn sm" href={b.nut2.href}>
                    {b.nut2.label}
                  </Link>
                )}
              </span>
            </div>
          ))}
        </div>

        {viecKH && (
          <BangViec
            tieuDe="Việc của bạn hôm nay — Kế hoạch sản xuất"
            ghiChu="hạn xuất gần nhất trước"
            items={viecKH}
            cot3="Hạn xuất"
          />
        )}
        {viecQD && (
          <BangViec
            tieuDe="Việc của bạn hôm nay — Quản đốc"
            ghiChu={coSo ? '' : 'xưởng chưa ghi sổ'}
            items={viecQD}
            cot3="Mốc"
          />
        )}
        {!viecKH && !viecQD && (
          <div className="sx-rong">
            <b>Bạn đang xem chéo khu Sản xuất</b>
            <p>
              Bảng việc hôm nay chỉ tính cho người có quyền Kế hoạch hoặc điều hành. Các
              số trên dải bước vẫn là số thật.
            </p>
          </div>
        )}

        <div className="sx-gap-h" style={{ marginTop: 'auto' }}>
          <button type="button" className="lnk" onClick={() => setMoXuong(!moXuong)}>
            {moXuong ? '▾' : '▸'} <b>Khi xưởng chạy</b>
          </button>
          {!coSo && <span className="mut">chưa có sổ hôm nay</span>}
        </div>
        {moXuong && (
          <div className="sx-grid" style={{ flex: '0 1 auto' }}>
            <KhiXuongChay
              rows={rows}
              workload={workload}
              pulse={pulse}
              canRecord={canRecord}
            />
          </div>
        )}

        <ThanhTT left="Việc hôm nay tính theo quyền của bạn" />
      </div>
    </SxKhung>
  )
}

function BangViec({
  tieuDe,
  ghiChu,
  items,
  cot3,
}: {
  tieuDe: string
  ghiChu: string
  items: Viec[]
  cot3: string
}) {
  return (
    <>
      <div className="sx-sec">
        {tieuDe}
        <span className="sp">{ghiChu}</span>
      </div>
      {items.length === 0 ? (
        <div className="sx-rong" style={{ padding: '10px 24px' }}>
          <b>Không còn việc nào chờ bạn hôm nay</b>
          <p>Mọi lệnh đang chạy đều đã có kế hoạch và không lệnh nào trễ.</p>
        </div>
      ) : (
        <table className="sx-tb sx-viec" style={{ width: '100%' }}>
          <colgroup>
            <col style={{ width: 34 }} />
            <col />
            <col style={{ width: 236 }} />
            <col style={{ width: 160 }} />
            <col style={{ width: 170 }} />
          </colgroup>
          <thead>
            <tr>
              <th></th>
              <th>Việc</th>
              <th>Lệnh</th>
              <th className="r">{cot3}</th>
              <th>Làm ở</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v, i) => (
              <tr key={i} className="d">
                <td>
                  <i
                    className={cx(
                      'dot',
                      v.tone === 'stop' ? 's' : v.tone === 'warn' ? 'w' : 'a',
                    )}
                  />
                </td>
                <td>{v.viec}</td>
                <td className="ma">{v.lenh}</td>
                <td
                  className={cx(
                    'r num',
                    v.mocTone === 'stop' && 'stop',
                    v.mocTone === 'warn' && 'warn',
                  )}
                >
                  {v.moc}
                </td>
                <td>
                  <Link className="lnk" href={v.href}>
                    {v.nut}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
