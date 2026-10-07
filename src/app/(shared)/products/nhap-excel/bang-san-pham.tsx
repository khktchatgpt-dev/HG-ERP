'use client'

import Image from 'next/image'
import { Cell, Empty, Row, Tag, TFoot, THead, Table } from '@/components/kit'
import { COLUMN_BY_KEY, FILLABLE_COLUMNS, type CellChange } from '@/lib/product-import'
import type { PreviewRow } from '@/modules/dept/technical/product-import.service'
import { ACTION_TAG, GapText } from './nhap-excel.shared'
import type { NhapExcelCtx } from './useNhapExcel'

/**
 * Bảng sheet "Sản phẩm" của màn soi (bản vẽ, trạng thái 2–3). Bấm dòng mở NGAY
 * DƯỚI dòng đủ mọi ô cũ → mới chia theo nhóm (Q2) — không dùng ngăn bên phải vì
 * ép hẹp bảng. Cột cuối: ô còn thiếu cho LSX / báo giá sau khi ghi (Q1).
 */

/** Số dòng "cũ → mới" bày sẵn trên dòng; còn lại mở dòng mới thấy. */
const SHOW = 3
/** 7 cột — TFoot phải khớp: nhãn 4 + tổng 1 + caveat 2 (bẫy TFoot). */
const COLS = 7

function Thumb({ src, fresh, alt }: { src: string; fresh?: boolean; alt: string }) {
  return (
    <span
      className="relative block h-[30px] w-10 shrink-0 overflow-hidden border bg-[var(--surface-raised)]"
      style={{
        borderColor: fresh ? 'var(--done)' : 'var(--hair)',
        outline: fresh ? '1px solid var(--done)' : undefined,
      }}
    >
      {fresh ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL nhỏ do server dựng
        <img src={src} alt={alt} className="size-full object-contain" />
      ) : (
        <Image src={src} alt={alt} fill sizes="40px" className="object-contain" />
      )}
    </span>
  )
}

function ChangeLine({ c }: { c: CellChange }) {
  return (
    <>
      <span className="truncate text-[var(--ink-3)]">{c.label}</span>
      <span className="truncate">
        {c.before && (
          <>
            <span className="text-[var(--ink-3)] line-through">{c.before}</span>
            {' → '}
          </>
        )}
        <b className="text-[var(--act-text)]">{c.after}</b>
      </span>
    </>
  )
}

/** Ô "Thay đổi / vì sao": lỗi → câu lỗi; cập nhật / thêm mới → vài dòng đầu. */
function WhyCell({ r, opened }: { r: PreviewRow; opened: boolean }) {
  if (r.errors.length)
    return (
      <span className="text-[var(--stop)]" style={{ whiteSpace: 'normal' }}>
        {r.errors.map((e) => e.msg).join(' · ')}
      </span>
    )
  const list = r.action === 'create' ? r.filled : r.changes
  const warn = r.warnings.length > 0 && (
    <span className="text-k-sm block text-[var(--warn)]" style={{ whiteSpace: 'normal' }}>
      {r.warnings.map((w) => w.msg).join(' · ')}
    </span>
  )
  if (r.action === 'same')
    return <span className="text-[var(--ink-3)]">Không ô nào khác dữ liệu đang có</span>
  const more = list.length - SHOW
  return (
    <div className="flex flex-col gap-0.5">
      <div className="grid grid-cols-[128px_minmax(0,1fr)] gap-x-2">
        {list.slice(0, SHOW).map((c) => (
          <ChangeLine key={c.key} c={c} />
        ))}
      </div>
      {more > 0 && (
        <span className="text-k-sm font-medium text-[var(--act-text)]">
          {opened ? '▾ Thu gọn' : `▸ +${more} ô nữa — bấm dòng để xem đủ`}
        </span>
      )}
      {warn}
    </div>
  )
}

/** Phần mở dưới dòng: mọi ô, chia theo nhóm cột của file (như trang chi tiết). */
function Detail({ r }: { r: PreviewRow }) {
  const list = r.action === 'create' ? r.filled : r.changes
  const groups = new Map<string, CellChange[]>()
  for (const c of list) {
    const g =
      c.key === 'image' ? 'Nhận diện' : (COLUMN_BY_KEY.get(c.key)?.group ?? 'Khác')
    groups.set(g, [...(groups.get(g) ?? []), c])
  }
  return (
    <tr>
      <td
        colSpan={COLS}
        style={{ padding: 0, background: 'var(--surface-hover)', whiteSpace: 'normal' }}
      >
        <div className="grid grid-cols-3 gap-x-6 gap-y-3 border-b border-[var(--line)] py-2.5 pr-4 pl-[104px]">
          {r.action === 'create' && (
            <p className="text-k-sm col-span-3 m-0 text-[var(--ink-3)]">
              Đã điền {list.length}/{FILLABLE_COLUMNS} ô — ô trống của SP mới để trống.
            </p>
          )}
          {[...groups].map(([g, cs]) => (
            <div key={g} className="min-w-0">
              <h3 className="text-k-label m-0 mb-1 tracking-wider text-[var(--ink-3)] uppercase">
                {g}
              </h3>
              <div className="text-k-sm grid grid-cols-[120px_minmax(0,1fr)] gap-x-2">
                {cs.map((c) => (
                  <ChangeLine key={c.key} c={c} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </td>
    </tr>
  )
}

export function BangSanPham({ d }: { d: NhapExcelCtx }) {
  const p = d.preview!
  if (d.shown.length === 0) {
    return (
      <Empty
        headline="Không có dòng nào ở mục này"
        reason={
          d.q.trim()
            ? `Không dòng nào khớp "${d.q.trim()}" trong mục đang chọn.`
            : d.filter === 'write'
              ? 'Mọi dòng trong file đều y như dữ liệu đang có — không có gì để ghi.'
              : 'Mục đang chọn không khớp dòng nào trong file.'
        }
        next="Xoá ô tìm hoặc bấm “Tất cả” để xem cả file."
      />
    )
  }
  return (
    <Table label="Các dòng của sheet Sản phẩm">
      <THead pinFirst>
        <th style={{ textAlign: 'right', width: 56 }}>Dòng</th>
        <th style={{ width: 104 }}>Việc</th>
        <th style={{ width: 104 }}>Ảnh</th>
        <th style={{ width: 132 }}>Mã nội bộ</th>
        <th style={{ width: 240 }}>Tên SP · khách</th>
        {/* Cột người dùng đến đây để đọc — bề rộng đặt tay (bài học vòng 1). */}
        <th style={{ minWidth: 380 }}>Thay đổi (cũ → mới) / vì sao</th>
        <th style={{ width: 210 }}>Còn thiếu cho LSX</th>
      </THead>
      <tbody>
        {d.shown.flatMap((r) => {
          const list = r.action === 'create' ? r.filled : r.changes
          const canOpen =
            r.action !== 'error' && r.action !== 'same' && list.length > SHOW
          const opened = d.open === r.row
          const row = (
            <Row
              key={r.row}
              selected={opened}
              onClick={canOpen ? () => d.toggle(r.row) : undefined}
            >
              <Cell num pin>
                {r.row}
              </Cell>
              <Cell>
                <span className="inline-flex flex-col items-start gap-0.5">
                  <Tag tone={ACTION_TAG[r.action].tone}>{ACTION_TAG[r.action].label}</Tag>
                  {r.action !== 'error' && r.action !== 'same' && (
                    <span className="text-k-label text-[var(--ink-3)]">
                      {list.length} ô{r.newImage != null ? ' · ảnh mới' : ''}
                    </span>
                  )}
                  {r.warn && <Tag tone="warn">Cảnh báo</Tag>}
                </span>
              </Cell>
              <Cell>
                <span className="flex items-center gap-1">
                  {r.imageUrl && (
                    <Thumb src={r.imageUrl} alt={`Ảnh hiện tại của ${r.name}`} />
                  )}
                  {r.imageUrl && r.imagePreview && (
                    <span aria-hidden className="text-k-label text-[var(--ink-3)]">
                      →
                    </span>
                  )}
                  {
                    r.imagePreview &&
                    <Thumb src={r.imagePreview} fresh alt={`Ảnh mới của ${r.name || `dòng ${r.row}`}`} /> // prettier-ignore
                  }
                  {!r.imageUrl && !r.imagePreview && (
                    <span className="text-[var(--ink-3)]">—</span>
                  )}
                </span>
              </Cell>
              <Cell>
                {r.code ? (
                  <span className="flex flex-col">
                    <span
                      className="font-[family-name:var(--font-mono)] font-medium"
                      style={{
                        color: r.errors.some((e) => e.field === 'code')
                          ? 'var(--stop)'
                          : 'var(--act-text)',
                      }}
                    >
                      {r.code}
                    </span>
                    {r.codeAuto && (
                      <span
                        className="text-k-label text-[var(--ink-3)]"
                        title="Có thể nhích lên nếu có người thêm SP cùng loại trước khi ghi"
                      >
                        tự cấp
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-[var(--ink-3)]">(chưa cấp)</span>
                )}
              </Cell>
              <Cell title={r.name}>
                <span className="flex flex-col">
                  <span className="truncate">
                    {r.name || <span className="text-[var(--stop)]">(trống)</span>}
                  </span>
                  {r.customer && (
                    <span className="text-k-sm truncate text-[var(--ink-3)]">
                      {r.customer}
                    </span>
                  )}
                </span>
              </Cell>
              <Cell grow>
                <WhyCell r={r} opened={opened} />
              </Cell>
              <Cell>
                {r.action === 'error' ? (
                  <span className="text-[var(--ink-3)]">—</span>
                ) : (
                  <GapText gaps={r.gaps} />
                )}
              </Cell>
            </Row>
          )
          return opened ? [row, <Detail key={`${r.row}-d`} r={r} />] : [row]
        })}
      </tbody>
      <TFoot
        label={
          <td colSpan={4}>
            <b>{d.toWrite.length} dòng sẽ ghi</b> trong {d.rows.length}
          </td>
        }
        cells={
          <td>
            {p.counts.create} thêm mới · {p.counts.update} cập nhật ({p.changedCells} ô)
            {d.newImages > 0 ? ` · ${d.newImages} ảnh mới` : ''}
          </td>
        }
        caveatSpan={2}
        caveat={`Không gồm ${p.counts.same} dòng y như dữ liệu đang có${d.errorRows.length ? ` và ${d.errorRows.length} dòng lỗi` : ''}. Mã tự cấp tính lại lúc ghi.`}
      />
    </Table>
  )
}
