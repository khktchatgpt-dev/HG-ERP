'use client'

import { Btn, Empty, Tag } from '@/components/kit'
import { cn } from '@/lib/utils'
import type { KyCongCtx, ToKy } from './useKyCong'
import { lucVn, so } from './ky.shared'
import { khongTheoKhung } from '@/lib/cham-cong/ky-gio-cong'

export const TH =
  'sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-left font-semibold text-[var(--ink-2)] whitespace-nowrap'
export const TD = 'border-b border-[var(--line-faint)] px-2.5 py-1.5 whitespace-nowrap'
const R = { textAlign: 'right' as const }
const gio = (p: number) => so(p / 60, 2)

function TagXacNhan({ t, mo }: { t: ToKy; mo: boolean }) {
  if (t.xacNhan)
    return (
      <Tag tone="done">
        ✓ {t.xacNhan.boi ?? '—'} · {lucVn(t.xacNhan.luc)}
        {t.xacNhan.ngay0 ? ` · ${t.xacNhan.ngay0} ngày 0 giờ` : ''}
      </Tag>
    )
  return <Tag>{mo ? 'chưa' : '—'}</Tag>
}

export function NganTo({ d }: { d: KyCongCtx }) {
  const { k } = d
  const chuaCoTo = k.nguoi.filter((n) => n.to === '(chưa có bộ phận)')
  const tPhut =
    k.to.reduce((s, t) => s + t.phut, 0) + chuaCoTo.reduce((s, n) => s + n.phut, 0)
  if (!k.nguoi.length)
    return (
      <Empty
        headline="Kỳ này chưa có lượt chấm công"
        reason="Chưa lấy dữ liệu máy cho khoảng ngày của kỳ."
        next={<Btn href="/hr/cham-cong/lay-du-lieu">Lấy dữ liệu từ máy</Btn>}
      />
    )
  return (
    <div className="flex min-h-0">
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <table className="text-k-sm w-full border-separate border-spacing-0">
          <thead>
            <tr>
              <th className={TH}>Tổ / bộ phận</th>
              <th className={TH} style={R}>
                Người
              </th>
              <th className={TH} style={R}>
                Tổng giờ
              </th>
              <th className={TH} style={R}>
                Công
              </th>
              <th className={TH} style={R}>
                Thiếu lượt
              </th>
              <th className={TH} style={R}>
                Chờ duyệt
              </th>
              <th className={TH}>Xác nhận</th>
            </tr>
          </thead>
          <tbody>
            {k.to.map((t) => (
              <tr
                key={t.ten}
                onClick={() => d.setChon(t.ten)}
                className={cn(
                  'cursor-pointer hover:bg-[var(--surface-hover)]',
                  d.chon === t.ten && 'bg-[var(--act-wash)]',
                )}
              >
                <td className={TD}>
                  <button
                    type="button"
                    className="text-left hover:underline"
                    onClick={() => d.setChon(t.ten)}
                  >
                    {t.ten}
                  </button>
                  {khongTheoKhung(t.cachTinh) && (
                    <span className="text-k-label ml-1.5 text-[var(--ink-3)]">
                      {t.cachTinh === 'du' ? 'đủ công' : 'theo ngày'}
                    </span>
                  )}
                </td>
                <td className={cn(TD, 'num')} style={R}>
                  {t.so}
                </td>
                <td className={cn(TD, 'num')} style={R}>
                  {gio(t.phut)}
                </td>
                <td className={cn(TD, 'num')} style={R}>
                  {so(t.cong, 2)}
                </td>
                <td
                  className={cn(TD, 'num', t.thieu && 'font-semibold text-[var(--stop)]')}
                  style={R}
                >
                  {t.thieu || ''}
                </td>
                <td
                  className={cn(
                    TD,
                    'num',
                    t.choDuyet && 'font-semibold text-[var(--warn)]',
                  )}
                  style={R}
                >
                  {t.choDuyet || ''}
                </td>
                <td className={TD}>
                  <TagXacNhan t={t} mo={d.mo} />
                </td>
              </tr>
            ))}
            {chuaCoTo.length > 0 && (
              <tr>
                <td className={TD}>(chưa có tổ)</td>
                <td className={cn(TD, 'num')} style={R}>
                  {chuaCoTo.length}
                </td>
                <td className={cn(TD, 'num')} style={R}>
                  {gio(chuaCoTo.reduce((s, n) => s + n.phut, 0))}
                </td>
                <td className={cn(TD, 'num')} style={R}>
                  {so(
                    chuaCoTo.reduce((s, n) => s + n.cong, 0),
                    2,
                  )}
                </td>
                <td className={cn(TD, 'num font-semibold text-[var(--stop)]')} style={R}>
                  {chuaCoTo.reduce((s, n) => s + n.thieu, 0) || ''}
                </td>
                <td className={TD} />
                <td className={TD}>
                  <Tag tone="stop">gán tổ trước khi chốt</Tag>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className={cn(TD, 'sticky bottom-0 bg-[var(--surface-raised)]')}>
                Cả kỳ
              </td>
              <td
                className={cn(TD, 'num sticky bottom-0 bg-[var(--surface-raised)]')}
                style={R}
              >
                {k.nguoi.length}
              </td>
              <td
                className={cn(TD, 'num sticky bottom-0 bg-[var(--surface-raised)]')}
                style={R}
              >
                {gio(tPhut)}
              </td>
              <td
                className={cn(TD, 'num sticky bottom-0 bg-[var(--surface-raised)]')}
                style={R}
              >
                {so(Math.round(k.nguoi.reduce((s, n) => s + n.cong, 0) * 100) / 100, 2)}
              </td>
              <td
                className={cn(TD, 'num sticky bottom-0 bg-[var(--surface-raised)]')}
                style={R}
              >
                {k.nguoi.reduce((s, n) => s + n.thieu, 0) || ''}
              </td>
              <td
                className={cn(TD, 'num sticky bottom-0 bg-[var(--surface-raised)]')}
                style={R}
              >
                {k.choDuyet || ''}
              </td>
              <td className={cn(TD, 'sticky bottom-0 bg-[var(--surface-raised)]')}>
                {k.to.filter((t) => t.xacNhan).length} / {k.to.length} tổ đã xác nhận
              </td>
            </tr>
            <tr>
              <td
                colSpan={7}
                className={cn(
                  TD,
                  'sticky bottom-0 bg-[var(--surface-raised)] text-[var(--ink-3)]',
                )}
              >
                Không gồm {k.soKhongCham} người không chấm công (lương tháng — Kế toán xử lý
                trên bảng lương).{' '}
                {k.trangThai === 'open'
                  ? 'Số tính sống, chưa chốt.'
                  : `Bản chốt lần ${k.ky?.lanChot}.`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {d.toChon && <CotTo d={d} t={d.toChon} />}
    </div>
  )
}

function CotTo({ d, t }: { d: KyCongCtx; t: ToKy }) {
  const { k } = d
  const vuong = t.dieuKien.filter((x) => !x.ok)
  const excel = `/api/dept/hr/cham-cong/ky/${k.thang}/excel?to=${encodeURIComponent(t.ten)}`
  return (
    <aside className="text-k-sm w-[300px] shrink-0 overflow-auto border-l border-[var(--line)] bg-[var(--surface-card)] px-4 py-3">
      <h3 className="text-k-label mb-1 font-semibold tracking-wide text-[var(--ink-3)] uppercase">
        Tổ đang chọn
      </h3>
      <div className="text-k-body font-semibold">{t.ten}</div>
      <div className="num text-[var(--ink-2)]">
        {t.so} người · {so(t.phut / 60, 2)} giờ · {so(t.cong, 2)} công
      </div>
      {t.thieu > 0 && (
        <div className="mt-1 text-[var(--stop)]">
          {t.thieu} ngày thiếu lượt chưa xử lý
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Btn
          href={`/hr/cham-cong/gio-cong?thang=${k.thang}&bp=${encodeURIComponent(t.ten)}`}
        >
          Mở Bảng công của tổ
        </Btn>
        <Btn icon="excel" href={excel}>
          Phiếu xác nhận
        </Btn>
      </div>
      {d.mo && (
        <div className="mt-3 border-t border-[var(--line-faint)] pt-3">
          {t.xacNhan ? (
            <>
              <div className="text-[var(--done)]">
                ✓ Đã xác nhận · {t.xacNhan.boi ?? '—'} · {lucVn(t.xacNhan.luc)}
              </div>
              <Btn
                busy={d.busy === 'bo'}
                blockedBy={k.quyen.xacNhan ? undefined : 'Hành Chính Nhân Sự'}
                onClick={() => d.boXacNhan(t.ten)}
              >
                Bỏ xác nhận
              </Btn>
            </>
          ) : (
            <>
              <Btn
                primary
                icon="duyet"
                blockedBy={k.quyen.xacNhan ? undefined : 'Hành Chính Nhân Sự'}
                aria-disabled={vuong.length > 0}
                onClick={() => !vuong.length && d.setSheet({ xacNhan: t.ten })}
              >
                Xác nhận tổ
              </Btn>
              {vuong.length > 0 && (
                <ul className="mt-1.5 list-none space-y-0.5 p-0 text-[var(--ink-3)]">
                  {vuong.map((x) => (
                    <li key={x.ma}>
                      {x.ten}: {x.chiTiet}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  )
}
