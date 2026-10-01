'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, TextArea, useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { QUESTION_LABEL, type PoQuestionThread } from '@/lib/po-signature'
import { dmyAt } from './don-chung-tu.shared'

/**
 * CÂU HỎI CỦA GIÁM ĐỐC trên trang đơn bên Mua hàng (0218, 01/10/2026).
 *
 * Giám đốc bấm "Hỏi lại" (đơn chờ duyệt) hoặc "Yêu cầu xem lại" (đơn đã ký /
 * đã gửi) ở màn ký; câu hỏi tới đây, ngay đầu đơn, kèm ô trả lời. Trả lời xong
 * câu hỏi đóng và người hỏi nhận thông báo — bóng về lại bàn Giám đốc.
 *
 * Tự nạp qua API (không qua page.tsx) để không phải đụng vào chuỗi props của
 * màn chứng từ — câu hỏi hiếm, và khối này rỗng thì không vẽ gì.
 *
 * Chỉ bày câu CÒN MỞ + câu trả lời gần nhất; lịch sử đầy đủ nằm ở Trao đổi.
 */
export function CauHoiGd({
  poId,
  status,
  canAnswer,
}: {
  poId: string
  /** Nháp / đã huỷ thì không bao giờ có câu hỏi (lib/po-signature) — khỏi gọi API. */
  status: string
  canAnswer: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [qs, setQs] = useState<PoQuestionThread[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  // Tăng lên để nạp lại sau khi trả lời.
  const [tick, setTick] = useState(0)

  const asks = status !== 'draft' && status !== 'cancelled'

  useEffect(() => {
    if (!asks) return
    let alive = true
    api<{ questions: PoQuestionThread[] }>(`/api/dept/supply/pos/${poId}/questions`)
      .then((r) => {
        if (alive) setQs(r.questions ?? [])
      })
      .catch(() => {
        /* khối phụ — lỗi nạp không chặn trang đơn */
      })
    return () => {
      alive = false
    }
  }, [poId, tick, asks])

  const open = qs.filter((q) => !q.resolved_at)
  if (open.length === 0) return null

  async function answer(q: PoQuestionThread) {
    const body = (draft[q.id] ?? '').trim()
    if (!body) return
    setBusy(q.id)
    try {
      await api(`/api/dept/supply/pos/${poId}/questions/${q.id}/answer`, {
        method: 'POST',
        body: { body },
      })
      toast.success('Đã trả lời — Giám đốc nhận thông báo')
      setDraft((d) => ({ ...d, [q.id]: '' }))
      setTick((t) => t + 1)
      router.refresh()
    } catch (e) {
      toast.error('Chưa gửi được', apiErrorText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section
      aria-label="Câu hỏi của Giám đốc"
      className="border-b border-[var(--line)] bg-[var(--act-wash)]"
    >
      {open.map((q) => (
        <div
          key={q.id}
          className="text-k-sm grid gap-1.5 border-t border-[var(--hair)] px-[var(--gutter)] py-2 first:border-t-0"
        >
          <span className="flex flex-wrap items-baseline gap-x-2">
            <b className="text-[var(--act-text)]">
              Giám đốc {QUESTION_LABEL[q.kind].toLowerCase()} · {q.author_name ?? '—'} ·{' '}
              <span className="num">{dmyAt(q.created_at)}</span>
            </b>
            <span className="text-[var(--ink)]">{q.body}</span>
          </span>
          {canAnswer ? (
            <span className="flex flex-wrap items-end gap-2">
              <span className="min-w-[280px] flex-1">
                <TextArea
                  aria-label={`Trả lời câu hỏi: ${q.body}`}
                  rows={2}
                  value={draft[q.id] ?? ''}
                  placeholder={
                    q.kind === 'review'
                      ? 'Đã xử lý thế nào (điều chỉnh / huỷ / giải thích)…'
                      : 'Trả lời Giám đốc…'
                  }
                  onChange={(v) => setDraft((d) => ({ ...d, [q.id]: v }))}
                />
              </span>
              <Btn
                primary
                icon="gui"
                disabled={busy === q.id || !(draft[q.id] ?? '').trim()}
                onClick={() => void answer(q)}
              >
                Trả lời
              </Btn>
            </span>
          ) : (
            <span className="text-k-label text-[var(--ink-3)]">
              Chờ người phụ trách đơn trả lời.
            </span>
          )}
        </div>
      ))}
    </section>
  )
}
