'use client'

import { useState } from 'react'
import { Check, ChevronDown, Lock, LockOpen } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { usePrompt } from '@/components/ui/ConfirmDialog'
import {
  LIFECYCLES,
  LIFECYCLE_HINT,
  LIFECYCLE_LABEL,
  requiresReason,
  type Lifecycle,
} from '@/lib/product-lifecycle'
import type { HoSoView } from './ho-so.shared'
import type { HoSoCtx } from './useHoSo'

/**
 * TRẠNG THÁI HỒ SƠ + KHOÁ (B4, 20/11/2026 — chuyển từ đầu trang `/products/[id]`
 * cũ, cùng hai route `…/lifecycle` và `…/lock`). Lối ERP không kit của khu: nút
 * phẳng + menu `details.dd`, không badge bo tròn.
 *
 * Trạng thái là tin mọi phòng cần đọc: người không có quyền vẫn thấy nhãn, chỉ
 * mất menu. Lùi chặng / mở khoá thì bắt lý do (server cũng chặn).
 */
export function TrangThaiHoSo({
  d,
  c,
  canStatus,
}: {
  d: HoSoView
  c: HoSoCtx
  canStatus: boolean
}) {
  const prompt = usePrompt()
  const [busy, setBusy] = useState(false)
  const cur = d.lifecycle as Lifecycle
  const title = d.lifecycle_at
    ? `${LIFECYCLE_HINT[cur]} · chuyển lúc ${new Date(d.lifecycle_at).toLocaleString('vi-VN')}`
    : LIFECYCLE_HINT[cur]

  async function chuyen(to: Lifecycle, el: HTMLElement) {
    el.closest('details')?.removeAttribute('open')
    if (busy || to === cur) return
    let reason: string | null = null
    if (requiresReason(cur, to)) {
      reason = await prompt({
        title: `Lùi về “${LIFECYCLE_LABEL[to]}”?`,
        description: `Hồ sơ đang ở “${LIFECYCLE_LABEL[cur]}”. Mọi phòng nhìn trạng thái này để biết có được chạy hàng hay không, nên lùi chặng phải ghi lý do.`,
        inputLabel: 'Lý do',
        placeholder: 'VD: khách bắt sửa lại mẫu chân bàn',
        required: true,
        confirmLabel: 'Chuyển trạng thái',
      })
      if (!reason) return
    }
    setBusy(true)
    try {
      await api(`/api/dept/technical/products/${d.id}/lifecycle`, {
        method: 'POST',
        body: { to, reason },
      })
      c.toast.success(`Đã chuyển sang “${LIFECYCLE_LABEL[to]}”`)
      c.router.refresh()
    } catch (e) {
      c.toast.error(
        'Không chuyển được trạng thái',
        e instanceof ApiError ? e.message : 'Có lỗi',
      )
    } finally {
      setBusy(false)
    }
  }

  if (!canStatus)
    return (
      <span className={`btn lc lc-${cur}`} title={title}>
        <span className="dot" aria-hidden />
        {LIFECYCLE_LABEL[cur]}
      </span>
    )

  return (
    <details className="dd">
      <summary className={`btn lc lc-${cur}`} title={title} aria-busy={busy}>
        <span className="dot" aria-hidden />
        {busy ? 'Đang chuyển…' : LIFECYCLE_LABEL[cur]}
        <ChevronDown size={13} aria-hidden />
      </summary>
      <div className="dd-m lc-m" role="menu">
        <span className="g">Trạng thái hồ sơ</span>
        {LIFECYCLES.map((s, i) => (
          <button
            key={s}
            type="button"
            role="menuitem"
            aria-current={s === cur ? 'true' : undefined}
            disabled={s === cur}
            onClick={(e) => void chuyen(s, e.currentTarget)}
          >
            <span className="i">
              {s === cur ? <Check size={13} aria-hidden /> : i + 1}
            </span>
            <span>
              <b>{LIFECYCLE_LABEL[s]}</b>
              <small>{LIFECYCLE_HINT[s]}</small>
            </span>
          </button>
        ))}
      </div>
    </details>
  )
}

export function NutKhoa({ d, c }: { d: HoSoView; c: HoSoCtx }) {
  const prompt = usePrompt()
  const [busy, setBusy] = useState(false)

  async function chay(
    method: 'POST' | 'DELETE',
    body: unknown,
    ok: string,
    hint: string,
  ) {
    if (busy) return
    setBusy(true)
    try {
      await api(`/api/dept/technical/products/${d.id}/lock`, { method, body })
      c.toast.success(ok, hint)
      if (method === 'POST') c.setCheDoSua(false)
      c.router.refresh()
    } catch (e) {
      c.toast.error('Không thực hiện được', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  if (!c.khoa)
    return (
      <button
        type="button"
        className="btn"
        aria-busy={busy}
        title="Chốt hồ sơ: mọi phòng dùng bản này, muốn sửa phải mở khoá"
        onClick={() =>
          void chay(
            'POST',
            { note: null },
            'Đã khoá hồ sơ',
            'Mọi phòng dùng bản này; muốn sửa phải mở khoá',
          )
        }
      >
        <Lock size={14} aria-hidden />
        <span className="t">{busy ? 'Đang khoá…' : 'Khoá hồ sơ'}</span>
      </button>
    )

  return (
    <button
      type="button"
      className="btn"
      aria-busy={busy}
      title="Mở khoá để sửa — phải ghi lý do"
      onClick={async () => {
        const reason = await prompt({
          title: 'Mở khoá hồ sơ để sửa?',
          description:
            'Hồ sơ đang khoá là bản mọi phòng đang dùng. Mở khoá để sửa thì phải ghi lý do — lưu lại để sau còn truy.',
          inputLabel: 'Lý do mở khoá',
          placeholder: 'VD: khách đổi quy cách chân bàn, phải sửa định mức',
          required: true,
          confirmLabel: 'Mở khoá',
        })
        if (!reason) return
        await chay('DELETE', { reason }, 'Đã mở khoá', 'Nhớ khoá lại sau khi sửa xong')
      }}
    >
      <LockOpen size={14} aria-hidden />
      <span className="t">{busy ? 'Đang mở…' : 'Mở khoá'}</span>
    </button>
  )
}
