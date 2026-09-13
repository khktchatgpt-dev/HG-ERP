'use client'

import Link from 'next/link'
import { ImageOff, Maximize2 } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { DocChip } from '@/components/erp/DocChip'
import type { DieRow } from '@/modules/dept/technical/dies.repo'
import { DIE_STATUS_LABEL, DIE_STATUS_TONE, kgPerM } from '../_lib/labels'

/**
 * THẺ MỘT CÁI KHUÔN — đơn vị của thư viện `/khuon`.
 *
 * Dựng theo ĐÚNG hệ của `ProductCard` ở thư viện sản phẩm (theme v3 +
 * `components/erp`/`shadcn`), không phải bộ kit mới: hai màn này nằm cạnh nhau
 * trong mục "Dùng chung" và người dùng đọc chúng như một cặp.
 *
 * ⚠️ ẢNH KHÔNG ĐI QUA `next/image`, VÀ KHÔNG PHÓNG TO. Ảnh nhúng trong file của
 * Kỹ thuật bé thật (167 tấm, trung vị 150×103 px, không tấm nào rộng quá 150).
 * Bản trước để `next/image` với `sizes` ~288px nên trình tối ưu PHÓNG LÊN
 * `w=384` rồi MÃ HOÁ LẠI — hai lần làm mờ chồng nhau, và đó là lý do mặt cắt
 * trông nhoè. Nay hiện ở KHỔ GỐC (`max-h`/`max-w` chặn trên, không kéo giãn),
 * byte gốc tới thẳng trình duyệt; muốn soi kỹ thì bấm nút phóng ở góc để mở
 * `KhuonImageViewer`.
 *
 * `object-contain` chứ không `cover`: mặt cắt bị cắt mép là mất đúng thứ dùng
 * để nhận dạng khuôn. Ở thư viện SP cắt mép chỉ mất thẩm mỹ nên `cover` ở đó
 * là đúng.
 */
export function KhuonCard({
  die,
  imageUrl,
  onZoom,
}: {
  die: DieRow
  imageUrl?: string
  onZoom?: (url: string) => void
}) {
  const flags = [
    die.data_confidence === 'needs_review' ? 'Cần rà số liệu' : '',
    die.duplicate_group ? `Nghi trùng ${die.duplicate_group}` : '',
  ].filter(Boolean)

  return (
    <div className="bg-card group flex flex-col overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md">
      <div className="bg-background relative flex h-[124px] items-center justify-center border-b">
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- giữ khổ gốc, không cho trình tối ưu phóng + mã hoá lại */}
            <img
              src={imageUrl}
              alt=""
              className="max-h-[108px] max-w-[92%] object-contain"
            />
            {onZoom && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => onZoom(imageUrl)}
                aria-label={`Xem mặt cắt khuôn ${die.code}`}
                title="Xem mặt cắt"
                className="bg-card/90 absolute top-1.5 right-1.5 size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Maximize2 className="size-3.5" />
              </Button>
            )}
          </>
        ) : (
          <span className="text-muted-foreground flex flex-col items-center gap-1 text-[11px]">
            <ImageOff className="size-4" aria-hidden />
            chưa có mặt cắt
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/khuon/${die.id}`} className="min-w-0">
            <DocChip>{die.code}</DocChip>
          </Link>
          <span className="t-data text-muted-foreground shrink-0 text-[12px]">
            {die.weight_per_m == null ? '—' : `${kgPerM(die.weight_per_m)} kg/m`}
          </span>
        </div>

        {/* Tên cắt hai dòng: thẻ phải cao BẰNG NHAU thì lưới mới đọc lướt được,
            mà tên chi tiết trong file dài ngắn rất chênh nhau. */}
        <div className="line-clamp-2 min-h-[34px] text-[13px] leading-snug">
          {die.name ?? (
            <span className="text-muted-foreground">chưa ghi tên chi tiết</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground min-w-0 truncate text-[12px]">
            {die.holder_name ?? 'chưa ghi nơi giữ'}
          </span>
          <Badge tone={DIE_STATUS_TONE[die.status]}>{DIE_STATUS_LABEL[die.status]}</Badge>
        </div>

        {/* Cờ rà soát chiếm chỗ CỐ ĐỊNH kể cả khi trống: thẻ nhảy cao thấp theo
            việc có cờ hay không thì lưới gãy hàng. */}
        <div className="text-muted-foreground min-h-[15px] truncate text-[11px]">
          {flags.join(' · ')}
        </div>
      </div>
    </div>
  )
}
