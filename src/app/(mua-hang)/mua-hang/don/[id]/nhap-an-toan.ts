import type { PoHeader } from '@/app/(mua-hang)/mua-hang/don/_lib/po-draft'
import type { Line } from '@/app/(mua-hang)/mua-hang/don/_lib/po-line'
import type { PlanColumn } from './soan-don'

/* ── TỰ LƯU NHÁP ĐƠN ĐANG SOẠN VÀO TRÌNH DUYỆT ─────────────────────────────
   Đơn 20 dòng gõ dở mà F5 / mất mạng / bấm nhầm link là mất sạch.

   BẢN 2 (02/10/2026 — user báo "rời trang thì mất, phải tạo lại từ đầu"). Bản 1
   giữ MỘT nháp mỗi khoá và NGỪNG tự lưu khi banner "có bản gõ dở" đang hiện:
   người soạn bỏ qua banner, gõ đơn mới, rời trang → mất trắng đơn mới, chỉ còn
   bản cũ. Nay mỗi lượt mở màn là một PHIÊN (id riêng) ghi vào khay chung của
   khoá; nháp phiên khác nằm yên chờ khôi phục, không bao giờ bị đè. */

export type SavedDraft = {
  /** Phiên soạn đã ghi bản này — khôi phục thì phiên mới nhận lại id đó. */
  id: string
  at: string
  header: PoHeader
  lines: Line[]
  shipCols: PlanColumn[]
}
export type DraftSnap = Omit<SavedDraft, 'id' | 'at'>

/** Giữ tối đa bấy nhiêu bản gõ dở mỗi khoá — bản cũ nhất rơi trước. */
export const DRAFT_MAX = 5
/** Nháp quá hạn thì bỏ — sau một tháng giá/tồn đã khác, khôi phục là hại. */
export const DRAFT_TTL_MS = 30 * 86_400_000

/**
 * Đơn đang sửa: khoá theo id. Đơn MỚI: khoá theo ngữ cảnh mở (lệnh, NCC, mã
 * mồi từ URL) — tới 29/09/2026 mọi đơn mới chung một khoá `moi`, nên mở đơn
 * mới cho lệnh B vẫn bị mời khôi phục bản gõ dở của lệnh A.
 */
export const draftKeyFor = (poId: string | null, ctx: (string | undefined)[] = []) =>
  `hg.mua-hang.don.nhap:${poId ?? ['moi', ...ctx.map((c) => c || '-')].join(':')}`

const valid = (d: unknown): d is SavedDraft => {
  const x = d as SavedDraft | null
  return !!x && !!x.header && Array.isArray(x.lines) && x.lines.length > 0
}

/** Các bản gõ dở của khoá, MỚI NHẤT trước. Đọc được cả bản 1 (một object trơn). */
export function readDrafts(key: string, now = Date.now()): SavedDraft[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const j = JSON.parse(raw) as { items?: unknown[] } | SavedDraft
    const items: unknown[] =
      'items' in j && Array.isArray(j.items) ? j.items : [{ ...j, id: 'ban-cu' }]
    return items
      .filter(valid)
      .filter((d) => now - Date.parse(d.at) < DRAFT_TTL_MS)
      .sort((a, b) => b.at.localeCompare(a.at))
  } catch {
    return []
  }
}

function writeAll(key: string, items: SavedDraft[]): void {
  try {
    if (items.length === 0) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify({ v: 2, items }))
  } catch {
    /* hết chỗ / chế độ riêng tư — bỏ qua, không chặn soạn */
  }
}

/** Ghi (hoặc thay) bản của phiên `id`. Đơn chưa có dòng nào thì không đáng giữ. */
export function upsertDraft(
  key: string,
  id: string,
  snap: DraftSnap,
  now = new Date(),
): void {
  const rest = readDrafts(key, now.getTime()).filter((d) => d.id !== id)
  if (snap.lines.length === 0) return writeAll(key, rest)
  const mine: SavedDraft = { ...snap, id, at: now.toISOString() }
  writeAll(key, [mine, ...rest].slice(0, DRAFT_MAX))
}

export function removeDraft(key: string, id: string): void {
  writeAll(
    key,
    readDrafts(key).filter((d) => d.id !== id),
  )
}

/** Chữ ký để so "đã khác bản gốc chưa" — chỉ ghi nháp khi khác. */
export function draftSignature(d: DraftSnap): string {
  return JSON.stringify([d.header, d.lines, d.shipCols])
}

/** "3 dòng · VIT0210, NH-0569, +1" — đủ để nhận ra bản nào là đơn nào. */
export function draftLabel(d: SavedDraft): string {
  const codes = d.lines.map((l) => l.code || l.name).filter(Boolean)
  const head = codes.slice(0, 2).join(', ')
  const more = codes.length > 2 ? `, +${codes.length - 2}` : ''
  return `${d.lines.length} dòng${head ? ` · ${head}${more}` : ''}`
}

/**
 * Link nội bộ có làm RỜI màn không — lọc những cú bấm không phải chuyển trang:
 * mở tab mới, tải file, neo trong trang, link ra ngoài.
 */
export function isLeavingClick(
  e: Pick<
    MouseEvent,
    'button' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'defaultPrevented'
  >,
  a: { href: string; target: string; hasDownload: boolean },
  here: { origin: string; pathname: string },
): boolean {
  if (e.defaultPrevented || e.button !== 0) return false
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return false
  if (a.hasDownload || (a.target && a.target !== '_self')) return false
  let u: URL
  try {
    u = new URL(a.href, here.origin)
  } catch {
    return false
  }
  if (u.origin !== here.origin) return false // link ra ngoài: beforeunload lo
  return u.pathname !== here.pathname
}
