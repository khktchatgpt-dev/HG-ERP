'use client'

import { NumInput, TextInput } from '@/components/kit'
import { cn } from '@/lib/utils'
import {
  gioKhung,
  LOAI_NGAY,
  mucLuat,
  NGHI_LUONG,
  TEN_LOAI_NGAY,
} from '@/lib/cham-cong/cach-tinh'
import { docPt, hhmm, khoaHeSo, ptVn, type HeSoDong } from './cach-tinh.shared'
import type { CachTinhCtx } from './useCachTinh'

export const TH =
  'sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-left font-semibold text-[var(--ink-2)]'
export const TD = 'border-b border-[var(--line-faint)] px-2.5 py-1.5 align-middle'
export const SEC =
  'flex items-baseline gap-3 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-2'

/** Ô % — nhập được khi là nháp và có quyền; thấp hơn mức luật thì nền vàng + ▲. */
function OPt({ d, h }: { d: CachTinhCtx; h: HeSoDong }) {
  const min = d.toiThieu(h)
  const duoi = h.pt != null && min != null && h.pt < min
  const coDinh = NGHI_LUONG.find((n) => n.ma === h.ma && h.loai === 'leave')?.coDinh
  if (!d.suaHeSoDuoc || coDinh != null)
    return (
      <span
        className={cn(
          'num',
          duoi && 'font-semibold text-[var(--warn)]',
          h.pt == null && 'text-[var(--ink-3)]',
        )}
      >
        {h.pt == null ? 'chưa nhập' : `${ptVn(h.pt)} %`}
        {duoi && ' ▲'}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1">
      <NumInput
        value={ptVn(h.pt)}
        aria-label={`Hệ số ${h.ma} ${h.loai === 'frame' ? TEN_LOAI_NGAY[h.ngay as keyof typeof TEN_LOAI_NGAY] : ''}`.trim()}
        placeholder={min != null ? `≥ ${min}` : ''}
        onCommit={(v) => {
          const n = docPt(v)
          if (n !== undefined) d.doiHeSo(khoaHeSo(h), { pt: n })
        }}
        className={cn(
          'w-20 border px-1.5 py-0.5',
          duoi
            ? 'border-[var(--warn)] bg-[var(--warn-wash)] text-[var(--warn)]'
            : 'border-[var(--line)] bg-[var(--surface-card)]',
        )}
      />
      <span className="text-[var(--ink-3)]">%</span>
    </span>
  )
}

export function NganHeSo({ d }: { d: CachTinhCtx }) {
  const theo = new Map(d.heSo.map((h) => [khoaHeSo(h), h]))
  const o = (loai: HeSoDong['loai'], ma: string, ngay: HeSoDong['ngay']) =>
    theo.get(khoaHeSo({ loai, ma, ngay })) ?? { loai, ma, ngay, pt: null, lyDo: null }
  return (
    <div className="min-h-0 overflow-auto">
      <div className={SEC}>
        <h3 className="text-k-body font-semibold">Giờ làm theo khung</h3>
        <span className="text-k-sm text-[var(--ink-3)]">
          % lương giờ · Tài Chính Kế Toán nhập · công = giờ ÷ {d.quyTac.phutMotCong / 60}
        </span>
      </div>
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={cn(TH, 'w-14')}>Khung</th>
            <th className={TH}>Giờ</th>
            {LOAI_NGAY.map((n) => (
              <th key={n} className={TH} style={{ textAlign: 'right', width: 150 }}>
                {TEN_LOAI_NGAY[n]}
              </th>
            ))}
            <th className={TH}>Tối thiểu theo luật (thường · CN · lễ)</th>
          </tr>
        </thead>
        <tbody>
          {d.khung.map((k) => {
            const ml = LOAI_NGAY.map((n) => mucLuat(k, n))
            return (
              <tr key={k.ma}>
                <td className={cn(TD, 'num font-semibold text-[var(--act-text)]')}>
                  {k.ma}
                </td>
                <td className={TD}>
                  {k.ten}{' '}
                  <span className="num text-[var(--ink-3)]">
                    {gioKhung(k.tu, true)}–{gioKhung(k.den)}
                    {k.hanhChinh &&
                      ` · trừ trưa ${hhmm(d.quyTac.truaTu)}–${hhmm(d.quyTac.truaDen)}`}
                  </span>
                </td>
                {LOAI_NGAY.map((n) => (
                  <td key={n} className={TD} style={{ textAlign: 'right' }}>
                    <OPt d={d} h={o('frame', k.ma, n)} />
                  </td>
                ))}
                <td className={cn(TD, 'num text-[var(--ink-3)]')}>
                  {ml
                    .map((m) => (m.min === m.max ? m.min : `${m.min}–${m.max}`))
                    .join(' · ')}
                  {ml[0].ghiChu && ` · ${ml[0].ghiChu}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className={SEC}>
        <h3 className="text-k-body font-semibold">Ngày không làm có lý do</h3>
        <span className="text-k-sm text-[var(--ink-3)]">
          ký hiệu trên Bảng công · % lương ngày
        </span>
      </div>
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={cn(TH, 'w-14')}>Mã</th>
            <th className={TH}>Loại</th>
            <th className={TH} style={{ textAlign: 'right', width: 150 }}>
              Trả lương
            </th>
            <th className={TH}>Tính vào công</th>
            <th className={TH}>Ai trả</th>
            <th className={TH}>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {NGHI_LUONG.map((n) => (
            <tr key={n.ma}>
              <td className={cn(TD, 'num font-semibold text-[var(--act-text)]')}>
                {n.ky}
              </td>
              <td className={TD}>{n.ten}</td>
              <td className={TD} style={{ textAlign: 'right' }}>
                <OPt d={d} h={o('leave', n.ma, 'any')} />
              </td>
              <td className={TD}>{n.tinhCong}</td>
              <td className={TD}>{n.aiTra}</td>
              <td className={cn(TD, 'text-[var(--ink-3)]')}>{n.ghiChu}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-k-sm border-b border-[var(--line)] bg-[var(--surface-raised)] px-[var(--gutter)] py-1.5 text-[var(--ink-2)]">
        Tiền giờ làm ở khung ngoài hành chính và phần trên 100 % ngày CN / lễ được tách
        riêng trên bảng lương vì được miễn thuế TNCN — đây là luật, không phải ô nhập.
      </p>

      {d.duoi.length > 0 && (
        <>
          <div className={SEC}>
            <h3 className="text-k-body font-semibold text-[var(--warn)]">
              Thấp hơn mức luật — ghi lý do
            </h3>
            <span className="text-k-sm text-[var(--ink-3)]">
              Lưu được, nhưng Áp dụng cần lý do cho từng ô (ví dụ: thoả ước lao động).
            </span>
          </div>
          <table className="text-k-sm w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={cn(TH, 'w-40')}>Ô</th>
                <th className={TH} style={{ textAlign: 'right', width: 110 }}>
                  Đang nhập
                </th>
                <th className={TH} style={{ textAlign: 'right', width: 110 }}>
                  Tối thiểu
                </th>
                <th className={TH}>Lý do</th>
              </tr>
            </thead>
            <tbody>
              {d.duoi.map((h) => (
                <tr key={khoaHeSo(h)}>
                  <td className={TD}>
                    {h.loai === 'frame'
                      ? `${h.ma} · ${TEN_LOAI_NGAY[h.ngay as keyof typeof TEN_LOAI_NGAY]}`
                      : NGHI_LUONG.find((n) => n.ma === h.ma)?.ten}
                  </td>
                  <td
                    className={cn(TD, 'num text-[var(--warn)]')}
                    style={{ textAlign: 'right' }}
                  >
                    {ptVn(h.pt)} %
                  </td>
                  <td className={cn(TD, 'num')} style={{ textAlign: 'right' }}>
                    {d.toiThieu(h)} %
                  </td>
                  <td className={TD}>
                    {d.suaHeSoDuoc ? (
                      <TextInput
                        label={`Lý do ${h.ma}`}
                        value={h.lyDo ?? ''}
                        placeholder="Vì sao trả thấp hơn mức luật"
                        onCommit={(v) =>
                          d.doiHeSo(khoaHeSo(h), { lyDo: v.trim() || null })
                        }
                      />
                    ) : (
                      h.lyDo || <span className="text-[var(--stop)]">chưa ghi lý do</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
