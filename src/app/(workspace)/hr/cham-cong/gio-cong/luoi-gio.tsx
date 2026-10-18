'use client'

import { Btn, Empty } from '@/components/kit'
import { cn } from '@/lib/utils'
import { KY_NGHI, TEN_NGHI } from '@/lib/cham-cong/dieu-chinh'
import type { GioCongCtx } from './useGioCong'
import {
  THU,
  dm,
  gio,
  hm,
  ngayKy,
  so,
  thu,
  type NgayGio,
} from './gio-cong.shared'

/**
 * LƯỚI CÔNG — người × ngày của kỳ (26 → 25). Ô ghi CÔNG = giờ có mặt ÷ 8 (chủ dự án chọn
 * 18/10/2026, tạm gác chia khung giờ): 1 · 1,38 · 1,63. Giờ có mặt vẫn tính theo luật file
 * Nhân sự (ân hạn, làm tròn bậc thang, trừ trưa). Tên ghim trái, 3 cột tổng ghim phải.
 * Kit không có ma trận người × ngày có ô bấm mở khung nổi, nên viết thẳng (CLAUDE.md 06/10).
 */

const W_TEN = 152
const W_O = 26
const W_T = 50
const TONG = ['Tổng giờ', 'Công', 'Thiếu lượt'] as const

/** Phút → công 2 lẻ kiểu VN, bỏ số 0 thừa: 480 → "1", 660 → "1,38". */
const congGon = (phut: number) => so(phut / 480, 2)

const nen = (phut: number) =>
  phut >= 660
    ? 'bg-[color-mix(in_srgb,var(--done)_26%,white)]'
    : phut >= 540
      ? 'bg-[color-mix(in_srgb,var(--done)_16%,white)]'
      : 'bg-[color-mix(in_srgb,var(--done)_8%,white)]'

export function LuoiGio({ d }: { d: GioCongCtx }) {
  const { b, dong } = d
  const ngays = ngayKy(b.tu, b.den)
  const right = (i: number) => (TONG.length - 1 - i) * W_T

  if (dong.length === 0) {
    return (
      <div className="flex-1 bg-[var(--surface-card)]">
        <Empty
          headline="Không có ai trong nhóm này"
          reason={
            d.tim
              ? 'Không ai khớp ô tìm.'
              : 'Bộ phận này chưa có người đang làm có chấm công.'
          }
          next={
            d.tim ? (
              <Btn onClick={() => d.setTim('')}>Bỏ ô tìm</Btn>
            ) : (
              'Chọn bộ phận khác, hoặc gán bộ phận ở Hồ sơ nhân viên.'
            )
          }
        />
      </div>
    )
  }

  const th = 'border-r border-b border-[var(--line-faint)]/40 whitespace-nowrap'
  const coLuot = (ng: string) => dong.filter((n) => d.ngayCua(n, ng)?.luot.length).length

  return (
    <div
      className="relative min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]"
      role="region"
      aria-label="Bảng công"
      tabIndex={0}
      onScroll={() => d.o && d.setO(null)}
    >
      <table
        className="text-k-sm table-fixed border-separate border-spacing-0"
        // Dãn đủ khung khi màn rộng hơn (thu menu trái); hẹp hơn thì giữ bề ngang tối thiểu.
        style={{
          width: '100%',
          minWidth: W_TEN + ngays.length * W_O + TONG.length * W_T,
        }}
      >
        <colgroup>
          <col style={{ width: W_TEN }} />
          {ngays.map((n) => (
            <col key={n} style={{ width: W_O }} />
          ))}
          {TONG.map((t) => (
            <col key={t} style={{ width: W_T }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              rowSpan={2}
              className={cn(
                th,
                'sticky top-0 left-0 bg-[var(--surface-raised)] px-1.5 text-left font-semibold',
              )}
              style={{ zIndex: 7 }}
            >
              Mã · Họ tên
            </th>
            {ngays.map((n) => (
              <th
                key={n}
                className={cn(
                  th,
                  'sticky top-0 h-[16px] text-[10px] font-normal text-[var(--ink-3)]',
                  thu(n) === 0
                    ? 'bg-[color-mix(in_srgb,var(--act)_8%,white)]'
                    : 'bg-[var(--surface-raised)]',
                )}
                style={{ zIndex: 6 }}
              >
                {THU[thu(n)]}
              </th>
            ))}
            {TONG.map((t, i) => (
              <th
                key={t}
                rowSpan={2}
                className={cn(
                  th,
                  'sticky top-0 bg-[var(--surface-raised)] px-0.5 text-center text-[11px] leading-tight font-semibold',
                  i === 0 && 'border-l-2 border-l-[var(--line)]',
                )}
                style={{ right: right(i), zIndex: 7, whiteSpace: 'normal' }}
              >
                {t}
              </th>
            ))}
          </tr>
          <tr>
            {ngays.map((n) => (
              <th
                key={n}
                className={cn(
                  th,
                  'sticky top-[16px] h-[20px] border-b-[var(--line)] text-[11px] font-semibold',
                  thu(n) === 0
                    ? 'bg-[color-mix(in_srgb,var(--act)_8%,white)]'
                    : 'bg-[var(--surface-raised)]',
                  n.slice(8) === '01' && 'border-l-2 border-l-[var(--line)]',
                )}
                style={{ zIndex: 6 }}
              >
                {Number(n.slice(8))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dong.map((n, i) => {
            const nhomMoi =
              d.nhom.kieu !== 'bp' && n.boPhan !== (dong[i - 1]?.boPhan ?? null)
            return [
              nhomMoi && (
                <tr key={`g-${n.boPhan}`}>
                  <td
                    colSpan={ngays.length + 1 + TONG.length}
                    className="sticky left-0 border-b border-[var(--line-faint)]/40 bg-[var(--surface-raised)] px-1.5 py-0.5 text-[12px] font-semibold text-[var(--ink-2)]"
                  >
                    {n.boPhan}
                    {n.cachTinh === 'ngay' && (
                      <span className="ml-2 font-normal text-[var(--ink-3)]">
                        · có quẹt = 1 công
                      </span>
                    )}
                  </td>
                </tr>
              ),
              <tr key={n.ma} className="group">
                <td
                  className={cn(
                    th,
                    'sticky left-0 z-[2] h-[24px] overflow-hidden bg-[var(--surface-card)] p-0 group-hover:bg-[var(--surface-hover)]',
                  )}
                  title={`${n.ten} · ${n.boPhan ?? ''}`}
                >
                  {/* Một nút phủ cả ô, tự cắt "…": nút trong `.kit` không cho cắt nửa chừng
                      khi đứng cạnh mã (đo 17/10: tên dài chỉ còn "1043…"). */}
                  <button
                    type="button"
                    className="block h-full w-full truncate px-1.5 text-left hover:text-[var(--act-text)] hover:underline"
                    onClick={() => d.setNguoiMo(n.ma)}
                  >
                    <span className="mr-1 font-mono text-[11px] text-[var(--ink-3)]">
                      {n.ma}
                    </span>
                    {n.ten}
                  </button>
                </td>
                {ngays.map((ng) => (
                  <O
                    key={ng}
                    d={d}
                    ma={n.ma}
                    ten={n.ten}
                    ngay={ng}
                    x={d.ngayCua(n, ng)}
                  />
                ))}
                {[
                  gio(n.tong.tong),
                  so(n.tong.cong, 2),
                  n.tong.thieu ? String(n.tong.thieu) : '',
                ].map((v, i) => (
                  <td
                    key={i}
                    className={cn(
                      th,
                      'num sticky z-[2] bg-[var(--surface-card)] px-1 text-[11px] group-hover:bg-[var(--surface-hover)]',
                      i === 0 && 'border-l-2 border-l-[var(--line)]',
                      i === 1 && 'font-semibold',
                      i === 2 && v && 'font-semibold text-[var(--stop)]',
                    )}
                    style={{ right: right(i) }}
                  >
                    {v}
                  </td>
                ))}
              </tr>,
            ]
          })}
        </tbody>
        <tfoot>
          <tr>
            <td
              className={cn(
                th,
                'sticky bottom-0 left-0 border-t border-t-[var(--line)] bg-[var(--surface-raised)] px-1.5 text-[11px] font-semibold',
              )}
              style={{ zIndex: 7 }}
            >
              Số người có lượt
            </td>
            {ngays.map((ng) => (
              <td
                key={ng}
                className={cn(
                  th,
                  'num sticky bottom-0 border-t border-t-[var(--line)] bg-[var(--surface-raised)] text-[10.5px] font-semibold',
                )}
                style={{ textAlign: 'center', zIndex: 6 }}
              >
                {ng < b.homNay ? coLuot(ng) || '' : ''}
              </td>
            ))}
            {TONG.map((t, i) => {
              const v =
                i === 0
                  ? gio(dong.reduce((s, n) => s + n.tong.tong, 0))
                  : i === 1
                    ? so(
                        dong.reduce((s, n) => s + n.tong.cong, 0),
                        2,
                      )
                    : String(dong.reduce((s, n) => s + n.tong.thieu, 0) || '')
              return (
                <td
                  key={t}
                  className={cn(
                    th,
                    'num sticky bottom-0 border-t border-t-[var(--line)] bg-[var(--surface-raised)] px-1 text-[11px] font-semibold',
                    i === 0 && 'border-l-2 border-l-[var(--line)]',
                  )}
                  style={{ right: right(i), zIndex: 7 }}
                >
                  {v}
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function O({
  d,
  ma,
  ten,
  ngay,
  x,
}: {
  d: GioCongCtx
  ma: string
  ten: string
  ngay: string
  x: NgayGio | undefined
}) {
  const tuongLai = ngay >= d.b.homNay
  const cn0 = thu(ngay) === 0
  const base = cn(
    'relative h-[24px] border-r border-b border-[var(--line-faint)]/40 p-0 text-center font-mono text-[10.5px] font-semibold tracking-tighter',
    cn0 && 'bg-[color-mix(in_srgb,var(--act)_4%,white)]',
    ngay.slice(8) === '01' && 'border-l-2 border-l-[var(--line-faint)]/60',
  )
  if (tuongLai)
    return (
      <td
        className={cn(
          base,
          'bg-[repeating-linear-gradient(135deg,var(--surface-card)_0_4px,var(--surface-raised)_4px_8px)]',
        )}
      />
    )
  if (!x) return <td className={base} />
  const dang = d.o?.ma === ma && d.o.ngay === ngay
  const nhan = x.nghi
    ? KY_NGHI[x.nghi]
    : x.thieu
      ? '?'
      : x.k
        ? congGon(x.tong)
        : x.doDang
          ? '…'
          : ''
  const goiY = x.nghi
    ? `${ten} ${dm(ngay)}: ${TEN_NGHI[x.nghi]}`
    : x.thieu
      ? `${ten} ${dm(ngay)}: chỉ 1 lượt ${x.luot.map(hm).join(' ')} — cần bổ sung`
      : !x.k && x.doDang
        ? `${ten} ${dm(ngay)}: ngày đang dở — mới có ${x.luot.map(hm).join(' ')}, lấy lại dữ liệu sau giờ tan ca`
        : `${ten} ${dm(ngay)}: ${gio(x.tong)} giờ = ${congGon(x.tong)} công · ${x.luot.map(hm).join(' · ')}`
  return (
    <td
      tabIndex={0}
      title={goiY}
      aria-label={goiY}
      className={cn(
        base,
        'cursor-pointer hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-[var(--act-line)]',
        x.nghi
          ? 'bg-[var(--warn-wash)] text-[var(--warn)]'
          : x.thieu
            ? 'bg-[var(--stop-wash)] text-[var(--stop)] shadow-[inset_0_0_0_1px_var(--stop-line)]'
            : x.k && nen(x.tong),
        dang && 'outline outline-2 -outline-offset-2 outline-[var(--act)]',
      )}
      style={{ textAlign: 'center' }}
      onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        d.setO(dang ? null : { ma, ngay, x: r.left, y: r.bottom })
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          d.setO({ ma, ngay, x: r.left, y: r.bottom })
        }
      }}
    >
      {x.xuyenTrua && !x.trua && (
        <span
          aria-hidden
          className="absolute top-0 left-px text-[8px] leading-none text-[var(--warn)]"
        >
          t
        </span>
      )}
      {x.quaDem && (
        <span
          aria-hidden
          className="absolute top-0 right-px text-[8px] leading-none text-[var(--act-text)]"
        >
          đ
        </span>
      )}
      {x.choDuyet > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[2px] border-[1.5px] border-dashed border-[var(--act)]"
        />
      )}
      {x.daSua && !x.choDuyet && (
        <span
          aria-hidden
          className="absolute bottom-0 left-px text-[8px] leading-none text-[var(--act-text)]"
        >
          s
        </span>
      )}
      {nhan}
    </td>
  )
}
