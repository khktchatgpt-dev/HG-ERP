'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/Modal'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'

type Found = { id: string; code: string; name: string; bom_status: string }

/**
 * Chép định mức từ sản phẩm khác. Kỹ thuật dựng định mức mới chủ yếu bằng cách
 * này — ghế biến thể chỉ khác ghế gốc vài dòng — nên đặt ngay trên thẻ định mức.
 */
export function PartsCopyDialog({
  productId,
  hasParts,
  onClose,
}: {
  productId: string
  /** Có dòng sẵn thì mới cần hỏi nối đuôi hay thay thế. */
  hasParts: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Found[]>([])
  const [picked, setPicked] = useState<Found | null>(null)
  const [mode, setMode] = useState<'append' | 'replace'>(hasParts ? 'append' : 'replace')
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  const term = q.trim()
  const tooShort = term.length < 2

  useEffect(() => {
    if (tooShort) return
    const mine = ++seq.current
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await api<{ rows: Found[] }>(
          `/api/dept/technical/products?q=${encodeURIComponent(term)}&page_size=15`,
        )
        // Bỏ qua kết quả của lần gõ cũ về muộn.
        if (mine === seq.current)
          setRows((data.rows ?? []).filter((r) => r.id !== productId))
      } catch {
        if (mine === seq.current) setRows([])
      } finally {
        if (mine === seq.current) setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [term, tooShort, productId])

  // Gõ ngắn lại thì ẩn kết quả cũ ngay ở lúc render — không setState trong effect.
  const visible = tooShort ? [] : rows

  async function run() {
    if (!picked) return
    setBusy(true)
    try {
      const r = await api<{ added: number; removed: number; source_code: string }>(
        `/api/dept/technical/products/${productId}/parts/copy`,
        { method: 'POST', body: { source_product_id: picked.id, mode } },
      )
      router.refresh()
      toast.success(
        `Đã chép ${r.added} dòng từ ${r.source_code}`,
        r.removed ? `Đã xoá ${r.removed} dòng cũ` : undefined,
      )
      onClose()
    } catch (err) {
      toast.error('Chép thất bại', apiErrorText(err))
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Chép định mức từ sản phẩm khác">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Tìm sản phẩm nguồn
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Gõ mã hoặc tên, tối thiểu 2 ký tự…"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <div className="max-h-60 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          {searching && (
            <p className="text-muted-foreground px-3 py-2 text-sm">Đang tìm…</p>
          )}
          {!searching && !tooShort && visible.length === 0 && (
            <p className="text-muted-foreground px-3 py-2 text-sm">Không tìm thấy.</p>
          )}
          {visible.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setPicked(r)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                picked?.id === r.id
                  ? 'bg-sky-100 dark:bg-sky-950/50'
                  : 'hover:bg-muted/60'
              }`}
            >
              <span className="font-mono text-xs">{r.code}</span>
              <span className="truncate">{r.name}</span>
              {r.bom_status !== 'done' && (
                <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                  chưa có ĐM
                </span>
              )}
            </button>
          ))}
        </div>

        {hasParts && (
          <fieldset className="flex flex-col gap-1.5 text-sm">
            <legend className="text-muted-foreground mb-1 text-xs">
              Sản phẩm này đã có định mức
            </legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={mode === 'append'}
                onChange={() => setMode('append')}
              />
              Chép thêm vào cuối, giữ nguyên phần đang có
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
              />
              <span>
                Xoá hết định mức hiện tại rồi chép sang
                <span className="ml-1 text-red-600">(không hoàn tác được)</span>
              </span>
            </label>
          </fieldset>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={!picked || busy}
            onClick={() => void run()}
            className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white shadow hover:bg-sky-700 disabled:opacity-50"
          >
            {busy && <Spinner size={14} />}
            {picked ? `Chép từ ${picked.code}` : 'Chọn sản phẩm nguồn'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
