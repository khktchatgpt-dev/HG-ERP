import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { loadWatchPos, todayIso } from '@/app/(workspace)/planning/_data/watch'
import { classifyTodo, type SupplyTodoKind } from '@/lib/supply-watch'
import { ViecScreen, type Viec } from './ViecScreen'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mua hàng · Hộp thư việc' }

/**
 * KHUÔN B — HỘP THƯ VIỆC.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * LUỒNG NGƯỜI DÙNG — thiết kế lại, KHÔNG bê màn cũ sang
 * ═══════════════════════════════════════════════════════════════════════
 *
 * BA LỐI MÒN CỦA `/planning/viec-cua-toi` cần phá, đo trên chính mã nguồn
 * ngày 10/09/2026:
 *
 *  1. MÀN CHỈ ĐỌC. Không một thao tác ghi nào. Người mua có 12 việc thì phải
 *     mở 12 trang chi tiết, làm xong lại quay ra, và mất chỗ đứng mỗi lần.
 *  2. KHÔNG CÓ HÀNG LOẠT. Năm đơn cùng chờ "gửi NCC" phải làm năm lượt y hệt
 *     nhau — trong khi màn danh sách `/planning/pos` ĐÃ CÓ thao tác hàng loạt.
 *     Hộp việc là chỗ cần nó nhất mà lại không có.
 *  3. KHÔNG GHI ĐƯỢC VIỆC ĐÃ LÀM. Gọi điện giục nhà cung cấp xong thì hệ
 *     thống không biết gì; mai mở lại, đơn vẫn nằm nguyên trong "Quá hẹn
 *     giao" y như cũ, và người thứ hai lại gọi lần nữa. Đây chính là lỗ hổng
 *     số 2 trong `docs/thiet-ke-huong-erp.md` (mọi trao đổi rơi ra Zalo).
 *
 * LUỒNG MỚI — năm nhịp, không rời trang:
 *
 *   1. Vào màn thấy năm LÀN theo nhóm việc, mỗi làn mang động từ mệnh lệnh.
 *   2. Chọn một dòng → khay bên phải mở TẠI CHỖ, danh sách không chạy đi đâu.
 *   3. Khay có đúng MỘT nút chính = việc của làn đó. Một làn, một việc.
 *   4. Tích nhiều dòng CÙNG LÀN → làm hàng loạt một lượt.
 *   5. Xong thì dòng rời khỏi làn và số trên làn tự giảm.
 *
 * ĐÓNG VÒNG BẰNG GHI CHÚ. Nhịp quan trọng nhất là "Ghi việc đã giục": gọi NCC
 * xong, gõ một câu, hệ thống lưu thành ghi chú trên chính đơn đó (qua
 * `/api/doc-notes` vốn đã có) và cho dời hẹn giao luôn nếu NCC hứa ngày mới.
 * Từ đó người thứ hai mở đơn là thấy ai đã giục, giục lúc nào, NCC nói gì —
 * thay vì hỏi nhau trên Zalo.
 *
 * KHÔNG LÀM TẮT VIỆC NGUY HIỂM. Nhóm "Về một phần" chỉ có nút MỞ ĐƠN, không
 * có nút chốt thiếu tại chỗ: chốt phần thiếu là đóng sổ một khoản tiền đã cam
 * kết với NCC, phải nhìn đủ ma trận dòng × phiếu nhập mới quyết được.
 *
 * PHẠM VI DỮ LIỆU — nói thật, không giả vờ. Khuôn B đòi hộp thư XUYÊN MỌI loại
 * chứng từ (SAP My Inbox, Dynamics work list). Hôm nay nguồn việc mới chỉ có
 * đơn mua, vì `countMyTodos` và `classifyTodo` chỉ đọc bảng đơn. Màn ghi rõ
 * điều đó ngay trên đầu thay vì để người dùng tưởng mình đã hết việc.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ nhom?: string; pham_vi?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const today = todayIso()
  const { rows, truncatedAt } = await loadWatchPos(user)

  const isSupply = user.role === 'admin' || isSupplyStaff(user)
  const manageAny =
    user.role === 'admin' || (await canAction(user, 'supply.po.manage_any'))

  const viec: Viec[] = rows
    .map((p) => ({ p, kind: classifyTodo(p, today) }))
    .filter(
      (x): x is { p: (typeof rows)[number]; kind: SupplyTodoKind } => x.kind != null,
    )
    .map(({ p, kind }) => ({
      id: p.id,
      kind,
      code: p.code,
      status: p.status,
      supplier: p.supplier_name ?? '—',
      lsx: p.lsx_code ?? null,
      assignee: p.assignee_name ?? null,
      assigned_to: p.assigned_to ?? null,
      expected_at: p.expected_at ?? null,
      total: p.total,
      currency: p.currency ?? 'VND',
      lines_done: p.lines_done,
      lines_total: p.lines_total,
      updated_at: p.updated_at ?? p.created_at,
      /**
       * QUYỀN GHI TÍNH SẴN TỪNG DÒNG ở server, không để client tự đoán.
       * Cùng luật với `assertPoOwner` của service: đúng người phụ trách, hoặc
       * trưởng phòng / admin. Client chỉ dùng cờ này để ẩn nút — server vẫn là
       * chỗ chốt.
       */
      can_act: isSupply && (manageAny || p.assigned_to === user.id),
    }))

  return (
    <ViecScreen
      today={today}
      meId={user.id}
      viec={viec}
      initialKind={sp.nhom ?? null}
      initialScope={sp.pham_vi === 'phong' ? 'phong' : 'toi'}
      truncatedAt={truncatedAt}
    />
  )
}
