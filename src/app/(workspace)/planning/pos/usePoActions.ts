'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
/**
 * Chỉ cần BỐN trường để hỏi han và gọi API — không cần cả dòng PO.
 *
 * Trang chi tiết `/planning/pos/[id]` nạp bản đầy đủ từ server (có `template`,
 * điều khoản, chiết khấu…) nên hình thù khác dòng ở danh sách; buộc cả hai về
 * một kiểu thì một trong hai phải bịa thêm trường rỗng.
 */
export type PoRef = {
  id: string
  code: string
  supplier_name: string
  lsx_code: string | null
}

/**
 * MỌI LỜI GỌI API CỦA MÀN ĐƠN ĐẶT HÀNG — một chỗ.
 *
 * Trước đây 10 hàm này nằm giữa thân `PosManager`, xen kẽ với state lọc và định
 * nghĩa cột, nên trang chi tiết đơn sắp tách ra (`/planning/pos/[id]`) sẽ không
 * có đường nào dùng lại ngoài chép sang — mà chép thì hai bên bắt đầu lệch ngay
 * lần sửa đầu tiên, đúng vết xe của bảng nhãn trạng thái vừa phải gom lại.
 *
 * Hook giữ cờ `busy` và bắt lỗi + báo toast tại chỗ; hàm nào có `confirm()` thì
 * hỏi luôn ở đây, vì câu hỏi là một phần của thao tác chứ không phải của giao
 * diện gọi nó. Mọi hàm trả `boolean` = đã đổi được gì trên server chưa, để phía
 * gọi biết lúc nào nên đóng hộp thoại.
 *
 * `onDone` chạy sau mỗi thao tác THÀNH CÔNG — chỗ gọi dùng để đóng khối chi tiết
 * đang mở (đơn vừa đổi trạng thái thì bản đang xem đã cũ).
 */
export function usePoActions({ onDone }: { onDone?: () => void } = {}) {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)

  async function send(
    url: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body?: unknown,
    failTitle = 'Thao tác thất bại',
  ) {
    setBusy(true)
    try {
      await api(url, { method, body })
      router.refresh()
      return true
    } catch (e) {
      toast.error(failTitle, e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusy(false)
    }
  }

  /**
   * HÀNG LOẠT — hỏi MỘT lần rồi chạy tuần tự qua chính các route lẻ.
   *
   * Cố ý không thêm route "duyệt theo lô" ở server: mỗi đơn vẫn đi qua đúng
   * đường cũ nên phân quyền, sự kiện và lịch sử phê duyệt không có bản thứ hai
   * để mà lệch. Đổi lại là N lượt gọi — chấp nhận được ở quy mô một lô người
   * thật tích tay, và nếu sau này lô lớn tới mức thấy chậm thì đó mới là lúc
   * đáng làm route gộp.
   *
   * Chạy TUẦN TỰ chứ không song song: đây là ghi dữ liệu, và một lô 20 đơn bắn
   * song song vào cùng một bảng chỉ để nhanh hơn vài giây là đánh đổi tồi.
   *
   * Lỗi giữa chừng KHÔNG dừng cả lô — đơn nào hỏng thì báo đích danh ở cuối.
   */
  async function bulk(
    items: PoRef[],
    step: { path: string; body?: unknown; title: string; confirmLabel: string },
  ) {
    if (items.length === 0) return false
    const ok = await confirm({
      title: `${step.title} ${items.length} đơn?`,
      description: items
        .slice(0, 8)
        .map((p) => p.code)
        .join(', ')
        .concat(items.length > 8 ? `, … và ${items.length - 8} đơn nữa` : ''),
      confirmLabel: step.confirmLabel,
    })
    if (!ok) return false

    setBusy(true)
    const failed: string[] = []
    try {
      for (const p of items) {
        try {
          await api(`/api/dept/supply/pos/${p.id}/${step.path}`, {
            method: 'POST',
            body: step.body,
          })
        } catch {
          failed.push(p.code)
        }
      }
    } finally {
      setBusy(false)
    }
    router.refresh()

    const okCount = items.length - failed.length
    if (failed.length === 0) {
      toast.success(`${step.title} xong`, `${okCount} đơn`)
    } else {
      toast.error(
        `${okCount}/${items.length} đơn thành công`,
        `Không xong: ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? '…' : ''}`,
      )
    }
    onDone?.()
    return failed.length === 0
  }

  /** Thành công thì báo toast + đóng khối chi tiết đang mở. */
  function done(ok: boolean, title: string, detail?: string) {
    if (!ok) return false
    toast.success(title, detail)
    onDone?.()
    return true
  }

  /** Gửi GĐ duyệt (0116): nháp → chờ duyệt, lúc này GĐ mới nhận thông báo. */
  async function submitPo(po: PoRef) {
    const ok = await confirm({
      title: `Gửi ${po.code} cho Giám đốc duyệt?`,
      description: `NCC: ${po.supplier_name} · ${po.lsx_code ? `LSX ${po.lsx_code}` : 'đơn ngoài LSX'}. Gửi rồi thì hết sửa thoải mái — chỉ còn sửa được khi đơn vẫn chưa duyệt.`,
      confirmLabel: 'Gửi duyệt',
    })
    if (!ok) return false
    return done(
      await send(`/api/dept/supply/pos/${po.id}/submit`, 'POST'),
      'Đã gửi GĐ duyệt',
      po.code,
    )
  }

  /**
   * RÚT VỀ NHÁP (0128): đơn chờ duyệt không sửa trực tiếp — rút về, sửa, gửi
   * lại; con số GĐ thấy trong thông báo luôn là bản cuối.
   */
  async function withdrawPo(po: PoRef) {
    const ok = await confirm({
      title: `Rút ${po.code} về nháp?`,
      description:
        'Đơn rời bàn duyệt của Giám đốc — sửa xong bấm "Gửi GĐ duyệt" lại từ đầu.',
      confirmLabel: 'Rút về nháp',
    })
    if (!ok) return false
    return done(
      await send(`/api/dept/supply/pos/${po.id}/withdraw`, 'POST'),
      'Đã rút về nháp',
      po.code,
    )
  }

  /** DUYỆT — chỉ cần gật, không cần lý do. */
  async function approve(po: PoRef) {
    const ok = await confirm({
      title: `Duyệt đơn đặt ${po.code}?`,
      description: `NCC: ${po.supplier_name} · ${po.lsx_code ? `LSX ${po.lsx_code}` : 'đơn ngoài LSX'}. Duyệt xong Cung ứng mới gửi được cho NCC (BR-05).`,
      confirmLabel: 'Duyệt',
    })
    if (!ok) return false
    return done(
      await send(`/api/dept/supply/pos/${po.id}/decide`, 'POST', { decision: 'approve' }),
      'Đã duyệt',
      po.code,
    )
  }

  /**
   * TỪ CHỐI — lý do do phía gọi thu bằng hộp thoại (`PoDialogs.ReasonDialog`).
   *
   * Trước đây chỗ này gọi `window.prompt`: lạc hẳn khỏi `useConfirm`/`Modal`
   * dùng ở mọi nơi khác, không dark mode, không giới hạn độ dài, và một số
   * trình duyệt chặn thẳng — lúc đó nút bấm không ra gì mà cũng không báo lỗi.
   * Lý do từ chối còn đi vào lịch sử phê duyệt và vào thông báo gửi người soạn,
   * nên nó là dữ liệu thật, không phải một câu hỏi cho có.
   */
  async function reject(po: PoRef, reason: string) {
    if (!reason.trim()) return false
    return done(
      await send(`/api/dept/supply/pos/${po.id}/decide`, 'POST', {
        decision: 'reject',
        reason: reason.trim(),
      }),
      'Đã từ chối',
      po.code,
    )
  }

  async function advance(po: PoRef, to: 'ordered' | 'confirmed' | 'in_transit') {
    const labels = {
      ordered: 'Gửi NCC',
      confirmed: 'NCC xác nhận',
      in_transit: 'Đang giao',
    }
    const ok = await confirm({
      title: `${labels[to]} — ${po.code}?`,
      confirmLabel: labels[to],
    })
    if (!ok) return false
    return done(
      await send(`/api/dept/supply/pos/${po.id}/advance`, 'POST', { to }),
      labels[to],
      po.code,
    )
  }

  /**
   * DỜI HẸN GIAO — thao tác duy nhất được phép trên đơn ĐÃ DUYỆT.
   *
   * Đơn đã duyệt không cho sửa lại (giá và dòng hàng là cam kết với GĐ và là bản
   * NCC đang cầm). Nhưng ngày giao thì đổi thật; không có đường ghi lại thì người
   * dùng phải chọn giữa để ngày sai (cảnh báo "quá hẹn" kêu oan) hoặc huỷ đơn
   * tạo lại (mất số PO đã gửi NCC).
   */
  async function reschedule(po: PoRef, date: string, reason: string) {
    if (!date || !reason.trim()) return false
    return done(
      await send(`/api/dept/supply/pos/${po.id}/reschedule`, 'POST', {
        expected_at: date,
        reason: reason.trim(),
      }),
      `Đã dời hẹn giao ${po.code}`,
      `${new Date(date).toLocaleDateString('vi-VN')} — lý do đã ghi vào đơn`,
    )
  }

  /** BÀN GIAO (0128): đổi người phụ trách — trưởng phòng CƯ / GĐ / admin. */
  async function reassign(po: PoRef, toId: string, toName?: string) {
    if (!toId) return false
    return done(
      await send(`/api/dept/supply/pos/${po.id}/reassign`, 'POST', { user_id: toId }),
      `Đã bàn giao ${po.code}`,
      toName,
    )
  }

  /** HUỶ — lý do bắt buộc, thu bằng hộp thoại như `reject`. */
  async function cancelPo(po: PoRef, reason: string) {
    if (!reason.trim()) return false
    return done(
      await send(`/api/dept/supply/pos/${po.id}/cancel`, 'POST', {
        reason: reason.trim(),
      }),
      'Đã huỷ',
      po.code,
    )
  }

  /** Xoá hẳn đơn NHÁP — chưa gửi ai nên xoá là sạch, không cần lý do huỷ. */
  async function deleteDraft(po: PoRef) {
    const ok = await confirm({
      title: `Xoá nháp ${po.code}?`,
      description: 'Đơn chưa gửi duyệt — xoá là mất hẳn, không khôi phục được.',
      confirmLabel: 'Xoá nháp',
      tone: 'danger',
    })
    if (!ok) return false
    return done(
      await send(`/api/dept/supply/pos/${po.id}`, 'DELETE', undefined, 'Xoá thất bại'),
      'Đã xoá nháp',
      po.code,
    )
  }

  /**
   * Đặt "Hạn VT phải về" của LỆNH (0126) — ô của sổ Tổng hợp ĐH, sửa ngay tại
   * đầu nhóm. Không đóng khối chi tiết: đây là thao tác trên lệnh, không trên đơn.
   */
  async function setMaterialsDue(lsxId: string, date: string | null) {
    const ok = await send(`/api/dept/production/lsx/${lsxId}/materials-due`, 'PATCH', {
      materials_due_at: date,
    })
    if (ok) toast.success(date ? 'Đã đặt hạn vật tư phải về' : 'Đã xoá hạn vật tư')
    return ok
  }

  return {
    busy,
    bulk,
    submitPo,
    withdrawPo,
    approve,
    reject,
    advance,
    reschedule,
    reassign,
    cancelPo,
    deleteDraft,
    setMaterialsDue,
  }
}
