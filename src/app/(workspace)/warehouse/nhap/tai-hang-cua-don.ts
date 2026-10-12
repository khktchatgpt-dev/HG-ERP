import type { User } from '@/modules/core/users/users.repo'
import { posService } from '@/modules/dept/supply/pos.service'
import { HttpError } from '@/server/http'
import { todayVn } from '@/lib/date-vn'

/**
 * NẠP HỘP "HÀNG CỦA ĐƠN" — mở trên Kho › Hàng về bằng `?don=<id>` (bản vẽ B1-3,
 * duyệt 12/10/2026). Thay cho link sang `/mua-hang/don/[id]`: NV Kho không có
 * quyền vào khu Mua hàng, bấm mã đơn là bị chuyển về trang chủ.
 *
 * CHỈ XEM. Không truy vấn mới: đúng ba hàm trang đơn và hộp Giao nhận của Cung
 * ứng dùng (`posService.detail` · `listShipments`), nên "đã về / còn chờ" ở đây
 * không thể lệch với bên đó. Việc với NCC (hẹn/dời đợt, chốt thiếu) ở lại Cung ứng.
 *
 * Trả `null` khi đơn không tồn tại — tham số hỏng thì màn bỏ qua, không vỡ.
 */
export async function taiHangCuaDon(user: User, poId: string) {
  let detail
  try {
    detail = await posService.detail(user, poId)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null
    throw e
  }
  const { po, lines, status_lines, extra_lsx, warehouse_docs } = detail
  const shipments = await posService.listShipments(user, po.id)
  const st = new Map(status_lines.map((s) => [s.id, s]))
  const dotCuaDong = new Map<string, number[]>()
  const songs = shipments
    .filter((s) => s.status !== 'cancelled')
    .sort((a, b) => a.seq - b.seq)
  for (const s of songs)
    for (const l of s.lines)
      dotCuaDong.set(l.po_line_id, [...(dotCuaDong.get(l.po_line_id) ?? []), s.seq])

  const dongVt = lines.filter((l) => l.id && l.material_id)
  return {
    po: {
      id: po.id,
      code: po.code,
      status: po.status as string,
      supplier_name: po.supplier_name ?? '?',
      lsx_code: po.lsx_code ?? null,
      extra_lsx: extra_lsx.map((x) => x.code),
      expected_at: po.expected_at ? po.expected_at.slice(0, 10) : null,
      assignee_name: po.assignee_name ?? null,
    },
    lines: dongVt.map((l) => {
      const s = st.get(l.id!)
      return {
        id: l.id!,
        code: l.material_code || null,
        name: l.material_name,
        unit: l.material_unit,
        ordered: Number(s?.qty_ordered ?? l.qty_ordered),
        received: Number(s?.qty_received ?? 0),
        open: Number(s?.qty_open ?? 0),
        closed_short: s?.closed_short_at != null,
        dots: dotCuaDong.get(l.id!) ?? [],
      }
    }),
    /** Dòng tự do (gỗ theo mã SP…) — không vào sổ kho, chỉ đếm để nói thật. */
    free_lines: lines.length - dongVt.length,
    shipments: songs.map((s) => ({
      id: s.id,
      seq: s.seq,
      date: s.expected_date.slice(0, 10),
      status: s.status,
      note: s.note,
      lines: s.lines.map((l) => ({ po_line_id: l.po_line_id, qty: Number(l.qty) })),
    })),
    docs: warehouse_docs.map((d) => ({
      doc_id: d.doc_id,
      code: d.code,
      kind: d.kind,
      // `at` là ngày thuần HOẶC mốc giờ UTC (`docEventAt`) — quy về ngày giờ VN:
      // PNK-2026-0099 ghi 05/10 23:02 UTC = 06/10 ở xưởng, cắt chuỗi sẽ in 05/10.
      at: d.at.length > 10 ? todayVn(new Date(d.at)) : d.at.slice(0, 10),
      qty_total: d.qty_total,
      reversed_by: d.reversed_by,
    })),
  }
}

export type HangCuaDonData = NonNullable<Awaited<ReturnType<typeof taiHangCuaDon>>>
