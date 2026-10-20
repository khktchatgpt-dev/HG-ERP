'use client'

import { NoticeBar } from '@/components/kit'
import { duplicateLinePairs, duplicateLinesMessage } from '@/lib/po-line-dup'
import { mergeLineInto } from '../_lib/po-line'
import type { DonCtx } from './useDonChungTu'

/**
 * CẢNH BÁO TRÙNG DÒNG trên lưới lúc sửa — thay cho lời chặn cứng lúc Lưu
 * (30/09/2026, thông lệ ERP: dòng định danh bằng số dòng, cùng mã nhiều dòng
 * là chuyện thường). Chỉ báo TRÙNG THẬT: cùng mã + quy cách + chiều dài cây
 * (`lib/po-line-dup`) — nhôm cùng cây khác chiều dài cắt không bị báo.
 *
 * Nút "Gộp" gộp cặp đầu tiên; cặp sau hiện ra ở lần vẽ kế. Không hiện nút khi:
 * hai dòng khác giá (chọn giá là việc người mua), hoặc đang ĐIỀU CHỈNH đơn đã
 * gửi mà dòng bị gộp đã lưu (bỏ dòng đó phải đi đường xoá dòng có kiểm hàng về).
 */
export function TrungDong({ d }: { d: DonCtx }) {
  const { editing, adjusting, lines, setLines, setSel, setPick } = d
  if (!editing) return null
  const pairs = duplicateLinePairs(lines)
  const msg = duplicateLinesMessage(pairs)
  if (!msg) return null
  const [a, b] = pairs[0]
  const merged = mergeLineInto(lines[a], lines[b])
  const canMerge = merged != null && !(adjusting && lines[b].po_line_id)
  return (
    <NoticeBar
      tag="Trùng dòng"
      action={
        canMerge
          ? {
              label: `Gộp dòng ${b + 1} vào dòng ${a + 1}`,
              onClick: () => {
                setLines((ls) =>
                  ls.flatMap((l, i) => (i === a ? [merged] : i === b ? [] : [l])),
                )
                setSel([])
                setPick(a)
              },
            }
          : undefined
      }
    >
      {msg} ({lines[a].code || lines[a].name})
      {merged == null ? ' — hai dòng khác giá, sửa tay rồi xoá một dòng' : ''}. Lưu được,
      nhưng thường là gõ trùng.
    </NoticeBar>
  )
}
