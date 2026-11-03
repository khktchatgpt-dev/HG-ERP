'use client'

import type { DongDonDoi, SoVoiLenh } from '@/lib/don-doi'
import { Nhan, Nut, TD, TF, TH } from '../../_erp/ui'
import { dmy, so0 } from '../../bang-ke/[id]/ke-hoach.shared'
import { ngayGio } from './soat.shared'
import type { SoatCtx } from './useSoatLenh'

const COLS = 5
const NGAY = 'font-mono tabular-nums whitespace-nowrap'

/**
 * TAB "ĐƠN HÀNG" (T4, bản vẽ FgRYhTxe… bản 2, Q3–Q4) — đơn Sale của lệnh đổi
 * gì SAU mốc soát: dòng SP (SL, thêm, bỏ), hạn giao, huỷ đơn; lý do Sale ghi
 * nguyên văn; và "lệnh chưa sửa theo" — việc của Kế hoạch, nhưng Cung ứng cần
 * biết trước để chưa đặt thêm (hoặc dừng bớt) theo số cũ.
 */
export function TabDon({ d }: { d: SoatCtx }) {
  const t = d.thayDoi
  const khongNoi = t.noiDon.tong > 0 && t.noiDon.noi === 0
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
      {t.lechDon.length > 0 && (
        <div className="border-b border-[var(--warn-line)] bg-[var(--warn-wash)] px-4 py-1.5 text-[12.5px] text-[var(--warn)]">
          <b className="font-semibold">
            {t.lechDon.length} dòng đơn khác SL lệnh — lệnh chưa sửa theo đơn:
          </b>{' '}
          {t.lechDon
            .map((x) => `${x.sp} (${x.don}): đơn ${so0(x.slDon)}, lệnh ${so0(x.slLenh)}`)
            .join(' · ')}
          <span className="text-[var(--ink-2)]"> · hỏi Kế hoạch trước khi đặt thêm</span>
        </div>
      )}
      {t.don.length === 0 ? (
        <div className="grid justify-items-start gap-1.5 px-4 py-6">
          <b>
            Đơn hàng không đổi từ{' '}
            {t.moc.k === 'soat'
              ? 'lần soát cuối'
              : t.moc.laDuyet
                ? 'lúc duyệt'
                : 'lúc phát lệnh'}
          </b>
          <span className="text-[var(--ink-2)]">
            {t.donCuaLenh.length
              ? `Đơn của lệnh: ${t.donCuaLenh.join(', ')} — không sửa dòng SP, hạn giao, không huỷ.`
              : 'Lệnh không gắn đơn hàng nào.'}
            {khongNoi &&
              ' Lệnh nạp từ file, dòng lệnh chưa nối dòng đơn — Sale sửa đơn thì máy không so được SL đơn với SL lệnh.'}
          </span>
          <Nut href={`/mua-hang/bang-ke/${d.lsx.id}`}>Mở kế hoạch mua</Nut>
        </div>
      ) : (
        <table className="w-full min-w-[1000px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className={`${TH} w-[150px]`}>Đơn</th>
              <th className={TH}>Thay đổi · lý do Sale ghi</th>
              <th className={`${TH} w-[200px]`}>Cũ → mới</th>
              <th className={`${TH} w-[260px]`}>So với lệnh</th>
              <th className={`${TH} w-[150px]`}>Ai · lúc</th>
            </tr>
          </thead>
          <tbody>
            {t.don.map((x, i) => (
              <DongDon
                key={x.key}
                x={x}
                // Một lần sửa đơn đổi nhiều SP: lý do chỉ bày ở dòng đầu.
                lapLyDo={i > 0 && t.don[i - 1].order_id === x.order_id && t.don[i - 1].luc === x.luc} // prettier-ignore
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={COLS} className={TF}>
                {t.don.length} thay đổi đơn hàng
                <span className="font-normal text-[var(--ink-3)]">
                  {' '}
                  · chỉ loại ảnh hưởng việc mua (dòng SP, hạn giao, huỷ) — giá, trạng
                  thái, đợt xuất không tính
                  {khongNoi && ' · lệnh chưa nối dòng đơn nên không so được SL'}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}

function DongDon({ x, lapLyDo }: { x: DongDonDoi; lapLyDo: boolean }) {
  const gi =
    x.loai === 'huy'
      ? 'Huỷ đơn'
      : x.loai === 'han'
        ? 'Hạn giao'
        : `${x.sp} · ${x.truoc === null ? 'thêm SP' : x.sau === null ? 'bỏ SP' : 'SL'}`
  const cuMoi =
    x.loai === 'huy'
      ? '—'
      : x.loai === 'han'
        ? `${dmy(x.truoc as string | null)} → ${dmy(x.sau as string | null)}`
        : `${x.truoc === null ? '—' : so0(x.truoc as number)} → ${x.sau === null ? '0' : so0(x.sau as number)}` // prettier-ignore
  const so = moTaSo(x.soLenh, typeof x.sau === 'number' ? x.sau : null)
  return (
    <tr className="hover:bg-[var(--surface-hover)]">
      <td className={`${TD} max-w-0 font-mono text-[12px]`}>
        <span className="block truncate" title={x.don}>
          {x.don}
        </span>
      </td>
      <td className={`${TD} max-w-0`}>
        <span className="block truncate">
          {x.loai === 'huy' ? <Nhan tone="stop">Huỷ đơn</Nhan> : gi}
        </span>
        {lapLyDo ? (
          <span className="block text-[12px] text-[var(--ink-3)]">cùng lần sửa trên</span>
        ) : (
          x.lyDo && (
            <span
              className="block truncate text-[12px] text-[var(--ink-2)]"
              title={x.lyDo}
            >
              “{x.lyDo}”
            </span>
          )
        )}
      </td>
      <td className={`${TD} ${NGAY} text-[12.5px]`}>{cuMoi}</td>
      <td className={TD}>
        <span className={`block ${so.tone ?? ''}`}>{so.chinh}</span>
        {so.phu && (
          <span className="block text-[11.5px] text-[var(--ink-3)]">{so.phu}</span>
        )}
      </td>
      <td className={`${TD} max-w-0 text-[12px]`}>
        <span className="block truncate" title={x.boi ?? undefined}>
          {x.boi ?? 'không ghi người'}
        </span>
        <span className={`block text-[var(--ink-3)] ${NGAY}`}>{ngayGio(x.luc)}</span>
      </td>
    </tr>
  )
}

/** Cột "So với lệnh": lệnh đã theo / chưa sửa theo / không so được. */
function moTaSo(
  s: SoVoiLenh,
  /** SL đơn mới của dòng (loại `sl`) — để nói "bằng SL đơn mới" khi không nối. */
  slMoi: number | null,
): { chinh: string; phu?: string; tone?: string } {
  switch (s.k) {
    case 'theo':
      return { chinh: 'Lệnh đã theo', phu: `dòng lệnh ${so0(s.slLenh)}`, tone: 'text-[var(--done)]' } // prettier-ignore
    case 'chua_theo':
      return {
        chinh: 'Lệnh chưa sửa theo',
        phu: `đơn ${so0(s.slDon)} · dòng lệnh vẫn ${so0(s.slLenh)} · hỏi Kế hoạch`,
        tone: 'text-[var(--stop)]',
      }
    case 'khong_noi':
      return {
        chinh: 'Không so được',
        phu:
          s.slLenhCungMa === null
            ? 'lệnh chưa nối dòng đơn · lệnh không có mã này'
            : `lệnh chưa nối dòng đơn · SL lệnh cùng mã ${so0(s.slLenhCungMa)}${slMoi !== null && Math.abs(s.slLenhCungMa - slMoi) < 1e-6 ? ' = SL đơn mới' : ' — so tay'}`, // prettier-ignore
        tone: 'text-[var(--ink-3)]',
      }
    case 'ngay':
      return {
        chinh: `Ngày xuất lệnh ${dmy(s.ngayLenh)}`,
        phu: 'so tay với hạn giao mới',
      }
    case 'huy':
      return s.dongLenhCon === null
        ? { chinh: 'Không so được', phu: 'lệnh chưa nối dòng đơn — xem lệnh còn SP của đơn không', tone: 'text-[var(--ink-3)]' } // prettier-ignore
        : s.dongLenhCon > 0
          ? { chinh: `Lệnh còn ${s.dongLenhCon} dòng của đơn`, phu: 'dừng đặt thêm cho các SP này · hỏi Kế hoạch', tone: 'text-[var(--stop)]' } // prettier-ignore
          : { chinh: 'Lệnh đã bỏ dòng của đơn', tone: 'text-[var(--done)]' }
  }
}
