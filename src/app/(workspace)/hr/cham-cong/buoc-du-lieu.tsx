'use client'

import { useMemo, useState } from 'react'
import {
  Btn,
  DateInput,
  Empty,
  NoticeBar,
  Pick,
  SearchInput,
  Tick,
} from '@/components/kit'
import { cn } from '@/lib/utils'
import type { DongLuot } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import type { KyCongCtx } from './useKyCong'
import { THU, dm, dmy, thu } from './ky-cong.shared'
import { luc, so } from './cham-cong.shared'

/**
 * BƯỚC ① DỮ LIỆU — "máy đã ghi những lượt quẹt nào trong kỳ?". CHỈ bày đúng
 * những gì máy ghi, mỗi dòng một người một ngày — không tính công, không kết luận
 * thiếu/đủ (chủ dự án 12/10/2026: lấy dữ liệu trước, tính sau).
 *
 * Khoảng lấy về chọn ngay trên thanh của bước; nút "Lấy về từ máy" là nút chính
 * ở góc phải đầu trang.
 */
export function BuocDuLieu({ d }: { d: KyCongCtx }) {
  const { k } = d
  const [tim, setTim] = useState('')
  const [ngay, setNgay] = useState('')
  const [motLuot, setMotLuot] = useState(false)

  const dong = useMemo(() => {
    const q = tim.trim().toLowerCase()
    return k.du.dong.filter(
      (r) =>
        (!ngay || r.ngay === ngay) &&
        (!motLuot || r.luot.length < 2) &&
        (!q || r.ma.toLowerCase().includes(q) || r.ten.toLowerCase().includes(q)),
    )
  }, [k.du.dong, tim, ngay, motLuot])

  const soMotLuot = k.du.dong.filter((r) => r.luot.length < 2).length
  const lan = k.lanLay[0]

  return (
    <>
      <div className="text-k-sm flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5 text-[var(--ink-2)]">
        <span>Lấy từ máy, khoảng</span>
        <DateInput
          label="Lấy từ ngày"
          value={d.tu}
          onChange={d.setTu}
          disabled={d.dangLay}
        />
        <span className="text-[var(--ink-3)]">→</span>
        <DateInput
          label="Lấy đến ngày"
          value={d.den}
          onChange={d.setDen}
          disabled={d.dangLay}
        />
        <span>
          {lan ? (
            <>
              · lần cuối <b className="num text-[var(--ink)]">{luc(lan.batDau)}</b>
              {lan.nguoi && <> · {lan.nguoi}</>} ·{' '}
              <span className="num">
                {dm(lan.tu)} → {dm(lan.den)}
              </span>
            </>
          ) : (
            '· chưa có lần lấy nào được ghi lại'
          )}
        </span>
        <button
          type="button"
          className="ml-auto text-[var(--act-text)] underline"
          onClick={() => d.setNgan('may')}
        >
          Máy &amp; lịch sử lấy
        </button>
      </div>

      {d.loiKhoang && (
        <NoticeBar tone="stop" tag="Khoảng ngày">
          {d.loiKhoang}
        </NoticeBar>
      )}
      {d.dangLay && (
        <NoticeBar tone="neutral" tag="Đang đọc máy">
          Máy phải gửi hết log (~1,5 phút cho cả hai máy) rồi ERP mới lọc đúng khoảng{' '}
          {dmy(d.tu)} → {dmy(d.den)}. Đừng đóng trang.
        </NoticeBar>
      )}
      {d.ketQua?.may
        .filter((m) => !m.ok)
        .map((m) => (
          <NoticeBar key={m.ip} tone="stop" tag={m.ten}>
            {m.loi}
          </NoticeBar>
        ))}

      <DaiNgay d={d} />

      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5">
        <SearchInput
          value={tim}
          onChange={setTim}
          placeholder="Tìm mã hoặc tên"
          width={220}
          label="Tìm mã hoặc tên"
        />
        <Pick
          label="Ngày"
          value={ngay}
          onChange={setNgay}
          options={[
            { value: '', label: 'Cả kỳ' },
            ...k.du.theoNgay.map((n) => ({
              value: n.ngay,
              label: `${dm(n.ngay)} ${THU[thu(n.ngay)]}`,
            })),
          ]}
        />
        <label className="text-k-sm flex items-center gap-2 text-[var(--ink-2)]">
          <Tick label="Chỉ dòng có 1 lượt" checked={motLuot} onChange={setMotLuot} />
          Chỉ dòng có 1 lượt ({so(soMotLuot)})
        </label>
        <span className="text-k-sm ml-auto text-[var(--ink-3)]">
          Bước này chỉ bày đúng những gì máy ghi — chưa tính công
        </span>
      </div>

      {k.du.dong.length === 0 ? (
        <div className="flex-1 bg-[var(--surface-card)]">
          <Empty
            headline={`Kỳ ${dm(k.tu)} → ${dm(k.den)} chưa có lượt nào trong ERP`}
            reason="Dữ liệu chỉ vào ERP khi bấm lấy về — máy chấm công không tự gửi lên."
            next="Chọn khoảng ngày ở thanh trên rồi bấm “Lấy về từ máy” ở góc phải."
          />
        </div>
      ) : dong.length === 0 ? (
        <div className="flex-1 bg-[var(--surface-card)]">
          <Empty
            headline="Không có dòng nào khớp bộ lọc"
            reason={`Kỳ này có ${so(k.du.dong.length)} dòng, nhưng không dòng nào khớp ô tìm / ngày / chỉ 1 lượt.`}
            next={
              <Btn
                onClick={() => {
                  setTim('')
                  setNgay('')
                  setMotLuot(false)
                }}
              >
                Bỏ lọc
              </Btn>
            }
          />
        </div>
      ) : (
        <BangLuot dong={dong} tong={k.du.dong.length} />
      )}

      {k.du.dong.length > 0 && (
        <NoticeBar
          tone="neutral"
          tag="Bước tiếp"
          action={{
            label: 'Sang ② Nhân viên & ca',
            onClick: () => d.moBuoc('nhan-vien'),
          }}
        >
          Đã có dữ liệu. Kiểm ca của từng người trước khi tính công.
        </NoticeBar>
      )}
    </>
  )
}

/** Dải ngày của kỳ: số lượt máy ghi mỗi ngày. Nét đứt = chưa lấy về hoặc không ai quẹt. */
function DaiNgay({ d }: { d: KyCongCtx }) {
  const ngays = d.k.du.theoNgay
  return (
    <div
      className="grid border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1"
      style={{ gridTemplateColumns: `repeat(${ngays.length}, minmax(0, 1fr))` }}
      aria-label="Số lượt máy ghi mỗi ngày trong kỳ"
    >
      {ngays.map((n) => {
        const tong = Object.values(n.theoMay).reduce((a, b) => a + b, 0)
        const sau = n.ngay > d.k.homNay
        return (
          <div
            key={n.ngay}
            title={`${dm(n.ngay)}: ${
              Object.entries(n.theoMay)
                .map(([m, c]) => `máy ${m} ${c}`)
                .join(' · ') || (sau ? 'chưa tới' : 'chưa có lượt')
            }`}
            className={cn(
              'border-r border-[var(--line-faint)]/40 py-0.5 text-center text-[10px] text-[var(--ink-3)]',
              thu(n.ngay) === 0 && 'bg-[var(--chrome)]/50',
              sau && 'opacity-40',
            )}
          >
            <b
              className="num block text-[11px] text-[var(--ink)]"
              style={{ textAlign: 'center' }}
            >
              {Number(n.ngay.slice(8))}
            </b>
            {tong ? so(tong) : '—'}
            <i
              className={cn(
                'mx-1 mt-0.5 block h-1',
                tong ? 'bg-[var(--done)]' : 'border-t border-dashed border-[var(--line)]',
              )}
            />
          </div>
        )
      })}
    </div>
  )
}

function deY(r: DongLuot): { text: string; tone?: 'stop' | 'warn' }[] {
  const out: { text: string; tone?: 'stop' | 'warn' }[] = []
  if (r.luot.length < 2) out.push({ text: '1 lượt', tone: 'stop' })
  if (r.soLuotTho > r.luot.length)
    out.push({ text: `bấm lặp ${r.soLuotTho - r.luot.length}` })
  if (new Set(r.luot.map((l) => l.may)).size > 1)
    out.push({ text: '2 máy', tone: 'warn' })
  if (!r.daGhep) out.push({ text: 'mã chưa ghép người', tone: 'warn' })
  return out
}

function BangLuot({ dong, tong }: { dong: DongLuot[]; tong: number }) {
  const c = 'border-b border-[var(--line-faint)]/40 px-2.5 py-0.5 whitespace-nowrap'
  const h = cn(
    c,
    'sticky top-0 z-[1] border-[var(--line)] bg-[var(--surface-raised)] text-left font-semibold text-[var(--ink-2)]',
  )
  const r = { textAlign: 'right' as const }
  const l = { textAlign: 'left' as const }
  return (
    <div
      className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]"
      role="region"
      aria-label="Lượt quẹt theo người và ngày"
      tabIndex={0}
    >
      <table className="text-k-sm w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className={h}>Ngày</th>
            <th className={h}>Mã</th>
            <th className={h}>Tên trên máy</th>
            <th className={h}>Máy</th>
            <th className={h} style={r}>
              Lượt đầu
            </th>
            <th className={h} style={r}>
              Lượt cuối
            </th>
            <th className={h} style={r}>
              Số lượt
            </th>
            <th className={h}>Các lượt (giờ · máy)</th>
            <th className={h}>Để ý</th>
          </tr>
        </thead>
        <tbody>
          {dong.map((x) => (
            <tr
              key={`${x.ngay}|${x.ma}|${x.daGhep}`}
              className="hover:bg-[var(--surface-hover)]"
            >
              <td className={cn(c, 'num')} style={l}>
                {dm(x.ngay)} {THU[thu(x.ngay)]}
              </td>
              <td className={cn(c, 'num')} style={l}>
                {x.ma}
              </td>
              <td className={c}>{x.ten}</td>
              <td className={cn(c, 'num')} style={l}>
                {[...new Set(x.luot.map((y) => y.may))].join(' ')}
              </td>
              <td className={cn(c, 'num')}>{x.luot[0].gio.slice(0, 5)}</td>
              <td className={cn(c, 'num')}>
                {x.luot.length > 1 ? x.luot[x.luot.length - 1].gio.slice(0, 5) : '—'}
              </td>
              <td className={cn(c, 'num')}>{x.soLuotTho}</td>
              <td className={cn(c, 'num')} style={l}>
                {x.luot.map((y, i) => (
                  <span key={i} className="mr-2">
                    {y.gio}
                    {y.lap > 0 && (
                      <span className="text-[var(--ink-3)]">×{y.lap + 1}</span>
                    )}{' '}
                    <span className="text-[var(--ink-3)]">{y.may}</span>
                  </span>
                ))}
              </td>
              <td className={c}>
                {deY(x).map((f) => (
                  <span
                    key={f.text}
                    className={cn(
                      'mr-1 border px-1.5 text-[11px]',
                      f.tone === 'stop'
                        ? 'border-[var(--stop-line)] bg-[var(--stop-wash)] text-[var(--stop)]'
                        : f.tone === 'warn'
                          ? 'border-[var(--warn-line)] bg-[var(--warn-wash)] text-[var(--warn)]'
                          : 'border-[var(--line)] bg-[var(--surface-raised)] text-[var(--ink-2)]',
                    )}
                  >
                    {f.text}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td
              colSpan={9}
              className={cn(
                c,
                'sticky bottom-0 border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold',
              )}
            >
              {so(dong.length)}
              {dong.length < tong ? ` / ${so(tong)}` : ''} dòng người-ngày · “Số lượt” gồm
              cả lượt bấm lặp trong 2 phút · ×2 = cùng giờ bấm 2 lần
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
