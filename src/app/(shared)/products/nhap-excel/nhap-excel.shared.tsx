import type { ReactNode } from 'react'
import type { RowAction } from '@/lib/product-import'
import type {
  PreviewRow,
  ProfileGaps,
} from '@/modules/dept/technical/product-import.service'

/**
 * Kiểu, hằng và ô nhỏ dùng chung giữa các file của màn nhập Excel (bản vẽ
 * 3ZsNUVkcMyCKRzsJa1zPSe, duyệt 08/10/2026 theo đề xuất Q1–Q4).
 */

export const API = '/api/dept/technical/products/import-excel'
/** Mỗi lô tối đa chừng này dòng SP (giới hạn thời gian một lần gọi). */
export const CHUNK = 50
/** Mỗi lô tối đa chừng này ẢNH mới — tải ảnh lâu hơn ghi chữ nhiều. */
export const CHUNK_IMAGES = 10
/** Mỗi lô đóng gói tối đa chừng này SP (service: PACKING_CHUNK). */
export const PACKING_CHUNK = 40

export type Filter = 'write' | 'all' | RowAction | 'warn'
export type PackFilter = 'replace' | 'same' | 'error'
export type SheetTab = 'products' | 'packing'
export type Progress = { done: number; total: number; lot: number; lots: number }
export type LibraryFacts = { products: number; noImage: number; withPacking: number }

export const ACTION_TAG: Record<
  RowAction,
  { label: string; tone: 'done' | 'run' | 'neutral' | 'stop' }
> = {
  create: { label: 'Thêm mới', tone: 'done' },
  update: { label: 'Cập nhật', tone: 'run' },
  same: { label: 'Không đổi', tone: 'neutral' },
  error: { label: 'Lỗi', tone: 'stop' },
}

export const matches = (r: PreviewRow, f: Filter) =>
  f === 'all'
    ? true
    : f === 'write'
      ? r.action === 'create' || r.action === 'update'
      : f === 'warn'
        ? r.warn
        : r.action === f

/**
 * Dải 3 bước của luồng (Chọn file → Soi → Ghi). Chữ, không hộp: nền đặc dành
 * cho thứ bấm được — bước đang đứng chỉ có nền NHẠT + chấm (luật 5 CLAUDE.md).
 */
export function StepStrip({ at, right }: { at: 0 | 1 | 2; right?: ReactNode }) {
  const steps = ['Chọn file Excel', 'Soi trước khi ghi', 'Ghi và tải file có mã']
  return (
    <div className="flex items-stretch border-b border-[var(--line)] bg-[var(--surface-raised)]">
      <ol className="flex min-w-0 shrink-0" aria-label="Các bước nhập file">
        {steps.map((s, i) => {
          const state = i < at ? 'done' : i === at ? 'now' : 'next'
          return (
            <li
              key={s}
              aria-current={state === 'now' ? 'step' : undefined}
              className="text-k-sm flex items-center gap-2 border-r border-[var(--hair)] px-3.5 py-1.5 whitespace-nowrap"
              style={{
                background: state === 'now' ? 'var(--act-wash)' : undefined,
                color:
                  state === 'now'
                    ? 'var(--act-text)'
                    : state === 'done'
                      ? 'var(--ink-2)'
                      : 'var(--ink-3)',
                fontWeight: state === 'now' ? 600 : 400,
              }}
            >
              <span
                aria-hidden
                className="inline-block size-2 rounded-full"
                style={{
                  background:
                    state === 'now'
                      ? 'var(--act)'
                      : state === 'done'
                        ? 'var(--done)'
                        : 'transparent',
                  border: `1.5px solid ${state === 'now' ? 'var(--act)' : state === 'done' ? 'var(--done)' : 'var(--line)'}`,
                }}
              />
              {i + 1} · {s}
            </li>
          )
        })}
      </ol>
      {right && (
        <div className="text-k-sm ml-auto flex min-w-0 items-center gap-3.5 overflow-hidden px-3.5 whitespace-nowrap text-[var(--ink-2)]">
          {right}
        </div>
      )}
    </div>
  )
}

/**
 * Ô "Còn thiếu cho LSX" (Q1). Tầng `core` tô cảnh báo; tầng `spec` (sơn, gỗ…)
 * chữ nhạt — trống là thường với SP không có thứ đó, đừng tô cả bảng vàng.
 */
export function GapText({ gaps }: { gaps: ProfileGaps }) {
  if (!gaps.core.length && !gaps.spec.length)
    return <span className="text-[var(--done)]">Đủ</span>
  return (
    <span style={{ whiteSpace: 'normal' }}>
      {gaps.core.length > 0 && (
        <span className="text-[var(--warn)]">
          <b>Thiếu {gaps.core.length}:</b> {gaps.core.join(', ')}
        </span>
      )}
      {gaps.spec.length > 0 && (
        <span className="text-k-sm block text-[var(--ink-3)]">
          Trống ở LSX: {gaps.spec.join(', ')}
        </span>
      )}
    </span>
  )
}
