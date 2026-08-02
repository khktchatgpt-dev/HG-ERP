'use client'

import { useRef, useState } from 'react'
import { AnchoredPopover } from '@/components/erp/AnchoredPopover'
import { DiePicker } from '@/components/supply/DiePicker'
import type { PoField } from '@/lib/po-fields'
import { recalcCartonArea, type Line } from './po-line'

/**
 * Ô nhập của DÒNG ĐƠN, dựng theo khai báo trong `@/lib/po-fields`.
 *
 * Trước đây mỗi cột là một nhánh `c.key === '…'` trong JSX của bảng — 15 nhánh,
 * và thêm mẫu đơn là thêm nhánh. Nay bảng chỉ map khai báo → 8 kiểu ô ở đây.
 *
 * Quy ước hiển thị giữ nguyên: ô NỀN XÁM là số hệ thống tự tính (tổng kg, thành
 * tiền), không gõ được; ô nền trắng là chỗ nhân viên nhập.
 */

export const cell =
  'h-[30px] w-full rounded-md border border-zinc-300 px-2 text-[13px] focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'
export const calc =
  'flex h-[30px] items-center justify-end rounded-md bg-zinc-100 px-2 text-[13px] font-medium tabular-nums dark:bg-zinc-800'

const num = (n: number) => n.toLocaleString('vi-VN')

/** Đọc/ghi trường của `Line` theo tên khai báo — ép kiểu gói gọn trong file này. */
const get = (l: Line, field?: string) =>
  field ? (l as unknown as Record<string, unknown>)[field] : ''
const patchOf = (field: string, v: unknown) =>
  ({ [field]: v }) as unknown as Partial<Line>

export function LineCell({
  f,
  line,
  index,
  kgTotal,
  onPatch,
}: {
  f: PoField
  line: Line
  index: number
  /** Tổng kg do `lineQty2` tính — chỉ dùng cho ô kiểu 'calc'. */
  kgTotal: number | null
  onPatch: (i: number, patch: Partial<Line>) => void
}) {
  const l = line
  const label = `${f.label} ${l.name}`

  switch (f.kind) {
    case 'text':
      return (
        <input
          value={String(get(l, f.field) ?? '')}
          maxLength={200}
          placeholder={f.placeholder}
          onChange={(e) => onPatch(index, patchOf(f.field!, e.target.value))}
          className={cell}
          aria-label={label}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          min="0"
          max={f.max}
          step={f.step ?? '0.01'}
          value={String(get(l, f.field) ?? '')}
          onChange={(e) =>
            onPatch(
              index,
              patchOf(f.field!, e.target.value === '' ? '' : Number(e.target.value)),
            )
          }
          className={`${cell} text-right`}
          aria-label={label}
        />
      )

    case 'calc':
      return (
        <div className={calc} title="Hệ thống tự tính">
          {kgTotal == null ? (
            <span className="font-normal text-zinc-400">—</span>
          ) : (
            num(kgTotal)
          )}
        </div>
      )

    case 'die':
      return (
        <DiePicker
          value={l.die_code}
          ariaLabel={label}
          onTextChange={(code) => onPatch(index, { die_code: code })}
          onPick={(d) =>
            onPatch(index, {
              die_code: d.code,
              // Chọn khuôn là chốt kg/m — thứ quyết định tổng kg và tiền hàng.
              weight_per_m: d.weight_per_m ?? l.weight_per_m,
              spec: d.profile_spec ?? l.spec,
            })
          }
        />
      )

    case 'openStyle':
      return (
        <select
          value={l.open_style}
          onChange={(e) => {
            // Đổi cách mở là đổi công thức m² (AD khác MR) — tính lại ngay.
            const next = { ...l, open_style: e.target.value }
            onPatch(index, {
              open_style: e.target.value,
              area_m2: recalcCartonArea(next),
            })
          }}
          className={cell}
          aria-label={label}
        >
          <option value="">—</option>
          <option value="AD">AD</option>
          <option value="MR">MR</option>
        </select>
      )

    case 'inner':
      return (
        <div className="flex items-center gap-1">
          {(['inner_l_mm', 'inner_w_mm', 'inner_h_mm'] as const).map((k) => (
            <input
              key={k}
              type="number"
              min="0"
              step="1"
              value={l[k]}
              onChange={(e) => {
                const v = e.target.value === '' ? '' : Number(e.target.value)
                const next = { ...l, [k]: v } as Line
                onPatch(index, {
                  [k]: v,
                  area_m2: recalcCartonArea(next),
                } as Partial<Line>)
              }}
              className={`${cell} px-1 text-right`}
              aria-label={`${k === 'inner_l_mm' ? 'Dài' : k === 'inner_w_mm' ? 'Rộng' : 'Cao'} lọt lòng ${l.name}`}
            />
          ))}
        </div>
      )

    case 'area':
      return (
        <input
          type="number"
          min="0"
          step="0.0001"
          value={l.area_m2}
          onChange={(e) =>
            onPatch(index, {
              area_m2: e.target.value === '' ? '' : Number(e.target.value),
            })
          }
          className={`${cell} text-right`}
          title="Tự tính từ lọt lòng theo cách mở — sửa được nếu NCC chào khác barem"
          aria-label={label}
        />
      )

    case 'cartonBasis':
      return (
        <select
          value={l.carton_basis}
          onChange={(e) =>
            onPatch(index, { carton_basis: e.target.value as 'ctn' | 'm2' })
          }
          className={cell}
          aria-label={label}
        >
          <option value="ctn">thùng</option>
          <option value="m2">m²</option>
        </select>
      )
  }
}

// ── Hai ô cố định hai đầu hàng, mẫu nào cũng có ──────────────────────────────

/** Mã SP trên một dòng: nhiều mã ghép bằng " · " vì một dòng mua gộp cho nhiều SP. */
const SEP = ' · '
const splitCodes = (v: string) =>
  v
    .split(/[·,;]/)
    .map((s) => s.trim())
    .filter(Boolean)

/**
 * Ô "Mã SP": CHỌN từ danh sách sản phẩm của chính LSX, chọn được NHIỀU mã.
 *
 * Phòng Cung ứng mua gộp chi tiết của cả lệnh cho rẻ — một đơn vít dùng chung cho
 * 4 mã SP, nên ô này phải cho tick nhiều mã. Đơn ngoài LSX (không có danh sách)
 * thì quay về gõ tay.
 */
export function ProductCodeCell({
  value,
  products,
  onChange,
  label,
}: {
  value: string
  products: { code: string; name: string }[]
  onChange: (v: string) => void
  label: string
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const picked = splitCodes(value)

  if (products.length === 0) {
    return (
      <input
        value={value}
        maxLength={200}
        placeholder="22027-209"
        onChange={(e) => onChange(e.target.value)}
        className={`${cell} font-mono text-[12px]`}
        aria-label={label}
        title={value}
      />
    )
  }

  const toggle = (code: string) => {
    const next = picked.includes(code)
      ? picked.filter((c) => c !== code)
      : [...picked, code]
    // Giữ đúng thứ tự sản phẩm trong lệnh để mọi dòng đọc giống nhau.
    onChange(
      products
        .map((p) => p.code)
        .filter((c) => next.includes(c))
        .join(SEP),
    )
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() =>
          setAnchor((a) => (a ? null : (btnRef.current?.getBoundingClientRect() ?? null)))
        }
        className={`${cell} flex items-center justify-between gap-1 text-left font-mono text-[11px] ${
          picked.length === 0 ? 'text-zinc-400' : ''
        }`}
        aria-label={label}
        title={picked.join(SEP)}
      >
        <span className="truncate">
          {picked.length === 0
            ? '— chọn —'
            : picked.length === 1
              ? picked[0]
              : `${picked.length} SP`}
        </span>
        <span className="text-[9px] text-zinc-400">▾</span>
      </button>
      {anchor && (
        <AnchoredPopover anchor={anchor} onClose={() => setAnchor(null)} width={260}>
          <div className="p-1">
            {products.map((p) => (
              <label
                key={p.code}
                className="flex cursor-pointer items-start gap-2 rounded px-1.5 py-1 text-[12px] hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <input
                  type="checkbox"
                  checked={picked.includes(p.code)}
                  onChange={() => toggle(p.code)}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block font-mono text-[11px]">{p.code}</span>
                  <span className="block text-[11px] break-words text-zinc-500">
                    {p.name}
                  </span>
                </span>
              </label>
            ))}
            {picked.length > 0 && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="mt-1 w-full rounded px-1.5 py-1 text-left text-[11px] text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Bỏ chọn hết
              </button>
            )}
          </div>
        </AnchoredPopover>
      )}
    </div>
  )
}

/** Ghi chú dòng — ô nở theo nội dung để ghi chú dài không bị giấu mất đuôi. */
export function NoteCell({
  value,
  placeholder,
  label,
  onChange,
}: {
  value: string
  placeholder: string
  label: string
  onChange: (v: string) => void
}) {
  return (
    <textarea
      value={value}
      maxLength={500}
      rows={1}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onInput={(e) => {
        const t = e.currentTarget
        t.style.height = 'auto'
        t.style.height = `${Math.min(t.scrollHeight, 120)}px`
      }}
      className={`${cell} min-h-[30px] resize-none py-1.5 leading-tight`}
      aria-label={label}
      title={value}
    />
  )
}
