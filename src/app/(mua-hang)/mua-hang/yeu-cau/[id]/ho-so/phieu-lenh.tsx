'use client'

import { Fragment } from 'react'
import Image from 'next/image'
import type { LsxGroup, LsxLine } from '@/modules/dept/production/lsx-lines.repo'
import type { LsxSheetColumn, LsxTemplate } from '@/lib/lsx-template'
import { fmtN, isReady, lineCell, shipText, valueState } from '@/lib/lsx-sheet-cells'
import { cn } from '@/lib/utils'

/**
 * PHIẾU LỆNH bày trên màn Hồ sơ lệnh của Cung ứng (artboard duyệt 05/10/2026).
 *
 * Cột lấy NGUYÊN từ mẫu phiếu của khách (`template.columns`) và giá trị + tín
 * hiệu màu đi qua `lib/lsx-sheet-cells` — cùng một nguồn với phiếu in và file
 * Excel, nên ba chỗ không thể nói khác nhau về một ô. Khác phiếu in ở ba chỗ,
 * đều do màn hình cuộn được còn giấy thì không:
 *   · nhóm (Đơn hàng · Số PO · ngày xuất) thành MỘT DÒNG tiêu đề thay vì gộp ô
 *     dọc suốt nhóm — dòng này dính trái khi cuộn ngang;
 *   · Mã SP và mã khách chung một ô dính trái, tiêu đề dính trên, chân dính dưới;
 *   · cột cả lệnh bỏ trống vẫn hiện, đầu cột ghi "trống cả lệnh" và mờ đi (Q1
 *     chốt: giữ và mờ) — người mua biết Bán hàng chưa khai, không phải màn giấu.
 */
export function PhieuLenh({
  template,
  groups,
  revision,
  imageUrls,
}: {
  template: LsxTemplate
  groups: (LsxGroup & { lines: LsxLine[] })[]
  revision: number
  imageUrls: Record<string, string>
}) {
  // Cột bày theo thứ tự mẫu, bỏ ba cột đã gộp vào đầu bảng (STT · ảnh · nhóm)
  // và hai mã (gộp vào ô Mã SP), ghi chú gộp về cuối cùng với ghi chú quan trọng.
  const cols = template.columns.filter(
    (c) =>
      c.source.kind !== 'stt' &&
      c.source.kind !== 'image' &&
      c.source.kind !== 'group' &&
      !(
        c.source.kind === 'line' &&
        ['product_code', 'customer_item_code', 'note', 'important_note'].includes(
          c.source.field,
        )
      ),
  )
  const lines = groups.flatMap((g) => g.lines)
  const trong = new Set(
    cols.filter((c) => lines.every((l) => !lineCell(c, l))).map((c) => c.label),
  )
  const qtyIdx = cols.findIndex(
    (c) => c.source.kind === 'line' && c.source.field === 'qty',
  )
  const tongSl = lines.reduce((a, l) => a + l.qty, 0)
  const tongCbm = lines.reduce((a, l) => a + (l.cbm ? l.cbm * l.qty : 0), 0)
  const soCot = cols.length + 4
  // STT chạy suốt lệnh, tính trước theo nhóm (react-hooks/immutability cấm cộng dồn trong render).
  const dauNhom = groups.map((_, i) =>
    groups.slice(0, i).reduce((a, g) => a + g.lines.length, 0),
  )

  return (
    <div className="max-h-[560px] overflow-auto border-b border-[var(--line)]">
      <table className="text-k-body min-w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <Th className="w-9 text-right">STT</Th>
            <Th className="w-12">Ảnh</Th>
            <Th sticky className="min-w-[120px]">
              Mã SP
              <Phu>mã khách</Phu>
            </Th>
            {cols.map((c) => (
              <Th
                key={c.label}
                className={cn(
                  rong(c) && 'min-w-[170px]',
                  laSpec(c) && 'min-w-[110px]',
                  laSo(c) && 'text-right',
                  trong.has(c.label) && 'text-[var(--ink-3)]',
                )}
                title={trong.has(c.label) ? 'Cả lệnh không khai cột này' : undefined}
              >
                {nhan(c)}
                {trong.has(c.label) && <Phu>trống cả lệnh</Phu>}
              </Th>
            ))}
            <Th className="min-w-[180px]">Ghi chú</Th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) => {
            const slNhom = g.lines.reduce((a, l) => a + l.qty, 0)
            const coDongNhom = groups.length > 1 || !!g.po_no
            return (
              <Fragment key={g.id ?? gi}>
                {coDongNhom && (
                  <tr>
                    <td
                      colSpan={soCot}
                      className="sticky left-0 border-b border-[var(--act-line)] bg-[var(--act-wash)] px-2 py-1"
                    >
                      <b>{g.title || g.buyer_name || `Nhóm ${gi + 1}`}</b>
                      {g.po_no ? (
                        <>
                          {' · '}
                          <span className="font-mono">PO {g.po_no}</span>
                        </>
                      ) : (
                        <span className="text-[var(--warn)]"> · chưa có số PO</span>
                      )}
                      {shipText(g) && (
                        <>
                          {' · xuất '}
                          <span className="font-mono">{shipText(g)}</span>
                        </>
                      )}
                      {g.note && ` · ${g.note}`}
                      <span className="text-[var(--ink-3)]">
                        {' '}
                        · {g.lines.length} dòng · {fmtN(slNhom)} cái
                      </span>
                    </td>
                  </tr>
                )}
                {g.lines.map((l, li) => {
                  const stt = dauNhom[gi] + li + 1
                  const src = l.image_file_id ? imageUrls[l.image_file_id] : null
                  const doi = l.changed_in_rev != null && l.changed_in_rev === revision
                  const nenDong = doi
                    ? 'bg-[var(--rev-wash)]'
                    : 'bg-[var(--surface-card)]'
                  return (
                    <tr key={l.id}>
                      <Td className={cn('text-right font-mono', nenDong)}>{stt}</Td>
                      <Td className={nenDong}>
                        {src ? (
                          <Image
                            src={src}
                            alt=""
                            width={36}
                            height={36}
                            className="h-9 w-9 rounded-[3px] border border-[var(--line)] object-cover"
                          />
                        ) : (
                          <span className="text-k-label flex h-9 w-9 items-center justify-center rounded-[3px] border border-dashed border-[var(--line)] text-[var(--ink-3)]">
                            chưa
                          </span>
                        )}
                      </Td>
                      <Td
                        className={cn(
                          'sticky left-0 z-[1] shadow-[1px_0_0_var(--line)]',
                          nenDong,
                          isReady(l) && 'bg-[var(--done-wash)]',
                        )}
                      >
                        <span className="font-mono">{l.product_code}</span>
                        {l.customer_item_code &&
                          l.customer_item_code !== l.product_code && (
                            <Phu mono>{l.customer_item_code}</Phu>
                          )}
                      </Td>
                      {cols.map((c) => {
                        const v = lineCell(c, l)
                        const st = valueState(v, c.source.kind === 'check')
                        return (
                          <Td
                            key={c.label}
                            className={cn(
                              nenDong,
                              (rong(c) || laSpec(c)) && 'max-w-[240px] whitespace-normal',
                              laSo(c) && 'text-right font-mono tabular-nums',
                              st === 'pending' &&
                                'bg-[var(--warn-wash)] text-[var(--warn)]',
                              st === 'missing' && 'font-semibold text-[var(--stop)]',
                            )}
                          >
                            {/* "Dây dù màu kem\n\nHK-PP6 kem" — gộp dòng trống để ô không cao gấp đôi */}
                            {v.split(/\n+/).map((d, i) => (
                              <Fragment key={i}>
                                {i > 0 && <br />}
                                {d}
                              </Fragment>
                            ))}
                          </Td>
                        )
                      })}
                      <Td className={cn('max-w-[260px] whitespace-normal', nenDong)}>
                        {l.important_note && (
                          <span className="block font-semibold text-[var(--stop)]">
                            {l.important_note}
                          </span>
                        )}
                        {l.note && (
                          <span
                            className={
                              valueState(l.note, false) === 'pending'
                                ? 'text-[var(--warn)]'
                                : undefined
                            }
                          >
                            {l.note}
                          </span>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td
              colSpan={3 + Math.max(qtyIdx, 0)}
              className="sticky bottom-0 border-t-2 border-[var(--line)] bg-[var(--surface-raised)] px-2 py-1"
            >
              Cộng {lines.length} mã · {groups.length} nhóm
            </td>
            <td className="sticky bottom-0 border-t-2 border-[var(--line)] bg-[var(--surface-raised)] px-2 py-1 text-right font-mono tabular-nums">
              {fmtN(tongSl)}
            </td>
            <td
              colSpan={cols.length - qtyIdx}
              className="sticky bottom-0 border-t-2 border-[var(--line)] bg-[var(--surface-raised)] px-2 py-1 font-normal text-[var(--ink-3)]"
            >
              {/* Chân bảng nói tổng gồm gì — luật 6 */}
              tổng CBM {tongCbm ? fmtN(tongCbm) : '— (lệnh chưa khai CBM)'} · tổng SL cộng
              mọi ĐVT, không trừ dòng chưa chốt
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

const nhan = (c: LsxSheetColumn) => c.label.replace(/\n[\s\S]*/, '')
const laSpec = (c: LsxSheetColumn) =>
  c.source.kind === 'spec' || c.source.kind === 'check' || c.source.kind === 'extra'
const laSo = (c: LsxSheetColumn) =>
  c.source.kind === 'total_cbm' ||
  (c.source.kind === 'line' && (c.source.field === 'qty' || c.source.field === 'cbm'))
const rong = (c: LsxSheetColumn) =>
  c.source.kind === 'line' &&
  (c.source.field === 'name_foreign' ||
    c.source.field === 'name_vi' ||
    c.source.field === 'name_customs' ||
    c.source.field === 'packing')

function Th({
  children,
  className,
  sticky,
  title,
}: {
  children: React.ReactNode
  className?: string
  sticky?: boolean
  title?: string
}) {
  return (
    <th
      title={title}
      className={cn(
        'text-k-label sticky top-0 z-[2] border-r border-b border-[var(--line)] bg-[var(--surface-raised)] px-2 py-1 text-left font-semibold tracking-[.04em] whitespace-nowrap text-[var(--ink-2)] uppercase',
        sticky && 'left-0 z-[4] shadow-[1px_0_0_var(--line)]',
        className,
      )}
    >
      {children}
    </th>
  )
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td
      className={cn(
        'border-r border-b border-[var(--line)] px-2 py-1 align-top whitespace-nowrap',
        className,
      )}
    >
      {children}
    </td>
  )
}

function Phu({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span
      className={cn(
        'text-k-label block font-normal tracking-normal text-[var(--ink-3)] normal-case',
        mono && 'font-mono',
      )}
    >
      {children}
    </span>
  )
}
