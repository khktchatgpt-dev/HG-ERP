'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, Code, NumInput, Tag, TextInput, useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import {
  dueTxt,
  statusOf,
  vnd,
  type AssetKind,
  type AssetStatus,
  type Due,
  type Part,
} from '@/lib/may-moc'

/** Mã tem bấm được → hồ sơ máy (cùng đường QR dẫn tới). */
export function AssetCode({ code }: { code: string }) {
  return (
    <Code as="a" href={`/may-moc/may/${encodeURIComponent(code)}`}>
      {code}
    </Code>
  )
}

export function StatusTag({ kind, status }: { kind: AssetKind; status: AssetStatus }) {
  const s = statusOf(kind, status)
  return <Tag tone={s.tone}>{s.label}</Tag>
}

/** Hạn bảo trì: đỏ quá hạn, cam ≤ 7 ngày, thường còn xa. */
export function DueText({ due }: { due: Due }) {
  const tone =
    due.days < 0 || (due.hoursLeft != null && due.hoursLeft < 0)
      ? 'stop'
      : due.days <= 7
        ? 'warn'
        : null
  return (
    <span
      className="text-k-sm font-mono whitespace-nowrap"
      style={tone ? { color: `var(--${tone})`, fontWeight: 600 } : undefined}
    >
      {dueTxt(due)}
    </span>
  )
}

/** Một hàng nhãn + ô trong hộp thoại. Nhãn là `<label>` thật để bấm vào nhãn là vào ô. */
export function FormRow({
  label,
  hint,
  warn,
  children,
}: {
  label: string
  hint?: ReactNode
  warn?: boolean
  children: ReactNode
}) {
  return (
    <label
      // Ô chọn của kit tự rộng theo lựa chọn dài nhất ("SON · Dây chuyền sơn tĩnh
      // điện…" = 420px) → tràn cột. `!` vì CSS kit không nằm trong @layer.
      className="grid min-w-0 gap-1 [&_select]:!w-full [&_select]:!max-w-full"
    >
      <span className="text-k-sm font-semibold text-[var(--ink-label)]">{label}</span>
      {children}
      {hint && (
        <span
          className="text-k-sm"
          style={{
            color: warn ? 'var(--warn)' : 'var(--ink-3)',
            fontWeight: warn ? 600 : 400,
          }}
        >
          {hint}
        </span>
      )}
    </label>
  )
}

/**
 * Lý do chưa lưu được — bày TẠI CHỖ (luật kiểm: bị chặn thì nói vướng gì). Khối form
 * gắn `onInput={() => setErr(null)}` để câu tắt khi người dùng sửa — câu cũ nằm lại
 * sau khi đã gõ đủ làm người ta tưởng vẫn còn vướng.
 */
export function Blocked({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="text-k-sm rounded-[var(--radius)] border px-2 py-1.5"
      style={{
        borderColor: 'var(--warn-line)',
        background: 'var(--warn-wash)',
        color: 'var(--ink)',
      }}
    >
      <b style={{ color: 'var(--warn)' }}>Chưa lưu được:</b> {children}
    </p>
  )
}

/** Số VN gõ tay: "1.950.000" → 1950000, "2,5" → 2.5. Rỗng → 0. Sai → NaN. */
export function readNum(s: string): number {
  const t = s.replace(/\s|đ/gi, '')
  if (!t) return 0
  const norm = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)
    ? t.replace(/\./g, '').replace(',', '.')
    : t.replace(',', '.')
  const n = Number(norm)
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

export type PartDraft = { name: string; qty: string; price: string }
export const emptyPart = (name = ''): PartDraft => ({
  name,
  qty: name ? '1' : '',
  price: '',
})
export const draftParts = (rows: PartDraft[]): Part[] =>
  rows
    .filter((r) => r.name.trim())
    .map((r) => ({
      name: r.name.trim(),
      qty: readNum(r.qty) || 1,
      price: readNum(r.price) || 0,
    }))

/** Bảng vật tư, phụ tùng đã dùng — tên · SL · đơn giá · thành tiền. */
export function PartsEditor({
  rows,
  onChange,
}: {
  rows: PartDraft[]
  onChange: (r: PartDraft[]) => void
}) {
  const set = (i: number, k: keyof PartDraft, v: string) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const total = draftParts(rows).reduce((s, p) => s + Math.round(p.qty * p.price), 0)
  return (
    <div className="grid gap-1">
      <span className="text-k-sm font-semibold text-[var(--ink-label)]">
        Vật tư, phụ tùng đã dùng
      </span>
      <div className="text-k-label grid grid-cols-[minmax(0,1fr)_64px_112px_104px] gap-1 text-[var(--ink-3)] uppercase">
        <span>Tên</span>
        <span className="text-right">SL</span>
        <span className="text-right">Đơn giá</span>
        <span className="text-right">Thành tiền</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid grid-cols-[minmax(0,1fr)_64px_112px_104px] items-center gap-1"
        >
          <TextInput
            label={`Tên vật tư dòng ${i + 1}`}
            value={r.name}
            onCommit={(v) => set(i, 'name', v)}
            placeholder="VD: Đầu đốt gas"
          />
          <NumInput
            aria-label={`Số lượng dòng ${i + 1}`}
            value={r.qty}
            onCommit={(v) => set(i, 'qty', v)}
          />
          <NumInput
            aria-label={`Đơn giá dòng ${i + 1}`}
            value={r.price}
            onCommit={(v) => set(i, 'price', v)}
          />
          <span className="text-k-sm text-right font-mono">
            {r.name.trim()
              ? vnd(Math.round((readNum(r.qty) || 1) * (readNum(r.price) || 0)))
              : ''}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Btn icon="them" onClick={() => onChange([...rows, emptyPart()])}>
          Thêm dòng
        </Btn>
        <span className="text-k-sm">
          Vật tư: <b className="font-mono">{vnd(total)}</b> đ
        </span>
      </div>
    </div>
  )
}

/**
 * Gọi API cho một thao tác: khoá nút khi chạy, toast kết quả, nạp lại số trên
 * trang (`router.refresh`). Lỗi trả về chuỗi để hộp bày TẠI CHỖ, không chỉ toast.
 */
export function useMutate() {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function run<T>(
    fn: () => Promise<T>,
    ok?: string | ((r: T) => string),
  ): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
    setBusy(true)
    try {
      const data = await fn()
      if (ok) toast.success(typeof ok === 'function' ? ok(data) : ok)
      router.refresh()
      return { ok: true, data }
    } catch (e) {
      const error = apiErrorText(e)
      toast.error('Chưa lưu được', error)
      return { ok: false, error }
    } finally {
      setBusy(false)
    }
  }
  return { busy, run, api }
}
