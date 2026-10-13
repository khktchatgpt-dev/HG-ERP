'use client'

import { gio } from '@/lib/de-nghi'
import { NoticeBar } from '@/components/kit'
import type { PhieuForm } from './de-nghi.shared'

/**
 * DẢI THÔNG BÁO theo trạng thái phiếu đề nghị: lập lại (Đ8) · bị từ chối · chờ
 * duyệt · đã duyệt (kèm lời dặn Đ7) · xong / chốt thiếu · đã huỷ. Tách khỏi
 * `DeNghiScreen` 14/10/2026 (chạm trần 800 dòng khi thêm Đ8).
 */
export function ThongBaoPhieu({
  phieu,
  lapLaiTu,
  muaDong,
  thieu,
}: {
  phieu: PhieuForm
  /** Mã phiếu nguồn khi màn là bản lập lại. */
  lapLaiTu: string | null
  /** Số dòng phải mua / số dòng còn thiếu (đếm từ sổ kho). */
  muaDong: number
  thieu: number
}) {
  return (
    <>
      {lapLaiTu && (
        <NoticeBar tone="neutral" tag="Lập lại">
          Chép từ <b className="num">{lapLaiTu}</b>: số lượng theo số đã duyệt, đơn giá
          theo lần mua gần nhất, dòng lãnh đạo duyệt 0 đã bỏ. Chưa lưu — sửa rồi bấm Lưu
          nháp hoặc Gửi lãnh đạo duyệt.
        </NoticeBar>
      )}
      {phieu.status === 'draft' && phieu.rejected_at && (
        <NoticeBar tone="stop" tag="Bị từ chối">
          {phieu.rejected_by_name ?? 'Lãnh đạo'} từ chối lúc {gio(phieu.rejected_at)}: “
          {phieu.rejected_reason}”. Sửa theo lý do rồi gửi lại.
        </NoticeBar>
      )}
      {phieu.status === 'pending' && (
        <NoticeBar tone="warn" tag="Chờ duyệt">
          Đã gửi lúc {gio(phieu.submitted_at)} — lãnh đạo đã nhận thông báo và duyệt trên
          hệ thống (cả trên điện thoại). Cần nhắc thì bấm “Chép đường dẫn” gửi Zalo. Muốn
          sửa thì rút về nháp.
        </NoticeBar>
      )}
      {(phieu.status === 'approved' || phieu.status === 'ordering') &&
        phieu.approved_at && (
          <NoticeBar tone="neutral" tag="Đã duyệt">
            {phieu.approved_by_name ?? 'Lãnh đạo'} duyệt lúc {gio(phieu.approved_at)}
            {phieu.lines.some((l) => l.approved_qty != null) &&
              ` · sửa số ${phieu.lines.filter((l) => l.approved_qty != null).length} dòng (cột Số duyệt)`}
            .{' '}
            {phieu.status === 'approved'
              ? 'Kho đi mua theo số duyệt rồi bấm “Nhập hàng đã mua”; không mua nữa thì “Chốt xong” + lý do.'
              : `Đã nhập đủ ${muaDong - thieu}/${muaDong} dòng — mua chuyến sau thì bấm “Nhập hàng đã mua” lần nữa (lưới chỉ còn phần thiếu), không mua nữa thì “Chốt xong” + lý do.`}
            {phieu.approve_note && (
              <b className="mt-0.5 block">Lãnh đạo dặn: “{phieu.approve_note}”</b>
            )}
          </NoticeBar>
        )}
      {phieu.status === 'done' && (
        <NoticeBar tone={phieu.closed_at ? 'warn' : 'neutral'} tag="Xong">
          {phieu.closed_at
            ? `${phieu.closed_by_name ?? 'Kho'} chốt xong lúc ${gio(phieu.closed_at)} khi còn ${thieu} dòng thiếu · lý do: ${phieu.closed_reason ?? ''}`
            : 'Đã nhập đủ mọi dòng theo số duyệt.'}
        </NoticeBar>
      )}
      {phieu.status === 'cancelled' && (
        <NoticeBar tone="neutral" tag="Đã huỷ">
          Huỷ lúc {gio(phieu.cancelled_at)} · lý do: {phieu.cancel_reason}
        </NoticeBar>
      )}
    </>
  )
}
