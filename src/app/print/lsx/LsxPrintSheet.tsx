import { Fragment } from 'react'
import type { LsxSheetColumn, LsxTemplate } from '@/modules/dept/sales/lsx-template'
import type { LsxGroup, LsxLine } from '@/modules/dept/production/lsx-lines.repo'
import {
  PrintLetterhead,
  PrintPage,
  PrintSignatures,
  PrintTitle,
  type PrintCompany,
} from '../PrintSheet'

/**
 * Phiếu LỆNH SẢN XUẤT — bày ĐÚNG như file Excel của Sales (docs/lsx-redesign.md).
 *
 * Bảng dựng theo `template.columns`: mỗi khách một trật tự cột riêng, cột trống
 * vẫn in (file thật giữ cả cột Kính rỗng). Nhóm dòng theo đúng kiểu của từng file:
 *
 *   · `group_mode: 'columns'` (ROSCO) — STT/KHÁCH HÀNG/SỐ PO/THỜI GIAN GIAO
 *     HÀNG/GHI CHÚ nằm ở cột riêng, GỘP Ô suốt các dòng của nhóm (rowSpan),
 *     khép nhóm bằng dòng "Total Cube:". STT đếm theo NHÓM.
 *   · `group_mode: 'title_row'` (LAURA) — một dòng chữ tên bộ sưu tập ở cột thứ
 *     hai, STT đánh lại từ 1 trong mỗi nhóm.
 *   · `group_mode: 'none'` (MERXX/YOTRIO) — bảng phẳng, khép bằng dòng "Tổng".
 *
 * Thứ DUY NHẤT app thêm so với Excel: bản chỉnh sửa (revision > 1) tô vàng dòng
 * vừa đổi và gắn ▲ trước STT — Excel không nói được dòng nào đã sửa.
 */

export type LsxSheetHeader = {
  customer_name: string
  code: string
  issued_at: string | null
  received_date: string | null
  completed_at: string | null
  container_summary: string | null
  note: string | null
  revision: number
  revised_at: string | null
}

export type LsxSheetGroup = Pick<
  LsxGroup,
  'id' | 'title' | 'buyer_name' | 'po_no' | 'ship_date' | 'ship_label' | 'note'
> & { lines: LsxLine[] }

const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '')
const fmtN = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })
const td = 'border border-black px-1 py-0.5 align-top'

/** Đợt xuất in ra: ưu tiên đúng chữ Sales gõ ("w37.26"), không có thì ngày. */
const shipText = (x: { ship_label: string | null; ship_date: string | null }) =>
  x.ship_label?.trim() || (x.ship_date ? fmtD(x.ship_date) : '')

const alignCls = (c: LsxSheetColumn) =>
  c.align === 'left' ? 'text-left' : c.align === 'right' ? 'text-right' : 'text-center'

/** Giá trị một ô của DÒNG (cột nhóm xử lý riêng vì phải gộp ô). */
function lineCell(col: LsxSheetColumn, l: LsxLine): string {
  const src = col.source
  switch (src.kind) {
    case 'image':
      return '' // ảnh render riêng, không phải text
    case 'line':
      switch (src.field) {
        case 'qty':
          return fmtN(l.qty)
        case 'cbm':
          return l.cbm ? fmtN(l.cbm) : ''
        case 'ship':
          return shipText(l)
        default:
          return (l[src.field] as string | null) ?? ''
      }
    case 'total_cbm':
      return l.cbm ? fmtN(l.cbm * l.qty) : ''
    case 'spec':
      return l.specs[src.key] ?? ''
    case 'check':
      return l.checks[src.key] ?? ''
    case 'extra':
      return l.extras[src.key] ?? ''
    default:
      return ''
  }
}

function groupCell(col: LsxSheetColumn, g: LsxSheetGroup): string {
  if (col.source.kind !== 'group') return ''
  switch (col.source.field) {
    case 'ship':
      return shipText(g)
    case 'title':
      return g.title ?? ''
    default:
      return (g[col.source.field] as string | null) ?? ''
  }
}

export function LsxPrintSheet({
  company,
  header,
  template,
  groups,
  imageUrls,
  watermark,
}: {
  company: PrintCompany & Record<string, string | null>
  header: LsxSheetHeader
  template: LsxTemplate
  groups: LsxSheetGroup[]
  imageUrls: Map<string, string>
  /** vd "BẢN XEM TRƯỚC — LỆNH CHƯA PHÁT". null = bản chính thức. */
  watermark?: string | null
}) {
  const cols = template.columns
  const lines = groups.flatMap((g) => g.lines)
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const isRevision = header.revision > 1
  const bands = cols.some((c) => c.band)
  const qtyIdx = cols.findIndex(
    (c) => c.source.kind === 'line' && c.source.field === 'qty',
  )
  const cubeIdx = cols.findIndex((c) => c.source.kind === 'total_cbm')

  return (
    <PrintPage maxWidth="max-w-[1400px]">
      {watermark && (
        <div className="mb-3 border-2 border-dashed border-red-500 bg-red-50 py-1.5 text-center text-sm font-bold tracking-widest text-red-600 uppercase">
          {watermark}
        </div>
      )}

      <PrintLetterhead company={company} date={new Date()} />
      <PrintTitle
        vi="LỆNH SẢN XUẤT"
        en={
          isRevision
            ? `CHỈNH SỬA LẦN ${header.revision} — NGÀY ${fmtD(header.revised_at)}`
            : undefined
        }
      />

      <div className="mt-2 flex items-start justify-between gap-4 text-[12px]">
        <div>
          <div>
            Tên khách hàng: <b>{header.customer_name}</b>
          </div>
          <div>Ngày phát hành: {fmtD(header.issued_at)}</div>
          {header.received_date && <div>Ngày nhận đơn: {fmtD(header.received_date)}</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[13px] font-bold">SỐ {header.code}</div>
          {header.container_summary && <div>Cont: {header.container_summary}</div>}
          {header.completed_at && <div>Hoàn thành: {fmtD(header.completed_at)}</div>}
        </div>
      </div>

      <p className="mt-2 text-[12px]">
        Phòng kế hoạch yêu cầu các tổ trưởng và các bộ phận liên quan thực hiện đơn hàng
        với các điều kiện sau:
      </p>

      <table className="mt-1 w-full border-collapse text-center text-[11px]">
        <thead className="print:table-header-group">
          {/* Tiêu đề hai tầng khi mẫu có cột gộp (YOTRIO). */}
          <tr className="bg-zinc-100 font-semibold print:bg-zinc-100">
            {cols.map((c, i) => {
              if (!c.band) {
                return (
                  <td
                    key={i}
                    className={`${td} whitespace-pre-line`}
                    rowSpan={bands ? 2 : undefined}
                  >
                    {c.label}
                  </td>
                )
              }
              // Chỉ vẽ ô band ở cột ĐẦU của dải cùng band.
              if (i > 0 && cols[i - 1]?.band === c.band) return null
              const span = cols.filter((x) => x.band === c.band).length
              return (
                <td key={i} className={td} colSpan={span}>
                  {c.band}
                </td>
              )
            })}
          </tr>
          {bands && (
            <tr className="bg-zinc-100 font-semibold print:bg-zinc-100">
              {cols
                .filter((c) => c.band)
                .map((c, i) => (
                  <td key={i} className={td}>
                    {c.label}
                  </td>
                ))}
            </tr>
          )}
        </thead>

        <tbody>
          {groups.map((g, gi) => {
            const gCbm = g.lines.reduce((s, l) => s + (l.cbm ?? 0) * l.qty, 0)
            // Cột nhóm gộp ô suốt các dòng + dòng "Total Cube" khép nhóm.
            const span = g.lines.length + (template.group_total ? 1 : 0)
            return (
              <Fragment key={g.id}>
                {template.group_mode === 'title_row' && g.title && (
                  <tr>
                    <td className={td} />
                    <td
                      className={`${td} text-left font-semibold`}
                      colSpan={cols.length - 1}
                    >
                      {g.title}
                    </td>
                  </tr>
                )}

                {g.lines.map((l, li) => {
                  const changed = isRevision && l.changed_in_rev === header.revision
                  return (
                    <tr
                      key={l.id}
                      className={changed ? 'bg-amber-100 print:bg-amber-100' : undefined}
                    >
                      {cols.map((c, ci) => {
                        // Cột NHÓM (gồm cả STT khi đếm theo nhóm): chỉ vẽ ở dòng
                        // đầu, gộp ô xuống hết nhóm — y như merged cell của Excel.
                        const isGroupCol =
                          c.source.kind === 'group' ||
                          (c.source.kind === 'stt' && template.stt_mode === 'group')
                        if (isGroupCol && template.group_mode === 'columns') {
                          if (li > 0) return null
                          return (
                            <td
                              key={ci}
                              className={`${td} ${alignCls(c)} whitespace-pre-wrap`}
                              rowSpan={span}
                            >
                              {c.source.kind === 'stt' ? gi + 1 : groupCell(c, g)}
                            </td>
                          )
                        }
                        if (c.source.kind === 'group') {
                          return (
                            <td key={ci} className={`${td} ${alignCls(c)}`}>
                              {li === 0 ? groupCell(c, g) : ''}
                            </td>
                          )
                        }
                        if (c.source.kind === 'stt') {
                          return (
                            <td key={ci} className={td}>
                              {changed && (
                                <span className="font-bold text-amber-700">▲ </span>
                              )}
                              {li + 1}
                            </td>
                          )
                        }
                        if (c.source.kind === 'image') {
                          const url = l.image_file_id
                            ? imageUrls.get(l.image_file_id)
                            : undefined
                          return (
                            <td key={ci} className={td}>
                              {url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={url}
                                  alt={l.name_vi ?? l.product_code}
                                  className="mx-auto h-12 w-16 object-contain"
                                />
                              ) : null}
                            </td>
                          )
                        }
                        const mono =
                          c.source.kind === 'line' &&
                          (c.source.field === 'product_code' ||
                            c.source.field === 'barcode')
                        return (
                          <td
                            key={ci}
                            className={`${td} ${alignCls(c)} whitespace-pre-wrap ${
                              mono ? 'font-mono' : ''
                            } ${
                              c.source.kind === 'line' && c.source.field === 'qty'
                                ? 'font-semibold'
                                : ''
                            }`}
                          >
                            {lineCell(c, l)}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}

                {/* "Total Cube:" — ROSCO khép mỗi PO bằng tổng khối. */}
                {template.group_total === 'cube' && (
                  <tr className="font-semibold">
                    {cols.map((c, ci) => {
                      const isGroupCol =
                        c.source.kind === 'group' ||
                        (c.source.kind === 'stt' && template.stt_mode === 'group')
                      if (isGroupCol && template.group_mode === 'columns') return null
                      if (ci === qtyIdx)
                        return (
                          <td key={ci} className={`${td} text-right`}>
                            Total Cube:
                          </td>
                        )
                      if (ci === cubeIdx)
                        return (
                          <td key={ci} className={`${td} text-right`}>
                            {fmtN(gCbm)}
                          </td>
                        )
                      return <td key={ci} className={td} />
                    })}
                  </tr>
                )}
              </Fragment>
            )
          })}

          {/* "Tổng" — LAURA/MERXX khép phiếu bằng tổng số lượng. */}
          {template.grand_total === 'qty' && (
            <tr className="font-bold">
              {cols.map((c, ci) => {
                if (ci === 1)
                  return (
                    <td key={ci} className={`${td} text-left`}>
                      Tổng
                    </td>
                  )
                if (ci === qtyIdx)
                  return (
                    <td key={ci} className={`${td} text-right`}>
                      {fmtN(totalQty)}
                    </td>
                  )
                return <td key={ci} className={td} />
              })}
            </tr>
          )}
        </tbody>
      </table>

      {header.note && (
        <div className="mt-2 text-[12px]">
          <b>Ghi chú lệnh:</b> <span className="whitespace-pre-wrap">{header.note}</span>
        </div>
      )}

      {template.notes_footer && (
        <div className="mt-3 text-[12px]">
          <div className="font-bold">MỘT SỐ LƯU Ý CHUNG:</div>
          <div className="whitespace-pre-wrap">{template.notes_footer}</div>
        </div>
      )}

      <div className="mt-3 text-[12px]">
        <div className="font-semibold">Nơi nhận:</div>
        <div>- Quản lý sản xuất</div>
        <div>- Các tổ trưởng, trưởng bộ phận</div>
        <div>- Kho vật tư, nguyên liệu</div>
      </div>

      <PrintSignatures
        cols={[
          { role: 'Người lập' },
          { role: 'Trưởng phòng kế hoạch' },
          { role: 'Giám Đốc' },
        ]}
      />
    </PrintPage>
  )
}
