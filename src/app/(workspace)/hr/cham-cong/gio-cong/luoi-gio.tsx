'use client'

import Link from 'next/link'
import { Btn, Empty } from '@/components/kit'
import { cn } from '@/lib/utils'
import { KY_NGHI, TEN_NGHI } from '@/lib/cham-cong/dieu-chinh'
import type { CongNgay } from '@/lib/cham-cong/chi-tiet-cong'
import type { GioCongCtx } from './useGioCong'
import { THU, dm, hm, ngayKy, so, thu, type NgayGio } from './gio-cong.shared'

/**
 * LƯỚI CÔNG — người × ngày của kỳ (26 → 25). Ô CHỈ nói trạng thái ngày đó (user 20/10/2026:
 * "các ô chỉ cần hiển thị trạng thái làm việc ngày hôm đó, muốn xem công thì nhấn vào"):
 * ✓ đủ 8 giờ hành chính · ✓ cam có làm mà chưa đủ · ? thiếu lượt · V vắng · P/Ô/R/CT/KL
 * nghỉ có lý do · L lễ. Số giờ, công, tăng ca nằm trong khung nổi khi bấm ô (`o-gio.tsx`).
 * Tên ghim trái, 4 cột tổng ghim phải. Kit không có ma trận người × ngày có ô bấm mở khung
 * nổi, nên viết thẳng (CLAUDE.md 06/10).
 */

const W_TEN = 140
const W_O = 24
const W_T = 44
const TONG = ['Công', 'TC giờ', 'Thiếu lượt', 'Vắng'] as const

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
  const p1 = b.phutMotCong
  const diLam = (ng: string) =>
    dong.filter((n) => d.congCua(n.ma)?.ngay.get(ng)?.tinhDuoc).length
  /** Bốn số tổng của một người — cùng `tongCong` với trang một người và ngăn Tổng hợp. */
  const tongCua = (ma: string) => {
    const t = d.congCua(ma)?.tong
    if (!t) return { cong: 0, tc: 0, thieu: 0, vang: 0 }
    return {
      cong: (t.hcThuong + t.hcCn + t.hcLe) / p1,
      tc: (t.tc1 + t.tc2 + t.tc3) / 60,
      thieu: t.thieu,
      vang: t.vang,
    }
  }

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
                  <Link
                    href={`/hr/cham-cong/nguoi/${encodeURIComponent(n.ma)}?thang=${b.thang}`}
                    className="block h-full w-full truncate px-1.5 leading-[24px] text-left hover:text-[var(--act-text)] hover:underline"
                    title={`Mở chấm công từng ngày của ${n.ten}`}
                  >
                    <span className="mr-1 font-mono text-[11px] text-[var(--ink-3)]">
                      {n.ma}
                    </span>
                    {n.ten}
                  </Link>
                </td>
                {ngays.map((ng) => (
                  <O
                    key={ng}
                    d={d}
                    ma={n.ma}
                    ten={n.ten}
                    ngay={ng}
                    x={d.ngayCua(n, ng)}
                    c={d.congCua(n.ma)?.ngay.get(ng)}
                  />
                ))}
                {(() => {
                  const t = tongCua(n.ma)
                  return [
                    t.cong ? so(t.cong, 2) : '',
                    t.tc ? so(t.tc, 1) : '',
                    t.thieu ? String(t.thieu) : '',
                    t.vang ? String(t.vang) : '',
                  ]
                })().map((v, i) => (
                  <td
                    key={i}
                    className={cn(
                      th,
                      'num sticky z-[2] bg-[var(--surface-card)] px-1 text-[11px] group-hover:bg-[var(--surface-hover)]',
                      i === 0 && 'border-l-2 border-l-[var(--line)] font-semibold',
                      i === 1 && 'text-[var(--grp-1-ink)]',
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
              Số người đi làm
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
                {ng < b.homNay ? diLam(ng) || '' : ''}
              </td>
            ))}
            {TONG.map((t, i) => {
              const ts = dong.map((n) => tongCua(n.ma))
              const cong = (f: (x: (typeof ts)[number]) => number) =>
                ts.reduce((s, x) => s + f(x), 0)
              const v =
                i === 0
                  ? so(cong((x) => x.cong), 2)
                  : i === 1
                    ? so(cong((x) => x.tc), 1)
                    : i === 2
                      ? String(cong((x) => x.thieu) || '')
                      : String(cong((x) => x.vang) || '')
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
  c,
}: {
  d: GioCongCtx
  ma: string
  ten: string
  ngay: string
  x: NgayGio | undefined
  c: CongNgay | undefined
}) {
  const tuongLai = ngay >= d.b.homNay
  const le = d.b.le[ngay]
  const cn0 = thu(ngay) === 0
  const base = cn(
    'relative h-[24px] border-r border-b border-[var(--line-faint)]/40 p-0 text-center font-mono text-[12px] font-bold',
    le
      ? 'bg-[var(--warn-wash)]'
      : cn0 && 'bg-[color-mix(in_srgb,var(--act)_6%,white)]',
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
  if (!x) {
    // Không quẹt, không điều chỉnh: lễ → L; chủ nhật → trống; ngày thường đã lấy dữ liệu → V.
    const nhan = le ? 'L' : !cn0 && d.daLay(ngay) ? 'V' : ''
    return (
      <td
        className={cn(base, le ? 'text-[var(--warn)]' : 'text-[var(--stop)]')}
        style={{ textAlign: 'center' }}
        title={
          le
            ? `${dm(ngay)}: ${le}`
            : nhan
              ? `${ten} ${dm(ngay)}: không quẹt (vắng)`
              : undefined
        }
      >
        {nhan}
      </td>
    )
  }
  const dang = d.o?.ma === ma && d.o.ngay === ngay
  const du = !!c?.tinhDuoc && c.hc >= d.b.phutMotCong
  const nhan = x.nghi
    ? KY_NGHI[x.nghi]
    : x.thieu
      ? '?'
      : c?.tinhDuoc
        ? '✓'
        : x.doDang
          ? '…'
          : ''
  const goiY = x.nghi
    ? `${ten} ${dm(ngay)}: ${TEN_NGHI[x.nghi]}`
    : x.thieu
      ? `${ten} ${dm(ngay)}: chỉ 1 lượt ${x.luot.map(hm).join(' ')} — cần bổ sung`
      : !x.k && x.doDang
        ? `${ten} ${dm(ngay)}: ngày đang dở — mới có ${x.luot.map(hm).join(' ')}`
        : `${ten} ${dm(ngay)}: ${du ? 'đủ công' : 'có làm, chưa đủ 8 giờ'} — bấm để xem giờ`
  return (
    <td
      tabIndex={0}
      title={goiY}
      aria-label={goiY}
      className={cn(
        base,
        'cursor-pointer hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-[var(--act-line)]',
        x.nghi
          ? 'bg-[var(--warn-wash)] text-[11px] text-[var(--warn)]'
          : x.thieu
            ? 'bg-[var(--stop-wash)] text-[var(--stop)] shadow-[inset_0_0_0_1px_var(--stop-line)]'
            : du
              ? 'text-[var(--done)]'
              : 'text-[var(--warn)]',
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
      {/* Điều chỉnh đang chờ duyệt: viền nét đứt — trạng thái của ô, không phải chữ thêm. */}
      {x.choDuyet > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[2px] border-[1.5px] border-dashed border-[var(--act)]"
        />
      )}
      {nhan}
    </td>
  )
}
