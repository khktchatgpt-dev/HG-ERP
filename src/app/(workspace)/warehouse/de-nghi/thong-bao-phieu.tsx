'use client'

import { gio } from '@/lib/de-nghi'
import type { PhieuForm } from './de-nghi.shared'

/** Một dải lưu ý của Kho: nhãn + câu. `tone`: '' vàng · 'stop' đỏ nhạt · 'mut' xám. */
function Dai({
  tone = '',
  tag,
  children,
}: {
  tone?: '' | 'stop' | 'mut'
  tag: string
  children: React.ReactNode
}) {
  return (
    <div className={`kh-note ${tone}`.trim()}>
      <span className="tag">{tag}</span>
      <span>{children}</span>
    </div>
  )
}

/**
 * DẢI THÔNG BÁO theo trạng thái phiếu đề nghị: lập lại (Đ8) · bị từ chối · chờ
 * duyệt · đã duyệt (kèm lời dặn Đ7) · xong / chốt thiếu · đã huỷ. Viết lại không
 * kit (Kho lối ERP · B5).
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
        <Dai tone="mut" tag="Lập lại">
          Chép từ <b className="kh-num">{lapLaiTu}</b>: số lượng theo số đã duyệt, đơn giá
          theo lần mua gần nhất, dòng lãnh đạo duyệt 0 đã bỏ. Chưa lưu — sửa rồi bấm Lưu
          nháp hoặc Gửi lãnh đạo duyệt.
        </Dai>
      )}
      {phieu.status === 'draft' && phieu.rejected_at && (
        <Dai tone="stop" tag="Bị từ chối">
          {phieu.rejected_by_name ?? 'Lãnh đạo'} từ chối lúc {gio(phieu.rejected_at)}: “
          {phieu.rejected_reason}”. Sửa theo lý do rồi gửi lại.
        </Dai>
      )}
      {phieu.status === 'pending' && (
        <Dai tag="Chờ duyệt">
          Đã gửi lúc {gio(phieu.submitted_at)} — lãnh đạo đã nhận thông báo và duyệt trên
          hệ thống (cả trên điện thoại). Cần nhắc thì bấm “Chép đường dẫn” gửi Zalo. Muốn
          sửa thì rút về nháp.
        </Dai>
      )}
      {(phieu.status === 'approved' || phieu.status === 'ordering') &&
        phieu.approved_at && (
          <Dai tone="mut" tag="Đã duyệt">
            {phieu.approved_by_name ?? 'Lãnh đạo'} duyệt lúc {gio(phieu.approved_at)}
            {phieu.lines.some((l) => l.approved_qty != null) &&
              ` · sửa số ${phieu.lines.filter((l) => l.approved_qty != null).length} dòng (cột Số duyệt)`}
            .{' '}
            {phieu.status === 'approved'
              ? 'Kho đi mua theo số duyệt rồi bấm “Nhập hàng đã mua”; không mua nữa thì “Chốt xong” + lý do.'
              : `Đã nhập đủ ${muaDong - thieu}/${muaDong} dòng — mua chuyến sau thì bấm “Nhập hàng đã mua” lần nữa (lưới chỉ còn phần thiếu), không mua nữa thì “Chốt xong” + lý do.`}
            {phieu.approve_note && (
              <b style={{ display: 'block', marginTop: 2 }}>
                Lãnh đạo dặn: “{phieu.approve_note}”
              </b>
            )}
          </Dai>
        )}
      {phieu.status === 'done' && (
        <Dai tone={phieu.closed_at ? '' : 'mut'} tag="Xong">
          {phieu.closed_at
            ? `${phieu.closed_by_name ?? 'Kho'} chốt xong lúc ${gio(phieu.closed_at)} khi còn ${thieu} dòng thiếu · lý do: ${phieu.closed_reason ?? ''}`
            : 'Đã nhập đủ mọi dòng theo số duyệt.'}
        </Dai>
      )}
      {phieu.status === 'cancelled' && (
        <Dai tone="mut" tag="Đã huỷ">
          Huỷ lúc {gio(phieu.cancelled_at)} · lý do: {phieu.cancel_reason}
        </Dai>
      )}
    </>
  )
}
