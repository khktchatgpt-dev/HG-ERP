'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/shadcn/button'
import type { DieRow } from '@/modules/dept/technical/dies.repo'

/**
 * XEM MẶT CẮT KHUÔN NGUYÊN KHỔ — và phóng to có kiểm soát.
 *
 * ⚠️ SỰ THẬT VỀ ĐỘ NÉT, nói thẳng ở đây để người sau khỏi đi tìm cách "làm ảnh
 * rõ hơn": ảnh nhúng trong file Excel của Kỹ thuật BÉ THẬT — đo 13/09/2026 trên
 * 167 tấm, trung vị 150×103 px, KHÔNG tấm nào rộng quá 150. Không có thuật toán
 * nào thêm được nét mà bản gốc không có. Thứ duy nhất làm được là ĐỪNG LÀM NÓ
 * MỜ THÊM, và đó chính là chỗ bản trước sai:
 *
 *  · Bản trước đi qua `next/image`, mà trình tối ưu nhận `w=384`/`w=640` cho
 *    một tấm gốc rộng 150 → nó PHÓNG LÊN rồi MÃ HOÁ LẠI. Hai lần làm mờ chồng
 *    nhau. Ở đây dùng thẻ `<img>` trần, byte gốc tới thẳng trình duyệt.
 *  · Phóng to thì dùng `image-rendering: pixelated` (nội suy láng giềng gần)
 *    chứ không để trình duyệt làm mượt: nét vẽ kỹ thuật là ĐƯỜNG THẲNG MẢNH —
 *    làm mượt biến chúng thành vệt xám, còn nhân bản điểm ảnh thì giữ được
 *    đường ở đâu và dày bao nhiêu, tức là giữ đúng thứ người xem cần đọc.
 *
 * Muốn thật sự nét hơn thì phải chụp/vẽ lại từ bản gốc — không phải kéo giãn.
 */

const ZOOMS = [1, 2, 3] as const

export function KhuonImageViewer({
  die,
  url,
  onClose,
}: {
  die: Pick<DieRow, 'id' | 'code' | 'name'> | null
  url: string | null
  onClose: () => void
}) {
  // Mặc định 1×: từ 13/09/2026 ảnh trong kho đã là bản xử lý ×3 (quanh 450px)
  // nên khổ gốc đã đủ đọc; phóng thêm chỉ để soi góc bo.
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1)
  const open = !!die && !!url

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={die ? `Mặt cắt khuôn ${die.code}` : ''}
      maxWidth="sm:max-w-3xl"
    >
      {open && (
        <div className="flex flex-col gap-3">
          <div className="bg-background flex min-h-72 items-center justify-center overflow-auto rounded-lg border p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- byte gốc tới thẳng trình duyệt, không qua trình tối ưu (xem docstring) */}
            <img
              src={url}
              alt={`Mặt cắt khuôn ${die.code}`}
              style={{
                zoom,
                imageRendering: zoom > 2 ? 'pixelated' : 'auto',
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground mr-1 text-xs">Phóng</span>
              {ZOOMS.map((z) => (
                <Button
                  key={z}
                  variant={zoom === z ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setZoom(z)}
                >
                  {z}×
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/khuon/${die.id}`}>Mở hồ sơ khuôn</Link>
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">
            Ảnh bóc từ file Excel của Kỹ thuật (gốc quanh 150×100 px), đã kéo giãn mức xám
            cho nét thành đen liền và lưu sẵn bản ×3. Phóng thêm chỉ nhân điểm ảnh chứ
            không tạo ra nét mới — cần kích thước chính xác thì tra bản vẽ gốc.
          </p>
        </div>
      )}
    </Modal>
  )
}
