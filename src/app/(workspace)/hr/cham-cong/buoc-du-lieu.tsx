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
import { khongDau } from '@/lib/cham-cong/ghep-ten'
import { CoMat } from './co-mat'

/** Giá trị lọc cho dòng chưa có bộ phận (Pick không nhận chuỗi rỗng làm lựa chọn riêng). */
const BO_PHAN_TRONG = '__trong__'

/** Nhóm số lượt sau gộp lặp: '1' · '2' · '3' (= 3 trở lên, ngày nhiều đoạn làm). */
const nhomLuot = (r: DongLuot) => (r.luot.length >= 3 ? '3' : String(r.luot.length))

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
  const [xem, setXem] = useState<'luot' | 'to'>('luot')
  const [tim, setTim] = useState('')
  const [ngay, setNgay] = useState('')
  const [boPhan, setBoPhan] = useState('')
  const [soLuot, setSoLuot] = useState('')
  const [chuaGhep, setChuaGhep] = useState(false)

  const dsBoPhan = useMemo(
    () =>
      [...new Set(k.du.dong.map((r) => r.boPhan ?? ''))].sort((a, b) =>
        a.localeCompare(b, 'vi'),
      ),
    [k.du.dong],
  )

  const dong = useMemo(() => {
    const q = khongDau(tim)
    return k.du.dong.filter(
      (r) =>
        (!ngay || r.ngay === ngay) &&
        (!boPhan || (r.boPhan ?? '') === (boPhan === BO_PHAN_TRONG ? '' : boPhan)) &&
        (!soLuot || nhomLuot(r) === soLuot) &&
        (!chuaGhep || !r.daGhep) &&
        (!q || khongDau(`${r.ma} ${r.ten}`).includes(q)),
    )
  }, [k.du.dong, tim, ngay, boPhan, soLuot, chuaGhep])

  const soChuaGhep = k.du.dong.filter((r) => !r.daGhep).length
  const demLuot = (n: string) => k.du.dong.filter((r) => nhomLuot(r) === n).length
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

      <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-1.5">
        <div
          role="radiogroup"
          aria-label="Cách xem dữ liệu"
          className="inline-flex overflow-hidden border border-[var(--line)]"
        >
          {(
            [
              ['luot', 'Lượt từng người'],
              ['to', 'Có mặt theo tổ'],
            ] as const
          ).map(([id, ten], i) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={xem === id}
              onClick={() => setXem(id)}
              className={cn(
                'text-k-sm h-7 px-3',
                i > 0 && 'border-l border-[var(--line)]',
                xem === id
                  ? 'bg-[var(--act)] font-medium text-white'
                  : 'bg-[var(--surface-card)] hover:bg-[var(--surface-hover)]',
              )}
            >
              {ten}
            </button>
          ))}
        </div>
      </div>

      {xem === 'to' ? (
        <CoMat
          k={k}
          onMoNguoi={d.setMotNguoi}
          onXemLuot={(ng, bp) => {
            setTim('')
            setNgay(ng)
            setBoPhan(bp)
            setSoLuot('')
            setChuaGhep(false)
            setXem('luot')
          }}
        />
      ) : (
        <>
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
            <Pick
              label="Bộ phận"
              value={boPhan}
              onChange={setBoPhan}
              options={[
                { value: '', label: 'Mọi bộ phận' },
                ...dsBoPhan.map((b) =>
                  b
                    ? { value: b, label: b }
                    : { value: BO_PHAN_TRONG, label: '(chưa có bộ phận)' },
                ),
              ]}
            />
            <Pick
              label="Số lượt"
              value={soLuot}
              onChange={setSoLuot}
              options={[
                { value: '', label: 'Mọi số lượt' },
                { value: '1', label: `1 lượt (${so(demLuot('1'))})` },
                { value: '2', label: `2 lượt (${so(demLuot('2'))})` },
                { value: '3', label: `3 lượt trở lên (${so(demLuot('3'))})` },
              ]}
            />
            <label className="text-k-sm flex items-center gap-2 text-[var(--ink-2)]">
              <Tick
                label="Chỉ mã chưa ghép người"
                checked={chuaGhep}
                onChange={setChuaGhep}
              />
              Chỉ mã chưa ghép người ({so(soChuaGhep)})
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
                reason={`Kỳ này có ${so(k.du.dong.length)} dòng, nhưng không dòng nào khớp ô tìm / ngày / bộ phận / số lượt.`}
                next={
                  <Btn
                    onClick={() => {
                      setTim('')
                      setNgay('')
                      setBoPhan('')
                      setSoLuot('')
                      setChuaGhep(false)
                    }}
                  >
                    Bỏ lọc
                  </Btn>
                }
              />
            </div>
          ) : (
            <BangLuot dong={dong} tong={k.du.dong.length} onMoNguoi={d.setMotNguoi} />
          )}
        </>
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
  if (r.luot.length >= 3) out.push({ text: 'nhiều đoạn' })
  if (r.soLuotTho > r.luot.length)
    out.push({ text: `bấm lặp ${r.soLuotTho - r.luot.length}` })
  if (new Set(r.luot.map((l) => l.may)).size > 1)
    out.push({ text: '2 máy', tone: 'warn' })
  if (!r.daGhep) out.push({ text: 'mã chưa ghép người', tone: 'warn' })
  return out
}

/**
 * Lưới lượt: KHÔNG cuộn ngang (chủ dự án 17/10/2026 "hạn chế scroll ngang"). Cột
 * cố định bề rộng (`table-fixed`), mã + họ tên chung một ô, bỏ cột Máy (máy đã ghi
 * cạnh từng lượt), "Các lượt" và "Để ý" được xuống dòng. Giờ bày HH:MM, giờ đủ giây
 * ở tooltip.
 */
function BangLuot({
  dong,
  tong,
  onMoNguoi,
}: {
  dong: DongLuot[]
  tong: number
  /** Mở ngăn "Chấm công một người" — chỉ cho mã đã ghép người. */
  onMoNguoi: (ma: string) => void
}) {
  const c = 'border-b border-[var(--line-faint)]/40 px-2 py-0.5 align-top'
  const h = cn(
    c,
    'sticky top-0 z-[1] border-[var(--line)] bg-[var(--surface-raised)] text-left font-semibold whitespace-nowrap text-[var(--ink-2)]',
  )
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-card)]"
      role="region"
      aria-label="Lượt quẹt theo người và ngày"
      tabIndex={0}
    >
      <table className="text-k-sm w-full table-fixed border-separate border-spacing-0">
        <colgroup>
          <col style={{ width: 76 }} />
          <col style={{ width: '24%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: 48 }} />
          <col />
          <col style={{ width: '16%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className={h}>Ngày</th>
            <th className={h}>Mã · Họ tên</th>
            <th className={h}>Bộ phận</th>
            <th className={h} style={{ textAlign: 'right' }}>
              Lượt
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
              <td
                className={cn(c, 'num whitespace-nowrap')}
                style={{ textAlign: 'left' }}
              >
                {dm(x.ngay)} {THU[thu(x.ngay)]}
              </td>
              <td className={cn(c, 'truncate')} title={`${x.ma} · ${x.ten}`}>
                <span className="num mr-1.5 text-[var(--ink-3)]">{x.ma}</span>
                {x.daGhep ? (
                  <button
                    type="button"
                    className="text-left text-[var(--act-text)] hover:underline"
                    onClick={() => onMoNguoi(x.ma)}
                  >
                    {x.ten}
                  </button>
                ) : (
                  x.ten
                )}
              </td>
              <td
                className={cn(c, 'truncate', !x.boPhan && 'text-[var(--ink-3)]')}
                title={x.boPhan ?? undefined}
              >
                {x.boPhan ?? '—'}
              </td>
              <td className={cn(c, 'num')} style={{ textAlign: 'right' }}>
                {x.luot.length}
              </td>
              <td className={cn(c, 'num')} style={{ textAlign: 'left' }}>
                {x.luot.map((y, i) => (
                  <span
                    key={i}
                    className="mr-2 inline-block whitespace-nowrap"
                    title={y.gio}
                  >
                    {y.gio.slice(0, 5)}
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
                      'mr-1 mb-0.5 inline-block border px-1.5 text-[11px] whitespace-nowrap',
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
              colSpan={6}
              className={cn(
                c,
                'sticky bottom-0 border-t border-[var(--line)] bg-[var(--surface-raised)] font-semibold',
              )}
            >
              {so(dong.length)}
              {dong.length < tong ? ` / ${so(tong)}` : ''} dòng người-ngày · “Lượt” đã gộp
              lượt bấm lặp trong 2 phút (×2 = cùng giờ bấm 2 lần) · bày ĐỦ mọi lượt, chưa
              tính công · rê chuột lên giờ để xem đủ giây
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
