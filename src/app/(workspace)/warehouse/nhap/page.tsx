import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { supplyRepo } from '@/modules/dept/supply/supply.repo'
import { hangVeRepo } from '@/modules/dept/warehouse/hang-ve.repo'
import { incomingBucket, isIncoming } from '@/lib/supply-watch'
import { dotKeTiep, type HangVeRow } from '@/lib/kho-hang-ve'
import { loadWatchPos, todayIso } from '@/modules/dept/supply/watch-pos'
import { HangVeScreen } from './HangVeScreen'
import { taiHangCuaDon } from './tai-hang-cua-don'

export const metadata = { title: 'Kho · Hàng về' }
export const dynamic = 'force-dynamic'

/**
 * KHO › HÀNG VỀ — Kho đợt 2 · Bước 1 (`docs/kho-hoan-thien-dot-2.md`, bản vẽ
 * https://claude.ai/artifact/AVjPo69BkZc9N9NNydvWER, duyệt 12/10/2026).
 *
 * Câu màn trả lời cho thủ kho: "hôm nay xe nào tới, cái nào trễ, tôi nhận hàng
 * của đơn nào?". Kho đang chuẩn bị nhận lại việc ghi phiếu từ Cung ứng, nên màn
 * phải NGANG Theo dõi đơn hàng: cùng tập đơn, cùng mốc hẹn, cùng con số.
 *
 * CÙNG NGUỒN với `/mua-hang/theo-doi`: `loadWatchPos` + `isIncoming` +
 * `incomingBucket` (badge menu cũng đếm bằng hàm đó — `nav-badges`). Bản 16/09
 * dùng `listOpen` + `listOpenPos` (đếm theo đợt, gồm cả đơn `approved`) nên hai
 * phòng thấy hai số. Kho xem CẢ PHÒNG — không có phạm vi "đơn của tôi".
 *
 * Màn Theo dõi bên Cung ứng giữ nguyên (chủ dự án 12/10: "tạm không xoá bên
 * Cung ứng") — hai cửa cùng sống tới khi chuyển giao xong (Bước C2).
 */
export default async function WarehouseInboundPage({
  searchParams,
}: {
  searchParams: Promise<{
    /** Mở hộp "Hàng của đơn" (chỉ xem) — bản vẽ B1-3. */
    don?: string
  }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const today = todayIso()

  const [{ rows: all, truncatedAt }, canEdit, hangCuaDon] = await Promise.all([
    loadWatchPos(user),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
    sp.don ? taiHangCuaDon(user, sp.don) : Promise.resolve(null),
  ])
  const incoming = all.filter(isIncoming)
  const ids = incoming.map((p) => p.id)
  const [dotBy, lineOpen, extraBy] = await Promise.all([
    hangVeRepo.dotMoTheoDon(ids),
    hangVeRepo.lineOpenByPoIds(ids),
    supplyRepo.extraLsxCodesByPoIds(ids),
  ])

  const rows: HangVeRow[] = incoming.map((p) => {
    const d = dotBy.get(p.id)
    return {
      po_id: p.id,
      po_code: p.code,
      supplier_name: p.supplier_name,
      lsx_code: p.lsx_code,
      extra_lsx: extraBy.get(p.id) ?? [],
      template: p.template,
      bucket: incomingBucket(p, today) ?? 'no_eta',
      expected_at: p.expected_at ? p.expected_at.slice(0, 10) : null,
      lines_done: p.lines_done,
      lines_total: p.lines_total,
      owner_name: p.assignee_name,
      dot: d ? dotKeTiep(d.dots, d.so_dot, lineOpen) : null,
    }
  })

  return (
    <HangVeScreen
      rows={rows}
      today={today}
      canEdit={canEdit}
      truncatedAt={truncatedAt}
      hangCuaDon={hangCuaDon}
    />
  )
}
