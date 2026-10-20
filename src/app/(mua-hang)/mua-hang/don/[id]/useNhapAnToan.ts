'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  draftSignature,
  isLeavingClick,
  readDrafts,
  removeDraft,
  upsertDraft,
  type DraftSnap,
  type SavedDraft,
} from './nhap-an-toan'

/** Gõ xong bao lâu thì ghi nháp. Rời trang trước lúc đó vẫn không mất: `flush`. */
const DEBOUNCE_MS = 400

/**
 * CƠ CHẾ AN TOÀN CỦA ĐƠN ĐANG SOẠN (02/10/2026 — "rời trang thì mất thông tin,
 * phải tạo lại từ đầu"). Bốn lớp, lớp sau đỡ chỗ lớp trước hở:
 *
 *  1. TỰ LƯU liên tục vào trình duyệt, theo PHIÊN — không bao giờ ngừng vì đang
 *     có nháp cũ chờ khôi phục (lỗi của bản 1), không đè nháp của phiên khác.
 *  2. GHI NGAY khi trang bị ẩn / đóng / màn bị gỡ (bấm Back, link) — không chờ
 *     hết nhịp debounce, nên ký tự gõ cuối cùng cũng còn.
 *  3. HỎI LẠI khi bấm link NỘI BỘ lúc đơn khác bản gốc (sidebar, chip…): chuyển
 *     trang trong app không bắn `beforeunload` nên trình duyệt không hỏi hộ.
 *  4. KHÔI PHỤC: banner liệt kê mọi bản gõ dở của khoá; khôi phục một bản thì
 *     bản đang gõ của phiên này cũng được ghi lại trước, không mất bên nào.
 *
 * `beforeunload` (F5, đóng tab, link ra ngoài) vẫn nằm ở `useDonChungTu`.
 */
export function useNhapAnToan({
  drafting,
  draftKey,
  snap,
  isDirty,
  apply,
}: {
  /** Đang soạn / sửa dòng (không phải xem, không phải chỉ sửa điều khoản). */
  drafting: boolean
  draftKey: string
  snap: DraftSnap
  /** Có gì chưa lưu (kể cả phần điều khoản) — quyết định có hỏi khi rời không. */
  isDirty: () => boolean
  /** Đổ một bản nháp lên màn. */
  apply: (d: SavedDraft) => void
}) {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
  const [others, setOthers] = useState<SavedDraft[]>([])
  /** Chữ ký bản gốc lúc bắt đầu soạn — khác nó mới đáng ghi nháp. */
  const baseline = useRef<string | null>(null)
  /** Vừa lưu / huỷ hẳn → không ghi lại nháp lúc màn gỡ. */
  const skip = useRef(false)
  const latest = useRef({ snap, sig: draftSignature(snap), key: draftKey, id: sessionId })

  const loadOthers = (id: string) =>
    setOthers(readDrafts(draftKey).filter((d) => d.id !== id))

  // Vào chế độ soạn: mốc bản gốc mới, đọc các bản gõ dở đang chờ.
  useEffect(() => {
    baseline.current = null
    skip.current = false
    if (!drafting) return
    const t = setTimeout(() => loadOthers(sessionId), 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ đọc lại khi đổi chế độ / khoá
  }, [drafting, draftKey])

  const changed = () =>
    baseline.current != null && latest.current.sig !== baseline.current

  /** Ghi NGAY nếu có gì để ghi — gọi lúc rời trang, không chờ debounce. */
  const flush = () => {
    const { snap: s, key, id } = latest.current
    if (!skip.current && changed()) upsertDraft(key, id, s)
  }

  // Lớp 1 — tự lưu sau mỗi nhịp gõ.
  useEffect(() => {
    const sig = draftSignature(snap)
    latest.current = { snap, sig, key: draftKey, id: sessionId }
    if (!drafting) return
    if (baseline.current == null) {
      baseline.current = sig
      return
    }
    if (sig === baseline.current) {
      removeDraft(draftKey, sessionId)
      return
    }
    const t = setTimeout(() => upsertDraft(draftKey, sessionId, snap), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [drafting, snap, draftKey, sessionId])

  // Lớp 2 — trang ẩn / đóng / màn gỡ: ghi ngay.
  const onHide = useEffectEvent(() => flush())
  useEffect(() => {
    if (!drafting) return
    const vis = () => document.visibilityState === 'hidden' && onHide()
    const hide = () => onHide()
    window.addEventListener('pagehide', hide)
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.removeEventListener('pagehide', hide)
      document.removeEventListener('visibilitychange', vis)
      flush() // màn bị gỡ (Back, chuyển trang trong app)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flush đọc ref, không cần deps
  }, [drafting])

  // Lớp 3 — bấm link nội bộ khi còn thay đổi chưa lưu: ghi nháp rồi hỏi.
  const onClick = useEffectEvent((e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.(
      'a[href]',
    ) as HTMLAnchorElement | null
    if (!a || !isDirty()) return
    const leave = isLeavingClick(
      e,
      { href: a.href, target: a.target, hasDownload: a.hasAttribute('download') },
      window.location,
    )
    if (!leave) return
    // Ô đang gõ dở chỉ chốt vào state khi rời ô — chốt trước khi ghi.
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    flush()
    const ok = window.confirm(
      'Đơn đang soạn CHƯA LƯU lên hệ thống.\n\n' +
        'Bản gõ dở đã được giữ trong trình duyệt này — mở lại màn đơn để khôi phục.\n\n' +
        'Vẫn rời trang?',
    )
    if (!ok) {
      e.preventDefault()
      e.stopPropagation()
    }
  })
  useEffect(() => {
    if (!drafting) return
    const h = (e: MouseEvent) => onClick(e)
    // CAPTURE ở document: chạy TRƯỚC listener của React (gắn ở gốc app) — chặn
    // được cả <Link> của Next lẫn link thường.
    document.addEventListener('click', h, true)
    return () => document.removeEventListener('click', h, true)
  }, [drafting])

  return {
    /** Bản gõ dở của PHIÊN KHÁC đang chờ khôi phục, mới nhất trước. */
    others,
    restore(d: SavedDraft) {
      flush() // bản đang gõ của phiên này không mất
      apply(d)
      setSessionId(d.id) // gõ tiếp ghi đè đúng bản vừa khôi phục
      setOthers((o) => o.filter((x) => x.id !== d.id))
    },
    discard(d: SavedDraft) {
      removeDraft(draftKey, d.id)
      setOthers((o) => o.filter((x) => x.id !== d.id))
    },
    /** Đã lưu lên hệ thống / huỷ hẳn: xoá nháp của phiên, không ghi lại lúc rời. */
    forget() {
      skip.current = true
      removeDraft(draftKey, sessionId)
    },
    /** Đơn có khác bản gốc lúc bắt đầu soạn không (phần dòng + đầu đơn + đợt). */
    changed,
  } as const
}
