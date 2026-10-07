'use client'

import { Fragment, type ReactNode } from 'react'
import { Empty, Tag, TFoot, THead, Table } from '@/components/kit'
import type { OptionData, PackageData } from '@/lib/product-packing-import'
import type { ImportPreview } from '@/modules/dept/technical/product-import.service'

/**
 * Bảng soi sheet "ĐÓNG GÓI" (bản vẽ, trạng thái 4 — Q3): mỗi SP một nhóm, bày
 * TỪNG KIỆN — bộ đang có (gạch) rồi bộ sau khi ghi. Câu tóm tắt "1 phương án ·
 * 2 kiện" của bản trước không cho biết kiện nào đổi.
 */

type Item = ImportPreview['packing']['items'][number]

const TAG = {
  replace: { label: 'Thay đóng gói', tone: 'run' as const },
  same: { label: 'Không đổi', tone: 'neutral' as const },
  error: { label: 'Lỗi', tone: 'stop' as const },
}
/** 9 cột — TFoot: nhãn 5 + tổng 1 + caveat 3 (bẫy TFoot). */
const COLS = 9

const n = (v: number | null | undefined, digits = 0) =>
  v == null ? '—' : v.toLocaleString('vi-VN', { maximumFractionDigits: digits || 3 })
const dims = (p: PackageData) =>
  [p.carton_l_mm, p.carton_w_mm, p.carton_h_mm].some((x) => x != null)
    ? [p.carton_l_mm, p.carton_w_mm, p.carton_h_mm].map((x) => n(x)).join(' × ')
    : '—'

/** Các dòng kiện của một bộ phương án. `old` = bộ đang có, chữ gạch. */
function OptionRows({
  opts,
  side,
  against = [],
}: {
  opts: OptionData[]
  side: 'old' | 'new' | 'same'
  /** Bộ đang có — dòng "Sau ghi" tô ĐẬM đúng ô khác bộ cũ (cùng phương án, cùng thứ tự kiện). */
  against?: OptionData[]
}) {
  const strike = side === 'old' ? 'line-through' : undefined
  /** Kiểu ô: gạch ở bộ cũ; đậm màu hành động ở ô mới khác cũ. */
  const cell = (changed: boolean) =>
    side === 'old'
      ? { textDecoration: strike }
      : side === 'new' && changed
        ? { fontWeight: 600, color: 'var(--act-text)' }
        : undefined
  const sideLabel: ReactNode =
    side === 'old' ? (
      <span className="text-k-label font-semibold text-[var(--ink-3)] uppercase">
        Đang có
      </span>
    ) : side === 'new' ? (
      <span className="text-k-label font-semibold text-[var(--act-text)] uppercase">
        Sau ghi
      </span>
    ) : null
  const lines = opts.flatMap((o) =>
    (o.packages.length ? o.packages : [null]).map((pk, i) => ({ o, pk, first: i === 0 })),
  )
  if (!lines.length) {
    return (
      <tr>
        <td>{sideLabel}</td>
        <td colSpan={COLS - 1} className="text-[var(--ink-3)]">
          {side === 'new'
            ? '(xoá hết phương án — ô Phương án số gõ "-")'
            : '(chưa có phương án)'}
        </td>
      </tr>
    )
  }
  return lines.map(({ o, pk, first }, i) => {
    const oo = against.find((x) => x.option_no === o.option_no)
    const idx = pk ? o.packages.indexOf(pk) : 0
    const op = oo?.packages[idx] ?? null
    const diff = (a: unknown, b: unknown) => side === 'new' && (a ?? null) !== (b ?? null)
    return (
      <tr
        key={`${side}-${o.option_no}-${i}`}
        style={{ color: side === 'old' ? 'var(--ink-3)' : undefined }}
      >
        <td>{i === 0 ? sideLabel : null}</td>
        <td className="num" style={cell(!oo && first)}>
          {first ? o.option_no : ''}
        </td>
        <td style={cell(first && diff(o.label, oo?.label))}>
          {first
            ? (o.label ?? <span className="text-[var(--ink-3)]">(không tên)</span>)
            : '〃'}
        </td>
        <td style={cell(first && diff(o.is_default, oo?.is_default))}>
          {first ? (o.is_default ? 'có' : 'không') : ''}
        </td>
        <td style={cell(diff(pk?.package_label, op?.package_label))}>
          {pk?.package_label ?? '—'}
        </td>
        <td className="num" style={cell(diff(pk?.qty, op?.qty))}>
          {pk ? n(pk.qty) : '—'}
        </td>
        <td className="num" style={cell(!!pk && (!op || dims(pk) !== dims(op)))}>
          {pk ? dims(pk) : '—'}
        </td>
        <td className="num" style={cell(diff(pk?.net_weight_kg, op?.net_weight_kg))}>
          {n(pk?.net_weight_kg, 2)}
        </td>
        <td className="num" style={cell(diff(pk?.gross_weight_kg, op?.gross_weight_kg))}>
          {n(pk?.gross_weight_kg, 2)}
        </td>
      </tr>
    )
  })
}

function Group({ it }: { it: Item }) {
  return (
    <Fragment>
      <tr>
        <td
          colSpan={COLS}
          style={{
            background: 'var(--surface-raised)',
            borderTop: '1px solid var(--line)',
            whiteSpace: 'normal',
          }}
        >
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="font-[family-name:var(--font-mono)] font-medium text-[var(--act-text)]">
              {it.code || '—'}
            </span>
            {it.name && <span>{it.name}</span>}
            <Tag tone={TAG[it.action].tone}>{TAG[it.action].label}</Tag>
            <span className="text-k-sm text-[var(--ink-3)]">
              {it.action === 'replace'
                ? `${it.before} → ${it.after}`
                : it.action === 'same'
                  ? it.after
                  : null}
              {' · '}hàng Excel {it.rows.join(', ')}
            </span>
          </span>
          {it.errors.length > 0 && (
            <span className="text-k-sm block text-[var(--stop)]">
              {it.errors
                .map((e) => (e.row ? `Dòng ${e.row}: ${e.msg}` : e.msg))
                .join(' · ')}
            </span>
          )}
        </td>
      </tr>
      {it.action === 'replace' && (
        <>
          {it.old.length > 0 && <OptionRows opts={it.old} side="old" />}
          <OptionRows opts={it.options} side="new" against={it.old} />
        </>
      )}
      {it.action === 'same' && <OptionRows opts={it.old} side="same" />}
    </Fragment>
  )
}

export function BangDongGoi({
  items,
  counts,
  empty,
}: {
  items: Item[]
  counts: ImportPreview['packing']['counts']
  /** Câu khi mục đang lọc không có SP nào. */
  empty?: { headline: string; reason: string; next: string }
}) {
  if (!items.length) {
    return (
      <Empty
        headline={empty?.headline ?? 'File không có dòng nào ở sheet Đóng gói'}
        reason={empty?.reason ?? 'Sheet Đóng gói trống hoặc đã bị xoá — đóng gói của mọi SP giữ nguyên.'} // prettier-ignore
        next={empty?.next ?? 'Muốn sửa phương án đóng gói: xuất lại file từ Thư viện, điền ở sheet Đóng gói (mỗi dòng một kiện).'} // prettier-ignore
      />
    )
  }
  return (
    <Table label="Đóng gói theo SP">
      <THead>
        <th style={{ width: 76 }} />
        <th style={{ width: 56, textAlign: 'right' }}>P.án</th>
        <th style={{ width: 190 }}>Tên phương án</th>
        <th style={{ width: 80 }}>Mặc định</th>
        <th style={{ width: 170 }}>Tên kiện</th>
        <th style={{ width: 56, textAlign: 'right' }}>SL</th>
        <th style={{ width: 200, textAlign: 'right' }}>Thùng D × R × C (mm)</th>
        <th style={{ width: 80, textAlign: 'right' }}>NW (kg)</th>
        <th style={{ textAlign: 'right' }}>GW (kg)</th>
      </THead>
      <tbody>
        {items.map((it, i) => (
          <Group key={`${it.code}-${i}`} it={it} />
        ))}
      </tbody>
      <TFoot
        label={<td colSpan={5}>{counts.products} SP ở sheet Đóng gói</td>}
        cells={<td>{counts.replace} thay</td>}
        caveatSpan={3}
        caveat="SP có mặt thì thay TRỌN BỘ phương án; vắng mặt giữ nguyên. Ghi sau mọi dòng sản phẩm — hỏng giữa chừng thì SP đó giữ bộ cũ."
      />
    </Table>
  )
}
