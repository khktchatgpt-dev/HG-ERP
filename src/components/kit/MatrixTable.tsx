'use client'

import { Fragment, useCallback, useRef, useState, type ReactNode } from 'react'
import { useColSpanGuard, useStickyPadding } from './Table'
import { footRuns, type KitCol } from './TableEngine'
import { cn } from '@/lib/utils'

/**
 * ═══════════════════════════════════════════════════════════════════════
 * BẢNG CHÉO (B6, 24/09/2026) — docs/thong-ke-thiet-ke-tu-excel.md §4.1, §8
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Vì sao cần một bảng riêng. `BC_CONG_DOAN` của file Excel gói TOÀN BỘ tình
 * hình một lệnh trong 2 dòng: mỗi dòng một SP, mỗi công đoạn một cột. Màn cũ
 * bày cùng dữ liệu đó thành danh sách PHẲNG (SP × công đoạn) — 14 dòng, và muốn
 * so "Sơn của SP A với Sơn của SP B" thì phải lướt qua 7 dòng xen giữa. Mắt
 * người so theo CỘT rất nhanh, so hai dòng cách xa thì không.
 *
 * `Table` không chứa nổi: nó chỉ có một tầng tiêu đề và ghim đúng một cột.
 * Bảng chéo cần TIÊU ĐỀ HAI TẦNG (nhóm → cột con), ghim NHIỀU cột trái (mã SP,
 * tên, SL) và cuộn ngang qua phần còn lại.
 *
 * Dùng chung với máy bảng: cột khai bằng `KitCol` (cùng kiểu với `useKitTable`),
 * chân bảng chia dải bằng `footRuns` — nên chân bảng KHÔNG lệch cột được, và
 * đệm cuộn (T6) dùng chung `useStickyPadding` với `Table`.
 */

/**
 * Ô NGOÀI LỘ TRÌNH — trả giá trị này từ `cell` khi dòng không đi qua cột đó.
 *
 * Ba kiểu ô trống PHẢI phân biệt được (luật số 1 của T2): `–` ngoài lộ trình
 * (nền sọc) · `0` có trong lộ trình mà chưa làm · `(300)` thiếu. Gộp chúng là
 * nói dối bằng khoảng trắng: ô trắng đọc ra "chưa ai làm" trong khi thật ra SP
 * này không bao giờ đi qua công đoạn đó.
 */
export const NGOAI_LO_TRINH = Symbol('ngoai-lo-trinh')

export type MatrixCol<T> = Omit<KitCol<T>, 'cell' | 'sort'> & {
  cell: (row: T) => ReactNode | typeof NGOAI_LO_TRINH
  /**
   * `false` = ô KHÔNG bấm được dù bảng có `onCell` (cột kết luận, tổng). Ô
   * trông như nút mà bấm không dẫn đi đâu là nút giả.
   */
  pick?: boolean
}
export type MatrixGroup<T> = { id: string; header: ReactNode; cols: MatrixCol<T>[] }

export function MatrixTable<T>({
  rows,
  rowKey,
  pinned,
  groups,
  label,
  onCell,
  foot,
  maxHeight = 420,
}: {
  /** Mỗi dòng một đối tượng (thường một SP của lệnh). Bảng không tự vẽ trạng thái rỗng — rỗng thì màn bày `Empty`. */
  rows: T[]
  /** Khoá ổn định của dòng (id, không phải chỉ số) — làm `key` của React. */
  rowKey: (row: T) => string
  /**
   * Cột GHIM TRÁI — bắt buộc `width`: vị trí dính của cột thứ n là tổng bề
   * rộng các cột trước nó, không đo được trước khi vẽ.
   */
  pinned: (MatrixCol<T> & { width: number })[]
  /** Các nhóm cột cuộn ngang. Nhóm một cột thì tiêu đề nhóm vẫn là tầng trên. */
  groups: MatrixGroup<T>[]
  /** Tên bảng cho trình đọc màn hình. */
  label: string
  /**
   * Bấm vào một ô → đi tới chỗ xử lý (luật số 3 của T2): bảng chỉ báo tin xấu
   * mà không chỉ chỗ thì không ai sửa được gì. Có hàm này thì ô là NÚT thật.
   */
  onCell?: (row: T, colId: string) => void
  /** Chân bảng — nhãn dải đầu, câu "tổng KHÔNG gồm gì" ở dải cuối. */
  foot?: { label: ReactNode; note?: ReactNode }
  /**
   * Trần chiều cao vùng cuộn, px. Quá trần thì bảng tự cuộn dọc, tiêu đề hai
   * tầng và chân vẫn dính. Bảng chéo thường nằm trong một khối, không nuốt cả màn.
   */
  maxHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [, setEl] = useState<HTMLDivElement | null>(null)
  const gan = useCallback((el: HTMLDivElement | null) => {
    ref.current = el
    setEl(el)
  }, [])
  useColSpanGuard(ref, 'MatrixTable')
  useStickyPadding(ref)

  const left: number[] = []
  pinned.reduce((acc, c, i) => ((left[i] = acc), acc + c.width), 0)
  const allCols = [...pinned, ...groups.flatMap((g) => g.cols)]
  // Tiêu đề tầng 2 dính ở ĐÚNG dưới tầng 1: chiều cao tầng 1 cố định bằng token
  // để khỏi phải đo (đo thì lượt vẽ đầu lệch một nhịp).
  const H1 = 'var(--k-mx-h1, 26px)'

  return (
    <div
      ref={gan}
      className="k-tscroll min-w-0 overflow-auto bg-[var(--surface-card)]"
      style={{ maxHeight }}
    >
      <table
        aria-label={label}
        className="k-mx text-k-sm w-max min-w-full border-separate border-spacing-0"
      >
        <thead>
          <tr>
            {pinned.map((c, i) => (
              <th
                key={c.id}
                rowSpan={2}
                scope="col"
                data-pin-last={i === pinned.length - 1 ? '' : undefined}
                className="k-mx-th k-mx-pin"
                style={{
                  left: left[i],
                  width: c.width,
                  minWidth: c.width,
                  textAlign: c.num ? 'right' : undefined,
                }}
              >
                {c.header}
              </th>
            ))}
            {groups.map((g) => (
              <th
                key={g.id}
                colSpan={g.cols.length}
                scope="colgroup"
                className="k-mx-th k-mx-grp"
                style={{ height: H1 }}
              >
                {g.header}
              </th>
            ))}
          </tr>
          <tr>
            {groups.map((g) =>
              g.cols.map((c) => (
                <th
                  key={`${g.id}:${c.id}`}
                  scope="col"
                  className="k-mx-th"
                  style={{
                    top: H1,
                    minWidth: c.width,
                    textAlign: c.num ? 'right' : undefined,
                  }}
                >
                  {c.header}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="group">
              {pinned.map((c, i) => {
                const v = c.cell(r)
                const Tag = i === 0 ? 'th' : 'td'
                return (
                  <Tag
                    key={c.id}
                    // Ô ghim đầu là TIÊU ĐỀ DÒNG: trình đọc màn hình đọc "FDA50089N,
                    // Sơn: 250 bộ" thay vì một con số mồ côi.
                    scope={i === 0 ? 'row' : undefined}
                    data-pin-last={i === pinned.length - 1 ? '' : undefined}
                    className={cn('k-mx-td k-mx-pin', c.num && 'num', c.muted && 'text-[var(--ink-3)]')} // prettier-ignore
                    style={{ left: left[i], width: c.width, minWidth: c.width }}
                    title={c.title?.(r)}
                  >
                    {v === NGOAI_LO_TRINH ? '' : v}
                  </Tag>
                )
              })}
              {groups.map((g) =>
                g.cols.map((c) => {
                  const v = c.cell(r)
                  if (v === NGOAI_LO_TRINH)
                    return (
                      <td key={`${g.id}:${c.id}`} className="k-mx-td k-mx-off">
                        <span aria-hidden>–</span>
                        <span className="sr-only">ngoài lộ trình</span>
                      </td>
                    )
                  return (
                    <td
                      key={`${g.id}:${c.id}`}
                      className={cn('k-mx-td', c.num && 'num text-right')}
                      title={c.title?.(r)}
                    >
                      {onCell && c.pick !== false ? (
                        <button
                          type="button"
                          className="k-mx-btn"
                          onClick={() => onCell(r, c.id)}
                        >
                          {v}
                        </button>
                      ) : (
                        v
                      )}
                    </td>
                  )
                }),
              )}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr>
              {footRuns(allCols as KitCol<T>[], foot).map((f, i) => {
                // Ô chân nằm dưới cột ghim thì cũng ghim — kéo ngang không mất nhãn.
                let start = 0
                for (const x of footRuns(allCols as KitCol<T>[], foot).slice(0, i)) start += x.span // prettier-ignore
                const ghim = start < pinned.length
                return (
                  <Fragment key={f.key}>
                    <td
                      colSpan={f.span > 1 ? f.span : undefined}
                      className={cn(
                        'k-mx-tf',
                        ghim && 'k-mx-pin',
                        f.num && 'num text-right',
                        !f.own && i > 0 && 'text-k-sm font-normal text-[var(--ink-3)]',
                      )}
                      style={ghim ? { left: left[start] } : undefined}
                    >
                      {f.node}
                    </td>
                  </Fragment>
                )
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
