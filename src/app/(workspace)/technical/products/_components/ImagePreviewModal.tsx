'use client'

import Link from 'next/link'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/shadcn/button'
import { IMAGE_FRAME_BG, type ProductRow } from './types'

/**
 * Xem ảnh lớn ngay trong thư viện — Kinh doanh soi mẫu cho khách mà không phải
 * mở từng trang chi tiết rồi bấm Back.
 *
 * URL đã được server ký sẵn cho lưới nên mở hộp này KHÔNG tốn thêm lượt gọi
 * API. Ảnh để `object-contain`: thẻ ngoài lưới cắt mép (`cover`) nên đây phải
 * là chỗ xem được NGUYÊN KHỔ, không thì nút phóng to chẳng để làm gì.
 */
export function ImagePreviewModal({
  preview,
  onClose,
}: {
  preview: { product: ProductRow; url: string } | null
  onClose: () => void
}) {
  return (
    <Modal
      open={!!preview}
      onClose={onClose}
      title={preview ? preview.product.name : ''}
      maxWidth="sm:max-w-3xl"
    >
      {preview && (
        <div className="flex flex-col gap-3">
          <div
            className={`flex min-h-72 items-center justify-center overflow-hidden rounded-lg border ${IMAGE_FRAME_BG}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- xem chi tiết: giữ khổ gốc, không resize */}
            <img
              src={preview.url}
              alt={preview.product.name}
              className="max-h-[65vh] max-w-full object-contain"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground font-mono text-xs">
              {preview.product.code}
              {preview.product.customer_item_code &&
                ` · KH ${preview.product.customer_item_code}`}
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/technical/products/${preview.product.id}`}>
                Mở hồ sơ sản phẩm
              </Link>
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
