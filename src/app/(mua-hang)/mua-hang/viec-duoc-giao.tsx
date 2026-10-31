'use client'

import type { AssignedItem } from '@/modules/workflow/tasks/tasks.service'
import { BangViecCuaToi } from '@/app/(shared)/phan-cong-viec/viec-cua-toi'
import { KIT_BRIDGE } from './kit-bridge'

/**
 * Ô "VIỆC ĐƯỢC GIAO" trên Bàn làm việc (phân công việc P3, bản vẽ B 30/10/2026).
 *
 * VIẾT KHÔNG KIT (chủ dự án chốt D1). Từ P5 bảng là `BangViecCuaToi` — CÙNG bảng
 * với mục "Việc của tôi" ở trang Phân công việc (người ngoài Cung ứng nhận việc ở
 * đó), nên báo hoàn thành ở hai chỗ là một cách bấm. Ở đây chỉ còn khung cuộn, bắc
 * cầu màu sang kit, và chân bảng riêng của bàn.
 *
 * Người duyệt xem bàn người khác: server trả `actions` rỗng nên bảng không có nút;
 * chân bảng nói rõ là chỉ xem.
 */
export function ViecDuocGiao({
  items,
  readOnly,
  who,
}: {
  items: AssignedItem[]
  /** Người duyệt đang xem bàn người khác — không có nút. */
  readOnly: boolean
  /** "bạn" hoặc tên chủ bàn khi xem bàn người khác. */
  who: string
}) {
  const overdue = items.filter((t) => t.overdue_days > 0).length
  return (
    <div style={KIT_BRIDGE} className="min-h-0 overflow-auto bg-[var(--surface-card)]">
      <BangViecCuaToi
        version={items}
        rows={items}
        footer={
          <>
            {items.length} việc đang giao cho {who}
            {overdue > 0 ? ` · ${overdue} quá hạn` : ''} · việc đã báo hoàn thành đang chờ
            người giao duyệt thì không nằm ở đây
            {readOnly ? ` · chỉ xem — ${who} tự báo hoàn thành trên bàn của mình` : ''}
          </>
        }
      />
    </div>
  )
}
